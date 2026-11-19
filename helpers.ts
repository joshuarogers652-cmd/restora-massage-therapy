import { expect, type Browser, type Page } from "@playwright/test";

/** Signs in through the local development sign-in page (stands in for Microsoft sign-in). */
export async function signIn(page: Page, email: string) {
  await expect(page).toHaveURL(/\/\.auth\/login\//);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function newUser(browser: Browser, email: string, path = "/") {
  const ctx = await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto(`/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(path)}`);
  await signIn(page, email);
  await page.waitForURL((u) => !u.pathname.startsWith("/.auth"));
  return { ctx, page };
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
