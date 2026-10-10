import React from 'react';
import { capitalizeFirst } from '../data';
import PhoneField from '../components/PhoneField';

export default function DetailsStep({ acc, setAccField, showErrors }) {
  const fnameMissing = showErrors && !acc.fname;
  const surnameMissing = showErrors && !acc.surname;
  const mobileMissing = showErrors && (acc.mobile || '').replace(/\D/g, '').length < 10;
  return (
    <>
      <div>
        <div className="acc-step-heading">Your details</div>
        <div className="acc-step-sub">Tell us who you are. These details form your Guild contact record.</div>
      </div>
      <div className="acc-card">
        <div className="acc-grid-2" style={{ marginBottom: 16 }}>
          <div className="acc-field" style={{ marginBottom: 0 }}>
            <label>Forename *</label>
            <input
              className={`acc-input${fnameMissing ? ' input-error' : ''}`}
              value={acc.fname}
              onChange={(e) => setAccField('fname', e.target.value)}
              onBlur={(e) => setAccField('fname', capitalizeFirst(e.target.value))}
              placeholder="e.g. Sarah"
            />
            {fnameMissing && <div className="acc-field-error">Enter your forename.</div>}
          </div>
          <div className="acc-field" style={{ marginBottom: 0 }}>
            <label>Surname *</label>
            <input
              className={`acc-input${surnameMissing ? ' input-error' : ''}`}
              value={acc.surname}
              onChange={(e) => setAccField('surname', e.target.value)}
              onBlur={(e) => setAccField('surname', capitalizeFirst(e.target.value))}
              placeholder="e.g. Jones"
            />
            {surnameMissing && <div className="acc-field-error">Enter your surname.</div>}
          </div>
        </div>
        <div className="acc-grid-2 acc-phone-grid">
          <div>
            <PhoneField
              label="Mobile number *"
              code={acc.mobileCode}
              onCodeChange={(v) => setAccField('mobileCode', v)}
              value={acc.mobile}
              onChange={(v) => setAccField('mobile', v)}
              placeholder="e.g. 07700 000000"
              error={mobileMissing}
            />
            {mobileMissing && <div className="acc-field-error">Enter a valid mobile number (at least 10 digits).</div>}
          </div>
          <PhoneField
            label="Phone number"
            code={acc.phoneCode}
            onCodeChange={(v) => setAccField('phoneCode', v)}
            value={acc.phone}
            onChange={(v) => setAccField('phone', v)}
            placeholder="e.g. 01332 000000"
          />
        </div>
      </div>
    </>
  );
}
