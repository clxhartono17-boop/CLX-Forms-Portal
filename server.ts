import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ID Sheet Anda (Bisa dipindah ke .env nantinya)
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1irb4RR0LMMBqRfGP4gxvX82c0nLfWIXKHzQ_tqC3h8c';

// Fungsi Inisialisasi Kredensial Google
const getGoogleAuth = () => {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Handle escape character \n dari file .env
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error("Kredensial Google Service Account tidak ditemukan di .env");
  }

  return new google.auth.JWT(
    clientEmail,
    undefined,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
};

const sheets = google.sheets('v4');

// 1. GET: Ambil Data Form (Read)
app.get('/api/google/forms', async (req, res) => {
  try {
    const auth = getGoogleAuth();
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: 'Rekapan Form!A2:Z', // Mulai dari baris 2 untuk melewati Header
    });
    
    res.json({ success: true, data: response.data.values || [] });
  } catch (error: any) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. POST: Simpan Form Baru (Write)
app.post('/api/google/sheets-sync', async (req, res) => {
  try {
    const { formData } = req.body;
    const auth = getGoogleAuth();
    
    // Susun array data sesuai urutan kolom di Sheet 'Rekapan Form'
    // Sesuaikan ini dengan struktur formData dari frontend Anda
    const values = [
      [
        formData.id || Date.now().toString(),
        formData.tanggal || new Date().toISOString(),
        formData.namaLengkap,
        formData.kategori,
        formData.status || 'Pending',
        // ...tambahkan field lain sesuai urutan kolom Sheet Anda
      ]
    ];

    const response = await sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: 'Rekapan Form!A:A',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    res.json({ success: true, updatedRange: response.data.updates?.updatedRange });
  } catch (error: any) {
    console.error('Error appending form:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. GET: Ambil Data User (Read)
app.get('/api/google/users', async (req, res) => {
  try {
    const auth = getGoogleAuth();
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: 'Master Login!A2:E', 
    });
    
    res.json({ success: true, data: response.data.values || [] });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. POST: Register User Baru (Write)
app.post('/api/google/register-user', async (req, res) => {
  try {
    const { user } = req.body;
    const auth = getGoogleAuth();
    
    const values = [
      [user.id, user.name, user.email, user.role, user.password] // Sesuaikan urutan kolom
    ];

    await sheets.spreadsheets.values.append({
      auth,
      spreadsheetId: SPREADSHEET_ID,
      range: 'Master Login!A:A',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error registering user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
