// Calls to the beauty_guild_api Catalyst function (Advanced I/O / Express),
// which in turn calls Zoho CRM. Relative path: works under `catalyst serve`
// (client + functions on one origin) and after real deployment (same domain).
const API_BASE_URL = '/server/beauty_guild_api';

async function fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('The request took too long. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchActiveCourses() {
  const res = await fetch(`${API_BASE_URL}/courses`);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `get courses failed: ${res.status}`);
  }
  return body.courses;
}

// CRM-first identity check: does a Contact already exist for this email?
export async function lookupContactByEmail(email) {
  const res = await fetch(`${API_BASE_URL}/contacts/lookup?email=${encodeURIComponent(email)}`);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `identity lookup failed: ${res.status}`);
  }
  return { exists: body.exists, contact: body.contact };
}

// Creates the CRM Contact at the end of the Register flow (Email/Password -> Your Details
// + Interests -> Home Address -> Create Account).
export async function createContact(profile) {
  const res = await fetch(`${API_BASE_URL}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `account creation failed: ${res.status}`);
  }
  return body.contact;
}

// Submits the finished Accreditation application: creates the Account, Training Centre,
// the Accreditation record, and the link joining them. Application Stage lands on
// "Awaiting Payment" - there's no real payment processor wired up yet.
export async function submitAccreditation(payload) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/accreditations/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ httpStatus: res.status, ...body }, null, 2));
  }
  return body.accreditation;
}

export async function saveAccreditationDraft(payload) {
  const res = await fetch(`${API_BASE_URL}/accreditations/draft`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `draft save failed: ${res.status}`);
  return body.draft;
}

export async function fetchAccreditationDraft(id, contactId) {
  const res = await fetch(`${API_BASE_URL}/accreditations/${encodeURIComponent(id)}?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `draft lookup failed: ${res.status}`);
  return body;
}

// Training Centre Accreditation records for the logged-in contact, split into
// accredited schools and pending applications by Accreditation Status.
export async function fetchAccreditations(contactId) {
  const res = await fetch(`${API_BASE_URL}/accreditations?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `accreditations lookup failed: ${res.status}`);
  }
  return { accredited: body.accredited || [], drafts: body.drafts || [], pending: body.pending || [], awaitingPayment: body.awaitingPayment || [] };
}

export async function fetchQualificationContext(contactId) {
  const res = await fetch(`${API_BASE_URL}/qualifications/context?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `qualification context failed: ${res.status}`);
  return body;
}

export async function fetchQualifications(contactId) {
  const res = await fetch(`${API_BASE_URL}/qualifications?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `qualifications lookup failed: ${res.status}`);
  return body.qualifications || [];
}

export async function createQualification(payload) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/qualifications`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `qualification save failed: ${res.status}`);
  return body.qualification;
}

// Resolves the CRM Member Profile used by the future accreditation Deal and
// Stripe metadata. Existing valid membership Deals are reused; otherwise the
// API creates a new Associate Membership profile and returns its ID.
export async function resolveMembership(contactId, options = {}) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/memberships/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contactId, ...options }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `membership resolution failed: ${res.status}`);
  }
  return body;
}

export async function findAddresses(text, container) {
  const params = new URLSearchParams({ text });
  if (container) params.set('container', container);
  const res = await fetch(`${API_BASE_URL}/address/find?${params}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `address search failed: ${res.status}`);
  return body.items || [];
}

export async function retrieveAddress(id) {
  const res = await fetch(`${API_BASE_URL}/address/retrieve?id=${encodeURIComponent(id)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `address retrieve failed: ${res.status}`);
  return body.address;
}

export async function geocodeAddress(country, location) {
  const res = await fetch(`${API_BASE_URL}/address/geocode?country=${encodeURIComponent(country || 'GBR')}&location=${encodeURIComponent(location)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `geocode failed: ${res.status}`);
  return body.coordinates;
}

export async function createCheckoutSession(payload) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/payments/checkout`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ httpStatus: res.status, ...body }, null, 2));
  }
  return body;
}
