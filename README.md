# RESTORA Massage Therapy

**Restore Your Body. Renew Your Balance.**

The website and practice-management app for RESTORA Massage Therapy:

- **Public website:** English and Spanish, with services, enhancements, About and Contact pages
- **Online booking:** service, length, enhancements, therapist, date and time, intake form, health screening, consent forms, review and confirmation
- **Client portal:** appointments, rescheduling and cancelling, profile, intake form, signed consent forms, receipts, message preferences, and records requests
- **Therapist dashboard:** schedule, health-review requests, the client's intake and history, and SOAP notes with drafts, signatures and amendments
- **Admin dashboard:** appointments, clients, therapists, services and pricing, enhancements, promotions, gift cards, payments and refunds, reports, website settings, staff roles and the audit log

It runs on **Microsoft Azure Static Web Apps**, with an **Azure Functions** API and an **Azure Database for PostgreSQL** database. Updates deploy automatically from **GitHub**.

> You don't need to be a developer to set this up. Follow the steps below in order. Each step links to a detailed guide in the `docs` folder.

---

## What works now, and what needs setting up

| Feature | Status |
| --- | --- |
| Website, booking, client portal, therapist and admin dashboards | **Built and tested** (see "Testing" below) |
| Database | Works as soon as you add the database connection (step 5) |
| Sign-in | Works on the **Free** plan with Microsoft accounts. Email or Google sign-up through Microsoft Entra External ID needs the **Standard** plan and a one-time setup ([docs/AZURE_DEPLOYMENT.md](docs/AZURE_DEPLOYMENT.md#authentication)) |
| Online payments (Stripe) | **Built, but turned off** until you add Stripe keys. Clients pay at their visit until then. Never tested against live Stripe |
| Email and text confirmations | **Built, but turned off** until you add Azure Communication Services. Never tested against a live service |
| Automatic reminders (48h, 24h, 2h before) | **Not built yet.** Azure's built-in API can't run timed jobs. See [docs/SECURITY.md › Not yet built](docs/SECURITY.md#not-yet-built) |
| Prices | Starting prices come from the business plan. **Confirm or change them** in Admin › Services & pricing. Enhancements have no price until you set one |
| Contact details and hours | **Empty** until you enter them in Admin › Settings. The website shows "Coming soon" |

---

## Setting it up (about 1–2 hours the first time)

### 1. Extract the ZIP
Right-click `RESTORA_Massage_Therapy_Azure_GitHub.zip` → **Extract All**. You'll get a folder named `restora-massage-therapy`.

### 2. Create a GitHub repository
Sign in at <https://github.com> → **New repository** → name it `restora-massage-therapy` → choose **Private** → **Create repository**. Don't add a README; the project has one.

### 3. Upload the files
On the new repository's page choose **uploading an existing file**. Open the extracted folder, select **everything inside it** (including the `.github` folder), drag it onto the page, then **Commit changes**.

> **Hidden folder:** the `.github` folder holds the deployment workflow. If your computer hides folders that start with a dot, turn on "Show hidden items" (Windows: File Explorer › View › Show › Hidden items; Mac: press Cmd+Shift+.).
> Full walkthrough: [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md)

### 4. Create the Azure Static Web App and connect it to GitHub
Azure portal → **Create a resource** → **Static Web App**. Then copy its *deployment token* into GitHub as the secret **`AZURE_STATIC_WEB_APPS_API_TOKEN`**.
Step-by-step: [docs/AZURE_DEPLOYMENT.md](docs/AZURE_DEPLOYMENT.md)

### 5. Create the database
Create an **Azure Database for PostgreSQL – Flexible Server**, allow two extensions, and create a database named `restora`.
Step-by-step: [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md)

### 6. Add the settings (environment variables)
In the Static Web App → **Settings › Environment variables**, add:

| Name | Required? | What it is |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** | Database connection (from step 5) |
| `DATA_ENCRYPTION_KEY` | **Yes** | Key that encrypts health records. Create it once and keep a backup copy |
| `ADMIN_EMAILS` | **Yes** | Your sign-in email. That account becomes the administrator |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional | Online payments |
| `ACS_EMAIL_CONNECTION_STRING`, `ACS_EMAIL_SENDER` | Optional | Email confirmations |
| `ACS_SMS_CONNECTION_STRING`, `ACS_SMS_FROM` | Optional | Text confirmations |

`.env.example` lists them all with explanations. **Never put real values in any file in GitHub.**

### 7. Configure sign-in
It works right away with Microsoft accounts. For email or Google sign-up, see [Authentication](docs/AZURE_DEPLOYMENT.md#authentication).

### 8. Deploy
Any change you commit to the `main` branch on GitHub deploys automatically. Watch it under the repository's **Actions** tab. The first deployment takes about 5 minutes.

### 9. Open your website
Your address is shown on the Static Web App's **Overview** page in Azure (for example `https://<random-name>.azurestaticapps.net`). Visit `/api/health` on that address. It should say `"database":"ok"` and `"encryption":"configured"`.

### 10. Run the business
Select **Sign in** with the email you put in `ADMIN_EMAILS`, then open **My account → Admin** (or go to `/admin`). The [Admin guide](docs/ADMIN_GUIDE.md) walks through adding therapists, setting prices and hours, and daily use.

---

## Deploying updates
Change a file on GitHub (or upload a new version) and commit it to `main`. GitHub checks the code, runs the tests, then deploys. If a check fails, the live site stays as it was. Open **Actions** to see why.

## Running it on your own computer (optional, for developers)
Requirements: Node.js 22 and a PostgreSQL database.

```bash
npm ci && npm ci --prefix api
cp .env.example .env.local     # then fill in DATABASE_URL, DATA_ENCRYPTION_KEY, ADMIN_EMAILS
npm run build:api && npm run build
npm run local                  # http://localhost:4280
```

`npm run local` serves the website and API together. It imitates Azure sign-in with a simple "type your email" page that exists **only on your computer**. For live editing, run `npm run local` in one terminal and `npm run dev` in another (<http://localhost:5173>).

If you install the [Azure Static Web Apps CLI](https://learn.microsoft.com/azure/static-web-apps/static-web-apps-cli-overview) and [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local), you can also run `swa start dist --api-location api` to use Microsoft's official emulator.

## Testing

| Command | What it checks |
| --- | --- |
| `npm run validate:json` | Every JSON file is valid, and the English and Spanish translations have the same keys |
| `npm run typecheck` | Website type check |
| `npm run build:api` | API type check and build |
| `npm test` | 54 unit and API tests against a real temporary PostgreSQL database: sign-in, roles, booking, double-booking, screening, SOAP notes, payments webhook, settings and encryption |
| `npm run test:e2e` | 50 browser tests (desktop and phone) against `npm run local`. Run `npx playwright install chromium` first |

## Project layout

```
index.html, src/          React website (Vite + Tailwind)
  pages/                  Home, About, Services, ServiceDetails, Enhancements, Booking, Contact,
                          Login, Register, ClientDashboard, TherapistDashboard, AdminDashboard
  components/             Header, Footer, Navigation, ServiceCard, BookingCalendar, IntakeForm,
                          BodyDiagram, SOAPForm, ProtectedRoute, admin/…
  locales/en.json, es.json
api/                      Azure Functions (TypeScript, Node.js 22)
  src/functions/          public, client, therapist, admin, payments endpoints
  src/services/           booking, availability, catalog, payments, notifications, encryption
  database/migrations/    SQL applied automatically on start-up
database/                 Optional demo data and notes
public/                   Logos, favicon, images
staticwebapp.config.json  Azure routing, security headers, runtime
.github/workflows/        GitHub → Azure deployment
docs/                     Setup, security and admin guides
scripts/                  Local server, JSON checker
tests/                    Unit, API and browser tests
```

## Before you open to clients
Read [docs/SECURITY.md](docs/SECURITY.md), especially the list of items that need **professional review** (privacy policy, consent wording, screening categories, Texas recordkeeping and whether HIPAA applies). **This software does not claim to be HIPAA compliant.**
