import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_EMAIL,
  isAdminUser,
  hasMandatoryDigitalSignature,
  isAdminOnlyRole,
  getAllowedRegistrationRoles,
  canAssignRole,
} from './adminAuth.ts';

test('isAdminUser grants access exclusively to clx.hartono17@gmail.com', () => {
  assert.equal(isAdminUser({ email: ADMIN_EMAIL }, null), true);
  assert.equal(isAdminUser({ email: '  CLX.HARTONO17@GMAIL.COM ' }, null), true);
  assert.equal(isAdminUser(null, { email: ADMIN_EMAIL }), true);

  assert.equal(isAdminUser({ email: 'staff@clx.co.id' }, null), false);
  assert.equal(isAdminUser({ email: 'hartono.darmawan@clx.co.id' }, null), false);
  assert.equal(isAdminUser(null, null), false);
});

test('hasMandatoryDigitalSignature enforces image signature presence', () => {
  assert.equal(hasMandatoryDigitalSignature(undefined), false);
  assert.equal(hasMandatoryDigitalSignature(''), false);
  assert.equal(hasMandatoryDigitalSignature('   '), false);
  assert.equal(hasMandatoryDigitalSignature('invalid-text'), false);
  assert.equal(hasMandatoryDigitalSignature('data:image/png;base64,iVBORw0KGgo='), true);
  assert.equal(hasMandatoryDigitalSignature('https://example.com/sig.png'), true);
});

test('isAdminOnlyRole identifies CEO, COO, and CFO strictly as Admin-assigned roles', () => {
  assert.equal(isAdminOnlyRole('CEO'), true);
  assert.equal(isAdminOnlyRole('COO'), true);
  assert.equal(isAdminOnlyRole('CFO'), true);
  assert.equal(isAdminOnlyRole('Staff'), false);
  assert.equal(isAdminOnlyRole('CSO'), false);
});

test('getAllowedRegistrationRoles restricts public registration to Staff and CSO while Admin gets all roles', () => {
  assert.deepEqual(getAllowedRegistrationRoles(false), ['Staff', 'CSO']);
  assert.deepEqual(getAllowedRegistrationRoles(true), ['Staff', 'CSO', 'COO', 'CFO', 'CEO']);
});

test('canAssignRole blocks non-admins from assigning CEO, COO, and CFO', () => {
  assert.equal(canAssignRole('Staff', false), true);
  assert.equal(canAssignRole('CSO', false), true);
  assert.equal(canAssignRole('COO', false), false);
  assert.equal(canAssignRole('CFO', false), false);
  assert.equal(canAssignRole('CEO', false), false);

  assert.equal(canAssignRole('COO', true), true);
  assert.equal(canAssignRole('CFO', true), true);
  assert.equal(canAssignRole('CEO', true), true);
});
