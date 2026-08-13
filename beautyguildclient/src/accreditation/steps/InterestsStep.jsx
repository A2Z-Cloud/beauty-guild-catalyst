import React from 'react';
import { INTERESTS } from '../data';

export default function InterestsStep({ acc, toggleInterest }) {
  return (
    <>
      <div>
        <div className="acc-step-heading">Your interests</div>
        <div className="acc-step-sub">Which areas do you work in? Select at least one. Training is pre-selected for your accreditation.</div>
      </div>
      <div className="acc-card">
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
              {label === 'Training' && <span className="acc-note-pill">Required for accreditation</span>}
            </label>
          );
        })}
      </div>
    </>
  );
}
