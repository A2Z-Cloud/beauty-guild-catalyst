import React from 'react';
import { STEP_LABELS } from '../data';

export default function StepProgress({ current }) {
  return (
    <div className="acc-steps">
      <div className="acc-steps-row">
        {STEP_LABELS.map((label, i) => {
          const done = i < current;
          const isCurrent = i === current;
          const state = done ? 'done' : isCurrent ? 'current' : 'upcoming';
          return (
            <React.Fragment key={label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                <div className={`acc-step-dot ${state}`}>{done ? '✓' : i + 1}</div>
                <span className={`acc-step-label${isCurrent ? ' current' : ''}`}>{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`acc-step-line${done ? ' done' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
