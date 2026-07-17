// ===== 定数・キー =====
const STORAGE_SHOPPING = "shoppingItems";
const STORAGE_TODO = "todoItems";
const STORAGE_MEMO = "memoText";
const STORAGE_TEMP_BACKUP = "backupRestoreTemp";
const BACKUP_VERSION = 1;

// ===== DOM参照 =====
const pageTitle = document.getElementById("page-title");
const addForm = document.getElementById("add-form");
const itemInput = document.getElementById("item-input");
const shoppingView = document.getElementById("shopping-view");
const todoView = document.getElementById("todo-view");
const memoView = document.getElementById("memo-view");
const shoppingListEl = document.getElementById("shopping-list");
const todoListEl = document.getElementById("todo-list");
const shoppingEmpty = document.getElementById("shopping-empty");
const todoEmpty = document.getElementById("todo-empty");
const clearShoppingBtn = document.getElementById("clear-shopping-done");
const clearTodoBtn = document.getElementById("clear-todo-done");
const memoText = document.getElementById("memo-text");
const clearMemoBtn = document.getElementById("clear-memo");
const tabShopping = document.getElementById("tab-shopping");
const tabTodo = document.getElementById("tab-todo");
const tabMemo = document.getElementById("tab-memo");
const voiceBtnList = document.getElementById("voice-btn-list");
const voiceBtnMemo = document.getElementById("voice-btn-memo");
const voiceStatus = document.getElementById("voice-status");
const voiceStatusMemo = document.getElementById("voice-status-memo");
const backupExportBtn = document.getElementById("backup-export");
const backupImportBtn = document.getElementById("backup-import");
const backupFileInput = document.getElementById("backup-file");
const backupMessage = document.getElementById("backup-message");

// ===== 状態 =====
let mode = "shopping";
let shoppingItems = loadItems(STORAGE_SHOPPING);
let todoItems = loadItems(STORAGE_TODO);
let memoContent = loadMemo();
let recognition = null;
let isListening = false;
let speechSupported = false;

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const isDevHost =
  location.hostname === "localhost" || location.hostname === "127.0.0.1";

// ===== localStorage =====
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

function saveItems(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
}

function saveMemo(text) {
  localStorage.setItem(STORAGE_MEMO, text);
}

function saveCurrent() {
  if (mode === "shopping") {
    saveItems(STORAGE_SHOPPING, shoppingItems);
  } else if (mode === "todo") {
    saveItems(STORAGE_TODO, todoItems);
  }
}

// ===== 画面切り替え =====
function switchMode(next) {
  if (isListening) stopListening();

  mode = next;
  document.body.dataset.mode = next;

  shoppingView.classList.toggle("hidden", next !== "shopping");
  todoView.classList.toggle("hidden", next !== "todo");
  memoView.classList.toggle("hidden", next !== "memo");

  tabShopping.classList.toggle("active", next === "shopping");
  tabTodo.classList.toggle("active", next === "todo");
  tabMemo.classList.toggle("active", next === "memo");
  tabShopping.setAttribute("aria-selected", String(next === "shopping"));
  tabTodo.setAttribute("aria-selected", String(next === "todo"));
  tabMemo.setAttribute("aria-selected", String(next === "memo"));

  if (next === "shopping") {
    pageTitle.textContent = "買い物リスト";
    itemInput.placeholder = "買うものを入力";
    setThemeColor("#e8f4fc");
  } else if (next === "todo") {
    pageTitle.textContent = "TODOリスト";
    itemInput.placeholder = "やることを入力";
    setThemeColor("#fce8f0");
  } else {
    pageTitle.textContent = "メモ";
    setThemeColor("#fff8e8");
  }

  if (next !== "memo") {
    itemInput.value = "";
    render();
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
  } else if (mode === "todo") {
    renderList(todoListEl, todoEmpty, todoItems, "完了");
    clearTodoBtn.disabled = !todoItems.some((i) => i.done);
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

// ===== 操作 =====
function addItem(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const item = {
    id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 7),
    text: trimmed,
    done: false,
  };

  if (mode === "shopping") {
    shoppingItems.unshift(item);
    saveItems(STORAGE_SHOPPING, shoppingItems);
  } else {
    todoItems.unshift(item);
    saveItems(STORAGE_TODO, todoItems);
  }
  render();
}

function toggleDone(id) {
  const items = mode === "shopping" ? shoppingItems : todoItems;
  const target = items.find((i) => i.id === id);
  if (!target) return;
  target.done = !target.done;
  saveCurrent();
  render();
}

function deleteOne(id) {
  if (!confirm("この項目を削除しますか？")) return;

  if (mode === "shopping") {
    shoppingItems = shoppingItems.filter((i) => i.id !== id);
    saveItems(STORAGE_SHOPPING, shoppingItems);
  } else {
    todoItems = todoItems.filter((i) => i.id !== id);
    saveItems(STORAGE_TODO, todoItems);
  }
  render();
}

function clearDone() {
  const label =
    mode === "shopping"
      ? "購入済みの項目をすべて削除しますか？"
      : "完了済みの項目をすべて削除しますか？";
  if (!confirm(label)) return;

  if (mode === "shopping") {
    shoppingItems = shoppingItems.filter((i) => !i.done);
    saveItems(STORAGE_SHOPPING, shoppingItems);
  } else {
    todoItems = todoItems.filter((i) => !i.done);
    saveItems(STORAGE_TODO, todoItems);
  }
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
          : String(Date.now()) + "-" + Math.random().toString(36).slice(2, 7),
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
  if (!("shopping" in data) || !("todo" in data) || !("memo" in data)) {
    return {
      ok: false,
      message: "このアプリで作ったバックアップではありません。買い物・TODO・メモが入ったファイルを選んでください。",
    };
  }
  if (typeof data.version !== "number" || data.version !== BACKUP_VERSION) {
    return {
      ok: false,
      message: "対応していないバックアップ形式です。このアプリで書き出したファイルを選んでください。",
    };
  }
  const shopping = normalizeItems(data.shopping);
  const todo = normalizeItems(data.todo);
  if (shopping === null || todo === null) {
    return {
      ok: false,
      message: "ファイルの内容が壊れているか、形式が正しくありません。",
    };
  }
  if (typeof data.memo !== "string") {
    return {
      ok: false,
      message: "メモのデータ形式が正しくありません。",
    };
  }
  return {
    ok: true,
    shopping,
    todo,
    memo: data.memo,
  };
}

function exportBackup() {
  hideBackupMessage();
  const now = new Date();
  const payload = {
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    shopping: shoppingItems,
    todo: todoItems,
    memo: memoText.value,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const filename = `shopping-todo-backup-${formatDateForFilename(now)}.json`;
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

function saveTempBackup() {
  const snapshot = {
    shopping: shoppingItems,
    todo: todoItems,
    memo: memoText.value,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_TEMP_BACKUP, JSON.stringify(snapshot));
}

function applyImportedData(shopping, todo, memo) {
  shoppingItems = shopping;
  todoItems = todo;
  memoContent = memo;
  memoText.value = memo;

  saveItems(STORAGE_SHOPPING, shoppingItems);
  saveItems(STORAGE_TODO, todoItems);
  saveMemo(memoContent);

  // 買い物・TODO一覧を更新（メモ画面でも裏で更新）
  renderList(shoppingListEl, shoppingEmpty, shoppingItems, "購入済み");
  clearShoppingBtn.disabled = !shoppingItems.some((i) => i.done);
  renderList(todoListEl, todoEmpty, todoItems, "完了");
  clearTodoBtn.disabled = !todoItems.some((i) => i.done);
}

function restoreFromTempBackup() {
  try {
    const raw = localStorage.getItem(STORAGE_TEMP_BACKUP);
    if (!raw) return false;
    const snapshot = JSON.parse(raw);
    const shopping = normalizeItems(snapshot.shopping);
    const todo = normalizeItems(snapshot.todo);
    if (shopping === null || todo === null || typeof snapshot.memo !== "string") {
      return false;
    }
    applyImportedData(shopping, todo, snapshot.memo);
    return true;
  } catch (e) {
    console.warn("一時バックアップ復元失敗:", e);
    return false;
  }
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

    const ok = confirm(
      "現在の買い物・TODO・メモを、バックアップの内容で置き換えます。よろしいですか？"
    );
    if (!ok) {
      showBackupMessage("読み込みをキャンセルしました。", "success");
      return;
    }

    try {
      // 読み込み直前に現在データを一時保存
      saveTempBackup();
      applyImportedData(validated.shopping, validated.todo, validated.memo);
      showBackupMessage("バックアップを読み込みました。", "success");
    } catch (e) {
      console.warn("バックアップ読み込み失敗:", e);
      restoreFromTempBackup();
      showBackupMessage(
        "読み込みに失敗したため、現在のデータは変更していません。",
        "error"
      );
    }
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
    } else {
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
tabTodo.addEventListener("click", () => switchMode("todo"));
tabMemo.addEventListener("click", () => switchMode("memo"));
clearShoppingBtn.addEventListener("click", clearDone);
clearTodoBtn.addEventListener("click", clearDone);
clearMemoBtn.addEventListener("click", clearMemo);

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

// ===== 起動 =====
document.body.dataset.mode = "shopping";
render();
initSpeech();
setupServiceWorker();
