import React from 'react';
import YesNo from '../components/YesNo';

export default function TutorsVenuesStep({ acc, setAccField, onOtChange, setTutorCount, setTutorField }) {
  const otYes = acc.ot === 'yes';
  const ovYes = acc.ov === 'yes';
  const tutQualNo = otYes && acc.tutQual === 'no';
  const tutorCountMissing = otYes && (!Number.isInteger(Number(acc.otN)) || Number(acc.otN) < 1);
  const tutorRowsIncomplete = otYes && acc.tutors.some((t) => !t.fname || !t.surname || !/\S+@\S+\.\S+/.test(t.email));
  // Only nag once they've started answering - not on a still-untouched, freshly loaded step.
  const incomplete = !!acc.ot && (!acc.ov || (acc.ot === 'yes' && (acc.tutQual !== 'yes' || tutorRowsIncomplete)));

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
              <div style={{ border: '1.5px solid var(--brand-pink)', borderRadius: 10, padding: '13px 16px', margin: '10px 0 14px', fontSize: 13.5, lineHeight: 1.6, color: 'rgba(0,0,0,.62)' }}>
                In order to teach your courses, your tutor(s) must hold relevant qualifications in the subjects they will be teaching in.
              </div>
            )}
            <div style={{ paddingTop: 14 }}>
              <label style={{ display: 'block', fontSize: 12.5, color: 'rgba(0,0,0,.62)', marginBottom: 7, fontWeight: 600 }}>How many tutors will teach your courses?</label>
              <input
                className={`acc-input${tutorCountMissing ? ' input-error' : ''}`}
                style={{ width: 140 }}
                type="number"
                min="1"
                value={acc.otN}
                onChange={(e) => setTutorCount(e.target.value)}
                placeholder="e.g. 2"
                aria-invalid={tutorCountMissing}
                aria-describedby={tutorCountMissing ? 'tutor-count-error' : undefined}
              />
              {tutorCountMissing && <div id="tutor-count-error" className="acc-field-error">Enter the number of tutors before continuing.</div>}
            </div>
            {acc.tutors.length > 0 && (
              <div className="tutor-rows">
                {acc.tutors.map((t, i) => {
                  const rowInvalid = !t.fname || !t.surname || !/\S+@\S+\.\S+/.test(t.email);
                  return (
                    <div className="tutor-row" key={i}>
                      <div className="tutor-row-label">Tutor {i + 1}</div>
                      <div className="tutor-row-fields">
                        <input className="acc-input" value={t.fname} onChange={(e) => setTutorField(i, 'fname', e.target.value)} placeholder="First name" aria-label={`Tutor ${i + 1} first name`} />
                        <input className="acc-input" value={t.surname} onChange={(e) => setTutorField(i, 'surname', e.target.value)} placeholder="Surname" aria-label={`Tutor ${i + 1} surname`} />
                        <input className="acc-input" type="email" value={t.email} onChange={(e) => setTutorField(i, 'email', e.target.value)} placeholder="Email address" aria-label={`Tutor ${i + 1} email address`} />
                      </div>
                      {rowInvalid && t.fname && t.surname && t.email && <div className="acc-field-error">Enter a valid email address.</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        <div className="acc-yn-row" style={{ borderBottom: 'none', paddingBottom: 0, paddingTop: 14, borderTop: '1px solid #EEECF4' }}>
          <span className="acc-yn-text">Do you teach at venues other than the one previously registered in this application?</span>
          <YesNo value={acc.ov} onChange={(v) => setAccField('ov', v)} />
        </div>
        {ovYes && (
          <div style={{ marginTop: 14, padding: '13px 15px', background: 'var(--brand-pink-soft)', borderRadius: 10, fontSize: 13, color: 'rgba(0,0,0,.62)', lineHeight: 1.6 }}>
            You'll be able to add and pay for additional venues from your portal once this accreditation is verified.
          </div>
        )}
      </div>
      {incomplete && (
        <div style={{ fontSize: 13, color: 'var(--brand-pink)', fontWeight: 600 }}>Please complete the highlighted fields before continuing.</div>
      )}
    </>
  );
}
