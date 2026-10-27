// ===== 定数・キー =====
const STORAGE_SHOPPING = "shoppingItems";
const STORAGE_TODO = "todoItems";
const STORAGE_MEMO = "memoText";
const STORAGE_MEMORY = "memoryBlocks";
const STORAGE_TEMP_BACKUP = "backupRestoreTemp";
const STORAGE_LAST_MODE = "lastMode";
const BACKUP_VERSION = 2;
const BACKUP_VERSION_LEGACY = 1;
const MEMORY_INITIAL_SMALL_COUNT = 10;
const JUMBLE_ID = "jumble";
const APP_MODES = ["shopping", "memory", "memo"];

// ===== DOM参照 =====
const pageTitle = document.getElementById("page-title");
const addForm = document.getElementById("add-form");
const itemInput = document.getElementById("item-input");
const shoppingView = document.getElementById("shopping-view");
const memoryView = document.getElementById("memory-view");
const memoView = document.getElementById("memo-view");
const shoppingListEl = document.getElementById("shopping-list");
const shoppingEmpty = document.getElementById("shopping-empty");
const clearShoppingBtn = document.getElementById("clear-shopping-done");
const memoText = document.getElementById("memo-text");
const clearMemoBtn = document.getElementById("clear-memo");
const tabShopping = document.getElementById("tab-shopping");
const tabMemory = document.getElementById("tab-memory");
const tabMemo = document.getElementById("tab-memo");
const voiceBtnList = document.getElementById("voice-btn-list");
const voiceBtnMemo = document.getElementById("voice-btn-memo");
const voiceStatus = document.getElementById("voice-status");
const voiceStatusMemo = document.getElementById("voice-status-memo");
const backupExportBtn = document.getElementById("backup-export");
const backupImportBtn = document.getElementById("backup-import");
const backupFileInput = document.getElementById("backup-file");
const backupMessage = document.getElementById("backup-message");
const handoverBtn = document.getElementById("handover-btn");
const handoverDialog = document.getElementById("handover-dialog");
const handoverCloseX = document.getElementById("handover-close-x");
const handoverClose = document.getElementById("handover-close");
const handoverExport = document.getElementById("handover-export");
const restoreDialog = document.getElementById("restore-dialog");
const restoreCloseX = document.getElementById("restore-close-x");
const restoreCancel = document.getElementById("restore-cancel");
const restoreExport = document.getElementById("restore-export");
const restoreConfirmCheck = document.getElementById("restore-confirm-check");
const restoreContinue = document.getElementById("restore-continue");
const memoryAddBtn = document.getElementById("memory-add-btn");
const memoryGrid = document.getElementById("memory-grid");
const memoryDetail = document.getElementById("memory-detail");
const memoryDetailBack = document.getElementById("memory-detail-back");
const memoryDetailEdit = document.getElementById("memory-detail-edit");
const memoryDetailTitle = document.getElementById("memory-detail-title");
const memoryDetailBody = document.getElementById("memory-detail-body");

// ===== 状態 =====
let mode = "memo";
let shoppingItems = loadItems(STORAGE_SHOPPING);
let todoItems = loadItems(STORAGE_TODO);
let memoContent = loadMemo();
let memoryData = loadMemory();
let memoryDetailOpen = false;
let currentDetailId = null;
let pendingRestore = null;
let recognition = null;
let isListening = false;
let speechSupported = false;

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const isDevHost =
  location.hostname === "localhost" || location.hostname === "127.0.0.1";

// ===== localStorage =====
function generateId() {
  return String(Date.now()) + "-" + Math.random().toString(36).slice(2, 7);
}

function loadItems(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("読み込み失敗:", key, e);
    return [];
  }
}

function loadMemo() {
  try {
    return localStorage.getItem(STORAGE_MEMO) || "";
  } catch (e) {
    console.warn("メモ読み込み失敗:", e);
    return "";
  }
}

function createEmptyBlock() {
  return { id: generateId(), title: "", body: "" };
}

function createDefaultMemory() {
  const blocks = [];
  for (let i = 0; i < MEMORY_INITIAL_SMALL_COUNT; i++) {
    blocks.push(createEmptyBlock());
  }
  return {
    version: 1,
    jumble: { id: JUMBLE_ID, body: "" },
    blocks,
  };
}

function normalizeMemory(data) {
  if (!data || typeof data !== "object") return null;
  const jumbleBody =
    data.jumble && typeof data.jumble.body === "string" ? data.jumble.body : "";
  if (!Array.isArray(data.blocks)) return null;
  const blocks = [];
  for (const block of data.blocks) {
    if (!block || typeof block !== "object") return null;
    blocks.push({
      id:
        typeof block.id === "string" && block.id ? block.id : generateId(),
      title: typeof block.title === "string" ? block.title : "",
      body: typeof block.body === "string" ? block.body : "",
    });
  }
  return {
    version: 1,
    jumble: { id: JUMBLE_ID, body: jumbleBody },
    blocks,
  };
}

function saveMemory(data) {
  localStorage.setItem(STORAGE_MEMORY, JSON.stringify(data));
}

function loadMemory() {
  try {
    const raw = localStorage.getItem(STORAGE_MEMORY);
    if (!raw) {
      const fresh = createDefaultMemory();
      saveMemory(fresh);
      return fresh;
    }
    const normalized = normalizeMemory(JSON.parse(raw));
    if (!normalized) {
      const fresh = createDefaultMemory();
      saveMemory(fresh);
      return fresh;
    }
    return normalized;
  } catch (e) {
    console.warn("記憶メモリ読み込み失敗:", e);
    const fresh = createDefaultMemory();
    saveMemory(fresh);
    return fresh;
  }
}

function saveItems(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
}

function saveMemo(text) {
  localStorage.setItem(STORAGE_MEMO, text);
}

function loadLastMode() {
  try {
    const saved = localStorage.getItem(STORAGE_LAST_MODE);
    if (APP_MODES.includes(saved)) return saved;
  } catch (e) {
    console.warn("画面の読み込み失敗:", e);
  }
  return "memo";
}

function saveLastMode(next) {
  try {
    localStorage.setItem(STORAGE_LAST_MODE, next);
  } catch (e) {
    console.warn("画面の保存失敗:", e);
  }
}

function saveCurrent() {
  if (mode === "shopping") {
    saveItems(STORAGE_SHOPPING, shoppingItems);
  }
}

// ===== 画面切り替え =====
function switchMode(next) {
  if (!APP_MODES.includes(next)) next = "memo";
  document.documentElement.removeAttribute("data-boot-mode");
  if (isListening) stopListening();

  mode = next;
  saveLastMode(next);
  document.body.dataset.mode = next;

  shoppingView.classList.toggle("hidden", next !== "shopping");
  memoryView.classList.toggle("hidden", next !== "memory");
  memoView.classList.toggle("hidden", next !== "memo");

  tabShopping.classList.toggle("active", next === "shopping");
  tabMemory.classList.toggle("active", next === "memory");
  tabMemo.classList.toggle("active", next === "memo");
  tabShopping.setAttribute("aria-selected", String(next === "shopping"));
  tabMemory.setAttribute("aria-selected", String(next === "memory"));
  tabMemo.setAttribute("aria-selected", String(next === "memo"));

  if (next === "shopping") {
    pageTitle.textContent = "買い物リスト";
    itemInput.placeholder = "買うものを入力";
    setThemeColor("#e8f4fc");
    itemInput.value = "";
    render();
  } else if (next === "memory") {
    pageTitle.textContent = "記憶メモリ";
    setThemeColor("#efe8fc");
    renderMemoryList();
  } else {
    pageTitle.textContent = "メモ";
    setThemeColor("#fff8e8");
  }

  hideVoiceStatus();
}

function setThemeColor(color) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
}

// ===== 描画 =====
function render() {
  if (mode === "shopping") {
    renderList(shoppingListEl, shoppingEmpty, shoppingItems, "購入済み");
    clearShoppingBtn.disabled = !shoppingItems.some((i) => i.done);
  }
}

function renderList(ul, emptyEl, items, doneLabel) {
  ul.innerHTML = "";
  emptyEl.classList.toggle("visible", items.length === 0);

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "item" + (item.done ? " done" : "");
    li.dataset.id = item.id;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "item-check";
    check.checked = item.done;
    check.setAttribute("aria-label", doneLabel);
    check.addEventListener("change", () => toggleDone(item.id));

    const text = document.createElement("span");
    text.className = "item-text";
    text.textContent = item.text;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-delete";
    del.textContent = "削除";
    del.addEventListener("click", () => deleteOne(item.id));

    li.append(check, text, del);
    ul.appendChild(li);
  });
}

function compactPreview(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function renderMemoryList() {
  memoryGrid.innerHTML = "";
  memoryData.blocks.forEach((block) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "memory-card-small";
    btn.dataset.id = block.id;

    const title = document.createElement("span");
    title.className = "memory-card-title";
    const titleText = block.title.trim();
    if (titleText) {
      title.textContent = titleText;
    } else {
      title.textContent = "タイトルを入力";
      title.classList.add("memory-card-empty");
    }

    btn.appendChild(title);

    const bodyPreview = compactPreview(block.body);
    if (bodyPreview) {
      const preview = document.createElement("span");
      preview.className = "memory-card-preview";
      preview.textContent = bodyPreview;
      btn.appendChild(preview);
    }

    btn.addEventListener("click", () => openMemoryDetail(block.id));
    memoryGrid.appendChild(btn);
  });
}

function showMemoryDetail(id) {
  const block = memoryData.blocks.find((b) => b.id === id);
  if (!block) return;
  currentDetailId = block.id;
  memoryDetailTitle.value = block.title;
  memoryDetailBody.value = block.body;

  memoryDetailOpen = true;
  document.body.classList.add("memory-detail-open");
  memoryDetail.classList.remove("hidden");
}

function hideMemoryDetail() {
  memoryDetailOpen = false;
  currentDetailId = null;
  memoryDetail.classList.add("hidden");
  document.body.classList.remove("memory-detail-open");
  if (mode === "memory") renderMemoryList();
}

function openMemoryDetail(id) {
  if (memoryDetailOpen) {
    showMemoryDetail(id);
    return;
  }
  history.pushState({ memoryDetail: id }, "");
  showMemoryDetail(id);
}

function requestCloseMemoryDetail() {
  if (!memoryDetailOpen) return;
  history.back();
}

function saveMemoryDetailFromForm() {
  if (!memoryDetailOpen || !currentDetailId) return;

  const block = memoryData.blocks.find((b) => b.id === currentDetailId);
  if (!block) return;
  block.title = memoryDetailTitle.value;
  block.body = memoryDetailBody.value;
  saveMemory(memoryData);
}

function focusMemoryEditor() {
  if (!memoryDetailOpen) return;
  if (!memoryDetailTitle.value.trim()) {
    memoryDetailTitle.focus();
  } else {
    memoryDetailBody.focus();
  }
}

function addMemoryBlock() {
  if (mode !== "memory" || memoryDetailOpen) return;
  memoryData.blocks.push(createEmptyBlock());
  saveMemory(memoryData);
  renderMemoryList();
}

// ===== 操作 =====
function addItem(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (mode !== "shopping") return;

  const item = {
    id: generateId(),
    text: trimmed,
    done: false,
  };

  shoppingItems.unshift(item);
  saveItems(STORAGE_SHOPPING, shoppingItems);
  render();
}

function toggleDone(id) {
  if (mode !== "shopping") return;
  const target = shoppingItems.find((i) => i.id === id);
  if (!target) return;
  target.done = !target.done;
  saveCurrent();
  render();
}

function deleteOne(id) {
  if (mode !== "shopping") return;
  if (!confirm("この項目を削除しますか？")) return;

  shoppingItems = shoppingItems.filter((i) => i.id !== id);
  saveItems(STORAGE_SHOPPING, shoppingItems);
  render();
}

function clearDone() {
  if (mode !== "shopping") return;
  if (!confirm("購入済みの項目をすべて削除しますか？")) return;

  shoppingItems = shoppingItems.filter((i) => !i.done);
  saveItems(STORAGE_SHOPPING, shoppingItems);
  render();
}

function clearMemo() {
  if (!memoText.value.trim()) return;
  if (!confirm("メモをすべて消去しますか？")) return;
  memoText.value = "";
  memoContent = "";
  saveMemo("");
}

// ===== バックアップ =====
function formatDateForFilename(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function showBackupMessage(message, type) {
  backupMessage.textContent = message;
  backupMessage.classList.remove("hidden", "error", "success");
  if (type === "error") backupMessage.classList.add("error");
  if (type === "success") backupMessage.classList.add("success");
}

function hideBackupMessage() {
  backupMessage.classList.add("hidden");
  backupMessage.classList.remove("error", "success");
  backupMessage.textContent = "";
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return null;
  const result = [];
  for (const item of items) {
    if (!item || typeof item !== "object") return null;
    if (typeof item.text !== "string") return null;
    result.push({
      id:
        typeof item.id === "string" && item.id
          ? item.id
          : generateId(),
      text: item.text,
      done: Boolean(item.done),
    });
  }
  return result;
}

function validateBackupData(data) {
  if (!data || typeof data !== "object") {
    return { ok: false, message: "このファイルはバックアップとして使えません。" };
  }
  if (typeof data.version !== "number") {
    return {
      ok: false,
      message: "対応していないバックアップ形式です。このアプリで書き出したファイルを選んでください。",
    };
  }
  if (typeof data.memo !== "string") {
    return {
      ok: false,
      message: "メモのデータ形式が正しくありません。",
    };
  }
  const shopping = normalizeItems(data.shopping);
  if (shopping === null) {
    return {
      ok: false,
      message: "ファイルの内容が壊れているか、形式が正しくありません。",
    };
  }

  if (data.version === BACKUP_VERSION) {
    if (!("memory" in data) || !("exportedAt" in data)) {
      return {
        ok: false,
        message: "このアプリで作ったバックアップではありません。買い物・記憶メモリ・メモが入ったファイルを選んでください。",
      };
    }
    const memory = normalizeMemory(data.memory);
    if (memory === null) {
      return {
        ok: false,
        message: "記憶メモリのデータ形式が正しくありません。",
      };
    }
    return {
      ok: true,
      kind: "v2",
      shopping,
      memory,
      memo: data.memo,
    };
  }

  if (data.version === BACKUP_VERSION_LEGACY) {
    if (!("todo" in data)) {
      return {
        ok: false,
        message: "このアプリで作ったバックアップではありません。買い物・TODO・メモが入ったファイルを選んでください。",
      };
    }
    const todo = normalizeItems(data.todo);
    if (todo === null) {
      return {
        ok: false,
        message: "ファイルの内容が壊れているか、形式が正しくありません。",
      };
    }
    return {
      ok: true,
      kind: "v1",
      shopping,
      todo,
      memo: data.memo,
    };
  }

  return {
    ok: false,
    message: "対応していないバックアップ形式です。このアプリで書き出したファイルを選んでください。",
  };
}

function exportBackup() {
  hideBackupMessage();
  const now = new Date();
  const payload = {
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    shopping: shoppingItems,
    memory: memoryData,
    memo: memoText.value,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const filename = `memo-app-backup-${formatDateForFilename(now)}.json`;
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showBackupMessage(`「${filename}」を書き出しました。`, "success");
}

function isMemoryUnused(data) {
  if (!data || !data.jumble || !Array.isArray(data.blocks)) return true;
  if ((data.jumble.body || "").trim()) return false;
  return data.blocks.every(
    (block) => !(block.title || "").trim() && !(block.body || "").trim()
  );
}

function hasExistingUserData() {
  if (shoppingItems.length > 0) return true;
  if ((memoText.value || "").trim()) return true;
  if (!isMemoryUnused(memoryData)) return true;
  return false;
}

function saveTempBackup() {
  const snapshot = {
    shopping: shoppingItems,
    todo: todoItems,
    memo: memoText.value,
    memory: memoryData,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_TEMP_BACKUP, JSON.stringify(snapshot));
}

function refreshAfterImport() {
  renderList(shoppingListEl, shoppingEmpty, shoppingItems, "購入済み");
  clearShoppingBtn.disabled = !shoppingItems.some((i) => i.done);
  if (mode === "memory") renderMemoryList();
}

function applyV1Data(shopping, todo, memo) {
  shoppingItems = shopping;
  todoItems = todo;
  memoContent = memo;
  memoText.value = memo;

  saveItems(STORAGE_SHOPPING, shoppingItems);
  saveItems(STORAGE_TODO, todoItems);
  saveMemo(memoContent);
  refreshAfterImport();
}

function applyV2Data(shopping, memory, memo) {
  shoppingItems = shopping;
  memoryData = memory;
  memoContent = memo;
  memoText.value = memo;

  saveItems(STORAGE_SHOPPING, shoppingItems);
  saveMemory(memoryData);
  saveMemo(memoContent);
  refreshAfterImport();
}

function restoreFromTempBackup(kind) {
  try {
    const raw = localStorage.getItem(STORAGE_TEMP_BACKUP);
    if (!raw) return false;
    const snapshot = JSON.parse(raw);
    const shopping = normalizeItems(snapshot.shopping);
    const memoOk = typeof snapshot.memo === "string";
    if (shopping === null || !memoOk) return false;

    if (kind === "v2") {
      const memory = normalizeMemory(snapshot.memory);
      if (memory === null) return false;
      applyV2Data(shopping, memory, snapshot.memo);
      return true;
    }

    const todo = normalizeItems(snapshot.todo);
    if (todo === null) return false;
    applyV1Data(shopping, todo, snapshot.memo);
    return true;
  } catch (e) {
    console.warn("一時バックアップ復元失敗:", e);
    return false;
  }
}

function applyValidatedBackup(validated) {
  saveTempBackup();
  try {
    if (validated.kind === "v2") {
      applyV2Data(validated.shopping, validated.memory, validated.memo);
    } else {
      applyV1Data(validated.shopping, validated.todo, validated.memo);
    }
    showBackupMessage("バックアップを読み込みました。", "success");
    return true;
  } catch (e) {
    console.warn("バックアップ読み込み失敗:", e);
    restoreFromTempBackup(validated.kind);
    showBackupMessage(
      "読み込みに失敗したため、現在のデータは変更していません。",
      "error"
    );
    return false;
  }
}

function closeRestoreDialog() {
  pendingRestore = null;
  restoreConfirmCheck.checked = false;
  restoreContinue.disabled = true;
  if (restoreDialog.open) restoreDialog.close();
}

function openRestoreDialog(validated) {
  pendingRestore = validated;
  restoreConfirmCheck.checked = false;
  restoreContinue.disabled = true;
  restoreDialog.showModal();
}

function bindDialogBackdropClose(dialog, onClose) {
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) onClose();
  });
}

function importBackupFromFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(String(reader.result));
    } catch (e) {
      showBackupMessage(
        "JSONとして読み込めませんでした。このアプリで書き出したバックアップファイルを選んでください。",
        "error"
      );
      return;
    }

    const validated = validateBackupData(parsed);
    if (!validated.ok) {
      showBackupMessage(validated.message, "error");
      return;
    }

    if (hasExistingUserData()) {
      openRestoreDialog(validated);
      return;
    }

    applyValidatedBackup(validated);
  };

  reader.onerror = () => {
    showBackupMessage("ファイルの読み取りに失敗しました。もう一度お試しください。", "error");
  };

  reader.readAsText(file, "UTF-8");
}

// ===== 音声入力 =====
function initSpeech() {
  if (!SpeechRecognition) {
    speechSupported = false;
    return;
  }

  speechSupported = true;
  recognition = new SpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    updateListeningUI(true);
    showVoiceStatus("聞き取り中…", false);
  };

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript.trim();
    if (!text) return;

    if (mode === "memo") {
      const current = memoText.value;
      memoText.value = current ? current + text : text;
      memoContent = memoText.value;
      saveMemo(memoContent);
    } else if (mode === "shopping") {
      itemInput.value = text;
      itemInput.focus();
    }
  };

  recognition.onerror = (event) => {
    let message = "音声入力でエラーが発生しました。";
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      message =
        "マイクの使用が許可されていません。ブラウザの設定でマイクを許可してから、もう一度お試しください。";
    } else if (event.error === "no-speech") {
      message = "声が聞き取れませんでした。もう一度お試しください。";
    } else if (event.error === "network") {
      message = "音声認識にネットワーク接続が必要です。接続を確認してください。";
    }
    showVoiceStatus(message, true);
    stopListening();
  };

  recognition.onend = () => {
    stopListening();
  };
}

function getActiveVoiceStatusEl() {
  return mode === "memo" ? voiceStatusMemo : voiceStatus;
}

function showVoiceStatus(message, isError) {
  const el = getActiveVoiceStatusEl();
  el.textContent = message;
  el.classList.remove("hidden", "error");
  if (isError) el.classList.add("error");
}

function hideVoiceStatus() {
  voiceStatus.classList.add("hidden");
  voiceStatus.classList.remove("error");
  voiceStatusMemo.classList.add("hidden");
  voiceStatusMemo.classList.remove("error");
}

function updateListeningUI(listening) {
  voiceBtnList.classList.toggle("listening", listening && mode !== "memo");
  voiceBtnMemo.classList.toggle("listening", listening && mode === "memo");
}

function stopListening() {
  isListening = false;
  updateListeningUI(false);
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {
      // 既に停止している場合は無視
    }
  }
}

function toggleVoiceInput() {
  if (!speechSupported) {
    showVoiceStatus(
      "このブラウザは音声入力に対応していません。Chromeなど別のブラウザをお試しください。",
      true
    );
    return;
  }

  if (isListening) {
    stopListening();
    hideVoiceStatus();
    return;
  }

  hideVoiceStatus();
  try {
    recognition.start();
  } catch (e) {
    showVoiceStatus("音声入力を開始できませんでした。少し待ってからもう一度お試しください。", true);
  }
}

// ===== Service Worker =====
async function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (isDevHost) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      await reg.unregister();
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("shopping-todo-"))
          .map((key) => caches.delete(key))
      );
    }
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((err) => {
      console.warn("Service Worker 登録失敗:", err);
    });
  });
}

// ===== イベント =====
addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addItem(itemInput.value);
  itemInput.value = "";
  itemInput.focus();
});

tabShopping.addEventListener("click", () => switchMode("shopping"));
tabMemory.addEventListener("click", () => switchMode("memory"));
tabMemo.addEventListener("click", () => switchMode("memo"));
clearShoppingBtn.addEventListener("click", clearDone);
clearMemoBtn.addEventListener("click", clearMemo);
memoryAddBtn.addEventListener("click", addMemoryBlock);
memoryDetailBack.addEventListener("click", requestCloseMemoryDetail);
memoryDetailEdit.addEventListener("click", focusMemoryEditor);
memoryDetailTitle.addEventListener("input", saveMemoryDetailFromForm);
memoryDetailBody.addEventListener("input", saveMemoryDetailFromForm);

window.addEventListener("popstate", () => {
  if (memoryDetailOpen) hideMemoryDetail();
});

memoText.value = memoContent;
memoText.addEventListener("input", () => {
  memoContent = memoText.value;
  saveMemo(memoContent);
});

voiceBtnList.addEventListener("click", toggleVoiceInput);
voiceBtnMemo.addEventListener("click", toggleVoiceInput);

backupExportBtn.addEventListener("click", exportBackup);
backupImportBtn.addEventListener("click", () => {
  hideBackupMessage();
  backupFileInput.value = "";
  backupFileInput.click();
});
backupFileInput.addEventListener("change", () => {
  const file = backupFileInput.files && backupFileInput.files[0];
  if (!file) return;
  importBackupFromFile(file);
});

handoverBtn.addEventListener("click", () => handoverDialog.showModal());
handoverCloseX.addEventListener("click", () => handoverDialog.close());
handoverClose.addEventListener("click", () => handoverDialog.close());
handoverExport.addEventListener("click", exportBackup);
bindDialogBackdropClose(handoverDialog, () => handoverDialog.close());

restoreCloseX.addEventListener("click", closeRestoreDialog);
restoreCancel.addEventListener("click", closeRestoreDialog);
restoreExport.addEventListener("click", exportBackup);
restoreConfirmCheck.addEventListener("change", () => {
  restoreContinue.disabled = !restoreConfirmCheck.checked;
});
restoreContinue.addEventListener("click", () => {
  if (!pendingRestore || !restoreConfirmCheck.checked) return;
  const validated = pendingRestore;
  closeRestoreDialog();
  applyValidatedBackup(validated);
});
restoreDialog.addEventListener("cancel", () => {
  pendingRestore = null;
  restoreConfirmCheck.checked = false;
  restoreContinue.disabled = true;
});
bindDialogBackdropClose(restoreDialog, closeRestoreDialog);

// ===== 起動 =====
switchMode(loadLastMode());
initSpeech();
setupServiceWorker();
