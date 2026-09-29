import React, { useEffect, useState } from 'react';
import StepProgress from './components/StepProgress';
import SchoolStep from './steps/SchoolStep';
import CoursesStep from './steps/CoursesStep';
import GeocodingStep from './steps/GeocodingStep';
import YesNo from './components/YesNo';
import { createVenue, createVenueCheckoutSession, fetchActiveCourses } from './api';
import { ADDITIONAL_VENUE_FEE, ADDITIONAL_VENUE_VAT, ADDITIONAL_VENUE_TOTAL } from './data';

const VENUE_STEP_LABELS = ['Venue details', 'Courses', 'Geocoding', 'Tutors', 'Summary'];

const f2 = (n) => `£${n.toFixed(2)}`;

function initialVenueState(contact, school) {
  return {
    title: (contact && contact.title) || '',
    fname: (contact && contact.firstName) || '',
    surname: (contact && contact.lastName) || '',
    schLooked: false,
    tob: false,
    // Defaults to whatever the main centre currently offers - the applicant can add or
    // remove courses for this specific venue from here.
    courses: ((school && school.courseList) || []).map((c) => c.id).filter(Boolean),
    ot: null, otN: '', tutors: [],
    sch: {
      name: (school && school.name) || '', contact: '',
      email: (contact && contact.email) || '',
      phone: (contact && contact.phone) || '',
      mobile: (contact && contact.mobile) || '',
      phoneCode: '+44', mobileCode: '+44',
      country: (contact && contact.country) || 'United Kingdom',
      pc: '', l1: '', l2: '', l3: '', town: '', county: '',
      latitude: null, longitude: null,
    },
  };
}

// Trimmed version of the main wizard's TutorsVenuesStep - just the tutor-adding part,
// since "other venues" doesn't make sense mid-way through adding one, and there's no
// qualification declaration to re-ask (tutors join the school's shared Account either way).
function VenueTutorsStep({ acc, setAccField, setTutorCount, setTutorField }) {
  const otYes = acc.ot === 'yes';
  return (
    <div className="acc-card">
      <div className="acc-yn-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <span className="acc-yn-text">Do you want to add any additional tutors for this venue?</span>
        <YesNo value={acc.ot} onChange={(v) => { setAccField('ot', v); if (v === 'no') { setAccField('otN', ''); setAccField('tutors', []); } }} />
      </div>
      {otYes && (
        <>
          <div style={{ paddingTop: 14 }}>
            <label style={{ display: 'block', fontSize: 12.5, color: 'rgba(0,0,0,.62)', marginBottom: 7, fontWeight: 600 }}>How many tutors?</label>
            <input className="acc-input" style={{ width: 140 }} type="number" min="1" value={acc.otN} onChange={(e) => setTutorCount(e.target.value)} placeholder="e.g. 2" />
          </div>
          {acc.tutors.length > 0 && (
            <div className="tutor-rows">
              {acc.tutors.map((t, i) => {
                const rowInvalid = !t.fname || !t.surname || !/\S+@\S+\.\S+/.test(t.email);
                return (
                  <div className="tutor-row" key={i}>
                    <div className="tutor-row-label">Tutor {i + 1}</div>
                    <div className="tutor-row-fields">
                      <input className="acc-input" value={t.fname} onChange={(e) => setTutorField(i, 'fname', e.target.value)} placeholder="First name" aria-label={`Tutor ${i + 1} first name`} />
                      <input className="acc-input" value={t.surname} onChange={(e) => setTutorField(i, 'surname', e.target.value)} placeholder="Surname" aria-label={`Tutor ${i + 1} surname`} />
                      <input className="acc-input" type="email" value={t.email} onChange={(e) => setTutorField(i, 'email', e.target.value)} placeholder="Email address" aria-label={`Tutor ${i + 1} email address`} />
                    </div>
                    {rowInvalid && t.fname && t.surname && t.email && <div className="acc-field-error">Enter a valid email address.</div>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VenueSummaryStep({ acc, setAccField, school, courses, onPay, submitting, error }) {
  const selectedCourses = (courses || []).filter((c) => acc.courses.includes(c.id));
  return (
    <div className="acc-summary-grid">
      <div className="acc-card">
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Summary</div>
        <div style={{ fontSize: 13, color: 'rgba(0,0,0,.62)', marginBottom: 18 }}>
          Please check the following information is correct before proceeding.
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,0,0,.62)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 10 }}>
          Venue Address and Details
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{acc.sch.name || '—'}</div>
        <div className="acc-field" style={{ marginBottom: 16 }}>
          <label>Address</label>
          <textarea
            className="acc-input" readOnly style={{ background: 'var(--brand-pink-soft)', color: 'rgba(0,0,0,.62)', height: 90, resize: 'none' }}
            value={[acc.sch.l1, acc.sch.town, acc.sch.county, acc.sch.country].filter(Boolean).join('\n')}
          />
        </div>
        <div className="acc-field" style={{ marginBottom: acc.ot === 'yes' && acc.tutors.length ? 16 : 0 }}>
          <label>Courses offered at this venue</label>
          <div style={{ border: '1.5px solid var(--brand-pink-border)', borderRadius: 10, padding: '10px 13px', fontSize: 13.5, color: 'rgba(0,0,0,.62)' }}>
            {selectedCourses.length ? selectedCourses.map((c) => c.name).join(', ') : 'No courses selected'}
          </div>
        </div>
        {acc.ot === 'yes' && acc.tutors.length > 0 && (
          <div className="acc-field" style={{ marginBottom: 0 }}>
            <label>Additional tutors</label>
            <div style={{ border: '1.5px solid var(--brand-pink-border)', borderRadius: 10, padding: '10px 13px', fontSize: 13.5, color: 'rgba(0,0,0,.62)' }}>
              {acc.tutors.map((t) => `${t.fname} ${t.surname}`.trim()).filter(Boolean).join(', ') || 'None yet'}
            </div>
          </div>
        )}
      </div>
      <div className="acc-card" style={{ display: 'flex', flexDirection: 'column', gap: 15, height: 'fit-content' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Total Cost</div>
        <div className="acc-summary-cost-row">
          <span style={{ color: 'rgba(0,0,0,.62)' }}>Additional venue fee</span>
          <span style={{ fontWeight: 700 }}>{f2(ADDITIONAL_VENUE_FEE)}</span>
        </div>
        <div className="acc-summary-cost-row">
          <span style={{ color: 'rgba(0,0,0,.62)' }}>VAT Amount</span>
          <span style={{ fontWeight: 700 }}>{f2(ADDITIONAL_VENUE_VAT)}</span>
        </div>
        <div className="acc-grand-total" style={{ padding: '10px 0 0', fontSize: 16 }}>
          <span>Grand Total</span>
          <span>{f2(ADDITIONAL_VENUE_TOTAL)}</span>
        </div>
        <label className="acc-checkbox-row top-border" onClick={() => setAccField('tob', !acc.tob)}>
          <span className={`acc-checkbox${acc.tob ? ' selected' : ''}`} style={{ marginTop: 1 }}>{acc.tob ? '✓' : ''}</span>
          <span style={{ fontSize: 13.5, color: 'rgba(0,0,0,.62)', lineHeight: 1.6 }}>
            I have read and accept the conditions in the <span style={{ color: 'var(--brand-pink)', fontWeight: 600 }}>Terms of Business</span> and <span style={{ color: 'var(--brand-pink)', fontWeight: 600 }}>Privacy Statement</span>
          </span>
        </label>
        {error && (
          <div className="acc-warning">
            <div className="acc-warning-body">{error}</div>
          </div>
        )}
        <button type="button" className="acc-pay-btn" disabled={!acc.tob || submitting} onClick={onPay}>
          {submitting ? 'Submitting…' : 'Pay Now'}
        </button>
      </div>
    </div>
  );
}

// A scoped 5-step version of the main Accreditation wizard for adding an Additional
// Training Venue to a school that's already accredited. Reuses the same School/Courses/
// Geocoding step components - Account, Your Details, Interests, Address and Declarations
// are skipped (the applicant's own details, already known). Courses default to whatever
// the main centre currently offers but can be adjusted per venue; tutors join the same
// shared Account either way, so adding one here is just a convenience during setup.
export default function AddVenueWizard({ school, contact, onCancel, onDone }) {
  const [acc, setAcc] = useState(() => initialVenueState(contact, school));
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [courses, setCourses] = useState(null);
  const [coursesError, setCoursesError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchActiveCourses()
      .then((list) => { if (!cancelled) setCourses(list); })
      .catch((err) => { if (!cancelled) setCoursesError(err.message || 'Courses could not be loaded.'); });
    return () => { cancelled = true; };
  }, []);

  const setAccField = (key, value) => setAcc((prev) => ({ ...prev, [key]: value }));
  const setSchField = (key, value) => setAcc((prev) => ({ ...prev, sch: { ...prev.sch, [key]: value } }));
  const onManualEntry = () => setAccField('schLooked', true);
  const toggleCourse = (value) => setAcc((prev) => ({
    ...prev,
    courses: prev.courses.includes(value) ? prev.courses.filter((v) => v !== value) : [...prev.courses, value],
  }));

  const setTutorCount = (value) => setAcc((prev) => {
    const n = Number(value);
    let tutors = prev.tutors;
    if (Number.isInteger(n) && n >= 0) {
      tutors = prev.tutors.slice(0, n);
      while (tutors.length < n) tutors = [...tutors, { fname: '', surname: '', email: '' }];
    }
    return { ...prev, otN: value, tutors };
  });
  const setTutorField = (index, key, value) => setAcc((prev) => ({
    ...prev,
    tutors: prev.tutors.map((t, i) => (i === index ? { ...t, [key]: value } : t)),
  }));

  // "Use home address" here means the applicant's own address on file, the closest
  // equivalent to the main flow's correspondence-address copy, since this mini-wizard
  // has no Address step of its own to copy from.
  const copyCorrToSch = () => setAcc((prev) => ({
    ...prev,
    schLooked: true,
    sch: {
      ...prev.sch,
      contact: [prev.title, prev.fname, prev.surname].filter(Boolean).join(' ').trim(),
      email: (contact && contact.email) || prev.sch.email,
      phone: (contact && contact.phone) || prev.sch.phone,
      mobile: (contact && contact.mobile) || prev.sch.mobile,
      pc: (contact && contact.postcode) || '',
      l1: (contact && contact.addressLine1) || '',
      l2: (contact && contact.addressLine2) || '',
      l3: '',
      town: (contact && contact.town) || '',
      county: (contact && contact.county) || '',
      country: (contact && contact.country) || prev.sch.country,
    },
  }));

  const isStepValid = (index) => {
    // Postcode is deliberately not required here (matches the main wizard's School step
    // validation in data.js case 6) - a non-UK venue may have no postcode entered at all.
    if (index === 0) return !!(acc.sch.name && acc.sch.l1 && acc.sch.town);
    if (index === 3) {
      return acc.ot !== 'yes' || (
        Number.isInteger(Number(acc.otN)) && Number(acc.otN) > 0
        && acc.tutors.length === Number(acc.otN)
        && acc.tutors.every((t) => !!t.fname && !!t.surname && /\S+@\S+\.\S+/.test(t.email))
      );
    }
    return true;
  };

  const isLastStep = stepIndex === VENUE_STEP_LABELS.length - 1;
  const nextEnabled = isStepValid(stepIndex);

  const goNext = () => { if (nextEnabled) setStepIndex((i) => i + 1); };
  const goBack = () => { if (stepIndex === 0) onCancel(); else setStepIndex((i) => i - 1); };

  const handlePay = async () => {
    setError('');
    setSubmitting(true);
    try {
      const venue = await createVenue({
        contactId: contact.id,
        accountId: school.accountId,
        accreditationId: school.accreditationId,
        school: {
          name: acc.sch.name, email: acc.sch.email, phone: acc.sch.phone, mobile: acc.sch.mobile,
          addressLine1: acc.sch.l1, addressLine2: acc.sch.l2, addressLine3: acc.sch.l3,
          town: acc.sch.town, county: acc.sch.county, country: acc.sch.country, postcode: acc.sch.pc,
        },
        courseIds: acc.courses,
        tutors: acc.ot === 'yes' ? acc.tutors : [],
      });
      const checkout = await createVenueCheckoutSession({
        centreId: venue.id, accreditationId: school.accreditationId, contactId: contact.id,
        email: contact.email, name: acc.sch.name,
      });
      if (checkout.checkoutUrl) {
        window.location.assign(checkout.checkoutUrl);
        return;
      }
      onDone();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  const steps = [
    <SchoolStep acc={acc} setSchField={setSchField} setAccField={setAccField} copyCorrToSch={copyCorrToSch} onManualEntry={onManualEntry} />,
    <CoursesStep acc={acc} toggleCourse={toggleCourse} courses={courses} coursesError={coursesError} />,
    <GeocodingStep acc={acc} setSchField={setSchField} />,
    <VenueTutorsStep acc={acc} setAccField={setAccField} setTutorCount={setTutorCount} setTutorField={setTutorField} />,
    <VenueSummaryStep acc={acc} setAccField={setAccField} school={school} courses={courses} onPay={handlePay} submitting={submitting} error={error} />,
  ];

  return (
    <>
      <StepProgress current={stepIndex} labels={VENUE_STEP_LABELS} title="Add additional venue" context={school.name} />
      <div className="acc-body acc-wizard-body">
        <div className="acc-main-col acc-wizard-content" key={stepIndex}>
          {steps[stepIndex]}
        </div>
      </div>
      {!isLastStep && (
        <div className="acc-footer">
          <button type="button" className="acc-back-btn" onClick={goBack}>← Back</button>
          <div className="acc-footer-right">
            {!nextEnabled && <span className="acc-footer-guidance">Complete the required fields to continue.</span>}
            <button type="button" className="acc-btn-primary" disabled={!nextEnabled} onClick={goNext}>Continue →</button>
          </div>
        </div>
      )}
      {isLastStep && (
        <div className="acc-footer">
          <button type="button" className="acc-back-btn" onClick={goBack}>← Back</button>
        </div>
      )}
    </>
  );
}
