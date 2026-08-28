import React, { useEffect, useRef, useState } from 'react';
import './AccreditationApp.css';
import StepProgress from './components/StepProgress';
import Modal from './components/Modal';
import Sidebar from './Sidebar';
import AccreditationEntry from './AccreditationEntry';
import ManageSchool from './ManageSchool';
import AccreditationDone from './AccreditationDone';
import AccountStep from './steps/AccountStep';
import RegisterDetailsStep from './steps/RegisterDetailsStep';
import RegisterAddressStep from './steps/RegisterAddressStep';
import DetailsStep from './steps/DetailsStep';
import InterestsStep from './steps/InterestsStep';
import AddressStep from './steps/AddressStep';
import DeclarationsStep from './steps/DeclarationsStep';
import CoursesStep from './steps/CoursesStep';
import SchoolStep from './steps/SchoolStep';
import GeocodingStep from './steps/GeocodingStep';
import TutorsVenuesStep from './steps/TutorsVenuesStep';
import SummaryStep from './steps/SummaryStep';
import {
  initialAccState, isStepValid, mergeInterestsWithTraining, withDialCode, parseDialCode,
  ACCREDITATION_FEE, ACCREDITATION_VAT, ACCREDITATION_GRAND_TOTAL, ACCREDITATION_WITH_MEMBERSHIP, formatUkDate,
} from './data';
import { loadDrafts, upsertDraft, deleteDraft } from './drafts';
import { loadSession, saveSession, clearSession } from './session';
import { fetchActiveCourses, lookupContactByEmail, fetchAccreditations, fetchAccreditationDraft, saveAccreditationDraft, createContact, submitAccreditation, resolveMembership, createCheckoutSession } from './api';

const STEP_NEXT_LABEL = { 8: 'Review and pay →' };

function toSchoolCard(a) {
  return {
    id: a.id,
    accountId: a.accountId,
    accountName: a.accountName,
    accreditationId: a.id,
    name: a.schoolName || 'Unnamed training centre',
    town: a.town || '',
    level: a.level || '',
    expires: formatUkDate(a.validTo),
    courses: a.courseCount ?? '–',
    courseList: a.courseDetails || [],
    tutors: a.tutors ?? '–',
    daysLeft: a.daysToRenewal ?? '–',
    status: a.status === 'Verified' ? 'Accredited' : a.status === 'Closed' ? 'Not currently accredited' : (a.status || 'Status unavailable'),
    qualificationCount: a.qualificationCount || 0,
    qualificationsComplete: a.qualificationsComplete === true,
  };
}

function toPendingItem(a) {
  return {
    id: a.id,
    name: a.schoolName || 'Unnamed training centre',
    courses: a.courseNames ?? '–',
    applicationStage: a.applicationStage,
    stripePaymentLink: a.stripePaymentLink,
    accountId: a.accountId,
    accountName: a.accountName,
    accreditationId: a.id,
    qualificationCount: a.qualificationCount || 0,
    qualificationsComplete: a.qualificationsComplete === true,
  };
}

function toDraftItem(a) {
  return {
    id: a.id,
    crmId: a.id,
    stepIndex: 1,
    skippedAccount: true,
    updatedAt: a.updatedAt || new Date().toISOString(),
    acc: { sch: { name: a.schoolName || '' } },
  };
}

function PortalDashboard({ contact, membership, onAccreditation, onNavigate }) {
  return (
    <>
      <div className="acc-body portal-dashboard" style={{ flexDirection: 'column', alignItems: 'stretch', width: '100%' }}>
        <div className="portal-hero">
          <div><div className="portal-eyebrow">BEAUTY GUILD MEMBER PORTAL</div><h1>Your portal at a glance</h1><p>Manage your membership, courses, accreditation and future insurance services in one place.</p></div>
          <button type="button" className="acc-btn-primary" onClick={onAccreditation}>Open accreditation →</button>
        </div>
        <div className="portal-card-grid">
          <button type="button" className="portal-card" onClick={() => onNavigate('Membership')}><span className="portal-card-kicker">MEMBERSHIP</span><strong>{membership?.membershipStatus === 'active' ? `${membership.membershipType || 'Guild'} membership` : 'Membership'}</strong><span>{membership?.membershipStatus === 'active' ? `Valid until ${formatUkDate(membership.membershipExpiry) || 'recorded date'}` : 'View your membership status'}</span></button>
          <button type="button" className="portal-card" onClick={() => onNavigate('GTi courses')}><span className="portal-card-kicker">LEARNING</span><strong>GTi courses</strong><span>Browse available courses</span></button>
          <button type="button" className="portal-card" onClick={onAccreditation}><span className="portal-card-kicker">ACCREDITATION</span><strong>Training centres</strong><span>View applications and accredited schools</span></button>
          <button type="button" className="portal-card" onClick={() => onNavigate('Insurance')}><span className="portal-card-kicker">COMING SOON</span><strong>Insurance</strong><span>Insurance services will be available here</span></button>
        </div>
      </div>
    </>
  );
}

function PortalPlaceholder({ title }) {
  return <div className="acc-body" style={{ flexDirection: 'column', alignItems: 'stretch' }}><div className="portal-placeholder"><div className="portal-eyebrow">BEAUTY GUILD PORTAL</div><h1>{title}</h1><p>This area is being prepared for the next portal phase.</p></div></div>;
}

function MembershipPage({ membership, membershipError, onRetry, onAccreditation }) {
  if (!membership) return <>
    <div className="acc-body portal-section-page">
      <div className="portal-section-heading"><span className="portal-eyebrow">YOUR MEMBERSHIP</span><h1>Membership details</h1></div>
      {membershipError
        ? <div className="acc-warning"><div className="acc-warning-title">We couldn't load your membership</div><div className="acc-warning-body">{membershipError}</div><button type="button" className="acc-btn-secondary" onClick={onRetry}>Try again</button></div>
        : <div className="portal-loading"><span className="acc-spinner" /> Checking your membership…</div>}
    </div>
  </>;
  const active = membership?.membershipStatus === 'active';
  return <>
    <div className="acc-body portal-section-page">
      <div className="portal-section-heading"><span className="portal-eyebrow">YOUR MEMBERSHIP</span><h1>Membership details</h1></div>
      <section className="membership-page-panel">
        <div>
          <span className={`acc-status-badge${active ? '' : ' warning'}`}>{active ? 'Current' : 'No current membership'}</span>
          <h2>{active ? `${membership.membershipType || 'Guild'} membership` : 'Associate membership'}</h2>
          <p>{active
            ? `Your membership is current${membership.membershipExpiry ? ` until ${formatUkDate(membership.membershipExpiry)}` : ''}.`
            : 'No current membership was found. Associate Membership will be included when required for a new accreditation.'}</p>
        </div>
        <dl className="membership-detail-list">
          <div><dt>Membership type</dt><dd>{active ? (membership.membershipType || 'Guild membership') : 'Not currently active'}</dd></div>
          <div><dt>Status</dt><dd>{active ? 'Current' : 'Not current'}</dd></div>
          <div><dt>Expiry date</dt><dd>{active ? (formatUkDate(membership.membershipExpiry) || 'Not recorded') : '—'}</dd></div>
        </dl>
      </section>
      {!active && <div className="acc-info-note">Starting an accreditation will show the membership-inclusive price before you pay.</div>}
      <button type="button" className="acc-btn-primary membership-page-action" onClick={onAccreditation}>View accreditation options →</button>
    </div>
  </>;
}

export default function AccreditationApp() {
  const [screen, setScreen] = useState('entry'); // 'entry' | 'wizard' | 'done' | 'manage'
  const [stepIndex, setStepIndex] = useState(0);
  const [skippedAccount, setSkippedAccount] = useState(false);
  const [acc, setAcc] = useState(initialAccState);
  const [modal, setModal] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [manageInitialOption, setManageInitialOption] = useState(null);
  const [drafts, setDrafts] = useState(() => loadDrafts());
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [activeDraftRefs, setActiveDraftRefs] = useState({ accountId: null, centreId: null, linkId: null });
  const [courses, setCourses] = useState(null);
  const [coursesError, setCoursesError] = useState(null);
  // No real backend session yet - this simulates "already logged in" for this
  // browser session only, set true on completing the Account step (login or register).
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // The CRM Contact resolved for whoever completed the Account step this session -
  // null email means no CRM match (a brand-new registrant, nothing to prefill).
  const [loggedInContact, setLoggedInContact] = useState(null);
  const [checkingIdentity, setCheckingIdentity] = useState(false);
  const [identityError, setIdentityError] = useState(null);
  const [accreditedSchools, setAccreditedSchools] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [awaitingPaymentApplications, setAwaitingPaymentApplications] = useState([]);
  const [accreditationsError, setAccreditationsError] = useState(null);
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  // Set right after a fresh submission. Zoho CRM's search index can lag ~20-30s behind a
  // write, so the very next fetch (fired the instant "Go to your dashboard" is clicked) can
  // still come back without the new record. goEntry() polls until this name shows up, rather
  // than firing a single fetch that loses the race and looks like "not refreshing" to the user.
  const justSubmittedSchoolNameRef = useRef(null);
  const handledCatalystUserRef = useRef(null);
  // Safety net for exactly one AccountStep mount right after an explicit logout: skips the
  // "already authenticated?" check so we never silently log back in while signOut()'s
  // redirect is still in flight - see the logout() comment below.
  const justLoggedOutRef = useRef(false);
  // Where a brand-new registrant is within the Register mini-flow: the real production
  // journey is Email/Password -> Your Details+Interests -> Home Address -> Create Account,
  // not steps inside the Accreditation wizard itself.
  const [registerStage, setRegisterStage] = useState('account');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [submittingAccred, setSubmittingAccred] = useState(false);
  const [membershipDecision, setMembershipDecision] = useState(null);
  const [checkingMembership, setCheckingMembership] = useState(false);
  const [membershipError, setMembershipError] = useState('');
  const [payingApplicationId, setPayingApplicationId] = useState(null);
  // Which WordPress link brought the visitor here - set via ?intent=apply on the URL.
  // 'apply' (the "Apply Accreditation" link) goes straight into the wizard once identified;
  // anything else ('login', or no param) is the plain "Login" link, which lands on the dashboard.
  const [entryIntent] = useState(() => (
    new URLSearchParams(window.location.search).get('intent') === 'apply' ? 'apply' : 'login'
  ));

  const applyDashboardData = ({ accredited, drafts: crmDrafts, pending, awaitingPayment }) => {
    setAccreditedSchools((accredited || []).map(toSchoolCard));
    setDrafts((crmDrafts || []).map(toDraftItem));
    setPendingApplications((pending || []).map(toPendingItem));
    setAwaitingPaymentApplications((awaitingPayment || []).map(toPendingItem));
  };

  useEffect(() => {
    let cancelled = false;
    fetchActiveCourses()
      .then((data) => { if (!cancelled) setCourses(data); })
      .catch((err) => { if (!cancelled) setCoursesError(err.message); });
    return () => { cancelled = true; };
  }, []);

  // Stand-in for a real shared session with WordPress: if this browser already resolved an
  // identity earlier, don't force the login screen again. A real handoff would instead have
  // WordPress pass an authenticated identity to us directly - see enterWizardWithContact.
  //
  // The cached contact is re-verified against live CRM before being trusted, rather than used
  // as-is - a contact that existed when the session was cached can later be deleted/merged in
  // CRM, and blindly trusting a stale id here caused real submissions to fail with an
  // unrecoverable "invalid Contact" error deep in accreditation/venue creation.
  useEffect(() => {
    const stored = loadSession();
    if (!stored || !stored.email) return;
    setCheckingIdentity(true);
    lookupContactByEmail(stored.email)
      .then(({ exists, contact }) => {
        if (!exists || !contact) {
          console.log('cached session contact no longer exists in CRM, clearing stale session');
          clearSession();
          setCheckingIdentity(false);
          return;
        }
        setLoggedInContact(contact);
        saveSession(contact);
        setIsLoggedIn(true);
        setScreen('portal');
        setCheckingIdentity(false);
        setMembershipError('');
        resolveMembership(contact.id).then(setMembershipDecision).catch((err) => setMembershipError(err.message || 'Membership details could not be loaded.'));
        fetchAccreditations(contact.id)
          .then(applyDashboardData)
          .catch((err) => {
            console.log('accreditations lookup failed', err);
            setAccreditationsError(err.message);
          });
      })
      .catch((err) => {
        console.log('cached session verification failed, clearing stale session', err);
        clearSession();
        setCheckingIdentity(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAccField = (key, value) => {
    setAcc((prev) => ({ ...prev, [key]: value }));
  };
  const setAddrField = (key, value) => setAcc((prev) => ({ ...prev, addr: { ...prev.addr, [key]: value } }));
  const setSchField = (key, value) => setAcc((prev) => ({ ...prev, sch: { ...prev.sch, [key]: value } }));

  const toggleInterest = (value) => {
    if (value === 'Training') return;
    setAcc((prev) => ({
      ...prev,
      interests: prev.interests.includes(value) ? prev.interests.filter((v) => v !== value) : [...prev.interests, value],
    }));
  };

  const toggleCourse = (value) => setAcc((prev) => ({
    ...prev,
    courses: prev.courses.includes(value) ? prev.courses.filter((v) => v !== value) : [...prev.courses, value],
  }));

  const setDeclaration = (index, value) => {
    setAcc((prev) => {
      const decls = [...prev.decls];
      decls[index] = value;
      return { ...prev, decls };
    });
  };


  const copyCorrToSch = () => setAcc((prev) => ({
    ...prev,
    schLooked: true,
    sch: {
      ...prev.sch,
      contact: [prev.title, prev.fname, prev.surname].filter(Boolean).join(' ').trim(),
      email: prev.email, phone: prev.phone, mobile: prev.mobile,
      phoneCode: prev.phoneCode, mobileCode: prev.mobileCode,
      pc: prev.addr.pc, l1: prev.addr.l1, l2: prev.addr.l2, l3: prev.addr.l3,
      town: prev.addr.town, county: prev.addr.county, country: prev.addr.country,
    },
  }));

  const onOtChange = (v) => setAcc((prev) => ({
    ...prev,
    ot: v,
    tutQual: v === 'no' ? null : prev.tutQual,
    otN: v === 'no' ? '' : prev.otN,
  }));

  const saveQuote = async () => {
    if (!loggedInContact?.id) {
      setModal({ title: 'Please log in first', body: 'You must be logged in before an application can be saved.' });
      return;
    }
    try {
      const draft = await saveAccreditationDraft({
        contactId: loggedInContact.id,
        accreditationId: activeDraftId,
        ...activeDraftRefs,
        stepIndex,
        school: {
          name: acc.sch.name,
          email: acc.sch.email,
          phone: acc.sch.phone,
          mobile: acc.sch.mobile,
          addressLine1: acc.sch.l1,
          addressLine2: acc.sch.l2,
          addressLine3: acc.sch.l3,
          town: acc.sch.town,
          county: acc.sch.county,
          country: acc.sch.country,
          postcode: acc.sch.pc,
        },
        declarations: acc.decls.map((v) => v === 'yes' ? 'Yes' : v === 'no' ? 'No' : undefined),
        otherTutors: acc.ot === 'yes', numberOfTutors: acc.otN, tutorQualified: acc.tutQual === 'yes',
        otherVenues: acc.ov === 'yes', courseIds: acc.courses, termsAccepted: acc.tob,
        accreditationFee: ACCREDITATION_FEE, vatAmount: ACCREDITATION_VAT, totalQuoted: ACCREDITATION_GRAND_TOTAL,
      });
      setActiveDraftId(draft.id);
      setActiveDraftRefs({ accountId: draft.accountId, centreId: draft.centreId, linkId: draft.linkId });
      setDrafts(upsertDraft({ id: draft.id, crmId: draft.id, stepIndex, skippedAccount, acc, updatedAt: new Date().toISOString() }));
      setModal({ title: 'Application saved', body: 'Your application has been saved as a draft. You can continue it from your dashboard.', saved: true });
    } catch (err) {
      setModal({ title: "Couldn't save application", body: err.message || 'Something went wrong. Please try again.' });
    }
  };

  const closeModal = () => {
    const wasSaved = modal?.saved;
    setModal(null);
    if (wasSaved) goEntry();
  };

  // Always refreshes accreditations on the way back to the dashboard, regardless of which
  // action sent us here (submitting, discarding a draft, backing out of Manage School) -
  // centralising this here instead of remembering to refetch after every individual action.
  const goEntry = () => {
    setSelectedSchool(null);
    setManageInitialOption(null);
    setScreen('entry');
    if (!loggedInContact || !loggedInContact.id) return;

    const contactId = loggedInContact.id;
    const awaitedName = justSubmittedSchoolNameRef.current;
    justSubmittedSchoolNameRef.current = null;

    setRefreshingDashboard(true);
    const attempt = (attemptsLeft) => {
      fetchAccreditations(contactId)
        .then((data) => {
          applyDashboardData(data);
          const { pending, drafts: crmDrafts } = data;
          const stillMissing = awaitedName && ![...(pending || []), ...(crmDrafts || [])].some((p) => p.schoolName === awaitedName);
          if (stillMissing && attemptsLeft > 0) {
            setTimeout(() => attempt(attemptsLeft - 1), 4000);
          } else {
            setRefreshingDashboard(false);
          }
        })
        .catch((err) => {
          console.log('dashboard refresh failed', err);
          setRefreshingDashboard(false);
        });
    };
    // CRM's search index can take ~20-30s to catch up after a fresh submission - retry a few
    // times rather than firing one fetch that's likely to lose that race.
    attempt(awaitedName ? 8 : 0);
  };

  // Jumps straight into "Your details" (step 1), skipping the Account step - used both for the
  // dashboard's "Apply for new accreditation" button and for the WordPress "Apply Accreditation"
  // link once identity is known, so a returning member never re-answers the login step.
  const enterWizardWithContact = (contact) => {
    const fresh = initialAccState();
    setMembershipDecision(null);
    setMembershipError('');
    if (contact) {
      fresh.email = contact.email || '';
      if (contact.title) fresh.title = contact.title;
      if (contact.firstName) fresh.fname = contact.firstName;
      if (contact.lastName) fresh.surname = contact.lastName;
      if (contact.phone) { const p = parseDialCode(contact.phone); fresh.phone = p.number; fresh.phoneCode = p.code; }
      if (contact.mobile) { const m = parseDialCode(contact.mobile); fresh.mobile = m.number; fresh.mobileCode = m.code; }
      fresh.interests = mergeInterestsWithTraining(contact.interests);
      // Everything on the Address step comes from Correspondence_* on the Contact.
      if (contact.addressLine1 || contact.town) {
        fresh.addrLooked = true;
        if (contact.addressLine1) fresh.addr.l1 = contact.addressLine1;
        if (contact.addressLine2) fresh.addr.l2 = contact.addressLine2;
        if (contact.postcode) fresh.addr.pc = contact.postcode;
        if (contact.town) fresh.addr.town = contact.town;
        if (contact.county) fresh.addr.county = contact.county;
        if (contact.country) fresh.addr.country = contact.country;
      }
    }
    setAcc(fresh);
    setActiveDraftId(null);
    setSkippedAccount(true);
    setStepIndex(1);
    setScreen('wizard');
  };

  const logout = () => {
    // Per Catalyst's Web SDK docs, signOut() takes a required redirect URL and performs
    // a real page navigation through Zoho's own logout endpoint - it does not return a
    // promise. Calling it with no argument (as before) is why it never actually ended the
    // identity session and briefly threw. Reset our own state first in case the redirect
    // takes a moment, then hand off to Zoho to end the session and bring us back here.
    justLoggedOutRef.current = true;
    handledCatalystUserRef.current = null;
    clearSession();
    setIsLoggedIn(false);
    setLoggedInContact(null);
    setMembershipDecision(null);
    setIdentityError(null);
    setAcc(initialAccState());
    setAccreditedSchools([]);
    setPendingApplications([]);
    setAccreditationsError(null);
    setSkippedAccount(false);
    setActiveDraftId(null);
    setSelectedSchool(null);
    setStepIndex(0);
    setRegisterStage('account');
    setScreen('entry');
    if (window.catalyst && window.catalyst.auth && typeof window.catalyst.auth.signOut === 'function') {
      window.catalyst.auth.signOut(`${window.location.origin}/app/index.html`);
    }
  };

  // "Having issues finding your address automatically? Click here to enter manually" -
  // same as a successful lookup, just without prefilling anything.
  const enterAddressManually = () => setAccField('addrLooked', true);
  const enterSchoolManually = () => setAccField('schLooked', true);

  const handleRegisterDetailsNext = () => {
    if (!isStepValid(1, acc) || !isStepValid(2, acc)) return;
    setRegisterStage('address');
  };

  const handleGateBack = () => {
    if (registerStage === 'details') {
      setRegisterStage('account');
    } else if (registerStage === 'address') {
      if (acc.addrLooked) setAccField('addrLooked', false);
      else setRegisterStage('details');
    }
  };

  // Register step 4 -> creates the CRM Contact.
  const createAccount = async () => {
    setCreatingAccount(true);
    try {
      const contact = await createContact({
        email: acc.email,
        title: acc.title,
        firstName: acc.fname,
        lastName: acc.surname,
        phone: withDialCode(acc.phoneCode, acc.phone),
        mobile: withDialCode(acc.mobileCode, acc.mobile),
        interests: acc.interests,
        addressLine1: acc.addr.l1,
        addressLine2: acc.addr.l2,
        addressLine3: acc.addr.l3,
        postcode: acc.addr.pc,
        town: acc.addr.town,
        county: acc.addr.county,
        country: acc.addr.country,
      });
      setLoggedInContact(contact);
      saveSession(contact);
      setAccreditedSchools([]);
      setPendingApplications([]);
      setIsLoggedIn(true);
      if (entryIntent === 'apply') enterWizardWithContact(contact);
    } catch (err) {
      console.log('account creation failed', err);
      setModal({ title: "Couldn't create your account", body: err.message || 'Something went wrong. Please try again.' });
    }
    setCreatingAccount(false);
  };

  const startApplyExisting = () => {
    if (isLoggedIn && loggedInContact) {
      enterWizardWithContact(loggedInContact);
    } else {
      setMembershipDecision(null);
      setAcc(initialAccState());
      setActiveDraftId(null);
      setSkippedAccount(false);
      setStepIndex(0);
      setScreen('wizard');
    }
  };
  const selectSchool = (school, initialOption) => {
    setSelectedSchool(school);
    setManageInitialOption(initialOption || null);
    setScreen('manage');
  };

  const loadExistingApplication = (application, targetStep = null, errorTitle = "Couldn't open application") => {
    const load = async () => {
      try {
        const detail = await fetchAccreditationDraft(application.crmId || application.id, loggedInContact.id);
        const record = detail.accreditation || {};
        const centre = detail.centre || {};
        const yesNo = (value) => value === 'Yes' ? 'yes' : value === 'No' ? 'no' : undefined;
        const next = initialAccState();
        next.mode = 'login'; next.email = loggedInContact.email || '';
        next.title = loggedInContact.title || ''; next.fname = loggedInContact.firstName || ''; next.surname = loggedInContact.lastName || '';
        next.interests = mergeInterestsWithTraining(loggedInContact.interests);
        next.decls = [record.Declaration_1_qualified_for_six_months, record.Declaration_2_teaching_qualification, record.Declaration_3_evidence_available].map(yesNo);
        next.courses = detail.courseIds || [];
        next.schLooked = !!centre.Name;
        next.sch = { ...next.sch, name: centre.Name || '', contact: [next.title, next.fname, next.surname].filter(Boolean).join(' '), email: centre.Email || next.email, phone: centre.Phone_Number || '', mobile: centre.Mobile_Phone_Number || '', l1: centre.Address_Line_1 || '', l2: centre.Address_Line_2 || '', l3: centre.Address_Line_3 || '', town: centre.Town || '', county: centre.County || '', country: centre.Country || 'United Kingdom', pc: centre.Postcode || '' };
        next.ot = record.Other_Tutors_Used === true ? 'yes' : record.Other_Tutors_Used === false ? 'no' : null;
        next.otN = record.Number_of_Tutors || ''; next.tutQual = yesNo(record.Tutor_qualification_declaration_question);
        next.ov = record.Additional_Centres_Used === 'Yes' ? 'yes' : record.Additional_Centres_Used === 'No' ? 'no' : null;
        next.tob = !!record.Terms_Privacy_Accepted;
        setAcc(next); setActiveDraftId(application.crmId || application.id);
        setActiveDraftRefs({ accountId: detail.account?.id || null, centreId: centre.id || null, linkId: detail.linkId || null });
        setSkippedAccount(true); setStepIndex(targetStep == null ? (application.stepIndex || (next.courses.length ? 6 : 1)) : targetStep); setScreen('wizard');
      } catch (err) { setModal({ title: errorTitle, body: err.message || 'The saved application could not be loaded.' }); }
    };
    load();
  };

  const resumeDraft = (draft) => loadExistingApplication(draft);
  const openAwaitingPayment = (application) => loadExistingApplication(application, 9, "Couldn't open payment application");

  const discardDraft = (id) => {
    setDrafts(deleteDraft(id));
    if (activeDraftId === id) setActiveDraftId(null);
  };

  const goBack = () => {
    if (stepIndex === 0 || (stepIndex === 1 && skippedAccount)) {
      goEntry();
    } else {
      setStepIndex((i) => i - 1);
    }
  };

  const resolveIdentity = async (emailOverride, catalystUser) => {
    setCheckingIdentity(true);
    setIdentityError(null);
    const email = emailOverride || acc.email;
    let resolvedContact = { email };
    let crmContactFound = false;
    try {
      const { exists, contact } = await lookupContactByEmail(email);
      if (exists && contact) {
        crmContactFound = true;
        resolvedContact = contact;
        // Everything on the Address step comes from Correspondence_* on the Contact.
        const hasAddress = !!(contact.addressLine1 || contact.town);
        const parsedPhone = contact.phone ? parseDialCode(contact.phone) : null;
        const parsedMobile = contact.mobile ? parseDialCode(contact.mobile) : null;
        setAcc((prev) => ({
          ...prev,
          title: contact.title || prev.title,
          fname: contact.firstName || prev.fname,
          surname: contact.lastName || prev.surname,
          phone: parsedPhone ? parsedPhone.number : prev.phone,
          phoneCode: parsedPhone ? parsedPhone.code : prev.phoneCode,
          mobile: parsedMobile ? parsedMobile.number : prev.mobile,
          mobileCode: parsedMobile ? parsedMobile.code : prev.mobileCode,
          interests: mergeInterestsWithTraining(contact.interests),
          addrLooked: prev.addrLooked || hasAddress,
          addr: {
            ...prev.addr,
            l1: contact.addressLine1 || prev.addr.l1,
            l2: contact.addressLine2 || prev.addr.l2,
            pc: contact.postcode || prev.addr.pc,
            town: contact.town || prev.addr.town,
            county: contact.county || prev.addr.county,
            country: contact.country || prev.addr.country,
          },
        }));
        try {
          applyDashboardData(await fetchAccreditations(contact.id));
        } catch (err) {
          console.log('accreditations lookup failed', err);
          setAccreditationsError(err.message);
        }
      }
    } catch (err) {
      console.log('identity lookup failed, proceeding without CRM prefill', err);
      setIdentityError('We could not verify your account against Beauty Guild CRM. Please contact an administrator before trying again.');
      setCheckingIdentity(false);
      return;
    }

    // Catalyst authentication succeeds before we collect the profile fields
    // required to create the CRM Contact for a brand-new user.
    if (!crmContactFound) {
      const firstName = catalystUser && (catalystUser.first_name || catalystUser.firstName);
      const lastName = catalystUser && (catalystUser.last_name || catalystUser.lastName);
      if (firstName && lastName) {
        try {
          const createdContact = await createContact({ email, firstName, lastName });
          setLoggedInContact(createdContact);
          saveSession(createdContact);
          setCheckingIdentity(false);
          setIsLoggedIn(true);
          setScreen('portal');
          setMembershipError('');
          resolveMembership(createdContact.id).then(setMembershipDecision).catch((err) => setMembershipError(err.message || 'Membership details could not be loaded.'));
          return;
        } catch (err) {
          console.log('automatic CRM contact creation failed', err);
          setIdentityError('Your login was successful, but we could not create your Beauty Guild CRM Contact. Please contact an administrator.');
          setCheckingIdentity(false);
          return;
        }
      }

      setLoggedInContact(resolvedContact);
      setAcc((prev) => ({ ...prev, email, mode: 'register' }));
      setRegisterStage('details');
      setCheckingIdentity(false);
      setIsLoggedIn(false);
      setScreen('entry');
      return;
    }

    setLoggedInContact(resolvedContact);
    saveSession(resolvedContact);
    setCheckingIdentity(false);
    setIsLoggedIn(true);
    setScreen('portal');
    setMembershipError('');
    resolveMembership(resolvedContact.id).then(setMembershipDecision).catch((err) => setMembershipError(err.message || 'Membership details could not be loaded.'));
    // The "Apply Accreditation" link should land directly in the wizard, not the dashboard.
  };

  const handleCatalystAuthenticated = async (user) => {
    const email = user.email_id || user.email || '';
    if (!email) return;
    const userKey = user.user_id || user.zuid || email;
    if (handledCatalystUserRef.current === userKey) return;
    handledCatalystUserRef.current = userKey;
    setAcc((prev) => ({ ...prev, email, mode: 'login' }));
    await resolveIdentity(email, user);
  };

  const goNext = async () => {
    if (!isStepValid(stepIndex, acc)) return;
    if (stepIndex === 0) await resolveIdentity();
    setStepIndex((i) => i + 1);
  };

  const finishAccred = async () => {
    setSubmittingAccred(true);
    let accreditation;
    try {
      accreditation = await submitAccreditation({
        contactId: loggedInContact && loggedInContact.id,
        accreditationId: activeDraftId,
        accountId: activeDraftRefs.accountId,
        centreId: activeDraftRefs.centreId,
        linkId: activeDraftRefs.linkId,
        school: {
          name: acc.sch.name,
          email: acc.sch.email,
          phone: acc.sch.phone,
          mobile: acc.sch.mobile,
          addressLine1: acc.sch.l1,
          addressLine2: acc.sch.l2,
          addressLine3: acc.sch.l3,
          town: acc.sch.town,
          county: acc.sch.county,
          country: acc.sch.country,
          postcode: acc.sch.pc,
        },
        declarations: acc.decls.map((v) => v === 'yes'),
        otherTutors: acc.ot === 'yes',
        numberOfTutors: acc.otN,
        tutorQualified: acc.tutQual === 'yes',
        otherVenues: acc.ov === 'yes',
        courseIds: acc.courses,
        termsAccepted: acc.tob,
        accreditationFee: ACCREDITATION_FEE,
        vatAmount: ACCREDITATION_VAT,
        totalQuoted: membershipDecision?.membershipRequired ? ACCREDITATION_WITH_MEMBERSHIP : ACCREDITATION_GRAND_TOTAL,
      });
      // Keep the CRM record identity before starting Stripe. If checkout fails or
      // the user retries, the next submission updates this record instead of creating
      // another accreditation.
      if (accreditation.id) setActiveDraftId(accreditation.id);
      if (accreditation.accountId || accreditation.centreId || accreditation.linkId) {
        setActiveDraftRefs({ accountId: accreditation.accountId || activeDraftRefs.accountId, centreId: accreditation.centreId || activeDraftRefs.centreId, linkId: accreditation.linkId || activeDraftRefs.linkId });
      }
    } catch (err) {
      console.log('accreditation CRM submission failed', err);
      const partial = err.payload?.partial;
      if (partial?.accreditationId) setActiveDraftId(partial.accreditationId);
      if (partial?.accountId || partial?.centreId || partial?.linkId) {
        setActiveDraftRefs({ accountId: partial.accountId || null, centreId: partial.centreId || null, linkId: partial.linkId || null });
      }
      setModal({ title: "Couldn't save accreditation", body: err.message || 'The accreditation could not be saved to CRM.' });
      setSubmittingAccred(false);
      return;
    }

    try {
      const checkout = await createCheckoutSession({
        accreditationId: accreditation.id,
        applicationId: accreditation.id,
        contactId: loggedInContact && loggedInContact.id,
        email: loggedInContact && loggedInContact.email,
        name: acc.sch.name,
      });
      if (checkout.alreadyPaid) {
        setModal({ title: 'Payment already received', body: 'This application has already been paid. The Guild will confirm it shortly.' });
        setScreen('done');
        setSubmittingAccred(false);
        return;
      }
      if (!checkout.checkoutUrl) throw new Error('Stripe did not return a checkout link. Your application is saved and you can retry payment from Accreditation.');
      if (activeDraftId) {
        setDrafts(deleteDraft(activeDraftId));
        setActiveDraftId(null);
      }
      justSubmittedSchoolNameRef.current = acc.sch.name;
      window.location.assign(checkout.checkoutUrl);
      return;
    } catch (err) {
      console.log('Stripe checkout failed', err);
      setModal({ title: "Couldn't start payment", body: `Your application was saved in CRM, but Stripe checkout could not be opened.\n\n${err.message || 'Please try Pay Now again.'}` });
      setSubmittingAccred(false);
    }
  };

  useEffect(() => {
    if (stepIndex !== 9 || !loggedInContact?.id || membershipDecision || checkingMembership) return undefined;
    let cancelled = false;
    setCheckingMembership(true);
    setMembershipError('');
    resolveMembership(loggedInContact.id)
      .then((decision) => { if (!cancelled) setMembershipDecision(decision); })
      .catch((err) => { if (!cancelled) setMembershipError(err.message || 'We could not confirm your membership pricing.'); })
      .finally(() => { if (!cancelled) setCheckingMembership(false); });
    return () => { cancelled = true; };
    // checkingMembership is intentionally excluded: changing it here would cancel
    // the request that is responsible for resetting it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, loggedInContact, membershipDecision]);

  const retryMembershipCheck = async () => {
    if (!loggedInContact?.id || checkingMembership) return;
    setCheckingMembership(true);
    setMembershipError('');
    try {
      setMembershipDecision(await resolveMembership(loggedInContact.id));
    } catch (err) {
      setMembershipError(err.message || 'We could not confirm your membership pricing.');
    } finally {
      setCheckingMembership(false);
    }
  };

  const payExistingApplication = async (application) => {
    if (!loggedInContact || !application.id || payingApplicationId) return;
    setPayingApplicationId(application.id);
    try {
      const checkout = await createCheckoutSession({
        accreditationId: application.id,
        applicationId: application.id,
        contactId: loggedInContact.id,
        email: loggedInContact.email,
        name: application.name,
      });
      if (checkout.alreadyPaid) {
        setModal({ title: 'Payment already received', body: 'This application has already been paid. Your application will remain available while the Guild confirms it.' });
        goEntry();
        setPayingApplicationId(null);
        return;
      }
      if (!checkout.checkoutUrl) throw new Error('Stripe did not return a checkout link. Please try again.');
      window.location.assign(checkout.checkoutUrl);
    } catch (err) {
      setModal({ title: "Couldn't start payment", body: err.message || 'Something went wrong. Please try again.' });
      setPayingApplicationId(null);
    }
  };

  const renderMain = () => {
    if (isLoggedIn && screen === 'portal') return <PortalDashboard contact={loggedInContact} membership={membershipDecision} onAccreditation={goEntry} onNavigate={setScreen} />;
    if (isLoggedIn && screen === 'Membership') return <MembershipPage membership={membershipDecision} membershipError={membershipError} onRetry={retryMembershipCheck} onAccreditation={goEntry} />;
    if (isLoggedIn && ['GTi courses', 'Insurance', 'My profile', 'Documents'].includes(screen)) return <PortalPlaceholder title={screen} />;
    if (!isLoggedIn && screen === 'entry') {
      // Register stages 2+ (Your Details, Home Address) - the pink banner persists, but the
      // rest of the screen is register-specific, not the Login/Register tab card.
      if (acc.mode === 'register' && registerStage !== 'account') {
        const onAddressLookup = registerStage === 'address' && !acc.addrLooked;
        const footerLabel = registerStage === 'details'
          ? 'Next'
          : (creatingAccount ? 'Creating…' : 'Create Account');
        const footerEnabled = registerStage === 'details'
          ? isStepValid(1, acc) && isStepValid(2, acc)
          : (acc.addrLooked && isStepValid(3, acc) && !creatingAccount);
        const onContinue = registerStage === 'details' ? handleRegisterDetailsNext : createAccount;

        return (
          <>
            <div className="acc-body" style={{ flexDirection: 'column', alignItems: 'stretch', width: '100%' }}>
              <div className="acc-main-col">
                <div style={{ textAlign: 'center' }}>
                  <div className="acc-step-heading" style={{ color: '#E0007F' }}>
                    To start your Accreditation Application, please log into your account or register for a new account.
                  </div>
                </div>
                {registerStage === 'details' ? (
                  <RegisterDetailsStep acc={acc} setAccField={setAccField} toggleInterest={toggleInterest} />
                ) : (
                  <RegisterAddressStep acc={acc} setAddrField={setAddrField} setAccField={setAccField} onManualEntry={enterAddressManually} />
                )}
              </div>
            </div>
            <div className="acc-footer">
              <button type="button" className="acc-back-btn" onClick={handleGateBack}>← Back</button>
              {!onAddressLookup && (
                <div className="acc-footer-right">
                  <button type="button" className="acc-btn-primary" disabled={!footerEnabled} onClick={onContinue}>{footerLabel}</button>
                </div>
              )}
            </div>
          </>
        );
      }

      // Register stage 1 (Email/Password) and the whole Login flow share this screen.
      return (
        <>
          <div className="acc-body" style={{ flexDirection: 'column', alignItems: 'stretch', width: '100%' }}>
            <div className="acc-main-col">
              <AccountStep
                onAuthenticated={handleCatalystAuthenticated}
                authError={identityError}
                skipInitialAuthCheck={justLoggedOutRef.current}
                onAuthCheckSkipped={() => { justLoggedOutRef.current = false; }}
                onResetAuth={logout}
              />
            </div>
          </div>
        </>
      );
    }

    if (screen === 'entry') {
      return (
        <>
          <div className="acc-topbar acc-topbar-actions">
            <button type="button" className="acc-btn-primary" onClick={startApplyExisting}>
              Apply for new accreditation →
            </button>
          </div>
          <AccreditationEntry
            onSelectSchool={selectSchool}
            drafts={drafts}
            onResumeDraft={resumeDraft}
            onDiscardDraft={discardDraft}
            onOpenAwaitingPayment={openAwaitingPayment}
            accreditedSchools={accreditedSchools}
            pendingApplications={pendingApplications}
            awaitingPaymentApplications={awaitingPaymentApplications}
            onPayExistingApplication={payExistingApplication}
            payingApplicationId={payingApplicationId}
            onStartNew={startApplyExisting}
            membership={membershipDecision}
            accreditationsError={accreditationsError}
            refreshing={refreshingDashboard}
          />
        </>
      );
    }

    if (screen === 'manage') {
      return <ManageSchool school={selectedSchool} initialOption={manageInitialOption} contactId={loggedInContact?.id} contact={loggedInContact} onBack={goEntry} />;
    }

    if (screen === 'done') {
      return <AccreditationDone onDashboard={goEntry} />;
    }

    const backLabel = stepIndex === 0 ? 'Cancel' : 'Back';
    const nextLabel = checkingIdentity
      ? 'Checking…'
      : stepIndex === 0
        ? (acc.mode === 'login' ? 'Login →' : 'Next →')
        : (STEP_NEXT_LABEL[stepIndex] || 'Continue →');
    const nextEnabled = isStepValid(stepIndex, acc) && !checkingIdentity;
    const isLastStep = stepIndex === 9;

    const steps = [
      <AccountStep acc={acc} setAccField={setAccField} />,
      <DetailsStep acc={acc} setAccField={setAccField} />,
      <InterestsStep acc={acc} toggleInterest={toggleInterest} />,
      <AddressStep acc={acc} setAddrField={setAddrField} setAccField={setAccField} />,
      <DeclarationsStep acc={acc} setDeclaration={setDeclaration} />,
      <CoursesStep acc={acc} toggleCourse={toggleCourse} courses={courses} coursesError={coursesError} />,
      <SchoolStep acc={acc} setSchField={setSchField} setAccField={setAccField} copyCorrToSch={copyCorrToSch} onManualEntry={enterSchoolManually} />,
      <GeocodingStep acc={acc} setSchField={setSchField} />,
      <TutorsVenuesStep acc={acc} setAccField={setAccField} onOtChange={onOtChange} />,
      <SummaryStep acc={acc} setAccField={setAccField} onPay={finishAccred} onSave={saveQuote} courses={courses} submitting={submittingAccred} checkingMembership={checkingMembership} membershipRequired={membershipDecision?.membershipRequired} membershipError={membershipError} onRetryMembership={retryMembershipCheck} />,
    ];

    return (
      <>
        <StepProgress current={stepIndex} context={acc.sch.name || 'Training centre application'} />
        <div className="acc-body acc-wizard-body">
          <div className="acc-main-col acc-wizard-content" key={stepIndex}>
            {steps[stepIndex]}
          </div>
        </div>
        {!isLastStep && (
          <div className="acc-footer">
            <button type="button" className="acc-back-btn" onClick={goBack}>← {backLabel}</button>
            <div className="acc-footer-right">
              {!nextEnabled && <span className="acc-footer-guidance">Complete the required fields to continue.</span>}
              {stepIndex >= 5 && <button type="button" className="acc-btn-secondary" onClick={saveQuote}>Save &amp; finish later</button>}
              <button type="button" className="acc-btn-primary" disabled={!nextEnabled} onClick={goNext}>{nextLabel}</button>
            </div>
          </div>
        )}
        {isLastStep && (
          <div className="acc-footer">
            <button type="button" className="acc-back-btn" onClick={goBack}>← {backLabel}</button>
            <button type="button" className="acc-btn-secondary" onClick={saveQuote}>Save &amp; finish later</button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="acc-root">
      <div className="acc-shell">
        {isLoggedIn && (
          <Sidebar
            contact={loggedInContact}
            onLogout={logout}
            onDashboard={() => setScreen('portal')}
            onAccreditation={goEntry}
            onSection={(label) => setScreen(label === 'Dashboard' ? 'portal' : label)}
            activeItem={screen === 'portal'
              ? 'Dashboard'
              : ['entry', 'wizard', 'manage', 'done'].includes(screen)
                ? 'Accreditation'
                : screen}
          />
        )}
        <div className="acc-main">
          {renderMain()}
        </div>
      </div>
      <Modal modal={modal} onClose={closeModal} />
    </div>
  );
}
