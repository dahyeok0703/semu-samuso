import { expect, test } from "@playwright/test";

/**
 * Public surface smoke tests — runnable with just the app + Supabase env (no
 * test data required). Verifies the marketing/legal pages render and that
 * protected app routes redirect unauthenticated users to /login.
 */

test.describe("public marketing site", () => {
  test("landing renders the value proposition + primary CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // CTA to start the trial.
    await expect(page.getByRole("link", { name: /무료로 시작/ }).first()).toBeVisible();
  });

  test("marketing pages are reachable", async ({ page }) => {
    for (const path of ["/features", "/pricing", "/faq"]) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} should be 200`).toBe(200);
    }
  });

  test("legal pages render with the review warning", async ({ page }) => {
    for (const path of ["/legal/terms", "/legal/privacy", "/legal/refund", "/legal/third-party"]) {
      await page.goto(path);
      await expect(page.getByText(/검토 필요 안내/)).toBeVisible();
    }
  });

  test("SEO assets are served", async ({ request }) => {
    expect((await request.get("/robots.txt")).status()).toBe(200);
    expect((await request.get("/sitemap.xml")).status()).toBe(200);
  });

  test("security headers are present", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();
    expect(headers["content-security-policy"]).toBeTruthy();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });
});

test.describe("route protection", () => {
  test("protected app routes redirect to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
