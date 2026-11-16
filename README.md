# Little Wins

A points, stars and rewards tracker for families, made for phones.

Parents record good behavior and day-by-day marks on a few weekly challenges. Children watch their points and stars grow toward rewards the family agreed on. The child's view stays positive: it never shows penalties, warnings or parents' notes.

- **Families:** each parent signs in with Google or GitHub; one installation holds one family, or many in hosted mode
- **Several children,** each with their own points, stars and history, switched with a picker
- **Co-parents** join by an invite link; the owner can remove a parent or hand over ownership
- **Children's devices** join with a one-time code or link from a parent, with no password and no account
- **Points** for behaviors, fixed or within a range, with undo
- **Weekly challenges** marked perfect, OK or bad; a good week wins a star
- **Rewards** as milestones of stars and points, with a celebration when one unlocks
- **Past weeks** to look back and fix a mark; each family sets its own time zone and week start
- **Devices** listed in Settings, each one can be logged out
- One small container, one SQLite file, no third-party scripts or trackers

> **Status: early.** Sign-in with Google and GitHub, families, children, invites and device codes are done. Hardening for the open internet (HTTPS handling, security headers, trusted proxies, rate limits on every route, container hardening) is phase 4. Until then, run Little Wins behind a reverse proxy with TLS, ideally on a private network. See [docs/build-plan.md](docs/build-plan.md).

## Try it locally

With Node.js 22.13 or newer:

```bash
npm install   # dev tools only; the app has no runtime dependencies
npm run dev
```

Open http://localhost:3000, click **Sign in with Google** and pick a test person on the fake sign-in page. Nothing leaves your machine, and the data lives in a throwaway database under `/tmp`.

Run the tests and the linter:

```bash
npm test
npm run lint
```

## Run it on a server

See [docs/admin-guide.md](docs/admin-guide.md) for Docker setup, updates, backups and troubleshooting.

## Documents

- [Design](docs/design.md): how the app behaves, including hosting for other families
- [Build plan](docs/build-plan.md): what's done and what's next
- [Admin guide](docs/admin-guide.md): running your own copy

## License

[Apache-2.0](LICENSE)
