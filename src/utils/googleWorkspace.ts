import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { FormDocument, User } from '../types/index.ts';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const SPREADSHEET_ID = '1irb4RR0LMMBqRfGP4gxvX82c0nLfWIXKHzQ_tqC3h8c';
export const DRIVE_PARENT_FOLDER_ID = '1hgUyTqNsfJsC30pY7O2kPS95DqEEySm9';
export const TAB_REKAPAN_FORM = 'Rekapan Form';
export const TAB_MASTER_LOGIN = 'Master Login';

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline',
});

let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Listen for auth state changes and manage cached token
export const initGoogleAuth = (
  onSuccess?: (user: FirebaseUser, token: string) => void,
  onSignedOut?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken && onSuccess) {
        onSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onSignedOut) onSignedOut();
    }
  });
};

export const signInWithGoogle = async (): Promise<{ user: FirebaseUser; accessToken: string }> => {
  if (isSigningIn) {
    throw new Error('Proses login Google sedang berjalan...');
  }
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan Access Token Google dari otorisasi.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setGoogleAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const signOutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Format form record into the exact columns of "Rekapan Form"
 * Matches the user-provided master template:
 * [No, Jenis Form, No. Formulir, Tgl Pengajuan, Tgl Dibutuhkan, Divisi / Dept, Pemohon,
 *  Keperluan, Nominal DPP, Pajak, Total Nilai, Metode Bayar, Bank & Rekening,
 *  Estimasi Selesai, Level Otorisasi, Status Otorisasi, Status Kas Bon, Catatan, Link Dokumen]
 */
export function formatFormRow(doc: FormDocument, rowIndex: number): any[] {
  const bankInfo = doc.bankName 
    ? `${doc.bankName} - ${doc.bankAccountNo || '-'} (a.n ${doc.bankAccountName || '-'})`
    : 'KAS / TUNAI';

  const levelOtorisasi = doc.totalAmount > 10_000_000
    ? 'Maker -> CSO -> COO -> CFO -> CEO (Wajib CEO)'
    : 'Maker -> CSO -> COO -> CFO (Selesai di CFO)';

  const statusKasBon = doc.formType === 'FPU' 
    ? (doc.status === 'Fully Approved' ? 'Menunggu SPJ / Realisasi' : 'Pengajuan Kas Bon')
    : '-';

  const linkDokumen = doc.googleDrive?.fileUrl || doc.googleDrive?.folderPath || 'Tersimpan di Drive CLX';

  return [
    rowIndex,                                      // No
    doc.formType,                                  // Jenis Form (FPU / PFB / FPPB)
    doc.docNumber,                                 // No. Formulir
    doc.date,                                      // Tgl Pengajuan
    doc.date,                                      // Tgl Dibutuhkan
    doc.division,                                  // Divisi / Dept
    doc.requesterName,                             // Pemohon (Requestor)
    doc.purpose,                                   // Keperluan / Perincian Pengeluaran
    doc.totalAmount,                               // Nominal DPP (Rp)
    0,                                             // Pajak / PPN / PPh
    doc.totalAmount,                               // Total Nilai (Rp)
    doc.paymentMethod,                             // Metode Pembayaran
    bankInfo,                                      // Nama Bank & No. Rekening Penerima
    doc.formType === 'FPU' ? 'H+7 Setelah Realisasi' : '-', // Estimasi Selesai (Kas Bon)
    levelOtorisasi,                                // Level Otorisasi Diperlukan
    doc.status,                                    // Status Otorisasi
    statusKasBon,                                  // Status Kas Bon
    doc.notes || 'Pengajuan melalui Portal Sistem CLX', // Catatan / Keterangan
    linkDokumen,                                   // Link Dokumen / Lampiran
  ];
}

/**
 * Ensure a sheet tab exists in the spreadsheet
 */
async function ensureSheetTabExists(sheetTitle: string, token: string): Promise<void> {
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) return;
    const meta = await metaRes.json();
    const exists = meta.sheets?.some((s: any) => s.properties?.title?.toLowerCase() === sheetTitle.toLowerCase());
    
    if (!exists) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: { title: sheetTitle },
              },
            },
          ],
        }),
      });
    }
  } catch (err) {
    console.warn('ensureSheetTabExists notice:', err);
  }
}

/**
 * Append form to Google Sheet "Rekapan Form"
 */
export async function appendFormToGoogleSheets(doc: FormDocument, token: string): Promise<boolean> {
  try {
    await ensureSheetTabExists(TAB_REKAPAN_FORM, token);

    // Get current row count to calculate No urut
    let currentCount = 1;
    try {
      const getRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${TAB_REKAPAN_FORM}'!B9:B1000`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (getRes.ok) {
        const getData = await getRes.json();
        if (getData.values && Array.isArray(getData.values)) {
          currentCount = getData.values.length + 1;
        }
      }
    } catch {
      // fallback
    }

    const row = formatFormRow(doc, currentCount);

    // Append to table starting at column B (matching Row 8 table header in user's sheet)
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${TAB_REKAPAN_FORM}'!B9:T:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    
    const res = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [row],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Google Sheets append error:', res.status, errText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('appendFormToGoogleSheets failed:', error);
    return false;
  }
}

/**
 * Bulk sync all forms to Google Sheet "Rekapan Form"
 */
export async function syncAllFormsToGoogleSheets(
  forms: FormDocument[], 
  token: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  for (const doc of forms) {
    const ok = await appendFormToGoogleSheets(doc, token);
    if (ok) success++;
    else failed++;
  }
  return { success, failed };
}

/**
 * Append registered user to Google Sheet "Master Login"
 */
export async function appendUserToMasterLogin(user: User, token: string): Promise<boolean> {
  try {
    await ensureSheetTabExists(TAB_MASTER_LOGIN, token);

    // Check if headers exist, if not prepend headers
    try {
      const headRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${TAB_MASTER_LOGIN}'!A1:K1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (headRes.ok) {
        const headData = await headRes.json();
        if (!headData.values || headData.values.length === 0) {
          // Write headers
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${TAB_MASTER_LOGIN}'!A1:K1?valueInputOption=USER_ENTERED`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                values: [[
                  'No',
                  'User ID',
                  'Nama Lengkap',
                  'Email Perusahaan',
                  'Password (Status)',
                  'Divisi / Dept',
                  'Peran (Role)',
                  'Jabatan (Title)',
                  'No. WhatsApp / HP',
                  'Waktu Registrasi',
                  'Status Akun'
                ]],
              }),
            }
          );
        }
      }
    } catch {
      // ignore
    }

    // Get current count
    let userIndex = 1;
    try {
      const countRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${TAB_MASTER_LOGIN}'!A2:A1000`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (countRes.ok) {
        const cData = await countRes.json();
        if (cData.values && Array.isArray(cData.values)) {
          userIndex = cData.values.length + 1;
        }
      }
    } catch {
      // fallback
    }

    const userRow = [
      userIndex,
      user.id,
      user.name,
      user.email,
      'TERENKRIPSI (AKTIF)',
      user.division,
      user.role,
      user.title || `${user.role} (${user.division})`,
      user.phone || '-',
      user.registeredAt || new Date().toISOString(),
      'Aktif (Terverifikasi)'
    ];

    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${TAB_MASTER_LOGIN}'!A:K:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const res = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [userRow],
      }),
    });

    return res.ok;
  } catch (error) {
    console.error('appendUserToMasterLogin failed:', error);
    return false;
  }
}
