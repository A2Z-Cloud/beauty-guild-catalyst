import React from 'react';
import { STEP_LABELS } from '../data';

export default function StepProgress({ current, labels = STEP_LABELS, title = 'New accreditation', context }) {
  const progress = labels.length > 1 ? (current / (labels.length - 1)) * 100 : 100;
  return (
    <div className="acc-steps">
      <div className="acc-progress-heading">
        <div>
          <span className="portal-eyebrow">APPLICATION</span>
          <strong>{title}</strong>
          {context && <span className="acc-progress-context">{context}</span>}
        </div>
        <span className="acc-progress-count">Step {current + 1} of {labels.length}</span>
      </div>
      <div className="acc-progress-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
      <ol className="acc-steps-row" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }} aria-label="Application progress">
        {labels.map((label, i) => {
          const done = i < current;
          const isCurrent = i === current;
          const state = done ? 'done' : isCurrent ? 'current' : 'upcoming';
          return (
            <li key={label} className={`acc-step-item ${state}`} aria-current={isCurrent ? 'step' : undefined} title={label}>
              <span className={`acc-step-dot ${state}`}>{done ? '✓' : i + 1}</span>
              <span className={`acc-step-label${isCurrent ? ' current' : ''}`}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
