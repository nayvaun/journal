/*
  Multi-journal, local-only journal app (GitHub Pages friendly)
  - Home screen: list journals
  - Inside a journal: list entries (newest at top), editor
  - New entry opens a draft (not in list until saved)
  - Edit does NOT change ordering; ordering = creation order or your manual drag order
  - Drag reorder entries within journal
  - Freeform date field (type anything)
  - Export/Import backups
*/

const STORAGE_KEY = "my_journal_multi_v1";

const el = (id) => document.getElementById(id);

const headerTitle = el("headerTitle");

const listEl = el("list");
const searchInput = el("searchInput");

const homePanel = el("homePanel");
const editorPanel = el("editorPanel");

const titleInput = el("titleInput");
const dateInput  = el("dateInput");
const bodyInput  = el("bodyInput");
const statusText = el("statusText");

const homeBtn = el("homeBtn");
const newJournalBtn = el("newJournalBtn");
const newEntryBtn = el("newEntryBtn");
const saveBtn = el("saveBtn");
const deleteEntryBtn = el("deleteEntryBtn");
const renameJournalBtn = el("renameJournalBtn");
const exportBtn = el("exportBtn");
const importInput = el("importInput");

let state = loadState();
// UI mode: "home" or "journal"
let mode = "home";

// Current selections
let activeJournalId = null;

// Draft behavior:
// - activeEntryId === null means you're editing a NEW unsaved draft for the active journal
let activeEntryId = null;

let dirty = false;

// Drag state
let draggingEntryId = null;

init();

function init() {
  // If no journals exist, create one by default (so app isn't empty)
  if (state.journals.length === 0) {
    const j = createJournal("my first journal");
    activeJournalId = j.id;
    mode = "journal";
    openDraft();
  } else {
    mode = "home";
  }

  render();

  // Events
  homeBtn.addEventListener("click", () => {
    if (dirty && !confirm("You have unsaved changes. Go home anyway?")) return;
    goHome();
  });

  newJournalBtn.addEventListener("click", () => {
    const name = prompt("Journal name?", "new journal");
    if (name === null) return;
    const journal = createJournal((name || "").trim() || "untitled journal");
    activeJournalId = journal.id;
    mode = "journal";
    openDraft();
    persist();
    render();
    setStatus("Created a new journal.");
  });

  renameJournalBtn.addEventListener("click", () => {
    if (!activeJournalId) return;
    const j = getJournal(activeJournalId);
    if (!j) return;
    const name = prompt("Rename journal:", j.title);
    if (name === null) return;
    j.title = (name || "").trim() || "untitled journal";
    persist();
    render();
    setStatus("Renamed journal.");
  });

  newEntryBtn.addEventListener("click", () => {
    if (!activeJournalId) return;
    if (dirty && !confirm("You have unsaved changes. Start a new entry anyway?")) return;
    openDraft();
    render(); // just to update highlight/buttons
    setStatus("New entry (draft).");
  });

  saveBtn.addEventListener("click", saveCurrent);
  deleteEntryBtn.addEventListener("click", deleteCurrentEntry);

  exportBtn.addEventListener("click", exportData);
  importInput.addEventListener("change", importData);

  searchInput.addEventListener("input", renderList);

  // Mark dirty on edits
  [titleInput, dateInput, bodyInput].forEach(input => {
    input.addEventListener("input", () => {
      if (mode !== "journal") return;
      dirty = true;
      setStatus("Unsaved changes…");
    });
  });

  // Cmd/Ctrl+S to save
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (mode === "journal") saveCurrent();
    }
  });
}

/* ---------- Core actions ---------- */

function goHome() {
  mode = "home";
  activeJournalId = null;
  activeEntryId = null;
  dirty = false;
  render();
  setStatus("Home.");
}

function openJournal(journalId) {
  const j = getJournal(journalId);
  if (!j) return;
  mode = "journal";
  activeJournalId = j.id;
  openDraft(); // ALWAYS start on a blank page like you wanted
  render();
  setStatus("Opened journal.");
}

function openDraft() {
  activeEntryId = null;
  fillEditor({ title: "", dateText: "", body: "" });
  dirty = false;
}

function saveCurrent() {
  if (!activeJournalId) return;
  const journal = getJournal(activeJournalId);
  if (!journal) return;

  const title = titleInput.value;
  const dateText = dateInput.value; // freeform
  const body = bodyInput.value;

  // If currently editing a draft, create a new entry on save
  if
