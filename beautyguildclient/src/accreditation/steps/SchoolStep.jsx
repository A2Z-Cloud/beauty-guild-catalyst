import React, { useEffect } from 'react';
import { COUNTRIES, COUNTRY_META, countryOptionLabel, capitalizeFirst } from '../data';
import PhoneField from '../components/PhoneField';
import LoqateAddressLookup from '../components/LoqateAddressLookup';

export default function SchoolStep({ acc, setSchField, setAccField, copyCorrToSch, onManualEntry }) {
  const sch = acc.sch;
  const isUK = sch.country === 'United Kingdom';
  // Non-UK addresses have no postcode-lookup equivalent here, so the manual fields show
  // immediately rather than waiting for an "enter manually" click that only makes sense
  // for the UK/Loqate flow - without this, a non-UK school looked stuck on a postcode
  // lookup that could never return a result.
  const showManualFields = !isUK || acc.schLooked;

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
          className="acc-copy-address"
        >
          Use home address
        </button>
        <div className="copy-address-note">Copies your correspondence address into the training centre fields. You can edit it afterwards.</div>

        <div className="acc-field">
          <label>Country</label>
          <select
            className="acc-select"
            value={sch.country}
            onChange={(e) => {
              const value = e.target.value;
              setSchField('country', value);
              // Ties the phone/mobile dial-code selectors to whichever country is chosen
              // here, rather than always leaving them on the UK default.
              const dial = COUNTRY_META[value]?.dial;
              if (dial) {
                setSchField('phoneCode', dial);
                setSchField('mobileCode', dial);
              }
            }}
          >
            {COUNTRIES.map((c) => <option key={c} value={c}>{countryOptionLabel(c)}</option>)}
          </select>
        </div>
        <div className="acc-field">
          <label>Contact Name</label>
          <input className="acc-input" value={sch.contact} onChange={(e) => setSchField('contact', e.target.value)} />
        </div>
        <div className="acc-field" style={{ marginBottom: showManualFields ? 16 : 0 }}>
          <label>School Name *</label>
          <input className="acc-input" value={sch.name} onChange={(e) => setSchField('name', e.target.value)} placeholder="Your Training School Name" />
        </div>

        {isUK && !acc.schLooked && (
          <>
            <div className="address-lookup-intro">
              <span>Enter the training centre postcode to find its address.</span>
              <button type="button" className="text-action" onClick={onManualEntry}>Enter address manually</button>
            </div>
            <div className="acc-field" style={{ marginBottom: 0 }}>
              <label>Postcode or start typing your address</label>
              <LoqateAddressLookup value={sch.pc} onChange={(value) => setSchField('pc', value)} onSelect={(address) => {
                Object.entries({ l1: address.addressLine1, l2: address.addressLine2, l3: address.addressLine3, town: address.town, county: address.county, pc: address.postcode, country: address.country }).forEach(([key, value]) => setSchField(key, value || ''));
                setAccField('schLooked', true);
              }} />
            </div>
          </>
        )}

        {showManualFields && (
          <>
            <div className="acc-field">
              <label>Address Line 1 *</label>
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
              <label>Town *</label>
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
              <input className="acc-input" style={isUK ? { textTransform: 'uppercase' } : undefined} value={sch.pc} onChange={(e) => setSchField('pc', e.target.value)} />
            </div>
            <PhoneField
              label="Phone"
              code={sch.phoneCode}
              onCodeChange={(v) => setSchField('phoneCode', v)}
              value={sch.phone}
              onChange={(v) => setSchField('phone', v)}
              placeholder="e.g. 01332 000000"
            />
            <div style={{ height: 14 }} />
            <PhoneField
              label="Mobile *"
              code={sch.mobileCode}
              onCodeChange={(v) => setSchField('mobileCode', v)}
              value={sch.mobile}
              onChange={(v) => setSchField('mobile', v)}
              placeholder="e.g. 07700 000000"
            />
            <div className="acc-field" style={{ marginTop: 16, marginBottom: 0 }}>
              <label>Email *</label>
              <input className="acc-input" value={sch.email} onChange={(e) => setSchField('email', e.target.value)} placeholder="e.g. centre@example.com" />
            </div>
          </>
        )}
      </div>
    </>
  );
}
