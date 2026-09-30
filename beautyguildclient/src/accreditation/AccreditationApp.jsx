import React, { useEffect, useRef, useState } from 'react';
import './AccreditationApp.css';
import StepProgress from './components/StepProgress';
import Modal from './components/Modal';
import Sidebar from './Sidebar';
import { PersonIcon, GraduationCapIcon, BuildingIcon, ShieldIcon, MegaphoneIcon, DocumentIcon, LogoutIcon } from './icons';
import AccreditationEntry from './AccreditationEntry';
import ManageSchool, { TableShell, InvoiceStatusBadge } from './ManageSchool';
import ManageMembership from './ManageMembership';
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
  accreditationPricing, formatUkDate,
} from './data';
import { loadDrafts, upsertDraft, deleteDraft } from './drafts';
import { loadSession, saveSession, clearSession, saveReferralCode } from './session';
import { fetchActiveCourses, lookupContactByEmail, fetchAccreditations, fetchAccreditationDraft, saveAccreditationDraft, discardAccreditationDraft, createContact, submitAccreditation, resolveMembership, createCheckoutSession, fetchContactDocuments, fetchMembershipHistory, fetchAccountInvoices } from './api';
import { DocumentGrid } from './documents';
import InsuranceApp from '../insurance/InsuranceApp';

const STEP_NEXT_LABEL = { 8: 'Review and pay →' };

// Static placeholder content, per the "Member Announcements" idea in the design feedback
// doc - there's no CRM/Creator module backing real announcements yet, so this is a single
// hardcoded slot rather than a list. Swap ANNOUNCEMENT to null to hide the section entirely.
const ANNOUNCEMENT = { badge: 'NEW', title: 'Discover Our New GTi Korean Lash Lift Course', actionLabel: 'View Course', href: null };

function MemberAnnouncement({ announcement, onNavigate }) {
  if (!announcement) return null;
  return (
    <div className="portal-announcement">
      <span className="portal-announcement-icon" aria-hidden="true"><MegaphoneIcon /></span>
      <div className="portal-announcement-body">
        <div className="portal-announcement-kicker">Member Announcements <span className="portal-announcement-badge">{announcement.badge}</span></div>
        <strong>{announcement.title}</strong>
      </div>
      <button type="button" className="acc-btn-primary" onClick={() => onNavigate('GTi courses')}>{announcement.actionLabel}</button>
    </div>
  );
}

function DiscardDraftConfirm({ target, onCancel, onConfirm, discarding }) {
  if (!target) return null;
  return (
    <div className="acc-modal-overlay" onClick={onCancel} role="presentation">
      <div className="acc-modal" role="dialog" aria-modal="true" aria-labelledby="discard-draft-title" onClick={(e) => e.stopPropagation()}>
        <div className="acc-modal-icon">⚠️</div>
        <div className="acc-modal-title" id="discard-draft-title">Discard this application?</div>
        <div className="acc-modal-body">"{target.name}" will be permanently deleted and cannot be recovered.</div>
        <div className="tutor-modal-actions"><button type="button" className="acc-btn-secondary" onClick={onCancel} disabled={discarding}>Cancel</button><button type="button" className="acc-btn-primary" onClick={onConfirm} disabled={discarding}>{discarding ? 'Discarding…' : 'Discard application'}</button></div>
      </div>
    </div>
  );
}

function toSchoolCard(a) {
  return {
    id: a.id,
    accountId: a.accountId,
    accountName: a.accountName,
    accreditationId: a.id,
    name: a.schoolName || 'Unnamed training centre',
    referralCode: a.referralCode || null,
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

// CRM's draft list is only ever used to learn about drafts this browser doesn't already
// know about (e.g. started on another device) - it must never overwrite a draft already
// held locally, since toDraftItem's reconstruction is a lossy stub (stepIndex reset to 1,
// only the school name kept) and CRM's own search index lags real writes by ~20-30s. Both
// of those together were the cause of drafts appearing to lose their answers/step on
// resume, and of "duplicate" drafts appearing once the index caught up.
function mergeCrmDrafts(localDrafts, crmDrafts) {
  const localIds = new Set(localDrafts.map((d) => d.id));
  const newFromCrm = (crmDrafts || []).filter((a) => !localIds.has(a.id)).map(toDraftItem);
  return [...localDrafts, ...newFromCrm].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

// The card's heading/copy/action depend on how far along the applicant's accreditation
// is - most-action-needed states take priority over ones that are just "waiting". An
// unpaid draft or awaiting-payment application is the most urgent (nothing happens until
// they finish it), then outstanding qualifications (blocking approval), then a submitted
// application under review (nothing to do but wait), then an accredited centre (business
// as usual), and finally no application at all yet.
function accreditationCardContent({ loaded, drafts, pendingApplications, awaitingPaymentApplications, accreditedSchools, onAccreditation, onResumeDraft, onOpenAwaitingPayment, onSelectQualifications, onStartNew }) {
  // Until the real status has loaded (e.g. straight after a page refresh), don't guess -
  // every field here starts out empty, which would otherwise flash "Apply for Guild
  // Accreditation" even for an applicant who already has one in progress.
  if (!loaded) {
    return { heading: 'Accreditation', body: 'Loading your accreditation status…', onClick: onAccreditation };
  }
  const awaitingItem = (awaitingPaymentApplications || [])[0];
  const draftItem = (drafts || [])[0];
  const outstandingQualsItem = (pendingApplications || []).find((a) => a.applicationStage === 'Qualifications Outstanding');
  const pendingItem = (pendingApplications || [])[0];

  if (awaitingItem || draftItem) {
    return {
      heading: 'Continue Application', body: 'Your Accreditation Application is incomplete.',
      onClick: () => (awaitingItem ? onOpenAwaitingPayment(awaitingItem) : onResumeDraft(draftItem)),
    };
  }
  if (outstandingQualsItem) {
    return {
      heading: 'Add Qualifications', body: 'Your application has been received. Please upload your outstanding qualifications.',
      onClick: () => onSelectQualifications(outstandingQualsItem),
    };
  }
  if (pendingItem) {
    return { heading: 'Accreditation', body: 'Your accreditation application is being reviewed.', onClick: onAccreditation };
  }
  if ((accreditedSchools || []).length > 0) {
    return { heading: 'Accreditation', body: 'View and manage your accreditation application.', onClick: onAccreditation };
  }
  return { heading: 'Apply for Guild Accreditation', body: 'Start your Guild accreditation application.', onClick: onStartNew };
}

// Mobile-only persistent bottom bar (the sidebar itself becomes a hamburger-triggered
// off-canvas drawer below the same breakpoint - see Sidebar.jsx) so the most-used account
// actions stay reachable without opening the drawer.
function MobileTabBar({ activeItem, onSection, onLogout }) {
  const items = [
    { label: 'My profile', icon: <PersonIcon /> },
    { label: 'Documents', icon: <DocumentIcon /> },
  ];
  return (
    <nav className="acc-mobile-tabbar">
      {items.map(({ label, icon }) => (
        <button
          key={label}
          type="button"
          className={`acc-mobile-tab${activeItem === label ? ' active' : ''}`}
          onClick={() => onSection(label)}
        >
          {icon}
          <span>{label}</span>
        </button>
      ))}
      <button type="button" className="acc-mobile-tab" onClick={onLogout}>
        <LogoutIcon />
        <span>Sign out</span>
      </button>
    </nav>
  );
}

function AccountDetailsCard({ contact, membership }) {
  const active = membership?.membershipStatus === 'active';
  const memberName = contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() : '';
  const items = [
    { label: 'Member name', value: memberName || 'Not recorded' },
    { label: 'Membership type', value: active ? (membership.membershipType || 'Guild membership') : 'No current membership' },
    { label: 'Insurance status', value: 'Quotation service available' },
    { label: 'Expiry date', value: active ? (formatUkDate(membership.membershipExpiry) || 'Not recorded') : '—' },
  ];
  return (
    <div className="portal-account-card">
      <div className="portal-account-card-heading">Account details</div>
      <div className="portal-account-card-grid">
        {items.map((item) => (
          <div key={item.label} className="portal-account-stat">
            <span className="portal-account-stat-label">{item.label}</span>
            <span className="portal-account-stat-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PortalDashboard({ contact, membership, accreditationsLoaded, drafts, pendingApplications, awaitingPaymentApplications, accreditedSchools, onAccreditation, onResumeDraft, onOpenAwaitingPayment, onSelectQualifications, onStartNew, onNavigate }) {
  const accreditationCard = accreditationCardContent({ loaded: accreditationsLoaded, drafts, pendingApplications, awaitingPaymentApplications, accreditedSchools, onAccreditation, onResumeDraft, onOpenAwaitingPayment, onSelectQualifications, onStartNew });
  return (
    <>
      <div className="acc-body portal-dashboard" style={{ flexDirection: 'column', alignItems: 'stretch', width: '100%' }}>
        <div className="portal-hero">
          <div><div className="portal-eyebrow">BEAUTY GUILD MEMBER PORTAL</div><h1>Your portal at a glance</h1><p>Manage your membership, courses, accreditation and insurance services in one place.</p></div>
          <button type="button" className="acc-btn-primary" onClick={onAccreditation}>Open accreditation →</button>
        </div>
        <div className="portal-card-grid">
          <button type="button" className="portal-card" onClick={() => onNavigate('Membership')}><span className="portal-card-icon"><PersonIcon /></span><span className="portal-card-kicker">MEMBERSHIP</span><strong>{membership?.membershipStatus === 'active' ? `${membership.membershipType || 'Guild'} Membership` : 'Guild Membership'}</strong><span>{membership?.membershipStatus === 'active' ? `Valid until ${formatUkDate(membership.membershipExpiry) || 'recorded date'}` : 'View your membership status and details.'}</span><span className="portal-card-arrow">→</span></button>
          <button type="button" className="portal-card" onClick={() => onNavigate('GTi courses')}><span className="portal-card-icon"><GraduationCapIcon /></span><span className="portal-card-kicker">LEARNING</span><strong>GTi Courses</strong><span>Browse and manage your GTi courses.</span><span className="portal-card-arrow">→</span></button>
          <button type="button" className="portal-card" onClick={accreditationCard.onClick}><span className="portal-card-icon"><BuildingIcon /></span><span className="portal-card-kicker">ACCREDITATION</span><strong>{accreditationCard.heading}</strong><span>{accreditationCard.body}</span><span className="portal-card-arrow">→</span></button>
          <button type="button" className="portal-card" onClick={() => onNavigate('Insurance')}><span className="portal-card-icon"><ShieldIcon /></span><span className="portal-card-kicker">INSURANCE</span><strong>Get an insurance quote</strong><span>Build or continue your Beauty Guild insurance quotation.</span><span className="portal-card-arrow">→</span></button>
        </div>
        <AccountDetailsCard contact={contact} membership={membership} />
        <MemberAnnouncement announcement={ANNOUNCEMENT} onNavigate={onNavigate} />
      </div>
    </>
  );
}

function PortalPlaceholder({ title }) {
  return <div className="acc-body" style={{ flexDirection: 'column', alignItems: 'stretch' }}><div className="portal-placeholder"><div className="portal-eyebrow">BEAUTY GUILD PORTAL</div><h1>{title}</h1><p>This area is being prepared for the next portal phase.</p></div></div>;
}

// All of the applicant's documents (their membership's WorkDrive folder) - deliberately
// not scoped to any one accreditation, unlike the Documents tab inside Manage School.
function PortalDocuments({ contactId }) {
  const fetchPage = (folderId) => fetchContactDocuments(contactId, folderId);
  return (
    <div className="acc-body portal-section-page">
      <div className="portal-section-heading"><span className="portal-eyebrow">DOCUMENTS</span><h1>Your documents</h1></div>
      <DocumentGrid fetchPage={fetchPage} deps={[contactId]} />
    </div>
  );
}

// Every invoice for this account (accreditation, additional venue, membership, ...) in one
// list - deliberately not scoped to any one accreditation or membership, unlike the Invoices
// tab inside Manage School or a membership's own detail page.
function PortalInvoices({ contactId }) {
  const [invoices, setInvoices] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (!contactId) return undefined;
    fetchAccountInvoices(contactId)
      .then((result) => { if (!cancelled) setInvoices(result); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Invoices could not be loaded.'); });
    return () => { cancelled = true; };
  }, [contactId]);
  return (
    <div className="acc-body portal-section-page">
      <div className="portal-section-heading"><span className="portal-eyebrow">INVOICES</span><h1>Your invoices</h1></div>
      {error && <div className="acc-warning"><div className="acc-warning-title">We couldn't load your invoices</div><div className="acc-warning-body">{error}</div></div>}
      {invoices === null && !error ? (
        <div className="portal-loading"><span className="acc-spinner" /> Loading your invoices…</div>
      ) : invoices && !invoices.length ? (
        <div className="school-empty"><strong>No invoices yet</strong><span>Invoices will appear here once raised.</span></div>
      ) : invoices && invoices.length > 0 ? (
        <TableShell><table className="acc-legacy-table">
          <thead><tr><th>Invoice</th><th>Type</th><th>Date</th><th>Due</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td><strong>#{inv.invoiceNumber}</strong></td>
                <td>{inv.type || '–'}</td>
                <td>{inv.invoiceDate || '–'}</td>
                <td>{inv.dueDate || '–'}</td>
                <td>{inv.amount != null ? `£${inv.amount.toFixed(2)}` : '–'}</td>
                <td><InvoiceStatusBadge status={inv.status} /></td>
              </tr>
            ))}
          </tbody>
        </table></TableShell>
      ) : null}
    </div>
  );
}

// Every Deal CRM has for this contact, not just the currently-active one - shown so a paid
// quote stuck at "Awaiting Payment" (the Creator webhook that should move it to Active is
// still being finished) is at least visible, rather than silently disappearing.
function MembershipHistorySection({ contactId, onSelectMembership }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (!contactId) return undefined;
    fetchMembershipHistory(contactId)
      .then((memberships) => { if (!cancelled) setHistory(memberships); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Membership history could not be loaded.'); });
    return () => { cancelled = true; };
  }, [contactId]);
  if (error) return <div className="acc-warning"><div className="acc-warning-title">We couldn't load your membership history</div><div className="acc-warning-body">{error}</div></div>;
  if (!history) return <div className="portal-loading"><span className="acc-spinner" /> Checking your membership history…</div>;
  if (!history.length) return null;
  return (
    <div className="portal-section-heading mq-history-section" style={{ marginTop: 32 }}>
      <h2 style={{ marginBottom: 12 }}>Membership history</h2>
      <TableShell><table className="acc-legacy-table">
        <thead><tr><th>Membership</th><th>From</th><th>To</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
          {history.map((entry) => (
            <tr key={entry.dealId} className="acc-row-clickable" onClick={() => onSelectMembership(entry)}>
              <td><strong>{entry.membershipType || 'Guild membership'}</strong>{entry.subscriptionType && <span className="membership-history-meta"> · {entry.subscriptionType}</span>}</td>
              <td>{entry.startDate ? formatUkDate(entry.startDate) : '–'}</td>
              <td>{entry.expiryDate ? formatUkDate(entry.expiryDate) : '–'}</td>
              <td>{entry.amount != null ? `£${Number(entry.amount).toFixed(2)}` : '–'}</td>
              <td><span className={`acc-status-badge${entry.stage === 'Active' ? '' : ' warning'}`}>{entry.stage || 'Unknown'}</span></td>
            </tr>
          ))}
        </tbody>
      </table></TableShell>
    </div>
  );
}

function MembershipPage({ membership, membershipError, onRetry, onAccreditation, contactId, onSelectMembership }) {
  // Bumped on every refresh so MembershipHistorySection (which fetches its own history on
  // mount) remounts and refetches too - onRetry alone only re-checks the current membership
  // decision, not the full history table below it.
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await onRetry(); } finally {
      setHistoryRefreshKey((key) => key + 1);
      setRefreshing(false);
    }
  };
  const refreshButton = (
    <button type="button" className="acc-btn-secondary portal-refresh-btn" onClick={handleRefresh} disabled={refreshing}>
      {refreshing ? 'Refreshing…' : 'Refresh'}
    </button>
  );
  if (!membership) return <>
    <div className="acc-body portal-section-page">
      <div className="portal-section-heading"><span className="portal-eyebrow">YOUR MEMBERSHIP</span><h1>Membership details</h1></div>
      {membershipError
        ? <div className="acc-warning"><div className="acc-warning-title">We couldn't load your membership</div><div className="acc-warning-body">{membershipError}</div><button type="button" className="acc-btn-secondary" onClick={onRetry}>Try again</button></div>
        : <div className="portal-loading"><span className="acc-spinner" /> Checking your membership…</div>}
    </div>
  </>;
  const active = membership?.membershipStatus === 'active';
  // Matches the CRM reminder workflow's own criteria (Membership.Status = Active AND
  // Expiry Date within the next 30 days) - the portal surfaces the same "renew soon" window
  // that the reminder email is built around, rather than a separately-invented threshold.
  const daysUntilExpiry = (() => {
    if (!membership?.membershipExpiry) return null;
    const expiry = new Date(`${membership.membershipExpiry}T00:00:00`);
    if (Number.isNaN(expiry.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((expiry - today) / 86400000);
  })();
  const renewalDue = active && daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  return <>
    <div className="acc-body portal-section-page">
      <div className="portal-section-heading portal-section-heading-row"><div><span className="portal-eyebrow">YOUR MEMBERSHIP</span><h1>Membership details</h1></div>{refreshButton}</div>
      <section
        className="membership-page-panel"
        data-membership-active={active ? 'true' : 'false'}
        data-membership-expiry={membership.membershipExpiry || ''}
        data-membership-renewal-due={renewalDue ? 'true' : 'false'}
        data-membership-deal-id={membership.dealId || ''}
        data-membership-level-id={membership.membershipLevelId || ''}
        data-membership-branch-id={membership.primaryBranchId || ''}
        data-membership-subscription-type={membership.subscriptionType || ''}
      >
        <div style={!active ? { gridColumn: '1 / -1' } : undefined}>
          <span className={`acc-status-badge${active ? '' : ' warning'}`}>{active ? 'Current' : 'No current membership'}</span>
          {renewalDue && <span className="acc-status-badge warning" style={{ marginLeft: 8 }}>Renews soon</span>}
          <h2>{active ? `${membership.membershipType || 'Guild'} membership` : 'No membership yet'}</h2>
          <p>{active
            ? `Your membership is current${membership.membershipExpiry ? ` until ${formatUkDate(membership.membershipExpiry)}` : ''}.${renewalDue ? ' Renew now to keep your cover without a break.' : ''}`
            : "You don't currently have a Guild membership. An Associate Membership will be included automatically if you start a new accreditation."}</p>
        </div>
        {active && (
          <dl className="membership-detail-list">
            <div><dt>Membership type</dt><dd>{membership.membershipType || 'Guild membership'}</dd></div>
            <div><dt>Status</dt><dd>Current</dd></div>
            <div><dt>Expiry date</dt><dd>{formatUkDate(membership.membershipExpiry) || 'Not recorded'}</dd></div>
          </dl>
        )}
      </section>
      <button type="button" className="acc-btn-primary membership-page-action" onClick={onAccreditation}>View accreditation options →</button>
      <MembershipHistorySection key={historyRefreshKey} contactId={contactId} onSelectMembership={onSelectMembership} />
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
  const [selectedMembership, setSelectedMembership] = useState(null);
  const [manageInitialOption, setManageInitialOption] = useState(null);
  // Bumped on every selectSchool() call and used as ManageSchool's React key below, so each
  // explicit "jump to this section" (e.g. a sidebar sub-nav click) remounts it fresh rather
  // than relying on the initialOption prop alone - ManageSchool doesn't otherwise unmount
  // between two such jumps (the screen stays 'manage' both times), so its own activeOption
  // state would silently ignore a changed - or re-picked - initialOption prop.
  const [manageNavToken, setManageNavToken] = useState(0);
  const [drafts, setDrafts] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [discardTarget, setDiscardTarget] = useState(null);
  const [discardingDraft, setDiscardingDraft] = useState(false);
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
  // Guards the portal dashboard's Accreditation card against briefly flashing "Apply for
  // Guild Accreditation" before the real accreditation status has loaded on a page refresh.
  const [accreditationsLoaded, setAccreditationsLoaded] = useState(false);
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  // Set right after a fresh submission. Zoho CRM's search index can lag ~20-30s behind a
  // write, so the very next fetch (fired the instant "Go to your dashboard" is clicked) can
  // still come back without the new record. goEntry() polls until this name shows up, rather
  // than firing a single fetch that loses the race and looks like "not refreshing" to the user.
  const justSubmittedSchoolNameRef = useRef(null);
  const handledCatalystUserRef = useRef(null);
  // On a page refresh, two independent identity checks race: the instant localStorage
  // session restore, and the Catalyst SDK's own (slower) auth confirmation. Both used to
  // force screen='portal' unconditionally on success, so whichever finished LAST would
  // stomp on any navigation the user did in between - even 3-4 seconds later. This ref lets
  // only the first of the two to actually resolve claim the initial navigation; the second
  // is then just a redundant confirmation of the same login and must not touch the screen.
  // Reset on logout so a later, genuine fresh sign-in can navigate again.
  const initialPortalNavDoneRef = useRef(false);
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
  const [savingDraft, setSavingDraft] = useState(false);
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

  // Only the first of the two racing identity checks (see initialPortalNavDoneRef above)
  // should navigate to the portal - returns false for every call after the first.
  const claimInitialPortalNav = () => {
    if (initialPortalNavDoneRef.current) return false;
    initialPortalNavDoneRef.current = true;
    return true;
  };

  // Re-scope local drafts to whoever is actually logged in - runs on login, on a different
  // account logging in over the same one (id changes), and on logout (id goes null, so
  // loadDrafts returns []). Without this, a draft saved by one account in this browser would
  // otherwise keep showing up after a different account signs in on the same machine.
  const loggedInContactId = loggedInContact && loggedInContact.id;
  useEffect(() => {
    setDrafts(loadDrafts(loggedInContactId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInContactId]);

  const applyDashboardData = ({ accredited, drafts: crmDrafts, pending, awaitingPayment }) => {
    setAccreditedSchools((accredited || []).map(toSchoolCard));
    setDrafts((prevDrafts) => mergeCrmDrafts(prevDrafts, crmDrafts));
    setPendingApplications((pending || []).map(toPendingItem));
    setAwaitingPaymentApplications((awaitingPayment || []).map(toPendingItem));
    setAccreditationsLoaded(true);
  };

  useEffect(() => {
    let cancelled = false;
    fetchActiveCourses()
      .then((data) => { if (!cancelled) setCourses(data); })
      .catch((err) => { if (!cancelled) setCoursesError(err.message); });
    return () => { cancelled = true; };
  }, []);


  // Captures ?ref=<code> from a tutor invite link once the invitee lands back here after
  // the Catalyst sign-up/activation round trip, so it's available later in this session.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) saveReferralCode(ref);
  }, []);

  // A real navigation away from the app (Stripe Checkout is the one place this happens -
  // window.location.assign to checkout.stripe.com) followed by the browser's own Back
  // button, rather than Stripe's own return redirect, can restore this exact tab from the
  // back/forward cache instead of reloading it. That resurrects the in-memory wizard state
  // exactly as it was before leaving - still pointed at the same activeDraftId/accreditation -
  // so a user who believed they were starting a second, unrelated application would actually
  // still be editing the first one. `pageshow` with `event.persisted` is the standard way to
  // detect a bfcache restore; reloading guarantees a genuinely fresh state instead.
  useEffect(() => {
    const handlePageShow = (event) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
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
    if (!stored || !stored.email) return undefined;
    let cancelled = false;
    setCheckingIdentity(true);
    lookupContactByEmail(stored.email)
      .then(({ exists, contact }) => {
        if (cancelled) return;
        if (!exists || !contact) {
          console.log('cached session contact no longer exists in CRM, clearing stale session');
          clearSession();
          setCheckingIdentity(false);
          return;
        }
        setLoggedInContact(contact);
        saveSession(contact);
        setIsLoggedIn(true);
        if (claimInitialPortalNav()) setScreen('portal');
        setCheckingIdentity(false);
        setMembershipError('');
        resolveMembership(contact.id).then((decision) => { if (!cancelled) setMembershipDecision(decision); }).catch((err) => { if (!cancelled) setMembershipError(err.message || 'Membership details could not be loaded.'); });
        fetchAccreditations(contact.id)
          .then((data) => { if (!cancelled) applyDashboardData(data); })
          .catch((err) => {
            console.log('accreditations lookup failed', err);
            if (!cancelled) { setAccreditationsError(err.message); setAccreditationsLoaded(true); }
          });
      })
      .catch((err) => {
        if (cancelled) return;
        console.log('cached session verification failed, clearing stale session', err);
        clearSession();
        setCheckingIdentity(false);
      });
    // This only ever runs once per real mount - the cancellation guard exists purely so
    // React StrictMode's dev-only double-invoke of this effect can't let its first, stale
    // copy resolve later and stomp the screen back to "portal" over whatever the user has
    // already navigated to in the meantime.
    return () => { cancelled = true; };
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
    tutors: v === 'no' ? [] : prev.tutors,
  }));

  // Keeps acc.tutors in sync with the entered headcount - growing/shrinking the list rather
  // than resetting it, so rows already filled in aren't lost if the count is nudged by one.
  const setTutorCount = (value) => setAcc((prev) => {
    const n = Number(value);
    let tutors = prev.tutors;
    if (Number.isInteger(n) && n >= 0) {
      tutors = prev.tutors.slice(0, n);
      while (tutors.length < n) tutors = [...tutors, { fname: '', surname: '', email: '' }];
    }
    return { ...prev, otN: value, tutors };
  });

  const setTutorField = (index, key, value) => setAcc((prev) => {
    const tutors = prev.tutors.map((t, i) => (i === index ? { ...t, [key]: value } : t));
    return { ...prev, tutors };
  });

  const saveQuote = async () => {
    // Without this, clicking "Save & finish later" twice in quick succession (or a slow
    // network stretching out the first request) could fire two saves while activeDraftId was
    // still null, each independently creating its own Account/Training Centre/draft - two
    // duplicate applications from one save action, reported directly in UAT.
    if (savingDraft) return;
    if (!loggedInContact?.id) {
      setModal({ title: 'Please log in first', body: 'You must be logged in before an application can be saved.' });
      return;
    }
    setSavingDraft(true);
    try {
      const draft = await saveAccreditationDraft({
        contactId: loggedInContact.id,
        accreditationId: activeDraftId,
        ...activeDraftRefs,
        stepIndex,
        // Your Details/Address (steps 2 & 4) belong to the Contact, not the draft - without
        // sending them here they're never persisted anywhere, so resuming a draft (or even
        // reaching final submit) would show them blank again even though the same session
        // had them filled in.
        phone: withDialCode(acc.phoneCode, acc.phone),
        mobile: withDialCode(acc.mobileCode, acc.mobile),
        address: {
          addressLine1: acc.addr.l1,
          addressLine2: acc.addr.l2,
          addressLine3: acc.addr.l3,
          town: acc.addr.town,
          county: acc.addr.county,
          country: acc.addr.country,
          postcode: acc.addr.pc,
        },
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
        tutors: acc.ot === 'yes' ? acc.tutors : [],
        otherVenues: acc.ov === 'yes', courseIds: acc.courses, termsAccepted: acc.tob,
        ...(() => { const p = accreditationPricing(acc, false); return { accreditationFee: p.fee, vatAmount: p.vat, totalQuoted: p.baseTotal }; })(),
      });
      setActiveDraftId(draft.id);
      setActiveDraftRefs({ accountId: draft.accountId, centreId: draft.centreId, linkId: draft.linkId });
      // `local: true` marks this as a draft this browser itself just saved, with its own
      // full acc/refs already known - loadExistingApplication uses that to skip CRM entirely
      // on resume, rather than re-fetching from /search endpoints that can lag a real write
      // by up to ~20-30s and make a just-saved draft look like it lost its answers.
      setDrafts(upsertDraft({ id: draft.id, crmId: draft.id, local: true, stepIndex, skippedAccount, acc, accountId: draft.accountId, centreId: draft.centreId, linkId: draft.linkId, contactId: loggedInContact && loggedInContact.id, updatedAt: new Date().toISOString() }));
      setModal({ title: 'Application saved', body: 'Your application has been saved as a draft. You can continue it from your dashboard.', saved: true });
    } catch (err) {
      setModal({ title: "Couldn't save application", body: err.message || 'Something went wrong. Please try again.' });
    } finally {
      setSavingDraft(false);
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

  // Personal details (name, phone/mobile, home address) all live on the Contact, not on
  // the draft/accreditation record - so both a brand-new application and a resumed draft
  // need to pull them from the same place. Mutates target in place.
  const applyContactBasics = (target, contact) => {
    if (!contact) return;
    target.email = contact.email || target.email;
    if (contact.title) target.title = contact.title;
    if (contact.firstName) target.fname = contact.firstName;
    if (contact.lastName) target.surname = contact.lastName;
    if (contact.phone) { const p = parseDialCode(contact.phone); target.phone = p.number; target.phoneCode = p.code; }
    if (contact.mobile) { const m = parseDialCode(contact.mobile); target.mobile = m.number; target.mobileCode = m.code; }
    target.interests = mergeInterestsWithTraining(contact.interests);
    // Everything on the Address step comes from Correspondence_* on the Contact.
    if (contact.addressLine1 || contact.town) {
      target.addrLooked = true;
      if (contact.addressLine1) target.addr.l1 = contact.addressLine1;
      if (contact.addressLine2) target.addr.l2 = contact.addressLine2;
      if (contact.postcode) target.addr.pc = contact.postcode;
      if (contact.town) target.addr.town = contact.town;
      if (contact.county) target.addr.county = contact.county;
      if (contact.country) target.addr.country = contact.country;
    }
  };

  // Jumps straight into "Your details" (step 1), skipping the Account step - used both for the
  // dashboard's "Apply for new accreditation" button and for the WordPress "Apply Accreditation"
  // link once identity is known, so a returning member never re-answers the login step.
  const enterWizardWithContact = (contact) => {
    const fresh = initialAccState();
    setMembershipDecision(null);
    setMembershipError('');
    applyContactBasics(fresh, contact);
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
    initialPortalNavDoneRef.current = false;
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
    setManageNavToken((value) => value + 1);
    setScreen('manage');
  };
  const selectMembership = (membership) => {
    setSelectedMembership(membership);
    setScreen('manage-membership');
  };

  const loadExistingApplication = (application, targetStep = null, errorTitle = "Couldn't open application") => {
    // A draft this browser itself saved already has its own full, correct state cached in
    // localStorage - use that directly rather than re-fetching from CRM. CRM's /search
    // endpoints (the only way to find the linked Training Centre/course offerings/link, since
    // none of them can be fetched by a single known id) can lag a real write by up to ~20-30s,
    // which made a draft resumed shortly after being saved look like it had lost its answers,
    // even though nothing was actually lost.
    if (application.local && application.acc) {
      // Shallow-spread alone would leave next.addr pointing at the same nested object still
      // referenced by the cached draft - applyContactBasics writes into next.addr.*, which
      // would otherwise silently mutate that cached copy too.
      const next = { ...application.acc, addr: { ...application.acc.addr }, sch: { ...application.acc.sch } };
      // Defense-in-depth: a draft cached before this placeholder-stripping was added (or one
      // resumed from an older client build) could have the raw CRM placeholder baked into its
      // cached school name - never show that internal value back to the applicant.
      if (/^Draft application - /.test(next.sch.name || '')) next.sch.name = '';
      applyContactBasics(next, loggedInContact);
      setAcc(next);
      setActiveDraftId(application.crmId || application.id);
      setActiveDraftRefs({ accountId: application.accountId || null, centreId: application.centreId || null, linkId: application.linkId || null });
      setSkippedAccount(true);
      setStepIndex(targetStep == null ? (application.stepIndex || 1) : targetStep);
      setScreen('wizard');
      return;
    }
    const load = async () => {
      try {
        const detail = await fetchAccreditationDraft(application.crmId || application.id, loggedInContact.id);
        const record = detail.accreditation || {};
        const centre = detail.centre || {};
        const yesNo = (value) => value === 'Yes' ? 'yes' : value === 'No' ? 'no' : undefined;
        const next = initialAccState();
        next.mode = 'login';
        applyContactBasics(next, loggedInContact);
        next.decls = [record.Declaration_1_qualified_for_six_months, record.Declaration_2_teaching_qualification, record.Declaration_3_evidence_available].map(yesNo);
        next.courses = detail.courseIds || [];
        // Before a school name is ever typed, the backend has to write *something* into the
        // CRM Training Centre's (mandatory) Name field - "Draft application - <contactId>" -
        // so a School Name box left blank must never show that internal placeholder back to
        // the applicant.
        const rawSchoolName = centre.Name || '';
        const schoolName = /^Draft application - /.test(rawSchoolName) ? '' : rawSchoolName;
        next.schLooked = !!schoolName;
        next.sch = { ...next.sch, name: schoolName, contact: [next.title, next.fname, next.surname].filter(Boolean).join(' '), email: centre.Email || next.email, phone: centre.Phone_Number || '', mobile: centre.Mobile_Phone_Number || '', l1: centre.Address_Line_1 || '', l2: centre.Address_Line_2 || '', l3: centre.Address_Line_3 || '', town: centre.Town || '', county: centre.County || '', country: centre.Country || 'United Kingdom', pc: centre.Postcode || '' };
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

  const requestDiscardDraft = (id) => {
    const draft = drafts.find((d) => d.id === id);
    setDiscardTarget({ id, name: (draft && draft.acc.sch.name) || 'this application' });
  };

  const confirmDiscardDraft = async () => {
    if (!discardTarget || discardingDraft) return;
    setDiscardingDraft(true);
    try {
      await discardAccreditationDraft(discardTarget.id, loggedInContact.id);
      setDrafts(deleteDraft(discardTarget.id, loggedInContact.id));
      if (activeDraftId === discardTarget.id) setActiveDraftId(null);
      setDiscardTarget(null);
    } catch (err) {
      // A 404 here means CRM's own record is already gone - most likely a draft carried
      // over locally from before a CRM data reset elsewhere. There's nothing left to
      // discard, so just clear it from view instead of blocking the user with an error
      // about a record that, from their point of view, should already be gone.
      if (err.status === 404) {
        setDrafts(deleteDraft(discardTarget.id, loggedInContact.id));
        if (activeDraftId === discardTarget.id) setActiveDraftId(null);
        setDiscardTarget(null);
      } else {
        setModal({ title: "Couldn't discard application", body: err.message || 'Something went wrong. Please try again.' });
        setDiscardTarget(null);
      }
    } finally {
      setDiscardingDraft(false);
    }
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
          setAccreditationsLoaded(true);
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
          if (claimInitialPortalNav()) setScreen('portal');
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
    if (claimInitialPortalNav()) setScreen('portal');
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
    // Already backstopped by the button's own disabled={submitting} in SummaryStep, but an
    // explicit guard here too matches the same defence just added to saveQuote, rather than
    // relying on the disabled attribute alone to win the race against a second click.
    if (submittingAccred) return;
    setSubmittingAccred(true);
    let accreditation;
    try {
      accreditation = await submitAccreditation({
        contactId: loggedInContact && loggedInContact.id,
        accreditationId: activeDraftId,
        accountId: activeDraftRefs.accountId,
        centreId: activeDraftRefs.centreId,
        linkId: activeDraftRefs.linkId,
        phone: withDialCode(acc.phoneCode, acc.phone),
        mobile: withDialCode(acc.mobileCode, acc.mobile),
        address: {
          addressLine1: acc.addr.l1,
          addressLine2: acc.addr.l2,
          addressLine3: acc.addr.l3,
          town: acc.addr.town,
          county: acc.addr.county,
          country: acc.addr.country,
          postcode: acc.addr.pc,
        },
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
        tutors: acc.ot === 'yes' ? acc.tutors : [],
        otherVenues: acc.ov === 'yes',
        courseIds: acc.courses,
        termsAccepted: acc.tob,
        ...(() => {
          const p = accreditationPricing(acc, !!membershipDecision?.membershipRequired);
          return { accreditationFee: p.fee, vatAmount: p.vat, totalQuoted: p.total };
        })(),
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
        setDrafts(deleteDraft(activeDraftId, loggedInContact && loggedInContact.id));
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
    if (isLoggedIn && screen === 'portal') return (
      <PortalDashboard
        contact={loggedInContact} membership={membershipDecision} accreditationsLoaded={accreditationsLoaded}
        drafts={drafts} pendingApplications={pendingApplications} awaitingPaymentApplications={awaitingPaymentApplications} accreditedSchools={accreditedSchools}
        onAccreditation={goEntry} onResumeDraft={resumeDraft} onOpenAwaitingPayment={openAwaitingPayment}
        onSelectQualifications={(item) => selectSchool(item, 'qualifications')} onStartNew={startApplyExisting}
        onNavigate={setScreen}
      />
    );
    if (isLoggedIn && screen === 'Membership') return <MembershipPage membership={membershipDecision} membershipError={membershipError} onRetry={retryMembershipCheck} onAccreditation={goEntry} contactId={loggedInContact?.id} onSelectMembership={selectMembership} />;
    if (isLoggedIn && screen === 'Documents') return <PortalDocuments contactId={loggedInContact?.id} />;
    if (isLoggedIn && screen === 'Invoices') return <PortalInvoices contactId={loggedInContact?.id} />;
    if (isLoggedIn && screen === 'Insurance') return <InsuranceApp contact={loggedInContact} />;
    if (isLoggedIn && ['GTi courses', 'My profile'].includes(screen)) return <PortalPlaceholder title={screen} />;
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
                  <div className="acc-step-heading">
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
            onDiscardDraft={requestDiscardDraft}
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
      return <ManageSchool key={manageNavToken} school={selectedSchool} initialOption={manageInitialOption} contactId={loggedInContact?.id} contact={loggedInContact} onBack={goEntry} />;
    }

    if (screen === 'manage-membership') {
      return <ManageMembership key={selectedMembership && selectedMembership.dealId} membership={selectedMembership} contactId={loggedInContact?.id} contactEmail={loggedInContact?.email} contactName={`${loggedInContact?.firstName || ''} ${loggedInContact?.lastName || ''}`.trim()} onBack={() => setScreen('Membership')} />;
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
      <TutorsVenuesStep acc={acc} setAccField={setAccField} onOtChange={onOtChange} setTutorCount={setTutorCount} setTutorField={setTutorField} />,
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
              {stepIndex >= 5 && <button type="button" className="acc-btn-secondary" disabled={savingDraft} onClick={saveQuote}>{savingDraft ? 'Saving…' : 'Save & finish later'}</button>}
              <button type="button" className="acc-btn-primary" disabled={!nextEnabled} onClick={goNext}>{nextLabel}</button>
            </div>
          </div>
        )}
        {isLastStep && (
          <div className="acc-footer">
            <button type="button" className="acc-back-btn" onClick={goBack}>← {backLabel}</button>
            <button type="button" className="acc-btn-secondary" disabled={savingDraft} onClick={saveQuote}>{savingDraft ? 'Saving…' : 'Save & finish later'}</button>
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
            onManageSection={selectSchool}
            accreditedSchools={accreditedSchools}
            activeItem={screen === 'portal'
              ? 'Dashboard'
              : ['entry', 'wizard', 'manage', 'done'].includes(screen)
                ? 'Accreditation'
                : screen === 'manage-membership'
                  ? 'Membership'
                  : screen}
          />
        )}
        <div className="acc-main">
          {renderMain()}
          {isLoggedIn && (
            <MobileTabBar
              activeItem={screen}
              onSection={(label) => setScreen(label)}
              onLogout={logout}
            />
          )}
        </div>
      </div>
      <Modal modal={modal} onClose={closeModal} />
      <DiscardDraftConfirm target={discardTarget} discarding={discardingDraft} onCancel={() => setDiscardTarget(null)} onConfirm={confirmDiscardDraft} />
    </div>
  );
}
