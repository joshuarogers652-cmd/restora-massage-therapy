# Security, privacy and compliance

RESTORA stores sensitive health information: intake answers, screening flags, therapist review notes and SOAP notes. This page explains how the software protects it, what you must do, and what still needs a professional's review.

> **This software does not claim to be HIPAA compliant, and no compliance review has been done.** Whether HIPAA applies depends on how RESTORA operates (see "Professional review needed" below). Encryption and secure hosting alone don't make a business compliant.

## How the software protects data

| Protection | How |
| --- | --- |
| HTTPS only | Azure Static Web Apps serves HTTPS. HSTS and `upgrade-insecure-requests` headers are set |
| Sign-in | Handled by Microsoft (Azure Static Web Apps authentication). RESTORA never sees or stores passwords |
| Roles checked on the server | Every API function checks the user's role **in RESTORA's own database**. Roles claimed by the browser or sign-in provider are ignored, and tests confirm this. Hiding a page in the browser is only a convenience |
| Least access | Clients see only their own records. Therapists open only appointments assigned to them. Office managers see scheduling, contact and payment details but **not** clinical records. Only administrators change settings, prices, roles and refunds |
| Field encryption | Intake answers, visit concerns, screening flags, review rationale and SOAP notes are encrypted with AES-256-GCM using your `DATA_ENCRYPTION_KEY` before they're saved. Without the key the API refuses to store or show them |
| Encryption at rest | Azure Database for PostgreSQL also encrypts all data on disk |
| Locked clinical notes | Signed SOAP notes can't be edited. Changes are saved as amendments that keep the previous version. The database itself enforces this |
| Audit log | Every view of clinical records, every review, SOAP change, role change, setting change, cancellation and refund is logged with who did it and when. The log can't be edited or deleted, even directly in the database |
| Double-booking | Enforced by the database (an exclusion constraint) as well as the API |
| No health data in messages | Emails and texts contain only service, date and time |
| No health data in the browser | Health answers are never saved in browser storage. Only the language choice and the non-medical booking selection (service, time) are remembered, and only for the current visit |
| Payments | Card details go directly to Stripe. RESTORA stores only Stripe's reference IDs and amounts. Payment confirmation is trusted only from Stripe's signed webhook |
| Input checking | Every API input is validated, with length limits. The contact form has a spam trap and rate limit |
| Security headers | Content Security Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy and Permissions-Policy on the website. API responses set their own headers and `Cache-Control: no-store` |
| Public files | Only service descriptions, branding and non-sensitive settings are public. Translation files contain no client data |
| Secrets | Kept only in Azure environment variables and GitHub secrets. `.gitignore` blocks `.env` files |

## What you must do

1. **Keep `DATA_ENCRYPTION_KEY` safe.** Store it in a password manager. Losing it means encrypted records can't be read. Never change it once real records exist.
2. **Use strong, unique passwords** for Azure, GitHub, Stripe and the database, with **multi-factor sign-in turned on** for each.
3. **Staff multi-factor sign-in.** With the default Microsoft sign-in (Free plan), each staff member must turn on two-step verification on their Microsoft account; the app can't enforce it. To *require* it, use Microsoft Entra External ID with Conditional Access ([AZURE_DEPLOYMENT.md › Authentication](AZURE_DEPLOYMENT.md#authentication)).
4. **Give people the lowest role they need.** Review Admin › Users & roles every month, and remove roles when staff leave.
5. **Shared computers.** Sign out after using the therapist or admin screens on a front-desk computer.
6. **Backups.** Keep the database backup retention at 35 days, and practise a restore once ([DATABASE_SETUP.md, step 6](DATABASE_SETUP.md#6-backups)).
7. **Never** put real client information in GitHub, test data or screenshots.

### Database
For tighter security once live, the app's database login can be limited to reading and writing data (no dropping tables). The admin login is then kept only for maintenance.

### Session handling
Azure Static Web Apps manages sign-in sessions with secure, HTTP-only cookies. Sessions end when the user signs out (`/logout`). With External ID you can also set sign-in frequency for staff in Conditional Access.

### Incident response (what to do if something goes wrong)
1. **Contain:** remove the affected person's roles in Admin › Users & roles. If a secret may have leaked, rotate it: a new database password, Stripe keys, or the Azure deployment token ("Reset token").
2. **Investigate:** review Admin › Audit log (and Application Insights if enabled) for what was viewed or changed, and by whom.
3. **Notify:** if personal or health information may have been exposed, contact your attorney promptly. Texas law (Bus. & Com. Code §521.053) requires notifying affected individuals within 60 days, and the Texas Attorney General if 250 or more Texans are affected. Other rules may also apply.
4. **Record** what happened and what you changed.

## Not yet built
- **Automatic reminders** (48h, 24h, 2h before the appointment). Azure Static Web Apps' built-in API runs only on web requests, not on a timer. Adding reminders needs a small separate Azure Function App or Logic App on a schedule. Booking, cancellation and review confirmations are sent at the time they happen (once Azure Communication Services is set up).
- **Online gift card purchase and redemption.** Gift cards are issued and tracked in the admin dashboard and redeemed at the front desk.
- **AI-assisted SOAP drafting** isn't included. If you add it later, it must require therapist approval, and it needs a privacy and legal review before any client information is sent to an AI provider.
- **Printable or exportable record packages** for records requests. Today the owner fulfils requests manually and records the action in Admin › Records requests.
- **Treatment rooms** (room scheduling). Scheduling is per therapist.

## Professional review needed before opening to clients
| Area | Who | What |
| --- | --- | --- |
| HIPAA applicability | Healthcare attorney | Whether RESTORA is a "covered entity" (for example, if it bills health insurance electronically). If yes: Business Associate Agreements with Microsoft (Azure) and every vendor that touches health data, a risk analysis, and written policies |
| Texas privacy law | Attorney | Texas Medical Records Privacy Act (Health & Safety Code ch. 181, including staff training and notice duties), Texas Data Privacy and Security Act, and breach notification (Bus. & Com. Code §521.053) |
| Massage therapy rules | Attorney or TDLR | Texas Department of Licensing and Regulation massage therapy rules (16 TAC ch. 117): client records and retention, advertising with license numbers, establishment licensing |
| Consent forms, Privacy Policy, Terms | Attorney | All are **drafts** (Admin can't edit consent text yet; a developer updates `api/database/migrations` with a new version) |
| Screening checklist and categories | Licensed massage therapist or clinician | Every condition and its category (postpone/refer, modify, clearance), including the rule blocking dynamic cupping with prenatal massage |
| Text and email consent | Attorney | TCPA (texts) and CAN-SPAM (marketing email) |
| Electronic signatures | Attorney | Typed-name consent signatures under Texas UETA |
| Record retention | Attorney or TDLR | How long to keep intake forms, SOAP notes, consents and payments, and how to dispose of them |
| Security testing | Security professional | A penetration test of the live site before handling real client data |

## Brand
The RESTORA name and lotus logo are original but **not trademark-cleared**. Search USPTO and the Texas trademark register before printing materials or signage.
