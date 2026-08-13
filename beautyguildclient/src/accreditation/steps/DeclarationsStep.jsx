import React from 'react';
import YesNo from '../components/YesNo';
import { ACC_DECLARATIONS, DECLARATION_MESSAGES } from '../data';

export default function DeclarationsStep({ acc, setDeclaration }) {
  const anyNo = acc.decls.some((v) => v === 'no');
  return (
    <>
      <div>
        <div className="acc-step-heading">Declarations</div>
        <div className="acc-step-sub">You must confirm all three declarations to proceed. Answering "No" will explain your next steps.</div>
      </div>
      <div className="acc-card">
        {ACC_DECLARATIONS.map((text, i) => {
          const msg = DECLARATION_MESSAGES[i];
          const showMsg = acc.decls[i] === 'no';
          return (
            <React.Fragment key={i}>
              <div className="acc-yn-row" style={showMsg ? { borderBottom: 'none', paddingBottom: 0 } : undefined}>
                <span className="acc-yn-text">{text}</span>
                <YesNo value={acc.decls[i]} onChange={(v) => setDeclaration(i, v)} />
              </div>
              {showMsg && (
                <div style={{ border: '1.5px solid #E0007F', borderRadius: 10, padding: '13px 16px', margin: '10px 0 14px', fontSize: 13.5, lineHeight: 1.6, color: '#4A4760' }}>
                  {msg.text}
                  {msg.linkText && (
                    <>
                      <span style={{ color: '#E00879', fontWeight: 600, cursor: 'pointer' }}>{msg.linkText}</span>.
                    </>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      {anyNo && (
        <div className="acc-warning">
          <div className="acc-warning-title">⚠ Unable to proceed</div>
          <div className="acc-warning-body">All declarations must be confirmed as "Yes" to apply for GTi accreditation.</div>
        </div>
      )}
    </>
  );
}
