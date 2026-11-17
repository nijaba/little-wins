// Languages in the browser: the page follows the browser's language until the family has one,
// every screen is translated, the language can be changed, and translations fit phone screens.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  test,
  expect,
  goTab,
  openFold,
  fold,
  FOLDS,
  SIZES,
  checkFits,
  eachSize,
} = require('./fixtures');

const OTHERS = ['zh', 'es', 'fr', 'de'];
const LOCALES = { en: 'en', zh: 'zh-CN', es: 'es', fr: 'fr', de: 'de' };
const OWN_NAME = {
  en: 'English',
  zh: '中文（简体）',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

/** public/strings.<lang>.js as the page loads it (functions included). */
function strings(lang) {
  const sandbox = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '..', 'public', `strings.${lang}.js`), 'utf8'),
    sandbox,
  );
  return sandbox.window.LW_STRINGS[lang];
}
const EN = strings('en');

/** Distinctive English strings that must not show once the page is in another language. */
function englishLeft(lang) {
  const T = strings(lang);
  const out = new Set(['Today', 'Settings', 'Earn points', 'Weekly challenges', 'Sign out']);
  const walk = (en, tr) => {
    if (typeof en === 'string' && en.length >= 8 && typeof tr === 'string' && tr !== en)
      out.add(en);
    else if (en && typeof en === 'object') for (const k of Object.keys(en)) walk(en[k], tr?.[k]);
  };
  walk(EN, T);
  // Strings that are legitimately the same in the language are not "left over".
  const same = new Set();
  const collect = (o) => {
    if (typeof o === 'string') same.add(o);
    else if (o && typeof o === 'object') Object.values(o).forEach(collect);
  };
  collect(T);
  return [...out].filter((s) => !same.has(s));
}

/** The whole visible text, without a language's own legitimate words. */
// biome-ignore lint/performance/useDomNodeTextContent: the visible text is what matters here
const bodyText = (page) => page.locator('body').innerText();

async function expectTranslated(page, lang, label) {
  const text = await bodyText(page);
  for (const bad of ['undefined', 'NaN', '[object']) {
    expect(text, `${label}: "${bad}" in the page`).not.toContain(bad);
  }
  // The language's own radio labels are always shown, and they are names, not English text.
  const left = englishLeft(lang).filter((s) => {
    // "Language" style words can be the same in a translation; only judge whole strings.
    return new RegExp(
      `(^|[^\\p{L}])${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`,
      'u',
    ).test(text);
  });
  expect(left, `${label}: English text left in ${lang}`).toEqual([]);
}

/** Signs in as Alice through the fake provider, with the sign-in link in `lang`. */
async function signInIn(page, lang) {
  await page.goto('/');
  await page.getByRole('link', { name: strings(lang).login.signInWith.google }).click();
  await page.getByRole('link', { name: /^Alice Example/ }).click();
  await expect(page.locator('main h2, .tabs').first()).toBeVisible();
}

/** Sets a family up with the language picked in the setup screen. Lands on Today. */
async function setUpIn(page, lang, { family = 'The Testers', child = 'Kid', browser = 'en' } = {}) {
  const st = strings(lang).setup;
  await signInIn(page, browser);
  await page.getByLabel(OWN_NAME[lang], { exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('lang', LOCALES[lang]);
  await expect(page.getByRole('heading', { name: st.title })).toBeVisible();
  await page.getByLabel(st.familyName).fill(family);
  await page.getByLabel(st.childName).fill(child);
  await page.getByRole('button', { name: st.create }).click();
  await expect(page.locator('header b')).toBeVisible();
}

const tabName = (lang, key) => strings(lang).tabs[key][1];
const goTabIn = (page, lang, key) => goTab(page, tabName(lang, key));

test.describe('browser in German', () => {
  test.use({ locale: 'de-DE' });

  test('E2E-80 the sign-in screen follows the browser language (German)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Mit Google anmelden' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expectTranslated(page, 'de', 'sign-in');
  });
});

test.describe('browser in Chinese', () => {
  test.use({ locale: 'zh-CN' });

  test('E2E-80 the sign-in screen follows the browser language (Chinese)', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('link', { name: strings('zh').login.signInWith.google }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expectTranslated(page, 'zh', 'sign-in');
  });
});

test.describe('browser in a language the app does not have', () => {
  test.use({ locale: 'ja-JP' });

  test('E2E-80 an unsupported browser language shows English', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

for (const lang of OTHERS) {
  test(`E2E-81 ${lang}: setup in the language, then every screen and Settings section is translated`, async ({
    page,
  }) => {
    const T = strings(lang);
    await setUpIn(page, lang);

    // The starter list is in the language.
    await expect(page.locator('body')).toContainText(T.today.earn);
    await expect(page.locator('body')).toContainText(
      require('../server/i18n').starter(lang).targets[2][0],
    );
    await expect(page.locator('html')).toHaveAttribute('lang', LOCALES[lang]);
    await expectTranslated(page, lang, 'Today');

    // Record something so Today (toast), Week and History have content.
    await page.getByRole('button', { name: '+', exact: true }).first().click();
    await expect(page.getByRole('button', { name: T.undo })).toBeVisible();
    await expectTranslated(page, lang, 'Today with a toast');

    for (const key of ['week', 'rew', 'hist']) {
      await goTabIn(page, lang, key);
      await expectTranslated(page, lang, key);
    }
    await expect(page.locator('main')).toContainText(
      require('../server/i18n').starter(lang).targets[0][0],
    );

    await goTabIn(page, lang, 'set');
    await expectTranslated(page, lang, 'Settings (folded)');
    for (const key of FOLDS) {
      await openFold(page, key);
      await expectTranslated(page, lang, `Settings: ${key}`);
    }
    // Family section: the language is the family's.
    await expect(page.getByLabel(OWN_NAME[lang], { exact: true })).toBeChecked();
  });
}

test('E2E-82 changing the language in Settings re-renders and persists after a reload', async ({
  page,
}) => {
  await setUpIn(page, 'en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await goTab(page, 'Settings');
  const fam = await openFold(page, 'fam');
  await expect(fam.getByLabel('English', { exact: true })).toBeChecked();
  await fam.getByLabel('Deutsch', { exact: true }).check();
  await fam.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('.tabs')).toContainText('Heute');
  await expect(page.locator('.tabs')).not.toContainText('Today');
  await expectTranslated(page, 'de', 'after changing the language');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('.tabs')).toContainText('Heute');
  await goTabIn(page, 'de', 'set');
  const again = await openFold(page, 'fam');
  await expect(again.getByLabel('Deutsch', { exact: true })).toBeChecked();
  await expectTranslated(page, 'de', 'after a reload');

  // And back to English (the radio labels are each language's own name).
  await again.getByLabel('English', { exact: true }).check();
  await again.getByRole('button', { name: strings('de').settings.save }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.tabs')).toContainText('Today');
});

test('E2E-83 the family language wins over the browser language on another device', async ({
  page,
  newPlayer,
}) => {
  await setUpIn(page, 'fr');
  const other = await newPlayer(); // an English browser, signed in as the same parent
  await signInIn(other, 'en');
  await expect(other.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(other.locator('.tabs')).toContainText(tabName('fr', 'today'));
});

// Phone-size layout with the longest translations, German and Chinese.
const LONG = {
  family: 'The Montgomery-Featherstonehaugh Family',
  child: 'Maximiliana Wolfeschlegel',
};
for (const lang of ['de', 'zh']) {
  test.describe(`layout in ${lang}`, () => {
    test.use({ locale: lang === 'de' ? 'de-DE' : 'zh-CN' });

    test(`E2E-84 ${lang}: the sign-in and setup screens fit phone screens`, async ({ page }) => {
      await page.goto('/');
      await expect(
        page.getByRole('link', { name: strings(lang).login.signInWith.google }),
      ).toBeVisible();
      await eachSize(page, `${lang} sign-in`, (l) => checkFits(page, l));
      await signInIn(page, lang);
      await expect(page.getByRole('heading', { name: strings(lang).setup.title })).toBeVisible();
      await eachSize(page, `${lang} setup`, (l) => checkFits(page, l));
    });

    // The narrowest and the widest phone: the other sizes lie between them.
    for (const size of [SIZES[0], SIZES[3]]) {
      test(`E2E-85 ${lang}: every main screen and Settings section fits ${size.width}x${size.height}`, async ({
        page,
      }) => {
        await page.setViewportSize(size);
        const check = (name) => checkFits(page, `${lang} ${name} @${size.width}x${size.height}`);
        await setUpIn(page, lang, { ...LONG, browser: lang });
        await check('Today');
        for (const key of ['week', 'rew', 'hist']) {
          await goTabIn(page, lang, key);
          await check(key);
        }
        await goTabIn(page, lang, 'set');
        await check('Settings (folded)');
        for (const key of FOLDS) {
          const f = await openFold(page, key);
          await check(`Settings: ${key}`);
          await f.locator('summary').click();
          await expect(fold(page, key)).not.toHaveAttribute('open', '');
        }
        for (const key of FOLDS) await openFold(page, key);
        await check('Settings (all open)');
      });
    }
  });
}
