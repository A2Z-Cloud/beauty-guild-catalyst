# Beauty Guild Catalyst portal

Beauty Guild's member portal for training-centre accreditation. The project is hosted in Zoho Catalyst and contains a React web client plus an Advanced I/O backend function.

## Project layout

```text
beautyguildclient/                 React portal client
functions/beauty_guild_api/        Catalyst API function
catalyst.json                      Catalyst client/function configuration
SETUP.md                           Existing machine setup notes
```

The portal currently includes:

- Catalyst login and public registration flow.
- Member dashboard and navigation for Membership, GTi Courses, Accreditation and Insurance.
- Accreditation applications with drafts, CRM-backed application states and qualification entry.
- CRM membership lookup and accreditation/qualification data handling.
- Stripe Checkout session creation and payment-link reuse for applications awaiting payment.
- Loqate address lookup/geocoding support and Leaflet map display.
- Training-centre profile and management views for courses, venues, tutors and qualifications.

## Requirements

- Node.js and npm.
- Zoho Catalyst CLI: `npm install -g zcatalyst-cli`.
- Access to the BeautyGuild Catalyst project and its Development environment.
- Access to the `zohocrm` Catalyst connection for CRM-backed API calls.
- Test-mode Stripe credentials and Loqate credentials for local backend testing.

## Install

From the project root:

```bash
npm install --prefix beautyguildclient
npm install --prefix functions/beauty_guild_api
```

The backend environment file is intentionally ignored by Git. Copy the template and add local values:

```bash
cp functions/beauty_guild_api/.env.example functions/beauty_guild_api/.env
```

Never commit `.env`, Stripe secret keys, Loqate keys or Catalyst connection credentials.

## Run locally

Link the folder to the correct Catalyst project, then serve from the root:

```bash
catalyst login
catalyst project:list
catalyst project:use
catalyst serve --http 5000
```

The client is normally available at `http://localhost:5000/app/`. The API is served by Catalyst under its function route. The exact local API URL is shown by `catalyst serve`.

For client-only UI work, use:

```bash
npm start --prefix beautyguildclient
```

## Validate and deploy

Build the client before deploying:

```bash
npm run build --prefix beautyguildclient
```

Deploy only the client for frontend changes:

```bash
catalyst deploy --only client
```

Deploy the API when backend code or server configuration changes:

```bash
catalyst deploy --only functions
```

Confirm the active Catalyst project and environment before deploying. Do not overwrite production configuration from a local `.env` file.

## Integrations

### Zoho CRM

The backend uses the Catalyst CRM connection named `zohocrm`; CRM authentication is configured in Catalyst rather than committed to the repository. CRM module/API names and field mappings are defined in `functions/beauty_guild_api/index.js`.

Important flows include contacts, accounts, accreditations, memberships/deals and qualifications. Qualification records use the `Qualifications` module and the first qualification moves the linked application to `Needs Processing`.

### Stripe

Stripe is currently configured for test mode. The portal creates Checkout sessions and redirects the member to Stripe. Existing Checkout/payment links are reused for applications awaiting payment to reduce duplicate charges. A separate Creator webhook is expected to update CRM payment state.

Stripe price IDs and URLs belong in the backend environment configuration. Do not put secret keys in React source code.

### Loqate and maps

Loqate is used for address lookup/geocoding. Leaflet and OpenStreetMap provide the map display. Address details are sent to CRM; map coordinates are used for the map experience and are not treated as a separate CRM mapping unless explicitly added later.

## Application states

The portal distinguishes between:

- Draft applications.
- Awaiting payment.
- Applications in progress / pending review.
- Needs Processing after qualifications are added.
- Verified/accredited training centres.

Keep these labels aligned with the CRM values before changing backend filtering or payment behaviour.

## Working with the team

- Make small, focused commits.
- Keep CRM field API names documented when adding mappings.
- Test with Stripe test mode only during development.
- Do not commit `.env` files or generated `build/` output.
- Run the client build before opening a pull request.
- Coordinate before changing payment, CRM status or membership logic because these affect both the portal and Creator webhook workflow.

## GitHub handoff

After GitHub authentication and once the A2Z Cloud repository name is confirmed, initialise and push from this project root:

```bash
git init
git add .
git commit -m "Initial Beauty Guild Catalyst portal"
git branch -M main
git remote add origin https://github.com/A2Z-Cloud/REPOSITORY_NAME.git
git push -u origin main
```

Replace `A2Z-Cloud` and `REPOSITORY_NAME` with the exact organisation and repository name confirmed by the organisation owner. Verify the remote with `git remote -v` before pushing.
