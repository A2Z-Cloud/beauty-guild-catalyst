# Beauty Guild Portal - UAT Fix Plan

Working base for resolving QA1 feedback and preparing the next customer UAT round.

## UAT rule

Customer UAT covers only actions and information visible in the portal. Customers should not be asked to inspect CRM, Creator, Stripe Dashboard or Catalyst configuration.

CRM, Creator, Stripe and Catalyst checks are internal setup or verification activities only. They must not be customer-facing test steps or customer pass criteria.

## Priority order

1. Login, registration and session reliability
2. Qualification save feedback and visible application status
3. Membership display and customer-visible pricing
4. Tutor validation
5. Portal navigation and active states
6. Accreditation and School Portal clarity
7. Address and map journey alignment
8. UAT wording and test-data improvements

## Fix backlog

### FIX-001 - Login and registration

**Priority:** High  
**Status:** Deployed to Catalyst Development - ready for retest  
**Related journeys:** Registration; Login Dashboard; Logout Return

The login experience needs to match the Beauty Guild portal. Registration must clearly report when an email already has an account.

Portal acceptance:

- A new user understands the registration outcome.
- Existing email addresses produce a clear message.
- Valid login authenticates once and lands on Dashboard.
- Invalid credentials show an understandable error.
- Password reset is accessible.
- Logout and refresh do not cause an authentication loop.

Implementation notes for retest:

- Added a branded, responsive Member Portal login and registration layout.
- Kept the branded Beauty Guild login shell while restoring Catalyst's default internal login styling and state visibility.
- Signup responses are checked for failure instead of treating every resolved response as success.
- Existing-account guidance directs users to Log in or Forgot password.
- Added a clear secure-login loading failure message.
- Added a Sign out and try another account action when authentication succeeds but the portal account cannot be opened.
- Preserved the current URL intent during Catalyst login redirect.
- Removed the incomplete iframe stylesheet after visual QA showed that it exposed Catalyst's normally hidden OTP, CAPTCHA and password-reset states.
- Sign out and try another account now actually clears the blocked state; it previously left the same message on screen after signing out.
- Awaiting confirmation that the corrected Catalyst login form renders normally before this fix is closed.

### FIX-002 - Qualification save and status feedback

**Priority:** Critical  
**Status:** Deployed to Catalyst Development - ready for retest  
**Related journeys:** Qualifications; School Portal

The portal reports a qualification as saved once its CRM record exists, even if the separate application-stage update needs follow-up. Multiple qualifications remain addable, successful saves show confirmation, and the application moves idempotently to Needs Processing.

### FIX-003 - Membership page

**Priority:** High  
**Status:** Deployed to Catalyst Development - ready for retest  
**Related journey:** Membership

The Membership page now displays type, current status and expiry. A missing membership explains that Associate Membership will be included when required.

### FIX-004 - Customer-visible pricing

**Priority:** High  
**Status:** Deployed to Catalyst Development - ready for retest  
**Related journeys:** Membership; Summary Submission; Stripe Payment

Summary shows standard accreditation, its VAT composition, Associate Membership where required and the grand total. Payment remains unavailable until membership pricing resolves and includes a visible retry action if the check fails.

### FIX-005 - Tutor count validation

**Priority:** High  
**Status:** Deployed to Catalyst Development - ready for retest  
**Related journeys:** New Accreditation; Summary Submission

When Yes is selected for other tutors, a positive whole-number tutor count and the qualification declaration are required. Missing tutor count displays inline guidance.

### FIX-006 - Portal navigation

**Priority:** High  
**Status:** Deployed to Catalyst Development - ready for retest  
**Related journey:** Login Dashboard

The active navigation item now follows the actual screen. Dashboard, Membership, GTi Courses, Accreditation and Insurance remain clickable, with unbuilt areas clearly presented as future phases.

### FIX-007 - Accredited centre clarity

**Priority:** Medium  
**Status:** Deployed to Catalyst Development - ready for retest  
**Related journey:** School Portal

Customer-facing labels now use Accredited, Qualifications received, Payment received, Awaiting payment and Pending review instead of exposing avoidable internal terminology.

### FIX-008 - Multiple schools

**Priority:** Medium  
**Status:** Deployed to Catalyst Development - ready for retest  
**Related journeys:** Accreditation; School Portal

All accredited centres remain in a compact vertical list keyed by record ID. Each opens its selected School Portal workspace, with keyboard access and a two-verified-centre UAT precondition.

### FIX-009 - Address and map journey

**Priority:** Medium  
**Status:** Deployed to Catalyst Development - ready for retest  
**Related journeys:** Address Map; New Accreditation

Correspondence and school addresses now expose clear manual-entry paths. Existing school address fields and postcode are carried through save/submit. Null coordinates no longer position the map at 0,0; geocoding can be retried and the marker remains draggable in the portal without mapping coordinates into CRM.

### FIX-010 - Course selection clarity

**Priority:** Medium  
**Status:** Deployed to Catalyst Development - ready for retest  
**Related journey:** Course Selection

The page is titled Available accreditation courses, uses concise portal copy, groups by treatment group, keeps Other last and supports search, expansion and persistent selection.

### FIX-011 - Summary and payment retry

**Priority:** High  
**Status:** Deployed to Catalyst Development - ready for retest  
**Related journeys:** Summary Submission; Stripe Payment; Awaiting Payment

Pay Now has per-application progress protection, missing checkout URLs are reported, existing open Stripe sessions are reused, partial CRM record IDs survive failed submissions for safe retry, and Awaiting Payment applications can reopen their Summary. Debug JSON remains fully visible and scrollable in error modals.

Additional retry-safety fixes:

- Pay Now and Continue no longer re-enable while Stripe checkout is opening, closing a window where a slow redirect could let a second click open a duplicate checkout session.
- A Stripe checkout is no longer blocked just because the follow-up CRM link-back write failed; the customer still reaches Checkout and the link is reconciled separately, rather than the checkout being discarded and a retry creating an orphaned second session.

### FIX-012 - Page layout overflow

**Priority:** Medium  
**Status:** Deployed to Catalyst Development - ready for retest  
**Related journeys:** School Portal; Accreditation; Login Dashboard

A CSS conflict let wide tables push their page wider than the screen instead of scrolling within their own panel, most visibly on the School Portal Courses tab, and also on the Venues, Tutors and Qualifications tabs, the Accreditation landing page and the GTi Courses/Membership/Insurance placeholder pages. Wide content now scrolls inside its own panel and the page itself no longer gains horizontal scroll.

### FIX-013 - Add course placement and copy

**Priority:** Low  
**Status:** Deployed to Catalyst Development - ready for retest  
**Related journey:** School Portal

Add course is shown within the Courses tab, directly below the accredited-courses table, matching the same in-page pattern as Add venue on the Venues tab rather than a separate top-level section. The placeholder "Enquiry workflow coming later" label has been replaced with "Get in touch".

## Test pack changes

- Remove CRM checks from customer steps and expected results.
- Keep CRM conditions only as test preconditions where needed.
- Describe where the result should be visible in the portal.
- Move the Training Centre Name validation to the appropriate form journey.
- Place the map test with the actual School Details or Geocoding step.
- Check pricing on Summary and Stripe, not by inspecting CRM.
- Document multiple-school setup in the test preconditions.

## Internal verification only

- Confirm CRM application source, purchase type, payment status and application stage.
- Confirm membership lookup and membership linkage.
- Confirm Stripe payment reaches the Creator webhook.
- Confirm the first qualification updates the linked application state.
- Confirm submit and payment retry do not create duplicates.
- Confirm Catalyst environment variables remain configured after deployment.

## UI improvement plan

This section records the agreed visual direction and its implementation status. Items marked deployed have been reviewed, approved and pushed to Catalyst Development and are ready for retest; anything still local is not yet ready for customer testing.

### UI-001 - Shared portal structure

**Status:** Deployed to Catalyst Development - ready for retest  
**Applies to:** Accreditation, School Portal, Courses, Venues, Tutors and Qualifications

- Use one consistent page header, content width, spacing scale, typography hierarchy and button system.
- Keep the existing Beauty Guild colours and compact portal styling.
- Use the main sidebar for portal-level navigation only: Dashboard, Membership, GTi Courses, Accreditation, Insurance, My profile and Documents.
- Use a clear secondary navigation within a selected training centre for Profile, Courses, Venues, Tutors and Qualifications.
- Keep primary actions in a predictable top-right position and use the same labels, sizes and states across pages.
- Provide consistent loading, empty, success, warning and error states.
- Maintain responsive layouts without horizontal page scrolling.

### UI-002 - Accreditation landing page

**Status:** Deployed to Catalyst Development - ready for retest

- Present a compact overview row for Accredited centres, Drafts, Awaiting payment and In progress.
- Place accredited training centres near the top of the page.
- Support more than one centre with a clean, compact list rather than oversized cards.
- Show applications in a single readable list with centre, status, last updated date and the appropriate action.
- Provide clear actions for View centre, View summary, Continue application, Add qualifications and Pay now.
- Keep Apply for new accreditation as the primary page action and avoid duplicate calls to action.
- Use UK date formatting throughout.

### UI-003 - Training centre workspace

**Status:** Deployed to Catalyst Development - ready for retest

- Use the selected training centre as the page context and show its name, accreditation status and essential details once.
- Provide consistent tabs or section navigation for Profile, Courses, Venues, Tutors and Qualifications.
- Keep page-specific actions next to the section heading, such as Add course (within the Courses tab), Add venue, Invite tutor or Add qualification.
- Ensure users can return to the Accreditation landing page without losing context.
- Use concise tables or lists that remain usable when a centre has many courses, venues, tutors or qualifications.

### UI-004 - Courses and venues

**Status:** Deployed to Catalyst Development - presentation pass only; ready for retest

- Courses should use a standard list/table layout with course name, treatment group, status and available actions.
- Course detail/edit screens should use a consistent section structure for basic details, content, delivery information and status.
- Venues should use the same list and detail patterns as courses.
- Empty states should explain what the user can add and provide the relevant primary action.
- Future editable fields must be based on confirmed CRM fields and permissions before implementation.

### UI-005 - Tutors and invite modal

**Status:** Deployed to Catalyst Development - UI preview only; workflow not yet implemented

- Show current and inactive/expired tutors clearly, including membership state and expiry where available.
- Include an Invite tutor action using the same modal and button patterns as the rest of the portal.
- The proposed modal collects tutor name and email and identifies the selected training centre.
- The modal should explain that the tutor's details and Guild membership will be checked before they are linked.
- A submitted invitation should have a visible pending state rather than appearing immediately as an active tutor.
- Do not imply that an invitation email, CRM contact creation, Catalyst user creation or tutor relationship has occurred until the backend workflow exists.

Proposed future tutor workflow, subject to CRM confirmation:

1. Check whether the email belongs to an existing CRM Contact.
2. Check whether that Contact has a current Guild membership.
3. Link an existing Contact to the training centre through the Tutor Relationships module.
4. If the Contact does not exist, create it and trigger the agreed registration/invitation route.
5. Create the tutor relationship as Active only when membership is current; otherwise create it as Inactive.
6. Allow membership automation to activate the relationship later when membership becomes current.
7. Add referral-code handling in a later phase once its source and CRM field are confirmed.

Known Tutor Relationships fields supplied for future mapping:

- Module: Tutor Relationships
- `Name` - Tutor Relationships Name
- `Tutor_Contact` - Tutor Contact lookup
- `Training_Centre` - Training Centre lookup
- `Tutor_Relationship` - Membership lookup
- `Status` - relationship status
- `Account` - Account lookup

### UI-006 - Qualifications

**Status:** Deployed to Catalyst Development - ready for retest

- Display qualifications in a compact list with qualification name, completion month/year and verification status.
- Keep Add qualification visible and allow more than one qualification to be submitted.
- Use only Verified and Pending review as customer-facing verification labels.
- Show clear confirmation after each successful submission and retain an obvious route to add another.
- Keep Account selection internal; users select only from training centres linked through their accreditation records.

### UI implementation checkpoint

Before any UI plan item is implemented:

- Confirm the exact page or component included in the pass.
- Confirm whether the request is review/mock-up only or permission to edit code.
- Confirm the CRM fields and user permissions required by any editable feature.
- Implement locally, review responsively and obtain approval before deployment.

## Ready for customer retest

A fix is ready when the portal build passes, the affected journey works in Catalyst Development, the customer-facing result is visible in the portal, and all required test data is documented as a precondition.
