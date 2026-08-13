import React from 'react';

export default function YesNo({ value, onChange }) {
  return (
    <div className="acc-yn-btns">
      <button
        type="button"
        className={`acc-yn-btn yes${value === 'yes' ? ' active' : ''}`}
        onClick={() => onChange('yes')}
      >
        Yes
      </button>
      <button
        type="button"
        className={`acc-yn-btn no${value === 'no' ? ' active' : ''}`}
        onClick={() => onChange('no')}
      >
        No
      </button>
    </div>
  );
}
