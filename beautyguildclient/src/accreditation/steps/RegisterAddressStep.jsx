import React from 'react';
import { COUNTRIES, capitalizeFirst } from '../data';
import LoqateAddressLookup from '../components/LoqateAddressLookup';

// Matches the real Register flow's two-part Home Address screen: a postcode lookup first,
// then an editable confirm screen.
export default function RegisterAddressStep({ acc, setAddrField, setAccField, onManualEntry }) {
  const addr = acc.addr;

  if (!acc.addrLooked) {
    return (
      <div className="acc-account-shell">
        <div className="acc-step-heading">Home Address</div>
        <div className="acc-card">
          <div className="acc-card-title" style={{ color: '#E0007F' }}>Lookup Address</div>
          <div style={{ fontSize: 13.5, color: '#4A4760', marginBottom: 16 }}>
            You are searching in {addr.country}
          </div>
          <div className="acc-field">
            <label>Country</label>
            <select className="acc-select" value={addr.country} onChange={(e) => setAddrField('country', e.target.value)}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="acc-field" style={{ marginBottom: 0 }}>
            <label>Postcode</label>
            <LoqateAddressLookup value={addr.pc} onChange={(value) => setAddrField('pc', value)} onSelect={(address) => {
              Object.entries({ l1: address.addressLine1, l2: address.addressLine2, l3: address.addressLine3, town: address.town, county: address.county, pc: address.postcode, country: address.country }).forEach(([key, value]) => setAddrField(key, value || ''));
              setAccField('addrLooked', true);
            }} />
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#8A8598', lineHeight: 1.55 }}>
          If you're having issues finding your address automatically,{' '}
          <span style={{ color: '#E00879', fontWeight: 600, cursor: 'pointer' }} onClick={onManualEntry}>click here</span>{' '}
          to enter your details manually.
        </div>
      </div>
    );
  }

  return (
    <div className="acc-account-shell">
      <div className="acc-step-heading">Home Address</div>
      <div className="acc-card">
        <div className="acc-field">
          <label>Address</label>
          <input
            className="acc-input" value={addr.l1} onChange={(e) => setAddrField('l1', e.target.value)}
            onBlur={(e) => setAddrField('l1', capitalizeFirst(e.target.value))} style={{ marginBottom: 9 }}
          />
          <input
            className="acc-input" value={addr.l2} onChange={(e) => setAddrField('l2', e.target.value)}
            onBlur={(e) => setAddrField('l2', capitalizeFirst(e.target.value))} style={{ marginBottom: 9 }}
          />
          <input
            className="acc-input" value={addr.l3} onChange={(e) => setAddrField('l3', e.target.value)}
            onBlur={(e) => setAddrField('l3', capitalizeFirst(e.target.value))}
          />
        </div>
        <div className="acc-field">
          <label>Town</label>
          <input
            className="acc-input" value={addr.town} onChange={(e) => setAddrField('town', e.target.value)}
            onBlur={(e) => setAddrField('town', capitalizeFirst(e.target.value))}
          />
        </div>
        <div className="acc-field">
          <label>County</label>
          <input
            className="acc-input" value={addr.county} onChange={(e) => setAddrField('county', e.target.value)}
            onBlur={(e) => setAddrField('county', capitalizeFirst(e.target.value))}
          />
        </div>
        <div className="acc-field">
          <label>Postcode</label>
          <input className="acc-input" style={{ textTransform: 'uppercase' }} value={addr.pc} onChange={(e) => setAddrField('pc', e.target.value)} />
        </div>
        <div className="acc-field" style={{ marginBottom: 0 }}>
          <label>Country</label>
          <select className="acc-select" value={addr.country} onChange={(e) => setAddrField('country', e.target.value)}>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
