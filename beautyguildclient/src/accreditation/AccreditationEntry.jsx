import React from 'react';
import { STEP_LABELS, formatUkDate } from './data';
import { draftLabel, formatSavedAt } from './drafts';

function SavedApplicationsSection({ drafts, onResume, onDiscard }) {
  if (drafts.length === 0) return null;
  return (
    <section className="accreditation-section">
      <div className="accreditation-section-heading"><div><h2>Draft applications</h2><p>Applications you chose to finish later.</p></div><span>{drafts.length}</span></div>
      <div className="application-card-list">{drafts.map((d) => <article className="application-card" key={d.id}><div className="application-card-main"><span className="application-status draft">Draft</span><h3>{draftLabel(d.acc)}</h3><p>Last saved {formatSavedAt(d.updatedAt)} · {STEP_LABELS[d.stepIndex] || 'Application details'}</p></div><div className="application-card-actions"><button type="button" className="acc-btn-primary" onClick={() => onResume(d)}>Continue</button><button type="button" className="text-action discard" onClick={() => onDiscard(d.id)}>Discard</button></div></article>)}</div>
    </section>
  );
}

function PendingApplicationsSection({ items, onAddQualifications }) {
  if (items.length === 0) return null;
  return (
    <section className="accreditation-section">
      <div className="accreditation-section-heading"><div><h2>Applications in progress</h2><p>Applications being prepared or reviewed.</p></div><span>{items.length}</span></div>
      <div className="application-card-list">{items.map((a) => {
        const stageLabel = a.applicationStage === 'Needs Processing' ? 'Qualifications received' : a.applicationStage === 'Paid' ? 'Payment received' : (a.applicationStage || 'Being reviewed');
        return <article className="application-card" key={a.id || a.name}><div className="application-card-main"><span className="application-status pending">{stageLabel}</span><h3>{a.name}</h3><p>{a.courses} · {a.qualificationCount} qualification{a.qualificationCount === 1 ? '' : 's'} added</p></div><div className="application-card-actions">{a.qualificationsComplete ? <button type="button" className="acc-btn-secondary" onClick={() => onAddQualifications(a)}>Add another qualification</button> : <button type="button" className="acc-btn-secondary" onClick={() => onAddQualifications(a)}>Add qualifications</button>}</div></article>;
      })}</div>
      {!items.every((item) => item.qualificationsComplete) && <div className="acc-info-note accreditation-note">Your application is incomplete until your qualifications have been added.</div>}
    </section>
  );
}

function AccreditationSummary({ drafts, awaiting, pending, accredited }) {
  const stats = [['Accredited centres', accredited.length], ['Drafts', drafts.length], ['Awaiting payment', awaiting.length], ['In progress', pending.length]];
  return <section className="accreditation-overview"><div className="accreditation-overview-heading"><h2>Overview</h2><span>Your accreditation at a glance</span></div><div className="accreditation-summary" aria-label="Accreditation summary">{stats.map(([label, value], index) => <div className={`accreditation-summary-item tone-${index + 1}`} key={label}><span className="summary-mark" aria-hidden="true" /><div><strong>{value}</strong><span>{label}</span></div></div>)}</div></section>;
}

function AwaitingPaymentSection({ items, onOpen, onPay, payingApplicationId }) {
  if (items.length === 0) return null;
  return (
    <section className="accreditation-section">
      <div className="accreditation-section-heading"><div><h2>Payment required</h2><p>Review an application before completing payment.</p></div><span>{items.length}</span></div>
      <div className="application-card-list">{items.map((a) => {
        const paying = payingApplicationId === a.id;
        return <article className="application-card application-card-payment" key={a.id} onClick={() => !paying && onOpen(a)} role="button" tabIndex={0} onKeyDown={(event) => { if (!paying && (event.key === 'Enter' || event.key === ' ')) onOpen(a); }}><div className="application-card-main"><span className="application-status payment">Awaiting payment</span><h3>{a.name}</h3><p>{a.courses} · Your application is ready for payment</p></div><div className="application-card-actions"><button type="button" className="acc-btn-primary" disabled={paying} onClick={(event) => { event.stopPropagation(); onPay(a); }}>{paying ? 'Opening checkout…' : 'Pay now'}</button><button type="button" className="text-action" disabled={paying} onClick={(event) => { event.stopPropagation(); onOpen(a); }}>View summary</button></div></article>;
      })}</div>
    </section>
  );
}

function SchoolCard({ s, onClick }) {
  const badgeClass = s.status === 'Accredited' ? '' : ' warning';
  const expired = Number.isFinite(Number(s.daysLeft)) && Number(s.daysLeft) < 0;
  return (
    <div className="centre-list-row" onClick={onClick} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } }}>
      <span className="centre-list-avatar" aria-hidden="true">{(s.name || 'T').charAt(0)}</span>
      <div className="centre-list-main"><div><strong>{s.name}</strong><span className={`acc-status-badge${badgeClass}`}>{s.status}</span></div><p>{[s.town, s.level, s.expires ? `Valid until ${s.expires}` : ''].filter(Boolean).join(' · ')}</p></div>
      <div className="centre-list-metrics"><span><strong>{s.courses ?? '–'}</strong> courses</span><span><strong>{s.tutors ?? '–'}</strong> tutors</span><span className={expired ? 'expired' : ''}><strong>{expired ? 'Expired' : (s.daysLeft ?? '–')}</strong> {expired ? 'renewal required' : 'days left'}</span></div>
      <button type="button" className="acc-btn-secondary centre-view-button" onClick={(event) => { event.stopPropagation(); onClick(); }}>View centre <span aria-hidden="true">→</span></button>
    </div>
  );
}

function AccreditedSchoolsSection({ schools, onSelectSchool }) {
  return (
    <section className="accreditation-section">
      <div className="accreditation-section-heading"><div><h2>Accredited training centres</h2><p>Manage each centre and its accreditation records.</p></div><span>{schools.length}</span></div>
      {schools.length === 0 ? (
        <div className="accreditation-empty"><strong>No accredited training centres yet</strong><span>Start an application to begin your accreditation journey.</span></div>
      ) : (
        <>
          <div className="acc-schools-list">
            {schools.map((s) => <SchoolCard s={s} key={s.id || s.name} onClick={() => onSelectSchool(s)} />)}
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
      <div className="accreditation-section-heading"><div><h2>Current membership</h2></div></div>
      <div className="accreditation-membership-panel">
        {active ? (
          <div className="acc-membership-status">
            <span className="acc-status-badge">Current</span>
            <div><strong>{membership.membershipType || 'Guild membership'}</strong><br />
              <span className="membership-expiry">Valid until {formatUkDate(membership.membershipExpiry) || 'your recorded expiry date'}.</span></div>
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
  accreditedSchools, pendingApplications, awaitingPaymentApplications, onPayExistingApplication, payingApplicationId, membership, accreditationsError, refreshing, onStartNew,
}) {
  return (
    <div className="acc-body accreditation-home">
      <div className="accreditation-intro"><div><span className="portal-eyebrow">TRAINING CENTRE ACCREDITATION</span><h1>Manage your accreditations</h1><p>View your centres, continue applications and complete outstanding actions.</p></div></div>
      <AccreditationSummary drafts={drafts} awaiting={awaitingPaymentApplications || []} pending={pendingApplications} accredited={accreditedSchools} />
      {refreshing && <RefreshingNotice />}
      <div className={`accreditation-primary-row${membership ? '' : ' single'}`}>
        <AccreditedSchoolsSection schools={accreditedSchools} onSelectSchool={onSelectSchool} />
        <MembershipSection membership={membership} />
      </div>
      {accreditationsError && <AccreditationsErrorNotice message={accreditationsError} />}
      <div className="accreditation-action-columns">
        <AwaitingPaymentSection items={awaitingPaymentApplications || []} onOpen={onOpenAwaitingPayment} onPay={onPayExistingApplication} payingApplicationId={payingApplicationId} />
        <PendingApplicationsSection items={pendingApplications} onAddQualifications={(item) => onSelectSchool(item, 'qualifications')} />
      </div>
      <SavedApplicationsSection drafts={drafts} onResume={onResumeDraft} onDiscard={onDiscardDraft} />
    </div>
  );
}
