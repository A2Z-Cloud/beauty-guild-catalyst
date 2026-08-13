import React from 'react';
import { COUNTRY_CODES, formatUkPhone } from '../data';

// A phone/mobile input with a country-code dropdown, defaulting to the UK - per the field
// mapping doc's "drop down box for country code within the field, defaulting to the UK".
// Also enforces the doc's numeric-11-digit, space-after-5th-digit format as the user types.
export default function PhoneField({ label, code, onCodeChange, value, onChange, placeholder }) {
  return (
    <div className="acc-field" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <select
          className="acc-select"
          style={{ width: 92, flexShrink: 0, paddingLeft: 8, paddingRight: 4 }}
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
        >
          {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <input
          className="acc-input"
          style={{ flex: 1 }}
          value={value}
          onChange={(e) => onChange(formatUkPhone(e.target.value))}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
