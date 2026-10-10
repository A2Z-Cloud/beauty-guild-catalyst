export const IPT_RATE = 0.12;

export const TREATMENT_EXTENSIONS = [
  {
    id: 'advanced_electrolysis', name: 'Advanced Electrolysis', premium: 28,
    requirements: "Advanced electrolysis level 1, including the removal and reduction of: dilated blood vessels, telangiectasia - dilated blood vessels near the surface of the skin, spider naevus - dilated blood vessels near the surface of the skin, campbell de morgans or cherry angiomas – blood spots, skin tags or papillomas, milia – small raised pearly white or yellowish bumps on the skin, warts - common warts, plane warts - smooth flat growth often yellow in colour, removal of hairs from moles, removal of moles or dermatosis papulosa nigra - benign skin lesions on dark skin. You must ensure that such treatment was included in your advanced electrolysis training course (NVQ Level 3 Beauty Therapy with a unit on advanced electrolysis or an equivalent qualification). You must ensure that you have obtained approval in writing from your client's General Practitioner, which is retained by you alongside the client's general record card, prior to the performance of any advanced electrolysis level 1 treatment for: warts, common warts, plane warts, removal of hairs from moles or removal of moles. If you require further clarification about your advanced electrolysis qualification, please email info@beautyguild.com",
  },
  {
    id: 'microneedling', name: 'Microneedling / Dermarolling', premium: 179.25,
    requirements: 'Also includes Nano-needling. Needle sizes can be used on the face up to 1.5 mm and needle sizes can be used on the body up to 3 mm. You must hold NVQ Level 3 Beauty Therapy or equivalent national qualification including A&P plus relevant manufacturer or supplier’s training certificate.',
  },
  {
    id: 'piercing', name: 'Nose / Cartilage Piercing', premium: 14.15,
    requirements: 'You must use only one of the following systems; Blomdahl Medical Ear Piercing System, Caress 2000, Coren, Inverness, Medisept, New Caflon Disposable, Perfex, Studex Ear Piercing System or Trips Sterile Guard. We can also cover piercing that is performed with a single-use, sterile cannula needle. You must also obtain written consent from the parent or guardian of any client aged under 16 prior to performing the treatment.',
  },
  {
    id: 'spmu', name: 'Microblading / SPMU / Micropigmentation', premium: 179.25,
    requirements: 'Microblading of the eyebrows. Semi-permanent make up and micropigmentation administered for the purposes of eyeliner, eyebrow, lip liner, full lip colour or areola. You must hold NVQ Level 3 or equivalent in Beauty Therapy or NVQ Level 3 or equivalent in Facial Electricals, including A&P plus relevant manufacturer or suppliers training certificate. You must ensure that: 1) your client has read and signed an appropriate consent form prior to their treatment of which you have stored on file, 2) you were qualified to perform treatments to the specific area being treated at the time of treatment and 3) you always use a single use, disposable and sterile instrument which you immediately dispose of into a sharps container following each treatment.',
  },
  {
    id: 'dermaplaning', name: 'Dermaplaning', premium: 179.25,
    requirements: 'For exfoliation on the skin and removal of fine hairs. You must hold NVQ Level 2 Beauty Therapy or equivalent UK accredited qualification including A&P plus relevant manufacturers or suppliers training certificate.',
  },
];

export const TEACHING_REQUIREMENTS = 'Cover will be provided for teaching and training provided you hold an acceptable teaching qualification and you are qualified in the treatment that you are teaching.';

export const NON_SALON_EQUIPMENT = [
  { value: 0, label: 'Not required', premium: 0 },
  { value: 5000, label: 'Up to £5,000', premium: 65 },
  { value: 10000, label: 'Up to £10,000', premium: 100 },
  { value: 15000, label: 'Up to £15,000', premium: 150 },
  { value: 20000, label: 'Up to £20,000', premium: 200 },
];

// Premises not of standard construction (but still at/under the 15% non-standard limit - over
// that is referred, not priced) are rated at 1.5x the standard-construction premium.
export const NON_SALON_EQUIPMENT_NON_STANDARD = [
  { value: 0, premium: 0 },
  { value: 5000, premium: 97.5 },
  { value: 10000, premium: 150 },
  { value: 15000, premium: 225 },
  { value: 20000, premium: 300 },
];

export const NON_SALON_EL = [
  { value: 1, label: 'Up to 1 employee', premium: 75 },
  { value: 3, label: 'Up to 3 employees', premium: 120 },
  { value: 5, label: 'Up to 5 employees', premium: 150 },
];

export function salonMedicalMalpractice(turnover) {
  const amount = Number(turnover || 0);
  if (amount <= 100000) return 75;
  if (amount <= 175000) return 100;
  if (amount <= 250000) return 150;
  return null;
}

function positive(value) {
  return Math.max(0, Number(value || 0));
}

export function calculateInsuranceQuote(state) {
  const rows = [];
  const add = (code, label, premium) => {
    const amount = Number(premium || 0);
    if (amount > 0) rows.push({ code, label, premium: amount });
  };

  if (state.route === 'salon') {
    add('MEDMAL', 'Medical Malpractice', salonMedicalMalpractice(state.turnover) || 0);
  } else {
    add('MEDMAL', 'Medical Malpractice', 32.5);
  }

  if (state.namedPeopleCover) {
    const namedPeople = state.namedPeople || [];
    const employeeCount = namedPeople.filter((person) => person.type === 'employee').length;
    const subcontractorCount = namedPeople.filter((person) => person.type === 'subcontractor').length;
    add('NAMED_EMPLOYEES', `Named employee cover (${employeeCount})`, employeeCount * 32.5);
    add('NAMED_SUBCONTRACTORS', `Named subcontractor cover (${subcontractorCount})`, subcontractorCount * 15);
  }

  (state.treatmentExtensions || []).forEach((id) => {
    const extension = TREATMENT_EXTENSIONS.find((item) => item.id === id);
    if (extension) add(`TREATMENT_${id.toUpperCase()}`, extension.name, extension.premium);
  });

  if (state.teachingCover === 'standard') add('TEACHING', 'Teaching + Student Cover', 75);
  if (state.teachingCover === 'additional') add('TEACHING_PLUS', 'Teaching + Student Cover + Additional Treatments', 150);

  if (state.route === 'non_salon') {
    const nonStandard = state.standardConstruction === 'no';
    const equipmentTable = nonStandard ? NON_SALON_EQUIPMENT_NON_STANDARD : NON_SALON_EQUIPMENT;
    const equipment = equipmentTable.find((item) => item.value === Number(state.equipmentTier));
    if (equipment) add('BUSINESS_EQUIPMENT', `Business Equipment${nonStandard ? ' (non-standard construction)' : ''}`, equipment.premium);
    if (state.nonSalonEL) {
      const el = NON_SALON_EL.find((item) => item.value === Number(state.nonSalonELTier));
      if (el) add('EMPLOYERS_LIABILITY', "Employers' Liability", el.premium);
    }
  } else {
    if (state.salonEL) add('EMPLOYERS_LIABILITY', "Employers' Liability", Math.max(positive(state.wageRoll) * 0.002, 75));

    if (state.contents) {
      const contentsPremium = Math.max(
        positive(state.computers) * 0.008 +
        positive(state.equipment) * 0.02 +
        positive(state.stock) * 0.008 +
        positive(state.generalContents) * 0.005 +
        positive(state.tenantImprovements) * 0.0015 +
        positive(state.rentPayable) * 0.0015,
        50,
      );
      add('CONTENTS', 'Contents', contentsPremium);
    }

    if (state.moneyCover) add('MONEY', 'Money', 20);

    if (state.buildingsCover) {
      const buildingsPremium = Math.max(
        positive(state.buildingsSI) * 0.0015 +
        positive(state.fixturesSI) * 0.0015 +
        positive(state.rentReceivableSI) * 0.0015,
        75,
      );
      add('BUILDINGS', 'Buildings', buildingsPremium);
    }

    if (state.biCover) {
      const biPremium = Math.max(
        positive(state.biIncome) * 0.0008 +
        positive(state.biDebts) * 0.0006,
        50,
      );
      add('BUSINESS_INTERRUPTION', 'Business Interruption', biPremium);
    }

    if (state.propertyAwayCover) {
      add('PROPERTY_AWAY', 'Property Away', Math.max(positive(state.propertyAwaySI) * 0.025, 50));
    }
  }

  const net = rows.reduce((sum, row) => sum + row.premium, 0);
  const ipt = net * IPT_RATE;
  return { rows, net, ipt, total: net + ipt, monthly: (net + ipt) / 12 };
}
