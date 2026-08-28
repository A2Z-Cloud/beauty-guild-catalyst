import React from 'react';
import { COUNTRIES, capitalizeFirst } from '../data';
import LoqateAddressLookup from '../components/LoqateAddressLookup';

export default function AddressStep({ acc, setAddrField, setAccField }) {
  const addr = acc.addr;
  return (
    <>
      <div>
        <div className="acc-step-heading">Correspondence address</div>
        <div className="acc-step-sub">Your main contact address. In the UK, enter your postcode to look up the address.</div>
      </div>
      <div className="acc-card">
        <div className="acc-field">
          <label>Country</label>
          <select className="acc-select" value={addr.country} onChange={(e) => setAddrField('country', e.target.value)}>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="acc-field">
          <label>Postcode</label>
          <LoqateAddressLookup value={addr.pc} onChange={(value) => setAddrField('pc', value)} onSelect={(address) => {
            Object.entries({ l1: address.addressLine1, l2: address.addressLine2, l3: address.addressLine3, town: address.town, county: address.county, pc: address.postcode, country: address.country }).forEach(([key, value]) => setAddrField(key, value || ''));
            setAccField('addrLooked', true);
          }} />
        </div>
        {acc.addrLooked && (
          <>
            <div className="acc-field">
              <label>Address line 1</label>
              <input
                className="acc-input" value={addr.l1} onChange={(e) => setAddrField('l1', e.target.value)}
                onBlur={(e) => setAddrField('l1', capitalizeFirst(e.target.value))}
              />
            </div>
            <div className="acc-field">
              <label>Address line 2 <span style={{ color: '#A5A0B5', fontWeight: 400 }}>(optional)</span></label>
              <input
                className="acc-input" value={addr.l2} onChange={(e) => setAddrField('l2', e.target.value)}
                onBlur={(e) => setAddrField('l2', capitalizeFirst(e.target.value))}
              />
            </div>
            <div className="acc-grid-2">
              <div className="acc-field" style={{ marginBottom: 0 }}>
                <label>Town / city</label>
                <input
                  className="acc-input" value={addr.town} onChange={(e) => setAddrField('town', e.target.value)}
                  onBlur={(e) => setAddrField('town', capitalizeFirst(e.target.value))}
                />
              </div>
              <div className="acc-field" style={{ marginBottom: 0 }}>
                <label>County</label>
                <input
                  className="acc-input" value={addr.county} onChange={(e) => setAddrField('county', e.target.value)}
                  onBlur={(e) => setAddrField('county', capitalizeFirst(e.target.value))}
                />
              </div>
            </div>
          </>
        )}
      </div>
      {!acc.addrLooked && (
        <div className="address-manual-row">
          <span>Can't find the address?</span>
          <button type="button" className="text-action" onClick={() => setAccField('addrLooked', true)}>Enter address manually</button>
        </div>
      )}
    </>
  );
}
