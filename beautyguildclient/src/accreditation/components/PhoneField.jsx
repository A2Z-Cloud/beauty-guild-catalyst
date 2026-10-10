import React, { useEffect, useRef, useState } from 'react';
import { COUNTRY_CODES, formatUkPhone } from '../data';
import { useFlagSprite } from './FlagSprite';

// A phone/mobile input with a country-code dropdown, defaulting to the UK - per the field
// mapping doc's "drop down box for country code within the field, defaulting to the UK".
// Also enforces the doc's numeric-11-digit, space-after-5th-digit format as the user types.
//
// This is a custom dropdown rather than a native <select> because a native <option> can only
// render plain text - the Unicode flag emoji in COUNTRY_CODES' labels fall back to showing
// their underlying two-letter code (e.g. "GB") on platforms without a flag-capable font,
// Windows browsers being the common case. Real flag SVGs sidestep that entirely.
//
// Flags are drawn from a single sprite (public/flags-sprite.svg, generated from the
// flag-icons package's per-country SVGs) rather than that package's own CSS, which imports
// one file per flag (500+ assets including regional variants) - Catalyst's deploy zip has a
// file-count limit that a single extra flag-icons import blew straight through.
//
// The sprite is fetched once and injected into this document (see FlagSprite.jsx) rather than
// referenced as an external file - with 200+ <use> elements on one page, Chrome doesn't
// reliably re-render every instance once an external sprite finishes loading, which is exactly
// the "some flags never show up" symptom. Until the sprite's actually in the DOM, render a
// blank placeholder of the same size instead of a <use> pointing at nothing.
function Flag({ iso }) {
  const spriteReady = useFlagSprite();
  if (!spriteReady) return <span className="acc-flag" aria-hidden="true" />;
  return (
    <svg className="acc-flag" aria-hidden="true" viewBox="0 0 640 480">
      <use href={`#flag-${iso}`} />
    </svg>
  );
}
export default function PhoneField({ label, code, onCodeChange, value, onChange, placeholder, error }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = COUNTRY_CODES.find((c) => c.code === code) || COUNTRY_CODES[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="acc-field" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="acc-dial-code" ref={rootRef}>
          <button
            type="button"
            className="acc-select acc-dial-code-trigger"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <Flag iso={selected.iso} />
            <span>{selected.code}</span>
          </button>
          {open && (
            <ul className="acc-dial-code-menu" role="listbox">
              {COUNTRY_CODES.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.code === code}
                    className={`acc-dial-code-option${c.code === code ? ' is-selected' : ''}`}
                    onClick={() => { onCodeChange(c.code); setOpen(false); }}
                  >
                    <Flag iso={c.iso} />
                    <span>{c.code}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          className={`acc-input${error ? ' input-error' : ''}`}
          style={{ flex: 1 }}
          value={value}
          onChange={(e) => onChange(formatUkPhone(e.target.value))}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
