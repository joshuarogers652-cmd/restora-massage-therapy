# Deploying to Microsoft Azure

This guide creates the Azure services, connects them to GitHub, and turns on optional features. Do it in this order. Every value you paste goes into **Azure** or **GitHub secrets**, never into a file.

**What you'll create**

| Azure service | Purpose | Plan to start with |
| --- | --- | --- |
| Static Web App | Website + API | **Free** (Standard ≈ $9/month, needed for email/Google sign-up) |
| Azure Database for PostgreSQL – Flexible Server | Appointments and records | Burstable **B1ms** (≈ $13–$25/month; check the price shown in the portal) |
| Azure Communication Services (optional) | Email and text confirmations | Pay per message |

Prices change, so check the Azure pricing calculator. Microsoft offers a free trial credit for new accounts.

---

## 1. Create an Azure account and resource group
1. Sign up or sign in at <https://portal.azure.com>.
2. Search **Resource groups** → **Create** → name it `restora-rg`, region **(US) South Central US** (Texas) → **Review + create** → **Create**.

## 2. Create the Static Web App
1. Search **Static Web Apps** → **Create**.
2. **Resource group:** `restora-rg` · **Name:** `restora-web` · **Plan type:** Free (you can upgrade later).
3. **Deployment details → Source:** choose **Other**.
   This project already includes its own GitHub workflow. Choosing *Other* stops Azure from adding a second, conflicting workflow file to your repository.
4. **Review + create** → **Create**, then **Go to resource**.
5. On the **Overview** page, select **Manage deployment token** → **Copy**.
6. In GitHub, add it as the secret **`AZURE_STATIC_WEB_APPS_API_TOKEN`** ([GITHUB_SETUP.md, step 4](GITHUB_SETUP.md#4-add-the-azure-deployment-secret)).
7. In GitHub → **Actions** → **Azure Static Web Apps CI/CD** → **Run workflow**.

When it finishes, open the **URL** shown on the Static Web App's Overview page. The public pages work right away. Booking and accounts work after steps 3–5.

> **If you chose "GitHub" as the source instead:** Azure adds its own workflow file (named like `azure-static-web-apps-<random>.yml`) and its own secret (`AZURE_STATIC_WEB_APPS_API_TOKEN_<RANDOM>`). Delete Azure's workflow file from `.github/workflows` in GitHub, then add the token as `AZURE_STATIC_WEB_APPS_API_TOKEN` as described above, so only this project's workflow runs.

**Build settings (already set in the workflow):** app location `/`, API location `api`, output location `dist`, API runtime Node.js 22 (`staticwebapp.config.json`).

## 3. Create the database
Follow [DATABASE_SETUP.md](DATABASE_SETUP.md). You'll come back with a `DATABASE_URL`.

## 4. Create the encryption key
Health records (intake forms, screening flags, review notes, SOAP notes) are encrypted with your own key before they are saved.
1. In the Azure portal, open **Cloud Shell** (the `>_` icon at the top) → choose **Bash**.
2. Run: `openssl rand -base64 32`
3. Copy the result (44 characters ending in `=`).
4. **Save a copy in a password manager.** If the key is lost, encrypted records can't be read by anyone. Never change it once real records exist.

## 5. Add the environment variables
Static Web App → **Settings → Environment variables** → **Production** tab → **+ Add** for each, then **Apply**:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | From DATABASE_SETUP.md |
| `DATA_ENCRYPTION_KEY` | From step 4 |
| `ADMIN_EMAILS` | The email you'll sign in with, for example `owner@yourdomain.com`. Separate several with commas |

Then visit `https://<your-site>/api/health`. You should see:

```json
{"status":"ok","database":"ok","encryption":"configured","payments":"not_configured","email":"not_configured","sms":"not_configured","adminEmailsSet":true}
```

| You see | Fix |
| --- | --- |
| `"database":"not_configured"` | `DATABASE_URL` is missing |
| `"database":"unreachable"` | Wrong password or server name, or the database firewall blocks Azure services (DATABASE_SETUP.md, step 3) |
| `"database":"migration_failed"` | Usually the extensions aren't allowed (DATABASE_SETUP.md, step 4). The message says which one |

## 6. Sign in as the owner
Open your site → **Sign in** → sign in with the Microsoft account whose email you put in `ADMIN_EMAILS`. Then go to `/admin`. Continue with the [Admin guide](ADMIN_GUIDE.md).

---

## Authentication

### Option A (works now, Free plan): Microsoft accounts
No setup needed. People sign in with a Microsoft account (Outlook, Hotmail, Live, or a work or school account). Anyone can create a free Microsoft account with their **existing** email address (including Gmail) at <https://signup.live.com>.

Notes:
- The GitHub and X sign-in options Azure includes by default are turned off in `staticwebapp.config.json`.
- **Roles are managed in RESTORA, not by the sign-in provider.** New accounts are clients. `ADMIN_EMAILS` accounts are administrators. You give therapist and office-manager access in Admin › Users & roles, or by adding a therapist with their email.
- **Staff multi-factor sign-in:** with Option A, the app can't force MFA. Each staff member must turn on two-step verification on their own Microsoft account (<https://account.microsoft.com/security>). Option B lets you require it.

### Option B (recommended before launch, Standard plan): Microsoft Entra External ID
External ID lets clients create an account with **any email and a password** (or Google), and lets you **require MFA for staff**. It needs the Static Web App **Standard** plan. Using a custom provider turns off the built-in providers.

> This option is **prepared but not tested** in this build. The Microsoft documentation for Static Web Apps shows standard Entra ID issuer addresses (`login.microsoftonline.com`). External ID tenants use a `ciamlogin.com` issuer. Test it on a preview or staging site before switching your live site.

1. **Upgrade the plan:** Static Web App → **Settings → Hosting plan** → **Standard** → **Save**.
2. **Create an external tenant:** Azure portal → search **Microsoft Entra External ID** → **Create a tenant** → **External** → follow the wizard. Note the **Tenant ID** and the **tenant subdomain** (the part before `.onmicrosoft.com`).
3. **Register the app** (in the external tenant): **App registrations → New registration**
   - Name: `RESTORA website`
   - Redirect URI (Web): `https://<your-site>/.auth/login/aad/callback`
   - Under **Authentication**, add the front-channel logout URL `https://<your-site>/.auth/logout/aad/callback`, and tick **ID tokens**.
   - **Certificates & secrets → New client secret**. Copy the **Value**.
   - Copy the **Application (client) ID** from Overview.
4. **Create a sign-up and sign-in user flow:** External ID → **User flows → New user flow** → choose **Email with password** (and optionally Google) → collect **Display name** → create it, then **Applications → Add application** → `RESTORA website`.
5. **Require MFA for staff (recommended):** in the external tenant, create a **Conditional Access** policy that requires multifactor authentication for a group containing your staff accounts.
6. **Add environment variables** to the Static Web App: `AAD_CLIENT_ID` = the Application (client) ID; `AAD_CLIENT_SECRET` = the secret value.
7. **Switch the configuration file:** in GitHub, open `docs/staticwebapp.config.external-id.json`, replace `REPLACE-WITH-TENANT-SUBDOMAIN` and `REPLACE-WITH-TENANT-ID`, copy the whole file, and paste it over `staticwebapp.config.json` at the top level. Commit. The site redeploys.
8. Sign in again. People who signed in under Option A get **new accounts**, because the sign-in provider changed. Re-grant staff roles in Admin › Users & roles.

The website itself needs no change. It always signs in through `/.auth/login/aad`.

---

## 7. Online payments with Stripe (optional)
Until this is done, online booking works without payment and clients pay at their visit. **The Stripe integration is built but has never run against a live Stripe account.** Test it in Stripe's test mode first.

1. Create a Stripe account at <https://dashboard.stripe.com>. Stay in **Test mode** at first.
2. **Developers → API keys:** copy the **Publishable key** (`pk_…`) and the **Secret key** (`sk_…`).
3. **Developers → Webhooks → Add endpoint**
   - URL: `https://<your-site>/api/payments/webhook`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.succeeded`
   - Copy the **Signing secret** (`whsec_…`).
4. Add environment variables: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
5. Check `/api/health` shows `"payments":"configured"`.
6. Admin › Settings › **Online payments** → choose **A deposit** or **The full amount** → Save.
7. Make a test booking with Stripe's test card `4242 4242 4242 4242` (any future date, any CVC). The appointment should change from "Awaiting payment" to "Confirmed" within a few seconds.
8. When everything works, repeat steps 2–4 with your **live** keys.

How it's protected: card details go straight to Stripe and never reach RESTORA. The appointment is confirmed only when Stripe's signed webhook arrives, and each event is processed once. Refunds from Admin › Payments go through Stripe.

## 8. Email and text confirmations (optional)
**Built, but never tested against a live Azure Communication Services account.** Messages include only the service, date and time, never health details. Text messages go only to clients who opted in.

**Email**
1. Create a **Communication Services** resource and an **Email Communication Services** resource in `restora-rg`.
2. In the Email resource: **Provision domains → Add a free Azure subdomain** (or connect your own domain).
3. In the Communication Services resource: **Email → Domains → Connect domain**.
4. Copy the **connection string** (Communication Services → **Keys**) and the sender address (for example `DoNotReply@xxxx.azurecomm.net`).
5. Add environment variables `ACS_EMAIL_CONNECTION_STRING` and `ACS_EMAIL_SENDER`.

**Text messages** (US numbers must be verified before sending)
1. Communication Services → **Phone numbers → Get** → a **toll-free** number with SMS.
2. Complete **toll-free verification** (Regulatory Documents). Approval can take several weeks.
3. Add environment variables `ACS_SMS_CONNECTION_STRING` (same connection string) and `ACS_SMS_FROM` (for example `+18885550100`).
4. Admin › Settings › Client messages → tick **Send text messages**.

You can see every attempted message and its status (sent, not configured, opted out) in the database `notifications` table.

## 9. Your own domain (optional)
Static Web App → **Settings → Custom domains → + Add**. Follow the steps to add a CNAME record at your domain registrar. Azure provides the HTTPS certificate for free. If you use Option B sign-in, add the new domain's callback URLs to the app registration too.

## Backups and monitoring
- **Database backups** are automatic. Set retention to 35 days (DATABASE_SETUP.md, step 6).
- **Errors:** Static Web App → **Settings → Application Insights** → turn on to see API errors. Logs never include health details.
- **Code** is in GitHub, which keeps every version.
