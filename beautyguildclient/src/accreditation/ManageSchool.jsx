import React, { useEffect, useState } from 'react';
import { formatLongDate } from './data';
import { DocumentIcon, GraduationCapIcon, PeopleIcon, PencilSquareIcon, CertificateIcon, BackArrowIcon } from './icons';
import { createQualification, fetchQualificationContext, fetchQualifications, fetchAccreditationVenues, fetchMissingGtiCourses, fetchAccreditationTutors } from './api';
import AddVenueWizard from './AddVenueWizard';
import Modal from './components/Modal';

const OPTIONS = [
  { key: 'profile', title: 'School Profile', desc: 'View your training centre details', Icon: PencilSquareIcon },
  { key: 'courses', title: 'Accredited Courses', desc: 'View your accredited courses', Icon: DocumentIcon },
  { key: 'venues', title: 'Accredited Venues', desc: 'View your accredited venues', Icon: GraduationCapIcon },
  { key: 'tutors', title: 'Accredited Tutors', desc: 'View your accredited tutors', Icon: PeopleIcon },
  { key: 'qualifications', title: 'Qualifications', desc: 'Add and manage your teaching qualifications', Icon: CertificateIcon },
  { key: 'credits', title: 'My Referral Credit Balance', desc: 'Manage your referral credits', Icon: PencilSquareIcon },
  { key: 'addCourse', title: 'Add GTI Course or Price', desc: 'Offer additional GTi courses and add course prices to be advertised on the Guild website', Icon: DocumentIcon },
];

function ProfileField({ label, value, helper }) {
  return <div className="school-profile-field"><span>{label}</span><strong>{value || 'Not available yet'}</strong>{helper && <small>{helper}</small>}</div>;
}

function SchoolProfile({ school }) {
  return (
    <div className="school-profile-layout">
      <section className="school-profile-panel">
        <div className="school-profile-panel-heading"><div><span className="portal-eyebrow">BASIC INFORMATION</span><h2>School profile</h2><p>These details are currently supplied from your accreditation record.</p></div><span className="profile-readonly">CRM record</span></div>
        <div className="school-profile-fields">
          <ProfileField label="School / Training Centre Name" value={school.name} />
          <ProfileField label="Town / City" value={school.town} />
          <ProfileField label="Accreditation status" value={school.status === 'Active' ? 'Accredited' : school.status} />
          <ProfileField label="Accreditation valid until" value={school.expires ? formatLongDate(school.expires) : ''} />
          <ProfileField label="Accredited courses" value={school.courses} />
          <ProfileField label="Tutors / lecturers" value={school.tutors} />
        </div>
      </section>
      <aside className="school-profile-panel school-profile-side-panel">
        <span className="portal-eyebrow">PUBLIC PRESENCE</span><h2>Directory profile</h2>
        <p>Your public training centre profile and additional editable details will be connected here once the CRM field mapping is confirmed.</p>
        {school.referralCode ? <a className="school-profile-link" href={`https://beautyguild.com/Join/${school.referralCode}`} target="_blank" rel="noreferrer">View student landing page →</a> : <span className="profile-muted">Student landing page not available</span>}
        <div className="school-profile-note">Need to update your school details? Contact the accreditation team while profile editing is being prepared.</div>
      </aside>
    </div>
  );
}

function TrainingCentreInfoBox({ school }) {
  return (
    <div className="acc-legacy-box">
      <div className="acc-info-row"><strong>Training Centre Name:</strong> {school.name}</div>
      {school.referralCode && (
        <>
          <div className="acc-info-row"><strong>Referral Code:</strong> {school.referralCode}</div>
          <div className="acc-info-row">
            <strong>Student Landing Page:</strong>{' '}
            <a href={`https://beautyguild.com/Join/${school.referralCode}`} target="_blank" rel="noreferrer">
              https://beautyguild.com/Join/{school.referralCode}
            </a>
          </div>
        </>
      )}
      {school.registerEntryId && (
        <div className="acc-info-row">
          <strong>Register Entry Link:</strong>{' '}
          <a
            href={`https://beautyguild.com/Training/Training-Venue-View?ID=${school.registerEntryId}`}
            target="_blank"
            rel="noreferrer"
          >
            https://beautyguild.com/Training/Training-Venue-View?ID={school.registerEntryId}
          </a>
        </div>
      )}
      {school.expires && (
        <div className="acc-info-row"><strong>Accreditation Valid Until:</strong> {formatLongDate(school.expires)}</div>
      )}
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
    <>
      <div className="acc-legacy-intro">
        The following courses have been accredited by the Guild and can be advertised as being Guild Accredited:
      </div>
      {courses.length === 0 ? (
        <div className="acc-step-sub">You do not have any accredited courses yet.</div>
      ) : (
        <table className="acc-legacy-table">
          <thead>
            <tr><th>Course Name</th><th>Duration</th><th>CPD Points</th></tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.name}><td>{c.name}</td><td>{c.duration || '–'}</td><td>{c.cpdPoints ?? '–'}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="acc-select-heading">Other Available GTi Courses</div>
      <div className="acc-legacy-intro">
        You are not currently accredited to offer the following GTi courses. If you wish to enquire about adding any
        of these courses to your account, please click the Course Enquiry Link.
      </div>
      {missingError && <div className="acc-warning" style={{ marginBottom: 14 }}>{missingError}</div>}
      {missing === null && !missingError ? (
        <div className="acc-step-sub">Loading…</div>
      ) : missing && missing.length === 0 ? (
        <div className="acc-step-sub">You're already accredited for every available GTi course.</div>
      ) : missing && (
        <table className="acc-legacy-table">
          <thead>
            <tr><th>Name</th><th>Practical Hours</th><th>Min Practical Fee</th><th>Enquire</th></tr>
          </thead>
          <tbody>
            {missing.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>–</td>
                <td>–</td>
                <td><span style={{ color: '#A5A0B5' }}>Add this course to my list</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
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
    tutors: school.tutors, shownOnBeautyguild: school.status === 'Active',
  }];

  return (
    <>
      <div className="acc-legacy-intro">
        You have the following Guild Accredited Training Venues listed in the Training Directory.
      </div>
      {error && <div className="acc-warning" style={{ marginBottom: 14 }}>{error}</div>}
      {venues === null && !error ? (
        <div className="acc-step-sub">Loading…</div>
      ) : (
        <table className="acc-legacy-table">
          <thead>
            <tr><th>Venue Name</th><th>Town</th><th>Courses</th><th>Tutors</th><th>Shown on Beautyguild</th></tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id}>
                <td>{v.name}</td>
                <td>{v.town || '–'}</td>
                <td>{v.courseCount ?? '–'}</td>
                <td>{v.tutors ?? '–'}</td>
                <td>{v.shownOnBeautyguild ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="acc-select-heading">Add Additional Training Venues</div>
      <div className="acc-legacy-intro">
        If you have additional training centres at venues that are not listed on Beautyguild.com, they will not be
        found by students who are searching in these locations. You can add additional venues to Beautyguild.com for
        just £50 + VAT per year.
      </div>
      <button type="button" className="acc-btn-primary" onClick={onAddVenue}>+ Add Additional Venue</button>
    </>
  );
}

function TutorsTable({ rows }) {
  return (
    <table className="acc-legacy-table">
      <thead>
        <tr><th>Name</th><th>Guild Membership #</th><th>Membership Expiry</th></tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.id}><td>{t.name}</td><td>{t.membershipNumber}</td><td>{t.membershipExpiry ? formatLongDate(t.membershipExpiry) : '–'}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function InviteTutorModal({ onClose, onInvited }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [checking, setChecking] = useState(false);
  const valid = name.trim() && /\S+@\S+\.\S+/.test(email);

  const handleInvite = () => {
    setChecking(true);
    // UI only for now, per instruction - the real "is this email already a registered
    // tutor" check gets wired in once the functionality is confirmed. Always proceeds
    // as "not registered" until then.
    const isAlreadyRegistered = false;
    setChecking(false);
    onInvited({ name: name.trim(), email: email.trim(), alreadyRegistered: isAlreadyRegistered });
  };

  return (
    <div className="acc-modal-overlay" onClick={onClose}>
      <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="acc-modal-title">Invite a Tutor</div>
        <div className="acc-modal-body" style={{ marginBottom: 16 }}>
          Enter the tutor's details below and we'll send them an invitation to join your training centre.
        </div>
        <div className="acc-field">
          <label>Tutor Name</label>
          <input className="acc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Smith" />
        </div>
        <div className="acc-field" style={{ marginBottom: 0 }}>
          <label>Email Address</label>
          <input className="acc-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" className="acc-btn-primary" style={{ flex: 1 }} disabled={!valid || checking} onClick={handleInvite}>
            {checking ? 'Checking…' : 'Invite'}
          </button>
          <button type="button" className="acc-btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function TutorsDetail({ school, contactId }) {
  const [tutors, setTutors] = useState(null);
  const [error, setError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [resultModal, setResultModal] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setTutors(null);
    setError('');
    fetchAccreditationTutors(school.accreditationId, contactId)
      .then((result) => { if (!cancelled) setTutors(result); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Tutors could not be loaded.'); })
    return () => { cancelled = true; };
  }, [school.accreditationId, contactId]);

  const handleInvited = ({ name, email, alreadyRegistered }) => {
    setInviting(false);
    if (alreadyRegistered) {
      setResultModal({
        title: 'Tutor Already Registered',
        body: `${name} (${email}) already has a Guild account. They can be added directly instead of being sent a new invitation.`,
      });
      return;
    }
    setResultModal({
      title: 'Invitation Sent',
      body: `An invitation has been sent to ${name} at ${email}.`,
      saved: true,
    });
  };

  return (
    <>
      <button type="button" className="acc-btn-primary" style={{ marginBottom: 18 }} onClick={() => setInviting(true)}>+ Invite Tutor</button>
      {inviting && <InviteTutorModal onClose={() => setInviting(false)} onInvited={handleInvited} />}
      <Modal modal={resultModal} onClose={() => setResultModal(null)} />
      {error && <div className="acc-warning" style={{ marginBottom: 14 }}>{error}</div>}
      {tutors === null && !error ? (
        <div className="acc-step-sub">Loading…</div>
      ) : tutors && tutors.current.length === 0 ? (
        <div className="acc-warning">
          <div className="acc-warning-title">You do not have any accredited tutors registered against your training centres.</div>
          <div className="acc-warning-body">Please contact us to add your tutors to your accreditation.</div>
        </div>
      ) : tutors && <TutorsTable rows={tutors.current} />}

      {tutors && tutors.expired.length > 0 && (
        <>
          <div className="acc-select-heading">Expired Tutors</div>
          <div className="acc-legacy-intro">
            The following tutors have not renewed their annual membership and no longer allowed to teach Guild
            Accredited training courses.
          </div>
          <TutorsTable rows={tutors.expired} />
        </>
      )}

      <div className="acc-legacy-intro" style={{ marginTop: 16, marginBottom: 0 }}>
        Lecturers and tutors of Guild Accredited training courses must be members of the Guild who are fully
        qualified in the subjects they are teaching and are suitably insured. Lecturers can apply online or call our
        membership team on 01332 224831.
      </div>
    </>
  );
}

const DELIVERY_OPTIONS = ['Face to Face In the Classroom', 'Face to Face via Live Video Link', 'Online only', 'Other'];
const ASSESSMENT_OPTIONS = ['Face to Face In the Classroom', 'Face to Face via Live Video Link', 'Case Studies - Submitting Photographs', 'Case Studies - Submitting Videos', 'Other'];

function QualificationsDetail({ school, contactId }) {
  const [quals, setQuals] = useState([]); const [accounts, setAccounts] = useState([]); const [adding, setAdding] = useState(false); const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', month: '', year: '', accountId: school.accountId || '', accreditationId: school.accreditationId || '', delivery: [], deliveryOther: '', assessment: [], assessmentOther: '' });
  const load = async () => { try { const [context, records] = await Promise.all([fetchQualificationContext(contactId), fetchQualifications(contactId)]); setAccounts(context.accounts || []); setQuals(records.filter((q) => !school.accreditationId || q.Primary_Accreditation?.id === school.accreditationId)); } catch (err) { setError(err.message || 'Qualifications could not be loaded.'); } };
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, school.accreditationId]);
  const toggle = (key, value) => setForm((prev) => ({ ...prev, [key]: prev[key].includes(value) ? prev[key].filter((v) => v !== value) : [...prev[key], value] }));
  const save = async () => { setError(''); try { await createQualification({ contactId, name: form.name, dateCompletedMonth: form.month, dateCompletedYear: form.year, accountId: form.accountId, primaryAccreditationId: form.accreditationId, practicalDeliveryType: form.delivery, practicalDeliveryOther: form.deliveryOther, practicalAssessmentType: form.assessment, practicalAssessmentOther: form.assessmentOther }); setAdding(false); setForm({ ...form, name: '', month: '', year: '', delivery: [], deliveryOther: '', assessment: [], assessmentOther: '' }); load(); } catch (err) { setError(err.message || 'Qualification could not be saved.'); } };
  const selectedAccount = accounts.find((a) => a.id === form.accountId && a.accreditationId === form.accreditationId);
  const valid = form.name && form.month && form.year.length === 4 && selectedAccount && form.delivery.length && form.assessment.length;
  return <>
    <div className="acc-legacy-intro">Add recognised qualifications for the courses you teach. Your records will be reviewed by the Guild.</div>
    {error && <div className="acc-warning" style={{ marginBottom: 14 }}>{error}</div>}
    {quals.length === 0 ? <div className="acc-step-sub" style={{ marginBottom: 16 }}>No qualifications have been added for this accreditation yet.</div> : <div style={{ marginBottom: 16 }}>{quals.map((q) => <div key={q.id} className="acc-yn-row"><span className="acc-yn-text"><strong>{q.Name}</strong><br /><span style={{ color: '#8A8598' }}>Completed {q.Date_Completed_Month}/{q.Date_Completed_Year} · {q.Verification_Status || 'Not Verified'}</span></span></div>)}</div>}
    {!adding && <button type="button" className="acc-btn-secondary" onClick={() => setAdding(true)}>+ Add Qualification</button>}
    {adding && <div className="acc-card" style={{ marginTop: 16 }}>
      <div className="acc-modal-title">Add Qualification</div><div className="acc-modal-body">Qualification name, completion month and year are required.</div>
      <div className="acc-field"><label>Qualification name *</label><input className="acc-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Level 3 Diploma in Beauty Therapy" /></div>
      <div className="acc-grid-2"><div className="acc-field"><label>Date completed - month *</label><select className="acc-select" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}><option value="">Select month</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></div><div className="acc-field"><label>Date completed - year *</label><input className="acc-input" inputMode="numeric" maxLength={4} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="2024" /></div></div>
      <div className="acc-field"><label>Accreditation / account *</label><select className="acc-select" value={`${form.accountId}:${form.accreditationId}`} onChange={(e) => { const [accountId, accreditationId] = e.target.value.split(':'); setForm({ ...form, accountId, accreditationId }); }}><option value="">Select training centre</option>{accounts.map((a) => <option key={`${a.id}:${a.accreditationId}`} value={`${a.id}:${a.accreditationId}`}>{a.name || 'Unnamed account'}{a.accreditationId === school.accreditationId ? ' (this application)' : ''}</option>)}</select></div>
      <div className="acc-field"><label>Practical delivery type *</label>{DELIVERY_OPTIONS.map((v) => <label key={v} className="acc-checkbox-row"><input type="checkbox" checked={form.delivery.includes(v)} onChange={() => toggle('delivery', v)} />{v}</label>)}{form.delivery.includes('Other') && <input className="acc-input" style={{ marginTop: 8 }} value={form.deliveryOther} onChange={(e) => setForm({ ...form, deliveryOther: e.target.value })} placeholder="Describe other delivery type" />}</div>
      <div className="acc-field"><label>Practical assessment type *</label>{ASSESSMENT_OPTIONS.map((v) => <label key={v} className="acc-checkbox-row"><input type="checkbox" checked={form.assessment.includes(v)} onChange={() => toggle('assessment', v)} />{v}</label>)}{form.assessment.includes('Other') && <input className="acc-input" style={{ marginTop: 8 }} value={form.assessmentOther} onChange={(e) => setForm({ ...form, assessmentOther: e.target.value })} placeholder="Describe other assessment type" />}</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}><button type="button" className="acc-btn-primary" style={{ flex: 1 }} disabled={!valid} onClick={save}>Save qualification</button><button type="button" className="acc-btn-secondary" style={{ flex: 1 }} onClick={() => setAdding(false)}>Cancel</button></div>
    </div>}
  </>;
}

function PlaceholderDetail() {
  return (
    <div className="acc-info-note">
      This section isn't built yet - no reference screenshot was available for it, unlike Accredited Courses, Venues
      and Tutors.
    </div>
  );
}

const DETAIL_TITLES = {
  profile: 'School Profile',
  courses: 'Accredited Courses',
  venues: 'Accredited Venues',
  tutors: 'Accredited Therapy Lecturers',
  qualifications: 'Qualifications',
  credits: 'My Referral Credit Balance',
  addCourse: 'Add GTI Course or Price',
};

const DETAIL_COMPONENTS = {
  profile: SchoolProfile,
  courses: CoursesDetail,
  venues: VenuesDetail,
  tutors: TutorsDetail,
  qualifications: QualificationsDetail,
  credits: PlaceholderDetail,
  addCourse: PlaceholderDetail,
};

export default function ManageSchool({ school, initialOption, contactId, contact }) {
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

  if (activeOption) {
    const DetailComponent = DETAIL_COMPONENTS[activeOption];
    return (
      <div className="acc-body" style={{ flexWrap: 'nowrap', flexDirection: 'column', alignItems: 'stretch', width: '100%' }}>
        <div className="school-workspace-header">
          <div className="acc-manage-back-row" onClick={() => setActiveOption('profile')}>
          <BackArrowIcon />
            <span>Back to school profile</span>
          </div>
          <span className="school-workspace-title">{DETAIL_TITLES[activeOption]}</span>
        </div>
        <nav className="school-section-nav" aria-label="Training centre sections">
          {OPTIONS.map(({ key, title }) => <button type="button" key={key} className={activeOption === key ? 'active' : ''} onClick={() => setActiveOption(key)}>{title}</button>)}
        </nav>
        <div style={{ marginTop: 20, marginBottom: 20 }}>
          <TrainingCentreInfoBox school={school} />
        </div>
        {activeOption === 'qualifications' ? <QualificationsDetail school={school} contactId={contactId} />
          : activeOption === 'venues' ? <VenuesDetail school={school} contactId={contactId} onAddVenue={() => setAddingVenue(true)} />
          : activeOption === 'courses' ? <CoursesDetail school={school} contactId={contactId} />
          : activeOption === 'tutors' ? <TutorsDetail school={school} contactId={contactId} />
          : <DetailComponent school={school} />}
      </div>
    );
  }

  return (
    <div className="acc-body" style={{ flexWrap: 'nowrap', flexDirection: 'column', alignItems: 'stretch', width: '100%' }}>
      <div className="school-portal-header"><div><span className="portal-eyebrow">TRAINING CENTRE</span><h1>{school.name}</h1><p>Manage your accredited school profile, courses, venues and qualifications.</p></div><span className="acc-status-badge">{school.status === 'Active' ? 'Accredited' : school.status}</span></div>
      <nav className="school-section-nav" aria-label="Training centre sections">
        {OPTIONS.map(({ key, title }) => <button type="button" key={key} className={activeOption === key ? 'active' : ''} onClick={() => setActiveOption(key)}>{title}</button>)}
      </nav>
      <TrainingCentreInfoBox school={school} />
      <div className="acc-select-heading">Manage your training centre</div>
      <div className="acc-manage-option-grid">
        {OPTIONS.map(({ key, title, desc, Icon }) => (
          <div key={key} className="acc-manage-option-card" onClick={() => setActiveOption(key)}>
            <Icon />
            <div>
              <div className="acc-manage-option-title">{title}</div>
              <div className="acc-manage-option-desc">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
