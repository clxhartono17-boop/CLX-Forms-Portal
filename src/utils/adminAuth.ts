export const ADMIN_EMAIL = 'clx.hartono17@gmail.com';

/**
 * Checks whether the active user or connected Google account is the system Admin.
 * Only Admin (clx.hartono17@gmail.com) may access Setup Auto-Sync and direct Google Sheet backend links.
 */
export function isAdminUser(
  currentUser?: { email?: string | null } | null,
  googleUser?: { email?: string | null } | null
): boolean {
  const userEmail = (currentUser?.email || '').trim().toLowerCase();
  const gEmail = (googleUser?.email || '').trim().toLowerCase();
  return userEmail === ADMIN_EMAIL || gEmail === ADMIN_EMAIL;
}

/**
 * Validates whether a user registration payload includes a mandatory digital signature.
 */
export function hasMandatoryDigitalSignature(signatureUrl?: string | null): boolean {
  if (!signatureUrl) return false;
  const trimmed = signatureUrl.trim();
  return trimmed.length > 0 && (trimmed.startsWith('data:image/') || trimmed.startsWith('http'));
}
