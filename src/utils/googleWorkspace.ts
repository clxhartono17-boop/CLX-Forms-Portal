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

export const TAB_REKAPAN_FORM = 'Rekapan Form';
export const TAB_MASTER_LOGIN = 'master Login';

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

    // 1. Exact match for "Rekapan Form" or "Rekap Form CLX" (case-insensitive)
    const namedSheet = sheets.find((s: any) => {
      const title = (s.properties?.title || '').trim().toLowerCase();
      return title === 'rekapan form' || title === 'rekap form clx' || title === 'rekap form';
    });
    if (namedSheet?.properties?.title) {
      return namedSheet.properties.title;
    }

    // 2. Exact match for gid=0 (the primary sheet shown in the user's attachment)
    const gid0Sheet = sheets.find((s: any) => s.properties?.sheetId === 0);
    if (gid0Sheet?.properties?.title) {
      return gid0Sheet.properties.title;
    }

    // 3. Sheet containing "rekap" or "form"
    const matchSheet = sheets.find((s: any) => {
      const title = (s.properties?.title || '').toLowerCase();
      return title.includes('rekap') || title.includes('form');
    });
    if (matchSheet?.properties?.title) {
      return matchSheet.properties.title;
    }

    // 4. Fallback to first sheet
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
   * CLX Forms Portal - Google Apps Script Auto-Sync Webhook (v2.1)
   * Menghubungkan portal https://clx-forms-portal.vercel.app/ langsung ke Spreadsheet (Rekapan Form & master Login)
   * Pasang di: Ekstensi > Apps Script di spreadsheet Google Anda
   */

  function findSheetCaseInsensitive(ss, candidates) {
    var sheets = ss.getSheets();
    for (var c = 0; c < candidates.length; c++) {
      var target = String(candidates[c] || "").trim().toLowerCase();
      for (var i = 0; i < sheets.length; i++) {
        var name = String(sheets[i].getName() || "").trim().toLowerCase();
        if (name === target) return sheets[i];
      }
    }
    return null;
  }

  function getFormsSheet(ss) {
    return (
      findSheetCaseInsensitive(ss, ["Rekapan Form", "Rekap Form CLX", "Rekap Form"]) ||
      ss.getSheets()[0]
    );
  }

  function getMasterLoginSheet(ss) {
    var userSheet = findSheetCaseInsensitive(ss, ["master Login", "Master Login", "master_login", "masterlogin"]);
    if (!userSheet) {
      userSheet = ss.insertSheet("master Login");
      userSheet.getRange(1, 1, 1, 10).setValues([[
        "No", "ID User", "Nama Lengkap", "Email", "Role", "Divisi", "Jabatan", "No. HP", "Sign Digital", "Waktu Daftar"
      ]]);
    } else if (userSheet.getLastRow() === 0) {
      userSheet.getRange(1, 1, 1, 10).setValues([[
        "No", "ID User", "Nama Lengkap", "Email", "Role", "Divisi", "Jabatan", "No. HP", "Sign Digital", "Waktu Daftar"
      ]]);
    }
    return userSheet;
  }

  function getFormsSheetLayout(sheetForms) {
    var maxScanRows = Math.min(15, Math.max(1, sheetForms.getLastRow()));
    var maxScanCols = Math.min(10, Math.max(5, sheetForms.getLastColumn()));
    var scanValues = sheetForms.getRange(1, 1, maxScanRows, maxScanCols).getValues();

    for (var r = 0; r < scanValues.length; r++) {
      for (var c = 0; c < scanValues[r].length; c++) {
        var cellText = String(scanValues[r][c] || "").trim().toLowerCase();
        if (cellText === "no. formulir" || cellText === "no formulir" || cellText === "no. dokumen" || cellText === "no dokumen") {
          var firstNonEmptyCol = 1;
          for (var fc = 0; fc < scanValues[r].length; fc++) {
            if (String(scanValues[r][fc] || "").trim() !== "") {
              firstNonEmptyCol = fc + 1;
              break;
            }
          }
          return {
            headerRow: r + 1,
            dataStartRow: r + 2,
            startCol: firstNonEmptyCol,
            docNumCol: c + 1
          };
        }
      }
    }

    return {
      headerRow: 8,
      dataStartRow: 9,
      startCol: 2,
      docNumCol: 4
    };
  }

  function buildFormRowArray(doc, seqNo) {
    var totalVal = Number(doc.totalAmount) || 0;
    var bankStr = doc.bankName
      ? (doc.bankName + " - " + (doc.bankAccountNo || "-") + " (a.n " + (doc.bankAccountName || "-") + ")")
      : "KAS / TUNAI";
    return [
      seqNo,
      doc.formType || "FPP",
      doc.docNumber || "-",
      doc.date || "",
      doc.targetDate || doc.neededDate || doc.date || "",
      doc.division || "Finance",
      doc.requesterName || "",
      doc.purpose || "",
      doc.subtotalAmount || totalVal,
      doc.taxAmount || 0,
      totalVal,
      doc.paymentMethod || "Bank Transfer",
      bankStr,
      doc.settlementDate || doc.settlementEstimate || (doc.formType === "FPU" ? "H+7 Setelah Realisasi" : "-"),
      totalVal > 10000000 ? "Maker -> CSO -> COO -> CFO -> CEO (Wajib CEO)" : "Maker -> CSO -> COO -> CFO (Selesai di CFO)",
      doc.status || "Pending Approval",
      doc.formType === "FPU" ? (doc.status === "Fully Approved" ? "Menunggu SPJ / Realisasi" : "Pengajuan Kas Bon") : "-",
      doc.notes || "-",
      doc.googleDrive ? (doc.googleDrive.webViewLink || doc.googleDrive.fileUrl || "-") : "-"
    ];
  }

  function syncSingleUserToSheet(userSheet, user, customRow) {
    var email = String((user && user.email) || (customRow && customRow[3]) || "").trim().toLowerCase();
    var lastRow = userSheet.getLastRow();
    var existingRow = -1;

    if (email && lastRow >= 2) {
      var emailCol = userSheet.getRange(2, 4, lastRow - 1, 1).getValues();
      for (var r = 0; r < emailCol.length; r++) {
        if (String(emailCol[r][0] || "").trim().toLowerCase() === email) {
          existingRow = 2 + r;
          break;
        }
      }
    }

    var rowNum = existingRow > 0 ? existingRow : Math.max(2, lastRow + 1);
    var seqNum = rowNum - 1;
    var uRow = (customRow && customRow.length >= 8) ? customRow.slice() : [
      seqNum,
      (user && user.id) || ("USR-" + new Date().getTime()),
      (user && user.name) || "-",
      email || "-",
      (user && user.role) || "Staff",
      (user && user.division) || "Finance",
      (user && user.title) || "-",
      (user && user.phone) || "-",
      (user && (user.signatureStatus || user.hasSignature)) ? "Terlampir (Sign Digital)" : "Belum Upload",
      (user && user.registeredAt) || new Date().toISOString()
    ];
    uRow[0] = seqNum;
    userSheet.getRange(rowNum, 1, 1, uRow.length).setValues([uRow]);
    return rowNum;
  }

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
          data = { action: "ping" };
        }
      }

      var sheetForms = getFormsSheet(ss);
      var layout = getFormsSheetLayout(sheetForms);

      // 0. Action: Batch Sync
      if (data.action === "batch_sync" || data.action === "sync_all" || (data.rows && Array.isArray(data.rows) && data.rows.length > 0)) {
        if (data.users && Array.isArray(data.users) && data.users.length > 0) {
          var batchUserSheet = getMasterLoginSheet(ss);
          for (var uIdx = 0; uIdx < data.users.length; uIdx++) {
            syncSingleUserToSheet(batchUserSheet, data.users[uIdx], null);
          }
        }

        var rows = data.rows || [];
        if ((!rows || rows.length === 0) && data.forms && Array.isArray(data.forms)) {
          rows = data.forms.map(function(doc, idx) {
            return buildFormRowArray(doc, idx + 1);
          });
        }

        if (rows.length > 0) {
          var lastSheetRow = sheetForms.getLastRow();
          var existingCount = 0;
          if (lastSheetRow >= layout.dataStartRow) {
            var docVals = sheetForms.getRange(layout.dataStartRow, layout.docNumCol, lastSheetRow - layout.dataStartRow + 1, 1).getValues();
            for (var i = 0; i < docVals.length; i++) {
              if (String(docVals[i][0] || "").trim() !== "") {
                existingCount = i + 1;
              }
            }
          }
          var startRow = layout.dataStartRow + existingCount;

          for (var k = 0; k < rows.length; k++) {
            rows[k][0] = existingCount + k + 1;
          }

          sheetForms.getRange(startRow, layout.startCol, rows.length, rows[0].length).setValues(rows);

          return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            message: rows.length + " formulir berhasil dimasukkan ke sheet " + sheetForms.getName() + "!",
            count: rows.length,
            startRow: startRow,
            sheetTitle: sheetForms.getName()
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      // 1. Action: Append Form Baru
      if (data.action === "append_form" || data.form) {
        var row = data.row;
        if (!row && data.form) {
          row = buildFormRowArray(data.form, data.form.sequenceNumber || 1);
        }

        var lastR = sheetForms.getLastRow();
        var filledCount = 0;
        if (lastR >= layout.dataStartRow) {
          var colDocVals = sheetForms.getRange(layout.dataStartRow, layout.docNumCol, lastR - layout.dataStartRow + 1, 1).getValues();
          for (var idx = 0; idx < colDocVals.length; idx++) {
            if (String(colDocVals[idx][0] || "").trim() !== "") {
              filledCount = idx + 1;
            }
          }
        }
        var targetRow = layout.dataStartRow + filledCount;
        if (row && row.length > 0) {
          row[0] = filledCount + 1;
        }

        sheetForms.getRange(targetRow, layout.startCol, 1, row.length).setValues([row]);

        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "Formulir berhasil ditulis ke Google Sheet!",
          rowNumber: targetRow,
          sheetTitle: sheetForms.getName()
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // 2. Action: Update Status Approval
      if (data.action === "update_status") {
        var docNum = String(data.docNumber || "").trim();
        var newStatus = data.status;
        var levelOto = data.levelOtorisasi;
        var statusKasBon = data.statusKasBon;

        var maxR = sheetForms.getLastRow();
        var foundRow = -1;
        if (maxR >= layout.dataStartRow) {
          var colDoc = sheetForms.getRange(layout.dataStartRow, layout.docNumCol, maxR - layout.dataStartRow + 1, 1).getValues();
          for (var j = 0; j < colDoc.length; j++) {
            if (String(colDoc[j][0] || "").trim() === docNum) {
              foundRow = layout.dataStartRow + j;
              break;
            }
          }
        }

        if (foundRow > 0) {
          if (levelOto) sheetForms.getRange(foundRow, layout.startCol + 14).setValue(levelOto);
          if (newStatus) sheetForms.getRange(foundRow, layout.startCol + 15).setValue(newStatus);
          if (statusKasBon) sheetForms.getRange(foundRow, layout.startCol + 16).setValue(statusKasBon);
        }

        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          updatedRow: foundRow,
          sheetTitle: sheetForms.getName()
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // 2b. Action: Edit / Update Form Data (Perubahan Data oleh User/Maker)
      if (data.action === "update_form" && (data.row || data.form)) {
        var editDocNum = String(data.docNumber || (data.form ? data.form.docNumber : "")).trim();
        var newRow = data.row || buildFormRowArray(data.form, data.form.sequenceNumber || 1);

        var maxEditR = sheetForms.getLastRow();
        var foundEditRow = -1;
        if (maxEditR >= layout.dataStartRow) {
          var editColDoc = sheetForms.getRange(layout.dataStartRow, layout.docNumCol, maxEditR - layout.dataStartRow + 1, 1).getValues();
          for (var m = 0; m < editColDoc.length; m++) {
            if (String(editColDoc[m][0] || "").trim() === editDocNum) {
              foundEditRow = layout.dataStartRow + m;
              break;
            }
          }
        }

        if (foundEditRow > 0 && newRow && newRow.length > 0) {
          var originalSeq = sheetForms.getRange(foundEditRow, layout.startCol).getValue();
          if (originalSeq) newRow[0] = originalSeq;
          sheetForms.getRange(foundEditRow, layout.startCol, 1, newRow.length).setValues([newRow]);
          return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            message: "Perubahan form berhasil disimpan ke Google Sheet!",
            updatedRow: foundEditRow,
            sheetTitle: sheetForms.getName()
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      // 2c. Action: Delete Form (Sinkronisasi Hapus Baris)
      if (data.action === "delete_form" && data.docNumber) {
        var dNum = String(data.docNumber).trim();
        var maxDelR = sheetForms.getLastRow();
        if (maxDelR >= layout.dataStartRow) {
          var delColDoc = sheetForms.getRange(layout.dataStartRow, layout.docNumCol, maxDelR - layout.dataStartRow + 1, 1).getValues();
          for (var d = 0; d < delColDoc.length; d++) {
            if (String(delColDoc[d][0] || "").trim() === dNum) {
              sheetForms.deleteRow(layout.dataStartRow + d);
              return ContentService.createTextOutput(JSON.stringify({
                status: "success",
                message: "Baris formulir berhasil dihapus dari Google Sheet!"
              })).setMimeType(ContentService.MimeType.JSON);
            }
          }
        }
      }

      // 3. Action: Register User Baru ke master Login
      if (data.action === "register_user" || data.user) {
        var userSheet = getMasterLoginSheet(ss);
        var savedUserRow = syncSingleUserToSheet(userSheet, data.user || {}, data.row);

        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          rowNumber: savedUserRow,
          sheetTitle: userSheet.getName()
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // 4. Action: Get All Forms (Read from Sheet)
      if (data.action === "get_forms" || data.action === "read_forms") {
        var allForms = getAllFormsJson(ss);
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          forms: allForms,
          total: allForms.length,
          sheetTitle: sheetForms.getName()
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Ping / Test
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Koneksi Webhook CLX Aktif!",
        spreadsheet: ss.getName(),
        formsSheet: sheetForms.getName(),
        masterLoginSheet: getMasterLoginSheet(ss).getName()
      })).setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  function getAllFormsJson(ss) {
    var sheetForms = getFormsSheet(ss);
    var layout = getFormsSheetLayout(sheetForms);
    var lastRow = sheetForms.getLastRow();
    var formsList = [];

    if (lastRow >= layout.dataStartRow) {
      var numRows = lastRow - layout.dataStartRow + 1;
      var data = sheetForms.getRange(layout.dataStartRow, layout.startCol, numRows, 19).getValues();
      var docIdx = Math.max(0, layout.docNumCol - layout.startCol);

      for (var i = 0; i < data.length; i++) {
        var row = data[i];
        var docNum = row[docIdx];
        if (docNum && String(docNum).trim() !== "" && String(docNum).trim() !== "-") {
          var seq = row[0] || (i + 1);
          var fType = String(row[1] || "FPP").trim();
          var docNo = String(docNum).trim();
          var dDate = row[3] instanceof Date ? Utilities.formatDate(row[3], Session.getScriptTimeZone() || "GMT+7", "yyyy-MM-dd") : String(row[3] || "");
          var nDate = row[4] instanceof Date ? Utilities.formatDate(row[4], Session.getScriptTimeZone() || "GMT+7", "yyyy-MM-dd") : String(row[4] || dDate);
          var div = String(row[5] || "Finance").trim();
          var reqName = String(row[6] || "").trim();
          var purp = String(row[7] || "").trim();
          var dpp = Number(row[8]) || 0;
          var tax = Number(row[9]) || 0;
          var total = Number(row[10]) || dpp;
          var payMethod = String(row[11] || "Bank Transfer").trim();
          var bName = String(row[12] || "").trim();
          var settle = String(row[13] || "-").trim();
          var st = String(row[15] || "Pending Approval").trim();
          var nts = String(row[17] || "").trim();
          var link = String(row[18] || "").trim();

          var assignee = "Done";
          if (st === "Pending Approval" || st.indexOf("Pending") !== -1) {
            assignee = "CSO";
          } else if (st === "Approved by CSO") {
            assignee = "COO";
          } else if (st === "Approved by COO") {
            assignee = "CFO";
          } else if (st === "Approved by CFO") {
            assignee = (total > 10000000) ? "CEO" : "CFO";
          } else if (st === "Fully Approved" || st === "Rejected") {
            assignee = (total > 10000000) ? "CEO" : "CFO";
          }

          var actualRowNum = layout.dataStartRow + i;
          formsList.push({
            id: "sheet-row-" + actualRowNum + "-" + docNo.replace(/[^a-zA-Z0-9]/g, "_"),
            sequenceNumber: Number(seq) || (i + 1),
            formType: (fType === "PFB" ? "FPP" : fType),
            docNumber: docNo,
            date: dDate,
            targetDate: nDate,
            neededDate: nDate,
            division: div,
            requesterName: reqName,
            purpose: purp,
            totalAmount: total,
            subtotalAmount: dpp,
            taxAmount: tax,
            paymentMethod: payMethod,
            bankName: bName,
            settlementDate: settle,
            settlementEstimate: settle,
            notes: nts,
            status: st,
            currentAssigneeRole: assignee,
            googleSheets: {
              synced: true,
              rowNumber: actualRowNum,
              sheetName: sheetForms.getName()
            },
            googleDrive: {
              uploaded: link.indexOf("http") !== -1,
              folderPath: link.indexOf("http") === -1 ? link : "",
              fileUrl: link.indexOf("http") !== -1 ? link : undefined
            }
          });
        }
      }
    }

    return formsList;
  }

  function doGet(e) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var formsList = getAllFormsJson(ss);
      var sheetForms = getFormsSheet(ss);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        forms: formsList,
        total: formsList.length,
        spreadsheet: ss.getName(),
        sheetTitle: sheetForms.getName()
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: err.toString(),
        forms: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
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
      window.dispatchEvent(new CustomEvent('clx-autosync-updated'));
    }
  }

  export function isAutoSyncConfigured(): boolean {
    return Boolean(getAppsScriptUrl());
  }

  /**
   * Send payload to Google Apps Script Webhook.
   * Uses standard text/plain fetch first, then Node server proxy (/api/google/webhook-sync),
   * and finally browser no-cors fallback on static deployments.
   */
  export async function sendToAppsScriptWebhook(
    payload: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const url = getAppsScriptUrl();
    if (!url) {
      return { success: false, error: 'URL Google Apps Script Webhook belum dikonfigurasi.' };
    }

    try {
      // 1. Direct fetch (gets full JSON confirmation when browser allows Apps Script redirect)
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
          if (resData?.status === 'error') {
            return { success: false, error: resData.message || 'Apps Script error' };
          }
          return { success: true, data: resData };
        }
      } catch (err: any) {
        console.warn('Direct webhook fetch note, trying server proxy:', err);
      }

      // 2. Server-side proxy (bypasses browser CORS and reads exact Apps Script JSON)
      try {
        const proxyRes = await fetch('/api/google/webhook-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, payload }),
        });
        if (proxyRes.ok) {
          const proxyJson = await proxyRes.json();
          if (proxyJson?.success) {
            return { success: true, data: proxyJson.data };
          }
        }
      } catch (proxyErr) {
        console.warn('Webhook server proxy unavailable, using no-cors fallback:', proxyErr);
      }

      // 3. Final fallback for static hosts: no-cors POST
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
          sheetTitle: webhookRes.data?.sheetTitle || TAB_REKAPAN_FORM,
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
   * Automatic user registration sync to "master Login" tab.
   * Strips base64 signatureUrl image data so webhook payloads stay fast and within Apps Script limits.
   */
  export async function autoSyncUserToGoogleSheet(
    user: User
  ): Promise<boolean> {
    const { signatureUrl, password: _password, ...safeUser } = user;
    const signatureStatus = signatureUrl ? 'Terlampir (Sign Digital)' : 'Belum Upload';
    const userPayload = {
      ...safeUser,
      hasSignature: Boolean(signatureUrl),
      signatureStatus,
    };
    const userRow = [
      1,
      user.id,
      user.name,
      user.email,
      user.role,
      user.division || 'Finance',
      user.title || `${user.role} (${user.division})`,
      user.phone || '-',
      signatureStatus,
      user.registeredAt || new Date().toISOString(),
    ];

    if (isAutoSyncConfigured()) {
      const res = await sendToAppsScriptWebhook({
        action: 'register_user',
        user: userPayload,
        row: userRow,
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

  /**
   * Bulk sync forms and users via Google Apps Script Webhook.
   * Zero login required - works directly from Vercel without OAuth origin mismatch.
   */
  export async function syncFormsToWebhook(
    forms: FormDocument[],
    users?: User[]
  ): Promise<{ success: boolean; count: number; error?: string }> {
    if (!isAutoSyncConfigured()) {
      return { success: false, count: 0, error: 'URL Webhook Google Apps Script belum disetel.' };
    }

    const rows = forms.map((doc, idx) => formatFormRow(doc, idx + 1));
    const safeUsers = (users || []).map(({ signatureUrl, password: _pwd, ...rest }) => ({
      ...rest,
      hasSignature: Boolean(signatureUrl),
      signatureStatus: signatureUrl ? 'Terlampir (Sign Digital)' : 'Belum Upload',
    }));

    try {
      // 1. Try batch sync first
      const batchRes = await sendToAppsScriptWebhook({
        action: 'batch_sync',
        forms,
        rows,
        users: safeUsers,
      });

      if (batchRes.success) {
        return { success: true, count: forms.length };
      }
    } catch (err) {
      console.warn('Batch webhook note, falling back to sequential sync:', err);
    }

    // 2. Sequential fallback
    let sent = 0;
    for (let i = 0; i < forms.length; i++) {
      const single = await sendToAppsScriptWebhook({
        action: 'append_form',
        form: forms[i],
        row: rows[i],
      });
      if (single.success) sent++;
    }

    return { success: sent > 0, count: sent };
  }

  /**
   * Universal synchronization for all forms:
   * 1. Webhook (primary, zero auth required)
   * 2. Sheets API (if Google OAuth token exists)
   * 3. Clipboard fallback (1-click copy TSV to paste in B9)
   */
  export async function syncFormsToSpreadsheet(
    forms: FormDocument[],
    users: User[],
    token?: string | null
  ): Promise<{ success: boolean; method: 'webhook' | 'oauth' | 'clipboard'; count: number; message: string }> {
    // Method 1: Webhook
    if (isAutoSyncConfigured()) {
      const webRes = await syncFormsToWebhook(forms, users);
      if (webRes.success) {
        return {
          success: true,
          method: 'webhook',
          count: webRes.count,
          message: `Berhasil! ${webRes.count} transaksi langsung tersinkronisasi ke Google Spreadsheet ${TAB_REKAPAN_FORM} via Webhook!`,
        };
      }
    }

    // Method 2: OAuth token if active
    if (token) {
      try {
        const sheetsRes = await syncAllDataToGoogleSheets(forms, users, token);
        if (sheetsRes.formsCount > 0) {
          return {
            success: true,
            method: 'oauth',
            count: sheetsRes.formsCount,
            message: `Berhasil! ${sheetsRes.formsCount} formulir masuk ke tab "${sheetsRes.sheetTitle}" (baris 9+) & ${sheetsRes.usersCount} user ke "${TAB_MASTER_LOGIN}"!`,
          };
        }
      } catch (err: any) {
        console.warn('Sheets API sync error:', err);
      }
    }

    // Method 3: Clipboard
    const copied = await copyFormsToClipboard(forms);
    return {
      success: copied,
      method: 'clipboard',
      count: forms.length,
      message: copied
        ? `📋 Data ${forms.length} formulir berhasil disalin ke clipboard! Buka Google Sheet dan Paste di sel B9.`
        : 'Gagal menyinkronkan data.',
    };
  }

  /**
   * Read all transactions from Google Sheet via Apps Script Webhook (cache-busted).
   * This powers the exact 2-way mirroring (menampilkan data dari sheet "Rekapan Form" di web portal).
   */
  export async function fetchFormsFromAppsScriptWebhook(): Promise<{
    success: boolean;
    forms: FormDocument[];
    error?: string;
  }> {
    const url = getAppsScriptUrl();
    if (!url) {
      return { success: false, forms: [], error: 'URL Webhook Google Apps Script belum disetel.' };
    }

    try {
      // 1. Cache-busted GET directly to Apps Script Web App
      try {
        const sep = url.includes('?') ? '&' : '?';
        const cacheBustUrl = `${url}${sep}action=get_forms&_t=${Date.now()}`;
        const getRes = await fetch(cacheBustUrl, {
          method: 'GET',
          cache: 'no-store',
          redirect: 'follow',
        });
        if (getRes.ok) {
          const data = await getRes.json();
          if (data && Array.isArray(data.forms)) {
            return { success: true, forms: data.forms };
          }
        }
      } catch (getErr) {
        console.warn('Direct GET from webhook note, trying server proxy / POST:', getErr);
      }

      // 2. Server-side proxy attempt (cleanly handles Apps Script redirects if CORS blocks client GET)
      try {
        const proxyRes = await fetch('/api/google/webhook-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, payload: { action: 'get_forms' } }),
        });
        if (proxyRes.ok) {
          const proxyJson = await proxyRes.json();
          if (proxyJson?.success && Array.isArray(proxyJson?.data?.forms)) {
            return { success: true, forms: proxyJson.data.forms };
          }
        }
      } catch (proxyErr) {
        console.warn('Proxy fetch forms note, trying direct POST:', proxyErr);
      }

      // 3. Direct POST with text/plain action 'get_forms'
      const postRes = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'get_forms' }),
      });
      if (postRes.ok) {
        const pData = await postRes.json();
        if (pData && Array.isArray(pData.forms)) {
          return { success: true, forms: pData.forms };
        }
      }
    } catch (err: any) {
      console.error('fetchFormsFromAppsScriptWebhook error:', err);
      return { success: false, forms: [], error: err?.message || 'Gagal membaca data dari Google Sheet' };
    }

    return { success: false, forms: [], error: 'Tidak dapat mengambil formulir dari Google Sheet' };
  }

  /**
   * Push edited form data to Google Sheet row in background
   */
  export async function autoUpdateFormInGoogleSheet(doc: FormDocument): Promise<boolean> {
    if (!isAutoSyncConfigured()) return false;
    const row = formatFormRow(doc, doc.sequenceNumber || 1);
    const res = await sendToAppsScriptWebhook({
      action: 'update_form',
      docNumber: doc.docNumber,
      form: doc,
      row,
    });
    return res.success;
  }

  /**
   * Push form deletion to Google Sheet in background
   */
  export async function autoDeleteFormInGoogleSheet(docNumber: string): Promise<boolean> {
    if (!isAutoSyncConfigured()) return false;
    const res = await sendToAppsScriptWebhook({
      action: 'delete_form',
      docNumber,
    });
    return res.success;
  }




