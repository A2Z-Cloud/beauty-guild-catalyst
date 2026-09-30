import React, { useMemo, useState } from 'react';
import './Insurance.css';
import LoqateAddressLookup from '../accreditation/components/LoqateAddressLookup';
import { calculateInsuranceQuote, NON_SALON_EQUIPMENT, NON_SALON_EL, TREATMENT_EXTENSIONS, salonMedicalMalpractice } from './pricing';
import { evaluateInsuranceRules, RULE_STATUS } from './rules';
import { getQuoteDocuments, INSURANCE_LINKS } from './documents';
import { loadInsuranceDraft, saveInsuranceDraft } from './drafts';

const STEPS = ['About you', 'Your business', 'Your cover', 'Property', 'Important info', 'Your quote'];

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

function initialState(contact) {
  const draftIdentity = contact?.email || 'public';
  const saved = loadInsuranceDraft(draftIdentity);
  if (saved) return saved;
  return {
    step: 0,
    email: contact?.email || '',
    firstName: contact?.firstName || '',
    lastName: contact?.lastName || '',
    phone: contact?.mobile || contact?.phone || '',
    territory: 'uk',
    address: {
      ...initialAddress,
      l1: contact?.addressLine1 || '',
      l2: contact?.addressLine2 || '',
      town: contact?.town || '',
      county: contact?.county || '',
      postcode: contact?.postcode || '',
      country: contact?.country || 'United Kingdom',
      lookedUp: !!(contact?.addressLine1 || contact?.town),
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
    premisesAddress: { ...initialAddress },
    floodHistory: 'no',
    basement: 'no',
    subsidenceHistory: 'no',
    declarations: Array(7).fill(null),
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

function AddressBlock({ address, onChange, label = 'Address' }) {
  const set = (key, value) => onChange({ ...address, [key]: value });
  return <div className="insurance-panel insurance-address-card">
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
    {address.lookedUp && <div className="insurance-grid-2">
      <div className="insurance-field"><label>Address line 1</label><input className="insurance-input" value={address.l1} onChange={(e) => set('l1', e.target.value)} /></div>
      <div className="insurance-field"><label>Address line 2</label><input className="insurance-input" value={address.l2} onChange={(e) => set('l2', e.target.value)} /></div>
      <div className="insurance-field"><label>Town / city</label><input className="insurance-input" value={address.town} onChange={(e) => set('town', e.target.value)} /></div>
      <div className="insurance-field"><label>County</label><input className="insurance-input" value={address.county} onChange={(e) => set('county', e.target.value)} /></div>
    </div>}
  </div>;
}

function AboutStep({ state, setField }) {
  return <>
    <div className="insurance-step-heading">
      <div className="insurance-eyebrow">ABOUT YOU</div>
      <h2>Let's start with your details</h2>
      <p>Use your usual email address. Existing Beauty Guild identities will be resolved automatically when the backend connection is enabled; new customers will be onboarded as part of the journey.</p>
    </div>
    <div className="insurance-grid-2">
      <div className="insurance-field"><label>Email address</label><input className="insurance-input" type="email" value={state.email} onChange={(e) => setField('email', e.target.value)} /></div>
      <div className="insurance-field"><label>Phone number</label><input className="insurance-input" value={state.phone} onChange={(e) => setField('phone', e.target.value)} /></div>
      <div className="insurance-field"><label>First name</label><input className="insurance-input" value={state.firstName} onChange={(e) => setField('firstName', e.target.value)} /></div>
      <div className="insurance-field"><label>Last name</label><input className="insurance-input" value={state.lastName} onChange={(e) => setField('lastName', e.target.value)} /></div>
      <div className="insurance-field"><label>Country / territory</label><select className="insurance-select" value={state.territory} onChange={(e) => setField('territory', e.target.value)}><option value="uk">United Kingdom</option><option value="ci">Channel Islands</option><option value="iom">Isle of Man</option><option value="other">Other</option></select></div>
    </div>
    <div className="insurance-inline ok">
      <strong>Your Beauty Guild account is part of this journey.</strong><br />
      When the backend phase is connected, this email will be matched to an existing Beauty Guild identity or used to create the portal account needed to save and return to the quotation. We will not ask the customer to decide which applies.
    </div>
    <div className="insurance-section"><AddressBlock address={state.address} onChange={(value) => setField('address', value)} label="Home" /></div>
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
      <div><strong>Medical Malpractice Policy Wording</strong><small>WorkDrive document placeholder · MEDMAL_WORDING</small></div>
      <button type="button" className="insurance-button secondary" onClick={() => window.alert('This policy wording will open from WorkDrive once document mapping is connected.')}>View / Download</button>
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
          <AddressBlock address={state.premisesAddress} onChange={(value) => setField('premisesAddress', value)} label="Business" />
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
    <div className="insurance-step-heading"><div className="insurance-eyebrow">PROPERTY DETAILS</div><h2>Tell us about your premises</h2><p>These answers feed the underwriting result. The production service will also check the flood and subsidence postcode exception datasets behind the scenes.</p></div>
    <AddressBlock address={state.premisesAddress} onChange={(value) => setField('premisesAddress', value)} label="Premises" />
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
  return <>
    <div className="insurance-step-heading"><div className="insurance-eyebrow">IMPORTANT INFORMATION</div><h2>Please answer these questions carefully</h2><p>Answers that need underwriting review will be captured without exposing internal rule codes to the customer.</p></div>
    <ExternalLinks includeEthics />
    <div className="insurance-section">
      {DECLARATIONS.map((question, index) => <div className="insurance-cover-row" key={question}><div className="insurance-cover-row-header"><div><h3>{question}</h3></div><YesNo value={state.declarations[index]} onChange={(v) => setDeclaration(index, v)} /></div></div>)}
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
      <div className="insurance-section-title"><h3>Your policy documents</h3><span>WorkDrive mapping comes next</span></div>
      {docs.map((doc) => <div className="insurance-doc-row" key={doc.code}><div><strong>{doc.name}</strong><small>{doc.code}</small></div><button type="button" className="insurance-button secondary" onClick={() => window.alert('WorkDrive document mapping will be connected in the backend phase.')}>View / Download</button></div>)}
    </div>
    <div className="insurance-section">
      <div className="insurance-section-title"><h3>Generated after purchase</h3><span>Customer-specific documents</span></div>
      {['Insurance Schedule','Statement of Fact'].map((name) => <div className="insurance-doc-row" key={name}><div><strong>{name}</strong><small>Generated and stored against the purchased policy.</small></div><span>After purchase</span></div>)}
    </div>
  </>;
}

export default function InsuranceApp({ contact = null, publicEntry = false, onClose }) {
  const [state, setState] = useState(() => initialState(contact));
  const setField = (key, value) => setState((prev) => ({ ...prev, [key]: value }));
  const quote = useMemo(() => calculateInsuranceQuote(state), [state]);
  const ruleResult = useMemo(() => evaluateInsuranceRules(state), [state]);
  const propertyRequired = state.route === 'salon' && (state.contents || state.moneyCover || state.buildingsCover || state.biCover || state.propertyAwayCover);

  const canContinue = () => {
    if (state.step === 0) return !!(state.email && state.firstName && state.lastName);
    if (state.step === 1) return state.workingFromHome || state.mobile || state.rentedRoom || state.subcontractor || state.salon;
    if (state.step === 4) return state.declarations.every(Boolean);
    return true;
  };

  const go = (next) => {
    let target = next;
    if (target === 3 && !propertyRequired) target = 4;
    if (target === 3 && state.step === 4 && !propertyRequired) target = 2;
    setField('step', Math.max(0, Math.min(5, target)));
  };

  const save = () => {
    saveInsuranceDraft(state, contact?.email || 'public');
    window.alert('Insurance quotation progress saved in this browser for the current frontend phase.');
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
      <div className="insurance-head"><div><div className="insurance-eyebrow">INSURANCE QUOTATION</div><h2>{STEPS[state.step]}</h2></div><button type="button" className="insurance-button link" onClick={save}>Save & exit</button></div>
      <div className="insurance-progress">{STEPS.map((label, index) => <div key={label} className={`insurance-progress-item ${index === state.step ? 'active' : ''} ${index < state.step ? 'complete' : ''}`}>{index + 1}. {label}</div>)}</div>
      <div className="insurance-workspace">
        <div className="insurance-content">{stepComponent}</div>
        <aside className="insurance-sidebar">
          <div className="insurance-eyebrow">LIVE QUOTE</div>
          <div className="insurance-summary-total">£{quote.total.toFixed(2)}</div>
          <small>£{quote.monthly.toFixed(2)} monthly equivalent</small>
          <div style={{ marginTop: 14 }}>{quote.rows.map((row) => <div className="insurance-summary-row" key={row.code}><span>{row.label}</span><strong>£{row.premium.toFixed(2)}</strong></div>)}</div>
          <div className={`insurance-inline ${ruleResult.overall === RULE_STATUS.PASS ? 'ok' : ruleResult.overall === RULE_STATUS.REFER ? 'warn' : 'stop'}`}>
            {ruleResult.overall === RULE_STATUS.PASS ? 'No current referral rule is triggered.' : ruleResult.overall === RULE_STATUS.REFER ? 'This quotation currently needs Insurance team review.' : 'A current answer prevents an online quotation.'}
          </div>
        </aside>
      </div>
      <div className="insurance-actions">
        <div><button type="button" className="insurance-button secondary" disabled={state.step === 0} onClick={() => go(state.step - 1)}>← Back</button></div>
        <div>
          {state.step < 5 ? <button type="button" className="insurance-button primary" disabled={!canContinue()} onClick={() => go(state.step + 1)}>Continue →</button> :
            <button type="button" className="insurance-button primary" disabled={ruleResult.overall !== RULE_STATUS.PASS} onClick={() => window.alert('Payment integration is intentionally deferred from this frontend build.')}>Continue to payment →</button>}
        </div>
      </div>
    </div>
  </>;

  if (publicEntry) return <div className="insurance-public-shell insurance-root"><div className="insurance-public-header"><div className="insurance-wordmark">beauty<span>guild</span></div><button className="insurance-button secondary" type="button" onClick={() => window.location.assign(window.location.pathname)}>Member login</button></div><main className="insurance-page">{inner}</main></div>;

  return <div className="acc-body insurance-root" style={{ flexDirection: 'column', alignItems: 'stretch', width: '100%', overflowY: 'auto' }}><div style={{ width: '100%', maxWidth: 1120, margin: '0 auto', padding: '24px' }}>{inner}</div></div>;
}
