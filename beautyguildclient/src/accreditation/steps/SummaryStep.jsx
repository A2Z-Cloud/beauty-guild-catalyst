import React from 'react';
import { ACCREDITATION_FEE, ACCREDITATION_VAT, ACCREDITATION_GRAND_TOTAL, ACCREDITATION_WITH_MEMBERSHIP } from '../data';
import MapPicker from '../components/MapPicker';

const f2 = (n) => `£${n.toFixed(2)}`;
const readOnlyStyle = { background: '#F6F5FA', color: '#4A4760' };

function formatUkDate(iso) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const d = new Date(iso);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function SummaryStep({ acc, setAccField, onPay, onSave, courses, submitting, checkingMembership, membershipRequired, membershipError, onRetryMembership }) {
  const contactName = [acc.title, acc.fname, acc.surname].filter(Boolean).join(' ').trim();
  const selectedCourses = (courses || []).filter((c) => acc.courses.includes(c.id));
  const today = new Date().toISOString().slice(0, 10);
  const validTo = (() => { const d = new Date(today); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); })();
  const total = membershipRequired === true ? ACCREDITATION_WITH_MEMBERSHIP : ACCREDITATION_GRAND_TOTAL;
  const associateMembershipFee = ACCREDITATION_WITH_MEMBERSHIP - ACCREDITATION_GRAND_TOTAL;
  const pricingReady = typeof membershipRequired === 'boolean' && !checkingMembership;

  return (
    <div className="acc-summary-grid">
      <div className="acc-card acc-summary-review-card">
        <div className="acc-summary-title">Review application</div>
        <div className="acc-summary-intro">
          Please check the following information is correct before proceeding.
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#A5A0B5', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 10 }}>
          Training School Address and Details
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{acc.sch.name || '—'}</div>
        <div className="acc-grid-2" style={{ marginBottom: 16 }}>
          <div className="acc-field" style={{ marginBottom: 0 }}>
            <label>Address</label>
            <textarea
              className="acc-input"
              readOnly
              style={{ ...readOnlyStyle, height: 100, resize: 'none' }}
              value={[acc.sch.l1, acc.sch.town, acc.sch.county, acc.sch.country].filter(Boolean).join('\n')}
            />
          </div>
          <div>
            <div className="acc-field">
              <label>Contact Name</label>
              <input className="acc-input" readOnly style={readOnlyStyle} value={contactName || '—'} />
            </div>
            <div className="acc-field">
              <label>Phone</label>
              <input className="acc-input" readOnly style={readOnlyStyle} value={acc.sch.phone || acc.phone || '—'} />
            </div>
            <div className="acc-field">
              <label>Mobile</label>
              <input className="acc-input" readOnly style={readOnlyStyle} value={acc.sch.mobile || acc.mobile || '—'} />
            </div>
            <div className="acc-field" style={{ marginBottom: 0 }}>
              <label>Email</label>
              <input className="acc-input" readOnly style={readOnlyStyle} value={acc.sch.email || acc.email || '—'} />
            </div>
          </div>
        </div>

        <div className="acc-summary-map"><MapPicker latitude={acc.sch.latitude} longitude={acc.sch.longitude} draggable={false} /></div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#A5A0B5', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 10 }}>Info</div>
        <div className="acc-summary-info-grid" style={{ marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11.5, color: '#8A8598', marginBottom: 4 }}>Accreditation Type</div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Standard Accreditation</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: '#8A8598', marginBottom: 4 }}>Valid From</div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{formatUkDate(today)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: '#8A8598', marginBottom: 4 }}>Valid To</div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{formatUkDate(validTo)}</div>
          </div>
        </div>

        <div className="acc-field" style={{ marginBottom: 0 }}>
          <label>Courses</label>
          {selectedCourses.length === 0 ? (
            <div style={{ fontSize: 13, color: '#A5A0B5' }}>No courses selected</div>
          ) : (
            <div className="acc-summary-course-list">
              {selectedCourses.map((c) => <div key={c.id} style={{ fontSize: 13.5, padding: '3px 0' }}>{c.name}</div>)}
            </div>
          )}
        </div>
      </div>

      <div className="acc-card acc-summary-payment-card">
        <div className="acc-summary-title">Payment summary</div>
        <div className="acc-summary-cost-row">
          <span style={{ color: '#4A4760' }}>Standard accreditation</span>
          <span style={{ fontWeight: 700 }}>{f2(ACCREDITATION_GRAND_TOTAL)}</span>
        </div>
        <div className="acc-summary-cost-note">Includes {f2(ACCREDITATION_FEE)} fee and {f2(ACCREDITATION_VAT)} VAT</div>
        {membershipRequired === true && <div className="acc-summary-cost-row">
          <span style={{ color: '#4A4760' }}>Associate Membership</span>
          <span style={{ fontWeight: 700 }}>{f2(associateMembershipFee)}</span>
        </div>}
        <div className="acc-grand-total" style={{ padding: '10px 0 0', fontSize: 16 }}>
          <span>Grand Total</span>
          <span>{f2(total)}</span>
        </div>
        {membershipError && <div className="acc-warning compact" role="alert"><div className="acc-warning-title">We couldn't confirm your price</div><div className="acc-warning-body">{membershipError}</div><button type="button" className="acc-btn-secondary" onClick={onRetryMembership}>Try again</button></div>}
        <label className="acc-checkbox-row top-border" onClick={() => setAccField('tob', !acc.tob)}>
          <span className={`acc-checkbox${acc.tob ? ' selected' : ''}`} style={{ marginTop: 1 }}>{acc.tob ? '✓' : ''}</span>
          <span style={{ fontSize: 13.5, color: '#4A4760', lineHeight: 1.6 }}>
            I have read and accept the conditions in the <span style={{ color: '#E00879', fontWeight: 600 }}>Terms of Business</span> and <span style={{ color: '#E00879', fontWeight: 600 }}>Privacy Statement</span>
          </span>
        </label>
        <button
          type="button"
          className="acc-pay-btn"
          disabled={!acc.tob || submitting || !pricingReady}
          onClick={acc.tob ? onPay : onSave}
        >
          {!pricingReady ? 'Checking membership…' : submitting ? 'Submitting…' : `Pay ${f2(total)} now`}
        </button>
      </div>
    </div>
  );
}
