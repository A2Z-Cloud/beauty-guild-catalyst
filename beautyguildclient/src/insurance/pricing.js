export const IPT_RATE = 0.12;

export const TREATMENT_EXTENSIONS = [
  { id: 'advanced_electrolysis', name: 'Advanced Electrolysis', premium: 28 },
  { id: 'microneedling', name: 'Microneedling / Dermarolling', premium: 179.25 },
  { id: 'piercing', name: 'Nose / Cartilage Piercing', premium: 14.15 },
  { id: 'spmu', name: 'Microblading / SPMU / Micropigmentation', premium: 179.25 },
  { id: 'dermaplaning', name: 'Dermaplaning', premium: 179.25 },
];

export const NON_SALON_EQUIPMENT = [
  { value: 0, label: 'Not required', premium: 0 },
  { value: 5000, label: 'Up to £5,000', premium: 65 },
  { value: 10000, label: 'Up to £10,000', premium: 100 },
  { value: 15000, label: 'Up to £15,000', premium: 150 },
  { value: 20000, label: 'Up to £20,000', premium: 200 },
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
    add('NAMED_EMPLOYEES', `Named employee cover (${positive(state.employees)})`, positive(state.employees) * 32.5);
    add('NAMED_SUBCONTRACTORS', `Named subcontractor cover (${positive(state.subcontractors)})`, positive(state.subcontractors) * 15);
  }

  (state.treatmentExtensions || []).forEach((id) => {
    const extension = TREATMENT_EXTENSIONS.find((item) => item.id === id);
    if (extension) add(`TREATMENT_${id.toUpperCase()}`, extension.name, extension.premium);
  });

  if (state.teachingCover === 'standard') add('TEACHING', 'Teaching + Student Cover', 75);
  if (state.teachingCover === 'additional') add('TEACHING_PLUS', 'Teaching + Student Cover + Additional Treatments', 150);

  if (state.route === 'non_salon') {
    const equipment = NON_SALON_EQUIPMENT.find((item) => item.value === Number(state.equipmentTier));
    if (equipment) add('BUSINESS_EQUIPMENT', 'Business Equipment', equipment.premium);
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
