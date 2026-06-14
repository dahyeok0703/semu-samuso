import { expect, test } from "@playwright/test";

/**
 * Headline happy-path: 가입 → 온보딩 → 거래처 추가 → 신고 일정 생성 → 대시보드.
 *
 * Requires a TEST Supabase project with email confirmation DISABLED (otherwise
 * signup shows a "확인 이메일" screen instead of a session — the test then
 * skips). Document-classification + reminder sending depend on optional keys
 * (ANTHROPIC_API_KEY / SMTP), so this flow asserts the deterministic core and
 * leaves AI/messaging to the unit + integration suites.
 */

const password = "Test1234!a";

test("signup → onboarding → client → schedule → dashboard", async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`;

  // 1) Sign up.
  await page.goto("/signup");
  await page.getByLabel("사무소 이름").fill("플레이라이트 세무회계");
  await page.getByLabel("이름", { exact: true }).fill("테스트 대표");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByLabel("비밀번호 확인").fill(password);
  await page.getByRole("button", { name: "회원가입" }).click();

  // Confirmations must be off for an immediate session; otherwise skip.
  await Promise.race([
    page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 15_000 }).catch(() => undefined),
    page
      .getByText(/확인 이메일|메일을 확인/)
      .waitFor({ timeout: 15_000 })
      .catch(() => undefined),
  ]);
  if (!/\/(onboarding|dashboard)/.test(page.url())) {
    test.skip(true, "Supabase email confirmation is ON — disable it for the e2e test project");
  }

  // 2) Onboarding — step 1: office info (prefilled) → 다음.
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("button", { name: "다음" }).click();

  // 3) Step 2: add a client.
  await page.getByLabel("상호").fill("가나다상사");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText("가나다상사")).toBeVisible();
  await page.getByRole("button", { name: "다음" }).click();

  // 4) Step 3: generate this year's filing schedule.
  await page.getByRole("button", { name: /일정 생성/ }).click();

  // 5) Step 4: finish → dashboard.
  await page.getByRole("button", { name: /대시보드로 이동/ }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // 6) The created client is listed.
  await page.goto("/clients");
  await expect(page.getByText("가나다상사")).toBeVisible();
});
