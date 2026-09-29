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
    const error = new Error(JSON.stringify({ httpStatus: res.status, ...body }, null, 2));
    error.payload = body;
    throw error;
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

// Deletes the draft's CRM records (accreditation, course offerings, centre link) - the
// server refuses this for anything past Application_Stage "Draft".
export async function discardAccreditationDraft(id, contactId) {
  const res = await fetch(`${API_BASE_URL}/accreditations/${encodeURIComponent(id)}?contactId=${encodeURIComponent(contactId)}`, { method: 'DELETE' });
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body.error || `draft discard failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

// Every Training Centre linked to an accreditation - the main centre plus any
// Additional Venues - each with its own course count.
export async function fetchAccreditationVenues(id, contactId) {
  const res = await fetch(`${API_BASE_URL}/accreditations/${encodeURIComponent(id)}/venues?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `venues lookup failed: ${res.status}`);
  return body.venues || [];
}

// GTi courses this school isn't currently accredited to offer at any venue.
export async function fetchMissingGtiCourses(id, contactId) {
  const res = await fetch(`${API_BASE_URL}/accreditations/${encodeURIComponent(id)}/missing-gti-courses?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `missing courses lookup failed: ${res.status}`);
  return body.courses || [];
}

// Accredited tutors for a school, split into current, expired and pending (linked/invited
// but with no Guild membership record yet) membership.
export async function fetchAccreditationTutors(id, contactId) {
  const res = await fetch(`${API_BASE_URL}/accreditations/${encodeURIComponent(id)}/tutors?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `tutors lookup failed: ${res.status}`);
  return { current: body.current || [], expired: body.expired || [], pending: body.pending || [] };
}

// Browses the WorkDrive folder linked from this specific accreditation's own Workdrive_Link,
// so a school with several accreditations only ever sees that accreditation's documents.
// Omit folderId for the root folder; pass a folder's id (from a previous result) to descend.
export async function fetchAccreditationDocuments(id, contactId, folderId) {
  const params = new URLSearchParams({ contactId });
  if (folderId) params.set('folderId', folderId);
  const res = await fetch(`${API_BASE_URL}/accreditations/${encodeURIComponent(id)}/documents?${params}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `documents lookup failed: ${res.status}`);
  return { folderId: body.folderId || null, items: body.items || [], message: body.message || null };
}

// Browses the WorkDrive folder linked from the applicant's own membership Deal - the
// top-level "Documents" nav item, deliberately not scoped to any one accreditation.
export async function fetchContactDocuments(contactId, folderId) {
  const params = new URLSearchParams();
  if (folderId) params.set('folderId', folderId);
  const res = await fetch(`${API_BASE_URL}/contacts/${encodeURIComponent(contactId)}/documents?${params}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `documents lookup failed: ${res.status}`);
  return { folderId: body.folderId || null, items: body.items || [], message: body.message || null };
}

// The preview engine needs the same WorkDrive OAuth token as the files API, which a
// plain <img> tag can never attach - documentThumbnailUrl always points at our own
// proxy, which returns 204 (falls through to onError) when no preview exists yet.
export function documentThumbnailUrl(fileId) {
  return `${API_BASE_URL}/documents/thumbnail/${encodeURIComponent(fileId)}`;
}

// Invoices from Zoho Creator's All_Invoice_Records report, filtered to the applicant.
export async function fetchAccreditationInvoices(id, contactId) {
  const res = await fetch(`${API_BASE_URL}/accreditations/${encodeURIComponent(id)}/invoices?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `invoices lookup failed: ${res.status}`);
  return body.invoices || [];
}

// Every invoice for this account, across accreditation, venue and membership payments alike.
export async function fetchAccountInvoices(contactId) {
  const res = await fetch(`${API_BASE_URL}/invoices?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `invoices lookup failed: ${res.status}`);
  return body.invoices || [];
}

// CRM-first: links an existing tutor Contact to this training centre (Active only if they
// already hold a current Guild membership, Inactive otherwise), or creates the Contact and
// links it as Inactive. The invite/onboarding email itself is sent from CRM, not here.
export async function inviteOrLinkTutor(id, contactId, { name, email }) {
  const res = await fetch(`${API_BASE_URL}/accreditations/${encodeURIComponent(id)}/tutors`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId, name, email }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `tutor invite failed: ${res.status}`);
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
  return body;
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

export async function fetchMembershipHistory(contactId) {
  const res = await fetch(`${API_BASE_URL}/memberships/history?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `membership history lookup failed: ${res.status}`);
  return body.memberships || [];
}

// Invoices from Zoho Creator's All_Invoice_Records report, filtered to this specific
// membership Deal (crm_membership_id), same pattern as fetchAccreditationInvoices.
export async function fetchMembershipInvoices(dealId, contactId) {
  const res = await fetch(`${API_BASE_URL}/memberships/${encodeURIComponent(dealId)}/invoices?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `membership invoices lookup failed: ${res.status}`);
  return body.invoices || [];
}

// Branches and addons (bundle/certificate/badge/window sticker) purchased with this
// membership, from CRM's Membership_Extension module.
export async function fetchMembershipExtensions(dealId, contactId) {
  const res = await fetch(`${API_BASE_URL}/memberships/${encodeURIComponent(dealId)}/extensions?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `membership addons lookup failed: ${res.status}`);
  return body.extensions || [];
}

export async function removeMembershipExtension(dealId, extensionId, contactId) {
  const res = await fetch(`${API_BASE_URL}/memberships/${encodeURIComponent(dealId)}/extensions/${encodeURIComponent(extensionId)}?contactId=${encodeURIComponent(contactId)}`, { method: 'DELETE' });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `add-on removal failed: ${res.status}`);
  return body;
}

export async function findAddresses(text, container) {
  const params = new URLSearchParams({ text });
  if (container) params.set('container', container);
  const res = await fetch(`${API_BASE_URL}/address/find?${params}`);
  const body = await res.json();
  if (!res.ok) throw new Error([body.error || `address search failed: ${res.status}`, typeof body.details === 'string' ? body.details : body.details && JSON.stringify(body.details)].filter(Boolean).join(': '));
  return body.items || [];
}

export async function retrieveAddress(id) {
  const res = await fetch(`${API_BASE_URL}/address/retrieve?id=${encodeURIComponent(id)}`);
  const body = await res.json();
  if (!res.ok) throw new Error([body.error || `address retrieve failed: ${res.status}`, typeof body.details === 'string' ? body.details : body.details && JSON.stringify(body.details)].filter(Boolean).join(': '));
  return body.address;
}

export async function geocodeAddress(country, location) {
  const res = await fetch(`${API_BASE_URL}/address/geocode?country=${encodeURIComponent(country || 'GBR')}&location=${encodeURIComponent(location)}`);
  const body = await res.json();
  if (!res.ok) throw new Error([body.error || `geocode failed: ${res.status}`, typeof body.details === 'string' ? body.details : body.details && JSON.stringify(body.details)].filter(Boolean).join(': '));
  return body.coordinates;
}

// Adds an Additional Venue to an already-accredited school: new Training_Centres record
// plus its own Accreditation_Centre_Link and course offerings, reusing the existing Account
// and Training_Centre_Accred rather than starting a fresh accreditation.
export async function createVenue(payload) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/venues`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ httpStatus: res.status, ...body }, null, 2));
  }
  return body.venue;
}

export async function createVenueCheckoutSession(payload) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/payments/venue-checkout`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify({ httpStatus: res.status, ...body }, null, 2));
  }
  return body;
}

// Course Offerings this accreditation actually has approved, for the "which course"
// dropdown when creating a Diary Date session.
export async function fetchCourseOfferings(id, contactId) {
  const res = await fetch(`${API_BASE_URL}/accreditations/${encodeURIComponent(id)}/course-offerings?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `course offerings lookup failed: ${res.status}`);
  return body.offerings || [];
}

// Active tutors linked to this school, for the "which tutor" dropdown on a session.
export async function fetchTutorOptions(id, contactId) {
  const res = await fetch(`${API_BASE_URL}/accreditations/${encodeURIComponent(id)}/tutor-options?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `tutor options lookup failed: ${res.status}`);
  return body.tutors || [];
}

// Diary Date course sessions for this school, read from Creator. Places Booked/Remaining
// are computed from the live Diary_Date_Bookings rows, not trusted from the session record.
export async function fetchSessions(id, contactId) {
  const res = await fetch(`${API_BASE_URL}/accreditations/${encodeURIComponent(id)}/sessions?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `sessions lookup failed: ${res.status}`);
  return body.sessions || [];
}

export async function createSession(id, payload) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/accreditations/${encodeURIComponent(id)}/sessions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `session save failed: ${res.status}`);
  return body.session;
}

// Bookings against one specific session - who's booked, how many places and their status.
export async function fetchSessionBookings(id, sessionId, contactId) {
  const res = await fetch(`${API_BASE_URL}/accreditations/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sessionId)}/bookings?contactId=${encodeURIComponent(contactId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `session bookings lookup failed: ${res.status}`);
  return body.bookings || [];
}

export async function bookSession(id, sessionId, payload) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/accreditations/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sessionId)}/bookings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `booking save failed: ${res.status}`);
  return body.booking;
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
