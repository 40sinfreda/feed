const SHEETS_ID = "1rcqaYX2GSGMueIuHgcwxP9bw7QgDh41cLJxDkaaOHfo";
const DEFAULT_TOKEN = "feed-2026-hadar";
const LS_CFG = "feed_sheets_cfg";
const LS = {
  customers: "feed_customers",
  mixtures: "feed_mixtures",
  additives: "feed_additives",
  orders: "feed_orders",
  settings: "feed_settings"
};

const DEFAULT_MIXTURES = [
  { id: "75000", code: "75000", name: "תערובת יבשות" },
  { id: "72150", code: "72150", name: "גידול פיטום טורבו" },
  { id: "72151", code: "72151", name: "גידול פיטום פרימיום" },
  { id: "71001", code: "71001", name: "פריסטרטר רפואי" },
  { id: "71000", code: "71000", name: "פריסטרטר פרימיום" },
  { id: "71110", code: "71110", name: "סטרטר 1 פרימיום" }
];
const DEFAULT_ADDITIVES = [
  "רפואי: סולפרקס 4.5 ק\"ג לטון + דוקסיצלין 2 ק\"ג לטון",
  "פלובנדזול 700 גר' לטון",
  "רפואי: סולפרקס 4.5 ק\"ג לטון + דוקסיצלין 2 ק\"ג לטון + פלובנדזול 700 גר' לטון",
  "אורוגוסטים 500 גר' לטון"
].map((text, i) => ({ id: "a" + (i + 1), text }));
const DEFAULT_CUSTOMERS = [
  { id: "c1", name: "ג'רג'ורה", number: "5257" },
  { id: "c2", name: "בולוס", number: "5258" },
  { id: "c3", name: "אחים פאהדן", number: "5259" },
  { id: "c4", name: "פרעוני", number: "5260" },
  { id: "c5", name: "יער", number: "5250" },
  { id: "c6", name: "אם.אי.פי וטרינריה", number: "5233" }
];

let customers = [], mixtures = [], additives = [], orders = [];
let settings = { groupLink: "", waNumber: "" };
let currentOrder = { deliveryDate: "", timeSlot: "", customer: null, items: [] };
let selectedQty = null, selectedDelivery = null, selectedAdditives = [], selectedTimeSlot = null;
let viewingOrder = null;
let usingSheets = false;

function loadCfg() {
  try { return JSON.parse(localStorage.getItem(LS_CFG) || "{}"); } catch (e) { return {}; }
}
function saveCfg(cfg) { localStorage.setItem(LS_CFG, JSON.stringify(cfg)); }
function sheetsUrl() { return (loadCfg().webAppUrl || "").trim(); }
function sheetsToken() { return (loadCfg().token || DEFAULT_TOKEN).trim(); }

function uid(prefix) { return prefix + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000); }
function readLS(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v || fallback;
  } catch (e) { return fallback; }
}
function writeLS(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function seedLocalIfNeeded() {
  if (!localStorage.getItem(LS.customers)) writeLS(LS.customers, DEFAULT_CUSTOMERS);
  if (!localStorage.getItem(LS.mixtures)) writeLS(LS.mixtures, DEFAULT_MIXTURES);
  if (!localStorage.getItem(LS.additives)) writeLS(LS.additives, DEFAULT_ADDITIVES);
  if (!localStorage.getItem(LS.orders)) writeLS(LS.orders, []);
  if (!localStorage.getItem(LS.settings)) writeLS(LS.settings, { groupLink: "", waNumber: "" });
}

function loadLocal() {
  customers = readLS(LS.customers, DEFAULT_CUSTOMERS);
  mixtures = readLS(LS.mixtures, DEFAULT_MIXTURES);
  additives = readLS(LS.additives, DEFAULT_ADDITIVES);
  orders = readLS(LS.orders, []);
  settings = readLS(LS.settings, { groupLink: "", waNumber: "" });
}

async function apiGet() {
  const url = sheetsUrl() + "?action=all&token=" + encodeURIComponent(sheetsToken());
  const res = await fetch(url, { method: "GET", redirect: "follow" });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "sheets error");
  return data;
}

async function apiPost(payload) {
  const url = sheetsUrl();
  const res = await fetch(url, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(Object.assign({ token: sheetsToken() }, payload))
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "sheets error");
  return data;
}

function setConn(ok, label) {
  const dot = document.getElementById("conn-dot");
  const lab = document.getElementById("conn-label");
  if (lab) lab.textContent = label;
  if (dot) dot.style.background = ok ? "#69f0ae" : "#ffcc80";
}

async function init() {
  seedLocalIfNeeded();
  loadLocal();
  try {
    if (sheetsUrl()) {
      const data = await apiGet();
      customers = data.customers || [];
      mixtures = data.mixtures || [];
      additives = data.additives || [];
      orders = data.orders || [];
      settings = data.settings || settings;
      usingSheets = true;
      setConn(true, "מחובר לשיטס");
    } else {
      usingSheets = false;
      setConn(false, "נשמר במכשיר");
    }
    setupDateInput();
    document.getElementById("loading").classList.add("hidden");
    renderHome(); renderHistory(); populateCustomerSelect();
  } catch (err) {
    console.error(err);
    usingSheets = false;
    loadLocal();
    setupDateInput();
    document.getElementById("loading").classList.add("hidden");
    setConn(false, "שיטס נכשל · מקומי");
    renderHome(); renderHistory(); populateCustomerSelect();
    showToast("עובד במצב מקומי");
  }
}

async function refreshFromSheets() {
  if (!usingSheets) return;
  const data = await apiGet();
  customers = data.customers || customers;
  mixtures = data.mixtures || mixtures;
  additives = data.additives || additives;
  orders = data.orders || orders;
  settings = data.settings || settings;
}

function getTomorrowDate() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
function isSaturday(ds) { return ds ? new Date(ds + "T12:00:00").getDay() === 6 : false; }

function setupDateInput() {
  const di = document.getElementById("delivery-date");
  di.min = new Date().toISOString().split("T")[0];
  di.value = getTomorrowDate();
  di.addEventListener("change", function() {
    if (isSaturday(this.value)) { showToast("לא ניתן להזמין לאספקה בשבת"); this.value = getTomorrowDate(); }
  });
  document.querySelectorAll(".time-slot-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      document.querySelectorAll(".time-slot-btn").forEach(b => b.classList.remove("selected"));
      this.classList.add("selected"); selectedTimeSlot = this.dataset.slot;
    });
  });
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + name).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  const nb = document.querySelector('.nav-btn[data-screen="' + name + '"]');
  if (nb) nb.classList.add("active");
  if (name === "home") renderHome();
  if (name === "history") renderHistory();
  if (name === "manage") document.getElementById("manage-content").innerHTML = "";
}

function startNewOrder() {
  currentOrder = { deliveryDate: "", timeSlot: "", customer: null, items: [] };
  selectedQty = null; selectedDelivery = null; selectedAdditives = []; selectedTimeSlot = null;
  document.getElementById("delivery-date").value = getTomorrowDate();
  document.querySelectorAll(".time-slot-btn").forEach(b => b.classList.remove("selected"));
  goToOrderStep(1); showScreen("order");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelector('.nav-btn[data-screen="order"]').classList.add("active");
}

function goToOrderStep(step) {
  if (step === 2) {
    const date = document.getElementById("delivery-date").value;
    if (!date) { showToast("יש לבחור תאריך אספקה"); return; }
    if (isSaturday(date)) { showToast("לא ניתן להזמין לאספקה בשבת"); document.getElementById("delivery-date").value = getTomorrowDate(); return; }
    if (!selectedTimeSlot) { showToast("יש לבחור מועד אספקה"); return; }
    currentOrder.deliveryDate = date; currentOrder.timeSlot = selectedTimeSlot;
  }
  if (step === 3) {
    const sel = document.getElementById("customer-select");
    if (!sel.value) { showToast("יש לבחור לקוח"); return; }
    currentOrder.customer = customers.find(c => c.id === sel.value);
  }
  if (step === 4) {
    if (!currentOrder.items.length) { showToast("יש להוסיף לפחות תערובת אחת"); return; }
    renderWAPreview();
  }
  document.querySelectorAll(".order-step").forEach(s => s.style.display = "none");
  document.getElementById("order-step-" + step).style.display = "block";
  document.querySelectorAll("#order-steps .step").forEach(s => {
    const n = parseInt(s.dataset.step);
    s.classList.remove("active", "done");
    if (n < step) s.classList.add("done");
    if (n === step) s.classList.add("active");
  });
}

function populateCustomerSelect() {
  const sel = document.getElementById("customer-select");
  const val = sel.value;
  sel.innerHTML = '<option value="">-- בחר לקוח --</option>';
  customers.forEach(c => {
    const o = document.createElement("option");
    o.value = c.id; o.textContent = c.name + " (" + c.number + ")";
    sel.appendChild(o);
  });
  if (val) sel.value = val;
}

function showAddCustomerModal() {
  document.getElementById("new-customer-name").value = "";
  document.getElementById("new-customer-number").value = "";
  document.getElementById("modal-customer").classList.add("show");
}

async function addCustomer() {
  const name = document.getElementById("new-customer-name").value.trim();
  const number = document.getElementById("new-customer-number").value.trim();
  if (!name || !number) { showToast("יש למלא שם ומספר"); return; }
  try {
    let id = uid("c");
    if (usingSheets) {
      const r = await apiPost({ action: "addCustomer", name, number });
      id = r.id || id;
      await refreshFromSheets();
    } else {
      customers.push({ id, name, number });
      writeLS(LS.customers, customers);
    }
    populateCustomerSelect();
    document.getElementById("customer-select").value = id;
    closeModal("modal-customer");
    showToast("הלקוח נוסף");
  } catch (e) { showToast("שגיאה"); console.error(e); }
}

async function deleteCustomer(id) {
  if (!confirm("למחוק את הלקוח?")) return;
  try {
    if (usingSheets) { await apiPost({ action: "deleteCustomer", id }); await refreshFromSheets(); }
    else { customers = customers.filter(c => c.id !== id); writeLS(LS.customers, customers); }
    showManageSection("customers"); showToast("נמחק");
  } catch (e) { showToast("שגיאה"); }
}

function showAddItemModal() {
  selectedQty = null; selectedDelivery = null; selectedAdditives = [];
  document.getElementById("item-mixture").innerHTML = mixtures.map(m => '<option value="' + m.code + '">' + m.code + ' - ' + m.name + '</option>').join("");
  document.querySelectorAll(".qty-btn").forEach(btn => {
    btn.classList.remove("selected");
    btn.onclick = () => { document.querySelectorAll(".qty-btn").forEach(b => b.classList.remove("selected")); btn.classList.add("selected"); selectedQty = parseInt(btn.dataset.qty); };
  });
  document.querySelectorAll(".delivery-btn").forEach(btn => {
    btn.classList.remove("selected");
    btn.onclick = () => { document.querySelectorAll(".delivery-btn").forEach(b => b.classList.remove("selected")); btn.classList.add("selected"); selectedDelivery = btn.dataset.delivery; };
  });
  document.getElementById("item-additives").innerHTML = additives.map((a, i) =>
    '<label class="additive-item" id="add-item-' + i + '"><input type="checkbox" onchange="toggleAdditive(' + i + ', this.checked)"><span>' + a.text + '</span></label>'
  ).join("");
  document.getElementById("modal-item").classList.add("show");
}

function toggleAdditive(i, checked) {
  const el = document.getElementById("add-item-" + i);
  if (checked) { selectedAdditives.push(i); el.classList.add("selected"); }
  else { selectedAdditives = selectedAdditives.filter(x => x !== i); el.classList.remove("selected"); }
}

function addItemToOrder() {
  if (!selectedQty) { showToast("יש לבחור כמות"); return; }
  if (!selectedDelivery) { showToast("יש לבחור סוג הובלה"); return; }
  const mix = mixtures.find(m => m.code === document.getElementById("item-mixture").value);
  currentOrder.items.push({
    code: mix.code, name: mix.name, qty: selectedQty, delivery: selectedDelivery,
    additives: selectedAdditives.map(i => additives[i].text)
  });
  renderOrderItems(); closeModal("modal-item"); showToast("נוסף");
}

function renderOrderItems() {
  const c = document.getElementById("order-items-list");
  if (!currentOrder.items.length) {
    c.innerHTML = '<div class="empty" style="padding:24px;"><div class="icon">📦</div><p>עדיין לא נוספו תערובות</p></div>';
    return;
  }
  c.innerHTML = currentOrder.items.map((item, idx) =>
    '<div class="order-item"><button class="remove-btn" onclick="removeItem(' + idx + ')">×</button><h4>' + item.name + ' · ' + item.code + '</h4><div class="meta">' + item.qty.toLocaleString() + ' ק"ג · ' + item.delivery + (item.additives.length ? '<br>' + item.additives.map(a => '• ' + a).join('<br>') : '') + '</div></div>'
  ).join("");
}

function removeItem(idx) { currentOrder.items.splice(idx, 1); renderOrderItems(); }

function buildWAMessage(order) {
  let msg = "הזמנה חדשה מ-" + order.customer.name + " " + order.customer.number + "\n";
  msg += "📆 אספקה ליום: " + order.deliveryDate + "\n";
  if (order.timeSlot) msg += "⏰ מועד: " + order.timeSlot + "\n";
  msg += "📦 פריטים:\n";
  (order.items || []).forEach(item => {
    msg += "- " + item.name + " - " + item.code + ": " + item.qty + " ק\"ג\n";
    msg += "🚛 הובלה ב: " + item.delivery + "\n";
    if (item.additives && item.additives.length) {
      msg += "➕ תוספות:\n";
      item.additives.forEach(a => { msg += a + "\n"; });
    }
  });
  return msg.trim();
}

function renderWAPreview() { document.getElementById("wa-preview").textContent = buildWAMessage(currentOrder); }
function copyOrderMessage() { showManualCopy(buildWAMessage(currentOrder), true); }
function copyViewOrderMessage() { if (viewingOrder) showManualCopy(buildWAMessage(viewingOrder), false); }

function showManualCopy(text, saveAfter) {
  const old = document.getElementById("manual-copy-overlay");
  if (old) old.remove();
  const overlay = document.createElement("div");
  overlay.id = "manual-copy-overlay";
  overlay.className = "modal-overlay show";
  overlay.innerHTML = '<div class="modal"><div class="modal-header"><h3>העתקת הודעה</h3><button class="modal-close" onclick="document.getElementById(\'manual-copy-overlay\').remove()">×</button></div><textarea id="manual-copy-text" style="min-height:180px;direction:rtl;"></textarea><button class="btn btn-primary" onclick="finishManualCopy(' + (saveAfter ? "true" : "false") + ')">סגור</button></div>';
  document.body.appendChild(overlay);
  const ta = document.getElementById("manual-copy-text");
  ta.value = text; ta.focus(); ta.select();
}

async function finishManualCopy(saveAfter) {
  const el = document.getElementById("manual-copy-overlay");
  if (el) el.remove();
  if (saveAfter) await saveCurrentOrder();
}

function openWhatsAppGroup() {
  const link = settings.groupLink;
  if (!link) { showToast("חסר קישור לקבוצה בהגדרות"); showScreen("manage"); showManageSection("settings"); return; }
  window.open(link, "_blank");
}

async function saveOrderOnly() {
  await saveCurrentOrder();
}

async function saveCurrentOrder() {
  try {
    const payload = {
      deliveryDate: currentOrder.deliveryDate,
      timeSlot: currentOrder.timeSlot,
      customer: currentOrder.customer,
      items: currentOrder.items
    };
    if (usingSheets) {
      await apiPost(Object.assign({ action: "saveOrder" }, payload));
      await refreshFromSheets();
    } else {
      orders.unshift(Object.assign({ id: uid("o"), createdAt: new Date().toISOString() }, payload));
      writeLS(LS.orders, orders);
    }
    showToast("ההזמנה נשמרה");
    setTimeout(() => { startNewOrder(); showScreen("home"); }, 900);
  } catch (e) { console.error(e); showToast("שגיאה בשמירה"); }
}

function renderHome() {
  const c = document.getElementById("home-recent-orders");
  if (!orders.length) { c.innerHTML = '<div class="empty" style="padding:18px;"><p>אין הזמנות עדיין</p></div>'; return; }
  c.innerHTML = orders.slice(0, 5).map(o => historyRow(o)).join("");
}

function renderHistory() {
  const c = document.getElementById("history-list");
  if (!orders.length) { c.innerHTML = '<div class="empty"><div class="icon">📋</div><p>אין הזמנות עדיין</p></div>'; return; }
  c.innerHTML = orders.map(o => historyRow(o)).join("");
}

function historyRow(o) {
  const cust = o.customer || {};
  const n = (o.items || []).length;
  return '<div class="history-item" onclick="viewOrder(\'' + o.id + '\')"><div><div class="date">' + formatDate(o.deliveryDate) + '</div><div class="customer">' + (cust.name || "") + '</div><div class="summary">' + n + ' תערובות · ' + (o.timeSlot || "") + '</div></div><div class="arrow">←</div></div>';
}

function viewOrder(id) {
  viewingOrder = orders.find(o => o.id === id);
  if (!viewingOrder) return;
  document.getElementById("view-order-preview").textContent = buildWAMessage(viewingOrder);
  document.getElementById("modal-view-order").classList.add("show");
}

function showManageSection(section) {
  const c = document.getElementById("manage-content");
  if (section === "customers") {
    c.innerHTML = '<div class="card"><div class="card-title">👥 לקוחות</div>' +
      customers.map(x => '<div class="list-item"><div><div class="name">' + x.name + '</div><div class="code">' + x.number + '</div></div><button class="btn btn-danger btn-sm" onclick="deleteCustomer(\'' + x.id + '\')">מחק</button></div>').join("") + '</div>';
  } else if (section === "mixtures") {
    c.innerHTML = '<div class="card"><div class="card-title">🥣 תערובות</div><div class="inline-form show"><input id="new-mix-code" placeholder="קוד" dir="ltr" style="text-align:left;"><input id="new-mix-name" placeholder="שם תערובת"><button class="btn btn-primary btn-sm" onclick="addMixture()">שמור</button></div>' +
      mixtures.map(m => '<div class="list-item"><div><div class="name">' + m.name + '</div><div class="code">' + m.code + '</div></div><button class="btn btn-danger btn-sm" onclick="deleteMixture(\'' + m.id + '\')">מחק</button></div>').join("") + '</div>';
  } else if (section === "additives") {
    c.innerHTML = '<div class="card"><div class="card-title">➕ תוספות</div><div class="inline-form show"><input id="new-additive" placeholder="טקסט תוספת"><button class="btn btn-primary btn-sm" onclick="addAdditive()">שמור</button></div>' +
      additives.map(a => '<div class="list-item"><div class="name" style="font-size:0.88rem;font-weight:500;">' + a.text + '</div><button class="btn btn-danger btn-sm" onclick="deleteAdditive(\'' + a.id + '\')">מחק</button></div>').join("") + '</div>';
  } else if (section === "settings") {
    const cfg = loadCfg();
    c.innerHTML = '<div class="card"><div class="card-title">🔧 הגדרות</div>' +
      '<label>קישור לקבוצת הוואטסאפ</label><input type="url" id="settings-group-link" value="' + (settings.groupLink || "") + '" placeholder="https://chat.whatsapp.com/..." dir="ltr" style="text-align:left;">' +
      '<p style="font-size:0.75rem;color:#8a8a8a;margin:-6px 0 14px;">בקבוצה ← פרטי קבוצה ← קישור להזמנה</p>' +
      '<button class="btn btn-primary" onclick="saveGroupLink()">שמור קישור</button></div>' +
      '<div class="card"><div class="card-title">📊 גוגל שיטס</div>' +
      '<p style="font-size:0.82rem;color:#5a5a5a;margin-bottom:12px;line-height:1.5;">הקובץ כבר נוצר בדרייב. אחרי פריסת Apps Script הדבק כאן את כתובת ה-Web App.</p>' +
      '<label>כתובת Web App</label><input id="settings-webapp" placeholder="https://script.google.com/macros/s/.../exec" dir="ltr" style="text-align:left;" value="' + (cfg.webAppUrl || "") + '">' +
      '<label>טוקן</label><input id="settings-token" dir="ltr" style="text-align:left;" value="' + (cfg.token || DEFAULT_TOKEN) + '">' +
      '<button class="btn btn-primary" onclick="saveSheetsCfg()">שמור וחבר לשיטס</button>' +
      '<p style="font-size:0.75rem;color:#8a8a8a;margin-top:10px;">גיליון: <a href="https://docs.google.com/spreadsheets/d/' + SHEETS_ID + '/edit" target="_blank">פתיחה בגוגל שיטס</a></p></div>';
  }
}

async function addMixture() {
  const code = document.getElementById("new-mix-code").value.trim();
  const name = document.getElementById("new-mix-name").value.trim();
  if (!code || !name) { showToast("יש למלא"); return; }
  try {
    if (usingSheets) { await apiPost({ action: "addMixture", code, name }); await refreshFromSheets(); }
    else { mixtures.push({ id: code, code, name }); writeLS(LS.mixtures, mixtures); }
    showManageSection("mixtures"); showToast("נוסף");
  } catch (e) { showToast("שגיאה"); }
}
async function deleteMixture(id) {
  if (!confirm("למחוק?")) return;
  try {
    if (usingSheets) { await apiPost({ action: "deleteMixture", id }); await refreshFromSheets(); }
    else { mixtures = mixtures.filter(m => m.id !== id); writeLS(LS.mixtures, mixtures); }
    showManageSection("mixtures");
  } catch (e) { showToast("שגיאה"); }
}
async function addAdditive() {
  const text = document.getElementById("new-additive").value.trim();
  if (!text) { showToast("יש למלא"); return; }
  try {
    if (usingSheets) { await apiPost({ action: "addAdditive", text }); await refreshFromSheets(); }
    else { additives.push({ id: uid("a"), text }); writeLS(LS.additives, additives); }
    showManageSection("additives"); showToast("נוסף");
  } catch (e) { showToast("שגיאה"); }
}
async function deleteAdditive(id) {
  if (!confirm("למחוק?")) return;
  try {
    if (usingSheets) { await apiPost({ action: "deleteAdditive", id }); await refreshFromSheets(); }
    else { additives = additives.filter(a => a.id !== id); writeLS(LS.additives, additives); }
    showManageSection("additives");
  } catch (e) { showToast("שגיאה"); }
}
async function saveGroupLink() {
  const link = document.getElementById("settings-group-link").value.trim();
  try {
    settings.groupLink = link;
    if (usingSheets) await apiPost({ action: "saveSettings", groupLink: link, waNumber: settings.waNumber || "" });
    else writeLS(LS.settings, settings);
    showToast("נשמר");
  } catch (e) { showToast("שגיאה"); }
}
async function saveSheetsCfg() {
  const webAppUrl = document.getElementById("settings-webapp").value.trim();
  const token = document.getElementById("settings-token").value.trim() || DEFAULT_TOKEN;
  saveCfg({ webAppUrl, token });
  document.getElementById("loading").classList.remove("hidden");
  await init();
  showToast(usingSheets ? "מחובר לשיטס" : "נשמר מקומית");
  showManageSection("settings");
}

function closeModal(id) { document.getElementById(id).classList.remove("show"); }
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}
function formatDate(ds) {
  if (!ds) return "";
  const p = String(ds).split("-");
  if (p.length !== 3) return ds;
  return p[2] + "/" + p[1] + "/" + p[0];
}

document.querySelectorAll(".modal-overlay").forEach(o => {
  o.addEventListener("click", e => { if (e.target === o) o.classList.remove("show"); });
});

init();
