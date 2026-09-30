const KEY = 'beautyGuildInsuranceDraftV1';

export function loadInsuranceDraft() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.log('insurance draft load failed', err);
    return null;
  }
}

export function saveInsuranceDraft(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: new Date().toISOString() }));
    return true;
  } catch (err) {
    console.log('insurance draft save failed', err);
    return false;
  }
}

export function clearInsuranceDraft() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (err) {
    console.log('insurance draft clear failed', err);
  }
}
