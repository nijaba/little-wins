# Security policy

## Supported versions

Only the latest release and the `main` branch get security fixes.

## Reporting a vulnerability

Please report it privately. Do not open a public issue.

1. Go to the [private vulnerability report form](https://github.com/nijaba/little-wins/security/advisories/new). You can also reach it from the Security tab, then "Report a vulnerability".
2. Describe the problem.

Please include:

- What you found and where (route, screen or file).
- Steps to reproduce it, or a short proof of concept.
- What an attacker could do with it.
- The version or commit, and whether you ran it self-hosted or hosted.

Do not include real family data. Use the demo families or made-up data.

## What to expect

Little Wins is a one-person project, so these are goals, not guarantees.

- I will acknowledge your report within a few days.
- I will tell you whether I can reproduce it and how I plan to fix it.
- I will fix it, publish a GitHub security advisory and release a fix.
- I will credit you in the advisory if you want, and keep your name out if you prefer.

Please give me a reasonable time to fix the problem before you share it.

## Scope

In scope:

- The application code in this repository.
- The container image and its default configuration.
- The deploy examples in `deploy/`.

Out of scope:

- The configuration of one operator's own deployment (their proxy, firewall, secrets or hosting).
- Social engineering of users or maintainers.
- Denial of service by sheer volume of requests.
- Findings that need a modified or outdated copy of the app.

## How the app protects itself

In short: the app refuses to start with weak secrets or without HTTPS, sets strict security headers and a Content Security Policy with no inline scripts, requires JSON writes from its own origin, escapes every user-entered string, stores only SHA-256 hashes of session tokens, keeps every family's data apart, and runs in a non-root, read-only container. Dependabot, CodeQL, gitleaks and an image scan run in CI.

The details are in [docs/design.md](docs/design.md#security).
