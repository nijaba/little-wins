# Little Wins

A points, stars and rewards tracker for families, made for phones.

Parents record good behavior and day-by-day marks on a few weekly challenges. Children watch their points and stars grow toward rewards the family agreed on. The child's view stays positive: it never shows penalties, warnings or parents' notes.

- **Points** for behaviors, fixed or within a range, with undo
- **Weekly challenges** marked perfect, OK or bad; a good week wins a star
- **Rewards** as milestones of stars and points, with a celebration when one unlocks
- **Past weeks** to look back and fix a mark
- **Devices** listed in Settings, each one can be logged out
- One small container, one SQLite file, no third-party scripts or trackers

> **Status: early.** Login is still PIN-based, so keep Little Wins on a private network for now. Google/GitHub sign-in, device pairing for children, several children and hosting for many families are planned: see [docs/build-plan.md](docs/build-plan.md).

## Try it locally

With Node.js 22 or newer:

```bash
ALLOW_DEFAULTS=1 DB=/tmp/little-wins.db node server.js
```

Open http://localhost:3000. The parent PIN is `1234` and the child PIN is `0000`. These test PINs work only with `ALLOW_DEFAULTS=1`.

Run the tests:

```bash
node --test
```

## Run it on a server

See [docs/admin-guide.md](docs/admin-guide.md) for Docker setup, updates, backups and troubleshooting.

## Documents

- [Design](docs/design.md): how the app behaves, including hosting for other families
- [Build plan](docs/build-plan.md): what's done and what's next
- [Admin guide](docs/admin-guide.md): running your own copy

## License

[Apache-2.0](LICENSE)
