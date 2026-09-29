// Client-side persistence for in-progress accreditation applications ("Save & finish later").
// No backend exists yet for this - see AccreditationApp.jsx notes on stubbed integrations.

const STORAGE_KEY = 'bg_accreditation_drafts';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(drafts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  return drafts;
}

// Scoped to the given contact - a shared/reused browser must never surface another
// account's saved-for-later application. Storage itself still holds every account's drafts
// together (so saving one account's draft can't clobber another's), but reads are always
// filtered down to just the requested contact. Drafts saved before this scoping existed have
// no contactId and are treated as unowned, so they simply stop appearing rather than risk
// showing them to the wrong person.
export function loadDrafts(contactId) {
  if (!contactId) return [];
  return readAll()
    .filter((d) => d.contactId === contactId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function upsertDraft(draft) {
  const drafts = readAll();
  const idx = drafts.findIndex((d) => d.id === draft.id);
  if (idx === -1) drafts.unshift(draft); else drafts[idx] = draft;
  persist(drafts);
  return loadDrafts(draft.contactId);
}

export function deleteDraft(id, contactId) {
  persist(readAll().filter((d) => d.id !== id));
  return loadDrafts(contactId);
}

export function draftLabel(acc) {
  if (acc.sch.name) return acc.sch.name;
  const name = [acc.title, acc.fname, acc.surname].filter(Boolean).join(' ').trim();
  return name || 'New application';
}

export function formatSavedAt(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
