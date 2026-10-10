import React from 'react';
import { TITLES, INTERESTS, capitalizeFirst } from '../data';
import PhoneField from '../components/PhoneField';

// Matches the real Register flow: Title/Forename/Surname/Phone/Mobile and Interests
// are one screen in production, not two separate wizard steps.
export default function RegisterDetailsStep({ acc, setAccField, toggleInterest, showErrors }) {
  const fnameMissing = showErrors && !acc.fname;
  const surnameMissing = showErrors && !acc.surname;
  const mobileMissing = showErrors && (acc.mobile || '').replace(/\D/g, '').length < 10;
  return (
    <div className="acc-account-shell">
      <div className="acc-step-heading">Your Details</div>
      <div className="acc-card">
        <div className="acc-field">
          <label>Title</label>
          <select className="acc-select" value={acc.title} onChange={(e) => setAccField('title', e.target.value)}>
            <option value="">- Please Choose -</option>
            {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="acc-field">
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
        <div className="acc-field">
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
        <div style={{ marginBottom: 14 }}>
          <PhoneField
            label="Mobile *"
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
          label="Phone Number"
          code={acc.phoneCode}
          onCodeChange={(v) => setAccField('phoneCode', v)}
          value={acc.phone}
          onChange={(v) => setAccField('phone', v)}
          placeholder="e.g. 01332 000000"
        />
      </div>
      <div className="acc-card">
        <div className="acc-card-title" style={{ marginBottom: 12 }}>Interests</div>
        {INTERESTS.map((label) => {
          const selected = acc.interests.includes(label);
          return (
            <label
              key={label}
              className={`acc-tile${selected ? ' selected' : ''}${label === 'Training' ? ' required' : ''}`}
              onClick={() => toggleInterest(label)}
            >
              <span className={`acc-checkbox${selected ? ' selected' : ''}`}>{selected ? '✓' : ''}</span>
              <span style={{ flex: 1 }}>{label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
