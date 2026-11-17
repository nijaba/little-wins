// Family invites from the operator page (SIGNUP_MODE=invite) and the full screen (LIMIT_FAMILIES).
const { test, expect, signInAs, createFamily, startFamily } = require('./fixtures');

test.describe('invite mode', () => {
  test.use({
    serverOptions: {
      signup: 'invite',
      allowlist: '',
      env: {
        OPERATOR_ALLOWLIST: 'google:bob@example.com',
        SIGNUP_CONTACT_URL: 'mailto:places@example.test',
      },
    },
  });

  test('E2E-100 the operator invites a family, and the invited parent opens the link and sets it up', async ({
    page,
    newPlayer,
  }) => {
    await signInAs(page, 'Bob');
    await expect(page.getByRole('heading', { name: 'Operator' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Family invites' })).toBeVisible();
    await page.getByRole('button', { name: 'Invite a family' }).click();
    await expect(page.getByText('Expires in 30 days')).toBeVisible();
    const link = await page.locator('input.link').inputValue();
    expect(link).toMatch(/#signup=[\w-]{32}$/);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(1);

    const other = await newPlayer();
    await other.goto(link);
    await expect(
      other.getByRole('heading', { name: "You're invited to start a family" }),
    ).toBeVisible();
    await other.getByRole('link', { name: 'Sign in with Google' }).click();
    await other.getByRole('link', { name: /^Alice Example/ }).click();
    await createFamily(other, { family: 'The Invited' });

    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  });

  test('E2E-101 without an invite, a new parent sees the private screen with Ask for a place', async ({
    page,
  }) => {
    await page.goto('/#signup=not-a-real-invite-token-at-all-xx');
    await expect(page.getByText("This invite link doesn't work")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ask for a place' })).toHaveAttribute(
      'href',
      'mailto:places@example.test',
    );
  });
});

test.describe('a full installation', () => {
  test.use({
    serverOptions: { env: { LIMIT_FAMILIES: '1', SIGNUP_CONTACT_URL: 'https://example.test/ask' } },
  });

  test('E2E-102 once the cap is reached, a new parent sees the full screen', async ({
    page,
    newPlayer,
  }) => {
    await startFamily(page);
    const other = await newPlayer();
    await signInAs(other, 'Bob');
    await expect(other.getByText('This Little Wins is full for now')).toBeVisible();
    await expect(other.getByRole('link', { name: 'Ask for a place' })).toHaveAttribute(
      'href',
      'https://example.test/ask',
    );
    await expect(other.getByRole('heading', { name: 'Set up your family' })).toHaveCount(0);
  });
});
