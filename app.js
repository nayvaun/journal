const STORAGE_KEY = "journalEntries";

const form = document.getElementById("entry-form");
const entriesList = document.getElementById("entries-list");
const entryTemplate = document.getElementById("entry-template");
const emptyState = document.getElementById("empty-state");
const searchInput = document.getElementById("search");

let entries = loadEntries();

renderEntries();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const title = formData.get("title").toString().trim();
  const mood = formData.get("mood").toString();
  const content = formData.get("content").toString().trim();

  if (!title || !content) {
    return;
  }

  const entry = {
    id: crypto.randomUUID(),
    title,
    mood,
    content,
    createdAt: new Date().toISOString(),
  };

  entries.unshift(entry);
  persistEntries();
  form.reset();
  renderEntries();
});

searchInput.addEventListener("input", () => {
  renderEntries(searchInput.value);
});

function loadEntries() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function deleteEntry(id) {
  entries = entries.filter((entry) => entry.id !== id);
  persistEntries();
  renderEntries(searchInput.value);
}

function renderEntries(search = "") {
  const query = search.toLowerCase().trim();
  const filtered = entries.filter((entry) => {
    const haystack = `${entry.title} ${entry.content}`.toLowerCase();
    return haystack.includes(query);
  });

  entriesList.textContent = "";

  for (const entry of filtered) {
    const fragment = entryTemplate.content.cloneNode(true);
    fragment.querySelector(".entry-title").textContent = entry.title;
    fragment.querySelector(".entry-mood").textContent = entry.mood;
    fragment.querySelector(".entry-date").textContent = formatDate(entry.createdAt);
    fragment.querySelector(".entry-content").textContent = entry.content;

    fragment.querySelector(".delete-btn").addEventListener("click", () => {
      deleteEntry(entry.id);
    });

    entriesList.append(fragment);
  }

  const showEmptyState = filtered.length === 0;
  emptyState.classList.toggle("hidden", !showEmptyState);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
