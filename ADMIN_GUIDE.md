# Admin guide (running RESTORA day to day)

Sign in with the email listed in `ADMIN_EMAILS`, then open **My account → Admin**, or go to `/admin`.

## First-time setup checklist
1. **Settings → Contact details & business hours.** Enter phone, email, address, map link and your opening hours. Online booking only offers times inside these hours. Until you publish hours, booking follows each therapist's own hours.
2. **Services & pricing.** Open each massage, check the **30 / 60 / 90 minute prices** (the starting prices come from the business plan), adjust the wording if you like, and **Save**. Leave a price empty to stop that length being booked online.
3. **Services & pricing → Enhancements.** Set **added minutes** and **added price** for Face Massage, Foot Scrub and Dynamic Cupping. Each becomes bookable once both are set.
4. **Therapists → Add therapist.** Enter their **sign-in email**, display name, license number and expiry, the services they're qualified for, enhancement qualifications (Dynamic Cupping requires a certification), and weekly hours. Ask them to sign in once. Their profile links automatically and they appear in booking.
5. **Users & roles.** Give your front-desk person the **office manager** role after they've signed in once. Don't give anyone more access than they need.
6. **Settings → Booking rules.** Set the start-time interval, cleanup time between clients, minimum notice, how far ahead people can book, and the cancellation and rescheduling windows.
7. **Settings → Website content.** Optional announcement banner (English and Spanish) and the lotion policy text.
8. Make a test booking with your own account to see what clients see. Then cancel it.

## Roles
| Role | Can |
| --- | --- |
| Client | Book, manage their own appointments, intake form, consents, receipts and preferences |
| Therapist | See their own schedule; open their clients' intake, flags and history; record health reviews; check in, complete and write SOAP notes |
| Office manager | Overview, appointments, cancellations, time off and closures, client contact list, therapist list, view services, promotions, gift cards and payments, contact messages. **Can't** see clinical records, change prices or settings, or issue refunds |
| Admin (owner) | Everything, including settings, pricing, staff roles, refunds, reports, records requests and the audit log |

## Daily use
- **Overview:** today's and this week's bookings, appointments waiting for review, outstanding SOAP notes, revenue, cancellations, no-shows and therapist utilization.
- **Appointments:** filter by date and status. Cancel with a reason; the client is notified and any online payment is refunded (automatically through Stripe, or marked "manual refund needed").
- **Time off & closures:** block a therapist's vacation, or the whole business for a holiday.
- **Messages:** contact-form messages. Mark them handled once you've replied.

## Health screening (important)
When a client reports a condition on a service's checklist, the booking becomes **"Awaiting therapist review"**. It can't be checked in or completed until the assigned therapist records a review:
- **Proceed** or **Proceed with modifications** → confirmed, and the client is told.
- **Request assessment or medical clearance** → stays pending.
- **Postpone** or **Refer for evaluation** → cancelled with a refund, and the client is asked to get in touch.

The software never decides that treatment is safe. It only flags concerns for the therapist.

## SOAP notes
Therapists write notes from their dashboard after checking the client in. Drafts save automatically. A note can be **signed** only after the session is marked completed and every section (S, O, A, P) has an entry. Signed notes are locked. Corrections are saved as **amendments** that keep the original. **Overview** shows outstanding notes.

## Records requests
Clients can request a copy of their records from their account. You'll see requests under **Records requests**.
1. Verify the person's identity, for example by calling the phone number on file.
2. Prepare the copy. Therapists can view and print a client's SOAP notes from the appointment screen.
3. Deliver it securely, then select **Mark completed** and note what you sent.

Confirm the response deadline that applies to you with your attorney (see SECURITY.md).

## Promotions and gift cards
- **Promotions:** create a code (for example `WELCOME10`) as a percentage or a dollar amount off, with dates and an optional usage limit. Clients enter it on the booking review step.
- **Gift cards:** create a card for an amount. **The code is shown only once**, so write it down for the recipient. Adjust the balance when it's used at the front desk.

## Payments and reports
- **Payments:** online payments, refunds and receipts (only when Stripe is connected). Admins can issue full or partial refunds.
- **Reports:** monthly completed appointments, their value, money collected online, refunds, cancellations and no-shows.

## Audit log
Shows the latest 300 recorded actions: who opened clinical records, signed or amended notes, changed roles, prices or settings, and issued refunds. It can't be edited.

## Changing consent forms, screening lists or service lists
Consent wording and screening checklists are stored as versioned records. Changing them needs a developer to add a new migration file in `api/database/migrations`, so there's a review trail. Service descriptions, benefits, prices, durations and enhancement details **can** be edited in the dashboard.
