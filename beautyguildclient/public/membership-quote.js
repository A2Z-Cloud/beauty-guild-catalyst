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
  var STEPS = ["Cover", "Your details", "Membership", "Add-ons", "Declarations", "Payment", "Your quote"];
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
      return saved;
    }
    return {
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
    };
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
  function visibleMembershipLevels(state) {
    var isUK = state.details.country === "United Kingdom";
    if (!isUK) return MEMBERSHIP_LEVELS.filter(function (l) { return l.id === "international"; });
    return MEMBERSHIP_LEVELS.filter(function (l) {
      if (l.id === "international") return false;
      if ((l.id === "full_non_salon" || l.id === "full_salon") && state.insurance !== "yes") return false;
      return true;
    });
  }

  // The joining fee is a one-off, only paid when someone first becomes a member - not charged
  // again on a renewal, matching the checkout endpoint's own logic.
  function joiningFeeFor(state, level) {
    return state.isRenewal ? 0 : level.joiningGross;
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

  function quoteTotal(state) {
    var membership = membershipComponentTotal(state);
    return (membership == null ? 0 : membership) + addonsTotal(state);
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
          return '<button type="button" role="option" data-address-item data-id="' + escapeHtml(item.Id) +
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
        '<div id="mq-address-results" style="grid-column:1 / -1">' + addressResultsMarkup(state) + "</div>" : "") +
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
        ? state.isRenewal
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
    var total = quoteTotal(state);
    var addonLines = state.secondaryBranches.map(function (id) {
      var b = BRANCHES.filter(function (item) { return item.id === id; })[0];
      return line(b.name, money(BRANCH_ADDON_GROSS));
    }).join("") + ADDONS.filter(function (a) { return (state.addons[a.id] || 0) > 0; }).map(function (a) {
      var qty = state.addons[a.id];
      return line(a.name + " x" + qty, money(a.priceGross * qty));
    }).join("");
    var headlinePrice = levelTbc ? "TBC" : money(state.subscriptionType === "monthly" ? total / 12 : total);
    return '<section class="mq-step mq-review"><div class="mq-step-heading"><span class="mq-kicker">Your quote</span>' +
      '<h2>' + (state.saved ? "Your quote is saved" : "Review your quote") + '</h2><p>' +
      (state.saved ? (entryPoint === "public" ? "This quote is saved on this device. No payment has been taken." : "We have saved this quote in your membership area. No payment has been taken.") :
        "Check the details below. You can amend them before saving your quote, or choose to pay now.") + '</p></div>' +
      '<div class="mq-quote-hero"><div><span>' + (state.subscriptionType === "monthly" ? "Indicative monthly price" : "Annual price") + '</span><strong>' + headlinePrice + '</strong><small>Quote reference ' + ref + '</small></div>' +
      '<span class="mq-status">' + (state.saved ? "Saved" : "Ready to save") + '</span></div>' +
      '<p class="mq-error" data-error="payment-submit"></p>' +
      '<div class="mq-review-grid"><div><h3>Membership</h3>' +
      line((level ? level.name : "Guild membership") + (primary ? " - " + primary.name : ""), levelTbc ? "Confirmed by our team" : money(level.membershipGross)) +
      (levelTbc || state.isRenewal ? "" : line("Joining fee", money(level.joiningGross))) +
      addonLines +
      (state.insurance === "yes" ? line("Insurance", "Quoted separately") : "") +
      line("Total for the year", levelTbc ? "Confirmed by our team" : money(total), true) + '</div>' +
      '<div><h3>Quote details</h3>' + line("For", escapeHtml(state.details.firstName + " " + state.details.lastName)) +
      line("Email", escapeHtml(state.details.email)) + line("Starts", formatDate(start)) + line("Ends", formatDate(end)) +
      line("Payment", state.subscriptionType === "monthly" ? "Monthly" : "Annually") +
      line("Cover", state.insurance === "yes" ? "Membership + insurance (quoted separately)" : "Membership only") + '</div></div>' +
      (state.saved ? '<div class="mq-success"><span class="mq-success-check">✓</span><div><strong>Quote saved successfully</strong><p>' + (entryPoint === "public" ? "Log in to continue with this quote from your membership area." : "Your quote is ready in your membership area.") + '</p>' + (entryPoint === "public" ? '<a class="mq-login-link" href="' + LOGIN_URL + '">Log in to continue</a>' : "") + '</div></div>' : "") + '</section>';
  }

  var STEP_RENDERERS = [stepCover, stepDetails, stepMembership, stepAddons, stepDeclarations, stepPayment];

  function renderStep(state, entryPoint) {
    return state.step === STEP_RENDERERS.length ? stepQuote(state, entryPoint) : STEP_RENDERERS[state.step](state);
  }

  function validate(state, root) {
    var message = "";
    if (state.step === 0 && !state.areas.length) { message = "Select at least one area of work."; setError(root, "areas", message); }
    if (state.step === 0 && !state.insurance) { message = "Choose whether you require insurance."; setError(root, "insurance", message); }
    if (state.step === 1) {
      var d = state.details;
      if (!d.firstName || !d.lastName || !d.email || !d.phone || !d.postcode || !d.addr1 || !d.town) message = "Complete all required fields before continuing.";
      else if (!/^\S+@\S+\.\S+$/.test(d.email)) message = "Enter a valid email address.";
      else if (d.email.toLowerCase() !== d.confirmEmail.toLowerCase()) message = "The email addresses do not match.";
      setError(root, "details", message);
    }
    if (state.step === 2) {
      if (!state.membershipLevel) { message = "Choose a membership level."; setError(root, "level", message); }
      else if (!state.primaryBranch) { message = "Choose a primary membership branch."; setError(root, "branch", message); }
    }
    if (state.step === 4 && !state.termsAccepted) { message = "You must accept the Terms of Business and Privacy Policy to continue."; setError(root, "terms", message); }
    if (state.step === 5 && !state.subscriptionType) { message = "Choose how you would like to pay."; setError(root, "payment", message); }
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
  }

  function progress(state) {
    return '<div class="mq-progress" aria-label="Quote progress">' + STEPS.map(function (label, index) {
      var cls = index === state.step ? "is-current" : (index < state.step ? "is-complete" : "");
      return '<div class="' + cls + '"><span>' + (index < state.step ? "✓" : index + 1) + '</span><small>' + label + '</small></div>';
    }).join("") + '</div>';
  }

  function render(root, state) {
    var last = state.step === STEPS.length - 1;
    var entryPoint = root.dataset.mqEntryPoint || "member";
    root.innerHTML = '<div class="mq-shell"><header class="mq-header"><div><span class="portal-eyebrow">MEMBERSHIP QUOTE</span><h1>' + (state.isRenewal ? "Renew your membership" : "Get a membership quote") + '</h1></div>' +
      '<button class="mq-close" type="button">Close</button></header>' + progress(state) +
      '<form class="mq-workspace" novalidate><div class="mq-content">' + renderStep(state, entryPoint) + '</div>' +
      '<footer class="mq-actions"><button class="acc-btn-secondary mq-back" type="button" ' + (state.step === 0 ? "disabled" : "") + '>Previous</button>' +
      '<span>Step ' + (state.step + 1) + ' of ' + STEPS.length + '</span>' +
      (last && state.saved ? '<button class="acc-btn-primary mq-restart" type="button">Start a new quote</button>' :
        last ? '<div class="mq-actions-group"><button class="acc-btn-secondary mq-save" type="submit" data-action="save">Save quote</button>' +
          // International has no fixed price ("confirmed by our team" throughout this flow) -
          // the checkout endpoint refuses it outright, so don't offer a button that can only error.
          (membershipComponentTotal(state) == null ? "" : '<button class="acc-btn-primary mq-pay" type="submit" data-action="pay">Pay now →</button>') + '</div>' :
        '<button class="acc-btn-primary mq-next" type="submit" ' + (state.step === 4 && !state.termsAccepted ? "disabled" : "") + '>Continue</button>') +
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
      var findEl = event.target.closest("[data-address-find]");
      if (findEl) {
        event.preventDefault();
        var postcodeInput = root.querySelector('[name="postcode"]');
        runAddressSearch(root, state, postcodeInput ? postcodeInput.value : "");
        return;
      }
      var itemEl = event.target.closest("[data-address-item]");
      if (itemEl) {
        event.preventDefault();
        selectAddressResult(root, state, itemEl.getAttribute("data-id"), itemEl.getAttribute("data-text"), itemEl.getAttribute("data-container") === "1");
        return;
      }
      var manualEl = event.target.closest("[data-address-manual]");
      if (manualEl) {
        event.preventDefault();
        state.details.addrLooked = true;
        state._addressSearch = null;
        persist(state);
        render(root, state);
      }
    });
    root.querySelector("form").addEventListener("change", function () { syncInputs(root, state); persist(state); if (state.step === 2 || state.step === 1 || state.step === 4) render(root, state); });
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
      if (wantsPayment) { payNow(root, state, entryPoint, event.submitter); return; }
      if (last) {
        state.saved = true;
        state.entryPoint = entryPoint;
        persist(state);
        // No listener consumes this yet - saving a real Draft record to CRM (and, later,
        // handing off to the Creator quote calculator) is a separate, still-unbuilt phase.
        window.dispatchEvent(new CustomEvent("beautyguild:membership-quote-saved", { detail: { quote: state, total: quoteTotal(state), entryPoint: entryPoint } }));
      } else state.step += 1;
      persist(state);
      render(root, state);
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Creates a real Stripe Checkout session for the current quote and redirects there. All
  // pricing is recomputed and validated server-side from the level/branch/addon ids alone -
  // see /payments/membership-checkout in beauty_guild_api - so nothing here needs to (or
  // should) send amounts.
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
        subscriptionType: state.subscriptionType,
        membershipStart: isoDate(start),
        membershipExpiry: isoDate(end),
        previousMembershipId: state.isRenewal ? state.previousMembershipDealId : null,
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
  function updateAddressResultsDom(root, search) {
    var container = root.querySelector("#mq-address-results");
    if (container) container.innerHTML = addressResultsMarkup({ _addressSearch: search });
  }

  // A postcode-only search almost always comes back as a single "container" row (e.g.
  // "27 Addresses") rather than the addresses themselves - drilling into it immediately
  // shows the real, selectable list straight away, same behaviour as LoqateAddressLookup.
  function runAddressSearch(root, state, query, container) {
    query = (query || "").trim();
    if (!query) { state._addressSearch = null; updateAddressResultsDom(root, null); return; }
    var params = new URLSearchParams({ text: query });
    if (container) params.set("container", container);
    fetch(API_BASE_URL + "/address/find?" + params.toString())
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (result) {
        if (!result.ok) throw new Error((result.body && result.body.error) || "Address search failed.");
        var items = result.body.items || [];
        if (items.length === 1 && items[0].Type && items[0].Type !== "Address") {
          return runAddressSearch(root, state, items[0].Text || items[0].Description, items[0].Id);
        }
        state._addressSearch = { items: items, error: items.length ? "" : "No addresses found. You can enter the address manually.", loading: false };
        updateAddressResultsDom(root, state._addressSearch);
      }).catch(function (err) {
        state._addressSearch = { items: [], error: err.message || "Address search unavailable. You can enter the address manually.", loading: false };
        updateAddressResultsDom(root, state._addressSearch);
      });
  }

  function selectAddressResult(root, state, id, text, isContainer) {
    if (isContainer) {
      runAddressSearch(root, state, text, id);
      return;
    }
    fetch(API_BASE_URL + "/address/retrieve?id=" + encodeURIComponent(id))
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (result) {
        if (!result.ok || !result.body.address) throw new Error((result.body && result.body.error) || "Unable to retrieve that address.");
        var address = result.body.address;
        state.details.addr1 = address.addressLine1 || "";
        state.details.addr2 = address.addressLine2 || "";
        state.details.addr3 = address.addressLine3 || "";
        state.details.town = address.town || "";
        state.details.county = address.county || "";
        state.details.postcode = address.postcode || state.details.postcode;
        state.details.addrLooked = true;
        state._addressSearch = null;
        persist(state);
        render(root, state);
      }).catch(function (err) {
        state._addressSearch = { items: [], error: err.message || "Unable to retrieve that address.", loading: false };
        updateAddressResultsDom(root, state._addressSearch);
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
    if (!hasProgress && panel.dataset.membershipRenewalDue === "true" && panel.dataset.membershipDealId) {
      var state = renewalSeedState(panel);
      persist(state);
      render(panel, state);
      loadCurrentAddonsForRenewal(panel, state);
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
