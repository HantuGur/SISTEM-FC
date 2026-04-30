/**
 * SISTEM ADMIN GYM - Google Apps Script Backend
 *
 * Cara pakai singkat:
 * 1. Buat Google Sheet kosong.
 * 2. Copy Spreadsheet ID dari URL Google Sheet.
 * 3. Tempel ID ke SPREADSHEET_ID di bawah.
 * 4. Ganti ADMIN_PIN.
 * 5. Jalankan setupGymSheets() sekali dari Apps Script editor.
 * 6. Deploy sebagai Web App.
 */

const SPREADSHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
const ADMIN_PIN = '1234';
const MAX_KEY_NUMBER = 100;

const SHEET_LOG = 'LOG_GYM';
const SHEET_KEYS = 'DATA_KUNCI';

const LOG_HEADERS = [
  'ID',
  'Timestamp',
  'Tanggal',
  'Jam',
  'Nama Pelanggan',
  'No HP/Member',
  'No Kunci',
  'Jenis Kunjungan',
  'Status',
  'Admin',
  'Catatan'
];

const KEY_HEADERS = [
  'No Kunci',
  'Status',
  'Dipakai Oleh',
  'No HP/Member',
  'Jam Masuk',
  'Update Terakhir'
];

function setupGymSheets() {
  const ss = getSpreadsheet_();
  const logSheet = getOrCreateSheet_(ss, SHEET_LOG);
  const keySheet = getOrCreateSheet_(ss, SHEET_KEYS);

  setupHeader_(logSheet, LOG_HEADERS);
  setupHeader_(keySheet, KEY_HEADERS);
  seedKeys_(keySheet, MAX_KEY_NUMBER);

  logSheet.setFrozenRows(1);
  keySheet.setFrozenRows(1);
  logSheet.autoResizeColumns(1, LOG_HEADERS.length);
  keySheet.autoResizeColumns(1, KEY_HEADERS.length);
}

function doGet(e) {
  try {
    ensureReady_();
    const params = e && e.parameter ? e.parameter : {};
    const action = String(params.action || 'ping').toLowerCase();

    if (action === 'keys') {
      return respondJson_(params.callback, {
        ok: true,
        message: 'Data kunci berhasil diambil.',
        data: getKeys_()
      });
    }

    return respondJson_(params.callback, {
      ok: true,
      message: 'Backend Sistem Admin Gym aktif.',
      data: {
        app: 'Sistem Admin Gym',
        serverTime: formatDateTime_(new Date())
      }
    });
  } catch (error) {
    const params = e && e.parameter ? e.parameter : {};
    return respondJson_(params.callback, {
      ok: false,
      message: error.message || String(error)
    });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lock.waitLock(10000);
    locked = true;

    ensureReady_();

    const params = e && e.parameter ? e.parameter : {};
    const action = String(params.action || '').trim();
    if (action !== 'saveLog') {
      throw new Error('Action tidak dikenal.');
    }

    validatePin_(params.pin);

    const payload = normalizePayload_(params);
    const ss = getSpreadsheet_();
    const logSheet = getOrCreateSheet_(ss, SHEET_LOG);
    const keySheet = getOrCreateSheet_(ss, SHEET_KEYS);

    setupHeader_(logSheet, LOG_HEADERS);
    setupHeader_(keySheet, KEY_HEADERS);

    const currentKey = getKeyRecord_(keySheet, payload.keyNumber);
    if (payload.status === 'Masuk' && currentKey.status === 'Dipakai') {
      throw new Error(`Kunci ${payload.keyNumber} sedang dipakai oleh ${currentKey.customerName || 'pelanggan lain'}.`);
    }

    appendLog_(logSheet, payload);
    updateKey_(keySheet, payload);

    return respondPostMessage_({
      ok: true,
      message: `Data ${payload.status.toLowerCase()} berhasil disimpan untuk kunci ${payload.keyNumber}.`
    });
  } catch (error) {
    return respondPostMessage_({
      ok: false,
      message: error.message || String(error)
    });
  } finally {
    if (locked) lock.releaseLock();
  }
}

function ensureReady_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'PASTE_GOOGLE_SHEET_ID_HERE') {
    throw new Error('SPREADSHEET_ID belum diisi di Code.gs.');
  }
  if (!ADMIN_PIN || ADMIN_PIN === 'GANTI_PIN_ADMIN') {
    throw new Error('ADMIN_PIN belum diatur di Code.gs.');
  }
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function setupHeader_(sheet, headers) {
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsHeader = current.every(value => String(value || '').trim() === '');
  if (needsHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#eef3ff');
  }
}

function seedKeys_(sheet, maxKey) {
  const existingKeys = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    values.forEach(row => {
      const key = normalizeKeyNumber_(row[0]);
      if (key) existingKeys.add(key);
    });
  }

  const rows = [];
  for (let i = 1; i <= maxKey; i += 1) {
    const key = String(i).padStart(2, '0');
    if (!existingKeys.has(key)) {
      rows.push([key, 'Kosong', '', '', '', '']);
    }
  }

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, KEY_HEADERS.length).setValues(rows);
  }
}

function validatePin_(pin) {
  if (String(pin || '').trim() !== String(ADMIN_PIN)) {
    throw new Error('PIN admin salah. Data tidak disimpan.');
  }
}

function normalizePayload_(params) {
  const customerName = cleanText_(params.customerName);
  const phoneOrMember = cleanText_(params.phoneOrMember);
  const keyNumber = normalizeKeyNumber_(params.keyNumber);
  const visitType = normalizeVisitType_(params.visitType);
  const status = normalizeStatus_(params.status);
  const admin = cleanText_(params.admin);
  const note = cleanText_(params.note);

  if (!admin) throw new Error('Nama admin wajib diisi.');
  if (!customerName) throw new Error('Nama pelanggan wajib diisi.');
  if (!keyNumber) throw new Error('Nomor kunci wajib diisi.');
  if (!visitType) throw new Error('Jenis kunjungan tidak valid.');
  if (!status) throw new Error('Status tidak valid.');

  return {
    customerName,
    phoneOrMember,
    keyNumber,
    visitType,
    status,
    admin,
    note,
    timestamp: new Date()
  };
}

function cleanText_(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeKeyNumber_(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const number = Number(raw);
  if (!Number.isFinite(number) || number <= 0) return '';
  return String(Math.floor(number)).padStart(2, '0');
}

function normalizeVisitType_(value) {
  const allowed = ['Harian', 'Member', 'Trial'];
  const found = allowed.find(item => item.toLowerCase() === String(value || '').trim().toLowerCase());
  return found || '';
}

function normalizeStatus_(value) {
  const allowed = ['Masuk', 'Keluar'];
  const found = allowed.find(item => item.toLowerCase() === String(value || '').trim().toLowerCase());
  return found || '';
}

function appendLog_(sheet, payload) {
  const timestamp = payload.timestamp || new Date();
  const id = createId_(timestamp);

  sheet.appendRow([
    id,
    timestamp,
    formatDate_(timestamp),
    formatTime_(timestamp),
    payload.customerName,
    payload.phoneOrMember,
    payload.keyNumber,
    payload.visitType,
    payload.status,
    payload.admin,
    payload.note
  ]);
}

function updateKey_(sheet, payload) {
  const record = getKeyRecord_(sheet, payload.keyNumber);
  const rowIndex = record.rowIndex || appendKeyRow_(sheet, payload.keyNumber);
  const nowText = formatDateTime_(new Date());

  if (payload.status === 'Masuk') {
    sheet.getRange(rowIndex, 1, 1, KEY_HEADERS.length).setValues([[
      payload.keyNumber,
      'Dipakai',
      payload.customerName,
      payload.phoneOrMember,
      formatDateTime_(payload.timestamp || new Date()),
      nowText
    ]]);
  } else {
    sheet.getRange(rowIndex, 1, 1, KEY_HEADERS.length).setValues([[
      payload.keyNumber,
      'Kosong',
      '',
      '',
      '',
      nowText
    ]]);
  }
}

function appendKeyRow_(sheet, keyNumber) {
  const rowIndex = sheet.getLastRow() + 1;
  sheet.getRange(rowIndex, 1, 1, KEY_HEADERS.length).setValues([[
    keyNumber,
    'Kosong',
    '',
    '',
    '',
    ''
  ]]);
  return rowIndex;
}

function getKeyRecord_(sheet, keyNumber) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { rowIndex: null, keyNumber, status: 'Kosong', customerName: '', phoneOrMember: '', checkInTime: '', updatedAt: '' };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, KEY_HEADERS.length).getValues();
  for (let i = 0; i < values.length; i += 1) {
    const row = values[i];
    const rowKey = normalizeKeyNumber_(row[0]);
    if (rowKey === keyNumber) {
      return {
        rowIndex: i + 2,
        keyNumber: rowKey,
        status: cleanText_(row[1]) || 'Kosong',
        customerName: cleanText_(row[2]),
        phoneOrMember: cleanText_(row[3]),
        checkInTime: stringifyCellDate_(row[4]),
        updatedAt: stringifyCellDate_(row[5])
      };
    }
  }

  return { rowIndex: null, keyNumber, status: 'Kosong', customerName: '', phoneOrMember: '', checkInTime: '', updatedAt: '' };
}

function getKeys_() {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, SHEET_KEYS);
  setupHeader_(sheet, KEY_HEADERS);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, KEY_HEADERS.length).getValues();
  return rows
    .filter(row => normalizeKeyNumber_(row[0]))
    .map(row => ({
      keyNumber: normalizeKeyNumber_(row[0]),
      status: cleanText_(row[1]) || 'Kosong',
      customerName: cleanText_(row[2]),
      phoneOrMember: cleanText_(row[3]),
      checkInTime: stringifyCellDate_(row[4]),
      updatedAt: stringifyCellDate_(row[5])
    }))
    .sort((a, b) => Number(a.keyNumber) - Number(b.keyNumber));
}

function createId_(date) {
  const prefix = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const uuid = Utilities.getUuid().slice(0, 8).toUpperCase();
  return `GYM-${prefix}-${uuid}`;
}

function formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function formatTime_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm:ss');
}

function formatDateTime_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
}

function stringifyCellDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
    return formatDateTime_(value);
  }
  return cleanText_(value);
}

function respondJson_(callback, payload) {
  const json = JSON.stringify(payload);
  const cb = String(callback || '').trim();

  if (cb && /^[a-zA-Z_$][0-9a-zA-Z_$]*(\.[a-zA-Z_$][0-9a-zA-Z_$]*)*$/.test(cb)) {
    return ContentService
      .createTextOutput(`${cb}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function respondPostMessage_(payload) {
  const safePayload = JSON.stringify(payload).replace(/</g, '\\u003c');
  const html = `
<!doctype html>
<html>
  <body>
    <script>
      (function () {
        var message = {
          source: 'sistem-gym-backend',
          payload: ${safePayload}
        };
        try {
          window.parent.postMessage(message, '*');
        } catch (error) {}
      })();
    </script>
  </body>
</html>`;

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
