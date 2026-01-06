const STORAGE_KEY = "journals_v3_no_popups";

const homePanel = document.getElementById("homePanel");
const editorPanel = document.getElementById("editorPanel");
const listEl = document.getElementById("list");

const homeBtn = document.getElementById("homeBtn");
const newJournalBtn = document.getElementById("newJournalBtn");
const deleteJournalBtn = document.getElementById("deleteJournalBtn");

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

// When activeEntryId is null, you’re editing a NEW unsaved draft
let activeEntryId = null;

// Init
renderHome();
updateTopButtons();

/* ===== Buttons ===== */

homeBtn.onclick = () => {
  activeJournalId = null;
  activeEntryId = null;
  renderHome();
  updateTopButtons();
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

deleteJournalBtn.onclick = () => {
  if (!activeJournalId) return;

  // No popup confirmations (per your preference): single-click delete is dangerous,
  // so we do a "soft" confirm in the status bar via double-click behavior.
  // First click warns; second click within 3 seconds deletes.
  const now = Date.now();
  const j = getJournal();
  if (!j) return;

  if (!deleteJournalBtn.dataset.armed || (now - Number(deleteJournalBtn.dataset.armed) > 3000)) {
    deleteJournalBtn.dataset.armed = String(now);
    statusText.textContent = "Click Delete journal again to confirm (3s).";
    return;
  }

  // Confirmed
  data.journals = data.journals.filter(x => x.id !== activeJournalId);
  activeJournalId = null;
  activeEntryId = null;
  save();
  renderHome();
  updateTopButtons();
};

newEntryBtn.onclick = () => {
  if (!activeJournalId) return;
  activeEntryId = null;
  openEditor({ title: "", date: "", body: "" });
  statusText.textContent = "New entry (draft).";
  renderList(); // so highlight clears
};

saveBtn.onclick = () => {
  if (!activeJournalId) return;
  const j = getJournal();
  if (!j) return;

  // Save journal title live
  j.title = journalTitleInput.value.trim() || "Untitled journal";
  save(); // so journal list updates too

  // Draft -> create new entry
  if (activeEntryId === null) {
    const e = {
      id: id(),
      created: Date.now(),
      title: titleInput.value,
      date: dateInput.value,
      body: bodyInput.value
    };

    // Newest at top, oldest at bottom
    j.entries.unshift(e);
    activeEntryId = e.id;

    save();
    renderList();

    // After saving, automatically start a NEW blank one
    activeEntryId = null;
    openEditor({ title: "", date: "", body: "" });
    statusText.textContent = "Saved. Started a new entry.";
    renderList();
    return;
  }

  // Existing entry -> update (does not change order)
  const existing = j.entries.find(x => x.id === activeEntryId);
  if (!existing) return;

  existing.title = titleInput.value;
  existing.date = dateInput.value;
  existing.body = bodyInput.value;

  save();
  renderList();

  // After saving an existing entry, also start a new blank one (your rule)
  activeEntryId = null;
  openEditor({ title: "", date: "", body: "" });
  statusText.textContent = "Saved. Started a new entry.";
  renderList();
};

deleteEntryBtn.onclick = () => {
  if (!activeJournalId) return;

  // If draft, just clear
  if (activeEntryId === null) {
    openEditor({ title: "", date: "", body: "" });
    statusText.textContent = "Draft cleared.";
    return;
  }

  const j = getJournal();
  j.entries = j.entries.filter(e => e.id !== activeEntryId);
  activeEntryId = null;
  save();
  renderList();
  openEditor({ title: "", date: "", body: "" });
  statusText.textContent = "Entry deleted. Started a new entry.";
};

/* ===== Live update journal title ===== */
journalTitleInput.addEventListener("input", () => {
  if (!activeJournalId) return;
  const j = getJournal();
  if (!j) return;
  j.title = journalTitleInput.value.trim() || "Untitled journal";
  save();
  // If you're on Home later, it will show updated name
});

searchInput.addEventListener("input", () => {
  renderList();
});

/* ===== Render ===== */

function renderHome() {
  homePanel.classList.remove("hidden");
  editorPanel.classList.add("hidden");
  statusText.textContent = "Ready.";
  renderList();
}

function openJournal(journalId) {
  activeJournalId = journalId;
  activeEntryId = null;

  homePanel.classList.add("hidden");
  editorPanel.classList.remove("hidden");

  const j = getJournal();
  journalTitleInput.value = j.title || "Untitled journal";

  // IMPORTANT: Opening a journal starts on a NEW blank entry (draft)
  openEditor({ title: "", date: "", body: "" });
  statusText.textContent = "New entry (draft).";

  renderList();
  updateTopButtons();
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
      const title = document.createElement("div");
      title.className = "itemTitle";
      title.textContent = j.title || "Untitled journal";
      const meta = document.createElement("div");
      meta.className = "itemMeta";
      meta.textContent = `${j.entries.length} entr${j.entries.length === 1 ? "y" : "ies"}`;
      div.appendChild(title);
      div.appendChild(meta);

      div.onclick = () => openJournal(j.id);
      listEl.appendChild(div);
    });

    return;
  }

  // Inside journal: show entries with dates
  const j = getJournal();
  const entries = j.entries; // already newest-first

  const filtered = q
    ? entries.filter(e =>
        (e.title || "").toLowerCase().includes(q) ||
        (e.date || "").toLowerCase().includes(q) ||
        (e.body || "").toLowerCase().includes(q)
      )
    : entries;

  // Add a “Draft” item at the top so it’s obvious
  const draft = document.createElement("div");
  draft.className = "item" + (activeEntryId === null ? " active" : "");
  const dt = document.createElement("div");
  dt.className = "itemTitle";
  dt.textContent = "✎ Draft (new entry)";
  const dm = document.createElement("div");
  dm.className = "itemMeta";
  dm.textContent = "Not saved yet";
  draft.appendChild(dt);
  draft.appendChild(dm);
  draft.onclick = () => {
    activeEntryId = null;
    openEditor({ title: "", date: "", body: "" });
    statusText.textContent = "New entry (draft).";
    renderList();
  };
  listEl.appendChild(draft);

  filtered.forEach(e => {
    const div = document.createElement("div");
    div.className = "item" + (e.id === activeEntryId ? " active" : "");

    const title = document.createElement("div");
    title.className = "itemTitle";
    title.textContent = e.title || "Untitled";

    const meta = document.createElement("div");
    meta.className = "itemMeta";
    meta.textContent = e.date ? e.date : "No date";

    div.appendChild(title);
    div.appendChild(meta);

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

function updateTopButtons() {
  const inJournal = !!activeJournalId;
  deleteJournalBtn.style.display = inJournal ? "inline-block" : "none";
  newEntryBtn.disabled = !inJournal;
  saveBtn.disabled = !inJournal;
  deleteEntryBtn.disabled = !inJournal;
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
