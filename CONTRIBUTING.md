# Contributing

Thanks for helping. Little Wins is a small project run by one person, so please keep changes small and focused.

## Set up

You need Node.js 22.13 or newer. There is no build step and no runtime dependency.

```bash
npm install     # dev tools only (Biome, Playwright, c8)
npm run dev     # local server on http://localhost:3000, fake sign-in, demo families
```

Other commands are listed in [CLAUDE.md](CLAUDE.md). The ones you need before a pull request:

```bash
npm run lint
npm test                       # SKIP_IMAGE_TESTS=1 npm test if you have no Docker
npm run e2e:install && npm run test:e2e   # after any change to the page
```

## Design first

[docs/design.md](docs/design.md) is the source of truth for how the app behaves. Read the part you are changing.

If you want to change behavior, open an issue first and talk it through. If the design is silent or wrong, we settle it there and update the design in the same pull request.

## Firm constraints

These are decided by the owner. Please ask before proposing to change one.

- Node.js 22+ with the built-in `node:sqlite`. No external database, cache or queue.
- One container, one process, one SQLite file on a mounted volume.
- HTTPS only when deployed. `localhost` is the one exception.
- No analytics, trackers, third-party scripts or third-party fonts.
- The same code serves self-hosted and hosted modes. Only configuration differs.
- Avoid runtime dependencies. A new one needs a reason written in `docs/design.md`.
- New dev dependencies and GitHub Actions are pinned to releases at least 14 days old.

## Rules that must always hold

A change that breaks one of these will not be merged.

- The child's view never shows penalties, warnings, notes, Settings or another child's data.
- The balance never goes below 0. Entries apply in time order, each clamped at 0.
- Stars are recomputed from marks. A week wins a star with at least 2 perfect days and no bad day.
- Every user-entered string is escaped before it reaches the page.
- Session tokens are random and stored only as SHA-256 hashes.
- The app refuses to start with placeholder or weak secrets.
- The family comes from the session, never from the request. All SQL lives in `server/repo.js`. Every function there takes the family ID first and filters on it. A new route needs a cross-family test.
- A child's device sees only its own child. Parents are matched on (provider, stable subject), never on email or display name.
- Writes are POST with a JSON body from the app's own origin.
- The fake sign-in provider only runs on localhost.
- The page runs under a strict Content Security Policy. No inline scripts, styles or event handlers. Use `data-action` attributes and the delegated listeners in `app.js`. Set dynamic sizes through the DOM, not `style=` attributes.

## Tests

Every change comes with tests. Each test name starts with an ID from [docs/test-plan.md](docs/test-plan.md). Add a row to the plan for a new case. `test/test-plan.test.js` checks that the plan and the test names agree.

Tests use a real server on a temporary database. Never test against real data.

## Strings and languages

Page strings live in `public/strings.en.js` (English is the base). Add the same keys to `strings.zh.js`, `strings.es.js`, `strings.fr.js` and `strings.de.js`. Server messages are in `server/messages.js` and `server/i18n/`. Translation fixes and new translations are welcome.

## No personal data

Do not put real names, emails, hostnames, accounts or family details in code, docs, tests, screenshots or commit messages. Use made-up data. Personal notes go in `*.local.md` files, which git ignores.

## Pull requests

- Branch from `main` and open the pull request against `main`.
- Fill in the template.
- The "CI passed" check must be green. Browser tests run in CI only when the page, the server, the browser tests, the packages or the CI workflow changed (see `e2e/README.md`). `main` is protected: changes arrive only through a pull request, with no force-push.
- Signed commits are not required by the repository ruleset.
- Keep the build plan and docs up to date when your change affects them.

## License

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).

## Security problems

Do not report them in an issue. See [SECURITY.md](SECURITY.md).
