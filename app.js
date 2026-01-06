const STORAGE_KEY = "journals_v1";

const homePanel = document.getElementById("homePanel");
const editorPanel = document.getElementById("editorPanel");
const listEl = document.getElementById("list");
const headerTitle = document.getElementById("headerTitle");

const homeBtn = document.getElementById("homeBtn");
const newJournalBtn = document.getElementById("newJournalBtn");
const newEntryBtn = document.getElementById("newEntryBtn");
const saveBtn = document.getElementById("saveBtn");
const deleteEntryBtn = document.getElementById("deleteEntryBtn");
const renameJournalBtn = document.getElementById("renameJournalBtn");

const titleInput = document.getElementById("titleInput");
const dateInput = document.getElementById("dateInput");
const bodyInput = document.getElementById("bodyInput");
const statusText = document.getElementById("statusText");

// Modal
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalInput = document.getElementById("modalInput");
const modalOk = document.getElementById("modalOk");
const modalCancel = document.getElementById("modalCancel");

let data = load();
let activeJournal = null;
let activeEntry = null;

/* ===== Modal helper ===== */
function askText(title, initial = "") {
  return new Promise(resolve => {
    modalTitle.textContent = title;
    modalInput.value = initial;
    modalOverlay.classList.remove("hidden");
    modalInput.focus();

    modalOk.onclick = () => close(modalInput.value);
    modalCancel.onclick = () => close(null);
    modalOverlay.onclick = e => e.target === modalOverlay && close(null);

    function close(val) {
      modalOverlay.classList.add("hidden");
      modalOk.onclick = modalCancel.onclick = null;
      resolve(val);
    }
  });
}

/* ===== Init ===== */
renderHome();

/* ===== Buttons ===== */
homeBtn.onclick = () => {
  activeJournal = null;
  activeEntry = null;
  renderHome();
};

newJournalBtn.onclick = async () => {
  const name = await askText("New journal", "new journal");
  if (!name) return;
  data.journals.push({ id: id(), title: name, entries: [] });
  save();
  renderHome();
};

renameJournalBtn.onclick = async () => {
  if (!activeJournal) return;
  const j = getJournal();
  const name = await askText("Rename journal", j.title);
  if (!name) return;
  j.title = name;
  save();
  renderJournal();
};

newEntryBtn.onclick = () => {
  if (!activeJournal) return;
  activeEntry = null;
  openEditor({ title: "", date: "", body: "" });
};

saveBtn.onclick = () => {
  if (!activeJournal) return;
  const j = getJournal();

  if (!activeEntry) {
    const e = {
      id: id(),
      title: titleInput.value,
      date: dateInput.value,
      body: bodyInput.value
    };
    j.entries.unshift(e);
    activeEntry = e.id;
  } else {
    const e = j.entries.find(x => x.id === activeEntry);
    e.title = titleInput.value;
    e.date = dateInput.value;
    e.body = bodyInput.value;
  }

  save();
  renderJournal();
  statusText.textContent = "Saved.";
};

deleteEntryBtn.onclick = () => {
  if (!activeJournal || !activeEntry) return;
  const j = getJournal();
  j.entries = j.entries.filter(e => e.id !== activeEntry);
  activeEntry = null;
  save();
  renderJournal();
};

/* ===== Render ===== */
function renderHome() {
  homePanel.classList.remove("hidden");
  editorPanel.classList.add("hidden");
  headerTitle.textContent = "my journal";
  listEl.innerHTML = "";

  data.journals.forEach(j => {
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = j.title;
    div.onclick = () => {
      activeJournal = j.id;
      activeEntry = null;
      renderJournal();
    };
    listEl.appendChild(div);
  });
}

function renderJournal() {
  const j = getJournal();
  homePanel.classList.add("hidden");
  editorPanel.classList.remove("hidden");
  headerTitle.textContent = j.title;
  listEl.innerHTML = "";

  j.entries.forEach(e => {
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = e.title || "Untitled";
    div.onclick = () => {
      activeEntry = e.id;
      openEditor(e);
    };
    listEl.appendChild(div);
  });

  newEntryBtn.click();
}

function openEditor(e) {
  titleInput.value = e.title || "";
  dateInput.value = e.date || "";
  bodyInput.value = e.body || "";
  statusText.textContent = "Editing.";
}

/* ===== Storage ===== */
function getJournal() {
  return data.journals.find(j => j.id === activeJournal);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function load() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { journals: [] };
}

function id() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
