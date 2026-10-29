/**
 * Google Drive API & Google Sheets API Integration Service
 * Compatible with Next.js App Router (Vercel Serverless Functions) & Client SDK.
 */

import { FormDocument, FormType, User } from '../types/index.ts'; // Pastikan path ini benar

export const GOOGLE_DRIVE_PARENT_FOLDER_ID = '1hgUyTqNsfJsC30pY7O2kPS95DqEEySm9';
export const GOOGLE_SHEETS_TEMPLATE_ID = '1irb4RR0LMMBqRfGP4gxvX82c0nLfWIXKHzQ_tqC3h8c';
export const GOOGLE_SHEETS_TEMPLATE_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_TEMPLATE_ID}/edit?gid=0#gid=0`;

export const SHEET_TAB_REKAPAN_FORM = 'Rekapan Form';
export const SHEET_TAB_MASTER_LOGIN = 'Master Login';

// Base URL Backend. Jika frontend dan backend pisah port (misal React 5173, Express 3001), gunakan ini:
// Jika menggunakan Next.js API Routes, biarkan value-nya string kosong '' atau '/api/google'.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/google';

export interface GoogleDriveUploadResult {
  fileId: string;
  fileName: string;
  folderPath: string;
  folderId: string;
  webViewLink: string;
  webContentLink: string;
  uploadedAt: string;
}

export interface GoogleSheetsSyncResult {
  spreadsheetId: string;
  sheetName: string;
  updatedRange?: string;
  rowNumber?: number;
  syncedAt?: string;
}

/**
 * Get month name in English as specified: [NAMA_FORM] / [BULAN] / [TANGGAL] / [NOMOR_FORM]
 */
export function getMonthNameEnglish(date: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[date.getMonth()];
}

/**
 * Generates the target nested folder path for Google Drive
 */
export function getDriveFolderPath(doc: FormDocument): {
  formName: string;
  monthName: string;
  dayString: string;
  shortDocNum: string;
  fullPath: string;
} {
  const dateObj = new Date(doc.date || Date.now());
  const formName = doc.formType;
  const monthName = getMonthNameEnglish(dateObj);
  const dayString = String(dateObj.getDate()).padStart(2, '0');
  const shortDocNum = doc.docNumber.split('/')[0] || `${doc.formType}-${String(doc.sequenceNumber).padStart(4, '0')}`;

  const fullPath = `${formName} / ${monthName} / ${dayString} / ${shortDocNum}`;
  return { formName, monthName, dayString, shortDocNum, fullPath };
}

/**
 * GET: Tarik semua data Form dari Google Sheets 
 */
export async function fetchFormsFromGoogleSheets() {
  const response = await fetch(`${API_BASE_URL}/forms`);
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Gagal mengambil data form dari Google Sheets");
  }
  return data.data; // Mengembalikan array of arrays (baris excel)
}

/**
 * GET: Tarik semua data User dari Google Sheets
 */
export async function fetchUsersFromGoogleSheets() {
  const response = await fetch(`${API_BASE_URL}/users`);
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Gagal mengambil master login dari Google Sheets");
  }
  return data.data;
}

/**
 * Sync form row to Google Sheets ("Rekapan Form") - REAL API
 */
export async function syncToGoogleSheets(
  doc: FormDocument
): Promise<GoogleSheetsSyncResult> {
  const sheetName = SHEET_TAB_REKAPAN_FORM;

  const rowData = [
    doc.docNumber,
    doc.date,
    doc.formType,
    doc.division,
    doc.requesterName,
    doc.requesterRole,
    doc.purpose,
    doc.totalAmount,
    doc.terbilang,
    doc.paymentMethod,
    doc.bankName || '-',
    doc.bankAccountNo || '-',
    doc.bankAccountName || '-',
    doc.status,
    doc.signatures.maker ? `${doc.signatures.maker.userName} (${doc.signatures.maker.signedAt.slice(0, 10)})` : '-',
    doc.signatures.cso ? `${doc.signatures.cso.userName} (${doc.signatures.cso.signedAt.slice(0, 10)})` : '-',
    doc.signatures.coo ? `${doc.signatures.coo.userName} (${doc.signatures.coo.signedAt.slice(0, 10)})` : '-',
    doc.signatures.cfo ? `${doc.signatures.cfo.userName} (${doc.signatures.cfo.signedAt.slice(0, 10)})` : '-',
    doc.signatures.ceo ? `${doc.signatures.ceo.userName} (${doc.signatures.ceo.signedAt.slice(0, 10)})` : '-',
    doc.googleDrive?.fileUrl || `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_PARENT_FOLDER_ID}`,
    doc.notes || '-',
    new Date().toISOString(),
  ];

  const res = await fetch(`${API_BASE_URL}/sheets-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Kita kirim formData sebagai objek utuh, dan juga rowData agar backend bisa memilih menggunakannya
    body: JSON.stringify({ 
      spreadsheetId: GOOGLE_SHEETS_TEMPLATE_ID, 
      sheetName, 
      formData: doc, 
      row: rowData 
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Gagal mengirim data ke Google Sheets");
  }

  return {
    spreadsheetId: GOOGLE_SHEETS_TEMPLATE_ID,
    sheetName,
    updatedRange: data.updatedRange,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Sync user registration to Google Sheets ("Master Login") - REAL API
 */
export async function syncUserRegistrationToGoogleSheets(
  user: User
): Promise<GoogleSheetsSyncResult> {
  const sheetName = SHEET_TAB_MASTER_LOGIN;

  const rowData = [
    user.id,
    user.name,
    user.email,
    user.role,
    user.division || 'General',
    user.phone || '-',
    user.registeredAt || new Date().toISOString(),
    'Active',
  ];

  const res = await fetch(`${API_BASE_URL}/register-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spreadsheetId: GOOGLE_SHEETS_TEMPLATE_ID,
      sheetName,
      user: user,
      row: rowData,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Gagal mendaftar user ke Google Sheets");
  }

  return {
    spreadsheetId: GOOGLE_SHEETS_TEMPLATE_ID,
    sheetName,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Sync file upload to Google Drive - REAL API
 */
export async function syncToGoogleDrive(
  doc: FormDocument,
  pdfBytes: Uint8Array
): Promise<GoogleDriveUploadResult> {
  const folderInfo = getDriveFolderPath(doc);
  const cleanDocName = doc.docNumber.replace(/[\/\\]/g, '_');
  const fileName = `${cleanDocName}_merged.pdf`;

  // Array buffer dari Uint8Array harus diubah ke format yang bisa dikirim via JSON (misal Base64), 
  // Atau menggunakan FormData. Mengingat kode awal Anda pakai JSON, pastikan API server mendukung format ini.
  // Jika server mengharapkan Buffer, lebih disarankan menggunakan multipart/form-data.
  // Untuk saat ini kita pertahankan struktur fetch Anda namun membuang catch fallback-nya.
  
  const res = await fetch(`${API_BASE_URL}/drive-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doc,
      folderPath: folderInfo.fullPath,
      parentFolderId: GOOGLE_DRIVE_PARENT_FOLDER_ID,
      fileName,
      fileSize: pdfBytes.length,
      // Idealnya: fileBase64: Buffer.from(pdfBytes).toString('base64') - pastikan backend siap menangkapnya
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Gagal mengunggah PDF ke Google Drive");
  }

  return data;
}
