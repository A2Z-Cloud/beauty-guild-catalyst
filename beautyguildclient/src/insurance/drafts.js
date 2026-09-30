const PREFIX = 'beautyGuildInsuranceDraftV1';

function key(identity) {
  const safeIdentity = (identity || 'public').trim().toLowerCase();
  return `${PREFIX}:${safeIdentity}`;
}

export function loadInsuranceDraft(identity) {
  try {
    const raw = window.localStorage.getItem(key(identity));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.log('insurance draft load failed', err);
    return null;
  }
}

export function saveInsuranceDraft(state, identity) {
  try {
    window.localStorage.setItem(key(identity), JSON.stringify({ ...state, savedAt: new Date().toISOString() }));
    return true;
  } catch (err) {
    console.log('insurance draft save failed', err);
    return false;
  }
}

export function clearInsuranceDraft(identity) {
  try {
    window.localStorage.removeItem(key(identity));
  } catch (err) {
    console.log('insurance draft clear failed', err);
  }
}
