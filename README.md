# Sistem Admin Gym

Web admin internal untuk mencatat pelanggan gym: nama, nomor HP/member, nomor kunci, jenis kunjungan, status masuk/keluar, admin, dan catatan. Frontend bisa dibuka dari laptop/HP lewat GitHub Pages, sedangkan data audit masuk ke Google Sheet lewat Google Apps Script.

## Fitur

- Input data pelanggan masuk/keluar dari HP atau laptop.
- Data otomatis masuk ke sheet `LOG_GYM`.
- Status kunci otomatis masuk ke sheet `DATA_KUNCI`.
- Kunci yang sedang dipakai bisa dilihat dari dashboard web.
- PIN admin dicek di backend Google Apps Script, bukan di frontend.
- Setiap aksi masuk/keluar dicatat sebagai baris baru agar aman untuk audit.

## Struktur Folder

```text
sistem-gym-admin/
├── index.html
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── config.js
└── backend/
    └── google-apps-script/
        ├── Code.gs
        └── appsscript.json
```

## Cara Setup Google Sheet

1. Buat Google Sheet baru.
2. Copy Spreadsheet ID dari URL.

Contoh URL:

```text
https://docs.google.com/spreadsheets/d/1ABCxxxxxxxxxxxxxxxxxxxxx/edit
```

Yang dipakai sebagai ID adalah bagian ini:

```text
1ABCxxxxxxxxxxxxxxxxxxxxx
```

## Cara Setup Google Apps Script

1. Buka `https://script.google.com`.
2. Klik **New project**.
3. Hapus isi file `Code.gs` default.
4. Copy semua isi file ini:

```text
backend/google-apps-script/Code.gs
```

5. Paste ke file `Code.gs` di Apps Script.
6. Ubah bagian paling atas:

```javascript
const SPREADSHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
const ADMIN_PIN = '1234';
const MAX_KEY_NUMBER = 100;
```

Menjadi misalnya:

```javascript
const SPREADSHEET_ID = '1ABCxxxxxxxxxxxxxxxxxxxxx';
const ADMIN_PIN = '2580';
const MAX_KEY_NUMBER = 100;
```

7. Buka **Project Settings** di Apps Script.
8. Centang **Show appsscript.json manifest file in editor**.
9. Buka file `appsscript.json`, lalu isi dengan isi file:

```text
backend/google-apps-script/appsscript.json
```

10. Jalankan function `setupGymSheets` sekali.
11. Saat diminta permission, izinkan akses ke Google Sheet.

## Cara Deploy Backend sebagai Web App

1. Di Apps Script, klik **Deploy**.
2. Pilih **New deployment**.
3. Pilih type **Web app**.
4. Isi:

```text
Execute as: Me
Who has access: Anyone
```

5. Klik **Deploy**.
6. Copy URL Web App yang berakhiran `/exec`.

Contoh:

```text
https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxx/exec
```

## Cara Sambungkan Frontend ke Backend

Buka file:

```text
frontend/config.js
```

Ubah:

```javascript
window.GYM_CONFIG = {
  SCRIPT_URL: "PASTE_APPS_SCRIPT_WEB_APP_URL_HERE",
  APP_NAME: "Sistem Admin Gym",
  GYM_NAME: "Nama Gym Kamu",
  ENABLE_LOCAL_SCRIPT_URL_SETTING: true
};
```

Menjadi:

```javascript
window.GYM_CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxx/exec",
  APP_NAME: "Sistem Admin Gym",
  GYM_NAME: "Gym Kamu",
  ENABLE_LOCAL_SCRIPT_URL_SETTING: true
};
```

## Cara Upload ke GitHub Pages

1. Buat repository baru di GitHub, misalnya `sistem-gym-admin`.
2. Upload semua isi folder ini ke repository.
3. Masuk ke **Settings** repository.
4. Pilih **Pages**.
5. Pada bagian source, pilih branch `main` dan folder `/root`.
6. Buka URL GitHub Pages yang diberikan GitHub.

Biasanya bentuknya seperti ini:

```text
https://username.github.io/sistem-gym-admin/
```

Halaman root otomatis mengarah ke:

```text
/frontend/
```

## Cara Pakai Harian

1. Pegawai buka link GitHub Pages dari HP/laptop.
2. Masukkan nama admin dan PIN.
3. Isi nama pelanggan, nomor HP/member, nomor kunci, jenis kunjungan, dan status.
4. Klik **Simpan ke Google Sheet**.
5. Untuk audit, buka Google Sheet dan lihat sheet `LOG_GYM`.

## Catatan Penting Keamanan

- Jangan taruh PIN admin di file frontend.
- PIN hanya ada di `Code.gs` backend.
- URL Apps Script memang terlihat di browser, jadi PIN tetap wajib diisi untuk menyimpan data.
- Untuk sistem produksi yang lebih serius, bisa ditambah login Google Workspace atau akun admin per pegawai.

## Sheet yang Dibuat Otomatis

### `LOG_GYM`

```text
ID | Timestamp | Tanggal | Jam | Nama Pelanggan | No HP/Member | No Kunci | Jenis Kunjungan | Status | Admin | Catatan
```

### `DATA_KUNCI`

```text
No Kunci | Status | Dipakai Oleh | No HP/Member | Jam Masuk | Update Terakhir
```

## Kalau Ada Error Umum

### `SPREADSHEET_ID belum diisi`

Artinya ID Google Sheet belum ditempel ke `Code.gs`.

### `PIN admin salah`

Artinya PIN yang diketik pegawai beda dengan `ADMIN_PIN` di `Code.gs`.

### Dashboard tidak bisa refresh status kunci

Cek lagi:

- URL Apps Script sudah benar dan berakhiran `/exec`.
- Deploy Web App aksesnya `Anyone`.
- Function `setupGymSheets` sudah dijalankan sekali.
- File `frontend/config.js` sudah diisi URL backend.

## Pengembangan Lanjutan

Fitur yang bisa ditambah berikutnya:

- Data member permanen.
- Scan QR member.
- Laporan pengunjung per hari/bulan.
- Filter audit by tanggal.
- Login admin per akun.
- Export PDF laporan harian.
