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
  if (activeEntryId === null) {
    const entry = {
      id: cryptoRandomId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      title: title || "",
      dateText: dateText || "",
      body: body || ""
    };
    state.entriesById[entry.id] = entry;

    // Keep journal.order as OLDEST -> NEWEST (stable)
    journal.order.push(entry.id);

    // After saving, stay on that entry (so you can keep editing)
    activeEntryId = entry.id;

    dirty = false;
    persist();
    render();
    setStatus("Saved new entry.");
    return;
  }

  // Otherwise update existing entry (should NOT move it)
  const existing = state.entriesById[activeEntryId];
  if (!existing) return;

  existing.title = title || "";
  existing.dateText = dateText || "";
  existing.body = body || "";
  existing.updatedAt = Date.now();

  dirty = false;
  persist();
  renderList(); // no need to fully rerender editor
  setStatus("Saved.");
}

function deleteCurrentEntry() {
  if (!activeJournalId) return;
  const journal = getJournal(activeJournalId);
  if (!journal) return;

  if (activeEntryId === null) {
    // Deleting a draft just clears it
    if (!confirm("Clear this draft?")) return;
    openDraft();
    render();
    setStatus("Draft cleared.");
    return;
  }

  const entry = state.entriesById[activeEntryId];
  const name = (entry?.title || "").trim() || "Untitled";
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

  delete state.entriesById[activeEntryId];
  journal.order = journal.order.filter(id => id !== activeEntryId);

  // After delete, go back to draft
  openDraft();
  persist();
  render();
  setStatus("Deleted entry.");
}

/* ---------- Rendering ---------- */

function render() {
  // Panels
  if (mode === "home") {
    homePanel.classList.remove("hidden");
    editorPanel.classList.add("hidden");
    headerTitle.textContent = "my journal";
  } else {
    homePanel.classList.add("hidden");
    editorPanel.classList.remove("hidden");
    const j = getJournal(activeJournalId);
    headerTitle.textContent = j ? j.title : "journal";
  }

  updateButtons();
  renderList();

  // Editor already contains correct stuff; ensure focus if journal mode
  if (mode === "journal") {
    // optional: focus body when opening draft
    // bodyInput.focus();
  }
}

function updateButtons() {
  const inHome = (mode === "home");
  const inJournal = (mode === "journal");

  // Home always visible, but only meaningful in journal
  homeBtn.disabled = inHome;

  newJournalBtn.disabled = false;

  newEntryBtn.disabled = !inJournal;
  saveBtn.disabled = !inJournal;
  deleteEntryBtn.disabled = !inJournal;
  renameJournalBtn.disabled = !inJournal;

  // In journal mode, delete button label changes for draft
  deleteEntryBtn.textContent = (inJournal && activeEntryId === null) ? "Clear draft" : "Delete entry";
}

function renderList() {
  listEl.innerHTML = "";
  const q = (searchInput.value || "").toLowerCase().trim();

  if (mode === "home") {
    // List journals
    const journals = [...state.journals].sort((a,b) => b.createdAt - a.createdAt);

    const filtered = q
      ? journals.filter(j => (j.title || "").toLowerCase().includes(q))
      : journals;

    if (filtered.length === 0) {
      listEl.appendChild(makeEmpty("No journals."));
      return;
    }

    for (const j of filtered) {
      const item = document.createElement("div");
      item.className = "item";
      item.addEventListener("click", () => {
        if (dirty && !confirm("You have unsaved changes. Open a journal anyway?")) return;
        openJournal(j.id);
      });

      const t = document.createElement("div");
      t.className = "t";
      t.textContent = j.title || "untitled journal";

      const d = document.createElement("div");
      d.className = "d";
      d.textContent = `${j.order.length} entr${j.order.length === 1 ? "y" : "ies"}`;

      item.appendChild(t);
      item.appendChild(d);
      listEl.appendChild(item);
    }

    return;
  }

  // mode === "journal": list entries for active journal
  const journal = getJournal(activeJournalId);
  if (!journal) {
    listEl.appendChild(makeEmpty("Journal not found."));
    return;
  }

  // Build entry list (newest at top visually)
  // journal.order is oldest->newest; display reversed
  const ids = [...journal.order].reverse();

  const entries = ids
    .map(id => state.entriesById[id])
    .filter(Boolean);

  const filtered = q
    ? entries.filter(e =>
        (e.title || "").toLowerCase().includes(q) ||
        (e.dateText || "").toLowerCase().includes(q) ||
        (e.body || "").toLowerCase().includes(q)
      )
    : entries;

  // Add a “Draft” pseudo-item at the top, because opening a journal starts on a blank page
  const draftItem = document.createElement("div");
  draftItem.className = "item" + (activeEntryId === null ? " active" : "");
  draftItem.addEventListener("click", () => {
    if (dirty && !confirm("You have unsaved changes. Switch to draft anyway?")) return;
    openDraft();
    render();
    setStatus("Draft.");
  });

  const dt = document.createElement("div");
  dt.className = "t";
  dt.textContent = "✎ Draft (new entry)";

  const dd = document.createElement("div");
  dd.className = "d";
  dd.textContent = "Not saved yet";

  const dp = document.createElement("div");
  dp.className = "p";
  dp.textContent = "Write here, then Save to add it.";

  draftItem.appendChild(dt);
  draftItem.appendChild(dd);
  draftItem.appendChild(dp);
  listEl.appendChild(draftItem);

  if (filtered.length === 0) {
    listEl.appendChild(makeEmpty(q ? "No matches." : "No saved entries yet."));
    return;
  }

  for (const e of filtered) {
    const item = document.createElement("div");
    item.className = "item draggable" + (e.id === activeEntryId ? " active" : "");
    item.setAttribute("draggable", "true");
    item.dataset.entryId = e.id;

    // Click to open
    item.addEventListener("click", () => {
      if (draggingEntryId) return; // don't open while dragging
      if (dirty && e.id !== activeEntryId) {
        const ok = confirm("You have unsaved changes. Switch entries anyway?");
        if (!ok) return;
      }
      activeEntryId = e.id;
      fillEditor(e);
      dirty = false;
      render();
      setStatus("Ready.");
    });

    // Drag handlers
    item.addEventListener("dragstart", (ev) => {
      draggingEntryId = e.id;
      item.classList.add("dragging");
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", e.id);
    });

    item.addEventListener("dragend", () => {
      draggingEntryId = null;
      item.classList.remove("dragging");
      clearDropTargets();
    });

    item.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      item.classList.add("dropTarget");
      ev.dataTransfer.dropEffect = "move";
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("dropTarget");
    });

    item.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const sourceId = ev.dataTransfer.getData("text/plain");
      const targetId = e.id;
      if (!sourceId || !targetId || sourceId === targetId) return;

      reorderEntryVisualTopIsNewest(sourceId, targetId);
      clearDropTargets();
      persist();
      renderList();
      setStatus("Reordered.");
    });

    const t = document.createElement("div");
    t.className = "t";
    t.textContent = (e.title && e.title.trim()) ? e.title.trim() : "Untitled";

    const d = document.createElement("div");
    d.className = "d";
    d.textContent = (e.dateText && e.dateText.trim()) ? e.dateText.trim() : "No date";

    const p = document.createElement("div");
    p.className = "p";
    p.textContent = previewText(e.body);

    item.appendChild(t);
    item.appendChild(d);
    item.appendChild(p);

    listEl.appendChild(item);
  }
}

function makeEmpty(text) {
  const empty = document.createElement("div");
  empty.style.padding = "14px";
  empty.style.color = "#6b6b6b";
  empty.textContent = text;
  return empty;
}

function clearDropTargets() {
  document.querySelectorAll(".dropTarget").forEach(n => n.classList.remove("dropTarget"));
}

function fillEditor(entry) {
  titleInput.value = entry?.title ?? "";
  dateInput.value  = entry?.dateText ?? "";
  bodyInput.value  = entry?.body ?? "";
}

/*
  journal.order is stored oldest->newest.
  UI list is newest->oldest (reversed).
  When you drag source onto target in the UI, we want to move the source
  to the target position in the UI ordering (newest-first).
*/
function reorderEntryVisualTopIsNewest(sourceId, targetId) {
  const journal = getJournal(activeJournalId);
  if (!journal) return;

  // Convert stored order to UI order (newest first)
  const ui = [...journal.order].reverse();

  const from = ui.indexOf(sourceId);
  const to = ui.indexOf(targetId);
  if (from === -1 || to === -1) return;

  ui.splice(from, 1);
  ui.splice(to, 0, sourceId);

  // Convert back to stored order (oldest first)
  journal.order = ui.reverse();
}

/* ---------- Data ---------- */

function createJournal(title) {
  const j = {
    id: cryptoRandomId(),
    title: title || "untitled journal",
    createdAt: Date.now(),
    order: [] // entry ids, oldest->newest
  };
  state.journals.push(j);
  return j;
}

function getJournal(id) {
  return state.journals.find(j => j.id === id) || null;
}

function previewText(s) {
  const clean = (s || "").replace(/\s+/g, " ").trim();
  return clean.length ? clean : "—";
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);

    // Basic validation & normalization
    const journals = Array.isArray(parsed.journals) ? parsed.journals : [];
    const entriesById = (parsed.entriesById && typeof parsed.entriesById === "object") ? parsed.entriesById : {};

    const normJournals = journals.map(j => ({
      id: String(j.id || cryptoRandomId()),
      title: String(j.title || "untitled journal"),
      createdAt: Number(j.createdAt || Date.now()),
      order: Array.isArray(j.order) ? j.order.map(String) : []
    }));

    const normEntries = {};
    for (const [id, e] of Object.entries(entriesById)) {
      normEntries[String(id)] = {
        id: String(e.id || id),
        createdAt: Number(e.createdAt || Date.now()),
        updatedAt: Number(e.updatedAt || Date.now()),
        title: String(e.title || ""),
        dateText: String(e.dateText || ""),
        body: String(e.body || "")
      };
    }

    return { journals: normJournals, entriesById: normEntries };
  } catch {
    return freshState();
  }
}

function freshState() {
  return { journals: [], entriesById: {} };
}

/* ---------- Export / Import ---------- */

function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    state
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "journal-backup.json";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
  setStatus("Exported backup.");
}

function importData() {
  const file = importInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || ""));
      const incoming = data.state;
      if (!incoming || typeof incoming !== "object") throw new Error("Invalid file");

      // Replace state entirely (simplest + safest)
      // If you want merge later, we can do that.
      state = normalizeIncoming(incoming);

      persist();

      // After import, go home
      mode = "home";
      activeJournalId = null;
      activeEntryId = null;
      dirty = false;

      render();
      setStatus("Imported backup.");
    } catch {
      alert("Import failed. Use a journal-backup.json file from Export.");
    } finally {
      importInput.value = "";
    }
  };
  reader.readAsText(file);
}

function normalizeIncoming(incoming) {
  const journals = Array.isArray(incoming.journals) ? incoming.journals : [];
  const entriesById = (incoming.entriesById && typeof incoming.entriesById === "object") ? incoming.entriesById : {};

  const normJournals = journals.map(j => ({
    id: String(j.id || cryptoRandomId()),
    title: String(j.title || "untitled journal"),
    createdAt: Number(j.createdAt || Date.now()),
    order: Array.isArray(j.order) ? j.order.map(String) : []
  }));

  const normEntries = {};
  for (const [id, e] of Object.entries(entriesById)) {
    normEntries[String(id)] = {
      id: String(e.id || id),
      createdAt: Number(e.createdAt || Date.now()),
      updatedAt: Number(e.updatedAt || Date.now()),
      title: String(e.title || ""),
      dateText: String(e.dateText || ""),
      body: String(e.body || "")
    };
  }

  return { journals: normJournals, entriesById: normEntries };
}

/* ---------- Status / IDs ---------- */

function setStatus(msg) {
  statusText.textContent = msg;
}

function cryptoRandomId() {
  if (crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2,"0")).join("");
  }
  return String(Date.now()) + Math.random().toString(16).slice(2);
}
