import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInThisContext } from 'node:vm';
import { configureStore } from '@reduxjs/toolkit';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Use the project's existing TypeScript dependency; no test dependencies needed.
const root = fileURLToPath(new URL('../', import.meta.url));
const modules = new Map();
function loadModule(filename) {
  if (!path.extname(filename)) filename = ['.ts', '.tsx', '/index.ts'].map(ext => filename + ext).find(existsSync);
  if (modules.has(filename)) return modules.get(filename).exports;
  const loadedModule = { exports: {} };
  modules.set(filename, loadedModule);
  const externalRequire = createRequire(filename);
  const localRequire = id => {
    if (id.startsWith('@/')) return loadModule(path.join(root, 'src', id.slice(2)));
    if (id.startsWith('.')) return loadModule(path.resolve(path.dirname(filename), id));
    return externalRequire(id);
  };
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  });
  runInThisContext(`(function(require, module, exports) {${outputText}\n})`, { filename })(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { baseApi } = loadModule(path.join(root, 'src/api/baseApi.ts'));
const { paymentsApi: api } = loadModule(path.join(root, 'src/features/payments/api/paymentsApi.ts'));
const { committeesApi } = loadModule(path.join(root, 'src/features/committees/api/committeesApi.ts'));
const { paymentClaimSchema, receiptSchema } = loadModule(path.join(root, 'src/features/payments/schemas/paymentClaimSchema.ts'));
const { canUploadReceipt, paymentStatusLabel, paymentError } = loadModule(path.join(root, 'src/features/payments/utils/paymentPresentation.ts'));
const { CurrentContributionCard } = loadModule(path.join(root, 'src/features/contributions/components/CurrentContributionCard.tsx'));
const { CommitteeTimeline } = loadModule(path.join(root, 'src/features/timeline/components/CommitteeTimeline.tsx'));
const args = { committeeId: 'committee', id: 'payment' };
const receipt = { id: 'receipt', mimeType: 'image/png', size: 8, uploadedAt: '2026-09-16T10:00:00Z' };
const payment = {
  id: 'payment', contributionId: 'contribution', memberId: 'member', amount: '5000.00',
  transactionReference: 'TRX-123', paymentMethod: 'EASYPAISA', receipt: null, status: 'PENDING',
  paidAt: '2026-09-16T09:00:00Z', verifiedAt: null,
  contribution: { id: 'contribution', cycleId: 'cycle', status: 'PENDING', cycle: { committeeId: 'committee', status: 'ACTIVE' }, member: { id: 'member', status: 'ACTIVE', user: { id: 'user' } } },
};

function setup(t, handler) {
  const store = configureStore({ reducer: { api: baseApi.reducer }, middleware: getDefault => getDefault().concat(baseApi.middleware) });
  t.after(() => store.dispatch(baseApi.util.resetApiState()));
  t.mock.method(globalThis, 'fetch', handler);
  return store;
}

test('references are trimmed, required and limited to 200 characters; methods follow the contract', () => {
  for (const paymentMethod of ['EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER', 'OTHER']) {
    assert.equal(paymentClaimSchema.parse({ transactionReference: ' TRX-123 ', paymentMethod }).transactionReference, 'TRX-123');
  }
  for (const transactionReference of ['', '   ', 'x'.repeat(201)]) {
    assert.equal(paymentClaimSchema.safeParse({ transactionReference, paymentMethod: 'EASYPAISA' }).success, false);
  }
  assert.equal(paymentClaimSchema.safeParse({ transactionReference: 'x'.repeat(200), paymentMethod: 'OTHER' }).success, true);
  assert.equal(paymentClaimSchema.safeParse({ transactionReference: 'TRX', paymentMethod: 'CARD' }).success, false);
});

test('receipt validation rejects missing, empty, oversized and unsupported files', () => {
  for (const type of ['image/png', 'image/jpeg']) {
    assert.equal(receiptSchema.safeParse(new File(['image'], 'receipt', { type })).success, true);
  }
  for (const value of [undefined, null, 'receipt.png', new File([], 'receipt.png', { type: 'image/png' }), new File(['pdf'], 'receipt.pdf', { type: 'application/pdf' }), new File(['svg'], 'receipt.svg', { type: 'image/svg+xml' }), new File([new Uint8Array(5_242_881)], 'large.png', { type: 'image/png' })]) {
    assert.equal(receiptSchema.safeParse(value).success, false);
  }
  assert.equal(receiptSchema.safeParse(new File([new Uint8Array(5_242_880)], 'max.png', { type: 'image/png' })).success, true);
});

test('receipt upload is offered only for the owning active member and eligible backend state', () => {
  assert.equal(canUploadReceipt(payment, 'user'), true);
  for (const id of [undefined, 'other']) assert.equal(canUploadReceipt(payment, id), false);
  for (const status of ['VERIFIED', 'REJECTED']) assert.equal(canUploadReceipt({ ...payment, status }, 'user'), false);
  assert.equal(canUploadReceipt({ ...payment, receipt }, 'user'), false);
  assert.equal(canUploadReceipt({ ...payment, contribution: { ...payment.contribution, status: 'PAID' } }, 'user'), false);
  assert.equal(canUploadReceipt({ ...payment, contribution: { ...payment.contribution, cycle: { status: 'COMPLETED' } } }, 'user'), false);
  assert.equal(canUploadReceipt({ ...payment, contribution: { ...payment.contribution, member: { ...payment.contribution.member, status: 'REMOVED' } } }, 'user'), false);
  assert.equal(canUploadReceipt({ ...payment, contribution: undefined }, 'user'), false);
  assert.equal(paymentStatusLabel(payment), 'Receipt needed');
  assert.equal(paymentStatusLabel({ ...payment, receipt }), 'Awaiting review');
  assert.equal(paymentError({ status: 500, data: { message: 'private storage path' } }).includes('private storage'), false);
});

test('claim creation sends documented JSON, exact amount and method with cookies', async t => {
  const store = setup(t, async request => {
    assert.equal(new URL(request.url).pathname, '/committees/committee/payments');
    assert.equal(request.method, 'POST');
    assert.equal(request.credentials, 'include');
    assert.deepEqual(await request.json(), { contributionId: 'contribution', amount: 5000, transactionReference: 'TRX-123', paymentMethod: 'BANK_TRANSFER' });
    return Response.json(payment, { status: 201 });
  });
  const result = await store.dispatch(api.endpoints.createPayment.initiate({ committeeId: 'committee', contributionId: 'contribution', amount: 5000, transactionReference: 'TRX-123', paymentMethod: 'BANK_TRANSFER' })).unwrap();
  assert.equal(result.status, 'PENDING');
  assert.equal(result.contribution.status, 'PENDING');
});

test('upload sends only one receipt file; failed uploads retry the same claim without marking dues paid', async t => {
  let uploads = 0;
  let current = payment;
  let contributionReads = 0;
  const store = setup(t, async request => {
    const url = new URL(request.url);
    if (request.method === 'POST') {
      assert.equal(url.pathname, '/committees/committee/payments/payment/receipt');
      assert.equal(request.credentials, 'include');
      assert.match(request.headers.get('content-type'), /^multipart\/form-data; boundary=/);
      const form = await request.formData();
      assert.deepEqual([...form.keys()], ['receipt']);
      assert.equal(form.get('receipt').type, 'image/png');
      uploads++;
      if (uploads === 1) return Response.json({ message: 'Storage failed' }, { status: 500 });
      current = { ...payment, receipt };
      return Response.json(current, { status: 201 });
    }
    if (url.pathname.endsWith('/contributions')) {
      contributionReads++;
      return Response.json({ data: [payment.contribution], total: 1, page: 1, limit: 100 });
    }
    return Response.json(url.pathname.endsWith('/payments') ? { data: [current], total: 1, page: 1, limit: 100 } : current);
  });
  await store.dispatch(api.endpoints.getPayment.initiate(args)).unwrap();
  await store.dispatch(api.endpoints.getPayments.initiate({ committeeId: 'committee' })).unwrap();
  const contributionArgs = { committeeId: 'committee', cycleId: 'cycle' };
  await store.dispatch(committeesApi.endpoints.getContributions.initiate(contributionArgs)).unwrap();
  const uploadArgs = { ...args, receipt: new File(['image'], 'receipt.png', { type: 'image/png' }) };
  assert.equal((await store.dispatch(api.endpoints.uploadPaymentReceipt.initiate(uploadArgs))).error.status, 500);
  await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));
  assert.equal(api.endpoints.getPayment.select(args)(store.getState()).data.receipt, null);
  await store.dispatch(api.endpoints.uploadPaymentReceipt.initiate(uploadArgs)).unwrap();
  await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));
  assert.equal(uploads, 2);
  assert.equal(api.endpoints.getPayment.select(args)(store.getState()).data.receipt.id, 'receipt');
  assert.equal(api.endpoints.getPayments.select({ committeeId: 'committee' })(store.getState()).data[0].status, 'PENDING');
  assert.equal(committeesApi.endpoints.getContributions.select(contributionArgs)(store.getState()).data.data[0].status, 'PENDING');
  assert.equal(contributionReads, 1);
});

test('payment history fetches every page and preserves the status filter', async t => {
  const pages = [];
  const store = setup(t, async request => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page'));
    pages.push(page);
    assert.equal(url.searchParams.get('status'), 'PENDING');
    return Response.json({ data: [{ ...payment, id: `payment-${page}` }], total: 2, page, limit: 1 });
  });
  const result = await store.dispatch(api.endpoints.getPayments.initiate({ committeeId: 'committee', status: 'PENDING' })).unwrap();
  assert.deepEqual(pages, [1, 2]);
  assert.equal(result.length, 2);
});

test('reading an admin decision refreshes contributions using backend values', async t => {
  let decided = false;
  let reads = 0;
  const store = setup(t, async request => {
    if (new URL(request.url).pathname.endsWith('/contributions')) {
      reads++;
      return Response.json({ data: [{ ...payment.contribution, status: decided ? 'PAID' : 'PENDING' }], total: 1, page: 1, limit: 100 });
    }
    decided = true;
    return Response.json({ ...payment, receipt, status: 'VERIFIED' });
  });
  const contributionArgs = { committeeId: 'committee', cycleId: 'cycle' };
  await store.dispatch(committeesApi.endpoints.getContributions.initiate(contributionArgs)).unwrap();
  await store.dispatch(api.endpoints.getPayment.initiate(args)).unwrap();
  await Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));
  assert.equal(reads, 2);
  assert.equal(committeesApi.endpoints.getContributions.select(contributionArgs)(store.getState()).data.data[0].status, 'PAID');
});

test('private receipt is read as binary with cookies and no-store, then its URL is released', async t => {
  let created = 0;
  const revoked = [];
  t.mock.method(URL, 'createObjectURL', blob => { assert.equal(blob.type, 'image/png'); created++; return 'blob:receipt'; });
  t.mock.method(URL, 'revokeObjectURL', url => revoked.push(url));
  const store = setup(t, async request => {
    assert.equal(new URL(request.url).pathname, '/committees/committee/payments/payment/receipt');
    assert.equal(request.credentials, 'include');
    assert.equal(request.cache, 'no-store');
    return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } });
  });
  const subscription = store.dispatch(api.endpoints.getPaymentReceipt.initiate(args));
  assert.equal(await subscription.unwrap(), 'blob:receipt');
  subscription.unsubscribe();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(created, 1);
  assert.deepEqual(revoked, ['blob:receipt']);
  assert.equal(api.endpoints.getPaymentReceipt.select(args)(store.getState()).isUninitialized, true);
});

test('receipt permission errors and unexpected content never become previews', async t => {
  let count = 0;
  const store = setup(t, async () => ++count === 1
    ? Response.json({ message: 'Forbidden' }, { status: 403 })
    : new Response('<html>Login</html>', { headers: { 'content-type': 'text/html' } }));
  assert.equal((await store.dispatch(api.endpoints.getPaymentReceipt.initiate(args))).error.status, 403);
  assert.equal((await store.dispatch(api.endpoints.getPaymentReceipt.initiate(args, { forceRefetch: true }))).error.status, 'PARSING_ERROR');
});

test('contribution UI offers receipt recovery, review and rejected resubmission without claiming payment', () => {
  const props = { contribution: { ...payment.contribution, amount: '5000', dueDate: '2026-09-20', paidAt: null }, cycleNumber: 1, onPay() {}, onViewPayment() {} };
  const render = latestPayment => renderToStaticMarkup(createElement(CurrentContributionCard, { ...props, latestPayment }));
  assert.match(render(payment), /Upload receipt/);
  assert.match(render({ ...payment, receipt }), /View payment claim/);
  assert.match(render({ ...payment, status: 'REJECTED' }), /Submit payment proof/);
  assert.doesNotMatch(render(payment), />Paid on /);
});

test('user timeline safely renders receipt-upload and unknown audit events', () => {
  const events = ['PAYMENT_RECEIPT_UPLOADED', 'FUTURE_ACTION'].map((action, index) => ({ id: String(index), actorId: 'user', action, createdAt: '2026-09-16T10:00:00Z', metadata: null }));
  const html = renderToStaticMarkup(createElement(CommitteeTimeline, { events, actorNames: new Map(), cycleNumbers: new Map(), currentUserId: 'user' }));
  assert.match(html, /Payment receipt uploaded/);
  assert.match(html, /FUTURE ACTION/);
});
