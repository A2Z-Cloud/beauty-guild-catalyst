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

export default function SummaryStep({ acc, setAccField, onPay, onSave, courses, submitting, checkingMembership, membershipRequired }) {
  const contactName = [acc.title, acc.fname, acc.surname].filter(Boolean).join(' ').trim();
  const selectedCourses = (courses || []).filter((c) => acc.courses.includes(c.id));
  const today = new Date().toISOString().slice(0, 10);
  const validTo = (() => { const d = new Date(today); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); })();
  const total = membershipRequired === true ? ACCREDITATION_WITH_MEMBERSHIP : ACCREDITATION_GRAND_TOTAL;

  return (
    <div className="acc-summary-grid">
      <div className="acc-card">
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Summary</div>
        <div style={{ fontSize: 13, color: '#8A8598', marginBottom: 18 }}>
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

        <div className="acc-summary-map"><MapPicker latitude={acc.sch.latitude} longitude={acc.sch.longitude} onChange={() => {}} /></div>

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
            <div style={{ border: '1.5px solid #DCD9E8', borderRadius: 10, padding: '10px 13px' }}>
              {selectedCourses.map((c) => <div key={c.id} style={{ fontSize: 13.5, padding: '3px 0' }}>{c.name}</div>)}
            </div>
          )}
        </div>
      </div>

      <div className="acc-card" style={{ display: 'flex', flexDirection: 'column', gap: 15, height: 'fit-content' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Total Cost</div>
        <div className="acc-summary-cost-row">
          <span style={{ color: '#4A4760' }}>{membershipRequired === true ? 'Accreditation with Associate Membership' : 'Accreditation fee'}</span>
          <span style={{ fontWeight: 700 }}>{membershipRequired === true ? f2(total) : f2(ACCREDITATION_FEE)}</span>
        </div>
        {membershipRequired !== true && <div className="acc-summary-cost-row">
          <span style={{ color: '#4A4760' }}>VAT Amount</span>
          <span style={{ fontWeight: 700 }}>{f2(ACCREDITATION_VAT)}</span>
        </div>}
        <div className="acc-grand-total" style={{ padding: '10px 0 0', fontSize: 16 }}>
          <span>Grand Total</span>
          <span>{f2(total)}</span>
        </div>
        <label className="acc-checkbox-row top-border" onClick={() => setAccField('tob', !acc.tob)}>
          <span className={`acc-checkbox${acc.tob ? ' selected' : ''}`} style={{ marginTop: 1 }}>{acc.tob ? '✓' : ''}</span>
          <span style={{ fontSize: 13.5, color: '#4A4760', lineHeight: 1.6 }}>
            I have read and accept the conditions in the <span style={{ color: '#E00879', fontWeight: 600 }}>Terms of Business</span> and <span style={{ color: '#E00879', fontWeight: 600 }}>Privacy Statement</span>
          </span>
        </label>
        <button
          type="button"
          className="acc-pay-btn"
          disabled={!acc.tob || submitting || checkingMembership}
          onClick={acc.tob ? onPay : onSave}
        >
          {checkingMembership ? 'Checking membership…' : submitting ? 'Submitting…' : 'Pay Now'}
        </button>
      </div>
    </div>
  );
}
