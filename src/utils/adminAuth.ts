import type { UserRole } from '../types/index.ts';

export const ADMIN_EMAIL = 'clx.hartono17@gmail.com';

export const ADMIN_ONLY_ROLES: readonly UserRole[] = ['COO', 'CFO', 'CEO'];
export const PUBLIC_REGISTRATION_ROLES: readonly UserRole[] = ['Staff', 'CSO'];
export const ALL_ROLES: readonly UserRole[] = ['Staff', 'CSO', 'COO', 'CFO', 'CEO'];

/**
 * Checks whether the active user or connected Google account is the system Admin.
 * Only Admin (clx.hartono17@gmail.com) may access Setup Auto-Sync, direct Google Sheet backend links,
 * and assign executive roles (CEO, COO, CFO).
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
 * Returns true if the role is restricted and may only be assigned by Admin.
 */
export function isAdminOnlyRole(role: UserRole | string): boolean {
  return (ADMIN_ONLY_ROLES as readonly string[]).includes(role);
}

/**
 * Returns the list of roles selectable during registration based on whether the caller is Admin.
 */
export function getAllowedRegistrationRoles(isAdmin: boolean): UserRole[] {
  return isAdmin ? [...ALL_ROLES] : [...PUBLIC_REGISTRATION_ROLES];
}

/**
 * Checks whether the caller is allowed to assign a target role.
 * Staff and CSO can be self-registered by anyone; COO, CFO, and CEO require Admin.
 */
export function canAssignRole(targetRole: UserRole, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  return !isAdminOnlyRole(targetRole);
}

/**
 * Validates whether a user registration payload includes a mandatory digital signature.
 */
export function hasMandatoryDigitalSignature(signatureUrl?: string | null): boolean {
  if (!signatureUrl) return false;
  const trimmed = signatureUrl.trim();
  return trimmed.length > 0 && (trimmed.startsWith('data:image/') || trimmed.startsWith('http'));
}
