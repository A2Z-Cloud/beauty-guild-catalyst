import React, { useMemo, useState } from 'react';
import './Insurance.css';
import LoqateAddressLookup from '../accreditation/components/LoqateAddressLookup';
import { calculateInsuranceQuote, NON_SALON_EQUIPMENT, NON_SALON_EL, TREATMENT_EXTENSIONS, salonMedicalMalpractice } from './pricing';
import { evaluateInsuranceRules, RULE_STATUS } from './rules';
import { getQuoteDocuments, INSURANCE_LINKS } from './documents';
import { loadInsuranceDraft, saveInsuranceDraft } from './drafts';

const STEPS = ['About you', 'Your business', 'Your cover', 'Property', 'Important info', 'Your quote'];

const TERRITORY_COUNTRIES = {
  uk: 'United Kingdom',
  ci: 'Channel Islands',
  iom: 'Isle of Man',
  other: '',
};

const DECLARATIONS = [
  'Have you had any insurance claims or losses that may be relevant to this cover?',
  'Have you been declared bankrupt, insolvent or subject to a similar financial event?',
  'Are you aware of any circumstances that may give rise to a claim?',
  'Do you have any relevant criminal convictions or offences to declare?',
  'Have you ever had insurance declined, cancelled or accepted only on special terms?',
  'Are you over 18 and domiciled in the United Kingdom, Channel Islands or Isle of Man?',
  'Do you only provide services within the supported territories?',
];

const initialAddress = { l1: '', l2: '', l3: '', town: '', county: '', postcode: '', country: 'United Kingdom', lookedUp: false };

function territoryFromCountry(country = '') {
  const normalized = country.trim().toLowerCase();
  if (!normalized || normalized === 'united kingdom' || normalized === 'uk' || normalized === 'great britain') return 'uk';
  if (normalized.includes('channel island') || normalized === 'jersey' || normalized === 'guernsey') return 'ci';
  if (normalized === 'isle of man') return 'iom';
  return 'other';
}

function isAddressComplete(address) {
  return !!(address.l1.trim() && address.town.trim() && address.postcode.trim() && address.country.trim());
}

function initialState(contact) {
  const draftIdentity = contact?.email || null;
  const saved = draftIdentity ? loadInsuranceDraft(draftIdentity) : null;
  if (saved) return saved;
  const territory = territoryFromCountry(contact?.country);
  const country = contact?.country || TERRITORY_COUNTRIES[territory];
  return {
    step: 0,
    email: contact?.email || '',
    firstName: contact?.firstName || '',
    lastName: contact?.lastName || '',
    phone: contact?.mobile || contact?.phone || '',
    territory,
    address: {
      ...initialAddress,
      l1: contact?.addressLine1 || '',
      l2: contact?.addressLine2 || '',
      town: contact?.town || '',
      county: contact?.county || '',
      postcode: contact?.postcode || '',
      country,
      lookedUp: territory !== 'uk' || !!(contact?.addressLine1 || contact?.town),
    },
    workingFromHome: false,
    mobile: false,
    rentedRoom: false,
    subcontractor: false,
    salon: false,
    route: 'non_salon',
    turnover: 85000,
    wageRoll: 50000,
    salonCount: 1,
    employees: 0,
    subcontractors: 0,
    namedPeopleCover: false,
    treatmentExtensions: [],
    qualifiedForTreatments: null,
    patchTesting: null,
    teachingCover: 'none',
    equipmentTier: 0,
    standardConstruction: 'yes',
    nonStandardOver15: 'no',
    multipleAddresses: 'no',
    nonSalonEL: false,
    nonSalonELTier: 1,
    salonEL: false,
    contents: false,
    computers: 5000,
    equipment: 10000,
    stock: 5000,
    generalContents: 10000,
    tenantImprovements: 5000,
    rentPayable: 5000,
    moneyCover: false,
    buildingsCover: false,
    buildingsSI: 100000,
    fixturesSI: 25000,
    rentReceivableSI: 25000,
    biCover: false,
    biIncome: 50000,
    biDebts: 10000,
    propertyAwayCover: false,
    propertyAwaySI: 2000,
    premisesAddress: { ...initialAddress, country, lookedUp: territory !== 'uk' },
    floodHistory: 'no',
    basement: 'no',
    subsidenceHistory: 'no',
    declarations: Array(7).fill(null),
    informationAccurate: null,
    ethicsAccepted: null,
    demandsNeedsAccepted: null,
    nonAdvisedAccepted: null,
    paymentFrequency: 'annual',
  };
}

function ExternalLinks({ includeTreatments = false, includeEthics = false }) {
  const links = [INSURANCE_LINKS.terms, INSURANCE_LINKS.privacy];
  if (includeTreatments) links.push(INSURANCE_LINKS.treatments);
  if (includeEthics) links.push(INSURANCE_LINKS.ethics);
  return <div className="insurance-links">{links.map((item) => <a key={item.href} className="insurance-link" href={item.href} target="_blank" rel="noreferrer">{item.label}</a>)}</div>;
}

function YesNo({ value, onChange }) {
  return <div className="insurance-yesno">
    <button type="button" className={value === 'yes' ? 'active' : ''} onClick={() => onChange('yes')}>Yes</button>
    <button type="button" className={value === 'no' ? 'active' : ''} onClick={() => onChange('no')}>No</button>
  </div>;
}

function AddressBlock({ address, onChange, label = 'Address', manualOnly = false }) {
  const set = (key, value) => onChange({ ...address, [key]: value });
  return <div className="insurance-panel insurance-address-card">
    {!manualOnly && <>
      <div className="insurance-field">
        <label>{label} postcode or start typing the address</label>
        <LoqateAddressLookup
          value={address.postcode}
          onChange={(value) => set('postcode', value)}
          onSelect={(result) => onChange({
            ...address,
            l1: result.addressLine1 || '',
            l2: result.addressLine2 || '',
            l3: result.addressLine3 || '',
            town: result.town || '',
            county: result.county || '',
            postcode: result.postcode || '',
            country: result.country || 'United Kingdom',
            lookedUp: true,
          })}
        />
      </div>
      {!address.lookedUp && <button type="button" className="insurance-button link" onClick={() => set('lookedUp', true)}>Can't find the address? Enter it manually</button>}
    </>}
    {manualOnly && <div className="insurance-inline warn">UK address lookup is unavailable for this territory. Enter the full address manually.</div>}
    {(manualOnly || address.lookedUp) && <div className="insurance-grid-2 insurance-manual-address">
      <div className="insurance-field"><label>Address line 1</label><input className="insurance-input" value={address.l1} onChange={(e) => set('l1', e.target.value)} /></div>
      <div className="insurance-field"><label>Address line 2</label><input className="insurance-input" value={address.l2} onChange={(e) => set('l2', e.target.value)} /></div>
      <div className="insurance-field"><label>Town / city</label><input className="insurance-input" value={address.town} onChange={(e) => set('town', e.target.value)} /></div>
      <div className="insurance-field"><label>County</label><input className="insurance-input" value={address.county} onChange={(e) => set('county', e.target.value)} /></div>
      <div className="insurance-field"><label>Postcode</label><input className="insurance-input" value={address.postcode} onChange={(e) => set('postcode', manualOnly ? e.target.value : e.target.value.toUpperCase())} /></div>
      <div className="insurance-field"><label>Country</label><input className="insurance-input" value={address.country} onChange={(e) => set('country', e.target.value)} /></div>
    </div>}
  </div>;
}

function AboutStep({ state, setField }) {
  const changeTerritory = (territory) => {
    const country = TERRITORY_COUNTRIES[territory];
    setField('territory', territory);
    setField('address', { ...initialAddress, country, lookedUp: territory !== 'uk' });
    setField('premisesAddress', { ...initialAddress, country, lookedUp: territory !== 'uk' });
  };
  return <>
    <div className="insurance-step-heading">
      <div className="insurance-eyebrow">ABOUT YOU</div>
      <h2>Let's start with your details</h2>
      <p>Use your usual email address. We'll use it to match your Beauty Guild account or create one as part of the quotation journey.</p>
    </div>
    <div className="insurance-grid-2">
      <div className="insurance-field"><label>Email address</label><input className="insurance-input" type="email" value={state.email} onChange={(e) => setField('email', e.target.value)} /></div>
      <div className="insurance-field"><label>Phone number</label><input className="insurance-input" value={state.phone} onChange={(e) => setField('phone', e.target.value)} /></div>
      <div className="insurance-field"><label>First name</label><input className="insurance-input" value={state.firstName} onChange={(e) => setField('firstName', e.target.value)} /></div>
      <div className="insurance-field"><label>Last name</label><input className="insurance-input" value={state.lastName} onChange={(e) => setField('lastName', e.target.value)} /></div>
      <div className="insurance-field"><label>Country / territory</label><select className="insurance-select" value={state.territory} onChange={(e) => changeTerritory(e.target.value)}><option value="uk">United Kingdom</option><option value="ci">Channel Islands</option><option value="iom">Isle of Man</option><option value="other">Other</option></select></div>
    </div>
    <div className="insurance-inline ok">
      <strong>Your Beauty Guild account is part of this journey.</strong><br />
      We'll use your email to match an existing account or create the portal account you need to save and return to your quotation.
    </div>
    <div className="insurance-section"><AddressBlock address={state.address} onChange={(value) => setField('address', value)} label="Home" manualOnly={state.territory !== 'uk'} /></div>
  </>;
}

function BusinessStep({ state, setField }) {
  const choices = [
    ['workingFromHome', 'I work from home', 'Treatments are carried out from your home address.'],
    ['mobile', 'I work mobile', 'You travel to customers or different locations.'],
    ['rentedRoom', 'I rent a treatment room', 'You work from a room within another business.'],
    ['subcontractor', 'I work as a self-employed subcontractor', 'You provide services within another business.'],
    ['salon', 'I operate a salon from commercial / retail premises', 'This uses the Salon insurance route.'],
  ];
  const toggle = (key) => {
    const next = !state[key];
    setField(key, next);
    if (key === 'salon') setField('route', next ? 'salon' : 'non_salon');
  };
  return <>
    <div className="insurance-step-heading"><div className="insurance-eyebrow">YOUR BUSINESS</div><h2>How do you work?</h2><p>Select all that apply. Operating a salon from commercial or retail premises switches the quote to the Salon route.</p></div>
    <div className="insurance-choice-grid">
      {choices.map(([key, title, body]) => <label key={key} className={`insurance-choice ${state[key] ? 'selected' : ''}`}>
        <input type="checkbox" checked={!!state[key]} onChange={() => toggle(key)} />
        <span><strong>{title}</strong><small>{body}</small></span>
      </label>)}
    </div>
    {state.route === 'salon' && <div className="insurance-section">
      <div className="insurance-section-title"><h3>About your salon</h3><span>Online quotation limits apply</span></div>
      <div className="insurance-panel insurance-grid-2">
        <div className="insurance-field"><label>Annual turnover (£)</label><input className="insurance-input" type="number" value={state.turnover} onChange={(e) => setField('turnover', e.target.value)} /></div>
        <div className="insurance-field"><label>Gross annual wage roll (£)</label><input className="insurance-input" type="number" value={state.wageRoll} onChange={(e) => setField('wageRoll', e.target.value)} /></div>
        <div className="insurance-field"><label>Number of salons</label><input className="insurance-input" type="number" min="1" value={state.salonCount} onChange={(e) => setField('salonCount', e.target.value)} /></div>
      </div>
    </div>}
    <div className="insurance-section">
      <div className="insurance-section-title"><h3>People working in the business</h3><span>Named person cover is separate from Employers' Liability</span></div>
      <div className="insurance-panel insurance-grid-2">
        <div className="insurance-field"><label>Employees</label><input className="insurance-input" type="number" min="0" value={state.employees} onChange={(e) => setField('employees', e.target.value)} /></div>
        <div className="insurance-field"><label>Subcontractors</label><input className="insurance-input" type="number" min="0" value={state.subcontractors} onChange={(e) => setField('subcontractors', e.target.value)} /></div>
      </div>
    </div>
  </>;
}

function CoverStep({ state, setField }) {
  const toggleExtension = (id) => setField('treatmentExtensions', state.treatmentExtensions.includes(id) ? state.treatmentExtensions.filter((item) => item !== id) : [...state.treatmentExtensions, id]);
  const setBool = (key, value) => setField(key, value === 'yes');
  const corePrice = state.route === 'salon' ? salonMedicalMalpractice(state.turnover) : 32.5;
  return <>
    <div className="insurance-step-heading"><div className="insurance-eyebrow">YOUR COVER</div><h2>Build your cover</h2><p>The page expands only when you add cover that needs more information.</p></div>
    <div className="insurance-core-card">
      <div><strong>Medical Malpractice</strong><p>Core Beauty Guild treatment liability cover.</p></div>
      <div className="insurance-price">{corePrice == null ? 'Review' : `£${corePrice.toFixed(2)}`}</div>
    </div>
    <ExternalLinks includeTreatments />
    <div className="insurance-doc-row">
      <div><strong>Medical Malpractice Policy Wording</strong><small>Policy wording</small></div>
      <button type="button" className="insurance-button secondary" onClick={() => window.alert('The policy wording will open here in the live journey.')}>View / Download</button>
    </div>

    <div className="insurance-cover-row">
      <div className="insurance-cover-row-header"><div><h3>Named employee / subcontractor cover</h3><p>Separate cover for people working in your business.</p></div><YesNo value={state.namedPeopleCover ? 'yes' : 'no'} onChange={(v) => setBool('namedPeopleCover', v)} /></div>
    </div>

    <div className="insurance-cover-row">
      <div className="insurance-cover-row-header"><div><h3>Additional treatment extensions</h3><p>Add cover only for treatments you actually provide.</p></div></div>
      <div className="insurance-subpanel">
        <div className="insurance-choice-grid">
          {TREATMENT_EXTENSIONS.map((item) => <label key={item.id} className={`insurance-choice ${state.treatmentExtensions.includes(item.id) ? 'selected' : ''}`}>
            <input type="checkbox" checked={state.treatmentExtensions.includes(item.id)} onChange={() => toggleExtension(item.id)} />
            <span><strong>{item.name}</strong><small>£{item.premium.toFixed(2)} + IPT · <a className="insurance-link" href={INSURANCE_LINKS.treatments.href} target="_blank" rel="noreferrer">requirements</a></small></span>
          </label>)}
        </div>
        {!!state.treatmentExtensions.length && <div className="insurance-subpanel">
          <div className="insurance-cover-row-header"><div><h3>Do you and relevant employees hold the required qualifications?</h3></div><YesNo value={state.qualifiedForTreatments} onChange={(v) => setField('qualifiedForTreatments', v)} /></div>
          <div className="insurance-cover-row-header" style={{ marginTop: 12 }}><div><h3>Do you agree to carry out sensitivity patch tests for relevant treatments?</h3></div><YesNo value={state.patchTesting} onChange={(v) => setField('patchTesting', v)} /></div>
        </div>}
      </div>
    </div>

    <div className="insurance-cover-row">
      <div className="insurance-cover-row-header"><div><h3>Teaching cover</h3><p>For customers who teach students.</p></div></div>
      <div className="insurance-subpanel insurance-grid-2">
        <label className={`insurance-choice ${state.teachingCover === 'none' ? 'selected' : ''}`}><input type="radio" name="teaching" checked={state.teachingCover === 'none'} onChange={() => setField('teachingCover', 'none')} /><span><strong>Not required</strong></span></label>
        <label className={`insurance-choice ${state.teachingCover === 'standard' ? 'selected' : ''}`}><input type="radio" name="teaching" checked={state.teachingCover === 'standard'} onChange={() => setField('teachingCover', 'standard')} /><span><strong>Teaching + Student Cover</strong><small>£75 + IPT</small></span></label>
        <label className={`insurance-choice ${state.teachingCover === 'additional' ? 'selected' : ''}`}><input type="radio" name="teaching" checked={state.teachingCover === 'additional'} onChange={() => setField('teachingCover', 'additional')} /><span><strong>Teaching + Student + Additional Treatments</strong><small>£150 + IPT</small></span></label>
      </div>
    </div>

    {state.route === 'non_salon' ? <NonSalonCover state={state} setField={setField} /> : <SalonCover state={state} setField={setField} />}
  </>;
}

function NonSalonCover({ state, setField }) {
  return <>
    <div className="insurance-cover-row">
      <div className="insurance-cover-row-header"><div><h3>Business equipment</h3><p>Choose a fixed cover level.</p></div></div>
      <div className="insurance-subpanel">
        <div className="insurance-field"><label>Equipment cover</label><select className="insurance-select" value={state.equipmentTier} onChange={(e) => setField('equipmentTier', Number(e.target.value))}>{NON_SALON_EQUIPMENT.map((item) => <option key={item.value} value={item.value}>{item.label}{item.premium ? ` · £${item.premium}` : ''}</option>)}</select></div>
        {Number(state.equipmentTier) > 0 && <>
          <div className="insurance-grid-2">
            <div className="insurance-field"><label>Are the premises of standard construction?</label><select className="insurance-select" value={state.standardConstruction} onChange={(e) => setField('standardConstruction', e.target.value)}><option value="yes">Yes</option><option value="no">No</option></select></div>
            {state.standardConstruction === 'no' && <div className="insurance-field"><label>Is more than 15% non-standard construction?</label><select className="insurance-select" value={state.nonStandardOver15} onChange={(e) => setField('nonStandardOver15', e.target.value)}><option value="no">No</option><option value="yes">Yes</option></select></div>}
            <div className="insurance-field"><label>Do you need cover for multiple addresses?</label><select className="insurance-select" value={state.multipleAddresses} onChange={(e) => setField('multipleAddresses', e.target.value)}><option value="no">No</option><option value="yes">Yes</option></select></div>
          </div>
          <AddressBlock address={state.premisesAddress} onChange={(value) => setField('premisesAddress', value)} label="Business" manualOnly={state.territory !== 'uk'} />
        </>}
      </div>
    </div>
    <div className="insurance-cover-row">
      <div className="insurance-cover-row-header"><div><h3>Employers' Liability</h3><p>Separate from named employee cover.</p></div><YesNo value={state.nonSalonEL ? 'yes' : 'no'} onChange={(v) => setField('nonSalonEL', v === 'yes')} /></div>
      {state.nonSalonEL && <div className="insurance-subpanel"><div className="insurance-field"><label>Cover level</label><select className="insurance-select" value={state.nonSalonELTier} onChange={(e) => setField('nonSalonELTier', Number(e.target.value))}>{NON_SALON_EL.map((item) => <option key={item.value} value={item.value}>{item.label} · £{item.premium}</option>)}</select></div></div>}
    </div>
  </>;
}

function SalonCover({ state, setField }) {
  const dependent = state.contents;
  const boolRow = (key, title, copy) => <div className={`insurance-cover-row ${!dependent ? 'locked' : ''}`}>
    <div className="insurance-cover-row-header"><div><h3>{title}</h3><p>{copy}{!dependent ? ' Add Contents first.' : ''}</p></div><YesNo value={state[key] ? 'yes' : 'no'} onChange={(v) => dependent && setField(key, v === 'yes')} /></div>
    {dependent && state[key] && key === 'buildingsCover' && <div className="insurance-subpanel insurance-grid-2">
      <div className="insurance-field"><label>Buildings sum insured (£)</label><input className="insurance-input" type="number" value={state.buildingsSI} onChange={(e) => setField('buildingsSI', e.target.value)} /></div>
      <div className="insurance-field"><label>Fixtures & fittings (£)</label><input className="insurance-input" type="number" value={state.fixturesSI} onChange={(e) => setField('fixturesSI', e.target.value)} /></div>
      <div className="insurance-field"><label>Rent receivable (£)</label><input className="insurance-input" type="number" value={state.rentReceivableSI} onChange={(e) => setField('rentReceivableSI', e.target.value)} /></div>
    </div>}
    {dependent && state[key] && key === 'biCover' && <div className="insurance-subpanel insurance-grid-2">
      <div className="insurance-field"><label>Loss of income sum insured (£)</label><input className="insurance-input" type="number" value={state.biIncome} onChange={(e) => setField('biIncome', e.target.value)} /></div>
      <div className="insurance-field"><label>Outstanding debts sum insured (£)</label><input className="insurance-input" type="number" value={state.biDebts} onChange={(e) => setField('biDebts', e.target.value)} /></div>
    </div>}
    {dependent && state[key] && key === 'propertyAwayCover' && <div className="insurance-subpanel"><div className="insurance-field"><label>Property Away sum insured (£)</label><input className="insurance-input" type="number" value={state.propertyAwaySI} onChange={(e) => setField('propertyAwaySI', e.target.value)} /></div></div>}
  </div>;

  return <>
    <div className="insurance-cover-row"><div className="insurance-cover-row-header"><div><h3>Employers' Liability</h3><p>0.2% of wage roll, minimum £75.</p></div><YesNo value={state.salonEL ? 'yes' : 'no'} onChange={(v) => setField('salonEL', v === 'yes')} /></div></div>
    <div className="insurance-cover-row">
      <div className="insurance-cover-row-header"><div><h3>Contents</h3><p>Contents unlocks Money, Buildings, Business Interruption and Property Away.</p></div><YesNo value={state.contents ? 'yes' : 'no'} onChange={(v) => {
        const enabled = v === 'yes'; setField('contents', enabled);
        if (!enabled) ['moneyCover','buildingsCover','biCover','propertyAwayCover'].forEach((key) => setField(key, false));
      }} /></div>
      {state.contents && <div className="insurance-subpanel insurance-grid-2">
        {[['computers','Computers & ancillary'],['equipment','Beauty/styling equipment & tools'],['stock','Business stock'],['generalContents','General contents'],['tenantImprovements','Tenant improvements'],['rentPayable','Rent payable']].map(([key,label]) => <div className="insurance-field" key={key}><label>{label} (£)</label><input className="insurance-input" type="number" value={state[key]} onChange={(e) => setField(key, e.target.value)} /></div>)}
      </div>}
    </div>
    {boolRow('moneyCover', 'Money', 'Fixed premium £20.')}
    {boolRow('buildingsCover', 'Buildings', 'Buildings, fixtures/fittings and rent receivable.')}
    {boolRow('biCover', 'Business Interruption', 'Loss of income and outstanding debts.')}
    {boolRow('propertyAwayCover', 'Property Away', 'Property temporarily away from the salon premises.')}
  </>;
}

function PropertyStep({ state, setField }) {
  return <>
    <div className="insurance-step-heading"><div className="insurance-eyebrow">PROPERTY DETAILS</div><h2>Tell us about your premises</h2><p>We'll use these details, including your postcode, to check whether the property can be quoted online or needs review by the Insurance team.</p></div>
    <AddressBlock address={state.premisesAddress} onChange={(value) => setField('premisesAddress', value)} label="Premises" manualOnly={state.territory !== 'uk'} />
    <div className="insurance-grid-2 insurance-section">
      <div className="insurance-field"><label>Has the property previously suffered flooding?</label><select className="insurance-select" value={state.floodHistory} onChange={(e) => setField('floodHistory', e.target.value)}><option value="no">No</option><option value="yes">Yes</option></select></div>
      <div className="insurance-field"><label>Does the property have a basement?</label><select className="insurance-select" value={state.basement} onChange={(e) => setField('basement', e.target.value)}><option value="no">No</option><option value="yes">Yes</option></select></div>
      <div className="insurance-field"><label>Previous subsidence / landslip / structural movement?</label><select className="insurance-select" value={state.subsidenceHistory} onChange={(e) => setField('subsidenceHistory', e.target.value)}><option value="no">No</option><option value="yes">Yes</option></select></div>
    </div>
  </>;
}

function DeclarationStep({ state, setField }) {
  const setDeclaration = (index, value) => {
    const next = [...state.declarations]; next[index] = value; setField('declarations', next);
  };

  const selectedCoverLabels = [
    state.route === 'salon' ? 'Salon Medical Malpractice' : 'Medical Malpractice',
    state.namedPeopleCover ? 'named employee/subcontractor cover' : null,
    state.treatmentExtensions.length ? 'additional treatment extensions' : null,
    state.teachingCover !== 'none' ? 'teaching cover' : null,
    state.route === 'non_salon' && Number(state.equipmentTier) > 0 ? 'business equipment' : null,
    state.route === 'non_salon' && state.nonSalonEL ? "Employers' Liability" : null,
    state.route === 'salon' && state.salonEL ? "Employers' Liability" : null,
    state.route === 'salon' && state.contents ? 'Contents' : null,
    state.route === 'salon' && state.moneyCover ? 'Money' : null,
    state.route === 'salon' && state.buildingsCover ? 'Buildings' : null,
    state.route === 'salon' && state.biCover ? 'Business Interruption' : null,
    state.route === 'salon' && state.propertyAwayCover ? 'Property Away' : null,
  ].filter(Boolean);

  return <>
    <div className="insurance-step-heading"><div className="insurance-eyebrow">IMPORTANT INFORMATION</div><h2>Please answer these questions carefully</h2><p>Some answers may mean the Insurance team needs to review the quotation before cover can be confirmed.</p></div>
    <ExternalLinks includeEthics />
    <div className="insurance-section">
      {DECLARATIONS.map((question, index) => <div className="insurance-cover-row" key={question}><div className="insurance-cover-row-header"><div><h3>{question}</h3></div><YesNo value={state.declarations[index]} onChange={(v) => setDeclaration(index, v)} /></div></div>)}
    </div>

    <div className="insurance-section">
      <div className="insurance-section-title"><h3>Final confirmations</h3><span>Required before quotation completion</span></div>

      <div className="insurance-cover-row">
        <div className="insurance-cover-row-header"><div><h3>I confirm the information provided is complete and accurate.</h3><p>Incorrect or misleading information may affect or invalidate cover.</p></div><YesNo value={state.informationAccurate} onChange={(v) => setField('informationAccurate', v)} /></div>
      </div>

      <div className="insurance-cover-row">
        <div className="insurance-cover-row-header"><div><h3>I agree to comply with the Beauty Guild Code of Ethics.</h3><p><a className="insurance-link" href={INSURANCE_LINKS.ethics.href} target="_blank" rel="noreferrer">View Code of Ethics</a></p></div><YesNo value={state.ethicsAccepted} onChange={(v) => setField('ethicsAccepted', v)} /></div>
      </div>

      <div className="insurance-cover-row">
        <div className="insurance-cover-row-header"><div><h3>Demands and needs</h3><p>This quotation has been built for the cover selected: {selectedCoverLabels.join(', ')}.</p></div><YesNo value={state.demandsNeedsAccepted} onChange={(v) => setField('demandsNeedsAccepted', v)} /></div>
      </div>

      <div className="insurance-cover-row">
        <div className="insurance-cover-row-header"><div><h3>I understand this is a non-advised sale.</h3><p>No personal recommendation has been made about whether the selected insurance is suitable for me.</p></div><YesNo value={state.nonAdvisedAccepted} onChange={(v) => setField('nonAdvisedAccepted', v)} /></div>
      </div>
    </div>
  </>;
}

function QuoteStep({ state, quote, ruleResult, setField }) {
  const docs = getQuoteDocuments(state);
  if (ruleResult.overall !== RULE_STATUS.PASS) return <div className={`insurance-inline ${ruleResult.overall === RULE_STATUS.STOP ? 'stop' : 'warn'}`}>
    <strong>{ruleResult.overall === RULE_STATUS.STOP ? 'We cannot complete this quotation online.' : 'We need to review some details.'}</strong>
    <div style={{ marginTop: 8 }}>{[...ruleResult.stop, ...ruleResult.refer].map((item) => <div key={item.code}>• {item.customerMessage}</div>)}</div>
  </div>;

  return <>
    <div className="insurance-quote-hero"><div className="insurance-eyebrow">YOUR BEAUTY GUILD INSURANCE</div><div className="amount">£{quote.total.toFixed(2)}</div><div>Annual total · £{quote.monthly.toFixed(2)} monthly equivalent</div></div>
    <div className="insurance-panel">
      {quote.rows.map((row) => <div className="insurance-summary-row" key={row.code}><span>{row.label}</span><strong>£{row.premium.toFixed(2)}</strong></div>)}
      <div className="insurance-summary-row"><span>Insurance premium</span><strong>£{quote.net.toFixed(2)}</strong></div>
      <div className="insurance-summary-row"><span>Insurance Premium Tax (12%)</span><strong>£{quote.ipt.toFixed(2)}</strong></div>
      <div className="insurance-summary-row"><span><strong>Total</strong></span><strong>£{quote.total.toFixed(2)}</strong></div>
    </div>

    <div className="insurance-section">
      <div className="insurance-section-title"><h3>How would you like to pay?</h3><span>Monthly is currently annual total ÷ 12</span></div>
      <div className="insurance-choice-grid">
        <label className={`insurance-choice ${state.paymentFrequency === 'annual' ? 'selected' : ''}`}>
          <input type="radio" name="insurancePaymentFrequency" checked={state.paymentFrequency === 'annual'} onChange={() => setField('paymentFrequency', 'annual')} />
          <span><strong>Pay annually</strong><small>£{quote.total.toFixed(2)} per year</small></span>
        </label>
        <label className={`insurance-choice ${state.paymentFrequency === 'monthly' ? 'selected' : ''}`}>
          <input type="radio" name="insurancePaymentFrequency" checked={state.paymentFrequency === 'monthly'} onChange={() => setField('paymentFrequency', 'monthly')} />
          <span><strong>Pay monthly</strong><small>£{quote.monthly.toFixed(2)} per month</small></span>
        </label>
      </div>
    </div>

    <div className="insurance-section">
      <div className="insurance-section-title"><h3>Your policy documents</h3><span>Included with this quotation</span></div>
      {docs.map((doc) => <div className="insurance-doc-row" key={doc.code}><div><strong>{doc.name}</strong><small>Policy wording</small></div><button type="button" className="insurance-button secondary" onClick={() => window.alert('This document will open here in the live journey.')}>View / Download</button></div>)}
    </div>
    <div className="insurance-section">
      <div className="insurance-section-title"><h3>Generated after purchase</h3><span>Customer-specific documents</span></div>
      {['Insurance Schedule','Statement of Fact'].map((name) => <div className="insurance-doc-row" key={name}><div><strong>{name}</strong><small>Generated and stored against the purchased policy.</small></div><span>After purchase</span></div>)}
    </div>
  </>;
}

function ExitModal({ mode, publicEntry, onDismiss, onExit }) {
  if (!mode) return null;

  const saved = mode === 'saved';
  const failed = mode === 'error';
  const close = saved ? onExit : onDismiss;
  const title = saved ? 'Quotation saved' : failed ? "We couldn't save your quotation" : 'Exit without saving?';
  const body = saved
    ? 'Your progress has been saved on this device. You can continue the quotation when you return.'
    : failed
      ? 'Your progress could not be saved on this device. Please continue editing and try again.'
      : 'You have unsaved changes. If you exit now, those changes will be lost.';

  return <div className="insurance-modal-overlay" role="presentation" onClick={close}>
    <div className="insurance-modal" role="dialog" aria-modal="true" aria-labelledby="insurance-exit-title" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="insurance-modal-close" aria-label="Close" onClick={close}>×</button>
      <div className={`insurance-modal-icon ${saved ? 'saved' : failed ? 'error' : 'warning'}`} aria-hidden="true">{saved ? '✓' : '!'}</div>
      <h2 id="insurance-exit-title">{title}</h2>
      <p>{body}</p>
      <div className="insurance-modal-actions">
        {!saved && <button type="button" className="insurance-button secondary" onClick={onDismiss}>{failed ? 'Close' : 'Continue editing'}</button>}
        {!failed && <button type="button" className={`insurance-button ${saved ? 'primary' : 'danger'}`} onClick={onExit}>{saved ? (publicEntry ? 'Return to member login' : 'Return to dashboard') : 'Exit without saving'}</button>}
      </div>
    </div>
  </div>;
}

export default function InsuranceApp({ contact = null, publicEntry = false, onClose }) {
  const [state, setState] = useState(() => initialState(contact));
  const [isDirty, setIsDirty] = useState(false);
  const [exitModal, setExitModal] = useState(null);
  const setField = (key, value) => {
    setIsDirty(true);
    setState((prev) => ({ ...prev, [key]: value }));
  };
  const quote = useMemo(() => calculateInsuranceQuote(state), [state]);
  const ruleResult = useMemo(() => evaluateInsuranceRules(state), [state]);
  const propertyRequired = state.route === 'salon' && (state.contents || state.moneyCover || state.buildingsCover || state.biCover || state.propertyAwayCover);

  const canContinue = () => {
    if (ruleResult.stop.length) return false;
    if (state.step === 0) return !!(state.email && state.firstName && state.lastName && isAddressComplete(state.address));
    if (state.step === 1) return state.workingFromHome || state.mobile || state.rentedRoom || state.subcontractor || state.salon;
    if (state.step === 2 && state.treatmentExtensions.length) return !!(state.qualifiedForTreatments && state.patchTesting);
    if (state.step === 4) return state.declarations.every(Boolean)
      && state.informationAccurate === 'yes'
      && state.ethicsAccepted === 'yes'
      && state.demandsNeedsAccepted === 'yes'
      && state.nonAdvisedAccepted === 'yes';
    return true;
  };

  const go = (next) => {
    let target = next;
    if (target === 3 && state.step === 4 && !propertyRequired) target = 2;
    else if (target === 3 && !propertyRequired) target = 4;
    setField('step', Math.max(0, Math.min(5, target)));
  };

  const continueForward = () => {
    if (state.step === 0 && publicEntry && !contact?.email && state.email) {
      const saved = loadInsuranceDraft(state.email);
      const sameEmail = saved?.email?.trim().toLowerCase() === state.email.trim().toLowerCase();
      if (sameEmail && Number(saved.step) > 0) {
        setState(saved);
        return;
      }
    }
    go(state.step + 1);
  };

  const exitJourney = () => {
    setExitModal(null);
    if (onClose) onClose();
    else window.location.assign(window.location.pathname);
  };

  const saveAndExit = () => {
    const saved = saveInsuranceDraft(state, contact?.email || state.email || 'public');
    if (!saved) {
      setExitModal('error');
      return;
    }
    setIsDirty(false);
    setExitModal('saved');
  };

  const cancelJourney = () => {
    if (isDirty) setExitModal('cancel');
    else exitJourney();
  };

  const stepComponent = [
    <AboutStep state={state} setField={setField} />,
    <BusinessStep state={state} setField={setField} />,
    <CoverStep state={state} setField={setField} />,
    <PropertyStep state={state} setField={setField} />,
    <DeclarationStep state={state} setField={setField} />,
    <QuoteStep state={state} quote={quote} ruleResult={ruleResult} setField={setField} />,
  ][state.step];

  const inner = <>
    <div className="insurance-banner">
      <div className="insurance-eyebrow">BEAUTY GUILD INSURANCE</div>
      <h1>Insurance designed for beauty professionals</h1>
      <p>Build your quotation step by step. We'll only ask questions relevant to your business and selected cover.</p>
      <ExternalLinks includeTreatments />
    </div>
    <div className="insurance-shell">
      <div className="insurance-head"><div><div className="insurance-eyebrow">INSURANCE QUOTATION</div><h2>{STEPS[state.step]}</h2></div><button type="button" className="insurance-button link" disabled={!contact?.email && !state.email.trim()} title={!contact?.email && !state.email.trim() ? 'Enter your email address before saving.' : undefined} onClick={saveAndExit}>Save & exit</button></div>
      <div className="insurance-progress">{STEPS.map((label, index) => <div key={label} className={`insurance-progress-item ${index === state.step ? 'active' : ''} ${index < state.step ? 'complete' : ''}`}>{index + 1}. {label}</div>)}</div>
      <div className="insurance-workspace">
        <div className="insurance-content">{stepComponent}</div>
        <aside className="insurance-sidebar">
          <div className="insurance-eyebrow">LIVE QUOTE</div>
          <div className="insurance-summary-total">£{quote.total.toFixed(2)}</div>
          <small>£{quote.monthly.toFixed(2)} monthly equivalent</small>
          <div style={{ marginTop: 14 }}>{quote.rows.map((row) => <div className="insurance-summary-row" key={row.code}><span>{row.label}</span><strong>£{row.premium.toFixed(2)}</strong></div>)}</div>
          <div className={`insurance-inline ${ruleResult.overall === RULE_STATUS.PASS ? 'ok' : ruleResult.overall === RULE_STATUS.REFER ? 'warn' : 'stop'}`}>
            {ruleResult.overall === RULE_STATUS.PASS ? 'Your quotation can currently continue online.' : ruleResult.overall === RULE_STATUS.REFER ? 'Some details will need review before we can confirm your quotation.' : 'We cannot continue this quotation online with the current details.'}
          </div>
        </aside>
      </div>
      <div className="insurance-actions">
        <div><button type="button" className="insurance-button secondary" onClick={state.step === 0 ? cancelJourney : () => go(state.step - 1)}>{state.step === 0 ? 'Cancel' : '← Back'}</button></div>
        <div>
          {state.step < 5 ? <button type="button" className="insurance-button primary" disabled={!canContinue()} onClick={continueForward}>Continue →</button> :
            <button type="button" className="insurance-button primary" disabled={ruleResult.overall !== RULE_STATUS.PASS} onClick={() => window.alert('The payment step will open here in the completed journey.')}>Continue to payment →</button>}
        </div>
      </div>
    </div>
    <ExitModal mode={exitModal} publicEntry={publicEntry} onDismiss={() => setExitModal(null)} onExit={exitJourney} />
  </>;

  if (publicEntry) return <div className="insurance-public-shell insurance-root"><div className="insurance-public-header"><div className="insurance-wordmark">beauty<span>guild</span></div><button className="insurance-button secondary" type="button" onClick={() => window.location.assign(window.location.pathname)}>Member login</button></div><main className="insurance-page">{inner}</main></div>;

  return <div className="acc-body insurance-root" style={{ flexDirection: 'column', alignItems: 'stretch', width: '100%', overflowY: 'auto' }}><div style={{ width: '100%', maxWidth: 1120, margin: '0 auto', padding: '24px' }}>{inner}</div></div>;
}
