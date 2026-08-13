import React, { useEffect } from 'react';
import { COUNTRIES, capitalizeFirst } from '../data';
import PhoneField from '../components/PhoneField';
import LoqateAddressLookup from '../components/LoqateAddressLookup';

export default function SchoolStep({ acc, setSchField, setAccField, copyCorrToSch, onManualEntry }) {
  const sch = acc.sch;

  // Contact Name is pre-populated from "Your details" automatically - no button needed for this one field.
  useEffect(() => {
    if (!sch.contact) {
      const name = [acc.title, acc.fname, acc.surname].filter(Boolean).join(' ').trim();
      if (name) setSchField('contact', name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div>
        <div className="acc-step-heading">Training School Address and Details</div>
        <div className="acc-step-sub">Please enter your school's details to proceed.</div>
      </div>
      <div className="acc-card">
        <button
          type="button"
          onClick={copyCorrToSch}
          style={{ background: '#fff', color: '#0B5FFF', border: '1.5px solid #DCD9E8', padding: '9px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', borderRadius: 9, marginBottom: 18 }}
        >
          Use home address
        </button>

        <div className="acc-field">
          <label>Country</label>
          <select className="acc-select" value={sch.country} onChange={(e) => setSchField('country', e.target.value)}>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="acc-field">
          <label>Contact Name</label>
          <input className="acc-input" value={sch.contact} onChange={(e) => setSchField('contact', e.target.value)} />
        </div>
        <div className="acc-field" style={{ marginBottom: acc.schLooked ? 16 : 0 }}>
          <label>School Name</label>
          <input className="acc-input" value={sch.name} onChange={(e) => setSchField('name', e.target.value)} placeholder="e.g. Tega Beauty Academy" />
        </div>

        {!acc.schLooked && (
          <>
            <div style={{ fontSize: 13, color: '#4A4760', margin: '18px 0 12px' }}>
              Please select a country before using the postcode search facility. To use the postcode search, enter your postcode below and click search.{' '}
              <span style={{ color: '#E00879', fontWeight: 600, cursor: 'pointer' }} onClick={onManualEntry}>Click here</span> to enter your address manually.
            </div>
            <div className="acc-field" style={{ marginBottom: 0 }}>
              <label>Postcode</label>
              <LoqateAddressLookup value={sch.pc} onChange={(value) => setSchField('pc', value)} onSelect={(address) => {
                Object.entries({ l1: address.addressLine1, l2: address.addressLine2, l3: address.addressLine3, town: address.town, county: address.county, pc: address.postcode, country: address.country }).forEach(([key, value]) => setSchField(key, value || ''));
                setAccField('schLooked', true);
              }} />
            </div>
          </>
        )}

        {acc.schLooked && (
          <>
            <div className="acc-field">
              <label>Address Line 1</label>
              <input
                className="acc-input" value={sch.l1} onChange={(e) => setSchField('l1', e.target.value)}
                onBlur={(e) => setSchField('l1', capitalizeFirst(e.target.value))}
              />
            </div>
            <div className="acc-field">
              <label>Address Line 2</label>
              <input
                className="acc-input" value={sch.l2} onChange={(e) => setSchField('l2', e.target.value)}
                onBlur={(e) => setSchField('l2', capitalizeFirst(e.target.value))}
              />
            </div>
            <div className="acc-field">
              <label>Address Line 3</label>
              <input
                className="acc-input" value={sch.l3} onChange={(e) => setSchField('l3', e.target.value)}
                onBlur={(e) => setSchField('l3', capitalizeFirst(e.target.value))}
              />
            </div>
            <div className="acc-field">
              <label>Town</label>
              <input
                className="acc-input" value={sch.town} onChange={(e) => setSchField('town', e.target.value)}
                onBlur={(e) => setSchField('town', capitalizeFirst(e.target.value))}
              />
            </div>
            <div className="acc-field">
              <label>County</label>
              <input
                className="acc-input" value={sch.county} onChange={(e) => setSchField('county', e.target.value)}
                onBlur={(e) => setSchField('county', capitalizeFirst(e.target.value))}
              />
            </div>
            <div className="acc-field">
              <label>Postcode</label>
              <input className="acc-input" style={{ textTransform: 'uppercase' }} value={sch.pc} onChange={(e) => setSchField('pc', e.target.value)} />
            </div>
            <PhoneField
              label="Phone"
              code={sch.phoneCode}
              onCodeChange={(v) => setSchField('phoneCode', v)}
              value={sch.phone}
              onChange={(v) => setSchField('phone', v)}
              placeholder="01332 000000"
            />
            <div style={{ height: 14 }} />
            <PhoneField
              label="Mobile"
              code={sch.mobileCode}
              onCodeChange={(v) => setSchField('mobileCode', v)}
              value={sch.mobile}
              onChange={(v) => setSchField('mobile', v)}
              placeholder="07700 000000"
            />
            <div className="acc-field" style={{ marginTop: 16, marginBottom: 0 }}>
              <label>Email</label>
              <input className="acc-input" value={sch.email} onChange={(e) => setSchField('email', e.target.value)} placeholder="centre@example.com" />
            </div>
          </>
        )}
      </div>
    </>
  );
}
