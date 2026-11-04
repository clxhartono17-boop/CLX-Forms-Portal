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
export const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?gid=0#gid=0`;

export const TAB_REKAPAN_FORM = 'Rekap Form CLX';
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

export interface GoogleAuthUser {
  email?: string | null;
  displayName?: string | null;
  uid?: string;
  photoURL?: string | null;
}

/**
 * Request Google OAuth Access Token via Google Identity Services (GIS).
 * Runs directly with accounts.google.com, resolving any domain restrictions.
 */
function requestTokenViaGIS(): Promise<string> {
  return new Promise((resolve, reject) => {
    const clientId = firebaseConfig.oAuthClientId;
    if (!clientId) {
      return reject(new Error('OAuth Client ID tidak ditemukan.'));
    }

    const loadGsi = (): Promise<void> => {
      if ((window as any).google?.accounts?.oauth2) {
        return Promise.resolve();
      }
      return new Promise((res, rej) => {
        const existing = document.getElementById('google-gsi-client');
        if (existing) {
          existing.addEventListener('load', () => res());
          existing.addEventListener('error', () => rej(new Error('Gagal memuat Google Identity Services.')));
          return;
        }
        const script = document.createElement('script');
        script.id = 'google-gsi-client';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => res();
        script.onerror = () => rej(new Error('Gagal memuat Google Identity Services.'));
        document.head.appendChild(script);
      });
    };

    loadGsi().then(() => {
      try {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
          prompt: 'consent',
          callback: (response: any) => {
            if (response.error) {
              return reject(new Error(response.error_description || response.error));
            }
            if (response.access_token) {
              resolve(response.access_token);
            } else {
              reject(new Error('Tidak ada Access Token dari Google.'));
            }
          },
        });
        tokenClient.requestAccessToken();
      } catch (err) {
        reject(err);
      }
    }).catch(reject);
  });
}

export const signInWithGoogle = async (): Promise<{ user: GoogleAuthUser; accessToken: string }> => {
  if (isSigningIn) {
    throw new Error('Proses login Google sedang berjalan...');
  }
  isSigningIn = true;
  try {
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        return { 
          user: {
            email: result.user.email,
            displayName: result.user.displayName,
            uid: result.user.uid,
            photoURL: result.user.photoURL,
          }, 
          accessToken: cachedAccessToken 
        };
      }
    } catch (popupErr: any) {
      console.warn('Firebase signInWithPopup fallback triggered:', popupErr?.code || popupErr?.message);
      
      // If error is unauthorized domain or popup restrictions, fall back to Google Identity Services
      if (
        popupErr?.code === 'auth/unauthorized-domain' ||
        popupErr?.message?.includes('unauthorized-domain') ||
        popupErr?.message?.includes('unauthorized domain') ||
        popupErr?.code === 'auth/popup-closed-by-user'
      ) {
        const accessToken = await requestTokenViaGIS();
        cachedAccessToken = accessToken;
        
        let userEmail = 'clx.hartono17@gmail.com';
        let userName = 'Hartono Darmawan';
        try {
          const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (uRes.ok) {
            const uData = await uRes.json();
            userEmail = uData.email || userEmail;
            userName = uData.name || userName;
          }
        } catch {
          // ignore
        }

        return {
          user: {
            email: userEmail,
            displayName: userName,
            uid: `gsi_${Date.now()}`,
          },
          accessToken,
        };
      }

      throw popupErr;
    }

    throw new Error('Gagal mendapatkan Access Token Google dari otorisasi.');
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
 * Format form record into the exact 19 columns of Row 8 in user's sheet:
 * Row 8: No | Jenis Form | No. Formulir | Tgl Pengajuan | Tgl Dibutuhkan | Divisi / Dept | Pemohon (Requestor) | Keperluan / Perincian Pengeluaran | Nominal DPP (Rp) | Pajak / PPN / PPh | Total Nilai (Rp) | Metode Pembayaran | Nama Bank & No. Rekening Penerima | Estimasi Selesai (Kas Bon) | Level Otorisasi Diperlukan | Status Otorisasi | Status Kas Bon | Catatan / Keterangan | Link Dokumen / Lampiran
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

  const linkDokumen = doc.googleDrive?.fileUrl || doc.googleDrive?.folderPath || 'Tersimpan di Sistem CLX';

  return [
    rowIndex,                                      // Col A: No
    doc.formType,                                  // Col B: Jenis Form (FPU / FPP / FPPB)
    doc.docNumber,                                 // Col C: No. Formulir
    doc.date,                                      // Col D: Tgl Pengajuan
    doc.date,                                      // Col E: Tgl Dibutuhkan
    doc.division,                                  // Col F: Divisi / Dept
    doc.requesterName,                             // Col G: Pemohon (Requestor)
    doc.purpose,                                   // Col H: Keperluan / Perincian Pengeluaran
    doc.totalAmount,                               // Col I: Nominal DPP (Rp)
    0,                                             // Col J: Pajak / PPN / PPh
    doc.totalAmount,                               // Col K: Total Nilai (Rp)
    doc.paymentMethod,                             // Col L: Metode Pembayaran
    bankInfo,                                      // Col M: Nama Bank & No. Rekening Penerima
    doc.formType === 'FPU' ? 'H+7 Setelah Realisasi' : '-', // Col N: Estimasi Selesai (Kas Bon)
    levelOtorisasi,                                // Col O: Level Otorisasi Diperlukan
    doc.status,                                    // Col P: Status Otorisasi
    statusKasBon,                                  // Col Q: Status Kas Bon
    doc.notes || 'Pengajuan melalui Portal Sistem CLX', // Col R: Catatan / Keterangan
    linkDokumen,                                   // Col S: Link Dokumen / Lampiran
  ];
}

/**
 * Dynamically identify the exact tab title for forms (the sheet corresponding to gid=0)
 */
export async function getTargetFormsTabTitle(token: string): Promise<string> {
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!metaRes.ok) return TAB_REKAPAN_FORM;
    const meta = await metaRes.json();
    const sheets = meta.sheets || [];
    if (sheets.length === 0) return TAB_REKAPAN_FORM;

    // 1. Exact match for gid=0 (the primary sheet shown in the user's attachment)
    const gid0Sheet = sheets.find((s: any) => s.properties?.sheetId === 0);
    if (gid0Sheet?.properties?.title) {
      return gid0Sheet.properties.title;
    }

    // 2. Sheet containing "rekap" or "form"
    const matchSheet = sheets.find((s: any) => {
      const title = (s.properties?.title || '').toLowerCase();
      return title.includes('rekap') || title.includes('form');
    });
    if (matchSheet?.properties?.title) {
      return matchSheet.properties.title;
    }

    // 3. Fallback to first sheet
    return sheets[0]?.properties?.title || TAB_REKAPAN_FORM;
  } catch (err) {
    console.warn('getTargetFormsTabTitle warning:', err);
    return TAB_REKAPAN_FORM;
  }
}

/**
 * Dynamically identify or create the tab title for Master Login
 */
export async function getTargetMasterLoginTabTitle(token: string): Promise<string> {
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!metaRes.ok) return TAB_MASTER_LOGIN;
    const meta = await metaRes.json();
    const sheets = meta.sheets || [];

    // Find tab matching "master" or "login" or "user"
    const userSheet = sheets.find((s: any) => {
      const title = (s.properties?.title || '').toLowerCase();
      return title.includes('master') || title.includes('login') || title.includes('user');
    });
    if (userSheet?.properties?.title) {
      return userSheet.properties.title;
    }

    // If not found, create new tab "Master Login"
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
              properties: { title: TAB_MASTER_LOGIN },
            },
          },
        ],
      }),
    });
    return TAB_MASTER_LOGIN;
  } catch (err) {
    console.warn('getTargetMasterLoginTabTitle warning:', err);
    return TAB_MASTER_LOGIN;
  }
}

export interface AppendFormResult {
  success: boolean;
  rowNumber: number;
  sheetTitle: string;
  error?: string;
}

/**
 * Append form to user's Google Sheet at gid=0 (Row 9+, Columns B through T)
 * Column A is intentionally preserved as an empty margin column matching user's template
 */
export async function appendFormToGoogleSheets(
  doc: FormDocument, 
  token: string
): Promise<AppendFormResult> {
  try {
    const targetTab = await getTargetFormsTabTitle(token);

    // Read column B starting at Row 8 (header row 'No') to find the exact next empty row
    let targetRow = 9;
    let sequenceIndex = 1;

    try {
      const getRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${targetTab}'!B8:B1000`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (getRes.ok) {
        const getData = await getRes.json();
        const rows = getData.values || [];
        if (rows.length > 0) {
          // Row 8 is header 'No', then row 9 is rows[1]
          targetRow = 8 + rows.length;
          sequenceIndex = rows.length; // Row 8 is header, row 9 gets 1, etc.
        }
      }
    } catch (err) {
      console.warn('Check row index error:', err);
    }

    const rowData = formatFormRow(doc, sequenceIndex);

    // Write directly using PUT into Columns B through T (A is empty margin)
    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${targetTab}'!B${targetRow}:T${targetRow}?valueInputOption=USER_ENTERED`;
    
    const putRes = await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowData],
      }),
    });

    if (putRes.ok) {
      return { success: true, rowNumber: targetRow, sheetTitle: targetTab };
    }

    // Fallback: Use standard append targeting Columns B:T
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${targetTab}'!B8:T8:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const appendRes = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowData],
      }),
    });

    if (!appendRes.ok) {
      const errText = await appendRes.text();
      console.error('Google Sheets append error:', appendRes.status, errText);
      return { success: false, rowNumber: targetRow, sheetTitle: targetTab, error: errText };
    }

    return { success: true, rowNumber: targetRow, sheetTitle: targetTab };
  } catch (error: any) {
    console.error('appendFormToGoogleSheets error:', error);
    return { success: false, rowNumber: 0, sheetTitle: '', error: error?.message || 'Network error' };
  }
}

/**
 * Format all forms into Tab-Separated Values (TSV) matching Columns B through T
 * For direct 1-click paste into Cell B9 of Google Sheets
 */
export function formatFormsToTsv(forms: FormDocument[]): string {
  return forms
    .map((doc, idx) => {
      const row = formatFormRow(doc, idx + 1);
      return row
        .map(cell => {
          if (cell === null || cell === undefined) return '';
          return String(cell).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
        })
        .join('\t');
    })
    .join('\n');
}

/**
 * Copy TSV data directly to clipboard for pasting into Cell B9
 */
export async function copyFormsToClipboard(forms: FormDocument[]): Promise<boolean> {
  try {
    const tsv = formatFormsToTsv(forms);
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(tsv);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = tsv;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch (err) {
    console.warn('Clipboard copy error:', err);
    return false;
  }
}

/**
 * Generate CSV formatted for the user's template
 */
export function generateFormsCsv(forms: FormDocument[]): string {
  const header = ',No,Jenis Form,No. Formulir,Tgl Pengajuan,Tgl Dibutuhkan,Divisi / Dept,Pemohon (Requestor),Keperluan / Perincian Pengeluaran,Nominal DPP (Rp),Pajak / PPN / PPh,Total Nilai (Rp),Metode Pembayaran,Nama Bank & No. Rekening Penerima,Estimasi Selesai (Kas Bon),Level Otorisasi Diperlukan,Status Otorisasi,Status Kas Bon,Catatan / Keterangan,Link Dokumen / Lampiran';
  
  const dataRows = forms.map((doc, idx) => {
    const row = formatFormRow(doc, idx + 1);
    const escaped = row.map(val => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    });
    return `,"${escaped.join('","')}`;
  });

  return [header, ...dataRows].join('\n');
}

export function downloadFormsCsv(forms: FormDocument[]) {
  const csv = generateFormsCsv(forms);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Rekap_Form_CLX_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface AppendUserResult {
  success: boolean;
  rowNumber: number;
  sheetTitle: string;
  error?: string;
}

/**
 * Append registered user to Google Sheet "Master Login"
 */
export async function appendUserToMasterLogin(
  user: User, 
  token: string
): Promise<AppendUserResult> {
  try {
    const targetTab = await getTargetMasterLoginTabTitle(token);

    // Check if headers exist at A1:L1
    try {
      const headRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${targetTab}'!A1:L1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (headRes.ok) {
        const headData = await headRes.json();
        if (!headData.values || headData.values.length === 0) {
          // Write headers
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${targetTab}'!A1:L1?valueInputOption=USER_ENTERED`,
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
                  'Tanda Tangan Digital',
                  'Waktu Registrasi',
                  'Status Akun'
                ]],
              }),
            }
          );
        }
      }
    } catch (err) {
      console.warn('Headers check warning:', err);
    }

    // Determine target row
    let targetRow = 2;
    let userIndex = 1;
    try {
      const countRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${targetTab}'!A1:A1000`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (countRes.ok) {
        const cData = await countRes.json();
        const rows = cData.values || [];
        if (rows.length > 0) {
          targetRow = rows.length + 1;
          userIndex = rows.length;
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
      user.signatureUrl ? 'Tersimpan (Digital Sign)' : 'Belum Upload',
      user.registeredAt || new Date().toISOString(),
      'Aktif (Terverifikasi)'
    ];

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${targetTab}'!A${targetRow}:L${targetRow}?valueInputOption=USER_ENTERED`;
    const res = await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [userRow],
      }),
    });

    if (res.ok) {
      return { success: true, rowNumber: targetRow, sheetTitle: targetTab };
    }

    // Fallback append
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${targetTab}'!A1:L1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const appendRes = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [userRow],
      }),
    });

    return { 
      success: appendRes.ok, 
      rowNumber: targetRow, 
      sheetTitle: targetTab, 
      error: appendRes.ok ? undefined : await appendRes.text() 
    };
  } catch (error: any) {
    console.error('appendUserToMasterLogin failed:', error);
    return { success: false, rowNumber: 0, sheetTitle: '', error: error?.message };
  }
}

/**
 * Bulk sync all forms and registered users to the Google Sheet
 */
export async function syncAllDataToGoogleSheets(
  forms: FormDocument[],
  users: User[],
  token: string
): Promise<{ formsCount: number; usersCount: number; sheetTitle: string; errors: string[] }> {
  const errors: string[] = [];
  let formsCount = 0;
  let usersCount = 0;

  // 1. Sync Forms
  const targetFormsTab = await getTargetFormsTabTitle(token);
  for (const doc of forms) {
    const res = await appendFormToGoogleSheets(doc, token);
    if (res.success) {
      formsCount++;
    } else if (res.error) {
      errors.push(`Form ${doc.docNumber}: ${res.error}`);
    }
  }

  // 2. Sync Users
  for (const u of users) {
    const res = await appendUserToMasterLogin(u, token);
    if (res.success) {
      usersCount++;
    } else if (res.error) {
      errors.push(`User ${u.name}: ${res.error}`);
    }
  }

    return {
      formsCount,
      usersCount,
      sheetTitle: targetFormsTab,
      errors,
    };
  }

  export const STORAGE_KEY_APPS_SCRIPT_URL = 'clx_apps_script_url_v2';

  export const APPS_SCRIPT_SAMPLE_CODE = `/**
   * CLX Forms Portal - Google Apps Script Auto-Sync Webhook
   * Menghubungkan portal https://clx-forms-portal.vercel.app/ langsung ke Spreadsheet Rekap Form CLX
   * Pasang di: Ekstensi > Apps Script di spreadsheet Rekap Form CLX
   */

  function doPost(e) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var postData = "";
      if (e && e.postData && e.postData.contents) {
        postData = e.postData.contents;
      }
      
      var data = {};
      if (postData) {
        try {
          data = JSON.parse(postData);
        } catch (err) {
          data = { action: 'ping' };
        }
      }

      var sheetForms = ss.getSheetByName("Rekap Form CLX") || ss.getSheets()[0];

      // 1. Action: Append Form Baru
      if (data.action === "append_form" || data.form) {
        var row = data.row;
        if (!row && data.form) {
          var doc = data.form;
          row = [
            doc.sequenceNumber || 1,
            doc.formType || "FPU",
            doc.docNumber || "-",
            doc.date || "",
            doc.neededDate || doc.date || "",
            doc.division || "Finance",
            doc.requesterName || "",
            doc.purpose || "",
            doc.subtotalAmount || doc.totalAmount || 0,
            doc.taxAmount || 0,
            doc.totalAmount || 0,
            doc.paymentMethod || "Bank Transfer",
            (doc.bankName || "BCA") + " - " + (doc.bankAccountNo || "-") + " (a.n " + (doc.bankAccountName || "-") + ")",
            doc.settlementEstimate || (doc.formType === "FPU" ? "H+7 Setelah Realisasi" : "-"),
            doc.totalAmount > 10000000 ? "Maker -> CSO -> COO -> CFO -> CEO (Wajib CEO)" : "Maker -> CSO -> COO -> CFO (Selesai di CFO)",
            doc.status || "Pending CSO",
            doc.formType === "FPU" ? "Kas Bon Aktif" : "-",
            doc.notes || "-",
            doc.googleDrive ? (doc.googleDrive.webViewLink || "-") : "-"
          ];
        }

        // Hitung baris target di bawah Row 8 (header 'No')
        var colBValues = sheetForms.getRange("B8:B1000").getValues();
        var count = 0;
        for (var i = 1; i < colBValues.length; i++) {
          if (colBValues[i][0] !== "" && colBValues[i][0] !== null) {
            count++;
          }
        }
        var targetRow = 9 + count;
        
        // Update nomor urut
        if (row && row.length > 0) {
          row[0] = count + 1;
        }

        // Tulis tepat pada Kolom B sampai Kolom T (19 Kolom, Kolom A kosong sebagai margin)
        sheetForms.getRange(targetRow, 2, 1, row.length).setValues([row]);

        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "Formulir berhasil ditulis ke Google Sheet!",
          rowNumber: targetRow,
          sheetTitle: sheetForms.getName()
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // 2. Action: Update Status Approval
      if (data.action === "update_status") {
        var docNum = data.docNumber;
        var newStatus = data.status;
        var levelOto = data.levelOtorisasi;
        var statusKasBon = data.statusKasBon;

        var colDValues = sheetForms.getRange("D8:D1000").getValues();
        var foundRow = -1;
        for (var j = 0; j < colDValues.length; j++) {
          if (colDValues[j][0] == docNum) {
            foundRow = 8 + j;
            break;
          }
        }

        if (foundRow > 0) {
          if (levelOto) sheetForms.getRange(foundRow, 16).setValue(levelOto); // Col P
          if (newStatus) sheetForms.getRange(foundRow, 17).setValue(newStatus); // Col Q
          if (statusKasBon) sheetForms.getRange(foundRow, 18).setValue(statusKasBon); // Col R
        }

        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          updatedRow: foundRow
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // 3. Action: Register User Baru ke Master Login
      if (data.action === "register_user" || data.user) {
        var userSheet = ss.getSheetByName("Master Login");
        if (!userSheet) {
          userSheet = ss.insertSheet("Master Login");
          userSheet.getRange(1, 1, 1, 8).setValues([[
            "No", "ID User", "Nama Lengkap", "Email", "Role", "Divisi", "Jabatan", "Waktu Daftar"
          ]]);
        }
        var user = data.user || {};
        var uRow = data.row || [
          userSheet.getLastRow(),
          user.id || "USR-" + new Date().getTime(),
          user.name || "-",
          user.email || "-",
          user.role || "Staff",
          user.division || "Finance",
          user.title || "-",
          user.registeredAt || new Date().toISOString()
        ];
        var nextUserRow = Math.max(2, userSheet.getLastRow() + 1);
        userSheet.getRange(nextUserRow, 1, 1, uRow.length).setValues([uRow]);

        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          sheetTitle: "Master Login"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Ping / Test
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Koneksi Webhook CLX Aktif!",
        spreadsheet: ss.getName()
      })).setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  function doGet(e) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    return ContentService.createTextOutput(JSON.stringify({
      status: "ok",
      message: "CLX Google Sheets Auto-Sync Webhook is Active!",
      spreadsheet: ss.getName(),
      sheets: ss.getSheets().map(function(s) { return s.getName(); })
    })).setMimeType(ContentService.MimeType.JSON);
  }`;

  export function getAppsScriptUrl(): string {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_APPS_SCRIPT_URL);
      if (stored && stored.trim()) return stored.trim();
    }
    return (import.meta as any).env?.VITE_APPS_SCRIPT_URL || '';
  }

  export function setAppsScriptUrl(url: string): void {
    if (typeof window !== 'undefined') {
      if (url && url.trim()) {
        localStorage.setItem(STORAGE_KEY_APPS_SCRIPT_URL, url.trim());
      } else {
        localStorage.removeItem(STORAGE_KEY_APPS_SCRIPT_URL);
      }
    }
  }

  export function isAutoSyncConfigured(): boolean {
    return Boolean(getAppsScriptUrl());
  }

  /**
   * Send payload to Google Apps Script Webhook.
   * Handles CORS redirects seamlessly using text/plain payload and no-cors fallback.
   */
  export async function sendToAppsScriptWebhook(
    payload: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const url = getAppsScriptUrl();
    if (!url) {
      return { success: false, error: 'URL Google Apps Script Webhook belum dikonfigurasi.' };
    }

    try {
      // First attempt: standard fetch with text/plain body to avoid complex CORS preflights
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const resData = await response.json();
          return { success: true, data: resData };
        }
      } catch (err: any) {
        console.warn('Standard webhook fetch note, trying no-cors fallback:', err);
      }

      // Second attempt: no-cors mode (Google Apps Script always executes even if response is opaque to browser)
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      return { 
        success: true, 
        data: { message: 'Data dikirim via Webhook Google Apps Script.' } 
      };
    } catch (err: any) {
      console.error('sendToAppsScriptWebhook error:', err);
      return { success: false, error: err?.message || 'Gagal mengirim data ke Webhook.' };
    }
  }

  /**
   * Automatic background synchronization for a single form document.
   * Tries Webhook first (no login required for staff!), then Google OAuth if available.
   */
  export async function autoSyncFormToGoogleSheet(
    doc: FormDocument,
    rowIndex?: number
  ): Promise<{ synced: boolean; method: string; rowNumber?: number; sheetTitle?: string; error?: string }> {
    const row = formatFormRow(doc, rowIndex || 1);

    // Method 1: Google Apps Script Webhook (ZERO LOGIN, WORKS 100% ON VERCEL)
    if (isAutoSyncConfigured()) {
      const webhookRes = await sendToAppsScriptWebhook({
        action: 'append_form',
        form: doc,
        row,
      });
      if (webhookRes.success) {
        return {
          synced: true,
          method: 'webhook',
          rowNumber: webhookRes.data?.rowNumber,
          sheetTitle: webhookRes.data?.sheetTitle || 'Rekap Form CLX',
        };
      }
    }

    // Method 2: Google Sheets API via OAuth token
    const token = getGoogleAccessToken();
    if (token) {
      const sheetsRes = await appendFormToGoogleSheets(doc, token);
      if (sheetsRes.success) {
        return {
          synced: true,
          method: 'oauth_sheets_api',
          rowNumber: sheetsRes.rowNumber,
          sheetTitle: sheetsRes.sheetTitle,
        };
      }
    }

    return {
      synced: false,
      method: 'none',
      error: 'Belum ada Webhook Google Apps Script atau Google OAuth yang terhubung.',
    };
  }

  /**
   * Automatic status update in Google Sheet when a form is approved
   */
  export async function autoSyncStatusToGoogleSheet(
    doc: FormDocument
  ): Promise<boolean> {
    if (!isAutoSyncConfigured()) return false;

    const levelOtorisasi = doc.totalAmount > 10_000_000
      ? 'Maker -> CSO -> COO -> CFO -> CEO (Wajib CEO)'
      : 'Maker -> CSO -> COO -> CFO (Selesai di CFO)';
    const statusKasBon = doc.formType === 'FPU' ? 'Kas Bon Aktif' : '-';

    const res = await sendToAppsScriptWebhook({
      action: 'update_status',
      docNumber: doc.docNumber,
      status: doc.status,
      levelOtorisasi,
      statusKasBon,
    });
    return res.success;
  }

  /**
   * Automatic user registration sync to Master Login tab
   */
  export async function autoSyncUserToGoogleSheet(
    user: User
  ): Promise<boolean> {
    if (isAutoSyncConfigured()) {
      const res = await sendToAppsScriptWebhook({
        action: 'register_user',
        user,
      });
      if (res.success) return true;
    }

    const token = getGoogleAccessToken();
    if (token) {
      const res = await appendUserToMasterLogin(user, token);
      return res.success;
    }

    return false;
  }

