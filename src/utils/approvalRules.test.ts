import test from 'node:test';
import assert from 'node:assert/strict';
import { requiresCeoApproval, getNextApprovalStep, CEO_APPROVAL_THRESHOLD } from './approvalRules.ts';

test('CEO approval threshold applies strictly above Rp 10 Juta', () => {
  assert.equal(requiresCeoApproval(5_000_000), false);
  assert.equal(requiresCeoApproval(10_000_000), false); // Exactly 10 Juta does NOT require CEO
  assert.equal(requiresCeoApproval(10_000_001), true);  // > 10 Juta requires CEO
  assert.equal(requiresCeoApproval(25_000_000), true);
});

test('Form under or equal to 10 Juta finishes fully approved after CFO review', () => {
  const step1 = getNextApprovalStep('CSO', 7_500_000);
  assert.equal(step1.nextStatus, 'Approved by CSO');
  assert.equal(step1.nextAssigneeRole, 'COO');

  const step2 = getNextApprovalStep('COO', 7_500_000);
  assert.equal(step2.nextStatus, 'Approved by COO');
  assert.equal(step2.nextAssigneeRole, 'CFO');

  const step3 = getNextApprovalStep('CFO', 7_500_000);
  assert.equal(step3.nextStatus, 'Fully Approved');
  assert.equal(step3.isFullyApproved, true);
  assert.equal(step3.requiresCeo, false);
});

test('Form above 10 Juta routes from CFO to CEO for final approval', () => {
  const step3 = getNextApprovalStep('CFO', 15_000_000);
  assert.equal(step3.nextStatus, 'Approved by CFO');
  assert.equal(step3.nextAssigneeRole, 'CEO');
  assert.equal(step3.isFullyApproved, false);
  assert.equal(step3.requiresCeo, true);

  const step4 = getNextApprovalStep('CEO', 15_000_000);
  assert.equal(step4.nextStatus, 'Fully Approved');
  assert.equal(step4.isFullyApproved, true);
});
