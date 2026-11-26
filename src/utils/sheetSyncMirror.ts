import type { FormDocument, FormType, ApprovalStatus, UserRole, Division } from '../types/index.ts';
import { requiresCeoApproval } from './approvalRules.ts';
import { terbilangRupiah } from './terbilang.ts';

/**
 * Safely parses numeric or currency strings from Google Sheets (e.g. 1500000, "Rp 1.500.000", "23,450").
 */
export function parseSheetAmount(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  if (typeof raw !== 'string') return 0;
  const trimmed = raw.trim();
  if (!trimmed) return 0;

  // Remove currency symbol/spaces
  const cleaned = trimmed.replace(/rp\.?/gi, '').replace(/\s+/g, '');

  // Detect Indonesian thousands separators like "1.500.000" or "23.450"
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // Standard comma thousands separators like "1,500,000"
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    const normalized = cleaned.replace(/,/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // Generic numeric fallback
  const fallback = Number(cleaned.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(fallback) ? fallback : 0;
}

/**
 * Strips heavy Base64 blobs (signature images & attachment dataUrls) before sending
 * a FormDocument to Google Apps Script Webhook so payloads stay small and never stall.
 */
export function sanitizeFormForWebhook(doc: FormDocument): FormDocument {
  const safeSignatures: FormDocument['signatures'] = {};
  if (doc.signatures) {
    (['maker', 'cso', 'coo', 'cfo', 'ceo'] as const).forEach(key => {
      const stamp = doc.signatures[key];
      if (stamp) {
        const { signatureImage: _img, ...restStamp } = stamp;
        safeSignatures[key] = restStamp;
      }
    });
  }

  const safeAttachments = (doc.attachments || []).map(att => ({
    id: att.id,
    name: att.name,
    size: att.size,
    type: att.type,
    dataUrl: '',
    uploadedAt: att.uploadedAt,
  }));

  return {
    ...doc,
    totalAmount: Number(doc.totalAmount) || 0,
    sequenceNumber: Number(doc.sequenceNumber) || 1,
    signatures: safeSignatures,
    attachments: safeAttachments,
  };
}

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
 * Parses 19-column rows (Columns B..T starting at Row 9) fetched directly from Google Sheets API
 * into partial FormDocument objects for mirroring.
 */
export function parseSheetRowsToForms(
  rows: any[][],
  sheetName = 'Rekapan Form',
  startRowNumber = 9
): Partial<FormDocument>[] {
  if (!Array.isArray(rows)) return [];
  const results: Partial<FormDocument>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const docNumber = String(row[2] || '').trim();
    if (!docNumber || docNumber === '-' || docNumber.toLowerCase() === 'no. formulir') {
      continue;
    }

    const seq = parseSheetAmount(row[0]) || i + 1;
    const rawType = String(row[1] || 'FPP').trim();
    const formType = (rawType === 'PFB' ? 'FPP' : rawType) as FormType;
    const date = String(row[3] || '').trim();
    const targetDate = String(row[4] || date).trim();
    const division = (String(row[5] || 'Finance').trim() || 'Finance') as Division;
    const requesterName = String(row[6] || '').trim();
    const purpose = String(row[7] || '').trim();
    const dpp = parseSheetAmount(row[8]);
    const totalAmount = parseSheetAmount(row[10]) || dpp;
    const paymentMethod = (String(row[11] || 'Bank Transfer').trim() || 'Bank Transfer') as
      | 'Bank Transfer'
      | 'Cash'
      | 'Giro / Cheque';
    const bankName = String(row[12] || '').trim();
    const settlementDate = String(row[13] || '-').trim();
    const status = (String(row[15] || 'Pending Approval').trim() || 'Pending Approval') as ApprovalStatus;
    const notes = String(row[17] || '').trim();
    const link = String(row[18] || '').trim();
    const actualRow = startRowNumber + i;

    results.push({
      id: `sheet-row-${actualRow}-${docNumber.replace(/[^a-zA-Z0-9]/g, '_')}`,
      sequenceNumber: seq,
      formType,
      docNumber,
      date,
      targetDate,
      division,
      requesterName,
      purpose,
      totalAmount,
      terbilang: terbilangRupiah(totalAmount),
      paymentMethod,
      bankName,
      settlementDate,
      notes,
      status,
      currentAssigneeRole: resolveAssigneeFromStatus(status, totalAmount),
      signatures: requesterName
        ? {
            maker: {
              role: 'Staff',
              userName: requesterName,
              userTitle: 'Staff',
              signedAt: date || new Date().toISOString().split('T')[0],
              digitalHash: `SHA256-CLX-MKR-${docNumber.replace(/[^a-zA-Z0-9]/g, '').slice(-6)}`,
            },
          }
        : {},
      googleSheets: {
        synced: true,
        rowNumber: actualRow,
        sheetName,
      },
      googleDrive: {
        uploaded: link.includes('http'),
        folderPath: link.includes('http') ? '' : link,
        fileUrl: link.includes('http') ? link : undefined,
      },
    });
  }

  return results;
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
      const parsedSheetTotal = parseSheetAmount(sf.totalAmount);
      const totalAmount =
        sf.totalAmount !== undefined && sf.totalAmount !== null
          ? parsedSheetTotal
          : Number(existingLocal?.totalAmount ?? 0);

      const status = (sf.status || existingLocal?.status || 'Pending Approval') as ApprovalStatus;
      const currentAssigneeRole = resolveAssigneeFromStatus(status, totalAmount);

      const parsedBank = parseBankString(sf.bankName);
      const bankName = parsedBank.bankName || existingLocal?.bankName || '';
      const bankAccountNo = sf.bankAccountNo || parsedBank.bankAccountNo || existingLocal?.bankAccountNo || '';
      const bankAccountName = sf.bankAccountName || parsedBank.bankAccountName || existingLocal?.bankAccountName || '';

      const purpose = (sf.purpose ?? existingLocal?.purpose ?? '').trim();
      const requesterName = sf.requesterName || existingLocal?.requesterName || '';
      const date = sf.date || existingLocal?.date || new Date().toISOString().split('T')[0];

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

      // Merge attachments while preserving local dataUrl blobs
      const incomingAtts = sf.attachments || [];
      const localAtts = existingLocal?.attachments || [];
      let mergedAttachments = localAtts;
      if (incomingAtts.length > 0) {
        mergedAttachments = incomingAtts.map((att, idx) => {
          if (att.dataUrl) return att;
          const matchLocal =
            localAtts.find(la => la.id === att.id || la.name === att.name) || localAtts[idx];
          return matchLocal?.dataUrl ? { ...att, dataUrl: matchLocal.dataUrl } : att;
        });
      }

      // Merge signatures per role while keeping local signatureImage & ensuring maker stamp exists
      const mergedSignatures: FormDocument['signatures'] = {
        ...(existingLocal?.signatures || {}),
        ...(sf.signatures || {}),
      };
      (['maker', 'cso', 'coo', 'cfo', 'ceo'] as const).forEach(roleKey => {
        const incStamp = sf.signatures?.[roleKey];
        const locStamp = existingLocal?.signatures?.[roleKey];
        if (incStamp || locStamp) {
          mergedSignatures[roleKey] = {
            ...(locStamp || {}),
            ...(incStamp || {}),
            signatureImage: incStamp?.signatureImage || locStamp?.signatureImage,
          } as FormDocument['signatures'][typeof roleKey];
        }
      });

      if (!mergedSignatures.maker && requesterName) {
        mergedSignatures.maker = {
          role: 'Staff',
          userName: requesterName,
          userTitle: sf.requesterRole || existingLocal?.requesterRole || 'Staff',
          signedAt: date,
          digitalHash: `SHA256-CLX-MKR-${docNumber.replace(/[^a-zA-Z0-9]/g, '').slice(-6)}`,
        };
      }

      const resolvedTerbilang =
        existingLocal && existingLocal.totalAmount === totalAmount && existingLocal.terbilang
          ? existingLocal.terbilang
          : sf.terbilang || terbilangRupiah(totalAmount);

      return {
        id: existingLocal?.id || sf.id || `sheet-${index + 1}-${docNumber.replace(/[^a-zA-Z0-9]/g, '_')}`,
        sequenceNumber: Number(sf.sequenceNumber ?? existingLocal?.sequenceNumber ?? index + 1),
        formType,
        docNumber,
        date,
        targetDate: sf.targetDate || existingLocal?.targetDate || sf.date || '',
        settlementDate: sf.settlementDate || existingLocal?.settlementDate,
        division: (sf.division || existingLocal?.division || 'Finance') as Division,
        requesterName,
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
        terbilang: resolvedTerbilang,
        attachments: mergedAttachments,
        status,
        currentAssigneeRole,
        signatures: mergedSignatures,
        rejectionReason: existingLocal?.rejectionReason || sf.rejectionReason,
        createdAt: existingLocal?.createdAt || sf.createdAt || new Date().toISOString(),
        updatedAt: sf.updatedAt || existingLocal?.updatedAt || new Date().toISOString(),
        googleSheets: sf.googleSheets || existingLocal?.googleSheets || { synced: true, sheetName: 'Rekapan Form' },
        googleDrive:
          sf.googleDrive?.fileUrl
            ? sf.googleDrive
            : existingLocal?.googleDrive?.fileUrl
              ? existingLocal.googleDrive
              : sf.googleDrive || existingLocal?.googleDrive || { uploaded: false, folderPath: '' },
      };
    });
}

/**
 * Mirrors Google Sheet rows while preserving newly submitted local forms that are still
 * inside their brief Google Sheet propagation grace window.
 */
export function reconcileFormsWithPendingCreations(
  sheetForms: Partial<FormDocument>[],
  localForms: FormDocument[],
  pendingDocNumbers: Set<string>
): FormDocument[] {
  const mirrored = mirrorSheetFormsWithLocal(sheetForms, localForms);
  if (!pendingDocNumbers || pendingDocNumbers.size === 0) {
    return mirrored;
  }

  const sheetDocSet = new Set(
    mirrored.map(d => (d.docNumber || '').trim().toLowerCase()).filter(Boolean)
  );

  const pendingToPreserve = localForms.filter(localDoc => {
    const key = (localDoc.docNumber || '').trim().toLowerCase();
    return key && pendingDocNumbers.has(key) && !sheetDocSet.has(key);
  });

  return [...pendingToPreserve, ...mirrored];
}
