/* Simple local journal (GitHub Pages friendly)
   - Entries stored in localStorage on this device/browser.
   - Export/Import for backups.
*/

const STORAGE_KEY = "my_journal_entries_v1";

const el = (id) => document.getElementById(id);

const listEl = el("list");
const searchInput = el("searchInput");

const titleInput = el("titleInput");
const dateInput  = el("dateInput");
const bodyInput  = el("bodyInput");

const newBtn    = el("newBtn");
const saveBtn   = el("saveBtn");
const deleteBtn = el("deleteBtn");
const exportBtn = el("exportBtn");
const importInput = el("importInput");

const statusText = el("statusText");

let entries = loadEntries();
let activeId = null;
let dirty = false;

init();

function init(){
  // If no entries, start with a blank new entry selected
  if (entries.length === 0) {
    createNewEntry();
  } else {
    // pick newest
    const newest = sortEntries(entries)[0];
    activeId = newest.id;
    fillEditor(getById(activeId));
  }

  renderList();
  updateStatus("Ready.");

  // Events
  newBtn.addEventListener("click", () => {
    if (dirty && !confirm("You have unsaved changes. Create a new entry anyway?")) return;
    createNewEntry();
  });

  saveBtn.addEventListener("click", saveActive);

  deleteBtn.addEventListener("click", () => {
    if (!activeId) return;
    const e = getById(activeId);
    const name = e?.title?.trim() || "Untitled";
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    entries = entries.filter(x => x.id !== activeId);
    persist();
    dirty = false;

    if (entries.length === 0) {
      createNewEntry();
    } else {
      const newest = sortEntries(entries)[0];
      activeId = newest.id;
      fillEditor(getById(activeId));
      renderList();
      updateStatus("Deleted.");
    }
  });

  exportBtn.addEventListener("click", exportData);
  importInput.addEventListener("change", importData);

  searchInput.addEventListener("input", renderList);

  // Mark dirty on edits
  [titleInput, dateInput, bodyInput].forEach(input => {
    input.addEventListener("input", () => {
      dirty = true;
      updateStatus("Unsaved changes…");
    });
  });

  // Optional: Cmd+S to save
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveActive();
    }
  });
}

function createNewEntry(){
  const today = new Date();
  const iso = toISODate(today);

  const entry = {
    id: cryptoRandomId(),
    title: "",
    date: iso,
    body: "",
    updatedAt: Date.now()
  };

  entries.push(entry);
  activeId = entry.id;
  fillEditor(entry);
  renderList();
  dirty = true;
  updateStatus("New entry (not saved yet).");
}

function saveActive(){
  const e = getById(activeId);
  if (!e) return;

  e.title = titleInput.value;
  e.date  = dateInput.value || toISODate(new Date());
  e.body  = bodyInput.value;
  e.updatedAt = Date.now();

  persist();
  dirty = false;
  renderList();
  updateStatus("Saved.");
}

function fillEditor(entry){
  titleInput.value = entry?.title ?? "";
  dateInput.value  = entry?.date ?? toISODate(new Date());
  bodyInput.value  = entry?.body ?? "";
  dirty = false;
}

function renderList(){
  const q = (searchInput.value || "").toLowerCase().trim();

  const sorted = sortEntries(entries);
  const filtered = q
    ? sorted.filter(e =>
        (e.title || "").toLowerCase().includes(q) ||
        (e.body || "").toLowerCase().includes(q) ||
        (e.date || "").toLowerCase().includes(q)
      )
    : sorted;

  listEl.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.style.padding = "14px";
    empty.style.color = "#6b6b6b";
    empty.textContent = "No matches.";
    listEl.appendChild(empty);
    return;
  }

  for (const e of filtered){
    const item = document.createElement("div");
    item.className = "item" + (e.id === activeId ? " active" : "");
    item.addEventListener("click", () => {
      if (dirty && e.id !== activeId) {
        const ok = confirm("You have unsaved changes. Switch entries anyway?");
        if (!ok) return;
      }
      activeId = e.id;
      fillEditor(getById(activeId));
      renderList();
      updateStatus("Ready.");
    });

    const t = document.createElement("div");
    t.className = "t";
    t.textContent = (e.title && e.title.trim()) ? e.title.trim() : "Untitled";

    const d = document.createElement("div");
    d.className = "d";
    d.textContent = formatNiceDate(e.date);

    const p = document.createElement("div");
    p.className = "p";
    p.textContent = previewText(e.body);

    item.appendChild(t);
    item.appendChild(d);
    item.appendChild(p);
    listEl.appendChild(item);
  }
}

function previewText(s){
  const clean = (s || "").replace(/\s+/g, " ").trim();
  return clean.length ? clean : "—";
}

function sortEntries(arr){
  // Sort by date desc; tie-breaker updatedAt desc
  return [...arr].sort((a,b) => {
    const ad = (a.date || "");
    const bd = (b.date || "");
    if (ad !== bd) return bd.localeCompare(ad);
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}

function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadEntries(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(e => ({
      id: String(e.id || cryptoRandomId()),
      title: String(e.title || ""),
      date: String(e.date || toISODate(new Date())),
      body: String(e.body || ""),
      updatedAt: Number(e.updatedAt || Date.now())
    }));
  } catch {
    return [];
  }
}

function getById(id){
  return entries.find(e => e.id === id) || null;
}

function exportData(){
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: sortEntries(entries)
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
  updateStatus("Exported backup.");
}

function importData(){
  const file = importInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(String(reader.result || ""));
      const incoming = data.entries;
      if (!Array.isArray(incoming)) throw new Error("Invalid file.");

      // Merge: keep existing, add/overwrite by id
      const byId = new Map(entries.map(e => [e.id, e]));
      for (const e of incoming){
        const normalized = {
          id: String(e.id || cryptoRandomId()),
          title: String(e.title || ""),
          date: String(e.date || toISODate(new Date())),
          body: String(e.body || ""),
          updatedAt: Number(e.updatedAt || Date.now())
        };
        byId.set(normalized.id, normalized);
      }

      entries = Array.from(byId.values());
      persist();

      const newest = sortEntries(entries)[0];
      activeId = newest.id;
      fillEditor(getById(activeId));
      renderList();
      updateStatus("Imported backup.");
    } catch (err){
      alert("Import failed. Make sure it's a journal-backup.json file from Export.");
    } finally {
      importInput.value = "";
    }
  };
  reader.readAsText(file);
}

function updateStatus(msg){
  statusText.textContent = msg;
}

function toISODate(d){
  // YYYY-MM-DD (local)
  const year = d.getFullYear();
  const month = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
}

function formatNiceDate(iso){
  // Keep it simple & readable
  if (!iso) return "No date";
  const [y,m,d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m-1, d);
  return dt.toLocaleDateString(undefined, { year:"numeric", month:"long", day:"numeric" });
}

function cryptoRandomId(){
  // Good enough for journaling IDs
  if (crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2,"0")).join("");
  }
  return String(Date.now()) + Math.random().toString(16).slice(2);
}
