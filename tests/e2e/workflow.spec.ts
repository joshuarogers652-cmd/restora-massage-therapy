/**
 * Full business workflow through the real screens:
 * owner sets up → therapist signs in → client books with a health flag →
 * therapist reviews → client sees it confirmed → therapist writes and signs a SOAP note.
 * All people and data are fictional. Requires the local server with a fresh database.
 */
import { expect, test } from "@playwright/test";
import pg from "pg";
import { newUser, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

const OWNER = "owner@restora.test";
const THERAPIST = "maria.therapist@restora.test";
const CLIENT = "ana.client@example.test";
const shots = process.env.SHOTS_DIR;

test("owner sets an enhancement price and adds a therapist", async ({ browser }) => {
  const { ctx, page } = await newUser(browser, OWNER, "/admin");
  await expect(page.getByRole("heading", { name: "Business dashboard" })).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/admin-overview.png`, fullPage: true });

  await page.getByRole("button", { name: "Services & pricing" }).click();
  const face = page.locator('[data-enhancement-editor="face-massage"]');
  await face.locator("summary").click();
  await face.locator('[data-field="minutes"]').fill("15");
  await face.locator('[data-field="price"]').fill("20");
  await face.getByRole("button", { name: /Save Face Massage/ }).click();
  await expect(page.getByText("Face Massage saved.")).toBeVisible();

  await page.getByRole("button", { name: "Therapists" }).click();
  await page.getByRole("button", { name: "Add therapist" }).click();
  const form = page.locator('[data-therapist-form="new"]');
  await form.locator('input[name="inviteEmail"]').fill(THERAPIST);
  await form.locator('input[name="displayName"]').fill("Maria Test");
  await form.locator('[data-qualify="face-massage"]').check();
  await form.getByRole("button", { name: "Save therapist" }).click();
  await expect(page.getByText("Therapist added.")).toBeVisible();
  await expect(page.getByText(`Invited: ${THERAPIST}`)).toBeVisible();
  await ctx.close();
});

test("therapist signs in and is linked to their profile", async ({ browser }) => {
  const { ctx, page } = await newUser(browser, THERAPIST, "/therapist");
  await expect(page.getByRole("heading", { name: "Your schedule" })).toBeVisible();
  await ctx.close();
});

test("client books online with a health flag", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto("/book");
  await page.locator('[data-service="swedish"]').click();
  await page.getByRole("radio", { name: /60 min/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('[data-enhancement="face-massage"]').check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Maria Test/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  // first day with times
  for (const day of await page.locator("[data-date]:not([disabled])").all()) {
    await day.click();
    await expect(page.getByText("Finding available times…")).toHaveCount(0);
    if (await page.getByRole("radiogroup", { name: "Choose a time" }).count()) break;
  }
  await page.getByRole("radiogroup", { name: "Choose a time" }).getByRole("radio").first().click();
  if (shots) await page.screenshot({ path: `${shots}/booking-calendar.png`, fullPage: true });
  await page.getByRole("button", { name: "Continue" }).click();

  await page.locator("#main").getByRole("link", { name: "Sign in" }).click();
  await signIn(page, CLIENT);
  await page.waitForURL(/\/book\?resume=1/);
  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  await page.getByLabel("First name").fill("Ana");
  await page.getByLabel("Last name").fill("Testclient");
  await page.getByLabel("Mobile phone").fill("281-555-0101");
  await page.locator('input[name="condition-anticoagulants"]').check();
  await page.getByLabel("Medications relevant to massage safety").fill("Blood thinner (fictional)");
  await page.getByLabel("What is bothering you today?").fill("Stiff neck from desk work");
  await page.locator('[data-area="neck"] > :first-child').click();
  await page.locator('[data-area="shoulders"] > :first-child').click();
  await expect(page.locator('input[name="area-shoulders"]')).toBeChecked();
  await expect(page.locator('input[name="area-neck"]')).toBeChecked();
  if (shots) await page.screenshot({ path: `${shots}/booking-intake.png`, fullPage: true });
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText(/a therapist will review your appointment/)).toBeVisible();
  for (const kind of ["CANCELLATION_POLICY", "GENERAL_TREATMENT"]) {
    await page.locator(`[data-consent="${kind}"] input`).fill("Ana Testclient");
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("booking-total")).toHaveText("$70");
  await page.getByRole("button", { name: "Confirm appointment" }).click();
  await expect(page.getByRole("heading", { name: "Request received" })).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/booking-done.png` });
  await ctx.close();
});

test("client can't open staff dashboards", async ({ browser }) => {
  const { ctx, page } = await newUser(browser, CLIENT, "/admin");
  await expect(page.getByRole("heading", { name: "You don't have access to this page." })).toBeVisible();
  await page.goto("/therapist");
  await expect(page.getByRole("heading", { name: "You don't have access to this page." })).toBeVisible();
  await ctx.close();
});

test("therapist reviews the flag, and the client sees the appointment confirmed", async ({ browser }) => {
  const { ctx, page } = await newUser(browser, THERAPIST, "/therapist");
  await expect(page.getByText("need your health review")).toBeVisible();
  await page.locator("[data-appointment]").first().click();
  await expect(page.getByRole("heading", { name: "Contraindication flags" })).toBeVisible();
  await expect(page.locator("section", { hasText: "Contraindication flags" }).getByText("Taking blood thinners")).toBeVisible();
  await page.getByLabel("Decision").selectOption("PROCEED_WITH_MODIFICATIONS");
  await page.getByLabel("Rationale").fill("Reviewed intake; lighter pressure on neck. (fictional)");
  if (shots) await page.screenshot({ path: `${shots}/therapist-review.png`, fullPage: true });
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByText("Review recorded.")).toBeVisible();
  await ctx.close();

  const client = await newUser(browser, CLIENT, "/account");
  await expect(client.page.locator("[data-appointment]").first()).toContainText("Confirmed");
  if (shots) await client.page.screenshot({ path: `${shots}/client-account.png`, fullPage: true });
  await client.ctx.close();
});

test("therapist checks in, completes and signs the SOAP note", async ({ browser }) => {
  // Set E2E_DATABASE_URL to the same database the local server uses (from .env.local).
  test.skip(!process.env.E2E_DATABASE_URL, "E2E_DATABASE_URL not set");
  const db = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL });
  await db.connect();
  // Move the test appointment to "now" so the session can start.
  await db.query("UPDATE appointments SET starts_at = now() - interval '30 minutes', ends_at = now() + interval '45 minutes', block_ends_at = now() + interval '60 minutes' WHERE status = 'CONFIRMED'");
  await db.end();

  const { ctx, page } = await newUser(browser, THERAPIST, "/therapist");
  await page.locator("[data-appointment]").first().click();
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("Checked in.")).toBeVisible();
  await page.getByLabel("Client-reported concerns").fill("Stiff neck from desk work");
  await page.getByLabel("Therapist observations").fill("Tension in upper trapezius");
  await page.getByLabel("Techniques used").fill("Swedish effleurage, light pressure");
  await page.getByLabel("Client tolerance").fill("Comfortable throughout");
  await page.getByLabel("Focus for future sessions").fill("Neck and shoulders");
  await expect(page.getByText(/Draft saved/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Mark completed" }).click();
  await expect(page.getByText("Session completed.")).toBeVisible();
  await page.getByLabel("Type your full name to sign").fill("Maria Test");
  await page.getByRole("button", { name: "Sign note" }).click();
  await expect(page.getByText(/Signed .* by Maria Test/)).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/soap-signed.png`, fullPage: true });
  await ctx.close();
});
