import React from 'react';
import { STEP_LABELS } from '../data';

export default function StepProgress({ current, labels = STEP_LABELS }) {
  return (
    <div className="acc-steps">
      <div className="acc-steps-row">
        {labels.map((label, i) => {
          const done = i < current;
          const isCurrent = i === current;
          const state = done ? 'done' : isCurrent ? 'current' : 'upcoming';
          return (
            <React.Fragment key={label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                <div className={`acc-step-dot ${state}`}>{done ? '✓' : i + 1}</div>
                <span className={`acc-step-label${isCurrent ? ' current' : ''}`}>{label}</span>
              </div>
              {i < labels.length - 1 && (
                <div className={`acc-step-line${done ? ' done' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
