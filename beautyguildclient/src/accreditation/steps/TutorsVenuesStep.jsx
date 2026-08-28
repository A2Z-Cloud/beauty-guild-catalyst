import React from 'react';
import YesNo from '../components/YesNo';

export default function TutorsVenuesStep({ acc, setAccField, onOtChange }) {
  const otYes = acc.ot === 'yes';
  const ovYes = acc.ov === 'yes';
  const tutQualNo = otYes && acc.tutQual === 'no';
  const tutorCountMissing = otYes && (!Number.isInteger(Number(acc.otN)) || Number(acc.otN) < 1);
  // Only nag once they've started answering - not on a still-untouched, freshly loaded step.
  const incomplete = !!acc.ot && (!acc.ov || (acc.ot === 'yes' && acc.tutQual !== 'yes'));

  return (
    <>
      <div>
        <div className="acc-step-heading">Accreditation Questions</div>
        <div className="acc-step-sub">Please answer the following questions:</div>
      </div>
      <div className="acc-card">
        <div className="acc-yn-row">
          <span className="acc-yn-text">Do you employ or engage any other tutors to teach your courses?</span>
          <YesNo value={acc.ot} onChange={onOtChange} />
        </div>
        {otYes && (
          <>
            <div className="acc-yn-row" style={tutQualNo ? { borderBottom: 'none', paddingBottom: 0 } : undefined}>
              <span className="acc-yn-text">I can confirm my tutor(s) hold the relevant qualifications in the subjects they will be teaching and have held these qualifications for at least 6 months.</span>
              <YesNo value={acc.tutQual} onChange={(v) => setAccField('tutQual', v)} />
            </div>
            {tutQualNo && (
              <div style={{ border: '1.5px solid #E0007F', borderRadius: 10, padding: '13px 16px', margin: '10px 0 14px', fontSize: 13.5, lineHeight: 1.6, color: '#4A4760' }}>
                In order to teach your courses, your tutor(s) must hold relevant qualifications in the subjects they will be teaching in.
              </div>
            )}
            <div style={{ paddingTop: 14 }}>
              <label style={{ display: 'block', fontSize: 12.5, color: '#4A4760', marginBottom: 7, fontWeight: 600 }}>How many tutors will teach your courses?</label>
              <input
                className={`acc-input${tutorCountMissing ? ' input-error' : ''}`}
                style={{ width: 140 }}
                type="number"
                min="1"
                value={acc.otN}
                onChange={(e) => setAccField('otN', e.target.value)}
                placeholder="e.g. 2"
                aria-invalid={tutorCountMissing}
                aria-describedby={tutorCountMissing ? 'tutor-count-error' : undefined}
              />
              {tutorCountMissing && <div id="tutor-count-error" className="acc-field-error">Enter the number of tutors before continuing.</div>}
            </div>
          </>
        )}
        <div className="acc-yn-row" style={{ borderBottom: 'none', paddingBottom: 0, paddingTop: 14, borderTop: '1px solid #EEECF4' }}>
          <span className="acc-yn-text">Do you teach at venues other than the one previously registered in this application?</span>
          <YesNo value={acc.ov} onChange={(v) => setAccField('ov', v)} />
        </div>
        {ovYes && (
          <div style={{ marginTop: 14, padding: '13px 15px', background: '#F6F5FA', borderRadius: 10, fontSize: 13, color: '#4A4760', lineHeight: 1.6 }}>
            You'll be able to add and pay for additional venues from your portal once this accreditation is verified.
          </div>
        )}
      </div>
      {incomplete && (
        <div style={{ fontSize: 13, color: '#E0007F', fontWeight: 600 }}>Please complete the highlighted fields before continuing.</div>
      )}
    </>
  );
}
