// Client-side "already logged in" persistence, so returning to the portal (e.g. via the
// WordPress "Apply Accreditation" link) doesn't force the login screen again in the same browser.
// This is a stand-in for a real shared session with WordPress - see AccreditationApp.jsx notes.

const STORAGE_KEY = 'bg_accreditation_session';

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(contact) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contact));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}
