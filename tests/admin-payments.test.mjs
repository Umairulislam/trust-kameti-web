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

import { Provider } from 'react-redux';

const { baseApi } = loadModule(path.join(root, 'src/api/baseApi.ts'));
const { adminContributionsApi: adminApi } = loadModule(path.join(root, 'src/features/admin/contributions/api/adminContributionsApi.ts'));
const { paymentsApi } = loadModule(path.join(root, 'src/features/payments/api/paymentsApi.ts'));
const { committeesApi } = loadModule(path.join(root, 'src/features/committees/api/committeesApi.ts'));
const { adminReportsApi } = loadModule(path.join(root, 'src/features/admin/reports/api/adminReportsApi.ts'));
const { lotteryApi } = loadModule(path.join(root, 'src/features/lottery/api/lotteryApi.ts'));
const { canManageCommitteePayments, canGenerateContributions, canRecordPayment, canAttachPaymentReceipt, paymentVerificationIssue, adminPaymentError } = loadModule(path.join(root, 'src/features/admin/contributions/utils/paymentActions.ts'));
const cycleArgs = { committeeId: 'committee', cycleId: 'cycle' };
const paymentArgs = { committeeId: 'committee', id: 'payment' };
const member = { id: 'member', status: 'ACTIVE', user: { id: 'payer', name: 'Test member' } };
const contribution = { id: 'contribution', cycleId: 'cycle', memberId: 'member', amount: '5000.00', dueDate: '2026-10-05T00:00:00Z', status: 'PENDING', member };
const receipt = { id: 'receipt', mimeType: 'image/png', size: 4, uploadedAt: '2026-09-17T10:00:00Z' };
const payment = { id: 'payment', contributionId: 'contribution', memberId: 'member', amount: '5000', transactionReference: 'BANK-123', paymentMethod: 'BANK_TRANSFER', receipt: null, status: 'PENDING', contribution: { ...contribution, cycle: { committeeId: 'committee', status: 'ACTIVE' } } };
const cycle = { id: 'cycle', cycleNumber: 1, status: 'ACTIVE', totalExpected: '5000', totalCollected: '0' };
const envelope = data => ({ data, total: data.length, page: 1, limit: 100 });

function setup(t, handler) {
  const store = configureStore({ reducer: { api: baseApi.reducer }, middleware: getDefault => getDefault().concat(baseApi.middleware) });
  t.after(() => store.dispatch(baseApi.util.resetApiState()));
  t.mock.method(globalThis, 'fetch', handler);
  return store;
}
const settle = store => Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()));

test('only the platform admin who created this committee can manage payment actions', () => {
  assert.equal(canManageCommitteePayments({ id: 'creator', role: 'ADMIN' }, 'creator'), true);
  assert.equal(canManageCommitteePayments({ id: 'other', role: 'ADMIN' }, 'creator'), false);
  assert.equal(canManageCommitteePayments({ id: 'creator', role: 'USER' }, 'creator'), false);
  assert.equal(canManageCommitteePayments(null, 'creator'), false);
});

test('generation requires an active cycle and a confirmed empty, unfiltered contribution count', () => {
  assert.equal(canGenerateContributions('ACTIVE', 0), true);
  assert.equal(canGenerateContributions('ACTIVE', undefined), false);
  assert.equal(canGenerateContributions('ACTIVE', 1), false);
  for (const status of ['UPCOMING', 'COMPLETED', 'CANCELLED']) assert.equal(canGenerateContributions(status, 0), false);
});

test('recording and receipt recovery use unpaid active-cycle records; decided evidence is immutable', () => {
  assert.equal(canRecordPayment(contribution, 'ACTIVE'), true);
  assert.equal(canRecordPayment({ ...contribution, status: 'OVERDUE' }, 'ACTIVE'), true);
  assert.equal(canRecordPayment({ ...contribution, status: 'PAID' }, 'ACTIVE'), false);
  assert.equal(canRecordPayment(contribution, 'COMPLETED'), false);
  assert.equal(canAttachPaymentReceipt(payment), true);
  assert.equal(canAttachPaymentReceipt({ ...payment, receipt }), false);
  for (const status of ['VERIFIED', 'REJECTED']) assert.equal(canAttachPaymentReceipt({ ...payment, status }), false);
  assert.equal(canAttachPaymentReceipt({ ...payment, contribution: { ...payment.contribution, status: 'PAID' } }), false);
});

test('verification requires a receipt, unpaid active-cycle contribution and matching amount', () => {
  const ready = { ...payment, receipt };
  assert.equal(paymentVerificationIssue(ready), null);
  assert.match(paymentVerificationIssue(payment), /receipt/);
  assert.match(paymentVerificationIssue({ ...ready, status: 'REJECTED' }), /pending/);
  assert.match(paymentVerificationIssue({ ...ready, contribution: { ...ready.contribution, status: 'PAID' } }), /unpaid/);
  assert.match(paymentVerificationIssue({ ...ready, contribution: { ...ready.contribution, cycle: { status: 'COMPLETED' } } }), /active cycle/);
  assert.match(paymentVerificationIssue({ ...ready, amount: '5001' }), /amount/);
  assert.match(paymentVerificationIssue({ ...ready, amount: 'invalid' }), /amount/);
  assert.match(paymentVerificationIssue({ ...ready, contribution: undefined }), /active cycle/);
  assert.equal(adminPaymentError({ status: 500, data: { message: 'private database details' } }, 'generate').includes('private'), false);
  assert.match(adminPaymentError({ status: 409 }, 'generate'), /already exist/);
});

test('generation sends no amount or member list and refreshes user contributions and admin summaries', async t => {
  let generated = false;
  const reads = { list: 0, summary: 0 };
  const store = setup(t, async request => {
    const pathname = new URL(request.url).pathname;
    assert.equal(request.credentials, 'include');
    if (request.method === 'POST') {
      assert.equal(pathname, '/committees/committee/cycles/cycle/contributions/generate');
      assert.equal(await request.text(), '');
      generated = true;
      return Response.json({ generated: 1, contributions: [contribution] }, { status: 201 });
    }
    if (pathname.endsWith('/summary')) {
      reads.summary++;
      return Response.json({ memberCount: generated ? 1 : 0, totalCollected: 0 });
    }
    reads.list++;
    return Response.json(envelope(generated ? [contribution] : []));
  });
  await store.dispatch(committeesApi.endpoints.getContributions.initiate(cycleArgs)).unwrap();
  await store.dispatch(committeesApi.endpoints.getContributionSummary.initiate(cycleArgs)).unwrap();
  const result = await store.dispatch(adminApi.endpoints.generateContributions.initiate(cycleArgs)).unwrap();
  await settle(store);
  assert.equal(result.generated, 1);
  assert.equal(committeesApi.endpoints.getContributions.select(cycleArgs)(store.getState()).data.data[0].member.user.id, 'payer');
  assert.equal(committeesApi.endpoints.getContributionSummary.select(cycleArgs)(store.getState()).data.totalCollected, 0);
  assert.equal(reads.list, 2);
  assert.equal(reads.summary, 2);
});

test('generation conflict refreshes the existing records instead of creating local obligations', async t => {
  let reads = 0;
  const store = setup(t, async request => {
    if (request.method === 'POST') return Response.json({ message: 'Already generated' }, { status: 409 });
    reads++;
    return Response.json(envelope([contribution]));
  });
  await store.dispatch(committeesApi.endpoints.getContributions.initiate(cycleArgs)).unwrap();
  const result = await store.dispatch(adminApi.endpoints.generateContributions.initiate(cycleArgs));
  await settle(store);
  assert.equal(result.error.status, 409);
  assert.equal(committeesApi.endpoints.getContributions.select(cycleArgs)(store.getState()).data.data.length, 1);
  assert.equal(reads, 2);
});

test('admin records and uploads on behalf of the member; only verification changes totals and refreshes reports/eligibility', async t => {
  let record = null;
  let paid = false;
  let eligibilityReads = 0;
  let reportReads = 0;
  const store = setup(t, async request => {
    const pathname = new URL(request.url).pathname;
    assert.equal(request.credentials, 'include');
    if (request.method === 'POST' && pathname.endsWith('/payments')) {
      assert.deepEqual(await request.json(), { contributionId: 'contribution', amount: 5000, transactionReference: 'BANK-123', paymentMethod: 'BANK_TRANSFER' });
      record = payment;
      return Response.json(record, { status: 201 });
    }
    if (request.method === 'POST' && pathname.endsWith('/receipt')) {
      const form = await request.formData();
      assert.deepEqual([...form.keys()], ['receipt']);
      record = { ...record, receipt };
      return Response.json(record, { status: 201 });
    }
    if (request.method === 'POST' && pathname.endsWith('/verify')) {
      assert.equal(await request.text(), '');
      assert.ok(record.receipt);
      paid = true;
      record = { ...record, status: 'VERIFIED', contribution: { ...record.contribution, status: 'PAID' } };
      return Response.json(record);
    }
    if (pathname.endsWith('/eligibility')) {
      eligibilityReads++;
      return Response.json({ eligible: paid, reason: paid ? null : 'Unpaid contributions', eligibleMemberCount: 1 });
    }
    if (pathname.includes('/reports/')) {
      reportReads++;
      return Response.json({ data: [{ totalCollected: paid ? '5000' : '0' }] });
    }
    if (pathname.endsWith('/cycles/cycle')) return Response.json({ ...cycle, totalCollected: paid ? '5000' : '0' });
    if (pathname.endsWith('/contributions')) return Response.json(envelope([{ ...contribution, status: paid ? 'PAID' : 'PENDING' }]));
    return Response.json(record);
  });
  const cycleReadArgs = { committeeId: 'committee', id: 'cycle' };
  await store.dispatch(committeesApi.endpoints.getContributions.initiate(cycleArgs)).unwrap();
  await store.dispatch(committeesApi.endpoints.getCycle.initiate(cycleReadArgs)).unwrap();
  await store.dispatch(lotteryApi.endpoints.getLotteryEligibility.initiate(cycleArgs)).unwrap();
  await store.dispatch(adminReportsApi.endpoints.getContributionReport.initiate(cycleArgs)).unwrap();
  const created = await store.dispatch(paymentsApi.endpoints.createPayment.initiate({ committeeId: 'committee', contributionId: 'contribution', amount: 5000, transactionReference: 'BANK-123', paymentMethod: 'BANK_TRANSFER' })).unwrap();
  assert.equal(created.memberId, 'member');
  assert.equal(created.status, 'PENDING');
  await store.dispatch(paymentsApi.endpoints.uploadPaymentReceipt.initiate({ ...paymentArgs, receipt: new File(['png'], 'receipt.png', { type: 'image/png' }) })).unwrap();
  assert.equal(committeesApi.endpoints.getCycle.select(cycleReadArgs)(store.getState()).data.totalCollected, '0');
  assert.equal(committeesApi.endpoints.getContributions.select(cycleArgs)(store.getState()).data.data[0].status, 'PENDING');
  await store.dispatch(adminApi.endpoints.verifyPayment.initiate(paymentArgs)).unwrap();
  await settle(store);
  assert.equal(committeesApi.endpoints.getCycle.select(cycleReadArgs)(store.getState()).data.totalCollected, '5000');
  assert.equal(committeesApi.endpoints.getContributions.select(cycleArgs)(store.getState()).data.data[0].status, 'PAID');
  assert.equal(lotteryApi.endpoints.getLotteryEligibility.select(cycleArgs)(store.getState()).data.eligible, true);
  assert.equal(adminReportsApi.endpoints.getContributionReport.select(cycleArgs)(store.getState()).data.data[0].totalCollected, '5000');
  assert.equal(eligibilityReads, 2);
  assert.equal(reportReads, 2);
});

test('rejection accepts incomplete pending claims and retains existing receipts without crediting money', async t => {
  let record = payment;
  const store = setup(t, async request => {
    assert.equal(new URL(request.url).pathname, '/committees/committee/payments/payment/reject');
    assert.equal(await request.text(), '');
    record = { ...record, status: 'REJECTED' };
    return Response.json(record);
  });
  assert.equal((await store.dispatch(adminApi.endpoints.rejectPayment.initiate(paymentArgs)).unwrap()).receipt, null);
  record = { ...payment, receipt };
  const result = await store.dispatch(adminApi.endpoints.rejectPayment.initiate(paymentArgs)).unwrap();
  assert.equal(result.receipt.id, 'receipt');
  assert.equal(result.contribution.status, 'PENDING');
});

test('failed verification never optimistically marks a claim or contribution paid', async t => {
  let reads = 0;
  const store = setup(t, async request => {
    if (request.method === 'POST') return Response.json({ message: 'Receipt missing' }, { status: 400 });
    reads++;
    return Response.json(payment);
  });
  await store.dispatch(paymentsApi.endpoints.getPayment.initiate(paymentArgs)).unwrap();
  assert.equal((await store.dispatch(adminApi.endpoints.verifyPayment.initiate(paymentArgs))).error.status, 400);
  await settle(store);
  assert.equal(paymentsApi.endpoints.getPayment.select(paymentArgs)(store.getState()).data.status, 'PENDING');
  assert.ok(reads >= 2);
});

test('generation action is visible and enabled only when the creator can generate this cycle', async t => {
  const { GenerateContributionsAction } = loadModule(path.join(root, 'src/features/admin/contributions/components/GenerateContributionsAction.tsx'));
  const store = setup(t, async () => { throw new Error('Rendering must not create contributions'); });
  const props = { committeeId: 'committee', cycle, summary: { memberCount: 0 }, checking: false, canManage: true, onRefresh() {} };
  const render = overrides => renderToStaticMarkup(createElement(Provider, { store }, createElement(GenerateContributionsAction, { ...props, ...overrides })));
  const button = html => html.match(/<button\b[^>]*>/)?.[0] ?? '';
  assert.match(render({}), /Generate contributions/);
  assert.doesNotMatch(button(render({})), /disabled/);
  for (const overrides of [{ canManage: false }, { checking: true }, { summary: undefined }, { summary: { memberCount: 1 } }, { cycle: { ...cycle, status: 'UPCOMING' } }]) {
    assert.match(button(render(overrides)), /disabled/);
  }
});
