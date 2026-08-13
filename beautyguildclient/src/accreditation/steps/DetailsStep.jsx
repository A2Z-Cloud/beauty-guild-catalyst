import React from 'react';
import { TITLES, capitalizeFirst } from '../data';
import PhoneField from '../components/PhoneField';

export default function DetailsStep({ acc, setAccField }) {
  return (
    <>
      <div>
        <div className="acc-step-heading">Your details</div>
        <div className="acc-step-sub">Tell us who you are. These details form your Guild contact record.</div>
      </div>
      <div className="acc-card">
        <div className="acc-grid-title-2-2" style={{ marginBottom: 16 }}>
          <div className="acc-field" style={{ marginBottom: 0 }}>
            <label>Title</label>
            <select className="acc-select" value={acc.title} onChange={(e) => setAccField('title', e.target.value)}>
              <option value="">—</option>
              {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="acc-field" style={{ marginBottom: 0 }}>
            <label>Forename</label>
            <input
              className="acc-input"
              value={acc.fname}
              onChange={(e) => setAccField('fname', e.target.value)}
              onBlur={(e) => setAccField('fname', capitalizeFirst(e.target.value))}
              placeholder="Sarah"
            />
          </div>
          <div className="acc-field" style={{ marginBottom: 0 }}>
            <label>Surname</label>
            <input
              className="acc-input"
              value={acc.surname}
              onChange={(e) => setAccField('surname', e.target.value)}
              onBlur={(e) => setAccField('surname', capitalizeFirst(e.target.value))}
              placeholder="Jones"
            />
          </div>
        </div>
        <div className="acc-grid-2">
          <PhoneField
            label="Phone number"
            code={acc.phoneCode}
            onCodeChange={(v) => setAccField('phoneCode', v)}
            value={acc.phone}
            onChange={(v) => setAccField('phone', v)}
            placeholder="01332 000000"
          />
          <PhoneField
            label="Mobile number"
            code={acc.mobileCode}
            onCodeChange={(v) => setAccField('mobileCode', v)}
            value={acc.mobile}
            onChange={(v) => setAccField('mobile', v)}
            placeholder="07700 000000"
          />
        </div>
      </div>
    </>
  );
}
