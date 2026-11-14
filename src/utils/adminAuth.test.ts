import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_EMAIL, isAdminUser, hasMandatoryDigitalSignature } from './adminAuth.ts';

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
