import { FormDocument, FormType, ApprovalStatus, UserRole, Division } from '../types/index.ts';
import { requiresCeoApproval } from './approvalRules.ts';

/**
 * Parses a combined bank string like "BCA - 8830192831 (a.n Hartono)" into separate fields.
 */
export function parseBankString(rawBank?: string): {
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
} {
  const clean = (rawBank || '').trim();
  if (!clean || clean === '-') {
    return { bankName: '', bankAccountNo: '', bankAccountName: '' };
  }

  // Match pattern: "<Bank> - <AccountNo> (a.n <AccountName>)"
  const match = clean.match(/^(.+?)\s*-\s*([^\s(]+)(?:\s*\(a\.n\.?\s*(.+?)\))?$/i);
  if (match) {
    return {
      bankName: match[1].trim(),
      bankAccountNo: match[2].trim() === '-' ? '' : match[2].trim(),
      bankAccountName: match[3] ? (match[3].trim() === '-' ? '' : match[3].trim()) : '',
    };
  }

  return { bankName: clean, bankAccountNo: '', bankAccountName: '' };
}

/**
 * Determines the current assignee role given status and totalAmount.
 */
export function resolveAssigneeFromStatus(
  status: ApprovalStatus | string,
  totalAmount: number
): UserRole {
  if (status === 'Pending Approval' || status.includes('Pending')) {
    return 'CSO';
  }
  if (status === 'Approved by CSO') {
    return 'COO';
  }
  if (status === 'Approved by COO') {
    return 'CFO';
  }
  if (status === 'Approved by CFO') {
    return requiresCeoApproval(totalAmount) ? 'CEO' : 'CFO';
  }
  if (status === 'Fully Approved' || status === 'Rejected') {
    return requiresCeoApproval(totalAmount) ? 'CEO' : 'CFO';
  }
  return 'CSO';
}

/**
 * Mirrors Google Sheet rows into the portal's FormDocument list:
 * - Any row deleted from the Google Sheet is immediately excluded from the returned list.
 * - Any row updated in the Google Sheet updates the corresponding portal record.
 * - Rich local metadata (line items, attachments, signatures, terbilang) is preserved if present.
 */
export function mirrorSheetFormsWithLocal(
  sheetForms: Partial<FormDocument>[],
  localForms: FormDocument[]
): FormDocument[] {
  const localByDocNumber = new Map<string, FormDocument>();
  for (const localDoc of localForms) {
    if (localDoc.docNumber) {
      localByDocNumber.set(localDoc.docNumber.trim().toLowerCase(), localDoc);
    }
  }

  return sheetForms
    .filter(sf => sf && sf.docNumber && sf.docNumber.trim() !== '' && sf.docNumber.trim() !== '-')
    .map((sf, index) => {
      const docNumber = sf.docNumber!.trim();
      const existingLocal = localByDocNumber.get(docNumber.toLowerCase());

      const rawFormType = (sf.formType as string) === 'PFB' ? 'FPP' : (sf.formType || existingLocal?.formType || 'FPP');
      const formType = rawFormType as FormType;
      const totalAmount = Number(sf.totalAmount ?? existingLocal?.totalAmount ?? 0);

      const status = (sf.status || existingLocal?.status || 'Pending Approval') as ApprovalStatus;
      const currentAssigneeRole = resolveAssigneeFromStatus(status, totalAmount);

      const parsedBank = parseBankString(sf.bankName);
      const bankName = parsedBank.bankName || existingLocal?.bankName || '';
      const bankAccountNo = sf.bankAccountNo || parsedBank.bankAccountNo || existingLocal?.bankAccountNo || '';
      const bankAccountName = sf.bankAccountName || parsedBank.bankAccountName || existingLocal?.bankAccountName || '';

      const purpose = (sf.purpose ?? existingLocal?.purpose ?? '').trim();

      // Keep local line items only if the total amount still matches; otherwise rebuild a clean line item reflecting sheet total
      const shouldKeepLocalItems =
        existingLocal &&
        existingLocal.items &&
        existingLocal.items.length > 0 &&
        existingLocal.totalAmount === totalAmount;

      const items = shouldKeepLocalItems
        ? existingLocal.items
        : [
            {
              id: `item-${index + 1}`,
              description: purpose || `Pengajuan ${formType}`,
              qty: 1,
              unit: 'Paket',
              unitPrice: totalAmount,
              total: totalAmount,
            },
          ];

      return {
        id: existingLocal?.id || sf.id || `sheet-${index + 1}-${docNumber.replace(/[^a-zA-Z0-9]/g, '_')}`,
        sequenceNumber: Number(sf.sequenceNumber ?? existingLocal?.sequenceNumber ?? index + 1),
        formType,
        docNumber,
        date: sf.date || existingLocal?.date || new Date().toISOString().split('T')[0],
        targetDate: sf.targetDate || existingLocal?.targetDate || sf.date || '',
        settlementDate: sf.settlementDate || existingLocal?.settlementDate,
        division: (sf.division || existingLocal?.division || 'Finance') as Division,
        requesterName: sf.requesterName || existingLocal?.requesterName || '',
        requesterEmail: sf.requesterEmail || existingLocal?.requesterEmail || '',
        requesterRole: sf.requesterRole || existingLocal?.requesterRole || 'Staff',
        purpose,
        notes: sf.notes && sf.notes !== '-' ? sf.notes : existingLocal?.notes || '',
        paymentMethod: (sf.paymentMethod || existingLocal?.paymentMethod || 'Bank Transfer') as
          | 'Bank Transfer'
          | 'Cash'
          | 'Giro / Cheque',
        bankName,
        bankAccountNo,
        bankAccountName,
        items,
        totalAmount,
        terbilang: existingLocal && existingLocal.totalAmount === totalAmount ? existingLocal.terbilang : sf.terbilang || '',
        attachments: existingLocal?.attachments || sf.attachments || [],
        status,
        currentAssigneeRole,
        signatures: existingLocal?.signatures || sf.signatures || {},
        rejectionReason: existingLocal?.rejectionReason || sf.rejectionReason,
        createdAt: existingLocal?.createdAt || sf.createdAt || new Date().toISOString(),
        updatedAt: sf.updatedAt || existingLocal?.updatedAt || new Date().toISOString(),
        googleSheets: sf.googleSheets || existingLocal?.googleSheets || { synced: true, sheetName: 'Rekap Form CLX' },
        googleDrive: sf.googleDrive || existingLocal?.googleDrive || { uploaded: false, folderPath: '' },
      };
    });
}
