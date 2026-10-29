import { ApprovalStatus, UserRole } from '../types/index.ts';

export const CEO_APPROVAL_THRESHOLD = 10_000_000; // Rp 10.000.000

export interface ApprovalStepResult {
  nextStatus: ApprovalStatus;
  nextAssigneeRole: UserRole;
  isFullyApproved: boolean;
  requiresCeo: boolean;
}

/**
 * Determines whether a form requires CEO approval based on corporate threshold (> Rp 10 Juta)
 */
export function requiresCeoApproval(totalAmount: number): boolean {
  return totalAmount > CEO_APPROVAL_THRESHOLD;
}

/**
 * Calculates the next workflow approval status and assignee
 * Rule: Above Rp 10 Juta requires CEO. Below or equal to Rp 10 Juta completes at CFO.
 */
export function getNextApprovalStep(
  currentRole: UserRole,
  totalAmount: number
): ApprovalStepResult {
  const needsCeo = requiresCeoApproval(totalAmount);

  switch (currentRole) {
    case 'CSO':
      return {
        nextStatus: 'Approved by CSO',
        nextAssigneeRole: 'COO',
        isFullyApproved: false,
        requiresCeo: needsCeo,
      };

    case 'COO':
      return {
        nextStatus: 'Approved by COO',
        nextAssigneeRole: 'CFO',
        isFullyApproved: false,
        requiresCeo: needsCeo,
      };

    case 'CFO':
      if (needsCeo) {
        // > 10 Juta: Advances to CEO for final approval
        return {
          nextStatus: 'Approved by CFO',
          nextAssigneeRole: 'CEO',
          isFullyApproved: false,
          requiresCeo: true,
        };
      } else {
        // <= 10 Juta: Completes at CFO, Fully Approved!
        return {
          nextStatus: 'Fully Approved',
          nextAssigneeRole: 'CFO',
          isFullyApproved: true,
          requiresCeo: false,
        };
      }

    case 'CEO':
      return {
        nextStatus: 'Fully Approved',
        nextAssigneeRole: 'CEO',
        isFullyApproved: true,
        requiresCeo: true,
      };

    default:
      throw new Error(`Role ${currentRole} cannot execute approvals`);
  }
}
