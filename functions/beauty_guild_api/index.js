const express = require('express');
const catalyst = require('zcatalyst-sdk-node');

const app = express();
app.use(express.json());







const CRM_API_DOMAIN = process.env.CRM_API_DOMAIN || 'https://www.zohoapis.eu';
const CRM_CONNECTION_NAME = process.env.CRM_CONNECTION_NAME || 'zohocrm';
const MEMBERSHIP_MODULE = 'Membership';
const LOQATE_API_BASE_URL = process.env.LOQATE_API_BASE_URL || 'https://api.addressy.com';
const STRIPE_API_BASE_URL = 'https://api.stripe.com/v1';
const COURSE_FIELDS = [
	'Name', 'Status', 'Course_Type', 'Duration', 'CPD_Points',
	'Member_Price', 'Non_Member_Price', 'Course_Category', 'Treatment_Group',
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
		}));

		res.json({ courses });
	} catch (err) {
		console.log('get courses error', err);
		res.status(500).json({ error: 'Internal error' });
	}
});

const DEAL_MEMBERSHIP_FIELDS = [
	'Stage', 'Membership_Type', 'Expiry_Date', 'Start_Date', 'Contact_Name', 'Member_Profile',
];

function isCurrentMembership(deal, today) {
	if (deal.Stage !== 'Active') return false;
	if (!['Associate', 'International', 'Full'].includes(deal.Membership_Type)) return false;
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
	const activeDeal = (dealBody.data || []).find((deal) => isCurrentMembership(deal, today));
	const membershipStart = startDate || today;
	const membershipExpiry = expiryDate || addYears(membershipStart, 1);
	return activeDeal ? {
		membershipRequired: false,
		membershipStatus: 'active',
		membershipType: activeDeal.Membership_Type,
		membershipStart: activeDeal.Start_Date || null,
		membershipExpiry: activeDeal.Expiry_Date || null,
		membershipId: activeDeal.Member_Profile && activeDeal.Member_Profile.id || null,
		dealId: activeDeal.id,
	} : {
		membershipRequired: true,
		membershipStatus: 'new',
		membershipType: 'Associate',
		membershipStart,
		membershipExpiry,
	};
}

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
		const maxResults = Math.max(1, Number(process.env.LOQATE_MAX_RESULTS) || 10);
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
	try {
		const catalystApp = catalyst.initialize(req);
		const { headers } = await catalystApp.connections().getConnectionCredentials(CRM_CONNECTION_NAME);
		crmHeaders = headers;
		const accreditationRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Training_Centre_Accred/${accreditationId}?fields=Application_Stage,Accreditation_Status,Payment_Status,Stripe_Checkout_Session_ID,Stripe_Payment_Link`, { headers });
		if (accreditationRes.ok) {
			const accreditationBody = await accreditationRes.json();
			const accreditation = accreditationBody.data && accreditationBody.data[0];
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
	if (!process.env.STRIPE_SECRET_KEY || !accreditationPrice || (membershipRequired && !combinedPrice)) {
		return res.status(503).json({ error: 'Stripe checkout is not configured' });
	}
	try {
		const params = new URLSearchParams();
		params.set('mode', 'payment');
		params.set('success_url', process.env.STRIPE_SUCCESS_URL || `${req.protocol}://${req.get('host')}/app/index.html?payment=success`);
		params.set('cancel_url', process.env.STRIPE_CANCEL_URL || `${req.protocol}://${req.get('host')}/app/index.html?payment=cancelled`);
		params.set('customer_email', email);
		// The membership Price is a combined £409 product, not an additional line item.
		params.set('line_items[0][price]', membershipRequired ? combinedPrice : accreditationPrice);
		params.set('line_items[0][quantity]', '1');
		const metadata = {
			accreditation_id: accreditationId, application_id: applicationId || accreditationId,
			contact_id: contactId, email, name: name || '',
			product_details: membershipRequired ? 'Accreditation + Associate Membership' : 'Accreditation',
			product_name: membershipRequired ? 'Accreditation + Associate Membership' : 'Standard Accreditation',
			product_amount: membershipRequired ? '409.00' : '354.00', currency: 'GBP',
			membership_required: membershipRequired ? 'true' : 'false', membership_id: membershipId || '', status: 'pending',
			membership_details: JSON.stringify({
				required: membershipRequired,
				type: membershipRequired ? 'Associate' : null,
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
			const centre = centreById[mainCentreIdByAccId[a.id]];
			const courseIds = courseIdsByAccId[a.id] || [];
			const courseDetails = courseIds.map((id) => courseById[id]).filter(Boolean).map((c) => ({
				name: c.Name,
				duration: c.Duration || null,
				cpdPoints: c.CPD_Points ?? null,
			}));
			const courseNames = courseDetails.map((c) => c.name);
			return {
				id: a.id,
				accountId,
				accountName: a.Account && a.Account.name,
				schoolName: (centre && centre.Name) || (a.Account && a.Account.name) || null,
				town: (centre && centre.Town) || null,
				level: a.Accreditation_Level || null,
				applicationStage: a.Application_Stage || null,
				status: a.Accreditation_Status || null,
				stripeCheckoutSessionId: a.Stripe_Checkout_Session_ID || null,
				stripePaymentLink: a.Stripe_Payment_Link || null,
				validFrom: a.Valid_From || null,
				validTo: a.Valid_To || null,
				daysToRenewal: a.Days_to_Renewal ?? null,
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
		.map((a) => ({ id: a.Account.id, name: a.Account.name, accreditationId: a.id, applicationStage: a.Application_Stage, accreditationStatus: a.Accreditation_Status }))
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
		// This update is intentionally idempotent. CRM search indexing can lag behind
		// a newly-created Qualification, so counting records here caused a saved
		// qualification to be reported as a failure when the follow-up stage update
		// failed. Reapplying the same stage for later qualifications is harmless.
		let stageUpdated = true;
		let warning = null;
		try {
			await crmUpdate(headers, 'Training_Centre_Accred', selected.accreditationId, { Application_Stage: 'Needs Processing' });
		} catch (stageErr) {
			stageUpdated = false;
			warning = 'Your qualification was saved, but the application status could not be refreshed. The Guild team can still review the qualification.';
			console.log('qualification saved but accreditation stage update failed', stageErr && stageErr.details ? stageErr.details : stageErr);
		}
		res.status(201).json({ qualification: { id, ...record }, applicationStage: stageUpdated ? 'Needs Processing' : null, stageUpdated, warning });
	} catch (err) {
		console.log('qualification create error', err, err.details && JSON.stringify(err.details));
		res.status(502).json({ error: 'Qualification could not be saved', debug: { name: err.name, message: err.message, details: err.details, stack: err.stack } });
	}
});

function toYesNo(value) {
	return value === true || value === 'Yes' ? 'Yes' : value === false || value === 'No' ? 'No' : undefined;
}

function draftAccreditationRecord(payload, stage = 'Draft') {
	const declarations = payload.declarations || [];
	return {
		Applicant_Contact: payload.contactId,
		Account: payload.accountId,
		Accreditation_Level: 'Standard Accreditation Annual',
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
	// its own, since Course/Accreditation alone would already look "covered".
	const existingRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/TC_Course_Offering/search?criteria=((Accreditation:equals:${accreditationId})and(Training_Centre:equals:${centreId})and(${idCriteria}))&fields=Course`, { headers });
	const existing = existingRes.ok && existingRes.status !== 204 ? ((await existingRes.json()).data || []) : [];
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
		const validTo = addYears(today, 1);
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
		res.json({ draft: { id: accreditationId, accountId, centreId, linkId, stepIndex: payload.stepIndex || 0, schoolName } });
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
		if (!accRes.ok) return res.status(404).json({ error: 'Draft not found' });
		const accBody = await accRes.json();
		const record = accBody.data && accBody.data[0];
		if (!record || record.Applicant_Contact && record.Applicant_Contact.id !== contactId) return res.status(404).json({ error: 'Draft not found' });
		const accountId = record.Account && record.Account.id;
		const centreRes = accountId ? await fetch(`${CRM_API_DOMAIN}/crm/v3/Training_Centres/search?criteria=(Account:equals:${accountId})&fields=${TRAINING_CENTRE_FIELDS.join(',')}`, { headers }) : null;
		const centre = centreRes && centreRes.ok ? ((await centreRes.json()).data || [])[0] : null;
		const offeringsRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/TC_Course_Offering/search?criteria=(Accreditation:equals:${id})&fields=Course`, { headers });
		const offerings = offeringsRes.ok ? ((await offeringsRes.json()).data || []) : [];
		const linkRes = await fetch(`${CRM_API_DOMAIN}/crm/v3/Accreditation_Centre_Link/search?criteria=(Accreditation:equals:${id})&fields=Name,Training_Centre`, { headers });
		const link = linkRes.ok ? ((await linkRes.json()).data || [])[0] : null;
		res.json({ accreditation: record, account: { id: accountId, name: record.Account && record.Account.name }, centre, linkId: link && link.id, courseIds: offerings.map((x) => x.Course && x.Course.id).filter(Boolean) });
	} catch (err) {
		console.log('draft fetch error', err);
		res.status(502).json({ error: 'Draft fetch failed' });
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
		if (!accRes.ok) return res.status(404).json({ error: 'Accreditation not found' });
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
		if (!accRes.ok) return res.status(404).json({ error: 'Accreditation not found' });
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
		if (!accRes.ok) return res.status(404).json({ error: 'Accreditation not found' });
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
		for (const r of relations) {
			const contact = r.Tutor_Contact;
			const dealId = r.Tutor_Relationship && r.Tutor_Relationship.id;
			const membership = dealId && membershipById[memberProfileIdByDealId[dealId]];
			if (!contact || !membership) continue;
			const row = {
				id: r.id,
				name: contact.name,
				membershipNumber: membership.Name,
				membershipExpiry: membership.Current_Membership_Expiry || null,
			};
			(membership.Current_Membership_Status === 'Expired' ? expired : current).push(row);
		}

		res.json({ current, expired });
	} catch (err) {
		console.log('tutors list error', err);
		res.status(502).json({ error: 'Tutors lookup failed' });
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

function addYears(isoDate, years) {
	const d = new Date(isoDate);
	d.setFullYear(d.getFullYear() + years);
	return d.toISOString().slice(0, 10);
}

// Submits the finished Accreditation application: creates the Account, Training Centre,
// the Accreditation record itself, and the link joining them. Application Stage is set to
// "Awaiting Payment" since there's no real payment processor wired up yet - not "Paid".
// Membership bundling (auto-adding Associate Membership for non-members) is not implemented
// yet - the real pricing for that isn't available in any document we have.
app.post('/accreditations/submit', async (req, res) => {
	const {
		contactId, school, declarations, otherTutors, numberOfTutors, tutorQualified,
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
		const validTo = addYears(today, 1);
		const yesNo = (v) => (v ? 'Yes' : 'No');

		const accredRecord = {
			Applicant_Contact: contactId,
			Account: accountId,
			Accreditation_Level: 'Standard Accreditation Annual',
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

		res.json({
			accreditation: {
				id: accredId, accountId, centreId, linkId, schoolName: school.name, level: 'Standard Accreditation Annual',
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
	const { contactId, accountId, accreditationId, school, courseIds } = req.body || {};
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
		const accredBody = accredRes.ok ? await accredRes.json() : null;
		const validTo = (accredBody && accredBody.data && accredBody.data[0] && accredBody.data[0].Valid_To) || addYears(today, 1);

		const linkId = await crmCreate(headers, 'Accreditation_Centre_Link', {
			Name: `${school.name} - Additional Centre`,
			Accreditation: accreditationId,
			Training_Centre: centreId,
			Centre_Relationship_Type: 'Additional Centre',
			Start_Date: today,
			End_Date: validTo,
		});

		// Additional venues don't ask the applicant to re-pick courses or re-answer the tutor
		// questions - they offer the same courses as the school's MAIN centre specifically, and
		// tutor info already lives once on the shared Training_Centre_Accred, not per venue. If
		// the caller doesn't pass courseIds explicitly, copy the main centre's current offerings -
		// resolved via the Main Centre link, not "any offering under this accreditation", which
		// would wrongly pull in other additional venues' courses too once more than one exists.
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

module.exports = app;
