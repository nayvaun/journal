// ===== Simple multi-journal system (NO fancy stuff yet) =====

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
const searchInput = document.getElementById("searchInput");

let data = load();
let activeJournal = null;
let activeEntry = null;

// ---------- INIT ----------
renderHome();

// ---------- BUTTONS ----------
homeBtn.onclick = () => {
  activeJournal = null;
  activeEntry = null;
  renderHome();
};

newJournalBtn.onclick = () => {
  const name = prompt("Journal name?");
  if (!name) return;
  data.journals.push({
    id: id(),
    title: name,
    entries: []
  });
  save();
  renderHome();
};

renameJournalBtn.onclick = () => {
  if (!activeJournal) return;
  const j = getJournal();
  const name = prompt("Rename journal:", j.title);
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
    const entry = {
      id: id(),
      created: Date.now(),
      title: titleInput.value,
      date: dateInput.value,
      body: bodyInput.value
    };
    j.entries.unshift(entry);
    activeEntry = entry.id;
  } else {
    const e = j.entries.find(e => e.id === activeEntry);
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

// ---------- RENDER ----------
function renderHome() {
  homePanel.style.display = "block";
  editorPanel.style.display = "none";
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
  homePanel.style.display = "none";
  editorPanel.style.display = "block";
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

// ---------- DATA ----------
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
