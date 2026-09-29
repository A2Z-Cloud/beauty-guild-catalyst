const express = require('express');
const catalyst = require('zcatalyst-sdk-node');

const app = express();
app.use(express.json());







const CRM_API_DOMAIN = process.env.CRM_API_DOMAIN || 'https://www.zohoapis.eu';
const CRM_CONNECTION_NAME = process.env.CRM_CONNECTION_NAME || 'zohocrm';
const WORKDRIVE_API_DOMAIN = process.env.WORKDRIVE_API_DOMAIN || 'https://www.zohoapis.eu';
const WORKDRIVE_CONNECTION_NAME = process.env.WORKDRIVE_CONNECTION_NAME || 'zohoworkdrive';
const CREATOR_API_DOMAIN = process.env.CREATOR_API_DOMAIN || 'https://www.zohoapis.eu';
const CREATOR_CONNECTION_NAME = process.env.CREATOR_CONNECTION_NAME || 'zohocreator';
const CREATOR_ACCOUNT_OWNER = process.env.CREATOR_ACCOUNT_OWNER || 'beautyguild';
const CREATOR_APP_LINK_NAME = process.env.CREATOR_APP_LINK_NAME || 'beautyguild';
const CREATOR_INVOICES_REPORT = process.env.CREATOR_INVOICES_REPORT || 'All_Invoice_Records';
const MEMBERSHIP_MODULE = 'Membership';
const LOQATE_API_BASE_URL = process.env.LOQATE_API_BASE_URL || 'https://api.addressy.com';
const STRIPE_API_BASE_URL = 'https://api.stripe.com/v1';

// Mirrors the pricing constants in public/membership-quote.js - kept in sync deliberately
// (the quote step-by-step UI computes and *shows* these figures; this authoritative copy is
// what the checkout endpoint actually charges, so a tampered client request can't buy a
// membership below its real price). Gross (VAT-inclusive) figures, same source as the front
// end: derived from the customer's Fees Table net values.
//
// membershipNet/joiningNet come straight from the Fees Table, not a flat /1.2 of the gross -
// the membership fee itself is split across a zero-rated element and a standard-rated element
// (e.g. Full Member: £35.70 zero-rated + £10.75 standard-rated = £46.45 net, £48.60 gross), so
// dividing the combined gross by 1.2 would give the wrong net figure.
const MEMBERSHIP_LEVELS = {
	associate: { name: 'Associate Member', membershipGross: 55.00, membershipNet: 51.78, joiningGross: 10.00, joiningNet: 8.33 },
	full_non_salon: { name: 'Full Member (Non-Salon)', membershipGross: 48.60, membershipNet: 46.45, joiningGross: 10.00, joiningNet: 8.33 },
	full_salon: { name: 'Full Member (Salon)', membershipGross: 48.60, membershipNet: 46.45, joiningGross: 10.00, joiningNet: 8.33 },
	international: { name: 'International Member', membershipGross: null, membershipNet: null, joiningGross: null, joiningNet: null },
};
const MEMBERSHIP_BRANCHES = {
	beauty: 'Guild of Beauty Therapists',
	holistic: 'Guild of Holistic Therapists',
	nails: 'Guild of Nail Technicians',
	hair: 'Guild of Hairdressers & Barbers',
};
const MEMBERSHIP_BRANCH_ADDON_GROSS = 15.00;
const MEMBERSHIP_BRANCH_ADDON_NET = 12.50;
const MEMBERSHIP_ADDONS = {
	bundle: { name: 'Membership bundle', priceGross: 10.00, priceNet: 8.33 },
	certificate: { name: 'Additional certificate', priceGross: 4.00, priceNet: 3.33 },
	badge: { name: 'Additional badge', priceGross: 4.00, priceNet: 3.33 },
	sticker: { name: 'Additional window sticker', priceGross: 4.00, priceNet: 3.33 },
};

// Before a school name is ever typed, a draft needs *some* value for the (mandatory) CRM
// Account_Name / Training_Centres.Name fields - "Draft application - <contactId>" - written
// in /accreditations/draft below. That's purely an internal placeholder and must never be
// shown back to the applicant as if it were a real school name; every endpoint that surfaces
// an Account/Training Centre name needs to filter it out at the point of output.
function stripDraftPlaceholder(name) {
	return name && /^Draft application - /.test(name) ? null : name || null;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// CRM's /search endpoints lag real writes by up to ~20-30s (confirmed repeatedly elsewhere
// in this file) - unlike a direct fetch-by-id, which is consistent immediately. A record
// that can only be found via search (there's no single id to fetch it by, or we only have
// the parent's id) can therefore come back empty for a short window right after being
// created - which is exactly what made a draft resumed shortly after saving look like it
// had lost its school/course/link data. Retries a few times before accepting an empty
// result. Only retries on a genuinely empty result (204/no rows), never on a real error.
async function searchWithRetry(url, headers, { attempts = 3, delayMs = 1500 } = {}) {
	for (let i = 0; i < attempts; i++) {
		const res = await fetch(url, { headers });
		if (res.status === 204) {
			if (i < attempts - 1) { await sleep(delayMs); continue; }
			return [];
		}
		if (!res.ok) return [];
		const data = (await res.json()).data || [];
		if (data.length || i === attempts - 1) return data;
		await sleep(delayMs);
	}
	return [];
}
const COURSE_FIELDS = [
	'Name', 'Status', 'Course_Type', 'Duration', 'CPD_Points',
	'Member_Price', 'Non_Member_Price', 'Course_Category', 'Treatment_Group', 'Entry_Requirements',
];
const QUALIFICATION_FIELDS = [
	'Name', 'Account', 'Contact', 'Member_Profile', 'Primary_Accreditation',
	'Date_Completed_Month', 'Date_Completed_Year', 'Practical_Delivery_Type',
	'Practical_Delivery_Other', 'Practical_Assessment_Type', 'Practical_Assessment_Other',
	'Verification_Status',
];
const QUALIFICATION_DELIVERY_TYPES = ['Face to Face In the Classroom', 'Face to Face via Live Video Link', 'Online only', 'Other'];
const QUALIFICATION_ASSESSMENT_TYPES = ['Face to Face In the Classroom', 'Face to Face via Live Video Link', 'Case Studies - Submitting Photographs', 'Case Studies - Submitting Videos', 'Other'];

app.get('/contacts/lookup', async (req, res) => {
	const email = req.query.email;
	if (!email) {
		return res.status(400).json({ error: 'email is required' });
	}

	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		const fields = [
			'Email', 'First_Name', 'Last_Name', 'Salutation', 'Phone', 'Mobile', 'Interests',
			'Correspondence_Address_Line_1', 'Correspondence_Address_Line_2', 'Correspondence_Postcode',
			'Correspondence_Town', 'Correspondence_County', 'Correspondence_Country',
		].join(',');
		const crmRes = await fetch(
			`${CRM_API_DOMAIN}/crm/v3/Contacts/search?email=${encodeURIComponent(email)}&fields=${fields}`,
			{ headers }
		);

		if (crmRes.status === 204) {
			return res.json({ exists: false });
		}

		if (!crmRes.ok) {
			console.log('CRM contact search failed', crmRes.status, await crmRes.text());
			return res.status(502).json({ error: 'CRM lookup failed' });
		}

		const { data } = await crmRes.json();
		const contact = data && data[0];

		res.json({
			exists: !!contact,
			contact: contact ? {
				id: contact.id,
				title: contact.Salutation,
				firstName: contact.First_Name,
				lastName: contact.Last_Name,
				email: contact.Email,
				phone: contact.Phone,
				mobile: contact.Mobile,
				interests: contact.Interests || [],
				addressLine1: contact.Correspondence_Address_Line_1,
				addressLine2: contact.Correspondence_Address_Line_2,
				postcode: contact.Correspondence_Postcode,
				town: contact.Correspondence_Town,
				county: contact.Correspondence_County,
				country: contact.Correspondence_Country,
			} : null,
		});
	} catch (err) {
		console.log('identity lookup error', err && err.stack ? err.stack : err);
		res.status(502).json({ error: 'CRM contact lookup unavailable' });
	}
});

app.get('/courses', async (req, res) => {
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		const crmRes = await fetch(
			`${CRM_API_DOMAIN}/crm/v3/Courses/search?criteria=((Status:equals:Active)and(Course_Type:equals:GTI))&fields=${COURSE_FIELDS.join(',')}`,
			{ headers }
		);

		if (crmRes.status === 204) {
			return res.json({ courses: [] });
		}

		if (!crmRes.ok) {
			console.log('CRM courses search failed', crmRes.status, await crmRes.text());
			return res.status(502).json({ error: 'CRM courses lookup failed' });
		}

		const { data } = await crmRes.json();
		const courses = (data || []).map((c) => ({
			id: c.id,
			name: c.Name,
			category: c.Course_Category || null,
			treatmentGroup: c.Treatment_Group || null,
			courseType: c.Course_Type || null,
			duration: c.Duration || null,
			cpdPoints: c.CPD_Points ?? null,
			memberPrice: c.Member_Price ?? null,
			nonMemberPrice: c.Non_Member_Price ?? null,
			entryRequirements: c.Entry_Requirements || null,
		}));

		res.json({ courses });
	} catch (err) {
		console.log('get courses error', err);
		res.status(500).json({ error: 'Internal error' });
	}
});

const DEAL_MEMBERSHIP_FIELDS = [
	'Stage', 'Membership_Type', 'Membership_Branch', 'Membership_Subscription_Type', 'Expiry_Date',
	'Start_Date', 'Contact_Name', 'Member_Profile',
];

// Matched by prefix, case-insensitively, not exact equality - real Deal records mix nicely-cased
// CRM picklist values ("Associate Member") with raw lowercase internal level ids the Creator
// webhook also writes ("full_salon", "full_non_salon"), so both a hardcoded exact-match list and
// a case-sensitive prefix check reject genuine active memberships.
const MEMBERSHIP_TYPE_PREFIXES = ['Associate', 'Full', 'International'];
function matchedMembershipTypePrefix(membershipType) {
	if (!membershipType) return null;
	const lower = membershipType.toLowerCase();
	return MEMBERSHIP_TYPE_PREFIXES.find((prefix) => lower.startsWith(prefix.toLowerCase())) || null;
}
// Full outranks Associate - a member who has since paid for a Full membership should see that
// one as "current", not an older Associate Deal that was never closed out in CRM once the
// upgrade went through. International isn't a genuine "higher" tier, just a distinct route,
// but ranked above Associate since the two shouldn't co-exist in practice.
const MEMBERSHIP_TIER_RANK = { Full: 3, International: 2, Associate: 1 };
function membershipTierRank(membershipType) {
	const prefix = matchedMembershipTypePrefix(membershipType);
	return prefix ? MEMBERSHIP_TIER_RANK[prefix] : 0;
}
// Deal_Name/Membership_Type sometimes carries the raw internal level id (e.g. "full_non_salon")
// rather than the picklist's display name - MEMBERSHIP_LEVELS is the same lookup the checkout
// endpoint uses to price it, so it's the one source of truth to translate that back to
// something a member would recognise. Falls through unchanged for values already human-readable
// (e.g. "Associate Member").
function membershipTypeLabel(rawType) {
	return (MEMBERSHIP_LEVELS[rawType] && MEMBERSHIP_LEVELS[rawType].name) || rawType || null;
}
function normaliseForMatch(value) {
	return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
// Resolves a Deal's raw Membership_Type back to the level id (associate/full_non_salon/...)
// the checkout endpoint and the front-end's own quote wizard use - needed to pre-fill a
// renewal quote. Matches loosely (letters/digits only) since real records mix the level's own
// key ("full_salon"), its proper display name ("Full Member (Salon)"), and a mis-formatted
// variant from a newer part of the Creator automation ("Full Member Salon", no punctuation).
function membershipLevelKey(rawType) {
	if (!rawType) return null;
	if (MEMBERSHIP_LEVELS[rawType]) return rawType;
	const normalised = normaliseForMatch(rawType);
	const match = Object.entries(MEMBERSHIP_LEVELS).find(([, level]) => normaliseForMatch(level.name) === normalised);
	return match ? match[0] : null;
}
// Same idea for Membership_Branch - resolves back to the branch id (beauty/holistic/nails/hair).
// One known bad variant from the Creator automation ("Guild of Hairdresser and Barber", missing
// the plural "s") differs by more than punctuation, so it needs an explicit alias rather than
// relying on the same loose normalisation used for membership level.
const MEMBERSHIP_BRANCH_ALIASES = { 'Guild of Hairdresser and Barber': 'hair' };
function membershipBranchKey(rawBranch) {
	if (!rawBranch) return null;
	if (MEMBERSHIP_BRANCHES[rawBranch]) return rawBranch;
	if (MEMBERSHIP_BRANCH_ALIASES[rawBranch]) return MEMBERSHIP_BRANCH_ALIASES[rawBranch];
	const normalised = normaliseForMatch(rawBranch);
	const match = Object.entries(MEMBERSHIP_BRANCHES).find(([, name]) => normaliseForMatch(name) === normalised);
	return match ? match[0] : null;
}
function isCurrentMembership(deal, today) {
	if (deal.Stage !== 'Active') return false;
	if (!matchedMembershipTypePrefix(deal.Membership_Type)) return false;
	if (deal.Start_Date && deal.Start_Date > today) return false;
	if (deal.Expiry_Date && deal.Expiry_Date < today) return false;
	return !!(deal.Member_Profile && deal.Member_Profile.id);
}

async function getMembershipDecision(headers, contactId, startDate, expiryDate) {
	const today = new Date().toISOString().slice(0, 10);
	const dealRes = await fetch(
		`${CRM_API_DOMAIN}/crm/v3/Deals/search?criteria=(Contact_Name:equals:${encodeURIComponent(contactId)})&fields=${DEAL_MEMBERSHIP_FIELDS.join(',')}`,
		{ headers }
	);
	if (!dealRes.ok && dealRes.status !== 204) {
		console.log('CRM membership Deals lookup failed', dealRes.status, await dealRes.text());
		throw new Error('Membership lookup failed');
	}
	const dealBody = dealRes.status === 204 ? { data: [] } : await dealRes.json();
	// A member can end up with more than one Active Deal at once (e.g. an Associate Membership
	// that was never closed out in CRM once they paid for a Full upgrade) - the highest tier
	// wins, and the most recently started Deal breaks any tie within the same tier, rather than
	// picking whichever one CRM's search happens to return first.
	const activeDeal = (dealBody.data || [])
		.filter((deal) => isCurrentMembership(deal, today))
		.sort((a, b) => membershipTierRank(b.Membership_Type) - membershipTierRank(a.Membership_Type) || (b.Start_Date || '').localeCompare(a.Start_Date || ''))[0];
	const membershipStart = startDate || today;
	// Runs to the day before the anniversary of the start date (e.g. 1 Sept 26 - 31 Aug 27),
	// not the exact same calendar date a year later - matters for insurance continuity.
	const membershipExpiry = expiryDate || annualPeriodEnd(membershipStart);
	return activeDeal ? {
		membershipRequired: false,
		membershipStatus: 'active',
		membershipType: membershipTypeLabel(activeDeal.Membership_Type),
		membershipStart: activeDeal.Start_Date || null,
		membershipExpiry: activeDeal.Expiry_Date || null,
		membershipId: activeDeal.Member_Profile && activeDeal.Member_Profile.id || null,
		dealId: activeDeal.id,
		// For pre-filling a renewal quote - the raw ids the checkout endpoint and the quote
		// wizard itself use, not the display label above.
		membershipLevelId: membershipLevelKey(activeDeal.Membership_Type),
		primaryBranchId: membershipBranchKey(activeDeal.Membership_Branch),
		subscriptionType: activeDeal.Membership_Subscription_Type ? activeDeal.Membership_Subscription_Type.toLowerCase() : null,
	} : {
		membershipRequired: true,
		membershipStatus: 'new',
		membershipType: 'Associate',
		membershipStart,
		membershipExpiry,
	};
}

const DEAL_HISTORY_FIELDS = [
	'Deal_Name', 'Stage', 'Membership_Type', 'Membership_Branch', 'Expiry_Date', 'Start_Date',
	'Contact_Name', 'Member_Profile', 'Membership_Subscription_Type', 'Amount', 'Created_Time',
	'Joining_Fee', 'Payment_Status', 'Payment_Method', 'Insurance_Requested', 'Next_Payment_Date',
	'Cancellation_Reason',
];

// Every Deal for this contact, not just the currently-active one - the Creator webhook that
// should flip a Deal to Active (and create one for every successful payment) is still being
// finished on the CRM side, so paid-but-"Awaiting Payment" quotes need to stay visible here
// rather than silently disappearing until that automation is complete.
app.get('/memberships/history', async (req, res) => {
	const contactId = req.query.contactId;
	if (!contactId) return res.status(400).json({ error: 'contactId is required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		const dealRes = await fetch(
			`${CRM_API_DOMAIN}/crm/v3/Deals/search?criteria=(Contact_Name:equals:${encodeURIComponent(contactId)})&fields=${DEAL_HISTORY_FIELDS.join(',')}`,
			{ headers }
		);
		if (!dealRes.ok && dealRes.status !== 204) {
			console.log('CRM membership history lookup failed', dealRes.status, await dealRes.text());
			return res.status(502).json({ error: 'Membership history lookup failed' });
		}
		const dealBody = dealRes.status === 204 ? { data: [] } : await dealRes.json();
		const memberships = (dealBody.data || [])
			.map((deal) => ({
				dealId: deal.id,
				name: deal.Deal_Name || null,
				membershipType: membershipTypeLabel(deal.Membership_Type),
				branch: MEMBERSHIP_BRANCHES[deal.Membership_Branch] || deal.Membership_Branch || null,
				stage: deal.Stage || null,
				subscriptionType: deal.Membership_Subscription_Type || null,
				startDate: deal.Start_Date || null,
				expiryDate: deal.Expiry_Date || null,
				amount: deal.Amount ?? null,
				joiningFee: deal.Joining_Fee ?? null,
				paymentStatus: deal.Payment_Status || null,
				paymentMethod: deal.Payment_Method || null,
				insuranceRequested: !!deal.Insurance_Requested,
				nextPaymentDate: deal.Next_Payment_Date || null,
				cancellationReason: deal.Cancellation_Reason || null,
				createdTime: deal.Created_Time || null,
			}))
			.sort((a, b) => (b.createdTime || '').localeCompare(a.createdTime || ''));
		res.json({ memberships });
	} catch (err) {
		console.log('membership history error', err);
		res.status(500).json({ error: 'Internal error' });
	}
});

// Invoices for a specific membership Deal - Creator's All_Invoice_Records report carries a
// crm_membership_id field that stores exactly this Deal id (confirmed against a real invoice,
// same linking pattern as crm_contact_id for accreditation invoices).
app.get('/memberships/:dealId/invoices', async (req, res) => {
	const { dealId } = req.params;
	const contactId = req.query.contactId;
	if (!dealId || !contactId) return res.status(400).json({ error: 'dealId and contactId are required' });

	try {
		const catalystApp = catalyst.initialize(req);
		const { headers: crmHeaders } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		const dealRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Deals/${dealId}?fields=Contact_Name`, { headers: crmHeaders });
		if (!dealRes.ok || dealRes.status === 204) return res.status(404).json({ error: 'Membership not found' });
		const dealBody = await dealRes.json();
		const deal = dealBody.data && dealBody.data[0];
		if (!deal || deal.Contact_Name && deal.Contact_Name.id !== contactId) return res.status(404).json({ error: 'Membership not found' });

		const { headers: creatorHeaders } = await catalystApp.connections().getConnectionCredentials(CREATOR_CONNECTION_NAME);
		const criteria = encodeURIComponent(`crm_membership_id == "${dealId}"`);
		const url = `${CREATOR_API_DOMAIN}/creator/v2.1/data/${CREATOR_ACCOUNT_OWNER}/${CREATOR_APP_LINK_NAME}/report/${CREATOR_INVOICES_REPORT}?field_config=all&max_records=200&criteria=${criteria}`;
		const creatorRes = await fetch(url, { headers: creatorHeaders });
		const creatorBody = await creatorRes.json();
		if (!creatorRes.ok || creatorBody.code !== 3000) {
			if (creatorBody.code === 9280) return res.json({ invoices: [] });
			console.log('Creator membership invoices lookup failed', creatorRes.status, JSON.stringify(creatorBody));
			return res.status(502).json({ error: 'Could not load invoices' });
		}

		const invoices = (creatorBody.data || [])
			.map((r) => ({
				id: r.ID,
				invoiceNumber: r.invoice_number || null,
				invoiceDate: r.invoice_date || null,
				dueDate: r.due_date || null,
				paymentDate: r.payment_date || null,
				amount: r.payment_amount ? Number(r.payment_amount) : null,
				status: r.invoice_status || null,
			}))
			.sort((a, b) => Number(b.invoiceNumber) - Number(a.invoiceNumber));

		res.json({ invoices });
	} catch (err) {
		console.log('membership invoices lookup error', err);
		res.status(502).json({ error: 'Invoices lookup failed' });
	}
});

// The branches and addons (bundle/certificate/badge/window sticker) purchased with a
// membership, from the Membership_Extension module - confirmed as its real API name (the CRM
// UI's own tab URL shows the generic internal alias "CustomModule4" instead), linked back to
// the Deal via its own "Membership_Extension" lookup field.
app.get('/memberships/:dealId/extensions', async (req, res) => {
	const { dealId } = req.params;
	const contactId = req.query.contactId;
	if (!dealId || !contactId) return res.status(400).json({ error: 'dealId and contactId are required' });

	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		const dealRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Deals/${dealId}?fields=Contact_Name`, { headers });
		if (!dealRes.ok || dealRes.status === 204) return res.status(404).json({ error: 'Membership not found' });
		const dealBody = await dealRes.json();
		const deal = dealBody.data && dealBody.data[0];
		if (!deal || deal.Contact_Name && deal.Contact_Name.id !== contactId) return res.status(404).json({ error: 'Membership not found' });

		const extRes = await fetch(
			`${CRM_API_DOMAIN}/crm/v3/Membership_Extension/search?criteria=(Membership_Extension:equals:${encodeURIComponent(dealId)})`,
			{ headers }
		);
		const extBody = extRes.status === 204 ? { data: [] } : await extRes.json();
		if (!extRes.ok && extRes.status !== 204) {
			console.log('CRM membership extensions lookup failed', extRes.status, JSON.stringify(extBody));
			return res.status(502).json({ error: 'Could not load addons' });
		}

		const extensions = (extBody.data || []).map((e) => {
			const branchKey = membershipBranchKey(e.Membership_Branch);
			return {
				id: e.id,
				type: e.Extension_Type || null,
				// membershipBranchKey resolves the real/near-match branch names and returns null
				// for anything unrecognised - a Creator automation bug can write a raw placeholder
				// token into Membership_Branch instead of the actual branch, and that must never
				// be shown to the member as if it were their selection.
				branch: branchKey ? MEMBERSHIP_BRANCHES[branchKey] : null,
				quantity: e.Quantity ?? null,
				basePrice: e.Base_Price ?? null,
				finalPrice: e.Final_Price ?? null,
				status: e.Status || null,
			};
		});

		res.json({ extensions });
	} catch (err) {
		console.log('membership extensions lookup error', err);
		res.status(502).json({ error: 'Addons lookup failed' });
	}
});

// Confirms this membership Deal actually belongs to the given contact before letting them
// read or change anything on it - a CRM record id in a URL is not itself permission.
async function assertOwnsMembership(headers, dealId, contactId) {
	const dealRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Deals/${dealId}?fields=Contact_Name`, { headers });
	if (!dealRes.ok || dealRes.status === 204) return null;
	const dealBody = await dealRes.json();
	const deal = dealBody.data && dealBody.data[0];
	if (!deal || (deal.Contact_Name && deal.Contact_Name.id !== contactId)) return null;
	return deal;
}

// Buys an extra add-on (bundle/certificate/badge/sticker) against an already-active
// membership, from the Membership page's Add-ons tab - not part of the initial quote or
// renewal wizard. Same price list as the initial purchase; the resulting Membership_Extension
// record is created by the same Creator webhook that already handles every other membership
// Stripe event, keyed off membership_deal_id in metadata rather than a new mechanism.
app.post('/payments/membership-addon-checkout', async (req, res) => {
	const { dealId, contactId, email, name, addons } = req.body || {};
	if (!dealId || !contactId || !email) {
		return res.status(400).json({ error: 'dealId, contactId and email are required' });
	}
	const addonQuantities = addons && typeof addons === 'object' ? addons : {};
	const lineItems = [];
	const addonAmounts = {};
	let totalGross = 0;
	for (const [id, qty] of Object.entries(addonQuantities)) {
		const addon = MEMBERSHIP_ADDONS[id];
		if (!addon) return res.status(400).json({ error: `Unknown addonId: ${id}` });
		const quantity = Math.max(0, Math.min(10, Number(qty) || 0));
		if (!quantity) continue;
		const amount = addon.priceGross * quantity;
		addonAmounts[id] = amount.toFixed(2);
		totalGross += amount;
		lineItems.push({ price_data: { currency: 'gbp', product_data: { name: addon.name }, unit_amount: Math.round(addon.priceGross * 100) }, quantity });
	}
	if (!lineItems.length) return res.status(400).json({ error: 'Select at least one add-on' });
	if (!process.env.STRIPE_SECRET_KEY) {
		return res.status(503).json({ error: 'Stripe checkout is not configured' });
	}
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		const deal = await assertOwnsMembership(headers, dealId, contactId);
		if (!deal) return res.status(404).json({ error: 'Membership not found' });

		const params = new URLSearchParams();
		params.set('mode', 'payment');
		params.set('success_url', process.env.STRIPE_SUCCESS_URL || `${req.protocol}://${req.get('host')}/app/index.html?payment=success`);
		params.set('cancel_url', process.env.STRIPE_CANCEL_URL || `${req.protocol}://${req.get('host')}/app/index.html?payment=cancelled`);
		params.set('customer_email', email);
		lineItems.forEach((item, i) => {
			params.set(`line_items[${i}][price_data][currency]`, item.price_data.currency);
			params.set(`line_items[${i}][price_data][product_data][name]`, item.price_data.product_data.name);
			params.set(`line_items[${i}][price_data][unit_amount]`, String(item.price_data.unit_amount));
			params.set(`line_items[${i}][quantity]`, String(item.quantity));
		});
		const metadata = {
			type: 'membership_addon',
			membership_deal_id: dealId,
			contact_id: contactId,
			email, name: name || '',
			addons: JSON.stringify(addonQuantities),
			bundle_amount: addonAmounts.bundle || '0.00',
			certificate_amount: addonAmounts.certificate || '0.00',
			badge_amount: addonAmounts.badge || '0.00',
			sticker_amount: addonAmounts.sticker || '0.00',
			total_amount: totalGross.toFixed(2),
			currency: 'GBP',
			status: 'pending',
		};
		for (const [key, value] of Object.entries(metadata)) params.set(`metadata[${key}]`, String(value));
		const stripeRes = await fetch(`${STRIPE_API_BASE_URL}/checkout/sessions`, {
			method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params,
		});
		const body = await stripeRes.json();
		if (!stripeRes.ok) {
			console.log('Stripe membership addon checkout creation failed', stripeRes.status, body);
			return res.status(502).json({ error: 'Stripe checkout creation failed', details: body });
		}
		res.json({ checkoutUrl: body.url, sessionId: body.id });
	} catch (err) {
		console.log('Membership addon checkout error', err);
		res.status(502).json({ error: 'Stripe checkout unavailable', details: err.message });
	}
});

// Removes a purchased add-on directly - this only deletes the CRM Membership_Extension
// record itself. It never touches Branch-type rows (removing a branch has bigger knock-on
// effects than removing a certificate/badge/sticker and isn't part of this feature), and it
// doesn't issue a refund - whether a removed add-on is refundable is a Finance decision this
// endpoint doesn't make on its own.
app.delete('/memberships/:dealId/extensions/:extensionId', async (req, res) => {
	const { dealId, extensionId } = req.params;
	const contactId = req.query.contactId;
	if (!dealId || !extensionId || !contactId) return res.status(400).json({ error: 'dealId, extensionId and contactId are required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		const deal = await assertOwnsMembership(headers, dealId, contactId);
		if (!deal) return res.status(404).json({ error: 'Membership not found' });
		const extRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Membership_Extension/${extensionId}?fields=Extension_Type,Membership_Extension`, { headers });
		if (!extRes.ok || extRes.status === 204) return res.status(404).json({ error: 'Add-on not found' });
		const extBody = await extRes.json();
		const extension = extBody.data && extBody.data[0];
		if (!extension || !extension.Membership_Extension || extension.Membership_Extension.id !== dealId) {
			return res.status(404).json({ error: 'Add-on not found' });
		}
		if (extension.Extension_Type === 'Branch') return res.status(400).json({ error: 'Additional branches cannot be removed here' });
		await crmDelete(headers, 'Membership_Extension', [extensionId]);
		res.json({ deleted: true });
	} catch (err) {
		console.log('membership extension delete error', err);
		res.status(502).json({ error: 'Add-on could not be removed', details: err.details || err.message });
	}
});

// Checks membership eligibility for pricing. This endpoint is deliberately read-only:
// Membership profiles are created by the payment webhook after successful payment.
app.post('/memberships/resolve', async (req, res) => {
	const { contactId, startDate, expiryDate } = req.body || {};
	if (!contactId) return res.status(400).json({ error: 'contactId is required' });

	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		res.json(await getMembershipDecision(headers, contactId, startDate, expiryDate));
	} catch (err) {
		console.log('membership resolution error', err && err.stack ? err.stack : err);
		res.status(502).json({ error: 'Membership resolution failed' });
	}
});

function loqateUrl(path, params) {
	const url = new URL(`${LOQATE_API_BASE_URL}${path}`);
	url.search = new URLSearchParams({ Key: process.env.LOQATE_API_KEY || '', ...params }).toString();
	return url;
}

function getLoqateItems(body) {
	const items = Array.isArray(body && body.Items) ? body.Items : [];
	const failure = items.find((item) => item && item.Error);
	if (failure) {
		const err = new Error(failure.Description || failure.Cause || failure.Error || 'Loqate request failed');
		err.details = { code: failure.Error, description: failure.Description || failure.Cause || null };
		throw err;
	}
	return items;
}

function mapLoqateAddress(item) {
	const physicalLine = [item.SubBuilding, item.BuildingName, item.BuildingNumber, item.Street].filter(Boolean).join(' ').trim();
	const addressLine1 = item.Line1 || item.Company || physicalLine || '';
	const addressLine2 = item.Line2 || (!item.Line1 && item.Company && physicalLine && physicalLine !== addressLine1 ? physicalLine : '');
	return {
		addressLine1,
		addressLine2,
		addressLine3: item.Line3 || '',
		town: item.City || '',
		county: item.ProvinceName || item.AdminAreaName || item.Province || '',
		postcode: item.PostalCode || '',
		country: item.CountryName || '',
	};
}

app.get('/address/find', async (req, res) => {
	const text = String(req.query.text || '').trim();
	if (!text) return res.status(400).json({ error: 'text is required' });
	try {
		const params = { Text: text };
		if (req.query.container) params.Container = String(req.query.container);
		if (process.env.LOQATE_COUNTRY_FILTER) params.Countries = process.env.LOQATE_COUNTRY_FILTER;
		const loqateRes = await fetch(loqateUrl('/Capture/Interactive/Find/v1.10/json3.ws', params));
		const body = await loqateRes.json();
		if (!loqateRes.ok) return res.status(502).json({ error: 'Loqate address search failed', details: body });
		const maxResults = Math.max(1, Number(process.env.LOQATE_MAX_RESULTS) || 40);
		res.json({ items: getLoqateItems(body).slice(0, maxResults) });
	} catch (err) {
		console.log('Loqate find error', err);
		res.status(502).json({ error: 'Address search unavailable', details: err.details || err.message });
	}
});

app.get('/address/retrieve', async (req, res) => {
	const id = String(req.query.id || '').trim();
	if (!id) return res.status(400).json({ error: 'id is required' });
	try {
		const loqateRes = await fetch(loqateUrl('/Capture/Interactive/Retrieve/v1.30/json6.ws', { Id: id }));
		const body = await loqateRes.json();
		if (!loqateRes.ok) return res.status(502).json({ error: 'Loqate address retrieve failed', details: body });
		const item = getLoqateItems(body)[0] || null;
		res.json({ address: item ? mapLoqateAddress(item) : null });
	} catch (err) {
		console.log('Loqate retrieve error', err);
		res.status(502).json({ error: 'Address retrieve unavailable', details: err.details || err.message });
	}
});

app.get('/address/geocode', async (req, res) => {
	const requestedCountry = String(req.query.country || 'GBR');
	const country = requestedCountry === 'United Kingdom' ? 'GBR' : requestedCountry;
	const location = String(req.query.location || '').trim();
	if (!location) return res.status(400).json({ error: 'location is required' });
	try {
		const loqateRes = await fetch(loqateUrl('/Geocoding/International/Geocode/v1.10/json6.ws', { Country: country, Location: location }));
		const body = await loqateRes.json();
		if (!loqateRes.ok) return res.status(502).json({ error: 'Loqate geocode failed', details: body });
		const item = getLoqateItems(body)[0] || null;
		res.json({ coordinates: item ? { latitude: item.Latitude, longitude: item.Longitude } : null });
	} catch (err) {
		console.log('Loqate geocode error', err);
		res.status(502).json({ error: 'Geocoding unavailable', details: err.details || err.message });
	}
});

app.post('/payments/checkout', async (req, res) => {
	const { accreditationId, applicationId, contactId, email, name } = req.body || {};
	if (!accreditationId || !contactId || !email) {
		return res.status(400).json({ error: 'accreditationId, contactId and email are required' });
	}
	let membership;
	let crmHeaders;
	let international = false;
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		crmHeaders = headers;
		const accreditationRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Training_Centre_Accred/${accreditationId}?fields=Application_Stage,Accreditation_Status,Accreditation_Level,Payment_Status,Stripe_Checkout_Session_ID,Stripe_Payment_Link`, { headers });
		if (accreditationRes.ok && accreditationRes.status !== 204) {
			const accreditationBody = await accreditationRes.json();
			const accreditation = accreditationBody.data && accreditationBody.data[0];
			international = accreditation && accreditation.Accreditation_Level === 'International Accreditation Annual';
			const paymentStatus = String(accreditation && accreditation.Payment_Status || '').toLowerCase();
			if (['paid', 'succeeded', 'completed', 'payment received'].includes(paymentStatus)) {
				return res.json({ alreadyPaid: true, paymentStatus: accreditation.Payment_Status, checkoutUrl: null });
			}
			const existingSessionId = accreditation && accreditation.Stripe_Checkout_Session_ID;
			const existingPaymentLink = accreditation && accreditation.Stripe_Payment_Link;
			if (existingSessionId && process.env.STRIPE_SECRET_KEY) {
				const sessionRes = await fetch(`${STRIPE_API_BASE_URL}/checkout/sessions/${encodeURIComponent(existingSessionId)}`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } });
				if (sessionRes.ok) {
					const session = await sessionRes.json();
					if (session.payment_status === 'paid') return res.json({ alreadyPaid: true, paymentStatus: 'Paid', checkoutUrl: null });
					if (session.status === 'open' && session.url) return res.json({ reused: true, checkoutUrl: session.url, sessionId: session.id });
				}
			}
			if (!existingSessionId && existingPaymentLink) return res.json({ reused: true, checkoutUrl: existingPaymentLink });
		}
		membership = await getMembershipDecision(headers, contactId);
	} catch (err) {
		console.log('Checkout membership check failed', err && err.stack ? err.stack : err);
		return res.status(502).json({ error: 'Membership check failed; checkout was not created', details: err.details || err.message });
	}
	const membershipRequired = membership.membershipRequired;
	const membershipId = membership.membershipId || '';
	const accreditationPrice = process.env.STRIPE_PRICE_ACCREDITATION;
	const combinedPrice = process.env.STRIPE_PRICE_ASSOCIATE_MEMBERSHIP;
	// International Membership has no fixed price ("confirmed by our team" everywhere else in
	// this flow too), so there's no combined Price for it to charge here - an international
	// school requiring membership still only pays for the accreditation itself via checkout,
	// same Price as a standalone accreditation, and membership gets sorted out manually.
	const bundleRequired = membershipRequired && !international;
	if (!process.env.STRIPE_SECRET_KEY || !accreditationPrice || (bundleRequired && !combinedPrice)) {
		return res.status(503).json({ error: 'Stripe checkout is not configured' });
	}
	try {
		const params = new URLSearchParams();
		params.set('mode', 'payment');
		params.set('success_url', process.env.STRIPE_SUCCESS_URL || `${req.protocol}://${req.get('host')}/app/index.html?payment=success`);
		params.set('cancel_url', process.env.STRIPE_CANCEL_URL || `${req.protocol}://${req.get('host')}/app/index.html?payment=cancelled`);
		params.set('customer_email', email);
		// The membership Price is a combined £409 product, not an additional line item.
		params.set('line_items[0][price]', bundleRequired ? combinedPrice : accreditationPrice);
		params.set('line_items[0][quantity]', '1');
		const metadata = {
			type: 'accreditation',
			accreditation_id: accreditationId, application_id: applicationId || accreditationId,
			contact_id: contactId, email, name: name || '',
			product_details: bundleRequired ? 'Accreditation + Associate Membership' : (international ? 'International Accreditation' : 'Accreditation'),
			product_name: bundleRequired ? 'Accreditation + Associate Membership' : (international ? 'International Accreditation' : 'Standard Accreditation'),
			product_amount: bundleRequired ? '409.00' : '354.00', currency: 'GBP',
			membership_required: membershipRequired ? 'true' : 'false', membership_id: membershipId || '', status: 'pending',
			membership_details: JSON.stringify({
				required: membershipRequired,
				type: membershipRequired ? (international ? 'International' : 'Associate') : null,
				start_date: membership.membershipStart || null,
				expiry_date: membership.membershipExpiry || null,
			}),
		};
		for (const [key, value] of Object.entries(metadata)) params.set(`metadata[${key}]`, String(value));
		const stripeRes = await fetch(`${STRIPE_API_BASE_URL}/checkout/sessions`, {
			method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params,
		});
		const body = await stripeRes.json();
		if (!stripeRes.ok) {
			console.log('Stripe Checkout creation failed', stripeRes.status, body);
			return res.status(502).json({ error: 'Stripe checkout creation failed', details: body });
		}
		try {
			// Stripe's hosted checkout URLs carry a long fragment token and can exceed the CRM
			// field's 450-char cap. Skip the link rather than let that fail the whole update -
			// otherwise Stripe_Checkout_Session_ID (used to avoid recreating duplicate sessions)
			// never gets saved either, since both fields are written in one PUT.
			const crmFields = { Stripe_Checkout_Session_ID: body.id, Payment_Status: 'Payment Processing' };
			if (body.url && body.url.length <= 450) crmFields.Stripe_Payment_Link = body.url;
			await crmUpdate(crmHeaders, 'Training_Centre_Accred', accreditationId, crmFields);
		} catch (crmErr) {
			console.log('Stripe session CRM update failed', crmErr && crmErr.details ? crmErr.details : crmErr);
		}
		res.json({ checkoutUrl: body.url, sessionId: body.id });
	} catch (err) {
		console.log('Stripe checkout error', err);
		res.status(502).json({ error: 'Stripe checkout unavailable', details: err.message });
	}
});

const ACCREDITATION_FIELDS = [
	'Accreditation_Level', 'Application_Stage', 'Accreditation_Status',
	'Valid_From', 'Valid_To', 'Days_to_Renewal', 'Number_of_Tutors', 'Account', 'Applicant_Contact',
	'Declaration_1_qualified_for_six_months', 'Declaration_2_teaching_qualification', 'Declaration_3_evidence_available',
	'Other_Tutors_Used', 'Tutor_qualification_declaration_question', 'Additional_Centres_Used',
	'Terms_Privacy_Accepted', 'Accreditation_Fee', 'VAT_Amount', 'Total_Quoted', 'Payment_Status',
	'Stripe_Checkout_Session_ID', 'Stripe_Payment_Link',
];
const TRAINING_CENTRE_FIELDS = ['Name', 'Town', 'Centre_Status', 'Account', 'Contact', 'Email', 'Phone_Number', 'Mobile_Phone_Number', 'Address_Line_1', 'Address_Line_2', 'Address_Line_3', 'County', 'Country', 'Postcode'];
const COURSE_OFFERING_FIELDS = ['Course', 'Accreditation'];

app.get('/accreditations', async (req, res) => {
	const contactId = req.query.contactId;
	if (!contactId) {
		return res.status(400).json({ error: 'contactId is required' });
	}

	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		const accRes = await fetch(
			`${CRM_API_DOMAIN}/crm/v3/Training_Centre_Accred/search?criteria=(Applicant_Contact:equals:${contactId})&fields=${ACCREDITATION_FIELDS.join(',')}`,
			{ headers }
		);
		if (accRes.status === 204) {
			return res.json({ accreditations: [], accredited: [], drafts: [], pending: [], awaitingPayment: [] });
		}
		if (!accRes.ok) {
			console.log('CRM accreditations search failed', accRes.status, await accRes.text());
			return res.status(502).json({ error: 'CRM accreditations lookup failed' });
		}
		const { data: accData } = await accRes.json();
		const accreditations = accData || [];

		// Training Centre name/town live on a separate module. An accreditation can have more
		// than one Training_Centres record now that Additional Venues exist, so the main one
		// must be resolved explicitly via Accreditation_Centre_Link's Centre_Relationship_Type,
		// not just "any centre sharing this Account" - that broke as soon as a second venue existed.
		const accIdsForLinks = accreditations.map((a) => a.id);
		const mainCentreIdByAccId = {};
		if (accIdsForLinks.length) {
			const linkCriteria = accIdsForLinks.map((id) => `(Accreditation:equals:${id})`).join('or');
			const linksRes = await fetch(
				`${CRM_API_DOMAIN}/crm/v3/Accreditation_Centre_Link/search?criteria=((${linkCriteria})and(Centre_Relationship_Type:equals:Main Centre))&fields=Accreditation,Training_Centre,Centre_Relationship_Type`,
				{ headers }
			);
			if (linksRes.status !== 204) {
				if (linksRes.ok) {
					const { data: linkData } = await linksRes.json();
					for (const l of (linkData || [])) {
						const accId = l.Accreditation && l.Accreditation.id;
						const centreId = l.Training_Centre && l.Training_Centre.id;
						if (accId && centreId) mainCentreIdByAccId[accId] = centreId;
					}
				} else {
					console.log('CRM accreditation centre links search failed', linksRes.status, await linksRes.text());
				}
			}
		}
		const mainCentreIds = [...new Set(Object.values(mainCentreIdByAccId))];
		const centreById = {};
		if (mainCentreIds.length) {
			const criteria = mainCentreIds.map((id) => `(id:equals:${id})`).join('or');
			const centresRes = await fetch(
				`${CRM_API_DOMAIN}/crm/v3/Training_Centres/search?criteria=(${criteria})&fields=${TRAINING_CENTRE_FIELDS.join(',')}`,
				{ headers }
			);
			if (centresRes.ok) {
				const { data: centreData } = await centresRes.json();
				for (const c of (centreData || [])) centreById[c.id] = c;
			} else {
				console.log('CRM training centres search failed', centresRes.status, await centresRes.text());
			}
		}

		// Referral Code/Referral Code Active live on the Account, not the lookup summary
		// returned inline on Training_Centre_Accred - a separate batch fetch, same join
		// pattern as Training Centres above.
		const accountIds = [...new Set(accreditations.map((a) => a.Account && a.Account.id).filter(Boolean))];
		const accountById = {};
		if (accountIds.length) {
			const criteria = accountIds.map((id) => `(id:equals:${id})`).join('or');
			const accountsRes = await fetch(
				`${CRM_API_DOMAIN}/crm/v3/Accounts/search?criteria=(${criteria})&fields=Referral_Code,Referral_Code_Active`,
				{ headers }
			);
			if (accountsRes.status !== 204) {
				if (accountsRes.ok) {
					const { data: accountData } = await accountsRes.json();
					for (const acct of (accountData || [])) accountById[acct.id] = acct;
				} else {
					console.log('CRM accounts search failed', accountsRes.status, await accountsRes.text());
				}
			}
		}

		// Which courses were applied for lives on TC_Course_Offering, one row per course, linked back via Accreditation.
		// An accreditation can have several venues each offering the same course, so this is
		// deduped per accreditation - otherwise "Accredited Courses" would show one row per
		// venue-course pairing instead of one row per distinct course the school offers.
		const accIds = accreditations.map((a) => a.id);
		const courseIdSetByAccId = {};
		const allCourseIds = new Set();
		if (accIds.length) {
			const criteria = accIds.map((id) => `(Accreditation:equals:${id})`).join('or');
			const offeringsRes = await fetch(
				`${CRM_API_DOMAIN}/crm/v3/TC_Course_Offering/search?criteria=(${criteria})&fields=${COURSE_OFFERING_FIELDS.join(',')}`,
				{ headers }
			);
			if (offeringsRes.status !== 204) {
				if (offeringsRes.ok) {
					const { data: offeringData } = await offeringsRes.json();
					for (const o of (offeringData || [])) {
						const accId = o.Accreditation && o.Accreditation.id;
						const courseId = o.Course && o.Course.id;
						if (!accId || !courseId) continue;
						(courseIdSetByAccId[accId] = courseIdSetByAccId[accId] || new Set()).add(courseId);
						allCourseIds.add(courseId);
					}
				} else {
					console.log('CRM course offerings search failed', offeringsRes.status, await offeringsRes.text());
				}
			}
		}
		const courseIdsByAccId = {};
		for (const [accId, idSet] of Object.entries(courseIdSetByAccId)) courseIdsByAccId[accId] = [...idSet];

		// Duration/CPD Points live on Courses itself, not on the offering - a second batch fetch,
		// same join pattern as Training Centres above.
		const courseById = {};
		if (allCourseIds.size) {
			const criteria = [...allCourseIds].map((id) => `(id:equals:${id})`).join('or');
			const coursesRes = await fetch(
				`${CRM_API_DOMAIN}/crm/v3/Courses/search?criteria=(${criteria})&fields=Name,Duration,CPD_Points`,
				{ headers }
			);
			if (coursesRes.ok) {
				const { data: courseData } = await coursesRes.json();
				for (const c of (courseData || [])) courseById[c.id] = c;
			} else if (coursesRes.status !== 204) {
				console.log('CRM courses lookup failed', coursesRes.status, await coursesRes.text());
			}
		}

		const result = accreditations.map((a) => {
			const accountId = a.Account && a.Account.id;
			const account = accountById[accountId];
			const centre = centreById[mainCentreIdByAccId[a.id]];
			const courseIds = courseIdsByAccId[a.id] || [];
			const courseDetails = courseIds.map((id) => courseById[id]).filter(Boolean).map((c) => ({
				id: c.id,
				name: c.Name,
				duration: c.Duration || null,
				cpdPoints: c.CPD_Points ?? null,
			}));
			const courseNames = courseDetails.map((c) => c.name);
			return {
				id: a.id,
				accountId,
				accountName: stripDraftPlaceholder(a.Account && a.Account.name),
				referralCode: (account && account.Referral_Code_Active !== false && account.Referral_Code) || null,
				schoolName: stripDraftPlaceholder(centre && centre.Name) || stripDraftPlaceholder(a.Account && a.Account.name),
				town: (centre && centre.Town) || null,
				level: a.Accreditation_Level || null,
				applicationStage: a.Application_Stage || null,
				status: a.Accreditation_Status || null,
				stripeCheckoutSessionId: a.Stripe_Checkout_Session_ID || null,
				stripePaymentLink: a.Stripe_Payment_Link || null,
				validFrom: a.Valid_From || null,
				validTo: a.Valid_To || null,
				// CRM's own Days_to_Renewal formula field has its sign backwards (confirmed live:
				// a brand-new, fully-valid accreditation showed -364 instead of +364), so it's
				// computed here from Valid_To directly rather than trusted from CRM.
				daysToRenewal: a.Valid_To ? Math.round((new Date(a.Valid_To) - new Date(new Date().toISOString().slice(0, 10))) / 86400000) : null,
				tutors: a.Number_of_Tutors ?? null,
				courseCount: courseNames.length || null,
				courseNames: courseNames.length ? courseNames.join(', ') : null,
				courseDetails,
			};
		});

		// Qualifications are completed after payment. Count them by primary accreditation
		// so the portal can show which applications are still incomplete.
		const qualificationCountByAccreditation = {};
		try {
			const qualificationsRes = await fetch(
				`${CRM_API_DOMAIN}/crm/v3/Qualifications/search?criteria=(Contact:equals:${contactId})&fields=Primary_Accreditation,Verification_Status`,
				{ headers }
			);
			if (qualificationsRes.ok) {
				const { data: qualificationData } = await qualificationsRes.json();
				for (const qualification of (qualificationData || [])) {
					const accreditationId = qualification.Primary_Accreditation && qualification.Primary_Accreditation.id;
					if (accreditationId) qualificationCountByAccreditation[accreditationId] = (qualificationCountByAccreditation[accreditationId] || 0) + 1;
				}
			} else if (qualificationsRes.status !== 204) {
				console.log('CRM qualifications lookup failed', qualificationsRes.status, await qualificationsRes.text());
			}
		} catch (qualificationErr) {
			// Qualification reporting must not stop the core accreditation dashboard loading.
			console.log('CRM qualifications count unavailable', qualificationErr);
		}
		for (const item of result) {
			item.qualificationCount = qualificationCountByAccreditation[item.id] || 0;
			item.qualificationsComplete = item.qualificationCount > 0;
		}

		// Awaiting payment is deliberately identified by both fields, so other Unverified
		// applications (for example incomplete/draft work) remain separate.
		const ACCREDITED_STATUSES = ['Verified', 'Closed', 'Expired'];
		const awaitingPayment = result.filter((a) => a.applicationStage === 'Awaiting Payment' && a.status === 'Unverified');
		const drafts = result.filter((a) => a.applicationStage === 'Draft');
		res.json({
			accreditations: result,
			accredited: result.filter((a) => ACCREDITED_STATUSES.includes(a.status)),
			drafts,
			awaitingPayment,
			pending: result.filter((a) => a.status === 'Unverified' && a.applicationStage !== 'Awaiting Payment' && a.applicationStage !== 'Draft'),
		});
	} catch (err) {
		console.log('get accreditations error', err);
		res.status(500).json({ error: 'Internal error' });
	}
});

async function getQualificationContext(headers, contactId) {
	const accRes = await fetch(
		`${CRM_API_DOMAIN}/crm/v3/Training_Centre_Accred/search?criteria=(Applicant_Contact:equals:${contactId})&fields=Account,Application_Stage,Accreditation_Status`,
		{ headers }
	);
	const accData = accRes.ok ? ((await accRes.json()).data || []) : [];
	const accountIds = [...new Set(accData.map((a) => a.Account && a.Account.id).filter(Boolean))];
	const accounts = accData
		.filter((a) => a.Account && a.Account.id)
		.map((a) => ({ id: a.Account.id, name: stripDraftPlaceholder(a.Account.name), accreditationId: a.id, applicationStage: a.Application_Stage, accreditationStatus: a.Accreditation_Status }))
		.filter((a, index, list) => list.findIndex((x) => x.id === a.id && x.accreditationId === a.accreditationId) === index);
	return { accounts, accountIds };
}

app.get('/qualifications/context', async (req, res) => {
	const contactId = String(req.query.contactId || '').trim();
	if (!contactId) return res.status(400).json({ error: 'contactId is required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		const context = await getQualificationContext(headers, contactId);
		const membership = await getMembershipDecision(headers, contactId);
		res.json({ accounts: context.accounts, memberProfileId: membership.membershipId || null });
	} catch (err) {
		console.log('qualification context error', err && err.stack ? err.stack : err);
		res.status(502).json({ error: 'Qualification context unavailable' });
	}
});

app.get('/qualifications', async (req, res) => {
	const contactId = String(req.query.contactId || '').trim();
	if (!contactId) return res.status(400).json({ error: 'contactId is required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		const result = await fetch(`${CRM_API_DOMAIN}/crm/v3/Qualifications/search?criteria=(Contact:equals:${contactId})&fields=${QUALIFICATION_FIELDS.join(',')}`, { headers });
		if (result.status === 204) return res.json({ qualifications: [] });
		if (!result.ok) return res.status(502).json({ error: 'Qualifications lookup failed' });
		const body = await result.json();
		res.json({ qualifications: body.data || [] });
	} catch (err) {
		console.log('qualifications lookup error', err && err.stack ? err.stack : err);
		res.status(502).json({ error: 'Qualifications lookup unavailable' });
	}
});

app.post('/qualifications', async (req, res) => {
	const payload = req.body || {};
	const contactId = String(payload.contactId || '').trim();
	const name = String(payload.name || '').trim();
	const month = String(payload.dateCompletedMonth || '').trim();
	const year = Number(payload.dateCompletedYear);
	if (!contactId || !name || !month || !Number.isInteger(year) || year < 1900 || year > 2200) return res.status(400).json({ error: 'contactId, qualification name, completion month and four-digit completion year are required' });
	if (!/^(?:[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ error: 'Date completed month must be a number from 1 to 12' });
	if (!Array.isArray(payload.practicalDeliveryType) || !payload.practicalDeliveryType.length || payload.practicalDeliveryType.some((v) => !QUALIFICATION_DELIVERY_TYPES.includes(v))) return res.status(400).json({ error: 'Select at least one valid practical delivery type' });
	if (!Array.isArray(payload.practicalAssessmentType) || !payload.practicalAssessmentType.length || payload.practicalAssessmentType.some((v) => !QUALIFICATION_ASSESSMENT_TYPES.includes(v))) return res.status(400).json({ error: 'Select at least one valid practical assessment type' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		const context = await getQualificationContext(headers, contactId);
		const selected = context.accounts.find((a) => a.id === payload.accountId && a.accreditationId === payload.primaryAccreditationId);
		if (!selected) return res.status(400).json({ error: 'The selected account is not linked to one of your accreditations' });
		const membership = await getMembershipDecision(headers, contactId);
		const record = {
			Name: name, Contact: contactId, Account: selected.id, Primary_Accreditation: selected.accreditationId,
			Member_Profile: membership.membershipId || undefined,
			Date_Completed_Month: month, Date_Completed_Year: year,
			Practical_Delivery_Type: payload.practicalDeliveryType,
			Practical_Delivery_Other: payload.practicalDeliveryOther || undefined,
			Practical_Assessment_Type: payload.practicalAssessmentType,
			Practical_Assessment_Other: payload.practicalAssessmentOther || undefined,
			Verification_Status: 'Not Verified',
		};
		const id = await crmCreate(headers, 'Qualifications', record);
		res.status(201).json({ qualification: { id, ...record } });
	} catch (err) {
		console.log('qualification create error', err, err.details && JSON.stringify(err.details));
		res.status(502).json({ error: 'Qualification could not be saved', debug: { name: err.name, message: err.message, details: err.details, stack: err.stack } });
	}
});

function toYesNo(value) {
	return value === true || value === 'Yes' ? 'Yes' : value === false || value === 'No' ? 'No' : undefined;
}

// The accreditation applies to the training centre itself, so its country (not the
// applicant's own home address) decides Standard vs International.
function accreditationLevel(school) {
	const country = school && school.country;
	return country && country !== 'United Kingdom' ? 'International Accreditation Annual' : 'Standard Accreditation Annual';
}

function draftAccreditationRecord(payload, stage = 'Draft') {
	const declarations = payload.declarations || [];
	return {
		Applicant_Contact: payload.contactId,
		Account: payload.accountId,
		Accreditation_Level: accreditationLevel(payload.school),
		Application_Stage: stage,
		Accreditation_Status: 'Unverified',
		Valid_From: payload.validFrom,
		Valid_To: payload.validTo,
		Declaration_1_qualified_for_six_months: toYesNo(declarations[0]),
		Declaration_2_teaching_qualification: toYesNo(declarations[1]),
		Declaration_3_evidence_available: toYesNo(declarations[2]),
		Other_Tutors_Used: payload.otherTutors == null ? undefined : !!payload.otherTutors,
		Tutor_qualification_declaration_question: payload.otherTutors ? toYesNo(payload.tutorQualified) : undefined,
		Number_of_Tutors: payload.numberOfTutors ? Number(payload.numberOfTutors) : undefined,
		Additional_Centres_Used: payload.otherVenues == null ? undefined : toYesNo(payload.otherVenues),
		Terms_Privacy_Accepted: payload.termsAccepted == null ? undefined : !!payload.termsAccepted,
		Accreditation_Fee: payload.accreditationFee,
		VAT_Amount: payload.vatAmount,
		Total_Quoted: payload.totalQuoted,
		Payment_Status: 'Not Paid',
	};
}

async function saveDraftCourses(headers, payload, accreditationId, centreId, linkId, validFrom, validTo) {
	if (!payload.courseIds || !payload.courseIds.length) return;
	const idCriteria = payload.courseIds.map((id) => `(Course:equals:${id})`).join('or');
	// Scoped by Training_Centre too, not just Accreditation - an accreditation with more than
	// one venue can otherwise see a sibling venue's existing offerings and wrongly skip creating
	// its own, since Course/Accreditation alone would already look "covered". Retries on an
	// empty result the same way the draft-fetch endpoint does - without it, saving twice in
	// quick succession (e.g. course selection, then straight on to a later step) could miss
	// the offering created moments earlier and create a duplicate.
	const existing = await searchWithRetry(`${CRM_API_DOMAIN}/crm/v3/TC_Course_Offering/search?criteria=((Accreditation:equals:${accreditationId})and(Training_Centre:equals:${centreId})and(${idCriteria}))&fields=Course`, headers);
	const existingIds = new Set(existing.map((row) => row.Course && row.Course.id).filter(Boolean));
	for (const courseId of payload.courseIds) {
		if (existingIds.has(courseId)) continue;
		await crmCreate(headers, 'TC_Course_Offering', {
			Name: `${payload.school.name} - Course Offering`, Course: courseId, Training_Centre: centreId,
			Accreditation: accreditationId, Accreditation_Centre_Link: linkId,
			Offering_Status: 'Pending Review', Valid_From: validFrom, Valid_To: validTo,
		});
	}
}

app.post('/accreditations/draft', async (req, res) => {
	const payload = req.body || {};
	if (!payload.contactId) return res.status(400).json({ error: 'contactId is required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		const today = new Date().toISOString().slice(0, 10);
		const validTo = annualPeriodEnd(today);
		await updateContactPersonalDetails(headers, payload.contactId, { phone: payload.phone, mobile: payload.mobile, address: payload.address });
		const schoolName = (payload.school && payload.school.name) || `Draft application - ${payload.contactId}`;
		let accountId = payload.accountId;
		let centreId = payload.centreId;
		let accreditationId = payload.accreditationId;
		let linkId = payload.linkId;
		if (!accountId) accountId = await crmCreate(headers, 'Accounts', { Account_Name: schoolName });
		const centreRecord = {
			Name: schoolName, Account: accountId, Contact: payload.contactId,
			Email: payload.school && payload.school.email || undefined, Phone_Number: payload.school && payload.school.phone || undefined,
			Mobile_Phone_Number: payload.school && payload.school.mobile || undefined, Address_Line_1: payload.school && payload.school.addressLine1 || undefined,
			Address_Line_2: payload.school && payload.school.addressLine2 || undefined, Address_Line_3: payload.school && payload.school.addressLine3 || undefined,
			Town: payload.school && payload.school.town || undefined, County: payload.school && payload.school.county || undefined,
			Country: payload.school && payload.school.country || undefined, Postcode: payload.school && payload.school.postcode || undefined,
			Centre_Status: 'Unverified',
		};
		if (!centreId) centreId = await crmCreate(headers, 'Training_Centres', centreRecord); else await crmUpdate(headers, 'Training_Centres', centreId, centreRecord);
		const accredRecord = draftAccreditationRecord({ ...payload, accountId, validFrom: today, validTo }, 'Draft');
		if (!accreditationId) accreditationId = await crmCreate(headers, 'Training_Centre_Accred', accredRecord); else await crmUpdate(headers, 'Training_Centre_Accred', accreditationId, accredRecord);
		if (!linkId) linkId = await crmCreate(headers, 'Accreditation_Centre_Link', { Name: `${schoolName} - Main Centre`, Accreditation: accreditationId, Training_Centre: centreId, Centre_Relationship_Type: 'Main Centre', Start_Date: today, End_Date: validTo });
		await saveDraftCourses(headers, payload, accreditationId, centreId, linkId, today, validTo);
		await linkWizardTutors(headers, accountId, payload.tutors);
		res.json({ draft: { id: accreditationId, accountId, centreId, linkId, stepIndex: payload.stepIndex || 0, schoolName: stripDraftPlaceholder(schoolName) } });
	} catch (err) {
		console.log('draft save error', err, err.details && JSON.stringify(err.details));
		res.status(502).json({ error: 'Draft save failed' });
	}
});

app.get('/accreditations/:id', async (req, res) => {
	const { id } = req.params;
	const contactId = req.query.contactId;
	if (!id || !contactId) return res.status(400).json({ error: 'id and contactId are required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		const accRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Training_Centre_Accred/${id}?fields=${ACCREDITATION_FIELDS.join(',')}`, { headers });
		if (!accRes.ok || accRes.status === 204) return res.status(404).json({ error: 'Draft not found' });
		const accBody = await accRes.json();
		const record = accBody.data && accBody.data[0];
		if (!record || record.Applicant_Contact && record.Applicant_Contact.id !== contactId) return res.status(404).json({ error: 'Draft not found' });
		const accountId = record.Account && record.Account.id;
		// A brand-new draft genuinely has no Training Centre / course offering / link yet -
		// but a draft that was just saved a moment ago can look exactly the same, since these
		// can only be found via search and CRM's search index lags real writes. Retrying (in
		// parallel, so the worst case is one retry window, not three stacked) tells the two
		// apart without needlessly slowing down the real "nothing entered yet" case.
		const [centreRows, offerings, linkRows] = await Promise.all([
			accountId ? searchWithRetry(`${CRM_API_DOMAIN}/crm/v3/Training_Centres/search?criteria=(Account:equals:${accountId})&fields=${TRAINING_CENTRE_FIELDS.join(',')}`, headers) : Promise.resolve([]),
			searchWithRetry(`${CRM_API_DOMAIN}/crm/v3/TC_Course_Offering/search?criteria=(Accreditation:equals:${id})&fields=Course`, headers),
			searchWithRetry(`${CRM_API_DOMAIN}/crm/v3/Accreditation_Centre_Link/search?criteria=(Accreditation:equals:${id})&fields=Name,Training_Centre`, headers),
		]);
		const centre = centreRows[0] || null;
		const link = linkRows[0] || null;
		const sanitizedCentre = centre ? { ...centre, Name: stripDraftPlaceholder(centre.Name) } : centre;
		res.json({ accreditation: record, account: { id: accountId, name: stripDraftPlaceholder(record.Account && record.Account.name) }, centre: sanitizedCentre, linkId: link && link.id, courseIds: offerings.map((x) => x.Course && x.Course.id).filter(Boolean) });
	} catch (err) {
		console.log('draft fetch error', err);
		res.status(502).json({ error: 'Draft fetch failed' });
	}
});

// Discards a draft application. Deliberately restricted to Application_Stage === 'Draft' -
// this must never be reachable for a submitted/paid/reviewed accreditation. Only deletes
// records that are exclusively this draft's own (the accreditation itself, its course
// offerings and its centre link) - the Account and Training_Centres are left alone since a
// draft can be an additional accreditation against a school the applicant already has, and
// deleting those could destroy real, shared data.
app.delete('/accreditations/:id', async (req, res) => {
	const { id } = req.params;
	const contactId = req.query.contactId;
	if (!id || !contactId) return res.status(400).json({ error: 'id and contactId are required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		const accRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Training_Centre_Accred/${id}?fields=Applicant_Contact,Application_Stage`, { headers });
		if (!accRes.ok || accRes.status === 204) return res.status(404).json({ error: 'Draft not found' });
		const accBody = await accRes.json();
		const record = accBody.data && accBody.data[0];
		if (!record || record.Applicant_Contact && record.Applicant_Contact.id !== contactId) return res.status(404).json({ error: 'Draft not found' });
		if (record.Application_Stage !== 'Draft') return res.status(400).json({ error: 'Only draft applications can be discarded' });

		const offeringsRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/TC_Course_Offering/search?criteria=(Accreditation:equals:${id})&fields=Course`, { headers });
		const offeringIds = offeringsRes.status !== 204 && offeringsRes.ok ? ((await offeringsRes.json()).data || []).map((o) => o.id) : [];
		await crmDelete(headers, 'TC_Course_Offering', offeringIds);

		const linksRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Accreditation_Centre_Link/search?criteria=(Accreditation:equals:${id})&fields=Name`, { headers });
		const linkIds = linksRes.status !== 204 && linksRes.ok ? ((await linksRes.json()).data || []).map((l) => l.id) : [];
		await crmDelete(headers, 'Accreditation_Centre_Link', linkIds);

		await crmDelete(headers, 'Training_Centre_Accred', [id]);
		res.json({ discarded: true });
	} catch (err) {
		console.log('draft discard error', err, err.details && JSON.stringify(err.details));
		res.status(502).json({ error: 'Draft could not be discarded' });
	}
});

// Lists every Training Centre linked to an accreditation - the main centre plus any
// Additional Venues - each with its own course count. The "Accredited Venues" table
// used to just repeat the accreditation's own summary row, which only ever showed one
// venue; this is what actually powers a real multi-row list.
app.get('/accreditations/:id/venues', async (req, res) => {
	const { id } = req.params;
	const contactId = req.query.contactId;
	if (!id || !contactId) return res.status(400).json({ error: 'id and contactId are required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		const accRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Training_Centre_Accred/${id}?fields=Applicant_Contact,Number_of_Tutors`, { headers });
		if (!accRes.ok || accRes.status === 204) return res.status(404).json({ error: 'Accreditation not found' });
		const accBody = await accRes.json();
		const accRecord = accBody.data && accBody.data[0];
		if (!accRecord || accRecord.Applicant_Contact && accRecord.Applicant_Contact.id !== contactId) return res.status(404).json({ error: 'Accreditation not found' });

		const linksRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Accreditation_Centre_Link/search?criteria=(Accreditation:equals:${id})&fields=Training_Centre,Centre_Relationship_Type`, { headers });
		const links = linksRes.status !== 204 && linksRes.ok ? ((await linksRes.json()).data || []) : [];
		const centreIds = [...new Set(links.map((l) => l.Training_Centre && l.Training_Centre.id).filter(Boolean))];
		if (!centreIds.length) return res.json({ venues: [] });

		const relationshipByCentreId = {};
		for (const l of links) {
			const centreId = l.Training_Centre && l.Training_Centre.id;
			if (centreId) relationshipByCentreId[centreId] = l.Centre_Relationship_Type;
		}

		const centresCriteria = centreIds.map((cid) => `(id:equals:${cid})`).join('or');
		const centresRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Training_Centres/search?criteria=(${centresCriteria})&fields=${TRAINING_CENTRE_FIELDS.join(',')}`, { headers });
		const centres = centresRes.status !== 204 && centresRes.ok ? ((await centresRes.json()).data || []) : [];

		const offeringsRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/TC_Course_Offering/search?criteria=(Accreditation:equals:${id})&fields=Course,Training_Centre`, { headers });
		const offerings = offeringsRes.status !== 204 && offeringsRes.ok ? ((await offeringsRes.json()).data || []) : [];
		const courseCountByCentreId = {};
		for (const o of offerings) {
			const centreId = o.Training_Centre && o.Training_Centre.id;
			if (centreId) courseCountByCentreId[centreId] = (courseCountByCentreId[centreId] || 0) + 1;
		}

		const venues = centres.map((c) => ({
			id: c.id,
			name: c.Name,
			town: c.Town || null,
			isMain: relationshipByCentreId[c.id] === 'Main Centre',
			courseCount: courseCountByCentreId[c.id] || 0,
			tutors: accRecord.Number_of_Tutors ?? null,
			shownOnBeautyguild: c.Centre_Status === 'Verified',
		})).sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0));

		res.json({ venues });
	} catch (err) {
		console.log('venues list error', err);
		res.status(502).json({ error: 'Venues lookup failed' });
	}
});

// GTi courses this school isn't currently accredited to offer at any of its venues -
// the "Other Available GTi Courses" table from the school portal document. Practical
// Hours and Min Practical Fee aren't modelled anywhere in CRM yet (checked both Courses
// and TC_Course_Offering), so those columns are left for the client to render as
// placeholders rather than guessed at here.
app.get('/accreditations/:id/missing-gti-courses', async (req, res) => {
	const { id } = req.params;
	const contactId = req.query.contactId;
	if (!id || !contactId) return res.status(400).json({ error: 'id and contactId are required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		const accRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Training_Centre_Accred/${id}?fields=Applicant_Contact`, { headers });
		if (!accRes.ok || accRes.status === 204) return res.status(404).json({ error: 'Accreditation not found' });
		const accBody = await accRes.json();
		const accRecord = accBody.data && accBody.data[0];
		if (!accRecord || accRecord.Applicant_Contact && accRecord.Applicant_Contact.id !== contactId) return res.status(404).json({ error: 'Accreditation not found' });

		const offeredRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/TC_Course_Offering/search?criteria=(Accreditation:equals:${id})&fields=Course`, { headers });
		const offered = offeredRes.status !== 204 && offeredRes.ok ? ((await offeredRes.json()).data || []) : [];
		const offeredIds = new Set(offered.map((o) => o.Course && o.Course.id).filter(Boolean));

		const gtiRes = await fetch(
			`${CRM_API_DOMAIN}/crm/v3/Courses/search?criteria=((Status:equals:Active)and(Course_Type:equals:GTI))&fields=${COURSE_FIELDS.join(',')}`,
			{ headers }
		);
		const gtiCourses = gtiRes.status !== 204 && gtiRes.ok ? ((await gtiRes.json()).data || []) : [];

		const missing = gtiCourses
			.filter((c) => !offeredIds.has(c.id))
			.map((c) => ({ id: c.id, name: c.Name, duration: c.Duration || null, cpdPoints: c.CPD_Points ?? null }));

		res.json({ courses: missing });
	} catch (err) {
		console.log('missing GTi courses error', err);
		res.status(502).json({ error: 'Missing courses lookup failed' });
	}
});

// Accredited tutors for a school - split into current (Membership.Current_Membership_Status =
// "Current") and expired ("Expired"), matching the two tables in the school portal document.
// Only Active Tutor_Relationships are considered - Inactive means the tutor no longer works
// at this school at all, not just that their membership lapsed.
app.get('/accreditations/:id/tutors', async (req, res) => {
	const { id } = req.params;
	const contactId = req.query.contactId;
	if (!id || !contactId) return res.status(400).json({ error: 'id and contactId are required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		const accRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Training_Centre_Accred/${id}?fields=Applicant_Contact,Account`, { headers });
		if (!accRes.ok || accRes.status === 204) return res.status(404).json({ error: 'Accreditation not found' });
		const accBody = await accRes.json();
		const accRecord = accBody.data && accBody.data[0];
		if (!accRecord || accRecord.Applicant_Contact && accRecord.Applicant_Contact.id !== contactId) return res.status(404).json({ error: 'Accreditation not found' });
		const accountId = accRecord.Account && accRecord.Account.id;
		if (!accountId) return res.json({ current: [], expired: [] });

		const relRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Tutor_Relationships/search?criteria=((Account:equals:${accountId})and(Status:equals:Active))&fields=Tutor_Contact,Tutor_Relationship`, { headers });
		const relations = relRes.status !== 204 && relRes.ok ? ((await relRes.json()).data || []) : [];
		// Tutor_Relationship on this record is actually a Deal (the membership transaction),
		// not the Membership profile itself - Deal.Member_Profile is the real link to Membership,
		// confirmed against the live connection rather than assumed from the field's display label.
		const dealIds = [...new Set(relations.map((r) => r.Tutor_Relationship && r.Tutor_Relationship.id).filter(Boolean))];

		const memberProfileIdByDealId = {};
		if (dealIds.length) {
			const criteria = dealIds.map((did) => `(id:equals:${did})`).join('or');
			const dealsRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Deals/search?criteria=(${criteria})&fields=Member_Profile`, { headers });
			const deals = dealsRes.status !== 204 && dealsRes.ok ? ((await dealsRes.json()).data || []) : [];
			for (const d of deals) {
				const memberProfileId = d.Member_Profile && d.Member_Profile.id;
				if (memberProfileId) memberProfileIdByDealId[d.id] = memberProfileId;
			}
		}

		const membershipById = {};
		const membershipIds = [...new Set(Object.values(memberProfileIdByDealId))];
		if (membershipIds.length) {
			const criteria = membershipIds.map((mid) => `(id:equals:${mid})`).join('or');
			const memRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Membership/search?criteria=(${criteria})&fields=Name,Current_Membership_Expiry,Current_Membership_Status`, { headers });
			const memberships = memRes.status !== 204 && memRes.ok ? ((await memRes.json()).data || []) : [];
			for (const m of memberships) membershipById[m.id] = m;
		}

		const current = [];
		const expired = [];
		const pending = [];
		for (const r of relations) {
			const contact = r.Tutor_Contact;
			if (!contact) continue;
			const dealId = r.Tutor_Relationship && r.Tutor_Relationship.id;
			const membership = dealId && membershipById[memberProfileIdByDealId[dealId]];
			// Newly linked/invited tutors have no Deal/Membership yet - list them separately
			// rather than dropping them, so a training centre owner still sees who they added.
			if (!membership) {
				pending.push({ id: r.id, name: contact.name, membershipNumber: null, membershipExpiry: null });
				continue;
			}
			const row = {
				id: r.id,
				name: contact.name,
				membershipNumber: membership.Name,
				membershipExpiry: membership.Current_Membership_Expiry || null,
			};
			(membership.Current_Membership_Status === 'Expired' ? expired : current).push(row);
		}

		res.json({ current, expired, pending });
	} catch (err) {
		console.log('tutors list error', err);
		res.status(502).json({ error: 'Tutors lookup failed' });
	}
});

// Adds a tutor to a training centre. CRM-first, same as the Register identity check:
// if a Contact already exists for this email, just link it via Tutor_Relationships.
// Otherwise create the Contact now and link it - the client then sends the same
// Catalyst sign-up invite used at Register, and resolveIdentity finds this Contact
// (rather than creating a duplicate) the first time the tutor logs in.
// Proxies a WorkDrive thumbnail image: the preview engine requires the same OAuth
// token as the files API, which a plain <img> tag can never attach itself.
app.get('/documents/thumbnail/:fileId', async (req, res) => {
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(WORKDRIVE_CONNECTION_NAME);
		const r = await fetch(`https://previewengine-accl.zoho.eu/thumbnail/WD/${req.params.fileId}`, { headers });
		const buffer = Buffer.from(await r.arrayBuffer());
		// Not every file has a rendered preview yet (still generating, or the file type
		// has none) - respond with no content so the client's onError falls back to an icon.
		if (!r.ok || !buffer.length) return res.status(204).end();
		res.set('Content-Type', r.headers.get('content-type') || 'image/png');
		res.set('Cache-Control', 'private, max-age=3600');
		res.send(buffer);
	} catch (err) {
		res.status(204).end();
	}
});

// Shared by the standalone "add tutor" endpoint below (used from the portal once an
// application is accredited) and the draft-save/submit handlers (used mid-wizard at
// Step 9, where the applicant lists additional tutors by name/email up front).
async function linkTutorToAccount(headers, accountId, name, email) {
	const lookupRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Contacts/search?email=${encodeURIComponent(email)}`, { headers });
	let tutorContactId = lookupRes.status !== 204 && lookupRes.ok
		? (await lookupRes.json()).data?.[0]?.id
		: undefined;
	const alreadyPresent = !!tutorContactId;

	// Any existing relationship (Active or Inactive) for this Account+Contact means there's
	// nothing new to do here - report its current status rather than duplicating the record.
	if (tutorContactId) {
		const existingRes = await fetch(
			`${CRM_API_DOMAIN}/crm/v3/Tutor_Relationships/search?criteria=((Account:equals:${accountId})and(Tutor_Contact:equals:${tutorContactId}))`,
			{ headers }
		);
		if (existingRes.status !== 204 && existingRes.ok) {
			const already = (await existingRes.json()).data?.[0];
			if (already) return { alreadyLinked: true, status: already.Status, tutor: { id: tutorContactId, name, email } };
		}
	}

	if (!tutorContactId) {
		const [firstName, ...rest] = name.trim().split(/\s+/);
		const lastName = rest.join(' ') || firstName;
		const createRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Contacts`, {
			method: 'POST',
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({ data: [{ Email: email, First_Name: firstName, Last_Name: lastName }] }),
		});
		const createBody = await createRes.json();
		const createResult = createBody.data && createBody.data[0];
		if (!createRes.ok || !createResult || createResult.status !== 'success') {
			console.log('tutor contact create failed', createRes.status, JSON.stringify(createBody));
			const err = new Error('Could not create tutor contact'); err.details = createResult || createBody; throw err;
		}
		tutorContactId = createResult.details.id;
	}

	// A brand-new Contact has no membership by definition. An existing Contact's own
	// current Guild membership is resolved the same way the dashboard/resolveMembership
	// does - Active only when they already hold one; everyone else lands Inactive and
	// stays there. The invite/onboarding email itself is now sent from CRM, not here.
	const membership = alreadyPresent ? await getMembershipDecision(headers, tutorContactId) : { membershipRequired: true };
	const status = membership.membershipRequired ? 'Inactive' : 'Active';

	const relRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Tutor_Relationships`, {
		method: 'POST',
		headers: { ...headers, 'Content-Type': 'application/json' },
		body: JSON.stringify({ data: [{ Name: name.trim(), Account: accountId, Tutor_Contact: tutorContactId, Status: status }] }),
	});
	const relBody = await relRes.json();
	const relResult = relBody.data && relBody.data[0];
	if (!relRes.ok || !relResult || relResult.status !== 'success') {
		console.log('tutor relationship create failed', relRes.status, JSON.stringify(relBody));
		const err = new Error('Could not link tutor to this training centre'); err.details = relResult || relBody; throw err;
	}

	return { alreadyLinked: false, status, tutor: { id: tutorContactId, name, email } };
}

// Applied from the wizard's Step 9 tutor rows at draft-save/submit time - best-effort per
// tutor, since one bad email shouldn't block the whole draft/application from saving.
async function linkWizardTutors(headers, accountId, tutors) {
	for (const t of (tutors || [])) {
		const name = [t.fname, t.surname].filter(Boolean).join(' ').trim();
		if (!name || !t.email) continue;
		try {
			await linkTutorToAccount(headers, accountId, name, t.email);
		} catch (err) {
			console.log('wizard tutor link failed', t.email, err.message, err.details && JSON.stringify(err.details));
		}
	}
}

app.post('/accreditations/:id/tutors', async (req, res) => {
	const { id } = req.params;
	const { contactId, name, email } = req.body || {};
	if (!id || !contactId) return res.status(400).json({ error: 'id and contactId are required' });
	if (!name || !email) return res.status(400).json({ error: 'name and email are required' });

	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		const accRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Training_Centre_Accred/${id}?fields=Applicant_Contact,Account`, { headers });
		if (!accRes.ok || accRes.status === 204) return res.status(404).json({ error: 'Accreditation not found' });
		const accBody = await accRes.json();
		const accRecord = accBody.data && accBody.data[0];
		if (!accRecord || accRecord.Applicant_Contact && accRecord.Applicant_Contact.id !== contactId) return res.status(404).json({ error: 'Accreditation not found' });
		const accountId = accRecord.Account && accRecord.Account.id;
		if (!accountId) return res.status(400).json({ error: 'This application has no linked training centre yet' });

		const result = await linkTutorToAccount(headers, accountId, name, email);
		res.json(result);
	} catch (err) {
		console.log('add tutor error', err, err.details && JSON.stringify(err.details));
		res.status(502).json({ error: err.message === 'Could not create tutor contact' || err.message === 'Could not link tutor to this training centre' ? err.message : 'Adding the tutor failed', details: err.details });
	}
});

function workdriveResourceIdFromLink(link) {
	if (!link) return null;
	const match = String(link).match(/\/(?:folder|file)\/([A-Za-z0-9_-]+)/);
	return match ? match[1] : null;
}

async function listWorkdriveFolder(catalystApp, folderId) {
	const { headers } = await catalystApp.connections().getConnectionCredentials(WORKDRIVE_CONNECTION_NAME);
	const r = await fetch(`${WORKDRIVE_API_DOMAIN}/workdrive/api/v1/files/${folderId}/files`, { headers });
	if (!r.ok) {
		console.log('WorkDrive list failed', r.status, await r.text());
		throw new Error('Could not load documents from WorkDrive');
	}
	const body = await r.json();
	return (body.data || []).map((f) => {
		const a = f.attributes || {};
		const isFolder = a.is_folder === true || a.type === 'folder';
		return {
			id: f.id,
			name: a.name || a.display_attr_name || 'Untitled',
			isFolder,
			modifiedTime: a.modified_time || null,
			modifiedTimeMs: a.modified_time_in_millisecond || null,
			modifiedBy: a.modified_by || null,
			iconClass: a.icon_class || null,
			size: a.storage_info && a.storage_info.size || null,
			viewUrl: isFolder ? null : `/server/beauty_guild_api/documents/file/${f.id}`,
		};
	});
}

// Documents for a school: resolves the applicant's own membership Deal (same Deal
// the Tutors/Membership logic uses) for its Workdrive_Link, then browses that
// WorkDrive folder. Pass folderId to browse into a subfolder returned by a
// previous call - the root folder is only re-resolved from CRM when omitted.
// Proxies the actual file content via WorkDrive's REST download API (not the
// workdrive.zoho.eu web permalink - that depends on the viewer's own WorkDrive
// access/sharing on that specific file, which isn't guaranteed, and 404s
// unpredictably). This always works because it goes through our own connection.
app.get('/documents/file/:fileId', async (req, res) => {
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(WORKDRIVE_CONNECTION_NAME);
		const r = await fetch(`${WORKDRIVE_API_DOMAIN}/workdrive/api/v1/download/${req.params.fileId}`, { headers });
		if (!r.ok) {
			console.log('WorkDrive download failed', r.status, await r.text());
			return res.status(502).json({ error: 'Could not load this document from WorkDrive' });
		}
		res.set('Content-Type', r.headers.get('content-type') || 'application/octet-stream');
		res.send(Buffer.from(await r.arrayBuffer()));
	} catch (err) {
		console.log('document download error', err);
		res.status(502).json({ error: 'Document download failed' });
	}
});

// Invoices for the applicant: every invoice in Creator's All_Invoice_Records report is
// linked to a crm_contact_id, never a crm_account_id - same applicant-Contact pattern
// as Documents and Membership, confirmed against the live report rather than assumed.
// Every invoice in Creator's All_Invoice_Records report for this contact, across every product
// type (accreditation, additional venue, membership, ...) - not scoped to any one accreditation
// or membership, for the account-wide Invoices tab. product_description already carries a
// friendly label for most rows (e.g. "Additional Venue"); membership invoices leave it blank but
// populate crm_membership_id instead, so that's the fallback used to label those.
app.get('/invoices', async (req, res) => {
	const contactId = req.query.contactId;
	if (!contactId) return res.status(400).json({ error: 'contactId is required' });

	try {
		const catalystApp = catalyst.initialize(req);
		const { headers: creatorHeaders } = await catalystApp.connections().getConnectionCredentials(CREATOR_CONNECTION_NAME);
		const criteria = encodeURIComponent(`crm_contact_id == "${contactId}"`);
		const url = `${CREATOR_API_DOMAIN}/creator/v2.1/data/${CREATOR_ACCOUNT_OWNER}/${CREATOR_APP_LINK_NAME}/report/${CREATOR_INVOICES_REPORT}?field_config=all&max_records=200&criteria=${criteria}`;
		const creatorRes = await fetch(url, { headers: creatorHeaders });
		const creatorBody = await creatorRes.json();
		if (!creatorRes.ok || creatorBody.code !== 3000) {
			if (creatorBody.code === 9280) return res.json({ invoices: [] });
			console.log('Creator account invoices lookup failed', creatorRes.status, JSON.stringify(creatorBody));
			return res.status(502).json({ error: 'Could not load invoices' });
		}

		const invoices = (creatorBody.data || [])
			.map((r) => ({
				id: r.ID,
				// product_description is the most specific label when short (e.g. "Additional
				// Venue" - venue invoices also carry an accreditation_id in related_crm_records,
				// so that check has to come after this one, not before, or it would overwrite
				// the more specific label with a generic "Accreditation"). A newer part of the
				// Creator automation dumps a full line-item breakdown into product_description
				// instead of a short label, so it's skipped when it's clearly not one.
				type: (r.product_description && r.product_description.length <= 40) ? r.product_description
					: r.crm_membership_id ? 'Membership'
					: (r.related_crm_records && r.related_crm_records.includes('accreditation_id')) ? 'Accreditation'
					: null,
				invoiceNumber: r.invoice_number || null,
				invoiceDate: r.invoice_date || null,
				dueDate: r.due_date || null,
				paymentDate: r.payment_date || null,
				amount: r.payment_amount ? Number(r.payment_amount) : null,
				status: r.invoice_status || null,
			}))
			.sort((a, b) => Number(b.invoiceNumber) - Number(a.invoiceNumber));

		res.json({ invoices });
	} catch (err) {
		console.log('account invoices lookup error', err);
		res.status(502).json({ error: 'Invoices lookup failed' });
	}
});

app.get('/accreditations/:id/invoices', async (req, res) => {
	const { id } = req.params;
	const contactId = req.query.contactId;
	if (!id || !contactId) return res.status(400).json({ error: 'id and contactId are required' });

	try {
		const catalystApp = catalyst.initialize(req);
		const { headers: crmHeaders } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		const accRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Training_Centre_Accred/${id}?fields=Applicant_Contact`, { headers: crmHeaders });
		if (!accRes.ok || accRes.status === 204) return res.status(404).json({ error: 'Accreditation not found' });
		const accBody = await accRes.json();
		const accRecord = accBody.data && accBody.data[0];
		if (!accRecord || accRecord.Applicant_Contact && accRecord.Applicant_Contact.id !== contactId) return res.status(404).json({ error: 'Accreditation not found' });

		const { headers: creatorHeaders } = await catalystApp.connections().getConnectionCredentials(CREATOR_CONNECTION_NAME);
		const criteria = encodeURIComponent(`crm_contact_id == "${contactId}"`);
		const url = `${CREATOR_API_DOMAIN}/creator/v2.1/data/${CREATOR_ACCOUNT_OWNER}/${CREATOR_APP_LINK_NAME}/report/${CREATOR_INVOICES_REPORT}?field_config=all&max_records=200&criteria=${criteria}`;
		const creatorRes = await fetch(url, { headers: creatorHeaders });
		const creatorBody = await creatorRes.json();
		if (!creatorRes.ok || creatorBody.code !== 3000) {
			// code 9280 = "no matching records", which Creator treats as a 400 response
			// even though it just means an empty result, not a real error.
			if (creatorBody.code === 9280) return res.json({ invoices: [] });
			console.log('Creator invoices lookup failed', creatorRes.status, JSON.stringify(creatorBody));
			return res.status(502).json({ error: 'Could not load invoices' });
		}

		const invoices = (creatorBody.data || [])
			.map((r) => ({
				id: r.ID,
				invoiceNumber: r.invoice_number || null,
				invoiceDate: r.invoice_date || null,
				dueDate: r.due_date || null,
				paymentDate: r.payment_date || null,
				amount: r.payment_amount ? Number(r.payment_amount) : null,
				status: r.invoice_status || null,
			}))
			.sort((a, b) => Number(b.invoiceNumber) - Number(a.invoiceNumber));

		res.json({ invoices });
	} catch (err) {
		console.log('invoices lookup error', err);
		res.status(502).json({ error: 'Invoices lookup failed' });
	}
});


app.get('/accreditations/:id/documents', async (req, res) => {
	const { id } = req.params;
	const contactId = req.query.contactId;
	const requestedFolderId = req.query.folderId;
	if (!id || !contactId) return res.status(400).json({ error: 'id and contactId are required' });

	try {
		const catalystApp = catalyst.initialize(req);
		const { headers: crmHeaders } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		const accRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Training_Centre_Accred/${id}?fields=Applicant_Contact,Workdrive_Link`, { headers: crmHeaders });
		if (!accRes.ok || accRes.status === 204) return res.status(404).json({ error: 'Accreditation not found' });
		const accBody = await accRes.json();
		const accRecord = accBody.data && accBody.data[0];
		if (!accRecord || accRecord.Applicant_Contact && accRecord.Applicant_Contact.id !== contactId) return res.status(404).json({ error: 'Accreditation not found' });

		// This accreditation's own Workdrive_Link, not the applicant's membership Deal - so
		// a school with multiple accreditations only ever sees that accreditation's documents,
		// not everything the applicant has across every school they've applied for.
		let folderId = requestedFolderId;
		if (!folderId) {
			folderId = workdriveResourceIdFromLink(accRecord.Workdrive_Link);
			if (!folderId) return res.json({ folderId: null, items: [], message: 'No documents folder is linked for this accreditation yet.' });
		}

		const items = await listWorkdriveFolder(catalystApp, folderId);
		res.json({ folderId, items });
	} catch (err) {
		console.log('documents lookup error', err);
		res.status(502).json({ error: 'Documents lookup failed' });
	}
});

// Documents for the applicant generally (the top-level "Documents" nav item) - resolves
// the root folder from the applicant's own membership Deal's Workdrive_Link, not any one
// accreditation's, so this deliberately shows everything rather than one school's set.
app.get('/contacts/:contactId/documents', async (req, res) => {
	const { contactId } = req.params;
	const requestedFolderId = req.query.folderId;
	if (!contactId) return res.status(400).json({ error: 'contactId is required' });

	try {
		const catalystApp = catalyst.initialize(req);
		const { headers: crmHeaders } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		let folderId = requestedFolderId;
		if (!folderId) {
			const dealsRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Deals/search?criteria=(Contact_Name:equals:${contactId})&fields=Workdrive_Link`, { headers: crmHeaders });
			const deals = dealsRes.status !== 204 && dealsRes.ok ? ((await dealsRes.json()).data || []) : [];
			const link = deals.map((d) => d.Workdrive_Link).find(Boolean);
			folderId = workdriveResourceIdFromLink(link);
			if (!folderId) return res.json({ folderId: null, items: [], message: 'No documents folder is linked to your membership yet.' });
		}

		const items = await listWorkdriveFolder(catalystApp, folderId);
		res.json({ folderId, items });
	} catch (err) {
		console.log('documents lookup error', err);
		res.status(502).json({ error: 'Documents lookup failed' });
	}
});

// Creates the CRM Contact for a brand-new registrant, at the end of the Register flow
// (Email/Password -> Your Details+Interests -> Home Address -> Create Account).
app.post('/contacts', async (req, res) => {
	const {
		email, title, firstName, lastName, phone, mobile, interests,
		addressLine1, addressLine2, addressLine3, postcode, town, county, country,
	} = req.body || {};
	if (!email || !firstName || !lastName) {
		return res.status(400).json({ error: 'email, firstName and lastName are required' });
	}

	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		const contactRecord = {
			Email: email,
			Salutation: title || undefined,
			First_Name: firstName,
			Last_Name: lastName,
			Phone: phone || undefined,
			Mobile: mobile || undefined,
			Interests: interests && interests.length ? interests : undefined,
			Correspondence_Address_Line_1: addressLine1 || undefined,
			Correspondence_Address_Line_2: addressLine2 || undefined,
			Correspondence_Address_Line_3: addressLine3 || undefined,
			Correspondence_Postcode: postcode || undefined,
			Correspondence_Town: town || undefined,
			Correspondence_County: county || undefined,
			Correspondence_Country: country || undefined,
		};

		const crmRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Contacts`, {
			method: 'POST',
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({ data: [contactRecord] }),
		});
		const body = await crmRes.json();
		const result = body.data && body.data[0];

		if (!crmRes.ok || !result || result.status !== 'success') {
			console.log('CRM contact create failed', crmRes.status, JSON.stringify(body));
			return res.status(502).json({ error: 'CRM contact creation failed', details: result || body });
		}

		res.json({
			contact: {
				id: result.details.id,
				title, firstName, lastName, email, phone, mobile,
				addressLine1, addressLine2, postcode, town, county, country,
			},
		});
	} catch (err) {
		console.log('create contact error', err);
		res.status(500).json({ error: 'Internal error' });
	}
});

// Creates a CRM record and returns its new id, or throws with the CRM error details.
async function crmCreate(headers, module, record) {
	const res = await fetch(`${CRM_API_DOMAIN}/crm/v3/${module}`, {
		method: 'POST',
		headers: { ...headers, 'Content-Type': 'application/json' },
		body: JSON.stringify({ data: [record] }),
	});
	const body = await res.json();
	const result = body.data && body.data[0];
	if (!res.ok || !result || result.status !== 'success') {
		const err = new Error(`CRM ${module} create failed`);
		err.details = result || body;
		throw err;
	}
	return result.details.id;
}

async function crmUpdate(headers, module, id, record) {
	const res = await fetch(`${CRM_API_DOMAIN}/crm/v3/${module}/${id}`, {
		method: 'PUT',
		headers: { ...headers, 'Content-Type': 'application/json' },
		body: JSON.stringify({ data: [record] }),
	});
	const body = await res.json();
	const result = body.data && body.data[0];
	if (!res.ok || !result || result.status !== 'success') {
		const err = new Error(`CRM ${module} update failed`);
		err.details = result || body;
		throw err;
	}
	return result;
}

// Deletes one or more CRM records by id. Missing/already-deleted ids are not treated as
// failures - discard should still succeed even if a related row was never created (e.g.
// a draft abandoned before course selection has no TC_Course_Offering rows at all).
async function crmDelete(headers, module, ids) {
	if (!ids || !ids.length) return;
	const res = await fetch(`${CRM_API_DOMAIN}/crm/v3/${module}?ids=${ids.join(',')}`, { method: 'DELETE', headers });
	if (res.status === 204) return;
	const body = await res.json().catch(() => null);
	const failed = (body?.data || []).filter((r) => r.status !== 'success' && r.code !== 'RECORD_DOES_NOT_EXIST');
	if (!res.ok || failed.length) {
		const err = new Error(`CRM ${module} delete failed`);
		err.details = body;
		throw err;
	}
}

// Personal details (phone, mobile, correspondence address - Your Details/Address, steps 2
// & 4) live on the Contact, not the draft/accreditation record. Every accreditation entry
// point that carries them must write them back here, or they're never persisted anywhere -
// they'd vanish as soon as the wizard state resets (resuming a draft, or even reaching final
// submit fresh), since nothing else in this flow ever touches the Contact record again.
async function updateContactPersonalDetails(headers, contactId, { phone, mobile, address } = {}) {
	const record = {
		Phone: phone || undefined,
		Mobile: mobile || undefined,
		Correspondence_Address_Line_1: (address && address.addressLine1) || undefined,
		Correspondence_Address_Line_2: (address && address.addressLine2) || undefined,
		Correspondence_Address_Line_3: (address && address.addressLine3) || undefined,
		Correspondence_Postcode: (address && address.postcode) || undefined,
		Correspondence_Town: (address && address.town) || undefined,
		Correspondence_County: (address && address.county) || undefined,
		Correspondence_Country: (address && address.country) || undefined,
	};
	if (!Object.values(record).some(Boolean)) return;
	await crmUpdate(headers, 'Contacts', contactId, record);
}

function addYears(isoDate, years) {
	const d = new Date(isoDate);
	d.setFullYear(d.getFullYear() + years);
	return d.toISOString().slice(0, 10);
}

// A one-year accreditation/membership period runs to the day before the anniversary of
// its start date (e.g. 1 Sept 26 - 31 Aug 27), not the exact same calendar date a year
// later - matters for insurance continuity as well as accreditation renewal.
function annualPeriodEnd(startIsoDate) {
	const d = new Date(startIsoDate);
	d.setFullYear(d.getFullYear() + 1);
	d.setDate(d.getDate() - 1);
	return d.toISOString().slice(0, 10);
}

// Submits the finished Accreditation application: creates the Account, Training Centre,
// the Accreditation record itself, and the link joining them. Application Stage is set to
// "Awaiting Payment" since there's no real payment processor wired up yet - not "Paid".
// Membership bundling (auto-adding Associate Membership for non-members) is not implemented
// yet - the real pricing for that isn't available in any document we have.
app.post('/accreditations/submit', async (req, res) => {
	const {
		contactId, phone, mobile, address, school, declarations, otherTutors, numberOfTutors, tutorQualified, tutors,
		otherVenues, courseIds, termsAccepted, accreditationFee, vatAmount, totalQuoted,
		accreditationId, accountId: existingAccountId, centreId: existingCentreId, linkId: existingLinkId,
	} = req.body || {};
	if (!contactId || !school || !school.name) {
		return res.status(400).json({ error: 'contactId and school.name are required' });
	}
	let accountId = existingAccountId || null;
	let centreId = existingCentreId || null;
	let accredId = accreditationId || null;
	let linkId = existingLinkId || null;

	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		await updateContactPersonalDetails(headers, contactId, { phone, mobile, address });

		accountId = accountId || await crmCreate(headers, 'Accounts', { Account_Name: school.name });

		const centreRecord = {
			Name: school.name,
			Account: accountId,
			Contact: contactId,
			Email: school.email || undefined,
			Phone_Number: school.phone || undefined,
			Mobile_Phone_Number: school.mobile || undefined,
			Address_Line_1: school.addressLine1 || undefined,
			Address_Line_2: school.addressLine2 || undefined,
			Address_Line_3: school.addressLine3 || undefined,
			Town: school.town || undefined,
			County: school.county || undefined,
			Country: school.country || undefined,
			Postcode: school.postcode || undefined,
			Centre_Status: 'Unverified',
		};
		centreId = centreId || await crmCreate(headers, 'Training_Centres', centreRecord);
		if (existingCentreId) await crmUpdate(headers, 'Training_Centres', centreId, centreRecord);

		const today = new Date().toISOString().slice(0, 10);
		const validTo = annualPeriodEnd(today);
		const yesNo = (v) => (v ? 'Yes' : 'No');

		const accredRecord = {
			Applicant_Contact: contactId,
			Account: accountId,
			Accreditation_Level: accreditationLevel(school),
			Application_Stage: 'Awaiting Payment',
			Accreditation_Status: 'Unverified',
			Valid_From: today,
			Valid_To: validTo,
			Declaration_1_qualified_for_six_months: yesNo(declarations && declarations[0]),
			Declaration_2_teaching_qualification: yesNo(declarations && declarations[1]),
			Declaration_3_evidence_available: yesNo(declarations && declarations[2]),
			Other_Tutors_Used: !!otherTutors,
			Tutor_qualification_declaration_question: otherTutors ? yesNo(tutorQualified) : undefined,
			Number_of_Tutors: numberOfTutors ? Number(numberOfTutors) : undefined,
			Additional_Centres_Used: yesNo(otherVenues),
			Terms_Privacy_Accepted: !!termsAccepted,
			// Zoho datetime fields need "yyyy-MM-ddTHH:mm:ss+00:00" - no milliseconds, numeric offset not "Z".
			Terms_Accepted_Date: `${new Date().toISOString().split('.')[0]}+00:00`,
			Purchase_Type: 'New Accreditation',
			Application_Source: 'Portal',
			Accreditation_Fee: accreditationFee,
			VAT_Amount: vatAmount,
			Total_Quoted: totalQuoted,
			Payment_Status: 'Not Paid',
		};
		accredId = accredId || await crmCreate(headers, 'Training_Centre_Accred', accredRecord);
		if (accreditationId) await crmUpdate(headers, 'Training_Centre_Accred', accredId, accredRecord);

		const linkRecord = {
			Name: `${school.name} - Main Centre`,
			Accreditation: accredId,
			Training_Centre: centreId,
			Centre_Relationship_Type: 'Main Centre',
			Start_Date: today,
			End_Date: validTo,
		};
		linkId = linkId || await crmCreate(headers, 'Accreditation_Centre_Link', linkRecord);
		if (existingLinkId) await crmUpdate(headers, 'Accreditation_Centre_Link', linkId, linkRecord);

		// Drafts already create their course offerings. Reuse the same idempotent
		// helper here so converting a draft does not create duplicate CRM rows.
		await saveDraftCourses(headers, { courseIds, school }, accredId, centreId, linkId, today, validTo);
		await linkWizardTutors(headers, accountId, otherTutors ? tutors : []);

		res.json({
			accreditation: {
				id: accredId, accountId, centreId, linkId, schoolName: school.name, level: accreditationLevel(school),
				applicationStage: 'Awaiting Payment', status: 'Unverified', validFrom: today, validTo,
			},
		});
	} catch (err) {
		console.log('accreditation submit error', err, err.details && JSON.stringify(err.details));
		res.status(502).json({
			error: 'Submission failed',
			operation: 'CRM accreditation submission',
			debug: { name: err.name, message: err.message, details: err.details, stack: err.stack },
			partial: { accreditationId: accredId, accountId, centreId, linkId },
			request: { contactId, accreditationId: accreditationId || null, accountId: existingAccountId || null, centreId: existingCentreId || null, linkId: existingLinkId || null, schoolName: school.name, courseCount: Array.isArray(courseIds) ? courseIds.length : 0 },
		});
	}
});

// Adds an Additional Venue to an existing, already-accredited school. Reuses the same
// Account and Training_Centre_Accred as the main centre - only a new Training_Centres
// record and its own Accreditation_Centre_Link (Centre_Relationship_Type: "Additional
// Centre", confirmed against the real picklist rather than guessed "Additional Venue")
// get created here, plus TC_Course_Offering rows for whatever courses this venue offers.
app.post('/venues', async (req, res) => {
	const { contactId, accountId, accreditationId, school, courseIds, tutors } = req.body || {};
	if (!contactId || !accountId || !accreditationId || !school || !school.name) {
		return res.status(400).json({ error: 'contactId, accountId, accreditationId and school.name are required' });
	}

	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		const centreId = await crmCreate(headers, 'Training_Centres', {
			Name: school.name,
			Account: accountId,
			Contact: contactId,
			Email: school.email || undefined,
			Phone_Number: school.phone || undefined,
			Mobile_Phone_Number: school.mobile || undefined,
			Address_Line_1: school.addressLine1 || undefined,
			Address_Line_2: school.addressLine2 || undefined,
			Address_Line_3: school.addressLine3 || undefined,
			Town: school.town || undefined,
			County: school.county || undefined,
			Country: school.country || undefined,
			Postcode: school.postcode || undefined,
			Centre_Status: 'Unverified',
		});

		const today = new Date().toISOString().slice(0, 10);
		// Additional venues expire alongside the main accreditation, not a fresh year from today.
		const accredRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Training_Centre_Accred/${accreditationId}?fields=Valid_To`, { headers });
		const accredBody = accredRes.ok && accredRes.status !== 204 ? await accredRes.json() : null;
		const validTo = (accredBody && accredBody.data && accredBody.data[0] && accredBody.data[0].Valid_To) || annualPeriodEnd(today);

		const linkId = await crmCreate(headers, 'Accreditation_Centre_Link', {
			Name: `${school.name} - Additional Centre`,
			Accreditation: accreditationId,
			Training_Centre: centreId,
			Centre_Relationship_Type: 'Additional Centre',
			Start_Date: today,
			End_Date: validTo,
		});

		// The wizard now lets the applicant review/adjust courses for this specific venue,
		// defaulting to the main centre's current offerings - so courseIds is normally passed
		// explicitly. Kept as a fallback for any caller that doesn't pass it: copy the main
		// centre's current offerings, resolved via the Main Centre link specifically (not "any
		// offering under this accreditation", which would wrongly pull in other additional
		// venues' courses too once more than one exists).
		let venueCourseIds = courseIds;
		if (!venueCourseIds || !venueCourseIds.length) {
			const mainLinkRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Accreditation_Centre_Link/search?criteria=((Accreditation:equals:${accreditationId})and(Centre_Relationship_Type:equals:Main Centre))&fields=Training_Centre`, { headers });
			const mainLinkData = mainLinkRes.status !== 204 && mainLinkRes.ok ? ((await mainLinkRes.json()).data || []) : [];
			const mainCentreId = mainLinkData[0] && mainLinkData[0].Training_Centre && mainLinkData[0].Training_Centre.id;
			if (mainCentreId) {
				const existingRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/TC_Course_Offering/search?criteria=((Accreditation:equals:${accreditationId})and(Training_Centre:equals:${mainCentreId}))&fields=Course`, { headers });
				const existing = existingRes.status !== 204 && existingRes.ok ? ((await existingRes.json()).data || []) : [];
				venueCourseIds = [...new Set(existing.map((row) => row.Course && row.Course.id).filter(Boolean))];
			} else {
				venueCourseIds = [];
			}
		}
		await saveDraftCourses(headers, { courseIds: venueCourseIds, school }, accreditationId, centreId, linkId, today, validTo);
		// Tutor info lives on the shared Account (Tutor_Relationships), not per-venue, so any
		// tutors added here join the same pool used across all of this school's venues.
		await linkWizardTutors(headers, accountId, tutors);

		res.json({ venue: { id: centreId, linkId, accreditationId, name: school.name } });
	} catch (err) {
		console.log('venue create error', err, err.details && JSON.stringify(err.details));
		res.status(502).json({ error: 'Venue creation failed', details: err.details || err.message });
	}
});

app.post('/payments/venue-checkout', async (req, res) => {
	const { centreId, accreditationId, contactId, email, name } = req.body || {};
	if (!centreId || !accreditationId || !contactId || !email) {
		return res.status(400).json({ error: 'centreId, accreditationId, contactId and email are required' });
	}
	const venuePrice = process.env.STRIPE_PRICE_ADDITIONAL_VENUE;
	if (!process.env.STRIPE_SECRET_KEY || !venuePrice) {
		return res.status(503).json({ error: 'Stripe checkout is not configured for additional venues' });
	}
	try {
		const params = new URLSearchParams();
		params.set('mode', 'payment');
		params.set('success_url', process.env.STRIPE_SUCCESS_URL || `${req.protocol}://${req.get('host')}/app/index.html?payment=success`);
		params.set('cancel_url', process.env.STRIPE_CANCEL_URL || `${req.protocol}://${req.get('host')}/app/index.html?payment=cancelled`);
		params.set('customer_email', email);
		params.set('line_items[0][price]', venuePrice);
		params.set('line_items[0][quantity]', '1');
		const metadata = {
			type: 'additional_venue', centre_id: centreId, accreditation_id: accreditationId,
			contact_id: contactId, email, name: name || '', status: 'pending',
		};
		for (const [key, value] of Object.entries(metadata)) params.set(`metadata[${key}]`, String(value));
		const stripeRes = await fetch(`${STRIPE_API_BASE_URL}/checkout/sessions`, {
			method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params,
		});
		const body = await stripeRes.json();
		if (!stripeRes.ok) {
			console.log('Stripe venue checkout creation failed', stripeRes.status, body);
			return res.status(502).json({ error: 'Stripe checkout creation failed', details: body });
		}
		res.json({ checkoutUrl: body.url, sessionId: body.id });
	} catch (err) {
		console.log('Venue checkout error', err);
		res.status(502).json({ error: 'Stripe checkout unavailable', details: err.message });
	}
});

app.post('/payments/membership-checkout', async (req, res) => {
	const {
		contactId, email, name, quoteReference, entryPoint,
		membershipLevel, primaryBranch, secondaryBranches, addons,
		insuranceRequested, subscriptionType, membershipStart, membershipExpiry,
		previousMembershipId,
	} = req.body || {};
	if (!email || !membershipLevel || !primaryBranch || !subscriptionType) {
		return res.status(400).json({ error: 'email, membershipLevel, primaryBranch and subscriptionType are required' });
	}
	const level = MEMBERSHIP_LEVELS[membershipLevel];
	if (!level) return res.status(400).json({ error: `Unknown membershipLevel: ${membershipLevel}` });
	if (level.membershipGross == null) {
		// International pricing is "confirmed by our team" everywhere else in this flow too -
		// there's no fixed fee to charge here, so this can't go through self-service checkout.
		return res.status(422).json({ error: 'International membership has no fixed price and cannot be checked out automatically - this needs to be quoted manually.' });
	}
	if (!MEMBERSHIP_BRANCHES[primaryBranch]) return res.status(400).json({ error: `Unknown primaryBranch: ${primaryBranch}` });
	const branchIds = Array.isArray(secondaryBranches) ? secondaryBranches : [];
	for (const id of branchIds) {
		if (!MEMBERSHIP_BRANCHES[id]) return res.status(400).json({ error: `Unknown secondary branch: ${id}` });
	}
	const addonQuantities = addons && typeof addons === 'object' ? addons : {};
	for (const id of Object.keys(addonQuantities)) {
		if (!MEMBERSHIP_ADDONS[id]) return res.status(400).json({ error: `Unknown addon: ${id}` });
	}

	if (!process.env.STRIPE_SECRET_KEY) {
		return res.status(503).json({ error: 'Stripe checkout is not configured for memberships' });
	}

	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);

		// Only meaningful for a logged-in member (the public, logged-out entry point has no
		// contactId yet to look anything up against) - links the new Deal to whatever Member
		// Profile they already have, and records what they were on before, for both a renewal
		// and a genuinely new member.
		let membershipProfileId = null;
		let existingMembership = null;
		if (contactId) {
			const decision = await getMembershipDecision(headers, contactId);
			membershipProfileId = decision.membershipId || null;
			existingMembership = decision.membershipRequired ? null : JSON.stringify({
				type: decision.membershipType,
				start_date: decision.membershipStart,
				expiry_date: decision.membershipExpiry,
				deal_id: decision.dealId,
			});
		}

		// The membership fee varies by level (Associate £55, Full £48.60, ...), so it can't be
		// a single fixed Price - a new Stripe Price is created for exactly this level+interval
		// combination and used by id, rather than referencing one hardcoded Price for every
		// level. Stripe Prices are immutable once created, so this can't be "corrected" after
		// the fact if the amount is ever wrong - it has to be right at creation time, which is
		// why this reads from the same server-side pricing table as everything else here.
		//
		// membershipGross is always the ANNUAL fee. A monthly subscription must recur at
		// 1/12th of that, not the full annual amount every month - the front end's own
		// "indicative monthly price" (quoteTotal / 12) already promises a figure in that
		// range, so charging the whole annual fee each month would be a 12x overcharge.
		const membershipUnitGross = subscriptionType === 'monthly' ? level.membershipGross / 12 : level.membershipGross;
		const membershipUnitNet = subscriptionType === 'monthly' ? level.membershipNet / 12 : level.membershipNet;
		const priceRes = await fetch(`${STRIPE_API_BASE_URL}/prices`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				currency: 'gbp',
				unit_amount: String(Math.round(membershipUnitGross * 100)),
				'recurring[interval]': subscriptionType === 'monthly' ? 'month' : 'year',
				'product_data[name]': `${level.name} - ${subscriptionType === 'monthly' ? 'Monthly' : 'Annual'} Membership`,
			}),
		});
		const priceBody = await priceRes.json();
		if (!priceRes.ok) {
			console.log('Stripe membership price creation failed', priceRes.status, priceBody);
			return res.status(502).json({ error: 'Stripe price creation failed', details: priceBody });
		}
		const subscriptionPrice = priceBody.id;

		// All amounts computed from the server's own pricing table above, never from anything
		// the client sent - the client only names which level/branches/addons were chosen.
		// The joining fee is a one-off, paid once when someone first becomes a member - not
		// charged again on a renewal, which is why it's zeroed out whenever this checkout came
		// from the portal's "Renew now" flow (previousMembershipId set).
		const isRenewal = !!previousMembershipId;
		const joiningFeeGross = isRenewal ? 0 : level.joiningGross;
		const joiningFeeNet = isRenewal ? 0 : level.joiningNet;
		const branchAddonGross = branchIds.length * MEMBERSHIP_BRANCH_ADDON_GROSS;
		const branchAddonNet = branchIds.length * MEMBERSHIP_BRANCH_ADDON_NET;
		let extrasGross = 0;
		let extrasNet = 0;
		// Priced out per addon id (bundle/certificate/badge/sticker), not just a single combined
		// figure - the client team need to see what each individual extra actually cost.
		const addonAmounts = {};
		const addonAmountsNet = {};
		const lineItems = [{ price: subscriptionPrice, quantity: 1 }];
		if (!isRenewal) {
			lineItems.push({ price_data: { currency: 'gbp', product_data: { name: 'Membership joining fee' }, unit_amount: Math.round(joiningFeeGross * 100) }, quantity: 1 });
		}
		branchIds.forEach((id) => {
			lineItems.push({ price_data: { currency: 'gbp', product_data: { name: `Additional branch - ${MEMBERSHIP_BRANCHES[id]}` }, unit_amount: Math.round(MEMBERSHIP_BRANCH_ADDON_GROSS * 100) }, quantity: 1 });
		});
		Object.entries(addonQuantities).forEach(([id, qty]) => {
			const quantity = Math.max(0, Math.min(10, Number(qty) || 0));
			if (!quantity) return;
			const addon = MEMBERSHIP_ADDONS[id];
			const amount = addon.priceGross * quantity;
			const amountNet = addon.priceNet * quantity;
			extrasGross += amount;
			extrasNet += amountNet;
			addonAmounts[id] = amount;
			addonAmountsNet[id] = amountNet;
			lineItems.push({ price_data: { currency: 'gbp', product_data: { name: addon.name }, unit_amount: Math.round(addon.priceGross * 100) }, quantity });
		});
		const totalGross = membershipUnitGross + joiningFeeGross + branchAddonGross + extrasGross;
		const totalNet = membershipUnitNet + joiningFeeNet + branchAddonNet + extrasNet;

		const params = new URLSearchParams();
		params.set('mode', 'subscription');
		// customer_creation is deliberately not set here - Stripe rejects it outright in
		// subscription mode ("can only be used in payment mode"), confirmed against the real
		// API. It's also redundant there: a subscription always has a Customer attached to it
		// regardless, so there's nothing this would have added.
		//
		// success_url/cancel_url are shared across every checkout type (accreditation, venue,
		// membership) via the same env vars, so &flow=membership marks which one this actually
		// is - the front end uses it to know it's safe to clear the local membership-quote
		// draft on return, without touching it on an accreditation or venue payment redirect.
		const baseSuccessUrl = process.env.STRIPE_SUCCESS_URL || `${req.protocol}://${req.get('host')}/app/index.html?payment=success`;
		const baseCancelUrl = process.env.STRIPE_CANCEL_URL || `${req.protocol}://${req.get('host')}/app/index.html?payment=cancelled`;
		params.set('success_url', `${baseSuccessUrl}${baseSuccessUrl.includes('?') ? '&' : '?'}flow=membership`);
		params.set('cancel_url', `${baseCancelUrl}${baseCancelUrl.includes('?') ? '&' : '?'}flow=membership`);
		params.set('customer_email', email);
		lineItems.forEach((item, i) => {
			if (item.price) {
				params.set(`line_items[${i}][price]`, item.price);
			} else {
				params.set(`line_items[${i}][price_data][currency]`, item.price_data.currency);
				params.set(`line_items[${i}][price_data][product_data][name]`, item.price_data.product_data.name);
				params.set(`line_items[${i}][price_data][unit_amount]`, String(item.price_data.unit_amount));
			}
			params.set(`line_items[${i}][quantity]`, String(item.quantity));
		});
		const metadata = {
			type: 'membership',
			quote_reference: quoteReference || '',
			entry_point: entryPoint || 'member',
			contact_id: contactId || '',
			membership_profile_id: membershipProfileId || '',
			existing_membership: existingMembership || '',
			// The Deal id of the membership being renewed, if this checkout came from the portal's
			// "Renew now" flow - for the Creator webhook to link the new Deal back via
			// Previous Membership per the solution design's renewal section, and to leave the old
			// Deal untouched as history rather than closing it out itself.
			previous_membership_id: previousMembershipId || '',
			email, name: name || '',
			membership_level: membershipLevel,
			primary_branch: primaryBranch,
			secondary_branches: branchIds.join(','),
			addons: JSON.stringify(addonQuantities),
			insurance_requested: insuranceRequested ? 'true' : 'false',
			subscription_type: subscriptionType,
			membership_start: membershipStart || '',
			membership_expiry: membershipExpiry || '',
			base_membership_amount: membershipUnitGross.toFixed(2),
			base_membership_amount_net: membershipUnitNet.toFixed(2),
			joining_fee_amount: joiningFeeGross.toFixed(2),
			joining_fee_amount_net: joiningFeeNet.toFixed(2),
			branch_addon_amount: branchAddonGross.toFixed(2),
			branch_addon_amount_net: branchAddonNet.toFixed(2),
			bundle_amount: (addonAmounts.bundle || 0).toFixed(2),
			bundle_amount_net: (addonAmountsNet.bundle || 0).toFixed(2),
			certificate_amount: (addonAmounts.certificate || 0).toFixed(2),
			certificate_amount_net: (addonAmountsNet.certificate || 0).toFixed(2),
			badge_amount: (addonAmounts.badge || 0).toFixed(2),
			badge_amount_net: (addonAmountsNet.badge || 0).toFixed(2),
			sticker_amount: (addonAmounts.sticker || 0).toFixed(2),
			sticker_amount_net: (addonAmountsNet.sticker || 0).toFixed(2),
			insurance_amount: insuranceRequested ? 'quoted_separately' : 'not_requested',
			total_amount: totalGross.toFixed(2),
			total_amount_net: totalNet.toFixed(2),
			currency: 'GBP',
			status: 'pending',
		};
		for (const [key, value] of Object.entries(metadata)) params.set(`metadata[${key}]`, String(value));

		const stripeRes = await fetch(`${STRIPE_API_BASE_URL}/checkout/sessions`, {
			method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params,
		});
		const body = await stripeRes.json();
		if (!stripeRes.ok) {
			console.log('Stripe membership checkout creation failed', stripeRes.status, body);
			return res.status(502).json({ error: 'Stripe checkout creation failed', details: body });
		}
		res.json({ checkoutUrl: body.url, sessionId: body.id });
	} catch (err) {
		console.log('Membership checkout error', err && err.stack ? err.stack : err);
		res.status(502).json({ error: 'Stripe checkout unavailable', details: err.details || err.message });
	}
});

// Creates a Creator record and returns its new id, or throws with Creator's error details.
async function creatorCreate(headers, formLinkName, data) {
	const res = await fetch(`${CREATOR_API_DOMAIN}/creator/v2.1/data/${CREATOR_ACCOUNT_OWNER}/${CREATOR_APP_LINK_NAME}/form/${formLinkName}`, {
		method: 'POST',
		headers: { ...headers, 'Content-Type': 'application/json' },
		body: JSON.stringify({ data }),
	});
	const body = await res.json();
	if (!res.ok || body.code !== 3000 || !body.data || !body.data.ID) {
		const err = new Error(`Creator ${formLinkName} create failed`);
		err.details = body;
		throw err;
	}
	return body.data.ID;
}

// Creator datetime fields need "dd-MMM-yyyy HH:mm:ss"; date-only fields need "dd-MMM-yyyy".
function toCreatorDateTime(isoString) {
	if (!isoString) return undefined;
	const d = new Date(isoString);
	if (Number.isNaN(d.getTime())) return undefined;
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const pad = (n) => String(n).padStart(2, '0');
	return `${pad(d.getDate())}-${months[d.getMonth()]}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function toCreatorDate(isoString) {
	const dt = toCreatorDateTime(isoString ? `${isoString}T00:00:00` : undefined);
	return dt ? dt.split(' ')[0] : undefined;
}

// Resolves the accreditation, checks it belongs to contactId, and returns its Account id -
// same ownership-check pattern used by every other /accreditations/:id/* endpoint.
async function requireOwnedAccountId(headers, accreditationId, contactId) {
	const accRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Training_Centre_Accred/${accreditationId}?fields=Applicant_Contact,Account`, { headers });
	if (!accRes.ok || accRes.status === 204) return { error: 'Accreditation not found' };
	const accBody = await accRes.json();
	const accRecord = accBody.data && accBody.data[0];
	if (!accRecord || accRecord.Applicant_Contact && accRecord.Applicant_Contact.id !== contactId) return { error: 'Accreditation not found' };
	const accountId = accRecord.Account && accRecord.Account.id;
	if (!accountId) return { error: 'This application has no linked training centre yet' };
	return { accountId };
}

// Course Offerings available to this accreditation, for the "which course" dropdown when
// creating a Diary Date session - same TC_Course_Offering join used by /venues and
// /missing-gti-courses above.
app.get('/accreditations/:id/course-offerings', async (req, res) => {
	const { id } = req.params;
	const contactId = req.query.contactId;
	if (!id || !contactId) return res.status(400).json({ error: 'id and contactId are required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		const owned = await requireOwnedAccountId(headers, id, contactId);
		if (owned.error) return res.status(404).json({ error: owned.error });

		const offeringsRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/TC_Course_Offering/search?criteria=(Accreditation:equals:${id})&fields=Course,Training_Centre`, { headers });
		const offerings = offeringsRes.status !== 204 && offeringsRes.ok ? ((await offeringsRes.json()).data || []) : [];

		const result = offerings
			.filter((o) => o.Course && o.Training_Centre)
			.map((o) => ({
				id: o.id,
				courseId: o.Course.id,
				courseName: o.Course.name,
				trainingCentreId: o.Training_Centre.id,
				trainingCentreName: o.Training_Centre.name,
			}));
		res.json({ offerings: result });
	} catch (err) {
		console.log('course offerings list error', err);
		res.status(502).json({ error: 'Course offerings lookup failed' });
	}
});

// Tutors linked to this school, for the "which tutor" dropdown when creating a session.
// Reuses the same Tutor_Relationships/Contact join as /accreditations/:id/tutors, but
// returns every Active relationship (not just those with a resolvable membership) since
// any active tutor can be assigned to deliver a session.
app.get('/accreditations/:id/tutor-options', async (req, res) => {
	const { id } = req.params;
	const contactId = req.query.contactId;
	if (!id || !contactId) return res.status(400).json({ error: 'id and contactId are required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		const owned = await requireOwnedAccountId(headers, id, contactId);
		if (owned.error) return res.status(404).json({ error: owned.error });

		const relRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Tutor_Relationships/search?criteria=((Account:equals:${owned.accountId})and(Status:equals:Active))&fields=Tutor_Contact`, { headers });
		const relations = relRes.status !== 204 && relRes.ok ? ((await relRes.json()).data || []) : [];
		const tutors = relations.filter((r) => r.Tutor_Contact).map((r) => ({ id: r.id, name: r.Tutor_Contact.name }));
		res.json({ tutors });
	} catch (err) {
		console.log('tutor options list error', err);
		res.status(502).json({ error: 'Tutor options lookup failed' });
	}
});

// Diary Date course sessions for this school, read from Creator. Places Booked/Remaining
// aren't kept up to date by Creator itself (confirmed live - they're plain number fields,
// not formulas, and stay blank after a booking is created), so they're computed here from
// the actual Diary_Date_Bookings rows rather than trusted from the session record - same
// "don't trust a stale/unmaintained field" approach used for Days_to_Renewal.
app.get('/accreditations/:id/sessions', async (req, res) => {
	const { id } = req.params;
	const contactId = req.query.contactId;
	if (!id || !contactId) return res.status(400).json({ error: 'id and contactId are required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers: crmHeaders } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		const owned = await requireOwnedAccountId(crmHeaders, id, contactId);
		if (owned.error) return res.status(404).json({ error: owned.error });

		const { headers: creatorHeaders } = await catalystApp.connections().getConnectionCredentials(CREATOR_CONNECTION_NAME);
		const criteria = encodeURIComponent(`account1=="${owned.accountId}"`);
		const sessionsUrl = `${CREATOR_API_DOMAIN}/creator/v2.1/data/${CREATOR_ACCOUNT_OWNER}/${CREATOR_APP_LINK_NAME}/report/Course_Sessions_Report?field_config=all&max_records=200&criteria=${criteria}`;
		const sessionsRes = await fetch(sessionsUrl, { headers: creatorHeaders });
		const sessionsBody = await sessionsRes.json();
		if (!sessionsRes.ok || sessionsBody.code !== 3000) {
			if (sessionsBody.code === 9280) return res.json({ sessions: [] });
			console.log('Creator sessions lookup failed', sessionsRes.status, JSON.stringify(sessionsBody));
			return res.status(502).json({ error: 'Could not load sessions' });
		}
		const sessions = sessionsBody.data || [];

		const bookingsUrl = `${CREATOR_API_DOMAIN}/creator/v2.1/data/${CREATOR_ACCOUNT_OWNER}/${CREATOR_APP_LINK_NAME}/report/All_Diary_Date_Bookings?field_config=all&max_records=200&criteria=${criteria.replace('account1', 'training_school')}`;
		const bookingsRes = await fetch(bookingsUrl, { headers: creatorHeaders });
		const bookingsBody = await bookingsRes.json();
		const bookings = (bookingsRes.ok && bookingsBody.code === 3000) ? (bookingsBody.data || []) : [];
		const bookedCountBySessionId = {};
		for (const b of bookings) {
			if (b.booking_status === 'Cancelled' || b.booking_status === 'Refunded') continue;
			const sessionId = b.course_session && b.course_session.ID;
			if (!sessionId) continue;
			bookedCountBySessionId[sessionId] = (bookedCountBySessionId[sessionId] || 0) + (Number(b.number_of_students) || 1);
		}

		const result = sessions.map((s) => {
			const maxPlaces = s.maximum_places ? Number(s.maximum_places) : null;
			const placesBooked = bookedCountBySessionId[s.ID] || 0;
			return {
				id: s.ID,
				name: s.course_session_name || null,
				courseOfferingId: s.course_offering && s.course_offering.ID,
				courseOfferingName: s.course_offering && s.course_offering.zc_display_value,
				trainingCentreId: s.training_centre && s.training_centre.ID,
				trainingCentreName: s.training_centre && s.training_centre.zc_display_value,
				tutorId: s.tutor && s.tutor.ID,
				tutorName: s.tutor && s.tutor.zc_display_value,
				availabilityType: s.availability_type || null,
				sessionStart: s.session_start_date_time || null,
				sessionEnd: s.session_end_date_time || null,
				flexibleDescription: s.flexible_availability_description || null,
				availableDays: s.available_days || [],
				weekendAvailability: s.weekend_availability === 'true',
				eveningAvailability: s.evening_availability1 === 'true',
				bookingClosing: s.booking_closing_date_and_time || null,
				instantBookingAvailable: s.instant_booking_available === 'true',
				requestADateAvailable: s.request_a_date_available1 === 'true',
				status: s.status || null,
				maximumPlaces: maxPlaces,
				placesBooked,
				placesRemaining: maxPlaces == null ? null : Math.max(0, maxPlaces - placesBooked),
				dateSpecificFee: s.date_specific_practical_fee || null,
				totalAdvertisedPrice: s.total_advertised_price || null,
			};
		}).sort((a, b) => (a.sessionStart || '').localeCompare(b.sessionStart || ''));

		res.json({ sessions: result });
	} catch (err) {
		console.log('sessions list error', err);
		res.status(502).json({ error: 'Sessions lookup failed' });
	}
});

// Bookings against one specific session - who's booked, how many places and their status -
// so the school can see requests waiting on them, not just the aggregate places-booked count.
app.get('/accreditations/:id/sessions/:sessionId/bookings', async (req, res) => {
	const { id, sessionId } = req.params;
	const contactId = req.query.contactId;
	if (!id || !sessionId || !contactId) return res.status(400).json({ error: 'id, sessionId and contactId are required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers: crmHeaders } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		const owned = await requireOwnedAccountId(crmHeaders, id, contactId);
		if (owned.error) return res.status(404).json({ error: owned.error });

		const { headers: creatorHeaders } = await catalystApp.connections().getConnectionCredentials(CREATOR_CONNECTION_NAME);
		// course_session is an in-app Creator lookup (unlike training_school/account1, which are
		// CRM-integration lookups) - it's filtered as a bare unquoted number, confirmed live;
		// quoting it like the CRM lookups do throws a NUMBER/TEXT criteria type mismatch.
		const bookingsUrl = `${CREATOR_API_DOMAIN}/creator/v2.1/data/${CREATOR_ACCOUNT_OWNER}/${CREATOR_APP_LINK_NAME}/report/All_Diary_Date_Bookings?field_config=all&max_records=200&criteria=${encodeURIComponent(`course_session==${sessionId}`)}`;
		const bookingsRes = await fetch(bookingsUrl, { headers: creatorHeaders });
		const bookingsBody = await bookingsRes.json();
		if (!bookingsRes.ok || bookingsBody.code !== 3000) {
			if (bookingsBody.code === 9280) return res.json({ bookings: [] });
			console.log('Creator session bookings lookup failed', bookingsRes.status, JSON.stringify(bookingsBody));
			return res.status(502).json({ error: 'Could not load bookings' });
		}
		const bookings = (bookingsBody.data || []).filter((b) => b.training_school && b.training_school.ID === owned.accountId);

		const result = bookings.map((b) => ({
			id: b.ID,
			studentName: b.student_contact && b.student_contact.zc_display_value,
			numberOfStudents: b.number_of_students ? Number(b.number_of_students) : 1,
			status: b.booking_status || null,
			agreedCourseDate: b.agreed_course_date || null,
			agreedStartTime: b.agreed_start_time || null,
			preferredDateFrom: b.preferred_date_from || null,
			preferredDateTo: b.preferred_date_to1 || null,
			preferredDays: b.preferred_days1 || [],
			message: b.student_message_special_requirements || null,
		})).sort((a, b) => (a.status === 'Date Requested' ? -1 : 1) - (b.status === 'Date Requested' ? -1 : 1));

		res.json({ bookings: result });
	} catch (err) {
		console.log('session bookings list error', err);
		res.status(502).json({ error: 'Bookings lookup failed' });
	}
});

// Creates a Diary Date course session. Course Offering is selected first and Account/Training
// Centre are derived from it (not accepted from the client), matching the automation rule
// from the Diary Dates spec ("Course Offering is selected first; Account, Training Centre and
// Course are copied automatically") and preventing a session being created for a course this
// accreditation doesn't actually offer.
app.post('/accreditations/:id/sessions', async (req, res) => {
	const { id } = req.params;
	const {
		contactId, courseOfferingId, tutorId, availabilityType, sessionStart, sessionEnd,
		maximumPlaces, flexibleDescription, availableDays, weekendAvailability, eveningAvailability,
		bookingClosing, instantBookingAvailable, requestADateAvailable, dateSpecificFee, totalAdvertisedPrice,
	} = req.body || {};
	if (!id || !contactId) return res.status(400).json({ error: 'id and contactId are required' });
	if (!courseOfferingId) return res.status(400).json({ error: 'courseOfferingId is required' });
	if (!availabilityType) return res.status(400).json({ error: 'availabilityType is required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers: crmHeaders } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		const owned = await requireOwnedAccountId(crmHeaders, id, contactId);
		if (owned.error) return res.status(404).json({ error: owned.error });

		const offRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/TC_Course_Offering/${courseOfferingId}?fields=Course,Training_Centre,Accreditation`, { headers: crmHeaders });
		if (!offRes.ok) return res.status(404).json({ error: 'Course offering not found' });
		const offBody = await offRes.json();
		const offering = offBody.data && offBody.data[0];
		if (!offering || !offering.Accreditation || offering.Accreditation.id !== id) return res.status(404).json({ error: 'Course offering not found' });

		const { headers: creatorHeaders } = await catalystApp.connections().getConnectionCredentials(CREATOR_CONNECTION_NAME);
		const payload = {
			course_offering: courseOfferingId,
			training_centre: offering.Training_Centre && offering.Training_Centre.id,
			account1: owned.accountId,
			tutor: tutorId || undefined,
			availability_type: availabilityType,
			status: 'Open',
			course_session_name: `${offering.Training_Centre && offering.Training_Centre.name} - ${offering.Course && offering.Course.name}`,
			maximum_places: maximumPlaces ? Number(maximumPlaces) : undefined,
			instant_booking_available: !!instantBookingAvailable,
			request_a_date_available1: !!requestADateAvailable,
			date_specific_practical_fee: dateSpecificFee || undefined,
			total_advertised_price: totalAdvertisedPrice || undefined,
		};
		if (availabilityType === 'Fixed Date') {
			if (!sessionStart) return res.status(400).json({ error: 'sessionStart is required for a fixed date session' });
			payload.session_start_date_time = toCreatorDateTime(sessionStart);
			payload.session_end_date_time = toCreatorDateTime(sessionEnd);
		} else {
			payload.flexible_availability_description = flexibleDescription || undefined;
			payload.available_days = Array.isArray(availableDays) ? availableDays : undefined;
			payload.weekend_availability = !!weekendAvailability;
			payload.evening_availability1 = !!eveningAvailability;
			payload.booking_closing_date_and_time = toCreatorDateTime(bookingClosing);
		}

		const sessionId = await creatorCreate(creatorHeaders, 'Course_Sessions', payload);
		res.status(201).json({ session: { id: sessionId } });
	} catch (err) {
		console.log('session create error', err, err.details && JSON.stringify(err.details));
		res.status(502).json({ error: 'Session could not be saved', details: err.details });
	}
});

// Books a session on behalf of a student. CRM-first, same lookup-or-create Contact pattern
// used by the tutor invite flow. A Fixed Date session with instant booking is confirmed
// immediately; anything else (flexible/request-a-date) is recorded as a pending request for
// the school to action, since there's no student-facing acceptance step in this admin view.
app.post('/accreditations/:id/sessions/:sessionId/bookings', async (req, res) => {
	const { id, sessionId } = req.params;
	const { contactId, studentName, studentEmail, numberOfStudents, preferredDateFrom, preferredDateTo, preferredDays, message } = req.body || {};
	if (!id || !sessionId || !contactId) return res.status(400).json({ error: 'id, sessionId and contactId are required' });
	if (!studentName || !studentEmail) return res.status(400).json({ error: 'studentName and studentEmail are required' });
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers: crmHeaders } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		const owned = await requireOwnedAccountId(crmHeaders, id, contactId);
		if (owned.error) return res.status(404).json({ error: owned.error });

		const { headers: creatorHeaders } = await catalystApp.connections().getConnectionCredentials(CREATOR_CONNECTION_NAME);
		const sessionRes = await fetch(`${CREATOR_API_DOMAIN}/creator/v2.1/data/${CREATOR_ACCOUNT_OWNER}/${CREATOR_APP_LINK_NAME}/report/Course_Sessions_Report?field_config=all&max_records=200&criteria=${encodeURIComponent(`ID==${sessionId}`)}`, { headers: creatorHeaders });
		const sessionBody = await sessionRes.json();
		const session = sessionRes.ok && sessionBody.code === 3000 && sessionBody.data && sessionBody.data[0];
		if (!session || !session.account1 || session.account1.ID !== owned.accountId) return res.status(404).json({ error: 'Session not found' });

		const lookupRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Contacts/search?email=${encodeURIComponent(studentEmail)}`, { headers: crmHeaders });
		let studentContactId = lookupRes.status !== 204 && lookupRes.ok ? (await lookupRes.json()).data?.[0]?.id : undefined;
		if (!studentContactId) {
			const [firstName, ...rest] = studentName.trim().split(/\s+/);
			const lastName = rest.join(' ') || firstName;
			const createRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Contacts`, {
				method: 'POST',
				headers: { ...crmHeaders, 'Content-Type': 'application/json' },
				body: JSON.stringify({ data: [{ Email: studentEmail, First_Name: firstName, Last_Name: lastName }] }),
			});
			const createBody = await createRes.json();
			const createResult = createBody.data && createBody.data[0];
			if (!createRes.ok || !createResult || createResult.status !== 'success') {
				console.log('student contact create failed', createRes.status, JSON.stringify(createBody));
				return res.status(502).json({ error: 'Could not create the student contact', details: createResult || createBody });
			}
			studentContactId = createResult.details.id;
		}

		const isInstant = session.availability_type === 'Fixed Date' && session.instant_booking_available === 'true';
		const payload = {
			training_school: owned.accountId,
			course_session: sessionId,
			student_contact: studentContactId,
			number_of_students: numberOfStudents ? Number(numberOfStudents) : 1,
			student_message_special_requirements: message || undefined,
			booking_status: isInstant ? 'Confirmed' : 'Date Requested',
		};
		if (isInstant) {
			payload.agreed_course_date = session.session_start_date_time ? session.session_start_date_time.split(' ')[0] : undefined;
			payload.agreed_start_time = session.session_start_date_time ? session.session_start_date_time.split(' ')[1] : undefined;
		} else {
			payload.preferred_date_from = toCreatorDate(preferredDateFrom);
			payload.preferred_date_to1 = toCreatorDate(preferredDateTo);
			payload.preferred_days1 = Array.isArray(preferredDays) ? preferredDays : undefined;
		}

		const bookingId = await creatorCreate(creatorHeaders, 'Diary_Date_Bookings', payload);
		res.status(201).json({ booking: { id: bookingId, status: payload.booking_status } });
	} catch (err) {
		console.log('booking create error', err, err.details && JSON.stringify(err.details));
		res.status(502).json({ error: 'Booking could not be saved', details: err.details });
	}
});

module.exports = app;
