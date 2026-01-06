const STORAGE_KEY = "journals_v2_no_popups";

const homePanel = document.getElementById("homePanel");
const editorPanel = document.getElementById("editorPanel");
const listEl = document.getElementById("list");

const homeBtn = document.getElementById("homeBtn");
const newJournalBtn = document.getElementById("newJournalBtn");
const newEntryBtn = document.getElementById("newEntryBtn");
const saveBtn = document.getElementById("saveBtn");
const deleteEntryBtn = document.getElementById("deleteEntryBtn");

const journalTitleInput = document.getElementById("journalTitleInput");
const titleInput = document.getElementById("titleInput");
const dateInput = document.getElementById("dateInput");
const bodyInput = document.getElementById("bodyInput");
const statusText = document.getElementById("statusText");
const searchInput = document.getElementById("searchInput");

let data = load();
let activeJournalId = null;
let activeEntryId = null;

// Init
renderHome();

/* ===== Buttons ===== */

homeBtn.onclick = () => {
  activeJournalId = null;
  activeEntryId = null;
  renderHome();
};

newJournalBtn.onclick = () => {
  const j = {
    id: id(),
    title: "Untitled journal",
    entries: []
  };
  data.journals.unshift(j);
  save();
  openJournal(j.id);
};

newEntryBtn.onclick = () => {
  if (!activeJournalId) return;
  activeEntryId = null;
  openEditor({ title: "", date: "", body: "" });
  statusText.textContent = "New entry (not saved yet).";
};

saveBtn.onclick = () => {
  if (!activeJournalId) return;
  const j = getJournal();
  if (!j) return;

  // Save journal title live
  j.title = journalTitleInput.value.trim() || "Untitled journal";

  if (!activeEntryId) {
    const e = {
      id: id(),
      created: Date.now(),
      title: titleInput.value,
      date: dateInput.value,
      body: bodyInput.value
    };
    j.entries.unshift(e); // newest at top, oldest at bottom
    activeEntryId = e.id;
  } else {
    const e = j.entries.find(x => x.id === activeEntryId);
    if (!e) return;
    e.title = titleInput.value;
    e.date = dateInput.value;
    e.body = bodyInput.value;
  }

  save();
  renderJournal();
  statusText.textContent = "Saved.";
};

deleteEntryBtn.onclick = () => {
  if (!activeJournalId || !activeEntryId) return;
  const j = getJournal();
  j.entries = j.entries.filter(e => e.id !== activeEntryId);
  activeEntryId = null;
  save();
  renderJournal();
  statusText.textContent = "Deleted.";
};

/* ===== Live update journal title ===== */
journalTitleInput.addEventListener("input", () => {
  if (!activeJournalId) return;
  const j = getJournal();
  if (!j) return;
  j.title = journalTitleInput.value.trim() || "Untitled journal";
  save();
  renderList(); // update sidebar label
});

/* ===== Search ===== */
searchInput.addEventListener("input", () => {
  renderList();
});

/* ===== Render ===== */

function renderHome() {
  homePanel.classList.remove("hidden");
  editorPanel.classList.add("hidden");
  listEl.innerHTML = "";
  renderList();
}

function openJournal(journalId) {
  activeJournalId = journalId;
  activeEntryId = null;
  renderJournal();
}

function renderJournal() {
  const j = getJournal();
  if (!j) return;

  homePanel.classList.add("hidden");
  editorPanel.classList.remove("hidden");

  journalTitleInput.value = j.title || "Untitled journal";

  // Sidebar list is now entries for this journal
  renderList();

  // You wanted: opening a journal starts on a blank page
  newEntryBtn.click();
}

function renderList() {
  listEl.innerHTML = "";
  const q = (searchInput.value || "").toLowerCase().trim();

  if (!activeJournalId) {
    // Home: show journals
    const journals = data.journals;
    const filtered = q ? journals.filter(j => (j.title || "").toLowerCase().includes(q)) : journals;

    filtered.forEach(j => {
      const div = document.createElement("div");
      div.className = "item";
      div.textContent = j.title || "Untitled journal";
      div.onclick = () => openJournal(j.id);
      listEl.appendChild(div);
    });

    return;
  }

  // Inside journal: show entries (newest at top)
  const j = getJournal();
  const entries = j.entries;

  const filtered = q
    ? entries.filter(e =>
        (e.title || "").toLowerCase().includes(q) ||
        (e.date || "").toLowerCase().includes(q) ||
        (e.body || "").toLowerCase().includes(q)
      )
    : entries;

  filtered.forEach(e => {
    const div = document.createElement("div");
    div.className = "item" + (e.id === activeEntryId ? " active" : "");
    div.textContent = e.title || "Untitled";
    div.onclick = () => {
      activeEntryId = e.id;
      openEditor(e);
      statusText.textContent = "Editing.";
      renderList();
    };
    listEl.appendChild(div);
  });
}

function openEditor(e) {
  titleInput.value = e.title || "";
  dateInput.value = e.date || "";
  bodyInput.value = e.body || "";
}

/* ===== Storage ===== */

function getJournal() {
  return data.journals.find(j => j.id === activeJournalId);
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
