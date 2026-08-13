import React from 'react';

export default function AccreditationDone({ onDashboard }) {
  return (
    <div className="acc-done-screen">
      <div className="acc-done-icon">✓</div>
      <div className="acc-done-title">Application submitted!</div>
      <div className="acc-done-body">
        Your GTi accreditation application is under review. The Guild team will confirm within 1 working day.
        A confirmation email with your login details has been sent to your inbox.
      </div>
      <button type="button" className="acc-btn-primary" onClick={onDashboard}>Go to your dashboard →</button>
    </div>
  );
}
