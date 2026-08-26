import React, { useState } from 'react';
import StepProgress from './components/StepProgress';
import SchoolStep from './steps/SchoolStep';
import GeocodingStep from './steps/GeocodingStep';
import { createVenue, createVenueCheckoutSession } from './api';
import { ADDITIONAL_VENUE_FEE, ADDITIONAL_VENUE_VAT, ADDITIONAL_VENUE_TOTAL } from './data';

const VENUE_STEP_LABELS = ['Venue details', 'Geocoding', 'Summary'];

const f2 = (n) => `£${n.toFixed(2)}`;

function initialVenueState(contact) {
  return {
    title: (contact && contact.title) || '',
    fname: (contact && contact.firstName) || '',
    surname: (contact && contact.lastName) || '',
    schLooked: false,
    tob: false,
    sch: {
      name: '', contact: '',
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

function VenueSummaryStep({ acc, setAccField, school, onPay, submitting, error }) {
  return (
    <div className="acc-summary-grid">
      <div className="acc-card">
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Summary</div>
        <div style={{ fontSize: 13, color: '#8A8598', marginBottom: 18 }}>
          Please check the following information is correct before proceeding.
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#A5A0B5', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 10 }}>
          Venue Address and Details
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{acc.sch.name || '—'}</div>
        <div className="acc-field" style={{ marginBottom: 16 }}>
          <label>Address</label>
          <textarea
            className="acc-input" readOnly style={{ background: '#F6F5FA', color: '#4A4760', height: 90, resize: 'none' }}
            value={[acc.sch.l1, acc.sch.town, acc.sch.county, acc.sch.country].filter(Boolean).join('\n')}
          />
        </div>
        <div className="acc-field" style={{ marginBottom: 0 }}>
          <label>Courses offered at this venue</label>
          <div style={{ border: '1.5px solid #DCD9E8', borderRadius: 10, padding: '10px 13px', fontSize: 13.5, color: '#4A4760' }}>
            Same as {school.name}: {school.courseList && school.courseList.length ? school.courseList.map((c) => c.name).join(', ') : 'no courses yet'}
          </div>
        </div>
      </div>
      <div className="acc-card" style={{ display: 'flex', flexDirection: 'column', gap: 15, height: 'fit-content' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Total Cost</div>
        <div className="acc-summary-cost-row">
          <span style={{ color: '#4A4760' }}>Additional venue fee</span>
          <span style={{ fontWeight: 700 }}>{f2(ADDITIONAL_VENUE_FEE)}</span>
        </div>
        <div className="acc-summary-cost-row">
          <span style={{ color: '#4A4760' }}>VAT Amount</span>
          <span style={{ fontWeight: 700 }}>{f2(ADDITIONAL_VENUE_VAT)}</span>
        </div>
        <div className="acc-grand-total" style={{ padding: '10px 0 0', fontSize: 16 }}>
          <span>Grand Total</span>
          <span>{f2(ADDITIONAL_VENUE_TOTAL)}</span>
        </div>
        <label className="acc-checkbox-row top-border" onClick={() => setAccField('tob', !acc.tob)}>
          <span className={`acc-checkbox${acc.tob ? ' selected' : ''}`} style={{ marginTop: 1 }}>{acc.tob ? '✓' : ''}</span>
          <span style={{ fontSize: 13.5, color: '#4A4760', lineHeight: 1.6 }}>
            I have read and accept the conditions in the <span style={{ color: '#E00879', fontWeight: 600 }}>Terms of Business</span> and <span style={{ color: '#E00879', fontWeight: 600 }}>Privacy Statement</span>
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

// A scoped 3-step version of the main Accreditation wizard for adding an Additional
// Training Venue to a school that's already accredited. Reuses the same School/Geocoding
// step components - Account, Your Details, Interests, Address and Declarations are
// skipped (the applicant's own details, already known), and so are Courses and Tutors:
// an additional venue offers the same courses as the main centre and shares the same
// Training_Centre_Accred record, so there's nothing venue-specific to ask there.
export default function AddVenueWizard({ school, contact, onCancel, onDone }) {
  const [acc, setAcc] = useState(() => initialVenueState(contact));
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const setAccField = (key, value) => setAcc((prev) => ({ ...prev, [key]: value }));
  const setSchField = (key, value) => setAcc((prev) => ({ ...prev, sch: { ...prev.sch, [key]: value } }));
  const onManualEntry = () => setAccField('schLooked', true);

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
    if (index === 0) return !!(acc.sch.name && acc.sch.l1 && acc.sch.town && acc.sch.pc);
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
      // No courseIds sent - the backend copies whatever the main centre currently offers.
      const venue = await createVenue({
        contactId: contact.id,
        accountId: school.accountId,
        accreditationId: school.accreditationId,
        school: {
          name: acc.sch.name, email: acc.sch.email, phone: acc.sch.phone, mobile: acc.sch.mobile,
          addressLine1: acc.sch.l1, town: acc.sch.town, county: acc.sch.county, country: acc.sch.country,
          latitude: acc.sch.latitude, longitude: acc.sch.longitude,
        },
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
    <GeocodingStep acc={acc} setSchField={setSchField} />,
    <VenueSummaryStep acc={acc} setAccField={setAccField} school={school} onPay={handlePay} submitting={submitting} error={error} />,
  ];

  return (
    <>
      <div className="acc-topbar">
        <span className="acc-topbar-title">Add Additional Venue — {school.name}</span>
        <button type="button" className="acc-back-btn" onClick={goBack}>← Back</button>
      </div>
      <StepProgress current={stepIndex} labels={VENUE_STEP_LABELS} />
      <div className="acc-body">
        <div className="acc-main-col">
          {steps[stepIndex]}
        </div>
      </div>
      {!isLastStep && (
        <div className="acc-footer">
          <button type="button" className="acc-back-btn" onClick={goBack}>← Back</button>
          <button type="button" className="acc-btn-primary" disabled={!nextEnabled} onClick={goNext}>Continue →</button>
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
