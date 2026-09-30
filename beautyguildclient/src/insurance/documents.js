export const INSURANCE_LINKS = {
  terms: { label: 'Terms of Business', href: 'https://www.beautyguild.com/Legal/Terms-Of-Business' },
  privacy: { label: 'Privacy Policy', href: 'https://www.beautyguild.com/Legal/Privacy' },
  treatments: { label: 'Treatments We Cover', href: 'https://www.beautyguild.com/Membership/Treatments-We-Cover' },
  ethics: { label: 'Code of Ethics', href: 'https://www.beautyguild.com/Membership/Code-Of-Ethics' },
};

export const DOCUMENT_CATALOGUE = {
  MEDMAL_WORDING: 'Medical Malpractice Policy Wording',
  GENERAL_TERMS: 'General Terms & Conditions',
  NON_SALON_CONTENTS_WORDING: 'Non-Salon Contents Policy Wording',
  NON_SALON_EL_WORDING: "Non-Salon Employers' Liability Policy Wording",
  NON_SALON_PROPERTY_DEFINITIONS: 'Non-Salon Property Definitions',
  SALON_EL_WORDING: "Salon Employers' Liability Policy Wording",
  SALON_CONTENTS_WORDING: 'Salon Contents Policy Wording',
  SALON_MONEY_WORDING: 'Salon Money Policy Wording',
  SALON_BUILDINGS_WORDING: 'Salon Buildings Policy Wording',
  SALON_BI_WORDING: 'Salon Business Interruption Policy Wording',
  SALON_PROPERTY_AWAY_WORDING: 'Salon Property Away Policy Wording',
  SALON_PROPERTY_DEFINITIONS: 'Salon Property Definitions',
};

export function getQuoteDocuments(state) {
  const codes = ['GENERAL_TERMS', 'MEDMAL_WORDING'];

  if (state.route === 'non_salon') {
    if (state.nonSalonEL) codes.push('NON_SALON_EL_WORDING');
    if (Number(state.equipmentTier) > 0) {
      codes.push('NON_SALON_CONTENTS_WORDING', 'NON_SALON_PROPERTY_DEFINITIONS');
    }
  } else {
    if (state.salonEL) codes.push('SALON_EL_WORDING');
    if (state.contents) codes.push('SALON_CONTENTS_WORDING', 'SALON_PROPERTY_DEFINITIONS');
    if (state.moneyCover) codes.push('SALON_MONEY_WORDING');
    if (state.buildingsCover) codes.push('SALON_BUILDINGS_WORDING');
    if (state.biCover) codes.push('SALON_BI_WORDING');
    if (state.propertyAwayCover) codes.push('SALON_PROPERTY_AWAY_WORDING');
  }

  return [...new Set(codes)].map((code) => ({ code, name: DOCUMENT_CATALOGUE[code] }));
}
