(function () {
  "use strict";

  // "Pay now" creates a real Stripe Checkout session via /payments/membership-checkout and
  // redirects there. Everything else is still front-end only: "Save quote" persists to this
  // browser's localStorage alone (no Draft record in CRM yet), and there's no Creator/CRM
  // webhook consuming a completed Stripe payment yet either - see
  // Beauty_Guild_Membership_Solution_Design for the remaining phase.
  var STORAGE_KEY = "bg_membership_quote_draft";
  var API_BASE_URL = "/server/beauty_guild_api";
  var PUBLIC_URL = "/app/index.html?membershipQuote=1";
  var LOGIN_URL = "/app/index.html";
  // Guild of Therapy Lecturers is deliberately excluded - the customer said this branch
  // should not be offered in the online membership journey.
  var BRANCHES = [
    { id: "beauty", name: "Guild of Beauty Therapists" },
    { id: "holistic", name: "Guild of Holistic Therapists" },
    { id: "nails", name: "Guild of Nail Technicians" },
    { id: "hair", name: "Guild of Hairdressers & Barbers" }
  ];
  var AREAS = ["Beauty", "Holistic", "Nails", "Hair", "Training"];
  // Gross (VAT-inclusive) figures, derived from the customer's Fees Table net values:
  // Associate = £35.70 zero-rated + £16.08 standard-rated (+20% VAT) = £55.00.
  // Full Non-Salon/Salon = £35.70 zero-rated + £10.75 standard-rated (+20% VAT) = £48.60.
  // Joining fee (all levels) = £8.33 net (+20% VAT) = £10.00.
  // International membership price is not in the customer's Fees Table - shown as TBC
  // rather than guessed.
  var MEMBERSHIP_LEVELS = [
    { id: "associate", name: "Associate Member", membershipGross: 55.00, joiningGross: 10.00, blurb: "For therapists who are not yet fully qualified or in their first year of practice." },
    { id: "full_non_salon", name: "Full Member (Non-Salon)", membershipGross: 48.60, joiningGross: 10.00, blurb: "For qualified therapists working from home, mobile, or a rented space." },
    { id: "full_salon", name: "Full Member (Salon)", membershipGross: 48.60, joiningGross: 10.00, blurb: "For qualified therapists who own or operate a salon premises." },
    { id: "international", name: "International Member", membershipGross: null, joiningGross: null, blurb: "For members based outside the UK, Channel Islands and Isle of Man. Insurance is not available at this level." }
  ];
  var BRANCH_ADDON_GROSS = 15.00; // £12.50 net + 20% VAT
  var ADDONS = [
    { id: "bundle", name: "Membership bundle", desc: "Includes a certificate, badge and window sticker.", priceGross: 10.00 },
    { id: "certificate", name: "Additional certificate", desc: "", priceGross: 4.00 },
    { id: "badge", name: "Additional badge", desc: "", priceGross: 4.00 },
    { id: "sticker", name: "Additional window sticker", desc: "", priceGross: 4.00 }
  ];
  // CRM's Membership_Extension.Extension_Type values, for reading back a member's existing
  // add-on quantities when pre-filling a renewal quote - "Branch" is deliberately left out,
  // its Membership_Branch value is currently broken (a literal placeholder string) so it isn't
  // reliably readable yet, same reason it's hidden from the portal's own add-ons list.
  var EXTENSION_TYPE_TO_ADDON = { Bundle: "bundle", Certificate: "certificate", Badge: "badge", Sticker: "sticker", "Window Sticker": "sticker" };

  // ---- Insurance (ported from src/insurance/pricing.js, rules.js, documents.js) ----
  // Mirrored here deliberately, same reasoning as the membership pricing constants above -
  // this file is a plain script, not part of the webpack bundle, so it can't import those
  // modules directly. Kept in sync by hand; same figures, same logic, "ins"-prefixed state
  // fields throughout so they never collide with the existing membership fields they now sit
  // alongside in one continuous journey.
  var INS_IPT_RATE = 0.12;
  var INS_TREATMENT_EXTENSIONS = [
    { id: "advanced_electrolysis", name: "Advanced Electrolysis", premium: 28,
      requirements: "Advanced electrolysis level 1, including the removal and reduction of: dilated blood vessels, telangiectasia - dilated blood vessels near the surface of the skin, spider naevus - dilated blood vessels near the surface of the skin, campbell de morgans or cherry angiomas – blood spots, skin tags or papillomas, milia – small raised pearly white or yellowish bumps on the skin, warts - common warts, plane warts - smooth flat growth often yellow in colour, removal of hairs from moles, removal of moles or dermatosis papulosa nigra - benign skin lesions on dark skin. You must ensure that such treatment was included in your advanced electrolysis training course (NVQ Level 3 Beauty Therapy with a unit on advanced electrolysis or an equivalent qualification). You must ensure that you have obtained approval in writing from your client's General Practitioner, which is retained by you alongside the client's general record card, prior to the performance of any advanced electrolysis level 1 treatment for: warts, common warts, plane warts, removal of hairs from moles or removal of moles. If you require further clarification about your advanced electrolysis qualification, please email info@beautyguild.com" },
    { id: "microneedling", name: "Microneedling / Dermarolling", premium: 179.25,
      requirements: "Also includes Nano-needling. Needle sizes can be used on the face up to 1.5 mm and needle sizes can be used on the body up to 3 mm. You must hold NVQ Level 3 Beauty Therapy or equivalent national qualification including A&P plus relevant manufacturer or supplier's training certificate." },
    { id: "piercing", name: "Nose / Cartilage Piercing", premium: 14.15,
      requirements: "You must use only one of the following systems; Blomdahl Medical Ear Piercing System, Caress 2000, Coren, Inverness, Medisept, New Caflon Disposable, Perfex, Studex Ear Piercing System or Trips Sterile Guard. We can also cover piercing that is performed with a single-use, sterile cannula needle. You must also obtain written consent from the parent or guardian of any client aged under 16 prior to performing the treatment." },
    { id: "spmu", name: "Microblading / SPMU / Micropigmentation", premium: 179.25,
      requirements: "Microblading of the eyebrows. Semi-permanent make up and micropigmentation administered for the purposes of eyeliner, eyebrow, lip liner, full lip colour or areola. You must hold NVQ Level 3 or equivalent in Beauty Therapy or NVQ Level 3 or equivalent in Facial Electricals, including A&P plus relevant manufacturer or suppliers training certificate. You must ensure that: 1) your client has read and signed an appropriate consent form prior to their treatment of which you have stored on file, 2) you were qualified to perform treatments to the specific area being treated at the time of treatment and 3) you always use a single use, disposable and sterile instrument which you immediately dispose of into a sharps container following each treatment." },
    { id: "dermaplaning", name: "Dermaplaning", premium: 179.25,
      requirements: "For exfoliation on the skin and removal of fine hairs. You must hold NVQ Level 2 Beauty Therapy or equivalent UK accredited qualification including A&P plus relevant manufacturers or suppliers training certificate." }
  ];
  var INS_TEACHING_REQUIREMENTS = "Cover will be provided for teaching and training provided you hold an acceptable teaching qualification and you are qualified in the treatment that you are teaching.";
  var INS_NON_SALON_EQUIPMENT = [
    { value: 0, label: "Not required", premium: 0 },
    { value: 5000, label: "Up to £5,000", premium: 65 },
    { value: 10000, label: "Up to £10,000", premium: 100 },
    { value: 15000, label: "Up to £15,000", premium: 150 },
    { value: 20000, label: "Up to £20,000", premium: 200 }
  ];
  // Premises not of standard construction (but still at/under the 15% non-standard limit - over
  // that is referred, not priced) are rated at 1.5x the standard-construction premium.
  var INS_NON_SALON_EQUIPMENT_NON_STANDARD = [
    { value: 0, premium: 0 },
    { value: 5000, premium: 97.5 },
    { value: 10000, premium: 150 },
    { value: 15000, premium: 225 },
    { value: 20000, premium: 300 }
  ];
  var INS_NON_SALON_EL = [
    { value: 1, label: "Up to 1 employee", premium: 75 },
    { value: 3, label: "Up to 3 employees", premium: 120 },
    { value: 5, label: "Up to 5 employees", premium: 150 }
  ];
  var INS_DECLARATIONS = [
    "Have you had any insurance claims or losses that may be relevant to this cover?",
    "Have you been declared bankrupt, insolvent or subject to a similar financial event?",
    "Are you aware of any circumstances that may give rise to a claim?",
    "Do you have any relevant criminal convictions or offences to declare?",
    "Have you ever had insurance declined, cancelled or accepted only on special terms?",
    "Are you over 18 and domiciled in the United Kingdom, Channel Islands or Isle of Man?",
    "Do you only provide services within the supported territories?"
  ];
  var INS_LINKS = {
    treatments: { label: "Treatments We Cover", href: "https://www.beautyguild.com/Membership/Treatments-We-Cover" },
    ethics: { label: "Code of Ethics", href: "https://www.beautyguild.com/Membership/Code-Of-Ethics" }
  };
  var INS_DOCUMENT_CATALOGUE = {
    MEDMAL_WORDING: "Medical Malpractice Policy Wording",
    GENERAL_TERMS: "General Terms & Conditions",
    NON_SALON_CONTENTS_WORDING: "Non-Salon Contents Policy Wording",
    NON_SALON_EL_WORDING: "Non-Salon Employers' Liability Policy Wording",
    NON_SALON_PROPERTY_DEFINITIONS: "Non-Salon Property Definitions",
    SALON_EL_WORDING: "Salon Employers' Liability Policy Wording",
    SALON_CONTENTS_WORDING: "Salon Contents Policy Wording",
    SALON_MONEY_WORDING: "Salon Money Policy Wording",
    SALON_BUILDINGS_WORDING: "Salon Buildings Policy Wording",
    SALON_BI_WORDING: "Salon Business Interruption Policy Wording",
    SALON_PROPERTY_AWAY_WORDING: "Salon Property Away Policy Wording",
    SALON_PROPERTY_DEFINITIONS: "Salon Property Definitions"
  };

  function insPositive(value) { return Math.max(0, Number(value || 0)); }

  function insSalonMedMal(turnover) {
    var amount = Number(turnover || 0);
    if (amount <= 100000) return 75;
    if (amount <= 175000) return 100;
    if (amount <= 250000) return 150;
    return null;
  }

  // Mirrors accreditation's own country !== "United Kingdom" check for CI/IoM, which the
  // Guild treats as still-supported (unlike a genuinely unsupported "other" territory).
  function insTerritoryFromCountry(country) {
    var normalized = String(country || "").trim().toLowerCase();
    if (!normalized || normalized === "united kingdom" || normalized === "uk" || normalized === "great britain") return "uk";
    if (normalized.indexOf("channel island") > -1 || normalized === "jersey" || normalized === "guernsey") return "ci";
    if (normalized === "isle of man") return "iom";
    return "other";
  }

  function insurancePropertyRequired(state) {
    return state.insRoute === "salon" && (state.insContents || state.insMoneyCover || state.insBuildingsCover || state.insBiCover || state.insPropertyAwayCover);
  }

  function calculateInsuranceQuote(state) {
    var rows = [];
    function add(code, label, premium) {
      var amount = Number(premium || 0);
      if (amount > 0) rows.push({ code: code, label: label, premium: amount });
    }
    if (state.insRoute === "salon") add("MEDMAL", "Medical Malpractice", insSalonMedMal(state.insTurnover) || 0);
    else add("MEDMAL", "Medical Malpractice", 32.5);

    if (state.insNamedPeopleCover) {
      var insNamedPeople = state.insNamedPeople || [];
      var insEmployeeCount = insNamedPeople.filter(function (p) { return p.type === "employee"; }).length;
      var insSubcontractorCount = insNamedPeople.filter(function (p) { return p.type === "subcontractor"; }).length;
      add("NAMED_EMPLOYEES", "Named employee cover (" + insEmployeeCount + ")", insEmployeeCount * 32.5);
      add("NAMED_SUBCONTRACTORS", "Named subcontractor cover (" + insSubcontractorCount + ")", insSubcontractorCount * 15);
    }
    (state.insTreatmentExtensions || []).forEach(function (id) {
      var extension = INS_TREATMENT_EXTENSIONS.filter(function (item) { return item.id === id; })[0];
      if (extension) add("TREATMENT_" + id.toUpperCase(), extension.name, extension.premium);
    });
    if (state.insTeachingCover === "standard") add("TEACHING", "Teaching + Student Cover", 75);
    if (state.insTeachingCover === "additional") add("TEACHING_PLUS", "Teaching + Student Cover + Additional Treatments", 150);

    if (state.insRoute === "non_salon") {
      var insNonStandard = state.insStandardConstruction === "no";
      var insEquipmentTable = insNonStandard ? INS_NON_SALON_EQUIPMENT_NON_STANDARD : INS_NON_SALON_EQUIPMENT;
      var equipment = insEquipmentTable.filter(function (item) { return item.value === Number(state.insEquipmentTier); })[0];
      if (equipment) add("BUSINESS_EQUIPMENT", "Business Equipment" + (insNonStandard ? " (non-standard construction)" : ""), equipment.premium);
      if (state.insNonSalonEL) {
        var el = INS_NON_SALON_EL.filter(function (item) { return item.value === Number(state.insNonSalonELTier); })[0];
        if (el) add("EMPLOYERS_LIABILITY", "Employers' Liability", el.premium);
      }
    } else {
      if (state.insSalonEL) add("EMPLOYERS_LIABILITY", "Employers' Liability", Math.max(insPositive(state.insWageRoll) * 0.002, 75));
      if (state.insContents) {
        var contentsPremium = Math.max(
          insPositive(state.insComputers) * 0.008 +
          insPositive(state.insEquipment) * 0.02 +
          insPositive(state.insStock) * 0.008 +
          insPositive(state.insGeneralContents) * 0.005 +
          insPositive(state.insTenantImprovements) * 0.0015 +
          insPositive(state.insRentPayable) * 0.0015,
          50
        );
        add("CONTENTS", "Contents", contentsPremium);
      }
      if (state.insMoneyCover) add("MONEY", "Money", 20);
      if (state.insBuildingsCover) {
        var buildingsPremium = Math.max(
          insPositive(state.insBuildingsSI) * 0.0015 +
          insPositive(state.insFixturesSI) * 0.0015 +
          insPositive(state.insRentReceivableSI) * 0.0015,
          75
        );
        add("BUILDINGS", "Buildings", buildingsPremium);
      }
      if (state.insBiCover) {
        var biPremium = Math.max(
          insPositive(state.insBiIncome) * 0.0008 +
          insPositive(state.insBiDebts) * 0.0006,
          50
        );
        add("BUSINESS_INTERRUPTION", "Business Interruption", biPremium);
      }
      if (state.insPropertyAwayCover) add("PROPERTY_AWAY", "Property Away", Math.max(insPositive(state.insPropertyAwaySI) * 0.025, 50));
    }
    var net = rows.reduce(function (sum, row) { return sum + row.premium; }, 0);
    var ipt = net * INS_IPT_RATE;
    return { rows: rows, net: net, ipt: ipt, total: net + ipt };
  }

  function evaluateInsuranceRules(state) {
    var results = [];
    function pushResult(status, code, msg) { results.push({ status: status, code: code, customerMessage: msg }); }
    var territory = insTerritoryFromCountry(state.details.country);
    if (territory === "other") pushResult("STOP", "UNSUPPORTED_TERRITORY", "We cannot complete an online quotation for this territory.");
    if ((state.insNamedPeople || []).length > 4) pushResult("REFER", "NAMED_PEOPLE_LIMIT", "The Insurance team needs to review the number of people working in your business.");
    if (state.insRoute === "salon") {
      if (insPositive(state.insTurnover) > 250000) pushResult("STOP", "SALON_TURNOVER_LIMIT", "Your annual turnover is above the current online quotation limit.");
      if (insPositive(state.insWageRoll) > 125000) pushResult("STOP", "WAGE_ROLL_LIMIT", "Your annual wage roll is above the current online quotation limit.");
      if (insPositive(state.insSalonCount) > 1) pushResult("REFER", "MULTIPLE_SALONS", "More than one salon needs to be reviewed by the Insurance team.");
      if (state.insContents) {
        var totalContents = ["insComputers", "insEquipment", "insStock", "insGeneralContents", "insTenantImprovements", "insRentPayable"].reduce(function (sum, key) { return sum + insPositive(state[key]); }, 0);
        if (totalContents > 250000) pushResult("STOP", "CONTENTS_LIMIT", "Your Contents sum insured is above £250,000.");
        if (state.insSoleOccupation === "no") pushResult("REFER", "SOLE_OCCUPATION", "The Insurance team needs to review sole occupation of your premises.");
        if (state.insStandardConstruction === "no" && state.insNonStandardOver15 === "yes") pushResult("REFER", "NON_STANDARD_CONSTRUCTION_CONTENTS", "The construction of the premises needs to be reviewed by the Insurance team.");
      }
      if (state.insBuildingsCover && state.insBuildingsSubsidenceDeclaration === "no") {
        pushResult("STOP", "BUILDINGS_SUBSIDENCE", "We cannot continue this quotation online based on the subsidence declaration for your buildings cover.");
      }
      if (state.insBuildingsCover) {
        var buildingsTotal = insPositive(state.insBuildingsSI) + insPositive(state.insFixturesSI) + insPositive(state.insRentReceivableSI);
        if (buildingsTotal > 500000) pushResult("STOP", "BUILDINGS_LIMIT", "Your Buildings sum insured is above £500,000.");
      }
      if (state.insBiCover) {
        var biTotal = insPositive(state.insBiIncome) + insPositive(state.insBiDebts);
        if (biTotal > 300000) pushResult("STOP", "BI_LIMIT", "Your Business Interruption sum insured is above £300,000.");
      }
      if (state.insPropertyAwayCover && insPositive(state.insPropertyAwaySI) > 25000) pushResult("STOP", "PROPERTY_AWAY_LIMIT", "Your Property Away sum insured is above £25,000.");
      if (state.insFloodHistory === "yes" && state.insBasement === "yes") pushResult("REFER", "FLOOD_BASEMENT", "The Insurance team needs to review the flood history for this premises.");
      if (state.insSubsidenceHistory === "yes") pushResult("REFER", "SUBSIDENCE_HISTORY", "The Insurance team needs to review the subsidence history for this premises.");
    } else if (Number(state.insEquipmentTier) > 0) {
      if (state.insStandardConstruction === "no" && state.insNonStandardOver15 === "yes") pushResult("REFER", "NON_STANDARD_CONSTRUCTION", "The construction of the premises needs to be reviewed by the Insurance team.");
      if (state.insMultipleAddresses === "yes") pushResult("REFER", "MULTIPLE_ADDRESSES", "Cover across multiple addresses needs to be reviewed by the Insurance team.");
    }
    if ((state.insTreatmentExtensions || []).length) {
      if (state.insQualifiedForTreatments === "no") pushResult("STOP", "TREATMENT_QUALIFICATION", "The required treatment qualifications must be confirmed before continuing.");
      if (state.insPatchTesting === "no") pushResult("STOP", "PATCH_TESTING", "The required patch testing declaration must be confirmed before continuing.");
    }
    if (state.insInformationAccurate === "no") pushResult("STOP", "INFORMATION_ACCURACY", "The information provided must be confirmed as complete and accurate before continuing.");
    if (state.insEthicsAccepted === "no") pushResult("STOP", "CODE_OF_ETHICS", "The Beauty Guild Code of Ethics must be accepted before continuing.");
    if (state.insDemandsNeedsAccepted === "no") pushResult("STOP", "DEMANDS_AND_NEEDS", "The demands and needs confirmation must be accepted before continuing.");
    if (state.insNonAdvisedAccepted === "no") pushResult("STOP", "NON_ADVISED_SALE", "The non-advised sale confirmation must be accepted before continuing.");
    var expected = ["no", "no", "no", "no", "no", "yes", "yes"];
    (state.insDeclarations || []).forEach(function (answer, index) {
      if (answer && answer !== expected[index]) pushResult("REFER", "DECLARATION_" + (index + 1), "One or more declaration answers need to be reviewed by the Insurance team.");
    });
    var stop = results.filter(function (r) { return r.status === "STOP"; });
    var refer = results.filter(function (r) { return r.status === "REFER"; });
    return { results: results, stop: stop, refer: refer, overall: stop.length ? "STOP" : refer.length ? "REFER" : "PASS" };
  }

  // Immediate "call the office" feedback right where the answer was given, rather than only at
  // the end of the wizard - mirrors the legacy quote tool, which shows this the moment a
  // referred/stopped combination is selected (e.g. non-standard construction over 15%).
  function insInlineWarning(state, codes) {
    var results = evaluateInsuranceRules(state).results;
    var hit = results.filter(function (r) { return codes.indexOf(r.code) > -1; })[0];
    if (!hit) return "";
    return '<div class="mq-inline-warning">Unfortunately, we are unable to offer you a quote online. Please contact our office on 01332 224830.</div>';
  }

  function insQuoteDocuments(state) {
    var codes = ["GENERAL_TERMS", "MEDMAL_WORDING"];
    if (state.insRoute === "non_salon") {
      if (state.insNonSalonEL) codes.push("NON_SALON_EL_WORDING");
      if (Number(state.insEquipmentTier) > 0) codes.push("NON_SALON_CONTENTS_WORDING", "NON_SALON_PROPERTY_DEFINITIONS");
    } else {
      if (state.insSalonEL) codes.push("SALON_EL_WORDING");
      if (state.insContents) codes.push("SALON_CONTENTS_WORDING", "SALON_PROPERTY_DEFINITIONS");
      if (state.insMoneyCover) codes.push("SALON_MONEY_WORDING");
      if (state.insBuildingsCover) codes.push("SALON_BUILDINGS_WORDING");
      if (state.insBiCover) codes.push("SALON_BI_WORDING");
      if (state.insPropertyAwayCover) codes.push("SALON_PROPERTY_AWAY_WORDING");
    }
    var seen = {}, out = [];
    codes.forEach(function (code) { if (!seen[code]) { seen[code] = true; out.push({ code: code, name: INS_DOCUMENT_CATALOGUE[code] }); } });
    return out;
  }

  // Fresh object literals every call (not a shared module-level constant) so one draft's
  // in-place edits (e.g. pushing onto insDeclarations) can never leak into another's defaults.
  function insuranceDefaults() {
    return {
      insWorkingFromHome: false, insMobile: false, insRentedRoom: false, insSubcontractor: false, insSalon: false,
      insRoute: "non_salon",
      insTurnover: 85000, insWageRoll: 50000, insSalonCount: 1,
      insNamedPeople: [],
      insNamedPeopleCover: false,
      insTreatmentExtensions: [],
      insQualifiedForTreatments: null, insPatchTesting: null,
      insTeachingCover: "none",
      insEquipmentTier: 0, insStandardConstruction: "yes", insNonStandardOver15: "no", insMultipleAddresses: "no",
      insNonSalonEL: false, insNonSalonELTier: 1,
      insSalonEL: false,
      insContents: false,
      insComputers: 5000, insEquipment: 10000, insStock: 5000, insGeneralContents: 10000, insTenantImprovements: 5000, insRentPayable: 5000,
      insMoneyCover: false,
      insBuildingsCover: false, insBuildingsSI: 100000, insFixturesSI: 25000, insRentReceivableSI: 25000,
      insBiCover: false, insBiIncome: 50000, insBiDebts: 10000,
      insPropertyAwayCover: false, insPropertyAwaySI: 2000,
      insPremisesAddress: { l1: "", l2: "", town: "", county: "", postcode: "", country: "United Kingdom", addrLooked: false },
      insFloodHistory: "no", insBasement: "no", insSubsidenceHistory: "no",
      insSoleOccupation: "yes", insUnoccupiedDeclaration: "yes", insFlatRoof: "no", insBuildingsSubsidenceDeclaration: "yes",
      insDeclarations: [null, null, null, null, null, null, null],
      insInformationAccurate: null, insEthicsAccepted: null, insDemandsNeedsAccepted: null, insNonAdvisedAccepted: null
    };
  }

  // Fills in any field a draft doesn't already have - handles both a brand new state object
  // and an older saved draft from before the insurance fields existed, without touching
  // anything the draft already set.
  function backfillDefaults(target, defaults) {
    Object.keys(defaults).forEach(function (key) {
      if (target[key] === undefined) target[key] = defaults[key];
    });
    return target;
  }

  function initialState() {
    var session = readJson("bg_accreditation_session") || {};
    var saved = readJson(STORAGE_KEY);
    if (saved && saved.version === 2) {
      saved.details = saved.details || {};
      saved.details.firstName = saved.details.firstName || session.firstName || "";
      saved.details.lastName = saved.details.lastName || session.lastName || "";
      saved.details.email = saved.details.email || session.email || "";
      saved.details.confirmEmail = saved.details.confirmEmail || saved.details.email;
      saved.details.phone = saved.details.phone || session.phone || "";
      saved.details.addr1 = saved.details.addr1 || "";
      saved.details.addr2 = saved.details.addr2 || "";
      saved.details.addr3 = saved.details.addr3 || "";
      saved.details.town = saved.details.town || "";
      saved.details.county = saved.details.county || "";
      saved.details.addrLooked = !!saved.details.addrLooked;
      saved.addons = saved.addons || { bundle: 0, certificate: 0, badge: 0, sticker: 0 };
      return backfillDefaults(saved, insuranceDefaults());
    }
    return backfillDefaults({
      version: 2,
      step: 0,
      areas: [],
      insurance: "",
      details: {
        firstName: session.firstName || "",
        lastName: session.lastName || "",
        email: session.email || "",
        confirmEmail: session.email || "",
        phone: session.phone || "",
        businessName: "",
        addr1: "",
        addr2: "",
        addr3: "",
        town: "",
        county: "",
        postcode: "",
        country: "United Kingdom",
        addrLooked: false
      },
      membershipLevel: "",
      primaryBranch: "",
      secondaryBranches: [],
      addons: { bundle: 0, certificate: 0, badge: 0, sticker: 0 },
      termsAccepted: false,
      subscriptionType: "",
      voucher: "",
      saved: false
    }, insuranceDefaults());
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; }
  }

  function persist(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function money(value) { return "£" + Number(value).toFixed(2); }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char];
    });
  }

  function selectedLevel(state) {
    return MEMBERSHIP_LEVELS.filter(function (l) { return l.id === state.membershipLevel; })[0] || null;
  }

  // A member outside the UK only ever sees International Membership - the full (salon/
  // non-salon) and Associate levels aren't offered to them. Within the UK, Associate is
  // always available, but the full membership levels only make sense alongside insurance -
  // they stay hidden until the member says they need insurance, matching the eligibility the
  // Guild actually applies rather than just listing every level regardless of criteria.
  // Renewal is the one flow that never asks the insurance question at all (it starts straight
  // on this step, pre-filled from the existing membership) - applying the gate there would
  // just hide the member's own current level. An upgrade still goes through the insurance
  // question first, same as a new quote, so the gate applies to it normally.
  function visibleMembershipLevels(state) {
    var isUK = state.details.country === "United Kingdom";
    if (!isUK) return MEMBERSHIP_LEVELS.filter(function (l) { return l.id === "international"; });
    return MEMBERSHIP_LEVELS.filter(function (l) {
      if (l.id === "international") return false;
      if (!state.isRenewal && (l.id === "full_non_salon" || l.id === "full_salon") && state.insurance !== "yes") return false;
      return true;
    });
  }

  // The joining fee is a one-off, only paid when someone first becomes a member - not charged
  // again on a renewal or a mid-term upgrade, matching the checkout endpoint's own logic.
  function joiningFeeFor(state, level) {
    return (state.isRenewal || state.isUpgrade) ? 0 : level.joiningGross;
  }

  // null means "price to be confirmed" (international), not zero.
  function membershipComponentTotal(state) {
    var level = selectedLevel(state);
    if (!level || level.membershipGross == null) return null;
    return level.membershipGross + joiningFeeFor(state, level);
  }

  function addonsTotal(state) {
    var total = state.secondaryBranches.length * BRANCH_ADDON_GROSS;
    ADDONS.forEach(function (a) { total += (state.addons[a.id] || 0) * a.priceGross; });
    return total;
  }

  function membershipAndAddonsTotal(state) {
    var membership = membershipComponentTotal(state);
    return (membership == null ? 0 : membership) + addonsTotal(state);
  }

  // The real grand total (membership + add-ons + insurance, when insurance is part of the
  // journey) - used anywhere a single "how much is this quote" figure is needed, such as the
  // Payment step and the saved-quote event. Kept distinct from membershipAndAddonsTotal, which
  // the Quote page's own "Membership total" breakdown line needs to stay membership-only.
  function quoteTotal(state) {
    var total = membershipAndAddonsTotal(state);
    if (state.insurance === "yes") total += calculateInsuranceQuote(state).total;
    return total;
  }

  function quoteReference() {
    var date = new Date();
    return "BGQ-" + String(date.getFullYear()).slice(-2) +
      String(date.getMonth() + 1).padStart(2, "0") +
      String(date.getDate()).padStart(2, "0") + "-" +
      Math.floor(1000 + Math.random() * 9000);
  }

  function isoDate(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);
  }

  function field(name, label, value, type, attrs) {
    return '<label class="mq-field"><span>' + label + '</span><input name="' + name + '" type="' +
      (type || "text") + '" value="' + escapeHtml(value) + '" ' + (attrs || "") + '></label>';
  }

  // Same as field(), but spans both columns of .mq-form-grid - for address lines, which read
  // awkwardly split across the two-column layout the shorter fields use.
  function fullField(name, label, value, type, attrs) {
    return '<label class="mq-field" style="grid-column:1 / -1"><span>' + label + '</span><input name="' + name + '" type="' +
      (type || "text") + '" value="' + escapeHtml(value) + '" ' + (attrs || "") + '></label>';
  }

  // Reuses the exact same country list/flags as AccreditationApp's own Country selects
  // (AddressStep, RegisterAddressStep, ...) - data.js exposes it on window for this file
  // rather than keeping a second copy of ~245 countries in sync by hand. Falls back to a
  // short static list only if that bundle somehow hasn't run yet.
  var FALLBACK_COUNTRIES = ["United Kingdom", "Ireland", "Other"];
  function countryOptionsMarkup(current) {
    var countries = (typeof window !== "undefined" && window.__bgCountries) || FALLBACK_COUNTRIES;
    var meta = (typeof window !== "undefined" && window.__bgCountryMeta) || {};
    return countries.map(function (name) {
      var flag = meta[name] && meta[name].flag;
      var label = flag ? flag + " " + name : name;
      return '<option value="' + escapeHtml(name) + '"' + (name === current ? " selected" : "") + ">" + escapeHtml(label) + "</option>";
    }).join("");
  }

  function choice(name, value, title, copy, checked, type) {
    return '<label class="mq-choice"><input type="' + (type || "radio") + '" name="' + name +
      '" value="' + value + '" ' + (checked ? "checked" : "") + '><span class="mq-choice-mark"></span>' +
      '<span><strong>' + title + '</strong>' + (copy ? '<small>' + copy + '</small>' : "") + '</span></label>';
  }

  function stepCover(state) {
    return '<section class="mq-step"><div class="mq-step-heading"><span class="mq-kicker">About your work</span>' +
      '<h2>What should your membership cover?</h2><p>Select every area you currently work in, then tell us whether you need insurance.</p></div>' +
      '<fieldset class="mq-fieldset"><legend>Areas of work</legend><div class="mq-area-grid">' +
      AREAS.map(function (area) {
        return choice("areas", area.toLowerCase(), area, "", state.areas.indexOf(area.toLowerCase()) > -1, "checkbox");
      }).join("") + '</div><p class="mq-error" data-error="areas"></p></fieldset>' +
      '<fieldset class="mq-fieldset"><legend>Do you require insurance?</legend>' +
      '<p class="mq-help">Professional treatment, public and product liability cover is quoted separately, based on the areas you work in.</p>' +
      '<div class="mq-two-choice">' +
      choice("insurance", "yes", "Yes, I need insurance", "We will quote this separately once your membership details are confirmed", state.insurance === "yes") +
      choice("insurance", "no", "No, membership only", "You can add it later", state.insurance === "no") +
      '</div><p class="mq-error" data-error="insurance"></p></fieldset></section>';
  }

  // Mirrors AccreditationApp's own AddressStep/LoqateAddressLookup: postcode search via
  // /address/find, drill into a "container" row, then /address/retrieve to fill the manual
  // fields - same endpoints, same result shapes, reusing the .loqate-* classes so it looks
  // identical, just re-implemented against this file's own render-on-state-change model
  // rather than React's per-keystroke controlled inputs.
  function addressResultsMarkup(state) {
    var search = state._addressSearch;
    if (!search) return "";
    var out = "";
    if (search.error) out += '<div class="loqate-error" role="alert">' + escapeHtml(search.error) + "</div>";
    if (search.items && search.items.length) {
      out += '<div class="loqate-results" role="listbox" aria-label="Address results">' +
        search.items.map(function (item) {
          var isContainer = item.Type && item.Type !== "Address";
          return '<button type="button" role="option" data-address-item data-target="' + (search.target || "details") + '" data-id="' + escapeHtml(item.Id) +
            '" data-text="' + escapeHtml(item.Text || item.Description) +
            '" data-container="' + (isContainer ? "1" : "0") + '"' + (isContainer ? ' class="loqate-result-container"' : "") + '>' +
            "<span><strong>" + escapeHtml(item.Text || item.Description) + "</strong>" +
            (item.Description && item.Text ? "<span>" + escapeHtml(item.Description) + "</span>" : "") + "</span>" +
            (isContainer ? '<span class="loqate-result-expand" aria-hidden="true">Select to view addresses &rsaquo;</span>' : "") +
            "</button>";
        }).join("") + "</div>";
    }
    return out;
  }

  function stepDetails(state) {
    var d = state.details;
    var isUK = d.country === "United Kingdom";
    var showManualFields = !isUK || d.addrLooked;
    return '<section class="mq-step"><div class="mq-step-heading"><span class="mq-kicker">Your details</span>' +
      '<h2>Tell us who the quote is for</h2><p>We will use these details to prepare and save your quote.</p></div>' +
      '<div class="mq-form-grid">' +
      field("firstName", "First name *", d.firstName, "text", "autocomplete=given-name required") +
      field("lastName", "Last name *", d.lastName, "text", "autocomplete=family-name required") +
      field("email", "Email address *", d.email, "email", "autocomplete=email required") +
      field("confirmEmail", "Confirm email address *", d.confirmEmail, "email", "autocomplete=email required") +
      field("phone", "Phone number *", d.phone, "tel", "autocomplete=tel required") +
      field("businessName", "Business or trading name (optional)", d.businessName, "text", "autocomplete=organization") +
      '<label class="mq-field" style="grid-column:1 / -1"><span>Country</span><select name="country">' + countryOptionsMarkup(d.country) + '</select></label>' +
      (isUK ? '<label class="mq-field" style="grid-column:1 / -1"><span>Postcode or start typing your address *</span>' +
        '<div class="loqate-search-row"><input class="acc-input" name="postcode" value="' + escapeHtml(d.postcode) + '" placeholder="e.g. AB1 2CD, or start typing your address" autocomplete="off">' +
        '<button type="button" class="loqate-search-button" data-address-find>Find address</button></div></label>' +
        '<div id="mq-address-results" style="grid-column:1 / -1">' + (!state._addressSearch || state._addressSearch.target === "details" || !state._addressSearch.target ? addressResultsMarkup(state) : "") + "</div>" : "") +
      (showManualFields ? (
        fullField("addr1", "Address line 1 *", d.addr1) +
        fullField("addr2", "Address line 2 (optional)", d.addr2) +
        fullField("addr3", "Address line 3 (optional)", d.addr3) +
        field("town", "Town / city *", d.town) +
        field("county", "County", d.county) +
        (!isUK ? fullField("postcode", "Postcode / postal code *", d.postcode) : "")
      ) : "") +
      "</div>" +
      (isUK && !d.addrLooked ? '<div class="address-manual-row"><span>Can\'t find the address?</span><button type="button" class="text-action" data-address-manual>Enter address manually</button></div>' : "") +
      '<p class="mq-error" data-error="details"></p></section>';
  }

  function stepMembership(state) {
    var levelCards = visibleMembershipLevels(state).map(function (level) {
      var priceCopy = level.membershipGross != null
        ? (state.isRenewal || state.isUpgrade)
          ? money(level.membershipGross) + " for the year"
          : money(level.membershipGross + level.joiningGross) + " for the year, including the joining fee"
        : "Price confirmed by our team";
      return choice("membershipLevel", level.id, level.name, level.blurb + " " + priceCopy, state.membershipLevel === level.id);
    }).join("");
    var branchCards = BRANCHES.map(function (b) {
      return choice("primaryBranch", b.id, b.name, "", state.primaryBranch === b.id);
    }).join("");
    return '<section class="mq-step"><div class="mq-step-heading"><span class="mq-kicker">Membership</span>' +
      '<h2>Choose your Guild membership</h2><p>Select the membership level that matches how you work, then your primary branch. Your primary branch is included in your membership fee.</p></div>' +
      '<fieldset class="mq-fieldset"><legend>Membership level</legend><div class="mq-area-grid mq-level-grid">' + levelCards + '</div><p class="mq-error" data-error="level"></p></fieldset>' +
      '<fieldset class="mq-fieldset"><legend>Primary branch</legend><div class="mq-area-grid">' + branchCards + '</div><p class="mq-error" data-error="branch"></p></fieldset></section>';
  }

  function quantityRow(addon, qty) {
    return '<div class="mq-addon-row"><div><strong>' + addon.name + '</strong>' +
      (addon.desc ? '<small>' + addon.desc + '</small>' : "") +
      '<span class="mq-addon-price">' + money(addon.priceGross) + ' each</span></div>' +
      '<div class="mq-qty-stepper">' +
      '<button type="button" class="mq-qty-btn" data-qty-minus="' + addon.id + '" aria-label="Decrease ' + addon.name + '">-</button>' +
      '<input type="text" class="mq-qty-input" value="' + qty + '" readonly aria-label="' + addon.name + ' quantity">' +
      '<button type="button" class="mq-qty-btn" data-qty-plus="' + addon.id + '" aria-label="Increase ' + addon.name + '">+</button>' +
      '</div></div>';
  }

  function stepAddons(state) {
    var branchAddonCards = BRANCHES.filter(function (b) { return b.id !== state.primaryBranch; }).map(function (b) {
      var checked = state.secondaryBranches.indexOf(b.id) > -1;
      return choice("secondaryBranch", b.id, b.name, money(BRANCH_ADDON_GROSS) + " per year", checked, "checkbox");
    }).join("");
    var addonRows = ADDONS.map(function (a) { return quantityRow(a, state.addons[a.id] || 0); }).join("");
    return '<section class="mq-step"><div class="mq-step-heading"><span class="mq-kicker">Add-ons</span>' +
      '<h2>Add anything else you need</h2><p>Everything on this page is optional - skip it if you only need your primary membership.</p></div>' +
      '<fieldset class="mq-fieldset"><legend>Additional branches</legend><div class="mq-area-grid">' +
      (branchAddonCards || '<p class="mq-help">No further branches available.</p>') + '</div></fieldset>' +
      '<fieldset class="mq-fieldset"><legend>Membership extras</legend><div class="mq-addon-list">' + addonRows + '</div></fieldset></section>';
  }

  function stepDeclarations(state) {
    return '<section class="mq-step"><div class="mq-step-heading"><span class="mq-kicker">Declarations</span>' +
      '<h2>Terms and declarations</h2><p>Please confirm the following before we save your quote.</p></div>' +
      '<fieldset class="mq-fieldset">' +
      choice("termsAccepted", "yes", "I have read and accept the Guild's Terms of Business and Privacy Policy.", "", state.termsAccepted, "checkbox") +
      '<p class="mq-error" data-error="terms"></p></fieldset></section>';
  }

  function stepPayment(state) {
    var total = quoteTotal(state);
    var monthlyIndicative = total / 12;
    return '<section class="mq-step"><div class="mq-step-heading"><span class="mq-kicker">Payment</span>' +
      '<h2>How would you like to pay?</h2><p>Choose annual or monthly payment. Payment itself is arranged securely after your quote is saved.</p></div>' +
      '<fieldset class="mq-fieldset"><div class="mq-two-choice">' +
      choice("subscriptionType", "annual", "Pay annually", money(total) + " once a year", state.subscriptionType === "annual") +
      choice("subscriptionType", "monthly", "Pay monthly", "From around " + money(monthlyIndicative) + " a month (indicative)", state.subscriptionType === "monthly") +
      '</div><p class="mq-help">The exact monthly amount, and any monthly admin fee, will be confirmed before your subscription starts.</p>' +
      '<p class="mq-error" data-error="payment"></p></fieldset></section>';
  }

  // ---- Insurance steps, inserted into this same journey when state.insurance === "yes" ----
  function stepInsuranceBusiness(state) {
    var choices = [
      ["insWorkingFromHome", "I work from home", "Treatments are carried out from your home address."],
      ["insMobile", "I work mobile", "You travel to customers or different locations."],
      ["insRentedRoom", "I rent a treatment room", "You work from a room within another business."],
      ["insSubcontractor", "I work as a self-employed subcontractor", "You provide services within another business."],
      ["insSalon", "I operate a salon from commercial / retail premises", "This uses the Salon insurance route."]
    ];
    var cardsHtml = choices.map(function (c) {
      return choice(c[0], "yes", c[1], c[2], !!state[c[0]], "checkbox");
    }).join("");
    return '<section class="mq-step"><div class="mq-step-heading"><span class="mq-kicker">Insurance</span>' +
      '<h2>How do you work?</h2><p>Select all that apply. Operating a salon from commercial or retail premises switches the quote to the Salon route.</p></div>' +
      '<fieldset class="mq-fieldset"><legend>Your business</legend><div class="mq-area-grid">' + cardsHtml + '</div></fieldset>' +
      (state.insRoute === "salon" ? (
        '<fieldset class="mq-fieldset"><legend>About your salon</legend><div class="mq-form-grid">' +
        field("insTurnover", "Annual turnover (£)", state.insTurnover, "number") +
        field("insWageRoll", "Gross annual wage roll (£)", state.insWageRoll, "number") +
        field("insSalonCount", "Number of salons", state.insSalonCount, "number", "min=1") +
        '</div></fieldset>'
      ) : "") +
      '<p class="mq-error" data-error="insBusiness"></p></section>';
  }

  // Question and its Yes/No answer on one row, rather than the choice stacked above or below
  // its own label - used for every plain yes/no question across the insurance steps.
  // Small Yes/No pill buttons, same look as the standalone Insurance app's own YesNo
  // component - used instead of the full .mq-choice card style for simple yes/no questions.
  function pillYesNo(name, value, disabled) {
    var yesChecked = value === "yes" || value === true;
    var noChecked = value === "no" || value === false;
    return '<div class="mq-pill-yesno">' +
      '<label><input type="radio" name="' + name + '" value="yes"' + (yesChecked ? " checked" : "") + (disabled ? " disabled" : "") + '>Yes</label>' +
      '<label><input type="radio" name="' + name + '" value="no"' + (noChecked ? " checked" : "") + (disabled ? " disabled" : "") + '>No</label>' +
      '</div>';
  }

  // A bordered white card: bold title + optional grey description on the left, the Yes/No
  // pills on the right - mirrors the standalone Insurance app's .insurance-cover-row design.
  // `locked` greys the card out and disables its pills (used for Money/Buildings/BI/Property
  // Away before Contents is selected); `extraHtml` renders extra fields below once answered Yes.
  function coverCard(name, title, copy, value, options) {
    options = options || {};
    return '<div class="mq-cover-card' + (options.locked ? " locked" : "") + '">' +
      '<div class="mq-cover-card-header"><div><h3>' + escapeHtml(title) + '</h3>' +
      (copy ? "<p>" + escapeHtml(copy + (options.locked ? " Add Contents first." : "")) + "</p>" : "") +
      "</div>" + pillYesNo(name, value, options.locked) + "</div>" +
      (options.extraHtml ? '<div class="mq-cover-card-extra">' + options.extraHtml + "</div>" : "") +
      "</div>";
  }

  function insDependentRow(dependent, name, title, copy, checked, extraHtml) {
    return coverCard(name, title, copy, checked, {
      locked: !dependent,
      extraHtml: (dependent && checked) ? extraHtml : null
    });
  }

  // Up to 4 named people combined (employee or subcontractor), each captured by name - the
  // per-head premium applies regardless of who they are, but the Insurance team needs the
  // actual names on file, not just a headcount.
  function insNamedPeopleRepeater(state) {
    var people = state.insNamedPeople || [];
    var rows = people.map(function (p) {
      return '<div style="align-items:end;display:flex;gap:10px;margin-top:12px" data-person-id="' + p.id + '">' +
        '<label class="mq-field" style="flex:0 0 130px"><span>Type</span><select data-person-field="type" data-person-id="' + p.id + '">' +
        '<option value="employee"' + (p.type === "employee" ? " selected" : "") + '>Employee</option>' +
        '<option value="subcontractor"' + (p.type === "subcontractor" ? " selected" : "") + '>Subcontractor</option>' +
        '</select></label>' +
        '<label class="mq-field" style="flex:1"><span>First name</span><input class="acc-input" data-person-field="firstName" data-person-id="' + p.id + '" value="' + escapeHtml(p.firstName || "") + '"></label>' +
        '<label class="mq-field" style="flex:1"><span>Last name</span><input class="acc-input" data-person-field="lastName" data-person-id="' + p.id + '" value="' + escapeHtml(p.lastName || "") + '"></label>' +
        '<button type="button" class="text-action" style="flex:0 0 auto;height:42px" data-remove-named-person="' + p.id + '">Remove</button>' +
        '</div>';
    }).join("");
    return rows + (people.length < 4
      ? '<button type="button" class="acc-btn-secondary" data-add-named-person style="margin-top:10px">+ Add person</button>'
      : '<p class="mq-help" style="margin-top:10px">Up to 4 named people can be added online. For more, please call our team.</p>');
  }

  function stepInsuranceCoverNonSalon(state) {
    var equipmentOptions = INS_NON_SALON_EQUIPMENT.map(function (item) {
      return '<option value="' + item.value + '"' + (Number(state.insEquipmentTier) === item.value ? " selected" : "") + '>' + item.label + (item.premium ? " · " + money(item.premium) : "") + '</option>';
    }).join("");
    var elOptions = INS_NON_SALON_EL.map(function (item) {
      return '<option value="' + item.value + '"' + (Number(state.insNonSalonELTier) === item.value ? " selected" : "") + '>' + item.label + " · " + money(item.premium) + '</option>';
    }).join("");
    return '<fieldset class="mq-fieldset"><legend>Business equipment</legend>' +
      '<label class="mq-field"><span>Equipment cover</span><select name="insEquipmentTier">' + equipmentOptions + '</select></label>' +
      (Number(state.insEquipmentTier) > 0 ? (
        '<div class="mq-form-grid" style="margin-top:12px">' +
        '<label class="mq-field"><span>Are the premises of standard construction?</span><select name="insStandardConstruction"><option value="yes"' + (state.insStandardConstruction === "yes" ? " selected" : "") + '>Yes</option><option value="no"' + (state.insStandardConstruction === "no" ? " selected" : "") + '>No</option></select></label>' +
        (state.insStandardConstruction === "no" ? '<label class="mq-field"><span>Is more than 15% non-standard construction?</span><select name="insNonStandardOver15"><option value="no"' + (state.insNonStandardOver15 === "no" ? " selected" : "") + '>No</option><option value="yes"' + (state.insNonStandardOver15 === "yes" ? " selected" : "") + '>Yes</option></select></label>' : "") +
        '<label class="mq-field"><span>Do you need cover for multiple addresses?</span><select name="insMultipleAddresses"><option value="no"' + (state.insMultipleAddresses === "no" ? " selected" : "") + '>No</option><option value="yes"' + (state.insMultipleAddresses === "yes" ? " selected" : "") + '>Yes</option></select></label>' +
        '</div>' +
        insInlineWarning(state, ["NON_STANDARD_CONSTRUCTION", "MULTIPLE_ADDRESSES"])
      ) : "") + '</fieldset>' +
      coverCard("insNonSalonEL", "Employers' Liability", null, state.insNonSalonEL, {
        extraHtml: state.insNonSalonEL ? '<label class="mq-field"><span>Cover level</span><select name="insNonSalonELTier">' + elOptions + '</select></label>' : null
      });
  }

  function stepInsuranceCoverSalon(state) {
    var html = coverCard("insSalonEL", "Employers' Liability", "0.2% of wage roll, minimum £75.", state.insSalonEL);
    html += coverCard("insContents", "Contents", "Contents unlocks Money, Buildings, Business Interruption and Property Away.", state.insContents, {
      extraHtml: state.insContents ? (
        '<div class="mq-form-grid">' +
        field("insComputers", "Computers & ancillary (£)", state.insComputers, "number") +
        field("insEquipment", "Beauty/styling equipment & tools (£)", state.insEquipment, "number") +
        field("insStock", "Business stock (£)", state.insStock, "number") +
        field("insGeneralContents", "General contents (£)", state.insGeneralContents, "number") +
        field("insTenantImprovements", "Tenant improvements (£)", state.insTenantImprovements, "number") +
        field("insRentPayable", "Rent payable (£)", state.insRentPayable, "number") +
        '</div>'
      ) : null
    });
    var dependent = state.insContents;
    html += insDependentRow(dependent, "insMoneyCover", "Money", "Fixed premium £20.", state.insMoneyCover);
    html += insDependentRow(dependent, "insBuildingsCover", "Buildings", "Buildings, fixtures/fittings and rent receivable.", state.insBuildingsCover,
      '<div class="mq-form-grid" style="margin-top:12px">' + field("insBuildingsSI", "Buildings sum insured (£)", state.insBuildingsSI, "number") + field("insFixturesSI", "Fixtures & fittings (£)", state.insFixturesSI, "number") + field("insRentReceivableSI", "Rent receivable (£)", state.insRentReceivableSI, "number") + '</div>');
    html += insDependentRow(dependent, "insBiCover", "Business Interruption", "Loss of income and outstanding debts.", state.insBiCover,
      '<div class="mq-form-grid" style="margin-top:12px">' + field("insBiIncome", "Loss of income sum insured (£)", state.insBiIncome, "number") + field("insBiDebts", "Outstanding debts sum insured (£)", state.insBiDebts, "number") + '</div>');
    html += insDependentRow(dependent, "insPropertyAwayCover", "Property Away", "Property temporarily away from the salon premises.", state.insPropertyAwayCover,
      '<div class="mq-form-grid" style="margin-top:12px">' + field("insPropertyAwaySI", "Property Away sum insured (£)", state.insPropertyAwaySI, "number") + '</div>');
    return html;
  }

  // A checkbox card plus a native <details> disclosure for the requirements text, kept as a
  // sibling of the <label> (not nested inside it) so opening/closing the details never also
  // toggles the checkbox - the two interactive elements never compete for the same click.
  function treatmentExtensionCard(item, checked) {
    return '<div class="mq-choice-wrap"><label class="mq-choice"><input type="checkbox" name="insTreatmentExtensions" value="' + item.id + '" ' + (checked ? "checked" : "") + '><span class="mq-choice-mark"></span>' +
      '<span><strong>' + item.name + '</strong><small>' + money(item.premium) + ' + IPT</small></span></label>' +
      '<details class="mq-info-details"><summary>Requirements</summary><p>' + escapeHtml(item.requirements) + '</p></details></div>';
  }

  function stepInsuranceCover(state) {
    var corePrice = state.insRoute === "salon" ? insSalonMedMal(state.insTurnover) : 32.5;
    var extensionCards = INS_TREATMENT_EXTENSIONS.map(function (item) {
      return treatmentExtensionCard(item, state.insTreatmentExtensions.indexOf(item.id) > -1);
    }).join("");
    var teachingCards =
      choice("insTeachingCover", "none", "Not required", "", state.insTeachingCover === "none") +
      choice("insTeachingCover", "standard", "Teaching + Student Cover", money(75) + " + IPT", state.insTeachingCover === "standard") +
      choice("insTeachingCover", "additional", "Teaching + Student + Additional Treatments", money(150) + " + IPT", state.insTeachingCover === "additional");

    var html = '<section class="mq-step"><div class="mq-step-heading"><span class="mq-kicker">Insurance</span>' +
      '<h2>Build your cover</h2><p>Only answer the questions relevant to the cover you add.</p></div>' +
      '<div class="mq-quote-hero" style="margin-bottom:18px"><div><span>Medical Malpractice</span><strong>' + (corePrice == null ? "Review" : money(corePrice)) + '</strong><small>Core Beauty Guild treatment liability cover</small></div></div>' +
      coverCard("insNamedPeopleCover", "Named employee / subcontractor cover", "Separate cover for people working in your business.", state.insNamedPeopleCover, {
        extraHtml: state.insNamedPeopleCover ? insNamedPeopleRepeater(state) : null
      }) +
      '<fieldset class="mq-fieldset"><legend>Additional treatment extensions</legend><div class="mq-area-grid">' + extensionCards + '</div></fieldset>' +
      (state.insTreatmentExtensions.length ? (
        coverCard("insQualifiedForTreatments", "Qualifications", "Do you and relevant employees hold the required qualifications?", state.insQualifiedForTreatments) +
        coverCard("insPatchTesting", "Patch testing", "Do you agree to carry out sensitivity patch tests for relevant treatments?", state.insPatchTesting)
      ) : "") +
      '<fieldset class="mq-fieldset"><legend>Teaching cover</legend>' +
      '<details class="mq-info-details" style="margin-bottom:10px"><summary>Requirements</summary><p>' + escapeHtml(INS_TEACHING_REQUIREMENTS) + '</p></details>' +
      '<div class="mq-two-choice" style="grid-template-columns:repeat(3,1fr)">' + teachingCards + '</div></fieldset>';

    html += state.insRoute === "non_salon" ? stepInsuranceCoverNonSalon(state) : stepInsuranceCoverSalon(state);
    return html + '<p class="mq-error" data-error="insCover"></p></section>';
  }

  function stepInsuranceProperty(state) {
    var p = state.insPremisesAddress;
    var isUK = p.country === "United Kingdom";
    var showManualFields = !isUK || p.addrLooked;
    return '<section class="mq-step"><div class="mq-step-heading"><span class="mq-kicker">Insurance</span>' +
      '<h2>Tell us about your premises</h2><p>We will use these details to check whether the property can be quoted online or needs review by the Insurance team. Pre-filled from your details - update it if your premises address is different.</p></div>' +
      '<fieldset class="mq-fieldset"><legend>Premises address</legend><div class="mq-form-grid">' +
      (isUK ? '<label class="mq-field" style="grid-column:1 / -1"><span>Postcode or start typing your address</span>' +
        '<div class="loqate-search-row"><input class="acc-input" name="insPremisesPostcode" value="' + escapeHtml(p.postcode) + '" placeholder="e.g. AB1 2CD, or start typing your address" autocomplete="off">' +
        '<button type="button" class="loqate-search-button" data-address-find data-address-target="insPremises">Find address</button></div></label>' +
        '<div id="mq-premises-address-results" style="grid-column:1 / -1">' + (state._addressSearch && state._addressSearch.target === "insPremises" ? addressResultsMarkup(state) : "") + "</div>" : "") +
      (showManualFields ? (
        fullField("insPremisesAddr1", "Address line 1", p.l1) +
        fullField("insPremisesAddr2", "Address line 2 (optional)", p.l2) +
        field("insPremisesTown", "Town / city", p.town) +
        field("insPremisesCounty", "County", p.county) +
        (!isUK ? fullField("insPremisesPostcode", "Postcode / postal code", p.postcode) : "")
      ) : "") +
      '</div>' +
      (isUK && !p.addrLooked ? '<div class="address-manual-row"><span>Can\'t find the address?</span><button type="button" class="text-action" data-address-manual data-address-target="insPremises">Enter address manually</button></div>' : "") +
      '</fieldset>' +
      '<fieldset class="mq-fieldset"><legend>Risk history</legend><div class="mq-form-grid">' +
      '<label class="mq-field"><span>Has the property previously suffered flooding?</span><select name="insFloodHistory"><option value="no"' + (state.insFloodHistory === "no" ? " selected" : "") + '>No</option><option value="yes"' + (state.insFloodHistory === "yes" ? " selected" : "") + '>Yes</option></select></label>' +
      '<label class="mq-field"><span>Does the property have a basement?</span><select name="insBasement"><option value="no"' + (state.insBasement === "no" ? " selected" : "") + '>No</option><option value="yes"' + (state.insBasement === "yes" ? " selected" : "") + '>Yes</option></select></label>' +
      '<label class="mq-field"><span>Previous subsidence / landslip / structural movement?</span><select name="insSubsidenceHistory"><option value="no"' + (state.insSubsidenceHistory === "no" ? " selected" : "") + '>No</option><option value="yes"' + (state.insSubsidenceHistory === "yes" ? " selected" : "") + '>Yes</option></select></label>' +
      '</div>' + insInlineWarning(state, ["FLOOD_BASEMENT", "SUBSIDENCE_HISTORY"]) + '</fieldset>' +
      '<fieldset class="mq-fieldset"><legend>Contents construction & occupancy</legend><div class="mq-form-grid">' +
      '<label class="mq-field"><span>My business premises are occupied solely by me for the purposes of the business or with an element of residential accommodation.</span><select name="insSoleOccupation"><option value="yes"' + (state.insSoleOccupation === "yes" ? " selected" : "") + '>Yes</option><option value="no"' + (state.insSoleOccupation === "no" ? " selected" : "") + '>No</option></select></label>' +
      '<label class="mq-field"><span>My business premises are not left unoccupied for more than 30 consecutive days.</span><select name="insUnoccupiedDeclaration"><option value="yes"' + (state.insUnoccupiedDeclaration === "yes" ? " selected" : "") + '>Yes</option><option value="no"' + (state.insUnoccupiedDeclaration === "no" ? " selected" : "") + '>No</option></select></label>' +
      '<label class="mq-field"><span>My premises are of Standard Construction?</span><select name="insStandardConstruction"><option value="yes"' + (state.insStandardConstruction === "yes" ? " selected" : "") + '>Yes</option><option value="no"' + (state.insStandardConstruction === "no" ? " selected" : "") + '>No</option></select></label>' +
      (state.insStandardConstruction === "no" ? '<label class="mq-field"><span>Is more than 15% of your premises made of Non-Standard Construction?</span><select name="insNonStandardOver15"><option value="no"' + (state.insNonStandardOver15 === "no" ? " selected" : "") + '>No</option><option value="yes"' + (state.insNonStandardOver15 === "yes" ? " selected" : "") + '>Yes</option></select></label>' : "") +
      '<label class="mq-field"><span>Is your premises constructed with a Flat Roof?</span><select name="insFlatRoof"><option value="no"' + (state.insFlatRoof === "no" ? " selected" : "") + '>No</option><option value="yes"' + (state.insFlatRoof === "yes" ? " selected" : "") + '>Yes</option></select></label>' +
      '</div>' + (state.insFlatRoof === "yes" ? '<p class="mq-help" style="margin-top:10px">A flat roof may affect your cover - the Insurance team may be in touch with guidance, but you can continue with your quote.</p>' : "") +
      insInlineWarning(state, ["SOLE_OCCUPATION", "NON_STANDARD_CONSTRUCTION_CONTENTS"]) + '</fieldset>' +
      (state.insBuildingsCover ? (
        '<fieldset class="mq-fieldset"><legend>Buildings declaration</legend><div class="mq-form-grid">' +
        '<label class="mq-field" style="grid-column:1 / -1"><span>My business premises are free from cracks or other signs of damage that may be due to subsidence, landslip or heave and have not previously suffered damage by any of these and are not in a known subsidence area.</span><select name="insBuildingsSubsidenceDeclaration"><option value="yes"' + (state.insBuildingsSubsidenceDeclaration === "yes" ? " selected" : "") + '>Yes</option><option value="no"' + (state.insBuildingsSubsidenceDeclaration === "no" ? " selected" : "") + '>No</option></select></label>' +
        '</div>' + insInlineWarning(state, ["BUILDINGS_SUBSIDENCE"]) + '</fieldset>'
      ) : "") +
      '</section>';
  }

  function stepInsuranceDeclarations(state) {
    var declarationsHtml = INS_DECLARATIONS.map(function (q, index) {
      var name = "insDeclaration_" + index;
      return coverCard(name, q, null, state.insDeclarations[index]);
    }).join("");

    var coverLabels = [
      state.insRoute === "salon" ? "Salon Medical Malpractice" : "Medical Malpractice",
      state.insNamedPeopleCover ? "named employee/subcontractor cover" : null,
      state.insTreatmentExtensions.length ? "additional treatment extensions" : null,
      state.insTeachingCover !== "none" ? "teaching cover" : null,
      state.insRoute === "non_salon" && Number(state.insEquipmentTier) > 0 ? "business equipment" : null,
      state.insRoute === "non_salon" && state.insNonSalonEL ? "Employers' Liability" : null,
      state.insRoute === "salon" && state.insSalonEL ? "Employers' Liability" : null,
      state.insRoute === "salon" && state.insContents ? "Contents" : null,
      state.insRoute === "salon" && state.insMoneyCover ? "Money" : null,
      state.insRoute === "salon" && state.insBuildingsCover ? "Buildings" : null,
      state.insRoute === "salon" && state.insBiCover ? "Business Interruption" : null,
      state.insRoute === "salon" && state.insPropertyAwayCover ? "Property Away" : null
    ].filter(Boolean).join(", ");

    return '<section class="mq-step"><div class="mq-step-heading"><span class="mq-kicker">Insurance</span>' +
      '<h2>Please answer these questions carefully</h2><p>Some answers may mean the Insurance team needs to review the quotation before cover can be confirmed.</p></div>' +
      '<p class="mq-help" style="margin-bottom:14px"><a class="mq-link" href="' + INS_LINKS.treatments.href + '" target="_blank" rel="noreferrer">' + INS_LINKS.treatments.label + '</a> · <a class="mq-link" href="' + INS_LINKS.ethics.href + '" target="_blank" rel="noreferrer">' + INS_LINKS.ethics.label + '</a></p>' +
      declarationsHtml +
      coverCard("insInformationAccurate", "I confirm the information provided is complete and accurate.", null, state.insInformationAccurate) +
      coverCard("insEthicsAccepted", "I agree to comply with the Beauty Guild Code of Ethics.", null, state.insEthicsAccepted) +
      coverCard("insDemandsNeedsAccepted", "Demands and needs - is this correct?", "This quotation has been built for the cover selected: " + coverLabels + ".", state.insDemandsNeedsAccepted) +
      coverCard("insNonAdvisedAccepted", "I understand this is a non-advised sale.", "No personal recommendation has been made about whether this insurance is suitable for me.", state.insNonAdvisedAccepted) +
      '<p class="mq-error" data-error="insDeclarations"></p></section>';
  }

  function line(label, value, emphasized) {
    return '<div class="mq-quote-line ' + (emphasized ? "is-total" : "") + '"><span>' + label + '</span><strong>' + value + '</strong></div>';
  }

  function stepQuote(state, entryPoint) {
    var level = selectedLevel(state);
    var primary = BRANCHES.filter(function (b) { return b.id === state.primaryBranch; })[0];
    var start = new Date();
    var end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate() - 1);
    var ref = state.reference || quoteReference();
    state.reference = ref;
    var membership = membershipComponentTotal(state);
    var levelTbc = membership == null;
    var membershipTotal = membershipAndAddonsTotal(state);
    var hasInsurance = state.insurance === "yes";
    var insQuote = hasInsurance ? calculateInsuranceQuote(state) : null;
    var insRules = hasInsurance ? evaluateInsuranceRules(state) : null;
    var combinedTotal = levelTbc ? null : membershipTotal + (insQuote ? insQuote.total : 0);
    var addonLines = state.secondaryBranches.map(function (id) {
      var b = BRANCHES.filter(function (item) { return item.id === id; })[0];
      return line(b.name, money(BRANCH_ADDON_GROSS));
    }).join("") + ADDONS.filter(function (a) { return (state.addons[a.id] || 0) > 0; }).map(function (a) {
      var qty = state.addons[a.id];
      return line(a.name + " x" + qty, money(a.priceGross * qty));
    }).join("");
    var headlinePrice = combinedTotal == null ? "TBC" : money(state.subscriptionType === "monthly" ? combinedTotal / 12 : combinedTotal);

    var insuranceSection = "";
    if (hasInsurance) {
      if (insRules.overall !== "PASS") {
        insuranceSection = '<div class="insurance-handoff-warning" style="margin-top:20px;border:1px solid ' + (insRules.overall === "STOP" ? "#f1cad5" : "#efd5a7") + ';background:' + (insRules.overall === "STOP" ? "#fff1f5" : "#fff7e8") + ';border-radius:10px;padding:14px 16px;font-size:12px;color:' + (insRules.overall === "STOP" ? "#8e2745" : "#80551a") + '">' +
          '<strong>' + (insRules.overall === "STOP" ? "We cannot complete the insurance quotation online." : "Some insurance details will need review.") + '</strong>' +
          '<div style="margin-top:6px">' + insRules.stop.concat(insRules.refer).map(function (item) { return "• " + escapeHtml(item.customerMessage); }).join("<br>") + '</div></div>';
      }
      var insRows = insQuote.rows.map(function (row) { return line(row.label, money(row.premium)); }).join("");
      insuranceSection += '<div class="mq-review-grid" style="margin-top:20px"><div><h3>Insurance</h3>' +
        insRows +
        line("Insurance Premium Tax (12%)", money(insQuote.ipt)) +
        line("Insurance total", money(insQuote.total), true) + '</div>' +
        '<div><h3>Policy documents</h3>' + insQuoteDocuments(state).map(function (doc) { return line(doc.name, "Included"); }).join("") + '</div></div>';
    }

    return '<section class="mq-step mq-review"><div class="mq-step-heading"><span class="mq-kicker">Your quote</span>' +
      '<h2>' + (state.saved ? "Your quote is saved" : "Review your quote") + '</h2><p>' +
      (state.saved ? (entryPoint === "public" ? "This quote is saved on this device. No payment has been taken." : "We have saved this quote in your membership area. No payment has been taken.") :
        "Check the details below. You can amend them before saving your quote, or choose to pay now.") + '</p></div>' +
      '<div class="mq-quote-hero"><div><span>' + (state.subscriptionType === "monthly" ? "Indicative monthly price" : "Annual price") + (hasInsurance ? " (membership + insurance)" : "") + '</span><strong>' + headlinePrice + '</strong><small>Quote reference ' + ref + '</small></div>' +
      '<span class="mq-status">' + (state.saved ? "Saved" : "Ready to save") + '</span></div>' +
      '<p class="mq-error" data-error="payment-submit"></p>' +
      '<div class="mq-review-grid"><div><h3>Membership</h3>' +
      line((level ? level.name : "Guild membership") + (primary ? " - " + primary.name : ""), levelTbc ? "Confirmed by our team" : money(level.membershipGross)) +
      (levelTbc || state.isRenewal || state.isUpgrade ? "" : line("Joining fee", money(level.joiningGross))) +
      addonLines +
      line("Membership total", levelTbc ? "Confirmed by our team" : money(membershipTotal), !hasInsurance) + '</div>' +
      '<div><h3>Quote details</h3>' + line("For", escapeHtml(state.details.firstName + " " + state.details.lastName)) +
      line("Email", escapeHtml(state.details.email)) + line("Starts", formatDate(start)) + line("Ends", formatDate(end)) +
      line("Payment", state.subscriptionType === "monthly" ? "Monthly" : "Annually") +
      line("Cover", hasInsurance ? "Membership + insurance" : "Membership only") + '</div></div>' +
      insuranceSection +
      (hasInsurance && combinedTotal != null ? '<div class="mq-review-grid" style="margin-top:14px"><div>' + line("Grand total for the year", money(combinedTotal), true) + '</div><div></div></div>' : "") +
      (state.saved ? '<div class="mq-success"><span class="mq-success-check">✓</span><div><strong>Quote saved successfully</strong><p>' + (entryPoint === "public" ? "Log in to continue with this quote from your membership area." : "Your quote is ready in your membership area.") + '</p>' + (entryPoint === "public" ? '<a class="mq-login-link" href="' + LOGIN_URL + '">Log in to continue</a>' : "") + '</div></div>' : "") + '</section>';
  }

  // The step sequence is dynamic, not fixed - insurance's own steps (and its conditional
  // Property step) are inserted only when state.insurance === "yes", so "Yes" on Cover
  // continues the SAME journey rather than forking into a separately-branded flow.
  var STEP_DEFS = {
    cover: { label: "Cover", render: stepCover },
    details: { label: "Your details", render: stepDetails },
    membership: { label: "Membership", render: stepMembership },
    addons: { label: "Add-ons", render: stepAddons },
    insBusiness: { label: "Your business", render: stepInsuranceBusiness },
    insCover: { label: "Your cover", render: stepInsuranceCover },
    insProperty: { label: "Property", render: stepInsuranceProperty },
    insDeclarations: { label: "Insurance info", render: stepInsuranceDeclarations },
    declarations: { label: "Declarations", render: stepDeclarations },
    payment: { label: "Payment", render: stepPayment }
  };

  function stepKeys(state) {
    var keys = ["cover", "details", "membership", "addons"];
    if (state.insurance === "yes") {
      keys = keys.concat(["insBusiness", "insCover"]);
      if (insurancePropertyRequired(state)) keys.push("insProperty");
      keys.push("insDeclarations");
    }
    return keys.concat(["declarations", "payment"]);
  }

  function stepLabels(state) {
    return stepKeys(state).map(function (k) { return STEP_DEFS[k].label; }).concat(["Your quote"]);
  }

  function renderStep(state, entryPoint) {
    var keys = stepKeys(state);
    return state.step === keys.length ? stepQuote(state, entryPoint) : STEP_DEFS[keys[state.step]].render(state);
  }

  function validate(state, root) {
    var message = "";
    var key = stepKeys(state)[state.step];
    if (key === "cover" && !state.areas.length) { message = "Select at least one area of work."; setError(root, "areas", message); }
    if (key === "cover" && !state.insurance) { message = "Choose whether you require insurance."; setError(root, "insurance", message); }
    if (key === "details") {
      var d = state.details;
      if (!d.firstName || !d.lastName || !d.email || !d.phone || !d.postcode || !d.addr1 || !d.town) message = "Complete all required fields before continuing.";
      else if (!/^\S+@\S+\.\S+$/.test(d.email)) message = "Enter a valid email address.";
      else if (d.email.toLowerCase() !== d.confirmEmail.toLowerCase()) message = "The email addresses do not match.";
      setError(root, "details", message);
    }
    if (key === "membership") {
      if (!state.membershipLevel) { message = "Choose a membership level."; setError(root, "level", message); }
      else if (!state.primaryBranch) { message = "Choose a primary membership branch."; setError(root, "branch", message); }
    }
    if (key === "insBusiness" && !(state.insWorkingFromHome || state.insMobile || state.insRentedRoom || state.insSubcontractor || state.insSalon)) {
      message = "Select at least one way you work."; setError(root, "insBusiness", message);
    }
    if (key === "insCover" && state.insTreatmentExtensions.length && !(state.insQualifiedForTreatments && state.insPatchTesting)) {
      message = "Confirm qualifications and patch testing for your selected treatments."; setError(root, "insCover", message);
    }
    if (key === "insCover" && state.insNamedPeopleCover) {
      var namedPeople = state.insNamedPeople || [];
      if (!namedPeople.length || !namedPeople.every(function (p) { return p.firstName && p.lastName; })) {
        message = "Add the name of each person you want named on the policy."; setError(root, "insCover", message);
      }
    }
    if (key === "insDeclarations") {
      var declarationsOk = state.insDeclarations.every(Boolean)
        && state.insInformationAccurate === "yes" && state.insEthicsAccepted === "yes"
        && state.insDemandsNeedsAccepted === "yes" && state.insNonAdvisedAccepted === "yes";
      if (!declarationsOk) { message = "Answer every question and accept all confirmations before continuing."; setError(root, "insDeclarations", message); }
    }
    if (key === "declarations" && !state.termsAccepted) { message = "You must accept the Terms of Business and Privacy Policy to continue."; setError(root, "terms", message); }
    if (key === "payment" && !state.subscriptionType) { message = "Choose how you would like to pay."; setError(root, "payment", message); }
    return !message;
  }

  function setError(root, name, message) {
    var el = root.querySelector('[data-error="' + name + '"]');
    if (el) el.textContent = message;
  }

  function syncInputs(root, state) {
    var areas = Array.prototype.slice.call(root.querySelectorAll('input[name="areas"]:checked'));
    if (areas.length || state.step === 0) state.areas = areas.map(function (el) { return el.value; });
    var insurance = root.querySelector('input[name="insurance"]:checked');
    if (insurance) state.insurance = insurance.value;
    if (state.step === 1) {
      Object.keys(state.details).forEach(function (key) {
        var el = root.querySelector('[name="' + key + '"]');
        if (el) state.details[key] = el.value.trim();
      });
    }
    var level = root.querySelector('input[name="membershipLevel"]:checked');
    if (level) state.membershipLevel = level.value;
    // Changing insurance or country can make the previously-picked level no longer eligible
    // (e.g. switching insurance to "No" while Full Member (Salon) was selected) - clear it
    // rather than silently keep charging for a level that's no longer shown or offered. When
    // exactly one level is left (the non-UK case), default straight to it.
    var eligibleLevels = visibleMembershipLevels(state);
    var eligibleIds = eligibleLevels.map(function (l) { return l.id; });
    if (state.membershipLevel && eligibleIds.indexOf(state.membershipLevel) === -1) state.membershipLevel = "";
    if (!state.membershipLevel && eligibleLevels.length === 1) state.membershipLevel = eligibleLevels[0].id;
    var primary = root.querySelector('input[name="primaryBranch"]:checked');
    if (primary) state.primaryBranch = primary.value;
    if (state.step === 3) {
      state.secondaryBranches = Array.prototype.slice.call(root.querySelectorAll('input[name="secondaryBranch"]:checked')).map(function (el) { return el.value; }).filter(function (id) { return id !== state.primaryBranch; });
    }
    state.termsAccepted = !!root.querySelector('input[name="termsAccepted"]:checked');
    var payment = root.querySelector('input[name="subscriptionType"]:checked');
    if (payment) state.subscriptionType = payment.value;

    // Insurance fields - every read is null-guarded, so it's safe to run these on every step
    // rather than only when the relevant insurance step happens to be the one on screen.
    ["insWorkingFromHome", "insMobile", "insRentedRoom", "insSubcontractor", "insSalon"].forEach(function (key) {
      var el = root.querySelector('[name="' + key + '"]');
      if (el) state[key] = el.checked;
    });
    state.insRoute = state.insSalon ? "salon" : "non_salon";
    ["insTurnover", "insWageRoll", "insSalonCount",
      "insComputers", "insEquipment", "insStock", "insGeneralContents", "insTenantImprovements", "insRentPayable",
      "insBuildingsSI", "insFixturesSI", "insRentReceivableSI", "insBiIncome", "insBiDebts", "insPropertyAwaySI"].forEach(function (key) {
      var el = root.querySelector('[name="' + key + '"]');
      if (el) state[key] = el.value;
    });
    var namedPeopleEl = root.querySelector('input[name="insNamedPeopleCover"]:checked');
    if (namedPeopleEl) state.insNamedPeopleCover = namedPeopleEl.value === "yes";
    (state.insNamedPeople || []).forEach(function (person) {
      var typeEl = root.querySelector('[data-person-field="type"][data-person-id="' + person.id + '"]');
      var firstEl = root.querySelector('[data-person-field="firstName"][data-person-id="' + person.id + '"]');
      var lastEl = root.querySelector('[data-person-field="lastName"][data-person-id="' + person.id + '"]');
      if (typeEl) person.type = typeEl.value;
      if (firstEl) person.firstName = firstEl.value;
      if (lastEl) person.lastName = lastEl.value;
    });
    if (root.querySelector('input[name="insTreatmentExtensions"]')) {
      state.insTreatmentExtensions = Array.prototype.slice.call(root.querySelectorAll('input[name="insTreatmentExtensions"]:checked')).map(function (el) { return el.value; });
    }
    var qualifiedEl = root.querySelector('input[name="insQualifiedForTreatments"]:checked');
    if (qualifiedEl) state.insQualifiedForTreatments = qualifiedEl.value;
    var patchEl = root.querySelector('input[name="insPatchTesting"]:checked');
    if (patchEl) state.insPatchTesting = patchEl.value;
    var teachingEl = root.querySelector('input[name="insTeachingCover"]:checked');
    if (teachingEl) state.insTeachingCover = teachingEl.value;
    var equipmentTierEl = root.querySelector('[name="insEquipmentTier"]');
    if (equipmentTierEl) state.insEquipmentTier = Number(equipmentTierEl.value);
    var standardConstructionEl = root.querySelector('[name="insStandardConstruction"]');
    if (standardConstructionEl) state.insStandardConstruction = standardConstructionEl.value;
    var nonStandardOver15El = root.querySelector('[name="insNonStandardOver15"]');
    if (nonStandardOver15El) state.insNonStandardOver15 = nonStandardOver15El.value;
    var multipleAddressesEl = root.querySelector('[name="insMultipleAddresses"]');
    if (multipleAddressesEl) state.insMultipleAddresses = multipleAddressesEl.value;
    var nonSalonELEl = root.querySelector('input[name="insNonSalonEL"]:checked');
    if (nonSalonELEl) state.insNonSalonEL = nonSalonELEl.value === "yes";
    var nonSalonELTierEl = root.querySelector('[name="insNonSalonELTier"]');
    if (nonSalonELTierEl) state.insNonSalonELTier = Number(nonSalonELTierEl.value);
    var salonELEl = root.querySelector('input[name="insSalonEL"]:checked');
    if (salonELEl) state.insSalonEL = salonELEl.value === "yes";
    var contentsEl = root.querySelector('input[name="insContents"]:checked');
    if (contentsEl) state.insContents = contentsEl.value === "yes";
    var moneyEl = root.querySelector('input[name="insMoneyCover"]:checked');
    if (moneyEl) state.insMoneyCover = moneyEl.value === "yes";
    var buildingsEl = root.querySelector('input[name="insBuildingsCover"]:checked');
    if (buildingsEl) state.insBuildingsCover = buildingsEl.value === "yes";
    var biEl = root.querySelector('input[name="insBiCover"]:checked');
    if (biEl) state.insBiCover = biEl.value === "yes";
    var propertyAwayEl = root.querySelector('input[name="insPropertyAwayCover"]:checked');
    if (propertyAwayEl) state.insPropertyAwayCover = propertyAwayEl.value === "yes";

    var p = state.insPremisesAddress;
    var pAddr1 = root.querySelector('[name="insPremisesAddr1"]'); if (pAddr1) p.l1 = pAddr1.value;
    var pAddr2 = root.querySelector('[name="insPremisesAddr2"]'); if (pAddr2) p.l2 = pAddr2.value;
    var pTown = root.querySelector('[name="insPremisesTown"]'); if (pTown) p.town = pTown.value;
    var pCounty = root.querySelector('[name="insPremisesCounty"]'); if (pCounty) p.county = pCounty.value;
    var pPostcode = root.querySelector('[name="insPremisesPostcode"]'); if (pPostcode) p.postcode = pPostcode.value;
    var floodEl = root.querySelector('[name="insFloodHistory"]'); if (floodEl) state.insFloodHistory = floodEl.value;
    var basementEl = root.querySelector('[name="insBasement"]'); if (basementEl) state.insBasement = basementEl.value;
    var subsidenceEl = root.querySelector('[name="insSubsidenceHistory"]'); if (subsidenceEl) state.insSubsidenceHistory = subsidenceEl.value;
    var soleOccupationEl = root.querySelector('[name="insSoleOccupation"]'); if (soleOccupationEl) state.insSoleOccupation = soleOccupationEl.value;
    var unoccupiedEl = root.querySelector('[name="insUnoccupiedDeclaration"]'); if (unoccupiedEl) state.insUnoccupiedDeclaration = unoccupiedEl.value;
    var flatRoofEl = root.querySelector('[name="insFlatRoof"]'); if (flatRoofEl) state.insFlatRoof = flatRoofEl.value;
    var buildingsSubsidenceEl = root.querySelector('[name="insBuildingsSubsidenceDeclaration"]'); if (buildingsSubsidenceEl) state.insBuildingsSubsidenceDeclaration = buildingsSubsidenceEl.value;

    state.insDeclarations = state.insDeclarations.map(function (existing, index) {
      var el = root.querySelector('input[name="insDeclaration_' + index + '"]:checked');
      return el ? el.value : existing;
    });
    var infoAccEl = root.querySelector('input[name="insInformationAccurate"]:checked'); if (infoAccEl) state.insInformationAccurate = infoAccEl.value;
    var ethicsEl = root.querySelector('input[name="insEthicsAccepted"]:checked'); if (ethicsEl) state.insEthicsAccepted = ethicsEl.value;
    var demandsEl = root.querySelector('input[name="insDemandsNeedsAccepted"]:checked'); if (demandsEl) state.insDemandsNeedsAccepted = demandsEl.value;
    var nonAdvisedEl = root.querySelector('input[name="insNonAdvisedAccepted"]:checked'); if (nonAdvisedEl) state.insNonAdvisedAccepted = nonAdvisedEl.value;
  }

  function progress(state) {
    var labels = stepLabels(state);
    // Column count varies with the dynamic step sequence (insurance adds up to 4 extra
    // steps) - the fixed 7-column CSS grid only fits the membership-only sequence.
    return '<div class="mq-progress" aria-label="Quote progress" style="grid-template-columns:repeat(' + labels.length + ',1fr)">' + labels.map(function (label, index) {
      var cls = index === state.step ? "is-current" : (index < state.step ? "is-complete" : "");
      return '<div class="' + cls + '"><span>' + (index < state.step ? "✓" : index + 1) + '</span><small>' + label + '</small></div>';
    }).join("") + '</div>';
  }

  function render(root, state) {
    var keys = stepKeys(state);
    var currentKey = keys[state.step];
    var last = state.step === keys.length;
    var entryPoint = root.dataset.mqEntryPoint || "member";
    root.innerHTML = '<div class="mq-shell"><header class="mq-header"><div><span class="portal-eyebrow">MEMBERSHIP QUOTE</span><h1>' + (state.isRenewal ? "Renew your membership" : state.isUpgrade ? "Upgrade your membership" : "Get a membership quote") + '</h1></div>' +
      '<button class="mq-close" type="button">Close</button></header>' + progress(state) +
      '<form class="mq-workspace" novalidate><div class="mq-content">' + renderStep(state, entryPoint) + '</div>' +
      '<footer class="mq-actions"><button class="acc-btn-secondary mq-back" type="button" ' + (state.step === 0 ? "disabled" : "") + '>Previous</button>' +
      '<span>Step ' + (state.step + 1) + ' of ' + (keys.length + 1) + '</span>' +
      (last && state.saved ? '<button class="acc-btn-primary mq-restart" type="button">Start a new quote</button>' :
        last ? '<div class="mq-actions-group"><button class="acc-btn-secondary mq-save" type="submit" data-action="save">Save quote</button>' +
          // International has no fixed price ("confirmed by our team" throughout this flow) -
          // the checkout endpoint refuses it outright, so don't offer a button that can only error.
          // A referred/stopped insurance answer must block payment too - showing the warning
          // banner isn't enough on its own if "Pay now" still works right next to it.
          (membershipComponentTotal(state) == null ? "" : (function () {
            var insBlocked = state.insurance === "yes" && evaluateInsuranceRules(state).overall !== "PASS";
            return '<button class="acc-btn-primary mq-pay" type="submit" data-action="pay"' + (insBlocked ? ' disabled title="Resolve the flagged insurance details before paying - our team will be in touch, or you can call the office."' : "") + '>Pay now →</button>';
          })()) + '</div>' :
        '<button class="acc-btn-primary mq-next" type="submit" ' + (currentKey === "declarations" && !state.termsAccepted ? "disabled" : "") + '>Continue</button>') +
      '</footer></form></div>';

    root.querySelector(".mq-close").addEventListener("click", function () { closeFlow(root); });
    var back = root.querySelector(".mq-back");
    back.addEventListener("click", function () { if (state.step > 0) { state.step -= 1; state.saved = false; persist(state); render(root, state); } });
    var restart = root.querySelector(".mq-restart");
    if (restart) restart.addEventListener("click", function () { localStorage.removeItem(STORAGE_KEY); render(root, initialState()); });
    root.querySelector("form").addEventListener("click", function (event) {
      var plusEl = event.target.closest("[data-qty-plus]");
      var minusEl = event.target.closest("[data-qty-minus]");
      if (plusEl || minusEl) {
        event.preventDefault();
        var id = plusEl ? plusEl.getAttribute("data-qty-plus") : minusEl.getAttribute("data-qty-minus");
        var current = state.addons[id] || 0;
        state.addons[id] = plusEl ? Math.min(10, current + 1) : Math.max(0, current - 1);
        persist(state);
        render(root, state);
        return;
      }
      var addPersonEl = event.target.closest("[data-add-named-person]");
      if (addPersonEl) {
        event.preventDefault();
        syncInputs(root, state);
        if (!state.insNamedPeople) state.insNamedPeople = [];
        if (state.insNamedPeople.length < 4) {
          state.insNamedPeople.push({ id: Date.now() + "_" + Math.random().toString(36).slice(2, 7), type: "employee", firstName: "", lastName: "" });
        }
        persist(state);
        render(root, state);
        return;
      }
      var removePersonEl = event.target.closest("[data-remove-named-person]");
      if (removePersonEl) {
        event.preventDefault();
        syncInputs(root, state);
        var removeId = removePersonEl.getAttribute("data-remove-named-person");
        state.insNamedPeople = (state.insNamedPeople || []).filter(function (p) { return p.id !== removeId; });
        persist(state);
        render(root, state);
        return;
      }
      var findEl = event.target.closest("[data-address-find]");
      if (findEl) {
        event.preventDefault();
        var findTarget = findEl.getAttribute("data-address-target") || "details";
        var postcodeName = findTarget === "insPremises" ? "insPremisesPostcode" : "postcode";
        var postcodeInput = root.querySelector('[name="' + postcodeName + '"]');
        runAddressSearch(root, state, postcodeInput ? postcodeInput.value : "", null, findTarget);
        return;
      }
      var itemEl = event.target.closest("[data-address-item]");
      if (itemEl) {
        event.preventDefault();
        selectAddressResult(root, state, itemEl.getAttribute("data-id"), itemEl.getAttribute("data-text"), itemEl.getAttribute("data-container") === "1", itemEl.getAttribute("data-target"));
        return;
      }
      var manualEl = event.target.closest("[data-address-manual]");
      if (manualEl) {
        event.preventDefault();
        var manualTarget = manualEl.getAttribute("data-address-target") || "details";
        if (manualTarget === "insPremises") state.insPremisesAddress.addrLooked = true;
        else state.details.addrLooked = true;
        state._addressSearch = null;
        persist(state);
        render(root, state);
      }
    });
    root.querySelector("form").addEventListener("change", function () {
      syncInputs(root, state); persist(state);
      var liveKeys = ["details", "membership", "declarations", "insBusiness", "insCover", "insProperty", "insDeclarations"];
      if (liveKeys.indexOf(currentKey) > -1) render(root, state);
    });
    // Debounced live search, same UX as LoqateAddressLookup: results pop up while typing
    // rather than requiring an explicit "Find address" click for every search.
    var postcodeInput = root.querySelector('[name="postcode"]');
    if (postcodeInput && state.step === 1 && state.details.country === "United Kingdom") {
      var addressDebounce = null;
      postcodeInput.addEventListener("input", function () {
        clearTimeout(addressDebounce);
        var value = postcodeInput.value.trim();
        if (value.length < 3) { state._addressSearch = null; updateAddressResultsDom(root, null); return; }
        addressDebounce = setTimeout(function () { runAddressSearch(root, state, value); }, 400);
      });
      postcodeInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") { event.preventDefault(); clearTimeout(addressDebounce); runAddressSearch(root, state, postcodeInput.value); }
      });
    }
    root.querySelector("form").addEventListener("submit", function (event) {
      event.preventDefault();
      syncInputs(root, state);
      if (!validate(state, root)) return;
      // event.submitter identifies which of the two footer buttons (Save quote / Pay now)
      // actually triggered this - both are type="submit" on the same form.
      var wantsPayment = last && event.submitter && event.submitter.dataset.action === "pay";
      if (wantsPayment && state.insurance === "yes" && evaluateInsuranceRules(state).overall !== "PASS") return;
      if (wantsPayment) { payNow(root, state, entryPoint, event.submitter); return; }
      if (last) {
        state.saved = true;
        state.entryPoint = entryPoint;
        persist(state);
        // No listener consumes this yet - saving a real Draft record to CRM (and, later,
        // handing off to the Creator quote calculator) is a separate, still-unbuilt phase.
        window.dispatchEvent(new CustomEvent("beautyguild:membership-quote-saved", { detail: { quote: state, total: quoteTotal(state), entryPoint: entryPoint } }));
      } else {
        state.step += 1;
        // First time reaching the Property step, start from the member's own address rather
        // than a blank form - most members work from the same address they already gave us.
        // Only when nothing's been entered yet, so going back and re-visiting never clobbers
        // a premises address the member has since typed or looked up themselves.
        if (stepKeys(state)[state.step] === "insProperty" && !state.insPremisesAddress.l1 && !state.insPremisesAddress.postcode) {
          state.insPremisesAddress.l1 = state.details.addr1 || "";
          state.insPremisesAddress.l2 = state.details.addr2 || "";
          state.insPremisesAddress.town = state.details.town || "";
          state.insPremisesAddress.county = state.details.county || "";
          state.insPremisesAddress.postcode = state.details.postcode || "";
          state.insPremisesAddress.country = state.details.country || "United Kingdom";
          state.insPremisesAddress.addrLooked = state.details.addrLooked || !!state.details.addr1;
        }
      }
      persist(state);
      render(root, state);
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Creates a real Stripe Checkout session for the current quote and redirects there. All
  // pricing is recomputed and validated server-side from the level/branch/addon ids alone -
  // see /payments/membership-checkout in beauty_guild_api - so nothing here needs to (or
  // should) send amounts.
  // Everything the backend's own copy of calculateInsuranceQuote/evaluateInsuranceRules/
  // createInsuranceRecords needs - field names match that copy exactly (same "ins"-prefixed
  // state fields), since the server recomputes the quote and rules itself rather than trusting
  // whatever this sends; this is just the raw inputs, not the computed price.
  function buildInsurancePayload(state) {
    return {
      insRoute: state.insRoute,
      insWorkingFromHome: state.insWorkingFromHome, insMobile: state.insMobile, insRentedRoom: state.insRentedRoom,
      insSubcontractor: state.insSubcontractor, insSalon: state.insSalon,
      insTurnover: state.insTurnover, insWageRoll: state.insWageRoll, insSalonCount: state.insSalonCount,
      insNamedPeopleCover: state.insNamedPeopleCover, insNamedPeople: state.insNamedPeople,
      insTreatmentExtensions: state.insTreatmentExtensions,
      insQualifiedForTreatments: state.insQualifiedForTreatments, insPatchTesting: state.insPatchTesting,
      insTeachingCover: state.insTeachingCover,
      insEquipmentTier: state.insEquipmentTier, insStandardConstruction: state.insStandardConstruction,
      insNonStandardOver15: state.insNonStandardOver15, insMultipleAddresses: state.insMultipleAddresses,
      insNonSalonEL: state.insNonSalonEL, insNonSalonELTier: state.insNonSalonELTier, insSalonEL: state.insSalonEL,
      insContents: state.insContents, insComputers: state.insComputers, insEquipment: state.insEquipment,
      insStock: state.insStock, insGeneralContents: state.insGeneralContents,
      insTenantImprovements: state.insTenantImprovements, insRentPayable: state.insRentPayable,
      insMoneyCover: state.insMoneyCover,
      insBuildingsCover: state.insBuildingsCover, insBuildingsSI: state.insBuildingsSI,
      insFixturesSI: state.insFixturesSI, insRentReceivableSI: state.insRentReceivableSI,
      insBiCover: state.insBiCover, insBiIncome: state.insBiIncome, insBiDebts: state.insBiDebts,
      insPropertyAwayCover: state.insPropertyAwayCover, insPropertyAwaySI: state.insPropertyAwaySI,
      insPremisesAddress: state.insPremisesAddress,
      insFloodHistory: state.insFloodHistory, insBasement: state.insBasement, insSubsidenceHistory: state.insSubsidenceHistory,
      insSoleOccupation: state.insSoleOccupation, insUnoccupiedDeclaration: state.insUnoccupiedDeclaration,
      insFlatRoof: state.insFlatRoof, insBuildingsSubsidenceDeclaration: state.insBuildingsSubsidenceDeclaration,
      insDeclarations: state.insDeclarations,
      insInformationAccurate: state.insInformationAccurate, insEthicsAccepted: state.insEthicsAccepted,
      insDemandsNeedsAccepted: state.insDemandsNeedsAccepted, insNonAdvisedAccepted: state.insNonAdvisedAccepted,
    };
  }

  function payNow(root, state, entryPoint, button) {
    var session = readJson("bg_accreditation_session") || {};
    var start = new Date();
    var end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate() - 1);
    var ref = state.reference || quoteReference();
    state.reference = ref;
    setError(root, "payment-submit", "");
    var originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Redirecting to secure payment…";
    var saveBtn = root.querySelector(".mq-save");
    if (saveBtn) saveBtn.disabled = true;
    fetch(API_BASE_URL + "/payments/membership-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: session.id || null,
        email: state.details.email,
        name: (state.details.firstName + " " + state.details.lastName).trim(),
        quoteReference: ref,
        entryPoint: entryPoint,
        membershipLevel: state.membershipLevel,
        primaryBranch: state.primaryBranch,
        secondaryBranches: state.secondaryBranches,
        addons: state.addons,
        insuranceRequested: state.insurance === "yes",
        insurance: state.insurance === "yes" ? buildInsurancePayload(state) : null,
        detailsCountry: state.details.country,
        termsAccepted: state.termsAccepted === true,
        subscriptionType: state.subscriptionType,
        membershipStart: isoDate(start),
        membershipExpiry: isoDate(end),
        previousMembershipId: (state.isRenewal || state.isUpgrade) ? state.previousMembershipDealId : null,
        changeType: state.isRenewal ? "renewal" : state.isUpgrade ? "upgrade" : "new",
      }),
    }).then(function (res) {
      return res.json().then(function (body) { return { ok: res.ok, body: body }; });
    }).then(function (result) {
      if (!result.ok || !result.body.checkoutUrl) {
        throw new Error((result.body && result.body.error) || "Checkout could not be started.");
      }
      persist(state);
      window.location.href = result.body.checkoutUrl;
    }).catch(function (err) {
      setError(root, "payment-submit", err.message || "Something went wrong starting checkout. Please try again.");
      button.disabled = false;
      button.textContent = originalLabel;
      if (saveBtn) saveBtn.disabled = false;
    });
  }

  // Patches just the results dropdown, rather than the full render() every other state change
  // goes through - a full re-render replaces the whole form's innerHTML, which would drop
  // focus and the cursor position out of the postcode input on every keystroke while typing.
  function addressResultsContainerId(target) {
    return target === "insPremises" ? "mq-premises-address-results" : "mq-address-results";
  }

  function updateAddressResultsDom(root, search, target) {
    var container = root.querySelector("#" + addressResultsContainerId(target));
    if (container) container.innerHTML = addressResultsMarkup({ _addressSearch: search });
  }

  // A postcode-only search almost always comes back as a single "container" row (e.g.
  // "27 Addresses") rather than the addresses themselves - drilling into it immediately
  // shows the real, selectable list straight away, same behaviour as LoqateAddressLookup.
  // `target` picks which address this search is for ("details" or "insPremises") - the same
  // search machinery is shared rather than duplicated for the Property step's premises address.
  function runAddressSearch(root, state, query, container, target) {
    target = target || "details";
    query = (query || "").trim();
    if (!query) { state._addressSearch = null; updateAddressResultsDom(root, null, target); return; }
    var params = new URLSearchParams({ text: query });
    if (container) params.set("container", container);
    fetch(API_BASE_URL + "/address/find?" + params.toString())
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (result) {
        if (!result.ok) throw new Error((result.body && result.body.error) || "Address search failed.");
        var items = result.body.items || [];
        if (items.length === 1 && items[0].Type && items[0].Type !== "Address") {
          return runAddressSearch(root, state, items[0].Text || items[0].Description, items[0].Id, target);
        }
        state._addressSearch = { items: items, error: items.length ? "" : "No addresses found. You can enter the address manually.", loading: false, target: target };
        updateAddressResultsDom(root, state._addressSearch, target);
      }).catch(function (err) {
        state._addressSearch = { items: [], error: err.message || "Address search unavailable. You can enter the address manually.", loading: false, target: target };
        updateAddressResultsDom(root, state._addressSearch, target);
      });
  }

  function selectAddressResult(root, state, id, text, isContainer, target) {
    target = target || "details";
    if (isContainer) {
      runAddressSearch(root, state, text, id, target);
      return;
    }
    fetch(API_BASE_URL + "/address/retrieve?id=" + encodeURIComponent(id))
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (result) {
        if (!result.ok || !result.body.address) throw new Error((result.body && result.body.error) || "Unable to retrieve that address.");
        var address = result.body.address;
        if (target === "insPremises") {
          var p = state.insPremisesAddress;
          p.l1 = address.addressLine1 || "";
          p.l2 = address.addressLine2 || "";
          p.town = address.town || "";
          p.county = address.county || "";
          p.postcode = address.postcode || p.postcode;
          p.addrLooked = true;
        } else {
          state.details.addr1 = address.addressLine1 || "";
          state.details.addr2 = address.addressLine2 || "";
          state.details.addr3 = address.addressLine3 || "";
          state.details.town = address.town || "";
          state.details.county = address.county || "";
          state.details.postcode = address.postcode || state.details.postcode;
          state.details.addrLooked = true;
        }
        state._addressSearch = null;
        persist(state);
        render(root, state);
      }).catch(function (err) {
        state._addressSearch = { items: [], error: err.message || "Unable to retrieve that address.", loading: false, target: target };
        updateAddressResultsDom(root, state._addressSearch, target);
      });
  }

  function closeFlow(root) {
    var panel = root.closest(".membership-page-panel");
    if (panel && panel.__mqOriginal) {
      panel.classList.remove("mq-panel-active");
      panel.innerHTML = panel.__mqOriginal;
      enhancePanel(panel);
      return;
    }
    if (root.dataset.mqExitUrl) window.location.href = root.dataset.mqExitUrl;
  }

  // Pre-fills a renewal quote from the member's current, real membership - level, primary
  // branch and billing frequency come straight off the Deal (via data attributes React already
  // sets), add-on quantities are fetched from Membership_Extension just after. Landing on
  // "Membership" (not further ahead) still passes through Declarations normally on the way to
  // payment, so the Terms of Business checkbox is re-validated as usual - that check only runs
  // when the step is actually left forwards, so only skipping past it outright would be unsafe.
  function renewalSeedState(panel) {
    var state = initialState();
    state.isRenewal = true;
    state.previousMembershipDealId = panel.dataset.membershipDealId || null;
    state.membershipLevel = panel.dataset.membershipLevelId || "";
    state.primaryBranch = panel.dataset.membershipBranchId || "";
    state.subscriptionType = panel.dataset.membershipSubscriptionType || "";
    state.step = 2;
    return state;
  }

  // A mid-term change to an already-active membership - unlike renewal, this starts right
  // from the beginning (Cover, including the insurance question) rather than jumping to the
  // Membership step, since an upgrade can be "add insurance" alone, "move to a different
  // level" alone, or both - not just a level change. No joining fee either way, and it's
  // linked back to the current Deal so it replaces it rather than creating a second one.
  function upgradeSeedState(panel) {
    var state = initialState();
    state.isUpgrade = true;
    state.previousMembershipDealId = panel.dataset.membershipDealId || null;
    state.membershipLevel = panel.dataset.membershipLevelId || "";
    state.primaryBranch = panel.dataset.membershipBranchId || "";
    state.subscriptionType = panel.dataset.membershipSubscriptionType || "";
    // Real, known answers rather than blank questions - the member already told the Guild
    // this once, an upgrade shouldn't ask again from scratch.
    state.insurance = panel.dataset.membershipInsuranceRequested === "true" ? "yes" : "no";
    var interests = [];
    try { interests = JSON.parse(panel.dataset.contactInterests || "[]"); } catch (_) {}
    state.areas = AREAS.map(function (a) { return a.toLowerCase(); }).filter(function (id) {
      return interests.some(function (i) { return String(i).toLowerCase() === id; });
    });
    var d = state.details;
    d.firstName = panel.dataset.contactFirstName || d.firstName;
    d.lastName = panel.dataset.contactLastName || d.lastName;
    d.email = panel.dataset.contactEmail || d.email;
    d.confirmEmail = d.email;
    d.phone = panel.dataset.contactPhone || panel.dataset.contactMobile || d.phone;
    d.addr1 = panel.dataset.contactAddressLine1 || "";
    d.addr2 = panel.dataset.contactAddressLine2 || "";
    d.town = panel.dataset.contactTown || "";
    d.county = panel.dataset.contactCounty || "";
    d.postcode = panel.dataset.contactPostcode || "";
    d.country = panel.dataset.contactCountry || d.country;
    // Already have a real address on file - show it directly rather than an empty postcode
    // search box that would look like nothing's been filled in yet.
    d.addrLooked = !!(d.addr1 || d.postcode);
    return state;
  }

  function loadCurrentAddonsForRenewal(root, state) {
    var session = readJson("bg_accreditation_session") || {};
    if (!session.id || !state.previousMembershipDealId) return;
    fetch(API_BASE_URL + "/memberships/" + encodeURIComponent(state.previousMembershipDealId) + "/extensions?contactId=" + encodeURIComponent(session.id))
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (result) {
        if (!result.ok) return;
        (result.body.extensions || []).forEach(function (ext) {
          var addonId = EXTENSION_TYPE_TO_ADDON[ext.type];
          if (addonId && ext.quantity) state.addons[addonId] = Math.min(10, ext.quantity);
          if (ext.type === "Branch" && ext.branchId && ext.branchId !== state.primaryBranch && state.secondaryBranches.indexOf(ext.branchId) === -1) {
            state.secondaryBranches.push(ext.branchId);
          }
        });
        persist(state);
        // Only worth redrawing if the member hasn't already moved past where add-ons show -
        // avoids clobbering anything they've since changed by hand while this was in flight.
        if (state.step <= 4) render(root, state);
      }).catch(function () {});
  }

  // Seeds a standalone "buy an add-on" session against an already-active membership - opened
  // from the Membership details page's Add-ons tab, not from the main quote/renewal launch
  // button, so it never touches the shared quote draft (STORAGE_KEY) at all.
  function addonPurchaseSeedState(panel) {
    return {
      isAddonPurchase: true,
      membershipDealId: panel.dataset.membershipDealId || null,
      contactId: panel.dataset.membershipContactId || null,
      contactEmail: panel.dataset.membershipContactEmail || "",
      contactName: panel.dataset.membershipContactName || "",
      addons: { bundle: 0, certificate: 0, badge: 0, sticker: 0 },
    };
  }

  function loadCurrentAddonsForPurchase(root, state) {
    if (!state.contactId || !state.membershipDealId) return;
    fetch(API_BASE_URL + "/memberships/" + encodeURIComponent(state.membershipDealId) + "/extensions?contactId=" + encodeURIComponent(state.contactId))
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (result) {
        if (!result.ok) return;
        (result.body.extensions || []).forEach(function (ext) {
          var addonId = EXTENSION_TYPE_TO_ADDON[ext.type];
          if (addonId && ext.quantity) state.addons[addonId] = Math.min(10, ext.quantity);
        });
        renderAddonPurchase(root, state);
      }).catch(function () {});
  }

  function renderAddonPurchase(root, state) {
    var total = ADDONS.reduce(function (sum, a) { return sum + (state.addons[a.id] || 0) * a.priceGross; }, 0);
    var addonRows = ADDONS.map(function (a) { return quantityRow(a, state.addons[a.id] || 0); }).join("");
    var hasSelection = total > 0;
    root.innerHTML = '<div class="mq-shell"><header class="mq-header"><div><span class="portal-eyebrow">MEMBERSHIP ADD-ONS</span><h1>Add extras to your membership</h1></div>' +
      '<button class="mq-close" type="button">Close</button></header>' +
      '<div class="mq-workspace"><div class="mq-content"><section class="mq-step">' +
      '<div class="mq-step-heading"><span class="mq-kicker">Add-ons</span><h2>Choose what to add</h2><p>Update the quantities below, then pay to add them to your membership.</p></div>' +
      '<fieldset class="mq-fieldset"><legend>Membership extras</legend><div class="mq-addon-list">' + addonRows + '</div></fieldset>' +
      '<p class="mq-error" data-error="addon-payment-submit"></p>' +
      '</section></div>' +
      '<footer class="mq-actions"><span>' + (hasSelection ? money(total) + " today" : "Select at least one item") + '</span>' +
      '<button class="acc-btn-primary mq-pay-addons" type="button"' + (hasSelection ? "" : " disabled") + '>Pay ' + money(total) + ' now →</button>' +
      '</footer></div></div>';

    // Listeners go on .mq-shell (recreated by the innerHTML write above on every render), not
    // on `root` itself - `root` is the same persistent panel element across re-renders, so a
    // listener attached there directly would never be cleaned up and a repeat render (every
    // quantity change re-renders) would stack up an extra listener each time, making every
    // later click fire once per accumulated listener instead of once per click.
    var shell = root.querySelector(".mq-shell");
    shell.querySelector(".mq-close").addEventListener("click", function () {
      root.innerHTML = "";
      window.dispatchEvent(new CustomEvent("beautyguild:addon-purchase-closed"));
    });
    shell.addEventListener("click", function (event) {
      var plusEl = event.target.closest("[data-qty-plus]");
      var minusEl = event.target.closest("[data-qty-minus]");
      if (plusEl || minusEl) {
        event.preventDefault();
        var id = plusEl ? plusEl.getAttribute("data-qty-plus") : minusEl.getAttribute("data-qty-minus");
        var current = state.addons[id] || 0;
        state.addons[id] = plusEl ? Math.min(10, current + 1) : Math.max(0, current - 1);
        renderAddonPurchase(root, state);
        return;
      }
      var payEl = event.target.closest(".mq-pay-addons");
      if (payEl && !payEl.disabled) payAddonPurchase(root, state, payEl);
    });
  }

  function payAddonPurchase(root, state, button) {
    setError(root, "addon-payment-submit", "");
    var originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Redirecting to secure payment…";
    fetch(API_BASE_URL + "/payments/membership-addon-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealId: state.membershipDealId,
        contactId: state.contactId,
        email: state.contactEmail,
        name: state.contactName,
        addons: state.addons,
      }),
    }).then(function (res) {
      return res.json().then(function (body) { return { ok: res.ok, body: body }; });
    }).then(function (result) {
      if (!result.ok || !result.body.checkoutUrl) {
        throw new Error((result.body && result.body.error) || "Payment could not be started.");
      }
      window.location.href = result.body.checkoutUrl;
    }).catch(function (err) {
      setError(root, "addon-payment-submit", err.message || "Payment could not be started. Please try again.");
      button.disabled = false;
      button.textContent = originalLabel;
    });
  }

  function openAddonPurchaseFlow(panel) {
    var state = addonPurchaseSeedState(panel);
    renderAddonPurchase(panel, state);
    loadCurrentAddonsForPurchase(panel, state);
  }

  function openFlow(panel) {
    if (!panel.__mqOriginal) panel.__mqOriginal = panel.innerHTML;
    panel.dataset.mqEntryPoint = "member";
    panel.classList.add("mq-panel-active");
    var draft = readJson(STORAGE_KEY);
    var hasProgress = !!(draft && (draft.saved || draft.step > 0));
    var isActive = panel.dataset.membershipActive === "true";
    var renewalDue = panel.dataset.membershipRenewalDue === "true";
    if (!hasProgress && renewalDue && panel.dataset.membershipDealId) {
      var state = renewalSeedState(panel);
      persist(state);
      render(panel, state);
      loadCurrentAddonsForRenewal(panel, state);
      return;
    }
    // An active membership that isn't yet due for renewal can't start (or resume) a brand new
    // purchase - that would create a second membership alongside the one already active. An
    // upgrade is the only self-service change on offer in that case.
    if (!hasProgress && isActive && !renewalDue && panel.dataset.membershipDealId) {
      var upgradeState = upgradeSeedState(panel);
      persist(upgradeState);
      render(panel, upgradeState);
      loadCurrentAddonsForRenewal(panel, upgradeState);
      return;
    }
    render(panel, initialState());
  }

  function launchLabel(panel) {
    var draft = readJson(STORAGE_KEY);
    if (draft && draft.saved) return "View saved membership quote";
    if (draft && draft.step > 0) return "Resume membership quote";
    // Mirrors the CRM reminder workflow's own "Active AND Expiry Date next 30 days" criteria,
    // read off the data attributes the real page sets - no separate threshold to keep in sync.
    if (panel.dataset.membershipRenewalDue === "true") return "Renew membership";
    // Already an active member outside the renewal window - the only options are self-service
    // upgrade or waiting for the renewal window, never a second brand-new purchase.
    if (panel.dataset.membershipActive === "true") return "Upgrade membership";
    return "Get a membership quote";
  }

  function makeDiscardLink(panel) {
    var link = document.createElement("button");
    link.type = "button";
    link.className = "text-action mq-discard";
    link.textContent = "Discard quote";
    link.addEventListener("click", function () {
      if (!window.confirm("Discard your saved membership quote? This cannot be undone.")) return;
      localStorage.removeItem(STORAGE_KEY);
      enhancePanel(panel);
    });
    return link;
  }

  function enhancePanel(panel) {
    if (!panel || panel.querySelector(".mq-shell")) return;
    // In the real embedded page the action button is a SIBLING of .membership-page-panel,
    // not a descendant of it - searching only inside `panel` here previously fell through to
    // panel.lastElementChild (the membership-detail-list <dl>) and silently replaced it
    // instead of the button, wiping out the member's Membership type/Status/Expiry summary.
    var scope = panel.parentElement || panel;
    var draft = readJson(STORAGE_KEY);
    var hasProgress = !!(draft && (draft.saved || draft.step > 0));

    var existingRow = scope.querySelector(".mq-launch-row");
    if (existingRow) {
      // Page is observed by a MutationObserver that re-runs enhancePanel on every DOM
      // mutation - writing unconditionally would itself be a mutation, which would retrigger
      // the observer and loop forever. Only touch the DOM when something actually needs to
      // change, so the observer settles after at most one follow-up call.
      var btn = existingRow.querySelector(".mq-launch");
      var label = launchLabel(panel);
      if (btn && btn.textContent !== label) btn.textContent = label;
      var discardLink = existingRow.querySelector(".mq-discard");
      if (hasProgress && !discardLink) existingRow.appendChild(makeDiscardLink(panel));
      else if (!hasProgress && discardLink) discardLink.remove();
      return;
    }
    var action = panel.querySelector(".membership-page-action") || scope.querySelector(".membership-page-action");
    if (!action) return;
    var row = document.createElement("div");
    row.className = "mq-launch-row";
    var button = document.createElement("button");
    button.type = "button";
    button.className = "acc-btn-primary mq-launch";
    button.textContent = launchLabel(panel);
    button.addEventListener("click", function () { openFlow(panel); });
    row.appendChild(button);
    if (hasProgress) row.appendChild(makeDiscardLink(panel));
    action.replaceWith(row);
  }

  function enhanceLoginEntry() {
    var intro = document.querySelector(".auth-intro");
    if (!intro || intro.querySelector(".mq-public-entry")) return;
    var link = document.createElement("a");
    link.className = "mq-public-entry";
    link.href = PUBLIC_URL;
    link.innerHTML = '<strong>Not a member yet?</strong><span>Get a membership quote</span>';
    intro.appendChild(link);
  }

  function renderPublic() {
    var root = document.getElementById("root");
    if (!root) return;
    root.innerHTML = '<div class="mq-public-page"><header class="mq-public-header"><a class="mq-public-brand" href="' + LOGIN_URL + '"><img src="/app/beauty-guild-mark.svg" alt="" width="34" height="34"><span>beauty<strong>guild</strong></span></a><a class="mq-member-login" href="' + LOGIN_URL + '">Member login</a></header><main class="mq-public-main"><div class="mq-public-intro"><span class="mq-kicker">THE GUILD OF BEAUTY THERAPISTS</span><h1>Membership built around your work</h1><p>Build a quote for the Guild branches and professional cover you need.</p></div><div class="membership-page-panel mq-panel-active mq-public-panel"></div></main><footer class="mq-public-footer"><span>Beauty Guild membership</span><span>Quote securely online</span></footer></div>';
    var panel = root.querySelector(".mq-public-panel");
    panel.dataset.mqEntryPoint = "public";
    panel.dataset.mqExitUrl = LOGIN_URL;
    render(panel, initialState());
  }

  function renderDemo() {
    var root = document.getElementById("root");
    if (!root) return;
    root.innerHTML = '<div class="acc-root"><div class="acc-shell"><aside class="acc-sidebar mq-demo-sidebar"><div class="acc-sidebar-brand"><img src="/app/beauty-guild-mark.svg" alt="" width="34" height="34"><div><div class="acc-sidebar-wordmark">beauty<span class="acc-wordmark-guild">guild</span></div><div class="acc-sidebar-brand-sub">Member Portal</div></div></div><nav class="acc-sidebar-nav"><div class="acc-sidebar-group-title">Portal</div><div class="acc-sidebar-item"><span class="acc-sidebar-dot"></span><span>Dashboard</span></div><div class="acc-sidebar-item active"><span class="acc-sidebar-dot"></span><span>Membership</span></div><div class="acc-sidebar-item"><span class="acc-sidebar-dot"></span><span>GTi courses</span></div><div class="acc-sidebar-item"><span class="acc-sidebar-dot"></span><span>Accreditation</span></div><div class="acc-sidebar-item"><span class="acc-sidebar-dot"></span><span>Insurance</span></div><div class="acc-sidebar-group-title">Account</div><div class="acc-sidebar-item"><span class="acc-sidebar-dot"></span><span>My profile</span></div><div class="acc-sidebar-item"><span class="acc-sidebar-dot"></span><span>Documents</span></div></nav><div class="acc-sidebar-user"><div class="acc-sidebar-avatar">HM</div><div><div class="acc-sidebar-user-name">Helen Morgan</div><div class="acc-sidebar-user-role">Guild member</div></div></div></aside><main class="acc-main"><div class="acc-topbar mq-demo-topbar"><div><strong>Membership</strong><span>Manage your Guild membership</span></div><div class="acc-sidebar-avatar">HM</div></div><div class="mq-demo-main"><div class="membership-page-panel mq-panel-active"></div></div></main></div></div>';
    var panel = root.querySelector(".membership-page-panel");
    panel.dataset.mqEntryPoint = "member";
    panel.__mqOriginal = '<div><span class="portal-eyebrow">MEMBERSHIP STATUS</span><h2>Associate membership</h2><p>No current membership was found. Get a tailored quote based on your work and cover requirements.</p></div><dl class="membership-detail-list"><div><dt>Membership type</dt><dd>Associate</dd></div><div><dt>Status</dt><dd>No current membership</dd></div></dl><div class="membership-page-action"></div>';
    render(panel, initialState());
  }

  function bootstrap() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("membershipQuote") === "1") {
      renderPublic();
      return;
    }
    if (params.get("membershipMock") === "1") {
      renderDemo();
      return;
    }
    // Returning from a completed "Pay now" checkout - the local draft has served its purpose
    // (it's what the checkout session was built from), so it's cleared here rather than left
    // sitting around looking like an unfinished quote still waiting to be resumed. &flow
    // distinguishes this from an accreditation or venue payment redirect, which share the same
    // success_url and must not touch this draft at all.
    if (params.get("payment") === "success" && params.get("flow") === "membership") {
      localStorage.removeItem(STORAGE_KEY);
    }
    var observer = new MutationObserver(function () {
      var panel = document.querySelector(".membership-page-panel");
      if (panel) enhancePanel(panel);
      enhanceLoginEntry();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    enhancePanel(document.querySelector(".membership-page-panel"));
    enhanceLoginEntry();
  }

  window.BeautyGuildMembershipQuote = {
    open: function (element) { openFlow(element); },
    openAddonPurchase: function (element) { openAddonPurchaseFlow(element); },
    publicUrl: PUBLIC_URL,
    clearDraft: function () { localStorage.removeItem(STORAGE_KEY); },
    pricing: { levels: MEMBERSHIP_LEVELS, branchAddon: BRANCH_ADDON_GROSS, addons: ADDONS }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
