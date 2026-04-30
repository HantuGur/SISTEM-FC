const DEFAULT_SCRIPT_PLACEHOLDER = "PASTE_APPS_SCRIPT_WEB_APP_URL_HERE";

const state = {
  keys: [],
  pendingSubmit: false,
  pendingTimer: null,
};

const els = {
  appTitle: document.getElementById("appTitle"),
  todayText: document.getElementById("todayText"),
  clockText: document.getElementById("clockText"),
  setupWarning: document.getElementById("setupWarning"),
  settingsCard: document.getElementById("settingsCard"),
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  form: document.getElementById("gymForm"),
  submitBtn: document.getElementById("submitBtn"),
  resetBtn: document.getElementById("resetBtn"),
  adminInput: document.getElementById("adminInput"),
  pinInput: document.getElementById("pinInput"),
  customerNameInput: document.getElementById("customerNameInput"),
  phoneInput: document.getElementById("phoneInput"),
  keyNumberInput: document.getElementById("keyNumberInput"),
  visitTypeInput: document.getElementById("visitTypeInput"),
  statusInput: document.getElementById("statusInput"),
  noteInput: document.getElementById("noteInput"),
  refreshBtn: document.getElementById("refreshBtn"),
  scriptUrlInput: document.getElementById("scriptUrlInput"),
  saveScriptUrlBtn: document.getElementById("saveScriptUrlBtn"),
  clearScriptUrlBtn: document.getElementById("clearScriptUrlBtn"),
  keySearchInput: document.getElementById("keySearchInput"),
  statusFilterInput: document.getElementById("statusFilterInput"),
  totalKeysText: document.getElementById("totalKeysText"),
  usedKeysText: document.getElementById("usedKeysText"),
  emptyKeysText: document.getElementById("emptyKeysText"),
  keysTableBody: document.getElementById("keysTableBody"),
  toast: document.getElementById("toast"),
};

function getConfig() {
  return window.GYM_CONFIG || {};
}

function getScriptUrl() {
  const savedUrl = localStorage.getItem("gymScriptUrl") || "";
  const configuredUrl = (getConfig().SCRIPT_URL || "").trim();
  return (savedUrl || configuredUrl).trim();
}

function isScriptConfigured() {
  const url = getScriptUrl();
  return Boolean(url) && url !== DEFAULT_SCRIPT_PLACEHOLDER && url.startsWith("https://script.google.com/");
}

function applyConfig() {
  const config = getConfig();
  const appName = config.APP_NAME || "Sistem Admin Gym";
  const gymName = config.GYM_NAME || "Nama Gym Kamu";
  document.title = `${appName} - ${gymName}`;
  els.appTitle.textContent = gymName;

  const savedAdmin = localStorage.getItem("gymAdminName") || "";
  els.adminInput.value = savedAdmin;
  els.scriptUrlInput.value = getScriptUrl() === DEFAULT_SCRIPT_PLACEHOLDER ? "" : getScriptUrl();

  toggleSetupWarning();
}

function toggleSetupWarning() {
  if (isScriptConfigured()) {
    els.setupWarning.classList.add("hidden");
  } else {
    els.setupWarning.classList.remove("hidden");
  }
}

function updateClock() {
  const now = new Date();
  els.todayText.textContent = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  els.clockText.textContent = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function showToast(message, type = "success") {
  els.toast.textContent = message;
  els.toast.className = `toast ${type}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.add("hidden"), 3600);
}

function setLoading(isLoading) {
  els.submitBtn.disabled = isLoading;
  els.submitBtn.textContent = isLoading ? "Menyimpan..." : "Simpan ke Google Sheet";
}

function jsonp(action, params = {}) {
  return new Promise((resolve, reject) => {
    if (!isScriptConfigured()) {
      reject(new Error("URL Apps Script belum disambungkan."));
      return;
    }

    const callbackName = `gymCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement("script");
    const query = new URLSearchParams({ action, callback: callbackName, ...params });
    const baseUrl = getScriptUrl();
    const separator = baseUrl.includes("?") ? "&" : "?";
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Request timeout. Cek koneksi atau deploy Apps Script."));
    }, 12000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (response) => {
      cleanup();
      if (response && response.ok) {
        resolve(response);
      } else {
        reject(new Error(response?.message || "Gagal mengambil data."));
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Gagal menghubungi Apps Script."));
    };

    script.src = `${baseUrl}${separator}${query.toString()}`;
    document.body.appendChild(script);
  });
}

async function refreshKeys() {
  if (!isScriptConfigured()) {
    renderKeys([]);
    toggleSetupWarning();
    return;
  }

  els.refreshBtn.disabled = true;
  els.refreshBtn.textContent = "…";

  try {
    const response = await jsonp("keys");
    state.keys = Array.isArray(response.data) ? response.data : [];
    renderKeys(state.keys);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    els.refreshBtn.disabled = false;
    els.refreshBtn.textContent = "↻";
  }
}

function renderKeys(keys) {
  const search = els.keySearchInput.value.trim().toLowerCase();
  const statusFilter = els.statusFilterInput.value;

  const filtered = keys.filter((item) => {
    const text = `${item.keyNumber} ${item.status} ${item.customerName || ""} ${item.phoneOrMember || ""}`.toLowerCase();
    const matchSearch = !search || text.includes(search);
    const matchStatus = statusFilter === "Semua" || item.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const total = keys.length;
  const used = keys.filter((item) => item.status === "Dipakai").length;
  const empty = keys.filter((item) => item.status === "Kosong").length;

  els.totalKeysText.textContent = total;
  els.usedKeysText.textContent = used;
  els.emptyKeysText.textContent = empty;

  if (!filtered.length) {
    els.keysTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">Tidak ada data kunci yang cocok.</td></tr>`;
    return;
  }

  els.keysTableBody.innerHTML = filtered.map((item) => {
    const badgeClass = item.status === "Dipakai" ? "used" : "empty";
    return `
      <tr>
        <td><strong>${escapeHtml(item.keyNumber)}</strong></td>
        <td><span class="badge ${badgeClass}">${escapeHtml(item.status || "Kosong")}</span></td>
        <td>${escapeHtml(item.customerName || "-")}</td>
        <td>${escapeHtml(item.phoneOrMember || "-")}</td>
        <td>${escapeHtml(item.checkInTime || "-")}</td>
        <td>${escapeHtml(item.updatedAt || "-")}</td>
      </tr>
    `;
  }).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clearCustomerFields() {
  els.customerNameInput.value = "";
  els.phoneInput.value = "";
  els.keyNumberInput.value = "";
  els.visitTypeInput.value = "Harian";
  els.statusInput.value = "Masuk";
  els.noteInput.value = "";
  els.customerNameInput.focus();
}

function handleSubmit(event) {
  event.preventDefault();

  toggleSetupWarning();
  if (!isScriptConfigured()) {
    showToast("URL Apps Script belum benar. Atur dulu backend-nya.", "warning");
    return;
  }

  if (!els.form.reportValidity()) return;

  const adminName = els.adminInput.value.trim();
  if (adminName) localStorage.setItem("gymAdminName", adminName);

  state.pendingSubmit = true;
  setLoading(true);
  window.clearTimeout(state.pendingTimer);
  state.pendingTimer = window.setTimeout(() => {
    if (state.pendingSubmit) {
      state.pendingSubmit = false;
      setLoading(false);
      showToast("Belum ada respons dari backend. Cek deploy Apps Script kamu.", "warning");
    }
  }, 15000);

  els.form.action = getScriptUrl();
  els.form.method = "POST";
  els.form.target = "hidden-submit-frame";
  els.form.submit();
}

function handleBackendMessage(event) {
  const data = event.data;
  if (!data || data.source !== "sistem-gym-backend") return;

  state.pendingSubmit = false;
  window.clearTimeout(state.pendingTimer);
  setLoading(false);

  const payload = data.payload || {};
  if (payload.ok) {
    showToast(payload.message || "Data berhasil disimpan.", "success");
    clearCustomerFields();
    refreshKeys();
  } else {
    showToast(payload.message || "Data gagal disimpan.", "error");
  }
}

function saveScriptUrl() {
  const value = els.scriptUrlInput.value.trim();
  if (!value) {
    showToast("Isi URL Web App Apps Script dulu.", "warning");
    return;
  }
  if (!value.startsWith("https://script.google.com/")) {
    showToast("URL harus dari script.google.com.", "warning");
    return;
  }
  localStorage.setItem("gymScriptUrl", value);
  toggleSetupWarning();
  showToast("URL backend disimpan di browser ini.", "success");
  refreshKeys();
}

function clearScriptUrl() {
  localStorage.removeItem("gymScriptUrl");
  els.scriptUrlInput.value = getScriptUrl() === DEFAULT_SCRIPT_PLACEHOLDER ? "" : getScriptUrl();
  toggleSetupWarning();
  renderKeys([]);
  showToast("URL lokal direset.", "success");
}

function initEvents() {
  els.form.addEventListener("submit", handleSubmit);
  els.resetBtn.addEventListener("click", clearCustomerFields);
  els.refreshBtn.addEventListener("click", refreshKeys);
  els.keySearchInput.addEventListener("input", () => renderKeys(state.keys));
  els.statusFilterInput.addEventListener("change", () => renderKeys(state.keys));
  els.saveScriptUrlBtn.addEventListener("click", saveScriptUrl);
  els.clearScriptUrlBtn.addEventListener("click", clearScriptUrl);
  els.openSettingsBtn.addEventListener("click", () => els.scriptUrlInput.focus());
  window.addEventListener("message", handleBackendMessage);
}

function init() {
  applyConfig();
  initEvents();
  updateClock();
  window.setInterval(updateClock, 1000);
  if (isScriptConfigured()) refreshKeys();
}

init();
