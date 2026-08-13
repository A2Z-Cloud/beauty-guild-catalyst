// Reference data for the GTi accreditation application journey.
// Ported from the "Review and build out" design prototype (Beauty Guild Portal.dc.html).

// Qualifications is deliberately not a wizard step - per the field mapping doc it belongs
// in the customer's portal after payment, not the initial application.
export const STEP_LABELS = [
  'Account', 'Your details', 'Interests', 'Address', 'Declarations',
  'Courses', 'School', 'Geocoding', 'Tutors', 'Summary',
];

// Must match the CRM Contacts "Salutation" picklist exactly (including the periods).
export const TITLES = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'];

export const INTERESTS = ['Beauty', 'Holistic', 'Hairdressing', 'Nails', 'Training'];

// A handful of common dial codes for the phone/mobile country-code selector - not an
// exhaustive list. CRM has no separate country-code field, so the code is prefixed onto
// the same Phone/Mobile value it's stored on - see withDialCode and parseDialCode.
export const COUNTRY_CODES = [
  { code: '+44', label: '🇬🇧 +44' },
  { code: '+353', label: '🇮🇪 +353' },
  { code: '+1', label: '🇺🇸 +1' },
  { code: '+61', label: '🇦🇺 +61' },
  { code: '+64', label: '🇳🇿 +64' },
  { code: '+33', label: '🇫🇷 +33' },
  { code: '+49', label: '🇩🇪 +49' },
  { code: '+34', label: '🇪🇸 +34' },
  { code: '+39', label: '🇮🇹 +39' },
  { code: '+31', label: '🇳🇱 +31' },
];

// Splits a stored "+44 01332 123456" back into { code: '+44', number: '01332 123456' } for
// prefill - the inverse of withDialCode. Falls back to the UK default if no code is found.
export function parseDialCode(value) {
  if (!value) return { code: '+44', number: '' };
  const match = COUNTRY_CODES.find((c) => value.startsWith(`${c.code} `));
  if (match) return { code: match.code, number: value.slice(match.code.length + 1) };
  return { code: '+44', number: value };
}

// "sarah" -> "Sarah". Applied on blur so it doesn't fight the user mid-keystroke.
export function capitalizeFirst(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// "01332123456" -> "01332 123456" - per the field mapping doc: "Numeric, 11 digits, space
// to be added between the first 5 digits and the next 6 digits". Strips anything non-numeric.
export function formatUkPhone(value) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

// Combines the selected dial code with the typed number before sending to CRM,
// e.g. ('+44', '01332 123456') -> '+44 01332 123456'.
export function withDialCode(code, number) {
  return number ? `${code} ${number}` : number;
}

// A member applying for accreditation should always have Training in their interests,
// even if it wasn't already on their CRM record - per the field mapping doc.
export function mergeInterestsWithTraining(crmInterests) {
  const merged = Array.isArray(crmInterests) ? [...crmInterests] : [];
  if (!merged.includes('Training')) merged.push('Training');
  return merged;
}

// Must match the CRM Contacts "Correspondence_Country" picklist exactly - UK and Ireland
// first (per the field mapping doc), then the rest of the picklist in its stored order.
export const COUNTRIES = [
  'United Kingdom', 'Ireland', 'Afghanistan', 'Albania', 'Algeria', 'American Samoa', 'Andorra',
  'Angola', 'Anguilla', 'Antarctica', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Aruban',
  'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus',
  'Belgium', 'Belize', 'Benin', 'Bermuda', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana',
  'Bouvet Island', 'Brazil', 'British Indian Ocean Territory', 'British Virgin Islands', 'Brunei',
  'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Cape Verde',
  'Cayman Islands', 'Central African Republic', 'Chad', 'Chile', 'China', 'Christmas Island',
  'Cocos Islands', 'Colombia', 'Comoros', 'Congo', 'Cook Islands', 'Costa Rica', 'Croatia', 'Cuba',
  'Cyprus', 'Czech Republic', 'Cote dIvoire', 'Denmark', 'Djibouti', 'Dominica',
  'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia',
  'Ethiopia', 'Falkland Islands', 'Faroe Islands', 'Fiji', 'Finland', 'France', 'French Guiana',
  'French Polynesia', 'French Southern Territories', 'Gabon', 'Gambia', 'Georgia', 'Germany',
  'Ghana', 'Gibraltar', 'Greece', 'Greenland', 'Grenada', 'Guadeloupe', 'Guam', 'Guatemala',
  'Guernsey', 'Guinea', 'GuineaBissau', 'Guyana', 'Haiti', 'Heard Island And McDonald Islands',
  'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Israel',
  'Italy', 'Jamaica', 'Japan', 'Jersey', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo',
  'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya',
  'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macao', 'North Macedonia', 'Madagascar', 'Malawi',
  'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Martinique', 'Mauritania',
  'Mauritius', 'Mayotte', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro',
  'Montserrat', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands',
  'Netherlands Antilles', 'New Caledonia', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'Niue',
  'Norfolk Island', 'North Korea', 'Northern Ireland', 'Northern Mariana Islands', 'Norway',
  'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
  'Philippines', 'Pitcairn', 'Poland', 'Portugal', 'Puerto Rico', 'Qatar', 'Reunion', 'Romania',
  'Russia', 'Rwanda', 'Saint Helena', 'Saint Kitts And Nevis', 'Saint Lucia',
  'Saint Pierre And Miquelon', 'Saint Vincent And The Grenadines', 'Samoa', 'San Marino',
  'Sao Tome And Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Serbia and Montenegro',
  'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia',
  'South Africa', 'South Georgia And The South Sandwich Islands', 'South Korea', 'Spain',
  'Sri Lanka', 'Sudan', 'Suriname', 'Svalbard And Jan Mayen', 'Eswatini', 'Sweden', 'Switzerland',
  'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'The Democratic Republic Of Congo',
  'Timor-Leste', 'Togo', 'Tokelau', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey',
  'Turkmenistan', 'Turks And Caicos Islands', 'Tuvalu', 'Virgin Islands', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'United States', 'United States Minor Outlying Islands', 'Uruguay',
  'Uzbekistan', 'Vanuatu', 'Vatican', 'Venezuela', 'Vietnam', 'Wallis And Futuna', 'Western Sahara',
  'Yemen', 'Zambia', 'Zimbabwe', 'Aland Islands',
];

export const ACC_DECLARATIONS = [
  'I am qualified in the subjects I wish to teach and have held my qualifications for at least 6 months.',
  'I hold a recognised teaching qualification.',
  'I will be able to provide copies of my qualifications if required at any point.',
];

// Shown inline, directly below a declaration row answered "No" - not a popup.
export const DECLARATION_MESSAGES = {
  0: {
    text: "You need to be qualified in the areas that you are wanting to teach and have at least 6 months' experience in each subject or treatment. To find accredited training courses in your area, please visit our ",
    linkText: 'GTi Courses Section',
  },
  1: {
    text: 'You need to hold a recognized teaching qualification in order to apply for accreditation. We recommend the ',
    linkText: 'GTi Teaching Certificate',
  },
  2: {
    text: 'You must hold copies of your qualifications if you wish to apply for Guild Accreditation.',
  },
};

export const ACCREDITATION_FEE = 295;
export const ACCREDITATION_VAT = 59;
export const ACCREDITATION_GRAND_TOTAL = ACCREDITATION_FEE + ACCREDITATION_VAT;
export const ACCREDITATION_WITH_MEMBERSHIP = 409;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// "03/03/2027" -> "03 March 2027", matching the production "Accreditation Valid Until" format.
export function formatLongDate(ddmmyyyy) {
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  return `${dd} ${MONTHS[parseInt(mm, 10) - 1]} ${yyyy}`;
}

// Shared mock data for the "Manage School" Tutors detail page - only "A2Z Test School"
// matches real production data seen in screenshots; other schools reuse it for now.
export const ACCREDITED_LECTURERS = [
  { name: 'Tega Test', membershipNumber: '207389', membershipExpiry: '03/03/2027' },
];

export const initialAccState = () => ({
  mode: 'register',
  title: '', fname: '', surname: '', email: '', confirmEmail: '', pw: '', confirmPw: '',
  captcha: false, accountTerms: false,
  phone: '', mobile: '', phoneCode: '+44', mobileCode: '+44',
  interests: ['Training'],
  addr: { pc: '', l1: '', l2: '', l3: '', town: '', county: '', country: 'United Kingdom' },
  addrLooked: false,
  decls: [],
  courses: [],
  sch: {
    name: '', contact: '', email: '', phone: '', mobile: '', phoneCode: '+44', mobileCode: '+44',
    pc: '', l1: '', l2: '', l3: '', town: '', county: '', country: 'United Kingdom', latitude: null, longitude: null,
  },
  schLooked: false,
  ot: null, otN: '', tutQual: null, ov: null,
  voucher: '', marketing: false, tob: false,
});

export function isStepValid(stepIndex, acc) {
  switch (stepIndex) {
    case 0:
      return acc.mode === 'login'
        ? !!acc.email && !!acc.pw
        : !!acc.email && acc.email === acc.confirmEmail
          && acc.pw.length >= 8 && acc.pw === acc.confirmPw
          && acc.captcha && acc.accountTerms;
    case 1:
      return !!acc.title && !!acc.fname && !!acc.surname && !!acc.mobile;
    case 2:
      return acc.interests.length > 0;
    case 3:
      return !!acc.addr.l1 && !!acc.addr.town && !!acc.addr.pc;
    case 4:
      return acc.decls.length === 3 && acc.decls.every((v) => v === 'yes');
    case 5:
      return true;
    case 6:
      return !!acc.sch.name && !!acc.sch.l1 && !!acc.sch.town;
    case 7:
      return true; // Geocoding - confirming the pin location, nothing to validate.
    case 8:
      return !!acc.ot && !!acc.ov && (acc.ot === 'no' || acc.tutQual === 'yes');
    default:
      return true;
  }
}
