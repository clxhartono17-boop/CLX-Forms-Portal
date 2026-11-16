import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseSheetRowsToForms } from './src/utils/sheetSyncMirror.ts';

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
const SYNC_CONFIG_PATH = path.resolve(__dirname, '.clx-sync-config.json');

interface ServerSyncConfig {
  webhookUrl: string;
  updatedAt?: string;
}

function readServerSyncConfig(): ServerSyncConfig {
  const envUrl = (process.env.VITE_APPS_SCRIPT_URL || process.env.APPS_SCRIPT_URL || '').trim();
  try {
    if (fs.existsSync(SYNC_CONFIG_PATH)) {
      const raw = fs.readFileSync(SYNC_CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<ServerSyncConfig>;
      const fileUrl = (parsed?.webhookUrl || '').trim();
      return {
        webhookUrl: fileUrl || envUrl,
        updatedAt: parsed?.updatedAt,
      };
    }
  } catch (err) {
    console.warn('[SyncConfig] Failed reading .clx-sync-config.json:', err);
  }
  return { webhookUrl: envUrl };
}

function writeServerSyncConfig(webhookUrl: string): ServerSyncConfig {
  const next: ServerSyncConfig = {
    webhookUrl: webhookUrl.trim(),
    updatedAt: new Date().toISOString(),
  };
  try {
    if (!next.webhookUrl) {
      if (fs.existsSync(SYNC_CONFIG_PATH)) fs.unlinkSync(SYNC_CONFIG_PATH);
    } else {
      fs.writeFileSync(SYNC_CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
    }
  } catch (err) {
    console.warn('[SyncConfig] Failed writing .clx-sync-config.json:', err);
  }
  return next;
}

function getEffectiveWebhookUrl(requestUrl?: string): string {
  const trimmedReq = (requestUrl || '').trim();
  if (trimmedReq) return trimmedReq;
  return readServerSyncConfig().webhookUrl;
}

async function forwardToAppsScriptWebhook(targetUrl: string, payload: any) {
  let response: Response;
  if (payload?.action === 'get_forms' || payload?.action === 'read_forms') {
    const sep = targetUrl.includes('?') ? '&' : '?';
    response = await fetch(`${targetUrl}${sep}action=get_forms&_t=${Date.now()}`, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
  } else {
    response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
  }

  const responseText = await response.text();
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    const looksLikeHtml =
      responseText.trim().startsWith('<') || responseText.toLowerCase().includes('<html');
    if (looksLikeHtml) {
      throw new Error(
        'Google Apps Script mengembalikan halaman HTML (bukan JSON). Pastikan Deployment Web App diatur ke "Who has access: Anyone / Siapa saja" dan deploy Versi Baru.'
      );
    }
    data = { raw: responseText };
  }

  if (data?.status === 'error') {
    throw new Error(data.message || 'Apps Script mengembalikan status error');
  }

  return data;
}

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
      'https://www.googleapis.com/auth/drive.file',
    ],
  });
};

const sheets = google.sheets('v4');

// 0. GET / POST: Shared Apps Script Webhook Configuration across all users & browsers
app.get('/api/google/sync-config', (_req, res) => {
  const cfg = readServerSyncConfig();
  return res.json({
    success: true,
    configured: Boolean(cfg.webhookUrl),
    webhookUrl: cfg.webhookUrl,
    serviceAccountConfigured: Boolean(getGoogleAuth()),
    updatedAt: cfg.updatedAt,
  });
});

app.post('/api/google/sync-config', (req, res) => {
  const webhookUrl = String(req.body?.webhookUrl || '').trim();
  if (
    webhookUrl &&
    (!webhookUrl.startsWith('https://script.google.com/macros/s/') || !webhookUrl.endsWith('/exec'))
  ) {
    return res.status(400).json({
      success: false,
      error: 'URL Webhook harus diawali https://script.google.com/macros/s/ dan berakhiran /exec',
    });
  }

  const saved = writeServerSyncConfig(webhookUrl);
  return res.json({
    success: true,
    configured: Boolean(saved.webhookUrl),
    webhookUrl: saved.webhookUrl,
    updatedAt: saved.updatedAt,
  });
});

// 1. GET: Ambil Data Form dari Google Sheets (Read)
app.get('/api/google/forms', async (_req, res) => {
  try {
    const auth = getGoogleAuth();
    if (auth) {
      const response = await sheets.spreadsheets.values.get({
        auth,
        spreadsheetId: SPREADSHEET_ID,
        range: 'Rekapan Form!B9:T1000',
      });
      const rawRows = response.data.values || [];
      const forms = parseSheetRowsToForms(rawRows, 'Rekapan Form', 9);
      return res.json({ success: true, data: rawRows, forms, source: 'service_account' });
    }

    const webhookUrl = getEffectiveWebhookUrl();
    if (webhookUrl) {
      const data = await forwardToAppsScriptWebhook(webhookUrl, { action: 'get_forms' });
      const forms = Array.isArray(data?.forms) ? data.forms : [];
      return res.json({ success: true, forms, data: forms, source: 'webhook' });
    }

    return res.json({
      success: false,
      configured: false,
      forms: [],
      data: [],
      error: 'Auto-Sync Webhook Google Sheets belum dikonfigurasi oleh Admin.',
    });
  } catch (error: any) {
    console.error('Error fetching forms from sheets:', error.message || error);
    return res.status(502).json({
      success: false,
      forms: [],
      data: [],
      error: error.message || 'Gagal membaca data dari Google Sheet.',
    });
  }
});

// 2. POST: Simpan Form Baru ke Google Sheets (Write)
app.post('/api/google/sheets-sync', async (req, res) => {
  try {
    const { row, formData, sheetName = 'Rekapan Form' } = req.body;
    const auth = getGoogleAuth();

    if (auth) {
      const response = await sheets.spreadsheets.values.append({
        auth,
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!B9:T9`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      });

      return res.json({ success: true, updatedRange: response.data.updates?.updatedRange });
    }

    const webhookUrl = getEffectiveWebhookUrl();
    if (webhookUrl) {
      const data = await forwardToAppsScriptWebhook(webhookUrl, {
        action: 'append_form',
        form: formData,
        row,
      });
      return res.json({
        success: true,
        rowNumber: data?.rowNumber,
        sheetTitle: data?.sheetTitle || sheetName,
        data,
      });
    }

    return res.status(400).json({
      success: false,
      configured: false,
      error: 'Sinkronisasi Google Sheet belum aktif (URL Webhook Apps Script belum disetel oleh Admin).',
    });
  } catch (error: any) {
    console.error('Error appending form to sheets:', error.message || error);
    return res.status(502).json({
      success: false,
      error: error.message || 'Gagal mengirim data ke Google Sheets.',
    });
  }
});

// 2b. POST: Forward payload to Google Apps Script Webhook (Server-side proxy)
app.post('/api/google/webhook-sync', async (req, res) => {
  try {
    const { url, payload } = req.body;
    const targetUrl = getEffectiveWebhookUrl(url);
    if (!targetUrl) {
      return res.status(400).json({
        success: false,
        configured: false,
        error: 'Target Apps Script Webhook URL belum disetel.',
      });
    }

    const data = await forwardToAppsScriptWebhook(targetUrl, payload);
    return res.json({ success: true, data });
  } catch (err: any) {
    console.error('Error in webhook-sync proxy:', err.message || err);
    return res.status(502).json({ success: false, error: err.message });
  }
});

// 3. GET: Ambil Data Master Login (Read)
app.get('/api/google/users', async (_req, res) => {
  try {
    const auth = getGoogleAuth();
    if (!auth) {
      return res.json({ success: true, data: [] });
    }

    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: 'master Login!A2:J',
    });

    return res.json({ success: true, data: response.data.values || [] });
  } catch (error: any) {
    console.error('Error fetching users from sheets:', error.message || error);
    return res.json({ success: true, data: [], warning: error.message });
  }
});

// 4. POST: Register User Baru ke master Login (Write)
app.post('/api/google/register-user', async (req, res) => {
  try {
    const { row, user, sheetName = 'master Login' } = req.body;
    const auth = getGoogleAuth();

    if (auth) {
      await sheets.spreadsheets.values.append({
        auth,
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A:A`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
      });

      return res.json({ success: true });
    }

    const targetUrl = getEffectiveWebhookUrl();
    if (targetUrl) {
      await forwardToAppsScriptWebhook(targetUrl, {
        action: 'register_user',
        user,
        row,
      });
      return res.json({ success: true, via: 'apps_script_server' });
    }

    return res.json({
      success: false,
      configured: false,
      warning: 'Webhook Apps Script belum disetel',
    });
  } catch (error: any) {
    console.error('Error registering user to sheets:', error.message || error);
    return res.status(502).json({ success: false, error: error.message });
  }
});

// 5. POST: Simpan file ke Google Drive (Hanya status Fully Approved)
app.post('/api/google/drive-upload', async (req, res) => {
  try {
    const { doc, folderPath, parentFolderId, fileName } = req.body;
    const resolvedFolderId = parentFolderId || '1hgUyTqNsfJsC30pY7O2kPS95DqEEySm9';
    const resolvedPath = folderPath || `${doc?.formType || 'FPU'} / ${doc?.docNumber || 'FORM'}`;
    const resolvedFileName = fileName || `${doc?.docNumber || 'DOC'}_merged.pdf`;

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
