export type FormType = 'FPU' | 'FPP' | 'PFB' | 'FPPB';

export type Division = 'Project' | 'Operation' | 'Services' | 'General' | 'Finance';

export type UserRole = 'Staff' | 'CSO' | 'COO' | 'CFO' | 'CEO';

export type ApprovalStatus = 
  | 'Draft'
  | 'Pending Approval'
  | 'Approved by CSO'
  | 'Approved by COO'
  | 'Approved by CFO'
  | 'Fully Approved'
  | 'Rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  title: string;
  division?: Division;
  phone?: string;
  registeredAt?: string;
  signatureUrl?: string;
}

export interface FormItem {
  id: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface DigitalStamp {
  role: UserRole;
  userName: string;
  userTitle: string;
  signedAt: string;
  signatureText?: string;
  signatureImage?: string;
  digitalHash: string;
}

export interface FormAttachment {
  id: string;
  name: string;
  size: number;
  type: string; // 'application/pdf' | 'image/png' | 'image/jpeg'
  dataUrl: string; // base64 representation for preview & merge
  uploadedAt: string;
}

export interface FormDocument {
  id: string;
  docNumber: string; // e.g. FPU-0001/CLX/29/X/MMXXVI
  formType: FormType;
  sequenceNumber: number;
  date: string; // YYYY-MM-DD
  division: Division;
  
  // Requester
  requesterName: string;
  requesterRole: string;
  requesterEmail: string;

  // Purpose & Details
  purpose: string;
  notes?: string;
  targetDate?: string; // Target disbursement / execution date
  settlementDate?: string; // Settlement due date (Pertanggungjawaban)

  // Financial / Bank Details
  paymentMethod: 'Bank Transfer' | 'Cash' | 'Giro / Cheque';
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;

  // Line items
  items: FormItem[];
  totalAmount: number;
  terbilang: string;

  // Type-specific metadata
  fpuCategory?: 'Kas Bon' | 'Reimbursement' | 'Uang Muka Operasional' | 'Pembayaran Vendor';
  fppCategory?: 'Faktur Pajak' | 'Biaya Operasional' | 'Biaya Logistik & Freight' | 'Bahan Bakar & Tol';
  fppbCategory?: 'Peralatan Kantor' | 'Sparepart & Hardware' | 'Asset Operasional' | 'Software & IT';

  // Approvals & Signatures
  status: ApprovalStatus;
  currentAssigneeRole: UserRole;
  rejectionReason?: string;
  signatures: {
    maker?: DigitalStamp;
    cso?: DigitalStamp;
    coo?: DigitalStamp;
    cfo?: DigitalStamp;
    ceo?: DigitalStamp;
  };

  // Attachments
  attachments: FormAttachment[];

  // Google Integration Status
  googleDrive?: {
    uploaded: boolean;
    folderPath: string; // [NAMA_FORM] / [BULAN] / [TANGGAL] / [NOMOR_FORM]
    fileId?: string;
    fileUrl?: string;
    uploadedAt?: string;
  };
  googleSheets?: {
    synced: boolean;
    rowNumber?: number;
    sheetName: string;
    syncedAt?: string;
  };

  createdAt: string;
  updatedAt: string;
}
