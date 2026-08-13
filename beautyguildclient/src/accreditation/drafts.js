// Client-side persistence for in-progress accreditation applications ("Save & finish later").
// No backend exists yet for this - see AccreditationApp.jsx notes on stubbed integrations.

const STORAGE_KEY = 'bg_accreditation_drafts';

export function loadDrafts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const drafts = raw ? JSON.parse(raw) : [];
    return drafts.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  } catch {
    return [];
  }
}

function persist(drafts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  return drafts;
}

export function upsertDraft(draft) {
  const drafts = loadDrafts();
  const idx = drafts.findIndex((d) => d.id === draft.id);
  if (idx === -1) drafts.unshift(draft); else drafts[idx] = draft;
  return persist(drafts);
}

export function deleteDraft(id) {
  return persist(loadDrafts().filter((d) => d.id !== id));
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
