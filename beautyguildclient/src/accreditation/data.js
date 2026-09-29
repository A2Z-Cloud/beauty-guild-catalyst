// Reference data for the GTi accreditation application journey.
// Ported from the "Review and build out" design prototype (Beauty Guild Portal.dc.html).

// Qualifications is deliberately not a wizard step - per the field mapping doc it belongs
// in the customer's portal after payment, not the initial application.
export const STEP_LABELS = [
  'Account', 'Your details', 'Interests', 'Address', 'Declarations',
  'Courses', 'School', 'Geocoding', 'Tutors', 'Summary',
];

// Must match the CRM Contacts "Salutation" picklist exactly (including the periods).
// "Miss" is included per customer request - it must also be added to the CRM Salutation
// picklist itself (a CRM admin/setup change, not something this app can do), or saving a
// contact with that title will be rejected by CRM as an invalid picklist value.
export const TITLES = ['Mr.', 'Mrs.', 'Miss', 'Ms.', 'Dr.', 'Prof.'];

export const INTERESTS = ['Beauty', 'Holistic', 'Hairdressing', 'Nails', 'Training'];

// Dial codes for the phone/mobile country-code selector, UK first (the default). CRM has no
// separate country-code field, so the code is prefixed onto the same Phone/Mobile value it's
// stored on - see withDialCode and parseDialCode.
export const COUNTRY_CODES = [
  { code: '+44', label: '🇬🇧 +44' },
  { code: '+353', label: '🇮🇪 +353' },
  { code: '+1', label: '🇺🇸 +1' },
  { code: '+7', label: '🇷🇺 +7' },
  { code: '+20', label: '🇪🇬 +20' },
  { code: '+27', label: '🇿🇦 +27' },
  { code: '+30', label: '🇬🇷 +30' },
  { code: '+31', label: '🇳🇱 +31' },
  { code: '+32', label: '🇧🇪 +32' },
  { code: '+33', label: '🇫🇷 +33' },
  { code: '+34', label: '🇪🇸 +34' },
  { code: '+36', label: '🇭🇺 +36' },
  { code: '+39', label: '🇮🇹 +39' },
  { code: '+40', label: '🇷🇴 +40' },
  { code: '+41', label: '🇨🇭 +41' },
  { code: '+43', label: '🇦🇹 +43' },
  { code: '+45', label: '🇩🇰 +45' },
  { code: '+46', label: '🇸🇪 +46' },
  { code: '+47', label: '🇳🇴 +47' },
  { code: '+48', label: '🇵🇱 +48' },
  { code: '+49', label: '🇩🇪 +49' },
  { code: '+51', label: '🇵🇪 +51' },
  { code: '+52', label: '🇲🇽 +52' },
  { code: '+53', label: '🇨🇺 +53' },
  { code: '+54', label: '🇦🇷 +54' },
  { code: '+55', label: '🇧🇷 +55' },
  { code: '+56', label: '🇨🇱 +56' },
  { code: '+57', label: '🇨🇴 +57' },
  { code: '+58', label: '🇻🇪 +58' },
  { code: '+60', label: '🇲🇾 +60' },
  { code: '+61', label: '🇦🇺 +61' },
  { code: '+62', label: '🇮🇩 +62' },
  { code: '+63', label: '🇵🇭 +63' },
  { code: '+64', label: '🇳🇿 +64' },
  { code: '+65', label: '🇸🇬 +65' },
  { code: '+66', label: '🇹🇭 +66' },
  { code: '+81', label: '🇯🇵 +81' },
  { code: '+82', label: '🇰🇷 +82' },
  { code: '+84', label: '🇻🇳 +84' },
  { code: '+86', label: '🇨🇳 +86' },
  { code: '+90', label: '🇹🇷 +90' },
  { code: '+91', label: '🇮🇳 +91' },
  { code: '+92', label: '🇵🇰 +92' },
  { code: '+93', label: '🇦🇫 +93' },
  { code: '+94', label: '🇱🇰 +94' },
  { code: '+95', label: '🇲🇲 +95' },
  { code: '+98', label: '🇮🇷 +98' },
  { code: '+211', label: '🇸🇸 +211' },
  { code: '+212', label: '🇲🇦 +212' },
  { code: '+213', label: '🇩🇿 +213' },
  { code: '+216', label: '🇹🇳 +216' },
  { code: '+218', label: '🇱🇾 +218' },
  { code: '+220', label: '🇬🇲 +220' },
  { code: '+221', label: '🇸🇳 +221' },
  { code: '+222', label: '🇲🇷 +222' },
  { code: '+223', label: '🇲🇱 +223' },
  { code: '+224', label: '🇬🇳 +224' },
  { code: '+225', label: '🇨🇮 +225' },
  { code: '+226', label: '🇧🇫 +226' },
  { code: '+227', label: '🇳🇪 +227' },
  { code: '+228', label: '🇹🇬 +228' },
  { code: '+229', label: '🇧🇯 +229' },
  { code: '+230', label: '🇲🇺 +230' },
  { code: '+231', label: '🇱🇷 +231' },
  { code: '+232', label: '🇸🇱 +232' },
  { code: '+233', label: '🇬🇭 +233' },
  { code: '+234', label: '🇳🇬 +234' },
  { code: '+235', label: '🇹🇩 +235' },
  { code: '+236', label: '🇨🇫 +236' },
  { code: '+237', label: '🇨🇲 +237' },
  { code: '+238', label: '🇨🇻 +238' },
  { code: '+239', label: '🇸🇹 +239' },
  { code: '+240', label: '🇬🇶 +240' },
  { code: '+241', label: '🇬🇦 +241' },
  { code: '+242', label: '🇨🇬 +242' },
  { code: '+243', label: '🇨🇩 +243' },
  { code: '+244', label: '🇦🇴 +244' },
  { code: '+245', label: '🇬🇼 +245' },
  { code: '+246', label: '🇮🇴 +246' },
  { code: '+247', label: '🇦🇨 +247' },
  { code: '+248', label: '🇸🇨 +248' },
  { code: '+249', label: '🇸🇩 +249' },
  { code: '+250', label: '🇷🇼 +250' },
  { code: '+251', label: '🇪🇹 +251' },
  { code: '+252', label: '🇸🇴 +252' },
  { code: '+253', label: '🇩🇯 +253' },
  { code: '+254', label: '🇰🇪 +254' },
  { code: '+255', label: '🇹🇿 +255' },
  { code: '+256', label: '🇺🇬 +256' },
  { code: '+257', label: '🇧🇮 +257' },
  { code: '+258', label: '🇲🇿 +258' },
  { code: '+260', label: '🇿🇲 +260' },
  { code: '+261', label: '🇲🇬 +261' },
  { code: '+262', label: '🇷🇪 +262' },
  { code: '+263', label: '🇿🇼 +263' },
  { code: '+264', label: '🇳🇦 +264' },
  { code: '+265', label: '🇲🇼 +265' },
  { code: '+266', label: '🇱🇸 +266' },
  { code: '+267', label: '🇧🇼 +267' },
  { code: '+268', label: '🇸🇿 +268' },
  { code: '+269', label: '🇰🇲 +269' },
  { code: '+290', label: '🇸🇭 +290' },
  { code: '+291', label: '🇪🇷 +291' },
  { code: '+297', label: '🇦🇼 +297' },
  { code: '+298', label: '🇫🇴 +298' },
  { code: '+299', label: '🇬🇱 +299' },
  { code: '+350', label: '🇬🇮 +350' },
  { code: '+351', label: '🇵🇹 +351' },
  { code: '+352', label: '🇱🇺 +352' },
  { code: '+354', label: '🇮🇸 +354' },
  { code: '+355', label: '🇦🇱 +355' },
  { code: '+356', label: '🇲🇹 +356' },
  { code: '+357', label: '🇨🇾 +357' },
  { code: '+358', label: '🇫🇮 +358' },
  { code: '+359', label: '🇧🇬 +359' },
  { code: '+370', label: '🇱🇹 +370' },
  { code: '+371', label: '🇱🇻 +371' },
  { code: '+372', label: '🇪🇪 +372' },
  { code: '+373', label: '🇲🇩 +373' },
  { code: '+374', label: '🇦🇲 +374' },
  { code: '+375', label: '🇧🇾 +375' },
  { code: '+376', label: '🇦🇩 +376' },
  { code: '+377', label: '🇲🇨 +377' },
  { code: '+378', label: '🇸🇲 +378' },
  { code: '+380', label: '🇺🇦 +380' },
  { code: '+381', label: '🇷🇸 +381' },
  { code: '+382', label: '🇲🇪 +382' },
  { code: '+383', label: '🇽🇰 +383' },
  { code: '+385', label: '🇭🇷 +385' },
  { code: '+386', label: '🇸🇮 +386' },
  { code: '+387', label: '🇧🇦 +387' },
  { code: '+389', label: '🇲🇰 +389' },
  { code: '+420', label: '🇨🇿 +420' },
  { code: '+421', label: '🇸🇰 +421' },
  { code: '+423', label: '🇱🇮 +423' },
  { code: '+500', label: '🇫🇰 +500' },
  { code: '+501', label: '🇧🇿 +501' },
  { code: '+502', label: '🇬🇹 +502' },
  { code: '+503', label: '🇸🇻 +503' },
  { code: '+504', label: '🇭🇳 +504' },
  { code: '+505', label: '🇳🇮 +505' },
  { code: '+506', label: '🇨🇷 +506' },
  { code: '+507', label: '🇵🇦 +507' },
  { code: '+508', label: '🇵🇲 +508' },
  { code: '+509', label: '🇭🇹 +509' },
  { code: '+590', label: '🇬🇵 +590' },
  { code: '+591', label: '🇧🇴 +591' },
  { code: '+592', label: '🇬🇾 +592' },
  { code: '+593', label: '🇪🇨 +593' },
  { code: '+594', label: '🇬🇫 +594' },
  { code: '+595', label: '🇵🇾 +595' },
  { code: '+596', label: '🇲🇶 +596' },
  { code: '+597', label: '🇸🇷 +597' },
  { code: '+598', label: '🇺🇾 +598' },
  { code: '+599', label: '🇨🇼 +599' },
  { code: '+670', label: '🇹🇱 +670' },
  { code: '+672', label: '🇳🇫 +672' },
  { code: '+673', label: '🇧🇳 +673' },
  { code: '+674', label: '🇳🇷 +674' },
  { code: '+675', label: '🇵🇬 +675' },
  { code: '+676', label: '🇹🇴 +676' },
  { code: '+677', label: '🇸🇧 +677' },
  { code: '+678', label: '🇻🇺 +678' },
  { code: '+679', label: '🇫🇯 +679' },
  { code: '+680', label: '🇵🇼 +680' },
  { code: '+681', label: '🇼🇫 +681' },
  { code: '+682', label: '🇨🇰 +682' },
  { code: '+683', label: '🇳🇺 +683' },
  { code: '+685', label: '🇼🇸 +685' },
  { code: '+686', label: '🇰🇮 +686' },
  { code: '+687', label: '🇳🇨 +687' },
  { code: '+688', label: '🇹🇻 +688' },
  { code: '+689', label: '🇵🇫 +689' },
  { code: '+690', label: '🇹🇰 +690' },
  { code: '+691', label: '🇫🇲 +691' },
  { code: '+692', label: '🇲🇭 +692' },
  { code: '+850', label: '🇰🇵 +850' },
  { code: '+852', label: '🇭🇰 +852' },
  { code: '+853', label: '🇲🇴 +853' },
  { code: '+855', label: '🇰🇭 +855' },
  { code: '+856', label: '🇱🇦 +856' },
  { code: '+880', label: '🇧🇩 +880' },
  { code: '+886', label: '🇹🇼 +886' },
  { code: '+960', label: '🇲🇻 +960' },
  { code: '+961', label: '🇱🇧 +961' },
  { code: '+962', label: '🇯🇴 +962' },
  { code: '+963', label: '🇸🇾 +963' },
  { code: '+964', label: '🇮🇶 +964' },
  { code: '+965', label: '🇰🇼 +965' },
  { code: '+966', label: '🇸🇦 +966' },
  { code: '+967', label: '🇾🇪 +967' },
  { code: '+968', label: '🇴🇲 +968' },
  { code: '+970', label: '🇵🇸 +970' },
  { code: '+971', label: '🇦🇪 +971' },
  { code: '+972', label: '🇮🇱 +972' },
  { code: '+973', label: '🇧🇭 +973' },
  { code: '+974', label: '🇶🇦 +974' },
  { code: '+975', label: '🇧🇹 +975' },
  { code: '+976', label: '🇲🇳 +976' },
  { code: '+977', label: '🇳🇵 +977' },
  { code: '+992', label: '🇹🇯 +992' },
  { code: '+993', label: '🇹🇲 +993' },
  { code: '+994', label: '🇦🇿 +994' },
  { code: '+995', label: '🇬🇪 +995' },
  { code: '+996', label: '🇰🇬 +996' },
  { code: '+998', label: '🇺🇿 +998' },
  { code: '+1268', label: '🇦🇬 +1268' },
  { code: '+1264', label: '🇦🇮 +1264' },
  { code: '+1684', label: '🇦🇸 +1684' },
  { code: '+1246', label: '🇧🇧 +1246' },
  { code: '+1441', label: '🇧🇲 +1441' },
  { code: '+1242', label: '🇧🇸 +1242' },
  { code: '+1767', label: '🇩🇲 +1767' },
  { code: '+1809', label: '🇩🇴 +1809' },
  { code: '+1473', label: '🇬🇩 +1473' },
  { code: '+1671', label: '🇬🇺 +1671' },
  { code: '+1876', label: '🇯🇲 +1876' },
  { code: '+1869', label: '🇰🇳 +1869' },
  { code: '+1345', label: '🇰🇾 +1345' },
  { code: '+1758', label: '🇱🇨 +1758' },
  { code: '+1670', label: '🇲🇵 +1670' },
  { code: '+1664', label: '🇲🇸 +1664' },
  { code: '+1787', label: '🇵🇷 +1787' },
  { code: '+1721', label: '🇸🇽 +1721' },
  { code: '+1649', label: '🇹🇨 +1649' },
  { code: '+1868', label: '🇹🇹 +1868' },
  { code: '+1784', label: '🇻🇨 +1784' },
  { code: '+1284', label: '🇻🇬 +1284' },
  { code: '+1340', label: '🇻🇮 +1340' },
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

// Flag + calling code per country, for the Country selects (flag prefix) and to auto-sync a
// phone/mobile dial-code selector to whichever country is chosen there - a few uninhabited/
// no-phone-system territories (Antarctica etc.) have a flag but no real dial code, and
// deliberately fall back to leaving the dial code selector as it was.
export const COUNTRY_META = {
  'United Kingdom': { flag: '🇬🇧', dial: '+44' },
  'Ireland': { flag: '🇮🇪', dial: '+353' },
  'Afghanistan': { flag: '🇦🇫', dial: '+93' },
  'Albania': { flag: '🇦🇱', dial: '+355' },
  'Algeria': { flag: '🇩🇿', dial: '+213' },
  'American Samoa': { flag: '🇦🇸', dial: '+1684' },
  'Andorra': { flag: '🇦🇩', dial: '+376' },
  'Angola': { flag: '🇦🇴', dial: '+244' },
  'Anguilla': { flag: '🇦🇮', dial: '+1264' },
  'Antarctica': { flag: '🇦🇶', dial: null },
  'Antigua and Barbuda': { flag: '🇦🇬', dial: '+1268' },
  'Argentina': { flag: '🇦🇷', dial: '+54' },
  'Armenia': { flag: '🇦🇲', dial: '+374' },
  'Aruban': { flag: '🇦🇼', dial: '+297' },
  'Australia': { flag: '🇦🇺', dial: '+61' },
  'Austria': { flag: '🇦🇹', dial: '+43' },
  'Azerbaijan': { flag: '🇦🇿', dial: '+994' },
  'Bahamas': { flag: '🇧🇸', dial: '+1242' },
  'Bahrain': { flag: '🇧🇭', dial: '+973' },
  'Bangladesh': { flag: '🇧🇩', dial: '+880' },
  'Barbados': { flag: '🇧🇧', dial: '+1246' },
  'Belarus': { flag: '🇧🇾', dial: '+375' },
  'Belgium': { flag: '🇧🇪', dial: '+32' },
  'Belize': { flag: '🇧🇿', dial: '+501' },
  'Benin': { flag: '🇧🇯', dial: '+229' },
  'Bermuda': { flag: '🇧🇲', dial: '+1441' },
  'Bhutan': { flag: '🇧🇹', dial: '+975' },
  'Bolivia': { flag: '🇧🇴', dial: '+591' },
  'Bosnia and Herzegovina': { flag: '🇧🇦', dial: '+387' },
  'Botswana': { flag: '🇧🇼', dial: '+267' },
  'Bouvet Island': { flag: '🇧🇻', dial: null },
  'Brazil': { flag: '🇧🇷', dial: '+55' },
  'British Indian Ocean Territory': { flag: '🇮🇴', dial: '+246' },
  'British Virgin Islands': { flag: '🇻🇬', dial: '+1284' },
  'Brunei': { flag: '🇧🇳', dial: '+673' },
  'Bulgaria': { flag: '🇧🇬', dial: '+359' },
  'Burkina Faso': { flag: '🇧🇫', dial: '+226' },
  'Burundi': { flag: '🇧🇮', dial: '+257' },
  'Cambodia': { flag: '🇰🇭', dial: '+855' },
  'Cameroon': { flag: '🇨🇲', dial: '+237' },
  'Canada': { flag: '🇨🇦', dial: '+1' },
  'Cape Verde': { flag: '🇨🇻', dial: '+238' },
  'Cayman Islands': { flag: '🇰🇾', dial: '+1345' },
  'Central African Republic': { flag: '🇨🇫', dial: '+236' },
  'Chad': { flag: '🇹🇩', dial: '+235' },
  'Chile': { flag: '🇨🇱', dial: '+56' },
  'China': { flag: '🇨🇳', dial: '+86' },
  'Christmas Island': { flag: '🇨🇽', dial: '+61' },
  'Cocos Islands': { flag: '🇨🇨', dial: '+61' },
  'Colombia': { flag: '🇨🇴', dial: '+57' },
  'Comoros': { flag: '🇰🇲', dial: '+269' },
  'Congo': { flag: '🇨🇬', dial: '+242' },
  'Cook Islands': { flag: '🇨🇰', dial: '+682' },
  'Costa Rica': { flag: '🇨🇷', dial: '+506' },
  'Croatia': { flag: '🇭🇷', dial: '+385' },
  'Cuba': { flag: '🇨🇺', dial: '+53' },
  'Cyprus': { flag: '🇨🇾', dial: '+357' },
  'Czech Republic': { flag: '🇨🇿', dial: '+420' },
  'Cote dIvoire': { flag: '🇨🇮', dial: '+225' },
  'Denmark': { flag: '🇩🇰', dial: '+45' },
  'Djibouti': { flag: '🇩🇯', dial: '+253' },
  'Dominica': { flag: '🇩🇲', dial: '+1767' },
  'Dominican Republic': { flag: '🇩🇴', dial: '+1809' },
  'Ecuador': { flag: '🇪🇨', dial: '+593' },
  'Egypt': { flag: '🇪🇬', dial: '+20' },
  'El Salvador': { flag: '🇸🇻', dial: '+503' },
  'Equatorial Guinea': { flag: '🇬🇶', dial: '+240' },
  'Eritrea': { flag: '🇪🇷', dial: '+291' },
  'Estonia': { flag: '🇪🇪', dial: '+372' },
  'Ethiopia': { flag: '🇪🇹', dial: '+251' },
  'Falkland Islands': { flag: '🇫🇰', dial: '+500' },
  'Faroe Islands': { flag: '🇫🇴', dial: '+298' },
  'Fiji': { flag: '🇫🇯', dial: '+679' },
  'Finland': { flag: '🇫🇮', dial: '+358' },
  'France': { flag: '🇫🇷', dial: '+33' },
  'French Guiana': { flag: '🇬🇫', dial: '+594' },
  'French Polynesia': { flag: '🇵🇫', dial: '+689' },
  'French Southern Territories': { flag: '🇹🇫', dial: null },
  'Gabon': { flag: '🇬🇦', dial: '+241' },
  'Gambia': { flag: '🇬🇲', dial: '+220' },
  'Georgia': { flag: '🇬🇪', dial: '+995' },
  'Germany': { flag: '🇩🇪', dial: '+49' },
  'Ghana': { flag: '🇬🇭', dial: '+233' },
  'Gibraltar': { flag: '🇬🇮', dial: '+350' },
  'Greece': { flag: '🇬🇷', dial: '+30' },
  'Greenland': { flag: '🇬🇱', dial: '+299' },
  'Grenada': { flag: '🇬🇩', dial: '+1473' },
  'Guadeloupe': { flag: '🇬🇵', dial: '+590' },
  'Guam': { flag: '🇬🇺', dial: '+1671' },
  'Guatemala': { flag: '🇬🇹', dial: '+502' },
  'Guernsey': { flag: '🇬🇬', dial: '+44' },
  'Guinea': { flag: '🇬🇳', dial: '+224' },
  'GuineaBissau': { flag: '🇬🇼', dial: '+245' },
  'Guyana': { flag: '🇬🇾', dial: '+592' },
  'Haiti': { flag: '🇭🇹', dial: '+509' },
  'Heard Island And McDonald Islands': { flag: '🇭🇲', dial: null },
  'Honduras': { flag: '🇭🇳', dial: '+504' },
  'Hong Kong': { flag: '🇭🇰', dial: '+852' },
  'Hungary': { flag: '🇭🇺', dial: '+36' },
  'Iceland': { flag: '🇮🇸', dial: '+354' },
  'India': { flag: '🇮🇳', dial: '+91' },
  'Indonesia': { flag: '🇮🇩', dial: '+62' },
  'Iran': { flag: '🇮🇷', dial: '+98' },
  'Iraq': { flag: '🇮🇶', dial: '+964' },
  'Israel': { flag: '🇮🇱', dial: '+972' },
  'Italy': { flag: '🇮🇹', dial: '+39' },
  'Jamaica': { flag: '🇯🇲', dial: '+1876' },
  'Japan': { flag: '🇯🇵', dial: '+81' },
  'Jersey': { flag: '🇯🇪', dial: '+44' },
  'Jordan': { flag: '🇯🇴', dial: '+962' },
  'Kazakhstan': { flag: '🇰🇿', dial: '+7' },
  'Kenya': { flag: '🇰🇪', dial: '+254' },
  'Kiribati': { flag: '🇰🇮', dial: '+686' },
  'Kosovo': { flag: '🇽🇰', dial: '+383' },
  'Kuwait': { flag: '🇰🇼', dial: '+965' },
  'Kyrgyzstan': { flag: '🇰🇬', dial: '+996' },
  'Laos': { flag: '🇱🇦', dial: '+856' },
  'Latvia': { flag: '🇱🇻', dial: '+371' },
  'Lebanon': { flag: '🇱🇧', dial: '+961' },
  'Lesotho': { flag: '🇱🇸', dial: '+266' },
  'Liberia': { flag: '🇱🇷', dial: '+231' },
  'Libya': { flag: '🇱🇾', dial: '+218' },
  'Liechtenstein': { flag: '🇱🇮', dial: '+423' },
  'Lithuania': { flag: '🇱🇹', dial: '+370' },
  'Luxembourg': { flag: '🇱🇺', dial: '+352' },
  'Macao': { flag: '🇲🇴', dial: '+853' },
  'North Macedonia': { flag: '🇲🇰', dial: '+389' },
  'Madagascar': { flag: '🇲🇬', dial: '+261' },
  'Malawi': { flag: '🇲🇼', dial: '+265' },
  'Malaysia': { flag: '🇲🇾', dial: '+60' },
  'Maldives': { flag: '🇲🇻', dial: '+960' },
  'Mali': { flag: '🇲🇱', dial: '+223' },
  'Malta': { flag: '🇲🇹', dial: '+356' },
  'Marshall Islands': { flag: '🇲🇭', dial: '+692' },
  'Martinique': { flag: '🇲🇶', dial: '+596' },
  'Mauritania': { flag: '🇲🇷', dial: '+222' },
  'Mauritius': { flag: '🇲🇺', dial: '+230' },
  'Mayotte': { flag: '🇾🇹', dial: '+262' },
  'Mexico': { flag: '🇲🇽', dial: '+52' },
  'Micronesia': { flag: '🇫🇲', dial: '+691' },
  'Moldova': { flag: '🇲🇩', dial: '+373' },
  'Monaco': { flag: '🇲🇨', dial: '+377' },
  'Mongolia': { flag: '🇲🇳', dial: '+976' },
  'Montenegro': { flag: '🇲🇪', dial: '+382' },
  'Montserrat': { flag: '🇲🇸', dial: '+1664' },
  'Morocco': { flag: '🇲🇦', dial: '+212' },
  'Mozambique': { flag: '🇲🇿', dial: '+258' },
  'Myanmar': { flag: '🇲🇲', dial: '+95' },
  'Namibia': { flag: '🇳🇦', dial: '+264' },
  'Nauru': { flag: '🇳🇷', dial: '+674' },
  'Nepal': { flag: '🇳🇵', dial: '+977' },
  'Netherlands': { flag: '🇳🇱', dial: '+31' },
  'New Caledonia': { flag: '🇳🇨', dial: '+687' },
  'New Zealand': { flag: '🇳🇿', dial: '+64' },
  'Nicaragua': { flag: '🇳🇮', dial: '+505' },
  'Niger': { flag: '🇳🇪', dial: '+227' },
  'Nigeria': { flag: '🇳🇬', dial: '+234' },
  'Niue': { flag: '🇳🇺', dial: '+683' },
  'Norfolk Island': { flag: '🇳🇫', dial: '+672' },
  'North Korea': { flag: '🇰🇵', dial: '+850' },
  'Northern Ireland': { flag: '🇬🇧', dial: '+44' },
  'Northern Mariana Islands': { flag: '🇲🇵', dial: '+1670' },
  'Norway': { flag: '🇳🇴', dial: '+47' },
  'Oman': { flag: '🇴🇲', dial: '+968' },
  'Pakistan': { flag: '🇵🇰', dial: '+92' },
  'Palau': { flag: '🇵🇼', dial: '+680' },
  'Palestine': { flag: '🇵🇸', dial: '+970' },
  'Panama': { flag: '🇵🇦', dial: '+507' },
  'Papua New Guinea': { flag: '🇵🇬', dial: '+675' },
  'Paraguay': { flag: '🇵🇾', dial: '+595' },
  'Peru': { flag: '🇵🇪', dial: '+51' },
  'Philippines': { flag: '🇵🇭', dial: '+63' },
  'Pitcairn': { flag: '🇵🇳', dial: null },
  'Poland': { flag: '🇵🇱', dial: '+48' },
  'Portugal': { flag: '🇵🇹', dial: '+351' },
  'Puerto Rico': { flag: '🇵🇷', dial: '+1787' },
  'Qatar': { flag: '🇶🇦', dial: '+974' },
  'Reunion': { flag: '🇷🇪', dial: '+262' },
  'Romania': { flag: '🇷🇴', dial: '+40' },
  'Russia': { flag: '🇷🇺', dial: '+7' },
  'Rwanda': { flag: '🇷🇼', dial: '+250' },
  'Saint Helena': { flag: '🇸🇭', dial: '+290' },
  'Saint Kitts And Nevis': { flag: '🇰🇳', dial: '+1869' },
  'Saint Lucia': { flag: '🇱🇨', dial: '+1758' },
  'Saint Pierre And Miquelon': { flag: '🇵🇲', dial: '+508' },
  'Saint Vincent And The Grenadines': { flag: '🇻🇨', dial: '+1784' },
  'Samoa': { flag: '🇼🇸', dial: '+685' },
  'San Marino': { flag: '🇸🇲', dial: '+378' },
  'Sao Tome And Principe': { flag: '🇸🇹', dial: '+239' },
  'Saudi Arabia': { flag: '🇸🇦', dial: '+966' },
  'Senegal': { flag: '🇸🇳', dial: '+221' },
  'Serbia': { flag: '🇷🇸', dial: '+381' },
  'Serbia and Montenegro': { flag: '🇷🇸', dial: '+381' },
  'Seychelles': { flag: '🇸🇨', dial: '+248' },
  'Sierra Leone': { flag: '🇸🇱', dial: '+232' },
  'Singapore': { flag: '🇸🇬', dial: '+65' },
  'Slovakia': { flag: '🇸🇰', dial: '+421' },
  'Slovenia': { flag: '🇸🇮', dial: '+386' },
  'Solomon Islands': { flag: '🇸🇧', dial: '+677' },
  'Somalia': { flag: '🇸🇴', dial: '+252' },
  'South Africa': { flag: '🇿🇦', dial: '+27' },
  'South Georgia And The South Sandwich Islands': { flag: '🇬🇸', dial: null },
  'South Korea': { flag: '🇰🇷', dial: '+82' },
  'Spain': { flag: '🇪🇸', dial: '+34' },
  'Sri Lanka': { flag: '🇱🇰', dial: '+94' },
  'Sudan': { flag: '🇸🇩', dial: '+249' },
  'Suriname': { flag: '🇸🇷', dial: '+597' },
  'Svalbard And Jan Mayen': { flag: '🇸🇯', dial: '+47' },
  'Eswatini': { flag: '🇸🇿', dial: '+268' },
  'Sweden': { flag: '🇸🇪', dial: '+46' },
  'Switzerland': { flag: '🇨🇭', dial: '+41' },
  'Syria': { flag: '🇸🇾', dial: '+963' },
  'Taiwan': { flag: '🇹🇼', dial: '+886' },
  'Tajikistan': { flag: '🇹🇯', dial: '+992' },
  'Tanzania': { flag: '🇹🇿', dial: '+255' },
  'Thailand': { flag: '🇹🇭', dial: '+66' },
  'The Democratic Republic Of Congo': { flag: '🇨🇩', dial: '+243' },
  'Timor-Leste': { flag: '🇹🇱', dial: '+670' },
  'Togo': { flag: '🇹🇬', dial: '+228' },
  'Tokelau': { flag: '🇹🇰', dial: '+690' },
  'Tonga': { flag: '🇹🇴', dial: '+676' },
  'Trinidad and Tobago': { flag: '🇹🇹', dial: '+1868' },
  'Tunisia': { flag: '🇹🇳', dial: '+216' },
  'Turkey': { flag: '🇹🇷', dial: '+90' },
  'Turkmenistan': { flag: '🇹🇲', dial: '+993' },
  'Turks And Caicos Islands': { flag: '🇹🇨', dial: '+1649' },
  'Tuvalu': { flag: '🇹🇻', dial: '+688' },
  'Virgin Islands': { flag: '🇻🇮', dial: '+1340' },
  'Uganda': { flag: '🇺🇬', dial: '+256' },
  'Ukraine': { flag: '🇺🇦', dial: '+380' },
  'United Arab Emirates': { flag: '🇦🇪', dial: '+971' },
  'United States': { flag: '🇺🇸', dial: '+1' },
  'United States Minor Outlying Islands': { flag: '🇺🇲', dial: null },
  'Uruguay': { flag: '🇺🇾', dial: '+598' },
  'Uzbekistan': { flag: '🇺🇿', dial: '+998' },
  'Vanuatu': { flag: '🇻🇺', dial: '+678' },
  'Vatican': { flag: '🇻🇦', dial: '+39' },
  'Venezuela': { flag: '🇻🇪', dial: '+58' },
  'Vietnam': { flag: '🇻🇳', dial: '+84' },
  'Wallis And Futuna': { flag: '🇼🇫', dial: '+681' },
  'Western Sahara': { flag: '🇪🇭', dial: '+212' },
  'Yemen': { flag: '🇾🇪', dial: '+967' },
  'Zambia': { flag: '🇿🇲', dial: '+260' },
  'Zimbabwe': { flag: '🇿🇼', dial: '+263' },
  'Aland Islands': { flag: '🇦🇽', dial: '+358' },
};

// "United Kingdom" -> "🇬🇧 United Kingdom" for a Country select's option text - falls back to
// the plain name for the handful of entries with no flag match (e.g. Netherlands Antilles).
export function countryOptionLabel(name) {
  const flag = COUNTRY_META[name]?.flag;
  return flag ? `${flag} ${name}` : name;
}

// Exposed for membership-quote.js - a plain script, not part of this bundle, that renders its
// own Country select - to reuse this exact list/flags rather than keeping a second copy in
// sync by hand. Always on the same page as this bundle by the time that select is built.
if (typeof window !== 'undefined') {
  window.__bgCountries = COUNTRIES;
  window.__bgCountryMeta = COUNTRY_META;
}

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
    text: 'You need to hold a recognised teaching qualification in order to apply for accreditation. We recommend the ',
    linkText: 'GTi Teaching Certificate',
  },
  2: {
    text: 'You must hold copies of your qualifications if you wish to apply for Guild Accreditation.',
  },
};

export const ACC_DECLARATIONS_WARNING = 'All declarations must be confirmed as "Yes" to apply for GTi accreditation. If you need to discuss anything, please call us on 01332 224830.';

export const CANT_FIND_COURSE_TITLE = "Can't find the course you want to teach?";
export const CANT_FIND_COURSE_BODY = "Most Guild Accredited Schools deliver courses using our ready-made GTi course programmes, which include the required theory and provide a simple route to offering Guild-recognised training. If you offer a course that isn't available as a GTi course, you may be able to apply to have your own course accredited by the Guild. Your course materials and supporting documentation will need to be submitted separately for assessment and additional accreditation fees may apply. Call our accreditation team on 01332 224830 for more information.";

export const ACCREDITATION_FEE = 295;
export const ACCREDITATION_VAT = 59;
export const ACCREDITATION_GRAND_TOTAL = ACCREDITATION_FEE + ACCREDITATION_VAT;
export const ACCREDITATION_WITH_MEMBERSHIP = 409;
// International accreditation is its own flat fee (not the standard fee with VAT removed) -
// per QT's 18.09.2026 correction, £350 rather than the £295 standard fee.
export const ACCREDITATION_FEE_INTERNATIONAL = 350;

// The accreditation applies to the training centre itself, so its country (not the
// applicant's home address) is what decides Standard vs International.
export function isInternationalSchool(acc) {
  return !!acc.sch.country && acc.sch.country !== 'United Kingdom';
}

// International accreditations are not VAT-able and use their own flat fee. Any bundled
// membership for an international school is International Membership, which has no fixed
// price anywhere else in this app (always "confirmed by our team") - so unlike the standard
// Associate Membership add-on, no fixed amount is added to the total here; the summary shows
// that component as price-to-be-confirmed instead (see SummaryStep).
export function accreditationPricing(acc, membershipRequired) {
  const international = isInternationalSchool(acc);
  const fee = international ? ACCREDITATION_FEE_INTERNATIONAL : ACCREDITATION_FEE;
  const vat = international ? 0 : ACCREDITATION_VAT;
  const baseTotal = fee + vat;
  const membershipPriceTbc = membershipRequired === true && international;
  const membershipExtra = membershipRequired && !international ? (ACCREDITATION_WITH_MEMBERSHIP - ACCREDITATION_GRAND_TOTAL) : 0;
  return { international, fee, vat, baseTotal, membershipPriceTbc, total: baseTotal + membershipExtra };
}

// Additional Training Venue fee, per the "Accredited Venues" section of the school
// portal document: "just £50 + VAT per year".
export const ADDITIONAL_VENUE_FEE = 50;
export const ADDITIONAL_VENUE_VAT = 10;
export const ADDITIONAL_VENUE_TOTAL = ADDITIONAL_VENUE_FEE + ADDITIONAL_VENUE_VAT;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// CRM dates are returned as ISO YYYY-MM-DD. Keep numeric dates consistent across
// customer-facing portal screens without relying on browser locale or timezone.
export function formatUkDate(dateStr) {
  if (!dateStr) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  return String(dateStr);
}

// "03/03/2027" -> "03 March 2027", matching the production "Accreditation Valid Until" format.
// Accepts either a UK "DD/MM/YYYY" string or a raw CRM ISO "YYYY-MM-DD" date.
export function formatLongDate(dateStr) {
  const [dd, mm, yyyy] = dateStr.includes('/')
    ? dateStr.split('/')
    : dateStr.split('-').reverse();
  return `${dd} ${MONTHS[parseInt(mm, 10) - 1]} ${yyyy}`;
}

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
  ot: null, otN: '', tutQual: null, tutors: [], ov: null,
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
      // Mobile just needs to look like a real number, not merely non-empty - a single digit
      // used to pass this check. 9 digits is the real minimum for a valid UK number (7 let
      // through numbers that were too short to be genuine).
      return !!acc.fname && !!acc.surname && (acc.mobile || '').replace(/\D/g, '').length >= 9;
    case 2:
      return acc.interests.length > 0;
    case 3:
      return !!acc.addr.l1 && !!acc.addr.town && !!acc.addr.pc;
    case 4:
      return acc.decls.length === 3 && acc.decls.every((v) => v === 'yes');
    case 5:
      return true;
    case 6:
      // Mobile is the required contact number here, matching "Your details" (case 1 above) -
      // phone is optional on both.
      return !!acc.sch.name && !!acc.sch.l1 && !!acc.sch.town
        && (acc.sch.mobile || '').replace(/\D/g, '').length >= 9 && !!acc.sch.email;
    case 7:
      return true; // Geocoding - confirming the pin location, nothing to validate.
    case 8:
      return !!acc.ot && !!acc.ov && (
        acc.ot === 'no'
        || (
          acc.tutQual === 'yes' && Number.isInteger(Number(acc.otN)) && Number(acc.otN) > 0
          && acc.tutors.length === Number(acc.otN)
          && acc.tutors.every((t) => !!t.fname && !!t.surname && /\S+@\S+\.\S+/.test(t.email))
        )
      );
    default:
      return true;
  }
}
