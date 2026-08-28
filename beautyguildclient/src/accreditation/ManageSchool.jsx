import React, { useEffect, useState } from 'react';
import { formatLongDate } from './data';
import { BackArrowIcon } from './icons';
import { createQualification, fetchQualificationContext, fetchQualifications, fetchAccreditationVenues, fetchMissingGtiCourses, fetchAccreditationTutors } from './api';
import AddVenueWizard from './AddVenueWizard';

const OPTIONS = [
  { key: 'profile', title: 'Profile' },
  { key: 'courses', title: 'Courses' },
  { key: 'venues', title: 'Venues' },
  { key: 'tutors', title: 'Tutors' },
  { key: 'qualifications', title: 'Qualifications' },
];

function SectionHeading({ eyebrow, title, description, action }) {
  return <div className="school-section-heading"><div>{eyebrow && <span className="portal-eyebrow">{eyebrow}</span>}<h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}

function TableShell({ children }) {
  return <div className="school-table-shell">{children}</div>;
}

function ProfileField({ label, value, helper }) {
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
  return (
    <TableShell><table className="acc-legacy-table">
      <thead>
        <tr><th>Tutor</th><th>Guild membership</th><th>Membership expiry</th><th>Status</th></tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.id}><td><strong>{t.name}</strong></td><td>{t.membershipNumber || '–'}</td><td>{t.membershipExpiry ? formatLongDate(t.membershipExpiry) : '–'}</td><td><span className={`record-status ${status === 'Current' ? 'current' : 'inactive'}`}>{status}</span></td></tr>
        ))}
      </tbody>
    </table></TableShell>
  );
}

function InviteTutorModal({ school, onClose, onPreview }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const valid = name.trim() && /\S+@\S+\.\S+/.test(email);

  const handlePreview = () => {
    if (!valid) return;
    onPreview({ name: name.trim(), email: email.trim() });
  };

  return (
    <div className="acc-modal-overlay" onClick={onClose} role="presentation">
      <div className="acc-modal tutor-invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-tutor-title" onClick={(e) => e.stopPropagation()}>
        <div className="tutor-modal-heading"><div><span className="portal-eyebrow">TUTOR ACCESS</span><h2 id="invite-tutor-title">Invite a tutor</h2><p>Prepare a tutor invitation for this training centre.</p></div><button type="button" className="tutor-modal-close" aria-label="Close tutor invitation" onClick={onClose}>×</button></div>
        <div className="tutor-workflow-note"><strong>Preview only</strong><span>No email or CRM record will be created. The membership and contact checks still need to be connected.</span></div>
        <div className="tutor-centre-field"><span>Training centre</span><strong>{school.name}</strong></div>
        <div className="acc-grid-2 tutor-modal-fields"><div className="acc-field">
          <label>Tutor name</label>
          <input className="acc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Smith" />
        </div><div className="acc-field">
          <label>Email address</label>
          <input className="acc-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
        </div></div>
        <div className="tutor-modal-actions"><button type="button" className="acc-btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="acc-btn-primary" disabled={!valid} onClick={handlePreview}>Add preview</button></div>
      </div>
    </div>
  );
}

function TutorsDetail({ school, contactId }) {
  const [tutors, setTutors] = useState(null);
  const [error, setError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [invitePreviews, setInvitePreviews] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setTutors(null);
    setError('');
    fetchAccreditationTutors(school.accreditationId, contactId)
      .then((result) => { if (!cancelled) setTutors(result); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Tutors could not be loaded.'); })
    return () => { cancelled = true; };
  }, [school.accreditationId, contactId]);

  const handlePreview = ({ name, email }) => {
    setInviting(false);
    setInvitePreviews((items) => [...items, { id: `${email}-${Date.now()}`, name, email }]);
  };

  return (
    <div className="school-detail-stack">
      <SectionHeading eyebrow="TUTORS" title="Accredited tutors" description="Tutors linked to this training centre and their membership status." action={<button type="button" className="acc-btn-primary" onClick={() => setInviting(true)}>+ Invite tutor</button>} />
      {inviting && <InviteTutorModal school={school} onClose={() => setInviting(false)} onPreview={handlePreview} />}
      {error && <div className="acc-warning" style={{ marginBottom: 14 }}>{error}</div>}
      {tutors === null && !error ? (
        <div className="school-loading"><span className="acc-spinner" /> Loading tutors…</div>
      ) : tutors && tutors.current.length === 0 ? (
        <div className="school-empty"><strong>No current tutors</strong><span>Use Invite tutor to prepare a new tutor invitation.</span></div>
      ) : tutors && <TutorsTable rows={tutors.current} />}

      {invitePreviews.length > 0 && <div className="tutor-preview-list"><div className="school-section-heading compact"><div><h3>Invitation previews</h3><p>Local UI previews only—nothing has been sent.</p></div><span>{invitePreviews.length}</span></div>{invitePreviews.map((item) => <div className="tutor-preview-row" key={item.id}><div><strong>{item.name}</strong><span>{item.email}</span></div><span className="record-status neutral">Not sent</span></div>)}</div>}
      {tutors && tutors.expired.length > 0 && (
        <div className="school-subsection"><SectionHeading title="Inactive tutors" description="Tutors without a current annual Guild membership." /><TutorsTable rows={tutors.expired} status="Inactive" /></div>
      )}

      <div className="school-inline-note">Tutors must hold current Guild membership, appropriate qualifications and suitable insurance. Membership status will control whether the relationship is active once the backend workflow is connected.</div>
    </div>
  );
}

const DELIVERY_OPTIONS = ['Face to Face In the Classroom', 'Face to Face via Live Video Link', 'Online only', 'Other'];
const ASSESSMENT_OPTIONS = ['Face to Face In the Classroom', 'Face to Face via Live Video Link', 'Case Studies - Submitting Photographs', 'Case Studies - Submitting Videos', 'Other'];

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
      <div className="acc-grid-2"><div className="acc-field"><label>Date completed - month *</label><select className="acc-select" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}><option value="">Select month</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></div><div className="acc-field"><label>Date completed - year *</label><input className="acc-input" inputMode="numeric" maxLength={4} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="2024" /></div></div>
      <div className="acc-field"><label>Training centre *</label><select className="acc-select" value={form.accountId && form.accreditationId ? `${form.accountId}:${form.accreditationId}` : ''} onChange={(e) => { const [accountId = '', accreditationId = ''] = e.target.value.split(':'); setForm({ ...form, accountId, accreditationId }); }}><option value="">Select training centre</option>{accounts.map((a) => <option key={`${a.id}:${a.accreditationId}`} value={`${a.id}:${a.accreditationId}`}>{a.name || 'Unnamed training centre'}{a.accreditationId === school.accreditationId ? ' (current)' : ''}</option>)}</select></div>
      <div className="acc-field"><label>Practical delivery type *</label>{DELIVERY_OPTIONS.map((v) => <label key={v} className="acc-checkbox-row"><input type="checkbox" checked={form.delivery.includes(v)} onChange={() => toggle('delivery', v)} />{v}</label>)}{form.delivery.includes('Other') && <input className="acc-input" style={{ marginTop: 8 }} value={form.deliveryOther} onChange={(e) => setForm({ ...form, deliveryOther: e.target.value })} placeholder="Describe other delivery type" />}</div>
      <div className="acc-field"><label>Practical assessment type *</label>{ASSESSMENT_OPTIONS.map((v) => <label key={v} className="acc-checkbox-row"><input type="checkbox" checked={form.assessment.includes(v)} onChange={() => toggle('assessment', v)} />{v}</label>)}{form.assessment.includes('Other') && <input className="acc-input" style={{ marginTop: 8 }} value={form.assessmentOther} onChange={(e) => setForm({ ...form, assessmentOther: e.target.value })} placeholder="Describe other assessment type" />}</div>
      <div className="qualification-form-actions"><button type="button" className="acc-btn-secondary" disabled={saving} onClick={() => setAdding(false)}>Cancel</button><button type="button" className="acc-btn-primary" disabled={!valid || saving} onClick={save}>{saving ? 'Saving qualification…' : 'Save qualification'}</button></div>
    </div>}
  </div>;
}

const DETAIL_COMPONENTS = {
  profile: SchoolProfile,
  courses: CoursesDetail,
  venues: VenuesDetail,
  tutors: TutorsDetail,
  qualifications: QualificationsDetail,
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
          : <DetailComponent school={school} />}
      </div>
    </div>
  );
}
