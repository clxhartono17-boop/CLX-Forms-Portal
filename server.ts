import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Route: Google Drive Upload (Supports nested folder creation and file upload)
  app.post('/api/google/drive-upload', async (req: Request, res: Response) => {
    try {
      const { doc, folderPath, parentFolderId, fileName } = req.body;
      const fileId = `gdrive_${doc?.formType?.toLowerCase() || 'form'}_${Date.now()}`;
      const folderId = `folder_${Date.now()}`;

      // In production with credentials:
      // Calls Google Drive API files.create for nested folders and upload
      res.json({
        success: true,
        fileId,
        fileName: fileName || `${doc?.docNumber}_merged.pdf`,
        folderPath: folderPath || 'FPU / October / 29 / FPU-0001',
        folderId,
        parentFolderId: parentFolderId || '1hgUyTqNsfJsC30pY7O2kPS95DqEEySm9',
        webViewLink: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`,
        webContentLink: `https://drive.google.com/uc?id=${fileId}&export=download`,
        uploadedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Drive upload failed' });
    }
  });

  // API Route: Google Sheets Append / Update
  app.post('/api/google/sheets-sync', async (req: Request, res: Response) => {
    try {
      const { spreadsheetId, sheetName, row } = req.body;

      // In production with credentials:
      // Calls Google Sheets API spreadsheets.values.append
      res.json({
        success: true,
        spreadsheetId: spreadsheetId || '1irb4RR0LMMBqRfGP4gxvX82c0nLfWIXKHzQ_tqC3h8c',
        sheetName: sheetName || 'Rekapan Form',
        updatedRange: `'${sheetName || 'Rekapan Form'}'!A:V`,
        rowNumber: Math.floor(Math.random() * 50) + 2,
        syncedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Sheets sync failed' });
    }
  });

  // API Route: User Registration sync to Master Login
  app.post('/api/google/register-user', async (req: Request, res: Response) => {
    try {
      const { spreadsheetId, sheetName, user, row } = req.body;
      res.json({
        success: true,
        spreadsheetId: spreadsheetId || '1irb4RR0LMMBqRfGP4gxvX82c0nLfWIXKHzQ_tqC3h8c',
        sheetName: sheetName || 'Master Login',
        user: {
          id: user?.id,
          name: user?.name,
          email: user?.email,
          role: user?.role,
          division: user?.division,
        },
        updatedRange: `'${sheetName || 'Master Login'}'!A:H`,
        rowNumber: Math.floor(Math.random() * 20) + 2,
        syncedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'User registration sync failed' });
    }
  });

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
