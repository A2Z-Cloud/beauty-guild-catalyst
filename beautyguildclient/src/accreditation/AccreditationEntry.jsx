import React from 'react';
import { STEP_LABELS } from './data';
import { draftLabel, formatSavedAt } from './drafts';

function SavedApplicationsSection({ drafts, onResume, onDiscard }) {
  if (drafts.length === 0) return null;
  return (
    <section className="accreditation-section">
      <div className="accreditation-section-heading"><h2>Continue an application</h2></div>
      <div className="application-card-list">{drafts.map((d) => <article className="application-card" key={d.id}><div className="application-card-main"><span className="application-status draft">Draft</span><h3>{draftLabel(d.acc)}</h3><p>Last saved {formatSavedAt(d.updatedAt)} · {STEP_LABELS[d.stepIndex] || 'Application details'}</p></div><div className="application-card-actions"><button type="button" className="acc-btn-primary" onClick={() => onResume(d)}>Continue</button><button type="button" className="text-action discard" onClick={() => onDiscard(d.id)}>Discard</button></div></article>)}</div>
    </section>
  );
}

function PendingApplicationsSection({ items, onAddQualifications }) {
  if (items.length === 0) return null;
  return (
    <section className="accreditation-section">
      <div className="accreditation-section-heading"><h2>Applications in progress</h2></div>
      <div className="application-card-list">{items.map((a) => <article className="application-card" key={a.id || a.name}><div className="application-card-main"><span className="application-status pending">{a.applicationStage || 'Pending review'}</span><h3>{a.name}</h3><p>{a.courses} · {a.qualificationCount} qualification{a.qualificationCount === 1 ? '' : 's'} added</p></div><div className="application-card-actions">{a.qualificationsComplete ? <span className="application-next-step">No action needed</span> : <button type="button" className="acc-btn-secondary" onClick={() => onAddQualifications(a)}>Add qualifications</button>}</div></article>)}</div>
      {!items.every((item) => item.qualificationsComplete) && <div className="acc-info-note accreditation-note">Your application is incomplete until your qualifications have been added.</div>}
    </section>
  );
}

function AccreditationSummary({ drafts, awaiting, pending, accredited }) {
  const stats = [['Active centres', accredited.length], ['Drafts', drafts.length], ['Awaiting payment', awaiting.length], ['In progress', pending.length]];
  return <div className="accreditation-summary" aria-label="Accreditation summary">{stats.map(([label, value]) => <div className="accreditation-summary-item" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>;
}

function AwaitingPaymentSection({ items, onOpen, onPay }) {
  if (items.length === 0) return null;
  return (
    <section className="accreditation-section">
      <div className="accreditation-section-heading"><h2>Payment required</h2></div>
      <div className="application-card-list">{items.map((a) => <article className="application-card application-card-payment" key={a.id} onClick={() => onOpen(a)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpen(a); }}><div className="application-card-main"><span className="application-status payment">Awaiting payment</span><h3>{a.name}</h3><p>{a.courses} · Your application is ready to submit</p></div><div className="application-card-actions"><button type="button" className="acc-btn-primary" onClick={(event) => { event.stopPropagation(); onPay(a); }}>Pay now</button><span className="text-action">View summary</span></div></article>)}</div>
    </section>
  );
}

function SchoolCard({ s, onClick }) {
  const badgeClass = s.status === 'Active' ? '' : ' warning';
  const expired = Number.isFinite(Number(s.daysLeft)) && Number(s.daysLeft) < 0;
  return (
    <div className="acc-card acc-card-clickable" onClick={onClick} role="button" tabIndex={0}>
      <div className="acc-entry-header">
        <div>
          <div className="acc-entry-name">{s.name}</div>
          <div className="acc-entry-meta">{s.town} · {s.level} · Expires {s.expires}</div>
        </div>
        <span className={`acc-status-badge${badgeClass}`}>{s.status}</span>
      </div>
      <div className="acc-stats-row">
        <div className="acc-stat">
          <div className="acc-stat-value">{s.courses}</div>
          <div className="acc-stat-label">courses</div>
        </div>
        <div className="acc-stat">
          <div className="acc-stat-value">{s.tutors}</div>
          <div className="acc-stat-label">tutor{s.tutors === 1 ? '' : 's'}</div>
        </div>
        <div className="acc-stat">
            <div className="acc-stat-value">{expired ? 'Expired' : s.daysLeft}</div>
            <div className="acc-stat-label">{expired ? 'renewal required' : 'days left'}</div>
        </div>
      </div>
    </div>
  );
}

function AccreditedSchoolsSection({ schools, onSelectSchool }) {
  return (
    <section className="accreditation-section">
      <div className="accreditation-section-heading"><h2>Accredited training centres</h2></div>
      {schools.length === 0 ? (
        <div className="accreditation-empty"><strong>No accredited training centres yet</strong><span>Start an application to begin your accreditation journey.</span></div>
      ) : (
        <>
          <div className="acc-schools-list">
            {schools.map((s) => <SchoolCard s={s} key={s.name} onClick={() => onSelectSchool(s)} />)}
          </div>
        </>
      )}
    </section>
  );
}

function AccreditationsErrorNotice({ message }) {
  return (
    <div className="acc-warning">
      <div className="acc-warning-title">Couldn't load your accreditations</div>
      <div className="acc-warning-body">{message}. Please refresh, or contact us if this keeps happening.</div>
    </div>
  );
}

function RefreshingNotice() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8A8598', marginBottom: 14 }}>
      <span className="acc-spinner" />
      Refreshing your accreditations…
    </div>
  );
}

function MembershipSection({ membership }) {
  if (!membership) return null;
  const active = membership.membershipStatus === 'active';
  return (
    <section className="accreditation-membership">
      <div className="accreditation-section-heading"><h2>Current membership</h2></div>
      <div className="accreditation-membership-panel">
        {active ? (
          <div className="acc-membership-status">
            <span className="acc-status-badge">Active</span>
            <div><strong>{membership.membershipType || 'Guild membership'}</strong><br />
              <span className="membership-expiry">Valid until {membership.membershipExpiry || 'your recorded expiry date'}.</span></div>
          </div>
        ) : (
          <div className="membership-expiry">No current membership was found. Associate Membership will be included where required during accreditation checkout.</div>
        )}
      </div>
    </section>
  );
}

export default function AccreditationEntry({
  onSelectSchool, drafts, onResumeDraft, onDiscardDraft, onOpenAwaitingPayment,
  accreditedSchools, pendingApplications, awaitingPaymentApplications, onPayExistingApplication, membership, accreditationsError, refreshing, onStartNew,
}) {
  return (
    <div className="acc-body" style={{ flexWrap: 'nowrap', flexDirection: 'column', alignItems: 'stretch', width: '100%' }}>
      <div className="accreditation-intro"><div><span className="portal-eyebrow">TRAINING CENTRE ACCREDITATION</span><h1>Manage your accreditations</h1></div></div>
      <AccreditationSummary drafts={drafts} awaiting={awaitingPaymentApplications || []} pending={pendingApplications} accredited={accreditedSchools} />
      {refreshing && <RefreshingNotice />}
      <MembershipSection membership={membership} />
      <AccreditedSchoolsSection schools={accreditedSchools} onSelectSchool={onSelectSchool} />
      <SavedApplicationsSection drafts={drafts} onResume={onResumeDraft} onDiscard={onDiscardDraft} />
      {accreditationsError && <AccreditationsErrorNotice message={accreditationsError} />}
      <div className="accreditation-action-columns">
        <AwaitingPaymentSection items={awaitingPaymentApplications || []} onOpen={onOpenAwaitingPayment} onPay={onPayExistingApplication} />
        <PendingApplicationsSection items={pendingApplications} onAddQualifications={(item) => onSelectSchool(item, 'qualifications')} />
      </div>
    </div>
  );
}
