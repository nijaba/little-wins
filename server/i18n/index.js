/**
 * Languages. The page translates itself (public/strings.<lang>.js); the server only needs:
 * which languages exist, the language a browser asks for, the text of the few pages it renders
 * itself, and the starter list in each language.
 */
const LANGUAGES = ['en', 'zh', 'es', 'fr', 'de'];

const isLanguage = (lang) => LANGUAGES.includes(lang);

/** Picks the best supported language from an Accept-Language header; English otherwise. */
function fromAcceptLanguage(header) {
  const wanted = String(header || '')
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => /^q=([\d.]+)$/.exec(p.trim())).find(Boolean);
      return { lang: tag.toLowerCase().split('-')[0], q: q ? Number(q[1]) : 1 };
    })
    .filter((w) => w.lang && w.q > 0)
    .sort((a, b) => b.q - a.q);
  return wanted.find((w) => isLanguage(w.lang))?.lang || 'en';
}

const load = (lang) => {
  try {
    return require(`./${lang}`);
  } catch {
    return {};
  }
};
const EN = load('en');
const bundles = Object.fromEntries(LANGUAGES.map((l) => [l, l === 'en' ? EN : load(l)]));

/** Server-rendered page text in a language, falling back to English key by key. */
const pages = (lang) => ({ ...EN.pages, ...(bundles[lang]?.pages || {}) });

// Points and stars of the starter list (same in every language), in the order of the names.
const STARTER_POINTS = {
  targets: [
    [5, 5],
    [5, 15],
    [10, 10],
    [10, 10],
    [5, 5],
    [5, 10],
    [5, 5],
    [5, 5],
    [5, 5],
  ],
  penalty: 50,
  rewards: [
    [2, 0],
    [3, 0],
    [2, 50],
    [4, 100],
    [6, 200],
    [12, 500],
  ],
};

/** The starter list in a language; a translation must keep the same lengths, else English. */
function starter(lang) {
  const t = bundles[lang]?.starter;
  const ok =
    t &&
    ['targets', 'penalties', 'challenges', 'rewards'].every(
      (k) => Array.isArray(t[k]) && t[k].length === EN.starter[k].length,
    );
  return ok ? t : EN.starter;
}

module.exports = { LANGUAGES, isLanguage, fromAcceptLanguage, pages, starter, STARTER_POINTS };
