import { expect, test } from "@playwright/test";
import { noHorizontalScroll } from "./helpers";

const pages = ["/", "/about", "/services", "/services/swedish", "/services/deep-tissue", "/services/sports", "/services/aromatherapy", "/services/prenatal", "/enhancements", "/contact", "/book", "/login", "/register", "/privacy", "/terms"];

for (const path of pages) {
  test(`public page ${path} renders cleanly`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await noHorizontalScroll(page);
    expect(errors).toEqual([]);
  });
}

test("home page has the required hero, buttons and sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("RESTORA");
  await expect(page.getByText("Restore Your Body. Renew Your Balance.").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "BOOK YOUR MASSAGE" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "EXPLORE SERVICES" }).first()).toBeVisible();
  await expect(page.getByText("Why choose RESTORA?")).toBeVisible();
  await expect(page.getByText("Add something extra")).toBeVisible();
  await expect(page.getByText(/We use hypoallergenic massage lotion/).first()).toBeVisible();
});

test("language toggle switches to professional Spanish and back", async ({ page }) => {
  await page.goto("/services/prenatal");
  await page.getByRole("button", { name: "Ver este sitio en español" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Masaje prenatal");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Masaje prenatal");
  await page.getByRole("button", { name: "View this site in English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prenatal Massage");
});

test("no page offers hot stone or medical massage", async ({ page }) => {
  for (const path of ["/", "/services", "/enhancements", "/book"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const text = (await page.locator("main").innerText()).toLowerCase();
    const n = (text.match(/hot stone|medical massage/g) ?? []).length;
    expect(n, path).toBeLessThanOrEqual(path === "/services" ? 2 : 0);
  }
});

test("service detail shows contraindications grouped by review category", async ({ page }) => {
  await page.goto("/services/deep-tissue");
  await expect(page.getByRole("heading", { name: "Contraindications & precautions" })).toBeVisible();
  await expect(page.getByText("We may need to postpone or refer you for evaluation")).toBeVisible();
  await expect(page.getByText("We may ask for additional assessment or medical clearance")).toBeVisible();
  await expect(page.getByText("Your therapist may adjust the treatment")).toBeVisible();
});

test("protected pages ask visitors to sign in", async ({ page }) => {
  for (const path of ["/account", "/therapist", "/admin"]) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: "Sign in with Microsoft" })).toBeVisible();
  }
});

test("missing files and API routes return 404 instead of the app", async ({ request }) => {
  expect((await request.get("/images/missing.png")).status()).toBe(404);
  expect((await request.get("/api/does-not-exist")).status()).toBe(404);
});

test("contact form validates and stores a message", async ({ page }) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Please check the highlighted fields.").first()).toBeVisible();
  await page.getByLabel("Your name").fill("Taylor Visitor");
  await page.getByLabel("Email").fill("taylor@example.test");
  await page.getByLabel("Message").fill("Do you offer gift cards for the holidays?");
  await page.getByLabel("You can contact me about my question.").check();
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Thank you. We received your message")).toBeVisible();
});
