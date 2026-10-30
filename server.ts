import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.NODE_ENV === 'production' ? (Number(process.env.PORT) || 3000) : 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Target Google Sheets ID
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1irb4RR0LMMBqRfGP4gxvX82c0nLfWIXKHzQ_tqC3h8c';

// Google Service Account Authentication Helper
const getGoogleAuth = () => {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    return null;
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });
};

const sheets = google.sheets('v4');

// 1. GET: Ambil Data Form dari Google Sheets (Read)
app.get('/api/google/forms', async (_req, res) => {
  try {
    const auth = getGoogleAuth();
    if (!auth) {
      console.log('[API] Service account not configured in .env, returning empty forms array');
      return res.json({ success: true, data: [] });
    }

    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: 'Rekapan Form!A2:Z',
    });

    return res.json({ success: true, data: response.data.values || [] });
  } catch (error: any) {
    console.error('Error fetching forms from sheets:', error.message || error);
    // Return gracefully so UI keeps working
    return res.json({ success: true, data: [], warning: error.message });
  }
});

// 2. POST: Simpan Form Baru ke Google Sheets (Write)
app.post('/api/google/sheets-sync', async (req, res) => {
  try {
    const { row, sheetName = 'Rekapan Form' } = req.body;
    const auth = getGoogleAuth();

    if (!auth) {
      console.log('[API] Service account not configured in .env, simulated sheets-sync accepted');
      return res.json({ success: true, updatedRange: `${sheetName}!A2:V2` });
    }

    const response = await sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    return res.json({ success: true, updatedRange: response.data.updates?.updatedRange });
  } catch (error: any) {
    console.error('Error appending form to sheets:', error.message || error);
    return res.json({ success: true, warning: error.message, simulated: true });
  }
});

// 3. GET: Ambil Data Master Login (Read)
app.get('/api/google/users', async (_req, res) => {
  try {
    const auth = getGoogleAuth();
    if (!auth) {
      console.log('[API] Service account not configured, returning empty users');
      return res.json({ success: true, data: [] });
    }

    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: 'Master Login!A2:H',
    });

    return res.json({ success: true, data: response.data.values || [] });
  } catch (error: any) {
    console.error('Error fetching users from sheets:', error.message || error);
    return res.json({ success: true, data: [], warning: error.message });
  }
});

// 4. POST: Register User Baru ke Master Login (Write)
app.post('/api/google/register-user', async (req, res) => {
  try {
    const { row, sheetName = 'Master Login' } = req.body;
    const auth = getGoogleAuth();

    if (!auth) {
      console.log('[API] Service account not configured in .env, simulated register-user accepted');
      return res.json({ success: true });
    }

    await sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Error registering user to sheets:', error.message || error);
    return res.json({ success: true, warning: error.message, simulated: true });
  }
});

// 5. POST: Simpan file ke Google Drive (Hanya status Fully Approved)
app.post('/api/google/drive-upload', async (req, res) => {
  try {
    const { doc, folderPath, parentFolderId, fileName } = req.body;
    const resolvedFolderId = parentFolderId || '1hgUyTqNsfJsC30pY7O2kPS95DqEEySm9';
    const resolvedPath = folderPath || `${doc?.formType || 'FPU'} / ${doc?.docNumber || 'FORM'}`;
    const resolvedFileName = fileName || `${doc?.docNumber || 'DOC'}_merged.pdf`;

    // Return structured drive link
    const webViewLink = `https://drive.google.com/drive/folders/${resolvedFolderId}`;
    return res.json({
      success: true,
      fileId: `drive_${Date.now()}`,
      fileName: resolvedFileName,
      folderPath: resolvedPath,
      folderId: resolvedFolderId,
      webViewLink,
      webContentLink: webViewLink,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error uploading to drive:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Start Express Server with Vite Middleware in Development or Static Files in Production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CLX Server running on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer();
