import React, { useEffect, useState } from 'react';
import { formatLongDate } from './data';
import { BackArrowIcon } from './icons';
import { createQualification, fetchQualificationContext, fetchQualifications, fetchAccreditationVenues, fetchMissingGtiCourses, fetchAccreditationTutors, inviteOrLinkTutor, fetchAccreditationDocuments, fetchAccreditationInvoices, fetchCourseOfferings, fetchTutorOptions, fetchSessions, createSession, bookSession, fetchSessionBookings } from './api';
import AddVenueWizard from './AddVenueWizard';
import { DocumentGrid } from './documents';

const OPTIONS = [
  { key: 'profile', title: 'Profile' },
  { key: 'courses', title: 'Courses' },
  { key: 'venues', title: 'Venues' },
  { key: 'tutors', title: 'Tutors' },
  { key: 'sessions', title: 'Dates' },
  { key: 'qualifications', title: 'Qualifications' },
  { key: 'documents', title: 'Documents' },
  { key: 'invoices', title: 'Invoices' },
];

export function SectionHeading({ eyebrow, title, description, action }) {
  return <div className="school-section-heading"><div>{eyebrow && <span className="portal-eyebrow">{eyebrow}</span>}<h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}

export function TableShell({ children }) {
  return <div className="school-table-shell">{children}</div>;
}

export function ProfileField({ label, value, helper }) {
  return <div className="school-profile-field"><span>{label}</span><strong>{value || 'Not available yet'}</strong>{helper && <small>{helper}</small>}</div>;
}

function SchoolProfile({ school }) {
  return (
    <div className="school-profile-layout">
      <section className="school-profile-panel">
        <div className="school-profile-panel-heading"><div><span className="portal-eyebrow">BASIC INFORMATION</span><h2>School profile</h2><p>Your current accreditation details.</p></div><span className="profile-readonly">Read only</span></div>
        <div className="school-profile-fields">
          <ProfileField label="School / Training Centre Name" value={school.name} />
          <ProfileField label="Town / City" value={school.town} />
          <ProfileField label="Accreditation status" value={school.status} />
          <ProfileField label="Accreditation valid until" value={school.expires ? formatLongDate(school.expires) : ''} />
          <ProfileField label="Accredited courses" value={school.courses} />
          <ProfileField label="Tutors / lecturers" value={school.tutors} />
          <ProfileField label="Referral Code" value={school.referralCode} />
        </div>
      </section>
      <aside className="school-profile-panel school-profile-side-panel">
        <span className="portal-eyebrow">PUBLIC PRESENCE</span><h2>Directory profile</h2>
        <p>Open the public listing associated with this accredited training centre.</p>
        {school.referralCode ? <a className="school-profile-link" href={`https://beautyguild.com/Join/${school.referralCode}`} target="_blank" rel="noreferrer">View student landing page →</a> : <span className="profile-muted">Student landing page not available</span>}
        <div className="school-profile-note">Need to update your school details? Contact the accreditation team while profile editing is being prepared.</div>
      </aside>
    </div>
  );
}

function TrainingCentreContext({ school }) {
  return (
    <div className="school-context-bar">
      <div><span className="portal-eyebrow">TRAINING CENTRE</span><h1>{school.name}</h1><p>{[school.town, school.level].filter(Boolean).join(' · ') || 'Guild accredited training centre'}</p></div>
      <div className="school-context-status"><span className="acc-status-badge">{school.status || 'Accredited'}</span>{school.expires && <span>Valid until {formatLongDate(school.expires)}</span>}</div>
    </div>
  );
}

function CoursesDetail({ school, contactId }) {
  const courses = school.courseList || [];
  const [missing, setMissing] = useState(null);
  const [missingError, setMissingError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchMissingGtiCourses(school.accreditationId, contactId)
      .then((list) => { if (!cancelled) setMissing(list); })
      .catch((err) => { if (!cancelled) setMissingError(err.message || 'Other available courses could not be loaded.'); });
    return () => { cancelled = true; };
  }, [school.accreditationId, contactId]);

  return (
    <div className="school-detail-stack">
      <SectionHeading eyebrow="COURSES" title="Accredited courses" description="Courses this centre is approved to deliver." />
      {courses.length === 0 ? (
        <div className="school-empty"><strong>No accredited courses</strong><span>Approved courses will appear here.</span></div>
      ) : (
        <TableShell><table className="acc-legacy-table">
          <thead>
            <tr><th>Course</th><th>Duration</th><th>CPD points</th><th>Status</th></tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.name}><td><strong>{c.name}</strong></td><td>{c.duration || '–'}</td><td>{c.cpdPoints ?? '–'}</td><td><span className="record-status current">Accredited</span></td></tr>
            ))}
          </tbody>
        </table></TableShell>
      )}

      <SectionHeading title="Add course" description="Other GTi courses that are available to add to this centre." />
      {missingError && <div className="acc-warning" style={{ marginBottom: 14 }}>{missingError}</div>}
      {missing === null && !missingError ? (
        <div className="school-loading"><span className="acc-spinner" /> Loading courses…</div>
      ) : missing && missing.length === 0 ? (
        <div className="school-empty"><strong>No additional courses available</strong><span>This centre is already accredited for every available GTi course.</span></div>
      ) : missing && (
        <TableShell><table className="acc-legacy-table">
          <thead>
            <tr><th>Course</th><th>Availability</th><th>Action</th></tr>
          </thead>
          <tbody>
            {missing.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td><span className="record-status neutral">Available</span></td>
                <td><span className="table-action-muted">Get in touch</span></td>
              </tr>
            ))}
          </tbody>
        </table></TableShell>
      )}
    </div>
  );
}

function VenuesDetail({ school, contactId, onAddVenue }) {
  const [venues, setVenues] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setVenues(null);
    setError('');
    fetchAccreditationVenues(school.accreditationId, contactId)
      .then((list) => { if (!cancelled) setVenues(list); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Venues could not be loaded.'); });
    return () => { cancelled = true; };
  }, [school.accreditationId, contactId]);

  // Falls back to the accreditation's own summary row if the venues list failed to load,
  // so an error never regresses to showing nothing at all.
  const rows = venues || [{
    id: school.id, name: school.name, town: school.town, courseCount: school.courses,
    tutors: school.tutors, shownOnBeautyguild: school.status === 'Accredited',
  }];

  return (
    <div className="school-detail-stack">
      <SectionHeading eyebrow="VENUES" title="Accredited venues" description="Locations currently linked to this training centre." action={<button type="button" className="acc-btn-primary" onClick={onAddVenue}>+ Add venue</button>} />
      {error && <div className="acc-warning" style={{ marginBottom: 14 }}>{error}</div>}
      {venues === null && !error ? (
        <div className="school-loading"><span className="acc-spinner" /> Loading venues…</div>
      ) : (
        <TableShell><table className="acc-legacy-table">
          <thead>
            <tr><th>Venue</th><th>Town</th><th>Courses</th><th>Tutors</th><th>Directory</th></tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id}>
                <td><strong>{v.name}</strong></td>
                <td>{v.town || '–'}</td>
                <td>{v.courseCount ?? '–'}</td>
                <td>{v.tutors ?? '–'}</td>
                <td><span className={`record-status ${v.shownOnBeautyguild ? 'current' : 'neutral'}`}>{v.shownOnBeautyguild ? 'Visible' : 'Hidden'}</span></td>
              </tr>
            ))}
          </tbody>
        </table></TableShell>
      )}
      <div className="school-inline-note">Additional venues can be added to the Beauty Guild directory for £50 + VAT per year.</div>
    </div>
  );
}

function TutorsTable({ rows, status = 'Current' }) {
  const statusClass = status === 'Current' ? 'current' : status === 'Pending' ? 'neutral' : 'inactive';
  return (
    <TableShell><table className="acc-legacy-table">
      <thead>
        <tr><th>Tutor</th><th>Guild membership</th><th>Membership expiry</th><th>Status</th></tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.id}><td><strong>{t.name}</strong></td><td>{t.membershipNumber || '–'}</td><td>{t.membershipExpiry ? formatLongDate(t.membershipExpiry) : '–'}</td><td><span className={`record-status ${statusClass}`}>{status}</span></td></tr>
        ))}
      </tbody>
    </table></TableShell>
  );
}

function InviteTutorModal({ school, onClose, onSubmit, submitting, error, notice }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const valid = name.trim() && /\S+@\S+\.\S+/.test(email);

  const handleSubmit = () => {
    if (!valid || submitting) return;
    onSubmit({ name: name.trim(), email: email.trim() });
  };

  return (
    <div className="acc-modal-overlay" onClick={onClose} role="presentation">
      <div className="acc-modal tutor-invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-tutor-title" onClick={(e) => e.stopPropagation()}>
        <div className="tutor-modal-heading"><div><span className="portal-eyebrow">TUTOR ACCESS</span><h2 id="invite-tutor-title">Add a tutor</h2><p>Members with a current Guild membership are linked as Active. Everyone else is added as Inactive - CRM handles their invitation from here.</p></div><button type="button" className="tutor-modal-close" aria-label="Close add tutor" onClick={onClose}>×</button></div>
        <div className="tutor-centre-field"><span>Training centre</span><strong>{school.name}</strong></div>
        <div className="acc-grid-2 tutor-modal-fields"><div className="acc-field">
          <label>Tutor name</label>
          <input className="acc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Smith" />
        </div><div className="acc-field">
          <label>Email address</label>
          <input className="acc-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
        </div></div>
        {notice && <div className="acc-success-note" role="status">{notice}</div>}
        {error && <div className="acc-warning">{error}</div>}
        <div className="tutor-modal-actions"><button type="button" className="acc-btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button><button type="button" className="acc-btn-primary" disabled={!valid || submitting} onClick={handleSubmit}>{submitting ? 'Adding…' : 'Add tutor'}</button></div>
      </div>
    </div>
  );
}

function TutorInvite({ id, name, email, status }) {
  const label = status === 'Active' ? 'Linked' : 'Added (Inactive)';
  const statusClass = status === 'Active' ? 'current' : 'neutral';
  return (
    <div className="tutor-preview-row" key={id}>
      <div><strong>{name}</strong><span>{email}</span></div>
      <span className={`record-status ${statusClass}`}>{label}</span>
    </div>
  );
}

function TutorsDetail({ school, contactId }) {
  const [tutors, setTutors] = useState(null);
  const [error, setError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');
  const [recentInvites, setRecentInvites] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setTutors(null);
    setError('');
    fetchAccreditationTutors(school.accreditationId, contactId)
      .then((result) => { if (!cancelled) setTutors(result); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Tutors could not be loaded.'); })
    return () => { cancelled = true; };
  }, [school.accreditationId, contactId]);

  const handleSubmit = async ({ name, email }) => {
    setSubmitting(true);
    setInviteError('');
    setInviteNotice('');
    try {
      const { alreadyLinked, status, tutor } = await inviteOrLinkTutor(school.accreditationId, contactId, { name, email });

      if (alreadyLinked) {
        setInviteNotice(`${name} is already added to ${school.name} (${status === 'Active' ? 'Linked' : 'Inactive'}).`);
        return;
      }

      setRecentInvites((items) => [
        { id: tutor.id, name, email, status },
        ...items,
      ]);
      setInviting(false);
      fetchAccreditationTutors(school.accreditationId, contactId).then(setTutors).catch(() => {});
    } catch (err) {
      setInviteError(err.message || 'The tutor could not be added. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="school-detail-stack">
      <SectionHeading eyebrow="TUTORS" title="Accredited tutors" description="Tutors linked to this training centre and their membership status." action={<button type="button" className="acc-btn-primary" onClick={() => { setInviteError(''); setInviteNotice(''); setInviting(true); }}>+ Add tutor</button>} />
      {inviting && <InviteTutorModal school={school} onClose={() => setInviting(false)} onSubmit={handleSubmit} submitting={submitting} error={inviteError} notice={inviteNotice} />}
      {error && <div className="acc-warning" style={{ marginBottom: 14 }}>{error}</div>}
      {tutors === null && !error ? (
        <div className="school-loading"><span className="acc-spinner" /> Loading tutors…</div>
      ) : tutors && tutors.current.length === 0 ? (
        <div className="school-empty"><strong>No current tutors</strong><span>Use Add tutor to link or add one.</span></div>
      ) : tutors && <TutorsTable rows={tutors.current} />}

      {recentInvites.length > 0 && <div className="tutor-preview-list"><div className="school-section-heading compact"><div><h3>Recently added</h3><p>Members with a current Guild membership are linked as Active; everyone else is added as Inactive - CRM handles their invitation from here.</p></div><span>{recentInvites.length}</span></div>{recentInvites.map((item) => <TutorInvite key={item.id} {...item} />)}</div>}
      {tutors && tutors.pending.length > 0 && (
        <div className="school-subsection"><SectionHeading title="Pending Guild membership" description="Linked or invited tutors who don't have a Guild membership record yet." /><TutorsTable rows={tutors.pending} status="Pending" /></div>
      )}
      {tutors && tutors.expired.length > 0 && (
        <div className="school-subsection"><SectionHeading title="Inactive tutors" description="Tutors without a current annual Guild membership." /><TutorsTable rows={tutors.expired} status="Inactive" /></div>
      )}

      <div className="school-inline-note">Tutors must hold current Guild membership, appropriate qualifications and suitable insurance.</div>
    </div>
  );
}

const DELIVERY_OPTIONS = ['Face to Face In the Classroom', 'Face to Face via Live Video Link', 'Online only', 'Other'];
const ASSESSMENT_OPTIONS = ['Face to Face In the Classroom', 'Face to Face via Live Video Link', 'Case Studies - Submitting Photographs', 'Case Studies - Submitting Videos', 'Other'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function QualificationsDetail({ school, contactId }) {
  const [quals, setQuals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ name: '', month: '', year: '', accountId: school.accountId || '', accreditationId: school.accreditationId || '', delivery: [], deliveryOther: '', assessment: [], assessmentOther: '' });
  const load = async () => {
    setLoading(true);
    try {
      const [context, records] = await Promise.all([fetchQualificationContext(contactId), fetchQualifications(contactId)]);
      const availableAccounts = context.accounts || [];
      setAccounts(availableAccounts);
      setQuals(records.filter((q) => !school.accreditationId || q.Primary_Accreditation?.id === school.accreditationId));
      const currentAccount = availableAccounts.find((a) => a.accreditationId === school.accreditationId);
      if (currentAccount) setForm((prev) => ({ ...prev, accountId: currentAccount.id, accreditationId: currentAccount.accreditationId }));
    } catch (err) {
      setError(err.message || 'Qualifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, school.accreditationId]);
  const toggle = (key, value) => setForm((prev) => ({ ...prev, [key]: prev[key].includes(value) ? prev[key].filter((v) => v !== value) : [...prev[key], value] }));
  const save = async () => {
    if (saving) return;
    setError(''); setSuccess(''); setSaving(true);
    try {
      const result = await createQualification({ contactId, name: form.name, dateCompletedMonth: form.month, dateCompletedYear: form.year, accountId: form.accountId, primaryAccreditationId: form.accreditationId, practicalDeliveryType: form.delivery, practicalDeliveryOther: form.deliveryOther, practicalAssessmentType: form.assessment, practicalAssessmentOther: form.assessmentOther });
      // Show the just-created record straight from the save response rather than
      // re-running load(): CRM's search index can lag behind a brand new Qualification,
      // so an immediate re-fetch here can silently drop the record the user just added.
      setQuals((prev) => [result.qualification, ...prev]);
      setAdding(false);
      setForm((prev) => ({ ...prev, name: '', month: '', year: '', delivery: [], deliveryOther: '', assessment: [], assessmentOther: '' }));
      setSuccess(result.warning || 'Qualification saved. Your application is now ready for Guild review, and you can add another qualification at any time.');
    } catch (err) {
      setError(err.message || 'Qualification could not be saved.');
    } finally {
      setSaving(false);
    }
  };
  const selectedAccount = accounts.find((a) => a.id === form.accountId && a.accreditationId === form.accreditationId);
  const otherDeliveryValid = !form.delivery.includes('Other') || !!form.deliveryOther.trim();
  const otherAssessmentValid = !form.assessment.includes('Other') || !!form.assessmentOther.trim();
  const valid = form.name.trim() && form.month && form.year.length === 4 && selectedAccount && form.delivery.length && form.assessment.length && otherDeliveryValid && otherAssessmentValid;
  return <div className="school-detail-stack">
    <SectionHeading eyebrow="QUALIFICATIONS" title="Teaching qualifications" description="Qualifications submitted for this accreditation." action={!adding && <button type="button" className="acc-btn-primary" onClick={() => { setAdding(true); setSuccess(''); }}>+ Add qualification</button>} />
    {success && <div className="acc-success-note" role="status">{success}</div>}
    {error && <div className="acc-warning" style={{ marginBottom: 14 }}>{error}</div>}
    {loading ? <div className="school-loading"><span className="acc-spinner" /> Loading qualifications…</div> : quals.length === 0 ? <div className="school-empty"><strong>No qualifications added</strong><span>Add the first qualification to move the application into Guild review.</span></div> : <TableShell><table className="acc-legacy-table"><thead><tr><th>Qualification</th><th>Date completed</th><th>Verification</th></tr></thead><tbody>{quals.map((q) => <tr key={q.id}><td><strong>{q.Name}</strong></td><td>{String(q.Date_Completed_Month || '').padStart(2, '0')}/{q.Date_Completed_Year}</td><td><span className={`record-status ${q.Verification_Status === 'Verified' ? 'current' : 'pending'}`}>{q.Verification_Status === 'Verified' ? 'Verified' : 'Pending review'}</span></td></tr>)}</tbody></table></TableShell>}
    {adding && <div className="qualification-form-panel">
      <div className="qualification-form-heading"><div><h3>Add qualification</h3><p>Qualification name and completion date are required.</p></div><button type="button" className="tutor-modal-close" aria-label="Close qualification form" disabled={saving} onClick={() => setAdding(false)}>×</button></div>
      <div className="acc-field"><label>Qualification name *</label><input className="acc-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Level 3 Diploma in Beauty Therapy" /></div>
      <div className="acc-grid-2"><div className="acc-field"><label>Date completed - month *</label><select className="acc-select" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}><option value="">Select month</option>{MONTH_NAMES.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}</select></div><div className="acc-field"><label>Date completed - year *</label><input className="acc-input" inputMode="numeric" maxLength={4} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="2024" /></div></div>
      <div className="acc-field"><label>Training centre *</label><select className="acc-select" value={form.accountId && form.accreditationId ? `${form.accountId}:${form.accreditationId}` : ''} onChange={(e) => { const [accountId = '', accreditationId = ''] = e.target.value.split(':'); setForm({ ...form, accountId, accreditationId }); }}><option value="">Select training centre</option>{accounts.map((a) => <option key={`${a.id}:${a.accreditationId}`} value={`${a.id}:${a.accreditationId}`}>{a.name || 'Unnamed training centre'}{a.accreditationId === school.accreditationId ? ' (current)' : ''}</option>)}</select></div>
      <div className="acc-field"><label>Practical delivery type *</label>{DELIVERY_OPTIONS.map((v) => <label key={v} className="acc-checkbox-row"><input type="checkbox" checked={form.delivery.includes(v)} onChange={() => toggle('delivery', v)} />{v}</label>)}{form.delivery.includes('Other') && <input className="acc-input" style={{ marginTop: 8 }} value={form.deliveryOther} onChange={(e) => setForm({ ...form, deliveryOther: e.target.value })} placeholder="Describe other delivery type" />}</div>
      <div className="acc-field"><label>Practical assessment type *</label>{ASSESSMENT_OPTIONS.map((v) => <label key={v} className="acc-checkbox-row"><input type="checkbox" checked={form.assessment.includes(v)} onChange={() => toggle('assessment', v)} />{v}</label>)}{form.assessment.includes('Other') && <input className="acc-input" style={{ marginTop: 8 }} value={form.assessmentOther} onChange={(e) => setForm({ ...form, assessmentOther: e.target.value })} placeholder="Describe other assessment type" />}</div>
      <div className="qualification-form-actions"><button type="button" className="acc-btn-secondary" disabled={saving} onClick={() => setAdding(false)}>Cancel</button><button type="button" className="acc-btn-primary" disabled={!valid || saving} onClick={save}>{saving ? 'Saving qualification…' : 'Save qualification'}</button></div>
    </div>}
  </div>;
}

function DocumentsDetail({ school, contactId }) {
  const fetchPage = (folderId) => fetchAccreditationDocuments(school.accreditationId, contactId, folderId);
  return (
    <div className="school-detail-stack">
      <SectionHeading eyebrow="DOCUMENTS" title="Accreditation documents" description="Certificates and evidence stored for this training centre." />
      <DocumentGrid fetchPage={fetchPage} deps={[school.accreditationId, contactId]} />
    </div>
  );
}

export function InvoiceStatusBadge({ status }) {
  const statusClass = status === 'Paid' ? 'current' : status === 'Draft' ? 'neutral' : 'inactive';
  return <span className={`record-status ${statusClass}`}>{status || 'Unknown'}</span>;
}

function InvoiceDetailModal({ invoice, onClose }) {
  return (
    <div className="acc-modal-overlay" onClick={onClose} role="presentation">
      <div className="acc-modal invoice-detail-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-detail-title" onClick={(e) => e.stopPropagation()}>
        <div className="tutor-modal-heading"><div><span className="portal-eyebrow">INVOICE</span><h2 id="invoice-detail-title">Invoice #{invoice.invoiceNumber}</h2></div><button type="button" className="tutor-modal-close" aria-label="Close invoice details" onClick={onClose}>×</button></div>
        <div className="school-profile-fields" style={{ marginTop: 6 }}>
          <ProfileField label="Status" value={<InvoiceStatusBadge status={invoice.status} />} />
          <ProfileField label="Amount" value={invoice.amount != null ? `£${invoice.amount.toFixed(2)}` : null} />
          <ProfileField label="Invoice date" value={invoice.invoiceDate} />
          <ProfileField label="Due date" value={invoice.dueDate} />
          <ProfileField label="Payment date" value={invoice.paymentDate || (invoice.status === 'Paid' ? null : 'Not yet paid')} />
        </div>
        <div className="tutor-modal-actions"><button type="button" className="acc-btn-primary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function InvoicesDetail({ school, contactId }) {
  const [invoices, setInvoices] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setInvoices(null);
    setError('');
    fetchAccreditationInvoices(school.accreditationId, contactId)
      .then((result) => { if (!cancelled) setInvoices(result); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Invoices could not be loaded.'); });
    return () => { cancelled = true; };
  }, [school.accreditationId, contactId]);

  return (
    <div className="school-detail-stack">
      <SectionHeading eyebrow="INVOICES" title="Invoices" description="Invoices raised for your accreditation and membership." />
      {selected && <InvoiceDetailModal invoice={selected} onClose={() => setSelected(null)} />}
      {error && <div className="acc-warning" style={{ marginBottom: 14 }}>{error}</div>}
      {invoices === null && !error ? (
        <div className="school-loading"><span className="acc-spinner" /> Loading invoices…</div>
      ) : invoices.length === 0 ? (
        <div className="school-empty"><strong>No invoices yet</strong><span>Invoices will appear here once raised.</span></div>
      ) : (
        <TableShell><table className="acc-legacy-table">
          <thead><tr><th>Invoice</th><th>Date</th><th>Due</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="acc-row-clickable" onClick={() => setSelected(inv)}>
                <td><strong>#{inv.invoiceNumber}</strong></td>
                <td>{inv.invoiceDate || '–'}</td>
                <td>{inv.dueDate || '–'}</td>
                <td>{inv.amount != null ? `£${inv.amount.toFixed(2)}` : '–'}</td>
                <td><InvoiceStatusBadge status={inv.status} /></td>
              </tr>
            ))}
          </tbody>
        </table></TableShell>
      )}
    </div>
  );
}

const AVAILABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CREATOR_MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

// Creator returns dates as "dd-MMM-yyyy" or "dd-MMM-yyyy HH:mm:ss" - convert to the
// "yyyy-mm-dd" a date input expects, so a session's own dates can prefill a booking.
function creatorDateToInputDate(value) {
  if (!value) return '';
  const [day, mon, year] = value.split(' ')[0].split('-');
  if (!day || !CREATOR_MONTHS[mon] || !year) return '';
  return `${year}-${CREATOR_MONTHS[mon]}-${day.padStart(2, '0')}`;
}

function SessionStatusBadge({ status }) {
  const statusClass = status === 'Open' ? 'current' : status === 'Full' ? 'neutral' : status === 'Cancelled' ? 'inactive' : 'pending';
  return <span className={`record-status ${statusClass}`}>{status || 'Draft'}</span>;
}

function CreateSessionModal({ school, contactId, onClose, onCreated }) {
  const [offerings, setOfferings] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    courseOfferingId: '', tutorId: '', availabilityType: 'Fixed Date',
    startDate: '', startTime: '09:00', endDate: '', endTime: '17:00',
    maximumPlaces: '', instantBookingAvailable: true,
    flexibleDescription: '', availableDays: [], weekendAvailability: false, eveningAvailability: false,
    bookingClosingDate: '', bookingClosingTime: '', requestADateAvailable: true,
    totalAdvertisedPrice: '',
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCourseOfferings(school.accreditationId, contactId), fetchTutorOptions(school.accreditationId, contactId)])
      .then(([o, t]) => { if (!cancelled) { setOfferings(o); setTutors(t); } })
      .catch((err) => { if (!cancelled) setError(err.message || 'Course and tutor options could not be loaded.'); })
      .finally(() => { if (!cancelled) setLoadingOptions(false); });
    return () => { cancelled = true; };
  }, [school.accreditationId, contactId]);

  const toggleDay = (day) => setForm((prev) => ({ ...prev, availableDays: prev.availableDays.includes(day) ? prev.availableDays.filter((d) => d !== day) : [...prev.availableDays, day] }));

  const isFixed = form.availabilityType === 'Fixed Date';
  const valid = form.courseOfferingId && (isFixed ? form.startDate : true);

  const handleSubmit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        contactId,
        courseOfferingId: form.courseOfferingId,
        tutorId: form.tutorId || undefined,
        availabilityType: form.availabilityType,
        maximumPlaces: form.maximumPlaces || undefined,
        totalAdvertisedPrice: form.totalAdvertisedPrice || undefined,
      };
      if (isFixed) {
        payload.sessionStart = `${form.startDate}T${form.startTime || '00:00'}:00`;
        payload.sessionEnd = form.endDate ? `${form.endDate}T${form.endTime || '00:00'}:00` : undefined;
        payload.instantBookingAvailable = !!form.instantBookingAvailable;
      } else {
        payload.flexibleDescription = form.flexibleDescription || undefined;
        payload.availableDays = form.availableDays;
        payload.weekendAvailability = !!form.weekendAvailability;
        payload.eveningAvailability = !!form.eveningAvailability;
        payload.bookingClosing = form.bookingClosingDate ? `${form.bookingClosingDate}T${form.bookingClosingTime || '00:00'}:00` : undefined;
        payload.requestADateAvailable = !!form.requestADateAvailable;
      }
      await createSession(school.accreditationId, payload);
      onCreated();
    } catch (err) {
      setError(err.message || 'The session could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acc-modal-overlay" onClick={onClose} role="presentation">
      <div className="acc-modal" role="dialog" aria-modal="true" aria-labelledby="create-session-title" onClick={(e) => e.stopPropagation()}>
        <div className="tutor-modal-heading"><div><span className="portal-eyebrow">DIARY DATES</span><h2 id="create-session-title">Create a course session</h2><p>Publish a fixed date or open flexible availability for one of your accredited courses.</p></div><button type="button" className="tutor-modal-close" aria-label="Close create session" onClick={onClose}>×</button></div>

        {loadingOptions ? <div className="school-loading"><span className="acc-spinner" /> Loading course options…</div> : (
          <>
            <div className="acc-field">
              <label>Course *</label>
              <select className="acc-select" value={form.courseOfferingId} onChange={(e) => setForm({ ...form, courseOfferingId: e.target.value })}>
                <option value="">Select an accredited course</option>
                {offerings.map((o) => <option key={o.id} value={o.id}>{o.courseName} — {o.trainingCentreName}</option>)}
              </select>
              {offerings.length === 0 && <small>No approved course offerings found for this accreditation yet.</small>}
            </div>
            <div className="acc-field">
              <label>Tutor</label>
              <select className="acc-select" value={form.tutorId} onChange={(e) => setForm({ ...form, tutorId: e.target.value })}>
                <option value="">No tutor assigned</option>
                {tutors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="acc-field">
              <label>Availability type *</label>
              <select className="acc-select" value={form.availabilityType} onChange={(e) => setForm({ ...form, availabilityType: e.target.value })}>
                <option value="Fixed Date">Fixed Date</option>
                <option value="Flexible Availability">Flexible Availability</option>
                <option value="Request-a-Date">Request-a-Date</option>
              </select>
            </div>

            {isFixed ? (
              <div className="acc-grid-2">
                <div className="acc-field"><label>Start date *</label><input className="acc-input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
                <div className="acc-field"><label>Start time</label><input className="acc-input" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
                <div className="acc-field"><label>End date</label><input className="acc-input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
                <div className="acc-field"><label>End time</label><input className="acc-input" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
              </div>
            ) : (
              <>
                <div className="acc-field"><label>Availability description</label><input className="acc-input" value={form.flexibleDescription} onChange={(e) => setForm({ ...form, flexibleDescription: e.target.value })} placeholder="e.g. Dates arranged directly with the school" /></div>
                <div className="acc-field"><label>Available days</label>{AVAILABLE_DAYS.map((d) => <label key={d} className="acc-checkbox-row"><input type="checkbox" checked={form.availableDays.includes(d)} onChange={() => toggleDay(d)} />{d}</label>)}</div>
                <div className="acc-grid-2">
                  <div className="acc-field"><label>Booking closes (date)</label><input className="acc-input" type="date" value={form.bookingClosingDate} onChange={(e) => setForm({ ...form, bookingClosingDate: e.target.value })} /></div>
                  <div className="acc-field"><label>Booking closes (time)</label><input className="acc-input" type="time" value={form.bookingClosingTime} onChange={(e) => setForm({ ...form, bookingClosingTime: e.target.value })} /></div>
                </div>
              </>
            )}

            <div className="acc-grid-2">
              <div className="acc-field"><label>Maximum places</label><input className="acc-input" inputMode="numeric" value={form.maximumPlaces} onChange={(e) => setForm({ ...form, maximumPlaces: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 8" /></div>
              <div className="acc-field"><label>Total advertised price (£)</label><input className="acc-input" inputMode="decimal" value={form.totalAdvertisedPrice} onChange={(e) => setForm({ ...form, totalAdvertisedPrice: e.target.value })} placeholder="e.g. 195" /></div>
            </div>
          </>
        )}

        {error && <div className="acc-warning">{error}</div>}
        <div className="tutor-modal-actions"><button type="button" className="acc-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="button" className="acc-btn-primary" disabled={!valid || saving || loadingOptions} onClick={handleSubmit}>{saving ? 'Saving…' : 'Create session'}</button></div>
      </div>
    </div>
  );
}

function BookSessionModal({ school, contactId, session, onClose, onBooked }) {
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [numberOfStudents, setNumberOfStudents] = useState('1');
  const [message, setMessage] = useState('');
  // Prefilled from the selected session row and shown read-only for now (not yet
  // editable by the person making the booking): its own start date if it has one,
  // otherwise today; and its booking-closing deadline as the latest acceptable date.
  const [preferredDateFrom] = useState(() => creatorDateToInputDate(session.sessionStart) || new Date().toISOString().slice(0, 10));
  const [preferredDateTo] = useState(() => creatorDateToInputDate(session.bookingClosing));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isFixed = session.availabilityType === 'Fixed Date';
  const valid = studentName.trim() && /\S+@\S+\.\S+/.test(studentEmail) && Number(numberOfStudents) > 0;

  const handleSubmit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await bookSession(school.accreditationId, session.id, {
        contactId,
        studentName: studentName.trim(),
        studentEmail: studentEmail.trim(),
        numberOfStudents: Number(numberOfStudents),
        message: message.trim() || undefined,
        preferredDateFrom: isFixed ? undefined : preferredDateFrom || undefined,
        preferredDateTo: isFixed ? undefined : preferredDateTo || undefined,
      });
      onBooked(result);
    } catch (err) {
      setError(err.message || 'The booking could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acc-modal-overlay" onClick={onClose} role="presentation">
      <div className="acc-modal" role="dialog" aria-modal="true" aria-labelledby="book-session-title" onClick={(e) => e.stopPropagation()}>
        <div className="tutor-modal-heading"><div><span className="portal-eyebrow">BOOKING</span><h2 id="book-session-title">Book {session.name || 'this session'}</h2><p>{isFixed ? `A fixed session with instant booking is confirmed immediately.` : `Flexible sessions are recorded as a date request for the school to action.`}</p></div><button type="button" className="tutor-modal-close" aria-label="Close booking" onClick={onClose}>×</button></div>
        {isFixed ? (
          <div className="acc-field"><label>Session date</label><input className="acc-input" value={session.sessionStart || 'Not set'} disabled /></div>
        ) : (
          <div className="acc-grid-2">
            <div className="acc-field"><label>Preferred date from</label><input className="acc-input" type="date" value={preferredDateFrom} disabled /></div>
            <div className="acc-field"><label>Preferred date to</label><input className="acc-input" type="date" value={preferredDateTo} disabled /></div>
          </div>
        )}
        <div className="acc-grid-2">
          <div className="acc-field"><label>Student name *</label><input className="acc-input" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="e.g. Sarah Jones" /></div>
          <div className="acc-field"><label>Student email *</label><input className="acc-input" type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="sarah@example.com" /></div>
        </div>
        <div className="acc-field"><label>Number of places *</label><input className="acc-input" inputMode="numeric" value={numberOfStudents} onChange={(e) => setNumberOfStudents(e.target.value.replace(/\D/g, ''))} style={{ maxWidth: 100 }} /></div>
        <div className="acc-field"><label>Message / special requirements</label><input className="acc-input" value={message} onChange={(e) => setMessage(e.target.value)} /></div>
        {error && <div className="acc-warning">{error}</div>}
        <div className="tutor-modal-actions"><button type="button" className="acc-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="button" className="acc-btn-primary" disabled={!valid || saving} onClick={handleSubmit}>{saving ? 'Booking…' : 'Book session'}</button></div>
      </div>
    </div>
  );
}

function BookingStatusBadge({ status }) {
  const statusClass = status === 'Confirmed' || status === 'Completed' ? 'current' : status === 'Cancelled' || status === 'Refunded' ? 'inactive' : 'pending';
  return <span className={`record-status ${statusClass}`}>{status || 'Unknown'}</span>;
}

function SessionBookingsModal({ school, contactId, session, onClose }) {
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchSessionBookings(school.accreditationId, session.id, contactId)
      .then((result) => { if (!cancelled) setBookings(result); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Bookings could not be loaded.'); });
    return () => { cancelled = true; };
  }, [school.accreditationId, session.id, contactId]);

  return (
    <div className="acc-modal-overlay" onClick={onClose} role="presentation">
      <div className="acc-modal session-bookings-modal" role="dialog" aria-modal="true" aria-labelledby="session-bookings-title" onClick={(e) => e.stopPropagation()}>
        <div className="tutor-modal-heading"><div><span className="portal-eyebrow">BOOKINGS</span><h2 id="session-bookings-title">{session.name || 'Session'} bookings</h2><p>Everyone who has booked or requested a date on this session.</p></div><button type="button" className="tutor-modal-close" aria-label="Close bookings" onClick={onClose}>×</button></div>
        {error && <div className="acc-warning">{error}</div>}
        {bookings === null && !error ? (
          <div className="school-loading"><span className="acc-spinner" /> Loading bookings…</div>
        ) : bookings && bookings.length === 0 ? (
          <div className="school-empty"><strong>No bookings yet</strong><span>Bookings made against this session will appear here.</span></div>
        ) : bookings && (
          <TableShell><table className="acc-legacy-table">
            <thead><tr><th>Student</th><th>Places</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td><strong>{b.studentName || 'Unknown'}</strong>{b.message && <div className="profile-muted">{b.message}</div>}</td>
                  <td>{b.numberOfStudents}</td>
                  <td><BookingStatusBadge status={b.status} /></td>
                  <td>{b.agreedCourseDate ? `${b.agreedCourseDate}${b.agreedStartTime ? `, ${b.agreedStartTime}` : ''}` : (b.preferredDateFrom || b.preferredDateTo) ? `${b.preferredDateFrom || '?'} – ${b.preferredDateTo || '?'}` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table></TableShell>
        )}
        <div className="tutor-modal-actions"><button type="button" className="acc-btn-primary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function SessionsDetail({ school, contactId }) {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [booking, setBooking] = useState(null);
  const [viewingBookings, setViewingBookings] = useState(null);
  const [notice, setNotice] = useState('');

  const load = () => {
    setError('');
    return fetchSessions(school.accreditationId, contactId)
      .then(setSessions)
      .catch((err) => setError(err.message || 'Sessions could not be loaded.'));
  };

  useEffect(() => {
    setSessions(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school.accreditationId, contactId]);

  return (
    <div className="school-detail-stack">
      <SectionHeading eyebrow="DIARY DATES" title="Course sessions" description="Fixed dates and flexible availability published for your accredited courses." action={<button type="button" className="acc-btn-primary" onClick={() => setCreating(true)}>+ Create session</button>} />
      {creating && <CreateSessionModal school={school} contactId={contactId} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setNotice('Session created.'); load(); }} />}
      {booking && <BookSessionModal school={school} contactId={contactId} session={booking} onClose={() => setBooking(null)} onBooked={(result) => { setBooking(null); setNotice(`Booking saved (${result.status}).`); load(); }} />}
      {viewingBookings && <SessionBookingsModal school={school} contactId={contactId} session={viewingBookings} onClose={() => setViewingBookings(null)} />}
      {notice && <div className="acc-success-note" role="status">{notice}</div>}
      {error && <div className="acc-warning" style={{ marginBottom: 14 }}>{error}</div>}
      {sessions === null && !error ? (
        <div className="school-loading"><span className="acc-spinner" /> Loading sessions…</div>
      ) : sessions && sessions.length === 0 ? (
        <div className="school-empty"><strong>No sessions yet</strong><span>Use Create session to publish a fixed date or flexible availability.</span></div>
      ) : sessions && (
        <TableShell><table className="acc-legacy-table">
          <thead><tr><th>Course</th><th>Availability</th><th>Date</th><th>Places</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong>{s.tutorName && <div className="profile-muted">Tutor: {s.tutorName}</div>}</td>
                <td>{s.availabilityType}</td>
                <td>{s.availabilityType === 'Fixed Date' ? (s.sessionStart || '–') : (s.flexibleDescription || 'Dates by request')}</td>
                <td>{s.maximumPlaces != null ? `${s.placesBooked} / ${s.maximumPlaces}` : '–'}</td>
                <td><SessionStatusBadge status={s.status} /></td>
                <td style={{ display: 'flex', gap: 8 }}><button type="button" className="acc-btn-secondary" onClick={() => setViewingBookings(s)}>View bookings{s.placesBooked > 0 ? ` (${s.placesBooked})` : ''}</button><button type="button" className="acc-btn-secondary" onClick={() => setBooking(s)}>Book</button></td>
              </tr>
            ))}
          </tbody>
        </table></TableShell>
      )}
    </div>
  );
}

const DETAIL_COMPONENTS = {
  profile: SchoolProfile,
  courses: CoursesDetail,
  venues: VenuesDetail,
  tutors: TutorsDetail,
  sessions: SessionsDetail,
  qualifications: QualificationsDetail,
  documents: DocumentsDetail,
  invoices: InvoicesDetail,
};

export default function ManageSchool({ school, initialOption, contactId, contact, onBack }) {
  const [activeOption, setActiveOption] = useState(initialOption || 'profile');
  const [addingVenue, setAddingVenue] = useState(false);

  if (!school) return null;

  if (addingVenue) {
    return (
      <AddVenueWizard
        school={school}
        contact={contact}
        onCancel={() => setAddingVenue(false)}
        onDone={() => setAddingVenue(false)}
      />
    );
  }

  const DetailComponent = DETAIL_COMPONENTS[activeOption] || SchoolProfile;
  return (
    <div className="acc-body school-workspace">
      <button type="button" className="acc-manage-back-row" onClick={onBack}><BackArrowIcon /><span>Back to accreditations</span></button>
      <TrainingCentreContext school={school} />
      <nav className="school-section-nav" aria-label="Training centre sections">
        {OPTIONS.map(({ key, title }) => <button type="button" key={key} className={activeOption === key ? 'active' : ''} aria-current={activeOption === key ? 'page' : undefined} onClick={() => setActiveOption(key)}>{title}</button>)}
      </nav>
      <div className="school-workspace-content" key={activeOption}>
        {activeOption === 'qualifications' ? <QualificationsDetail school={school} contactId={contactId} />
          : activeOption === 'venues' ? <VenuesDetail school={school} contactId={contactId} onAddVenue={() => setAddingVenue(true)} />
          : activeOption === 'courses' ? <CoursesDetail school={school} contactId={contactId} />
          : activeOption === 'tutors' ? <TutorsDetail school={school} contactId={contactId} />
          : activeOption === 'sessions' ? <SessionsDetail school={school} contactId={contactId} />
          : activeOption === 'documents' ? <DocumentsDetail school={school} contactId={contactId} />
          : activeOption === 'invoices' ? <InvoicesDetail school={school} contactId={contactId} />
          : <DetailComponent school={school} />}
      </div>
    </div>
  );
}
