import React from 'react';

export default function Modal({ modal, onClose }) {
  if (!modal) return null;
  return (
    <div className="acc-modal-overlay" onClick={onClose}>
      <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`acc-modal-icon${modal.saved ? ' saved' : ''}`}>{modal.saved ? '✓' : '⚠️'}</div>
        <div className="acc-modal-title">{modal.title}</div>
        <div className="acc-modal-body" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{modal.body}</div>
        <button type="button" className="acc-btn-primary" style={{ width: '100%' }} onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
