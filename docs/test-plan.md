# Little Wins test plan

Every behavior in the [design](design.md) has at least one case here, grouped by area and run at the cheapest level that proves it. Every case has an ID; test names start with it, so `node --test --test-name-pattern=PT-03 test/*.test.js` runs one case. One test may carry several IDs.

## Approach

| Level | Covers | Tool |
| --- | --- | --- |
| Unit | Pure rules with no network (`server/scoring.js`, configuration) | `node --test` |
| API | The real server on a temporary database, signed in through the fake provider | `node --test` |
| E2E | Whole flows in real browsers at phone sizes | Playwright (Chromium and WebKit) |
| Image | The built Docker image, run hardened | `node --test`, needs Docker |
| Manual | What automation cannot judge: real sign-in providers, the home-screen icon | Checklist, before each release |

Run `npm test` for Unit, API and Image (Image is skipped without Docker or with `SKIP_IMAGE_TESTS=1`), `npm run test:e2e` for E2E, and `npm run test:coverage` for a coverage report with thresholds on `server/`. `test/test-plan.test.js` checks that every Unit, API and Image ID below appears in a test name, and that every ID used in a test name is in this plan.

## Test data and environments

| Item | What it is | Used by |
| --- | --- | --- |
| Temporary database | A new SQLite file per test server, removed afterwards | Unit, API, E2E |
| Fake sign-in provider | Local stand-in for Google and GitHub, only on localhost | API, E2E |
| Test server | `node server/index.js` as a child process on a free port | API, E2E |
| Hardened container | The image run with a read-only root, no capabilities, `/data` as a tmpfs | Image |
| Real accounts | One Google and one GitHub test account | Manual |
| Devices | A recent iPhone and Android phone | Manual |

## SC: Scoring rules

Pure rules in `server/scoring.js`: dates, weeks, balance, stars, history.

| ID | Expectation | Level |
| --- | --- | --- |
| SC-01 | Shift moves across months, years and leap days | Unit |
| SC-02 | ValidDay accepts real dates only | Unit |
| SC-03 | Monday finds the start of the week for every weekday | Unit |
| SC-04 | Monday works across a year boundary | Unit |
| SC-05 | Balance clamps at 0 in time order | Unit |
| SC-06 | LatestMarks keeps the last mark per item and day | Unit |
| SC-07 | WeekTotals counts perfect and bad days per item and week | Unit |
| SC-08 | Stars: 2 perfect days and no bad day win a star | Unit |
| SC-09 | Stars: weeks and items count separately | Unit |
| SC-10 | TodayStatus counts warnings and reads marks for today only | Unit |
| SC-11 | WeekRange: default, future and early weeks clamp | Unit |
| SC-12 | WeekRange: with no entries you can still go back one week | Unit |
| SC-13 | WeekRange: a recent first entry still allows one week back; invalid first day is ignored | Unit |
| SC-14 | WeekMarks lists seven days and each challenge's marks | Unit |
| SC-15 | History: parents see everything, the child only positive points without notes | Unit |
| SC-16 | History keeps the last 60 entries | Unit |
| SC-17 | StartOfWeek with a Sunday start finds the Sunday for every weekday | Unit |
| SC-18 | StartOfWeek defaults to Monday and agrees with monday() | Unit |
| SC-19 | DayLabels start with the first day of the week | Unit |
| SC-20 | Stars: a Sunday-start week groups Sunday with the days after it | Unit |
| SC-21 | WeekRange with a Sunday start begins on Sunday and clamps like Monday weeks | Unit |
| SC-22 | Review sums one week and the weeks before it, and counts what was done most often | Unit |
| SC-23 | Milestones: a streak of perfect days up to today or yesterday, and a best week | Unit |

## PT: Points, penalties and warnings

Recording and undoing entries.

| ID | Expectation | Level |
| --- | --- | --- |
| PT-01 | Points: fixed ignores the amount, ranged is clamped, the penalty floors at 0, undo restores | API |
| PT-02 | A penalty on an empty balance costs nothing later | API |
| PT-03 | Notes are kept for parents and trimmed, and the child never sees them | API |
| PT-04 | The child sees positive history only, no penalties and no warnings | API |
| PT-05 | Warnings count per target per day; challenges cannot get points or warnings | API |
| PT-06 | Adding without a child or with an unknown item answers 404 | API |
| PT-07 | A parent adds, changes and clears a note on points or a warning, never on a mark; the child never sees it | API |

## WK: Weekly challenges and stars

Marks, bad days, star rule and past weeks.

| ID | Expectation | Level |
| --- | --- | --- |
| WK-01 | Weekly challenges: marks replace each other, bad days and the star rule | API |
| WK-02 | Past weeks: browse, clamp, and fix marks on past days | API |

## ST: Settings

Items, rewards, family name, time zone and week start.

| ID | Expectation | Level |
| --- | --- | --- |
| ST-01 | Settings: add, edit, reorder and remove items and rewards | API |
| ST-02 | A removed item keeps its name in the history | API |
| ST-03 | The family name, time zone and week start are parent settings | API |

## SI: Sign-in and sessions

Allowlist, OAuth state, sign-up modes, session handling.

| ID | Expectation | Level |
| --- | --- | --- |
| SI-01 | Without a session the API answers 401, and forged session cookies do too | API |
| SI-02 | Session tokens are stored hashed, not as-is | API |
| SI-03 | Logging out ends only that session | API |
| SI-04 | A Google email on the allowlist may sign in and set up a family | API |
| SI-05 | A GitHub login on the allowlist matches without regard to case | API |
| SI-06 | An email is compared in lower case | API |
| SI-07 | A Google Workspace domain matches on the hd claim only | API |
| SI-08 | A parent who is not on the list gets the private-instance page and no session | API |
| SI-09 | The allowlist never matches on the display name | API |
| SI-10 | An entry for one provider does not admit the other | API |
| SI-11 | A callback without the state cookie is a 400 page | API |
| SI-12 | A tampered state cookie is refused | API |
| SI-13 | A state parameter that does not match the cookie is refused | API |
| SI-14 | A state cookie older than ten minutes is refused, a fresh one is accepted | API |
| SI-15 | A state cookie made for one provider cannot finish a sign-in at the other | API |
| SI-16 | The callback clears the state cookie after use | API |
| SI-17 | An unverified Google email is refused | API |
| SI-18 | Unknown providers are 404 | API |
| SI-19 | The login page escapes nothing it was not given and refuses a forged token | API |
| SI-20 | Closed with an empty allowlist admits nobody | API |
| SI-21 | Open sign-up lets anyone create a family, and a returning parent lands in theirs | API |
| SI-22 | Invite mode is closed to family creation without the allowlist | API |
| SI-23 | Changing display name or email does not change who a parent is | API |
| SI-24 | The same person on two providers is two accounts | API |
| SI-25 | The 11th sign-in start within a minute is a 429 page | API |
| SI-26 | The 11th checked sign-in callback within a minute is a 429 page | API |
| SI-27 | A session unused for over a year is ended when it is next used | API |

## SU: Family setup

First-run setup for a signed-in parent.

| ID | Expectation | Level |
| --- | --- | --- |
| SU-01 | A new family with the starter list starts empty-handed | API |
| SU-02 | A signed-in parent without a family sees the setup state | API |
| SU-03 | Setup needs a family name, a child name and a known time zone | API |
| SU-04 | Setup with the starter list creates it, and the first child | API |
| SU-05 | Starter: false creates an empty family | API |
| SU-06 | Names are trimmed and capped, and week_start 0 means Sunday | API |
| SU-07 | A parent can only set up once | API |
| SU-08 | A session still setting up can only do setup, state and logout | API |
| SU-09 | Setup and state need a session | API |
| SU-10 | A child device cannot run setup | API |

## FA: Family, owner and invites

Invites, co-parents, ownership.

| ID | Expectation | Level |
| --- | --- | --- |
| FA-01 | An invite link names the family and is stored hashed | API |
| FA-02 | Unknown, short or missing invite tokens are 404 | API |
| FA-03 | A parent joins through sign-in carrying the invite, even if not on the allowlist | API |
| FA-04 | An invite works once | API |
| FA-05 | An expired invite does not work | API |
| FA-06 | A revoked invite does not work, and revoking twice is a 404 | API |
| FA-07 | A parent who already has a family is not moved by an invite | API |
| FA-08 | A child device cannot create or revoke invites | API |
| FA-09 | Uses the family on its next request instead of staying in setup | API |
| FA-10 | Only the owner can remove a parent or transfer ownership | API |
| FA-11 | The owner cannot remove or hand ownership to themselves | API |
| FA-12 | After a transfer the old owner is a parent and the new owner can remove them | API |
| FA-13 | A removed parent's sessions stop working at once and they cannot get back in | API |
| FA-14 | A parent session whose membership is gone stops working, even if the session row is left behind | API |
| FA-15 | A removed parent can later set up a family of their own | API |

## CH: Children

Several children per family and what a child device sees.

| ID | Expectation | Level |
| --- | --- | --- |
| CH-01 | A parent adds a child, who is selected in the reply | API |
| CH-02 | The child query parameter picks the child, and the first is the default | API |
| CH-03 | Points, warnings, marks and stars are kept per child | API |
| CH-04 | One child's entry can be undone without touching the other | API |
| CH-05 | A child device always sees only its own child, even asking for a sibling | API |
| CH-06 | A parent renames a child; an unknown child is a 404 | API |
| CH-07 | Deleting a child removes their history, devices and codes, and not the others | API |
| CH-08 | The last child cannot be deleted | API |
| CH-09 | A child device cannot add, rename or delete children | API |

## PA: Pairing and devices

Pairing codes, child devices, device log-out.

| ID | Expectation | Level |
| --- | --- | --- |
| PA-01 | Devices: listed for parents only, and can be logged out | API |
| PA-02 | A pairing code looks like XXXX-XXXX-XX, comes with a link and lasts about ten minutes | API |
| PA-03 | A code pairs a device once, to the right child, and the device gets a session | API |
| PA-04 | Case, dashes and spaces in a typed code do not matter, and the link form works | API |
| PA-05 | Wrong, short, empty and non-text codes are refused | API |
| PA-06 | An expired code is refused | API |
| PA-07 | A code for a child who was deleted is refused | API |
| PA-08 | A parent cannot make a code for a child outside the family or one that does not exist | API |
| PA-09 | A device's label comes from its user agent | API |
| PA-10 | A child session cannot write anything: every parent route is 403 | API |
| PA-11 | A parent can log a child device out, and it takes effect at once | API |
| PA-12 | The 11th attempt within a minute is a 429 with Retry-After, even for a good code | API |
| PA-13 | The invite lookup is rate limited the same way | API |

## TZ: Time zones and week start

Each family has its own today.

| ID | Expectation | Level |
| --- | --- | --- |
| TZ-01 | Each family's today follows its own time zone | API |
| TZ-02 | Changing the time zone changes today | API |
| TZ-03 | A week that starts on Sunday has Sunday first and labels starting with S | API |
| TZ-04 | The week start can be changed in Settings and previous weeks follow it | API |
| TZ-05 | Marks on a day that is still in the future in the family time zone are refused | API |
| TZ-06 | New entries are dated in the family time zone | API |

## IS: Family isolation

No route reaches another family.

| ID | Expectation | Level |
| --- | --- | --- |
| IS-01 | Every parent route, called by another family, cannot touch family A (one case per route) | API |
| IS-02 | Every case in this file is for a route that still exists | API |
| IS-03 | Family B never sees any of A's names, whatever it asks for | API |
| IS-04 | A child device of B asking for A's child still sees only its own child | API |
| IS-05 | Family A's data and its names survive all of the attacks | API |
| IS-06 | B's own changes through those routes landed in B only | API |
| IS-07 | A parent of A is a parent of A only: A2 cannot reach B either | API |
| IS-08 | B's owner deleting with their own family name deletes B only, never A | API |
| IS-09 | A child device of B can't pick an emoji for A's items or rewards | API |

## ED: Edge: headers, proxies, HTTPS, rate limits

What a reverse proxy, a browser or an attacker sees.

| ID | Expectation | Level |
| --- | --- | --- |
| ED-01 | The page and every file in public/ are served with nosniff | API |
| ED-02 | The page carries a strict content security policy | API |
| ED-03 | A query string still serves the page and paths outside public/ are 404 | API |
| ED-04 | Request bodies over 10 KB are refused with 413 and the server carries on | API |
| ED-05 | Bad JSON and unknown routes do not crash the server | API |
| ED-06 | Writes must be JSON from this site: type, Origin and Sec-Fetch-Site are checked | API |
| ED-07 | A write route answers 404 to GET and 405 to other methods | API |
| ED-08 | Every kind of response on localhost carries the security headers and no HSTS | API |
| ED-09 | Outside localhost every response carries the headers plus HSTS, redirects included | API |
| ED-10 | X-Forwarded-For from an untrusted peer is ignored: one budget for the peer | API |
| ED-11 | From a trusted proxy each forwarded client has its own budget, using the LAST entry | API |
| ED-12 | The forwarded address also governs sign-in attempts | API |
| ED-13 | The 601st API read within a minute is refused with Retry-After | API |
| ED-14 | The 121st API write within a minute is refused with Retry-After | API |
| ED-15 | API budgets are per client behind a trusted proxy | API |
| ED-16 | /api/config reports the privacy and terms links, null by default | API |
| ED-17 | Outside localhost, plain http is redirected to APP_BASE_URL and only /healthz answers | API |
| ED-18 | X-Forwarded-Proto: https from an untrusted peer does not lift the redirect | API |
| ED-19 | Behind a trusted proxy that forwards https, the API answers normally | API |

## LM: Limits

Per-family caps and their configuration.

| ID | Expectation | Level |
| --- | --- | --- |
| LM-01 | Children: the next add is 409, renaming still works, deleting frees a place | API |
| LM-02 | Items: the next add is 409, editing, moving and deleting still work | API |
| LM-03 | Rewards: the next add is 409, editing still works | API |
| LM-04 | Parents: a full family cannot be joined by invite, and the invite stays unused | API |
| LM-05 | Parents: below the limit an invite still works | API |
| LM-06 | Devices: pairing and redeeming stop at the limit; revoking a device frees a place | API |
| LM-07 | Devices: a code refused for the limit is still good once a place is free | API |
| LM-08 | Entries per day: add, warn and mark stop at the limit; edits and reads still work | API |
| LM-09 | The limit is per family: another family has its own budget | API |
| LM-10 | Limits default to generous numbers when closed, tighter ones when sign-up is open or invite | Unit |
| LM-11 | LIMIT_* variables override the defaults one at a time | Unit |
| LM-12 | Open sign-up applies the hosted defaults to a real family | API |

## EX: Export and delete

Owner-only family export and deletion.

| ID | Expectation | Level |
| --- | --- | --- |
| EX-01 | Export: the owner downloads the family as an attachment | API |
| EX-02 | Export: only the owner (a co-parent or a child device is refused) | API |
| EX-03 | Export: no hashes, tokens or account subjects, and nothing from another family | API |
| EX-04 | Delete: only the owner may, and the confirmation must match the family name | API |
| EX-05 | Delete: removes every row of the family and nothing else | API |
| EX-06 | Delete: every session of the family stops working, and codes and invites are dead | API |
| EX-07 | Delete: the owner can sign in again and set up a new family (when allowed) | API |
| EX-08 | Delete: in a closed instance a deleted owner only gets setup if still allowlisted | API |

## OP: Operator

Operator page, allowlist and counts.

| ID | Expectation | Level |
| --- | --- | --- |
| OP-01 | A non-parent operator signs in to a closed instance and sees only the operator state | API |
| OP-02 | Operator sign-in matches on account, not display name; strangers are still refused | API |
| OP-03 | Operators can be listed by GitHub login or Google Workspace domain | API |
| OP-04 | /api/operator returns counts and health, and no names or emails | API |
| OP-05 | /api/operator: a normal parent, a child device and a visitor are refused | API |
| OP-06 | A parent who is also an operator keeps their family and gains the operator page | API |
| OP-07 | An operator in open or invite mode who has no family sees the operator flag next to setup | API |
| OP-08 | /api/setup tells an operator so, and not an ordinary parent | API |
| OD-01 | The dashboard and its settings are for operators only (no session 401; a parent or child device 403; GET/POST mixed up refused) | API |
| OD-02 | The dashboard's numbers are counts only, with 12 weeks of sign-ups and families by language; no name or email | API |
| OD-03 | A setting changed on the dashboard applies at once, says where it comes from, and goes back to .env | API |
| OD-04 | Bad values (with a reason), unknown keys and settings that stay in .env are refused | API |
| OD-05 | Per-family limits: from .env, from the dashboard, and the sign-up mode's default when empty | API |
| OD-06 | Dashboard settings hold after a restart; a stored value the app can't read falls back to .env with a warning | API |
| OD-07 | The dashboard page is served under the strict policy, with no inline style, script or handler | API |

## FI: Family invites and the cap on families

Operator-issued family invites (`SIGNUP_MODE=invite`), `LIMIT_FAMILIES` and `SIGNUP_CONTACT_URL`.

| ID | Expectation | Level |
| --- | --- | --- |
| FI-01 | The operator issues a 30-day invite link, sees it listed and stores only its hash | API |
| FI-02 | A parent with an invite signs in, sets up a family, and the invite is spent | API |
| FI-03 | An invite works once: a second parent with the same link gets the private page | API |
| FI-04 | An invited parent can finish setup later, from another device | API |
| FI-05 | Without an invite a new parent sees the private page with the contact link | API |
| FI-06 | An expired or cancelled invite does not work, and a used one cannot be cancelled | API |
| FI-07 | Only operators issue, list or cancel family invites | API |
| FI-08 | The allowlist still lets its parents create a family in invite mode | API |
| FI-09 | When the cap is reached a new parent sees the full screen and setup is refused | API |
| FI-10 | The operator page shows the families against the cap | API |
| FI-11 | An invite that meets a full installation is not used up, and works once there is room | API |
| FI-12 | A bad LIMIT_FAMILIES or SIGNUP_CONTACT_URL stops the server at startup | API |

## ET: ETag

Conditional reads of `/api/state`.

| ID | Expectation | Level |
| --- | --- | --- |
| ET-01 | /api/state has an ETag; repeating with If-None-Match is a 304 with no body | API |
| ET-02 | Any write in the family gives parents and children a new ETag | API |
| ET-03 | A child device's ETag changes when a parent records points for that child | API |
| ET-04 | A failed write does not change the ETag | API |
| ET-05 | A pairing redemption, a device log-out and an invite join give parents a new ETag | API |
| ET-06 | Revoking a device and removing a parent change the ETag | API |
| ET-07 | Different ?week= and ?child= give different ETags | API |
| ET-08 | ETags differ between sessions and between families | API |
| ET-09 | The 304 needs a session: no cookie is a 401, whatever tag is sent | API |

## SV: Startup, configuration and persistence

Refusal to start on bad configuration; data surviving restarts.

| ID | Expectation | Level |
| --- | --- | --- |
| SV-01 | Data survives a restart and sessions stay valid | API |
| SV-02 | An invalid PRIVACY_URL or TERMS_URL refuses to start | API |
| SV-03 | The server refuses unsafe or unreadable configuration and creates no database | API |
| SV-04 | A refusal lists every problem at once | API |
| SV-05 | A valid https configuration starts, and the config endpoint reports it | API |
| SV-06 | Localhost development works with a random secret and the fake provider | API |
| SV-07 | A bad LIMIT_* value refuses to start | API |
| SV-08 | An unreadable OPERATOR_ALLOWLIST entry refuses to start | API |

## MG: Migrations

Moving an older database to families.

| ID | Expectation | Level |
| --- | --- | --- |
| MG-01 | Is migrated to one family with one child, its entries and no parents | API |
| MG-02 | The first allowlisted parent becomes its owner with no setup step, the next gets their own | API |
| MG-03 | With open sign-up a stranger gets their own setup, never the unclaimed family | API |
| MG-04 | A parent who is not on the allowlist cannot claim it in closed mode either | API |

## IM: Docker image

Skipped when Docker is missing or `SKIP_IMAGE_TESTS=1`.

| ID | Expectation | Level |
| --- | --- | --- |
| IM-01 | The container becomes `healthy` within 60 seconds | Image |
| IM-02 | The process runs as uid 10001, not root | Image |
| IM-03 | The root filesystem is read-only | Image |
| IM-04 | `/healthz` answers 200 over plain HTTP | Image |
| IM-05 | Plain HTTP with a foreign `Host` is redirected (308) to `APP_BASE_URL` | Image |
| IM-06 | The page answers 200 behind `X-Forwarded-Proto: https` and carries the content security policy | Image |
| IM-07 | An `http://` `APP_BASE_URL` makes the container exit non-zero with a message | Image |

## LG: Languages

Family language, the starter list in it, error codes and the translation files.

| ID | Expectation | Level |
| --- | --- | --- |
| LG-01 | The language chosen at setup is stored and returned in the state, for every language | API |
| LG-02 | An unknown language at setup is a 400 `invalidLanguage`, and the account can still set up | API |
| LG-03 | Setup without a language follows `Accept-Language` (quality, regions), else English; an explicit language wins | API |
| LG-04 | Family save changes the language, keeps it when absent, refuses an unknown one and leaves it unchanged | API |
| LG-05 | Changing the language later does not rewrite existing names | API |
| LG-06 | The starter list is seeded in the family language with the same points and stars | API |
| LG-07 | Every starter translation has the English lengths and no empty names | API |
| LG-08 | `fromAcceptLanguage` handles q values, region tags, `zh-CN`/`zh-TW`, empty and junk headers | Unit |
| LG-09 | API errors carry the English text and a `code` (404, 400, 401, 415, 403, invalidLanguage) | API |
| LG-10 | `limitReached` carries `limit` and `tooManyTries` carries `seconds` | API |
| LG-11 | Every code the server can send has a string in `strings.en.js` errors | API |
| LG-12 | Every page translation has exactly the English keys, functions staying functions | Unit |
| LG-13 | Server page translations have the English keys; every page file has a locale | Unit |
| LG-14 | Sign-in problem pages are in the `Accept-Language` language (`html lang` and text), English by default | API |
| LG-15 | Every server text in every language is filled in, and its functions give text | Unit |

## DM: Demo families

Demo families (`DEMO_FAMILIES=1`): memory only, made-up data, parent's and child's view (test/demo.test.js).

| ID | Expectation | Level |
| --- | --- | --- |
| DM-01 | With demo families off: no demo in the config, `/api/demo/start` is 404, a `lw_demo` cookie is ignored | API |
| DM-02 | Try a demo opens a new family as its parent with an `lw_demo` cookie (HttpOnly, SameSite=Strict, no Max-Age) and no real session; time zone and language from the request, junk falls back to UTC and English | API |
| DM-03 | The made-up history: the first child has unlocked and locked rewards and more stars than the second; the second has a penalty and a warning; nothing in the future | API |
| DM-04 | The child's view shows only that child, without penalties, warnings, notes or parent data, can't change things, and switches back; another child's ID is 404 | API |
| DM-05 | A demo records, undoes and edits, and refuses invites, parents, devices, export, delete, setup, sign-out and the operator page with `demoOff` | API |
| DM-06 | Demo families never reach the database file; with both cookies the demo wins, and the real family comes back after leaving | API |
| DM-07 | Cross-family: demo families can't reach each other's or a real family's IDs, and a real session can't use demo routes | API |
| DM-08 | Leave the demo deletes it at once; its old cookie gets 401 `demoEnded` and is cleared | API |
| DM-09 | An idle demo family is deleted after `DEMO_IDLE_SECONDS`, freeing its place | API |
| DM-10 | Past `DEMO_MAX` a new demo gets 503 `demoFull` with `Retry-After`, until one is left | API |
| DM-11 | Starting demos is rate limited per client (10 a minute) | API |
| DM-12 | A restart ends every demo; starting one needs JSON from this site (POST only) | API |
| DM-13 | The app refuses unreadable `DEMO_FAMILIES`, `DEMO_MAX`, `DEMO_IDLE_SECONDS` and `TOUR_VIDEO` | API |

## VD: Tour video

| ID | Expectation | Level |
| --- | --- | --- |
| VD-01 | Watch the video is offered when `public/tour.mp4` exists, unless `TOUR_VIDEO=0`; the file stays served | API |
| VD-02 | `/tour.mp4` answers byte ranges: 206 with `Content-Range` for `a-b`, `a-` and `-n`, clamped ends, 416 for unsatisfiable or several ranges, HEAD | API |

## SITE: Project page

| ID | Expectation | Level |
| --- | --- | --- |
| SITE-01 | `scripts/build-site.sh` builds a folder where every local link, image, poster and the video of `site/index.html` exists | API |
| SITE-02 | The page and its stylesheet link only to the project (no third-party URL, import or script) | API |
| SITE-03 | The page has no inline style, script or event handler | API |
| SITE-04 | The header stars and the app icon are decoration: hidden from screen readers, still with reduced motion | Unit |
| SITE-05 | The page says how to add Little Wins to the home screen, with the iPhone pairing order; plain and shaded bands alternate | Unit |
| SITE-06 | The hero offers the hosted service (Start your family, free) and the Telegram group; the footer names the group | Unit |

## RM: Evening reminders and child notices

Web Push without dependencies (`server/webpush.js`), the reminder scheduler (`server/reminders.js`) and notices on a child's device (`server/notices.js`).

| ID | Expectation | Level |
| --- | --- | --- |
| WP-01 | Encryption matches the example in RFC 8291, byte for byte | Unit |
| WP-02 | The VAPID header is an ES256 JWT for the push service origin, signed by the key it names | Unit |
| WP-03 | Only https endpoints on known push services are accepted (localhost only in tests) | Unit |
| WP-04 | A reminder is due once a day, from its time to two hours later, in the family's time zone | Unit |
| RM-01 | A parent device subscribes with a time; bad endpoints, keys and times are refused | API |
| RM-02 | At its time the device gets one encrypted, signed push, in the family language, and only once | API |
| RM-03 | No push when every challenge is marked; a gone subscription is dropped; logging out removes it | API |
| RM-04 | PUSH_REMINDERS=0 turns reminders off | API |
| CN-01 | A parent allows notices for one child; only that child's device can turn them on | API |
| CN-02 | Unlocking a reward sends the child one notice, in the family language, and never again | API |
| CN-03 | A third perfect day in a row sends a streak notice; the evening reminder skips child devices | API |
| CN-04 | Turning notices on or off on a child's device changes its ETag (no stale 304 bringing the offer back) | API |

## PC: Lists for some children

Behaviors, penalties, challenges and rewards limited to some children.

| ID | Expectation | Level |
| --- | --- | --- |
| PC-01 | An item for one child shows and records for that child only | API |
| PC-02 | A challenge and a reward for one child: the other child's week and rewards leave them out | API |
| PC-03 | Ticking every child means everyone; another family's children are dropped; a deleted child leaves 'nobody' | API |

## EN: Encouragement

A parent's message to a child (`POST /api/message`) and the milestones on Today.

| ID | Expectation | Level |
| --- | --- | --- |
| EN-01 | A parent writes, replaces and clears a message; the child sees it on their device | API |
| EN-02 | A message shows for 7 days, belongs to one child, and goes with the child | API |
| EN-03 | A child's device cannot write a message, and an unknown child is a 404 | API |

## EG: The hidden emoji picker

A child picks their own emoji for what they see (`POST /api/child/emoji`), and the parent's switch per child (`POST /api/child/own-emoji`). See design.md, "Easter egg".

| ID | Expectation | Level |
| --- | --- | --- |
| EG-01 | On by default; a child's pick shows on that child's devices only, in items, rewards and history; '' goes back | API |
| EG-02 | A child can't pick for a penalty, an item or reward not meant for them, or with something that isn't one emoji | API |
| EG-03 | Turned off: the child's device can't pick, its picks are cleared and hidden; a parent can't use the child route | API |
| EG-04 | Deleting a reward or a child removes its picks; the export includes them | API |
| EG-05 | Migration 12 turns it on for existing children | API |

## RV: Weekly review

`GET /api/review` and the review page.

| ID | Expectation | Level |
| --- | --- | --- |
| RV-01 | The review sums the chosen week for the chosen child, with the last four weeks | API |
| RV-02 | A child's device and a signed-out visitor cannot read it, and it is read-only | API |
| RV-03 | Another family's child is unknown: the review answers 404 and shows nothing of it | API |

## IF: Idle families

Families no device has used for `DELETE_IDLE_FAMILIES_DAYS` are deleted.

| ID | Expectation | Level |
| --- | --- | --- |
| IF-01 | A family unused for longer than the limit is deleted with everything it owns; active and unclaimed ones stay | API |
| IF-02 | Any device using the app keeps its family active | API |
| IF-03 | Parents are told the rule; 0 turns deletion off; a bad value stops the server | API |

## BK: Encrypted backups

`server/backup-crypto.js` and `scripts/backup.sh` with `BACKUP_PUBLIC_KEY`.

| ID | Expectation | Level |
| --- | --- | --- |
| BK-01 | A backup encrypted to the public key decrypts with the private key, byte for byte | Unit |
| BK-02 | A wrong key, a changed or cut file, or a bad public key is refused | Unit |
| BK-03 | The command line makes a key it never overwrites, and encrypts and decrypts streams | Unit |
| BK-04 | backup.sh with BACKUP_PUBLIC_KEY writes an encrypted copy that restores the database | Unit |
| BK-05 | Without Node 22 on the host, backup.sh encrypts in the little-wins container started from its folder (any compose file); with none, it fails and says why | Unit |

## FT: Friendly touches

The child's greeting and today line, reward goals and empty lists (the page; see E2E-200..202).

| ID | Expectation | Level |
| --- | --- | --- |
| FT-01 | todayPoints counts the chosen child's positive points from today only | API |

## EM: Emoji

An emoji for each behavior, penalty, challenge, reward and child.

| ID | Expectation | Level |
| --- | --- | --- |
| EM-01 | The starter list comes with emoji, in every language | API |
| EM-02 | A parent sets, changes and removes an emoji on a behavior, a reward and a child | API |
| EM-03 | Anything but one emoji is refused | API |
| EM-04 | History shows the emoji, and the export keeps it | API |
| EM-05 | Old data gets the starter emoji for names that match the starter list | Unit |
| EM-06 | The page, its scripts and styles are revalidated on each load (Cache-Control: no-cache) | API |
| EM-07 | Every emoji the edit form offers is accepted by the server as is, and none is offered twice | Unit |

## IC: App icons

The favicon, the home-screen icons (`scripts/icons.js`) and the manifest.

| ID | Expectation | Level |
| --- | --- | --- |
| IC-01 | The page links its favicon and iOS icon, and the server serves each with its type | API |
| IC-02 | Every manifest icon exists at the size it claims, with a maskable one | Unit |
| IC-03 | favicon.ico holds one 32 x 32 PNG image | Unit |
| IC-04 | The manifest makes Little Wins installable: id, scope, screenshots at their sizes, shortcuts | Unit |

## RT: Writes sent twice

The page retries a write once after a network failure, with the same request ID.

| ID | Expectation | Level |
| --- | --- | --- |
| RT-01 | A write repeated with the same X-Request-Id is applied once; a new, missing or malformed ID applies | API |
| RT-02 | The same X-Request-Id in another family is that family's own write | API |
| RT-03 | A failed write is not remembered, so its retry is applied | API |

## OM: Emails to the operator

`NOTIFY_EMAIL`: a fake mail server on localhost receives them.

| ID | Expectation | Level |
| --- | --- | --- |
| OM-01 | The mailer signs in (AUTH PLAIN), sends headers and a dot-stuffed body, and reports a refusal | Unit |
| OM-02 | A sign-up, the last place, a parent turned away and a deletion each send one email, with counts only | API |
| OM-03 | NOTIFY_EVENTS picks the emails; a mail server that fails never breaks sign-up, and the log has no password | API |
| OM-04 | The server refuses NOTIFY_EMAIL without SMTP settings, an unknown event, or plain SMTP off localhost | API |
| OM-05 | Idle deletions say how many; a turned-away email goes at most once a day | Unit |
| OM-06 | `node server/mailer.js test` sends a test email, or says exactly why not (off, missing settings, refused) | API |
| OM-07 | At startup the server signs in to the mail server, sending nothing, and logs the result; the app runs either way | API |

## TH: Themes

Light and dark, following the device (`prefers-color-scheme`).

| ID | Expectation | Level |
| --- | --- | --- |
| TH-01 | Every text color reads at 4.5:1 or more on its background, in light and in dark | Unit |
| TH-02 | Colors live in the theme tokens: the rest of the stylesheet uses var(--…) | Unit |

## BT: The Telegram bot

`bot/` with fake Telegram, GitHub and Claude clients (see design, "The Telegram bot").

| ID | Case | Level |
| --- | --- | --- |
| BT-01 | A new member is muted and welcomed with six shuffled emoji; only their own tap on the star lets them post; no name in the log | Unit |
| BT-02 | Wrong taps reshuffle; the third, or five minutes without a tap, removes the member as a kick, and the welcome goes | Unit |
| BT-03 | A member who leaves before passing is tidied up; bots and repeat joins are not checked | Unit |
| BT-04 | The state file keeps a pending check across a restart | Unit |
| BT-05 | A question gets an answer from Claude with the guides cached, low effort, JSON output and no sampling parameters; chat that isn't a question never reaches Claude; questions in every language pass the filter | Unit |
| BT-06 | Off-topic: silent when not asked, a short decline when asked directly; a reply to the bot is directed; refusals and failed calls show only a short apology | Unit |
| BT-07 | Answers are limited per person per hour and per day | Unit |
| BT-08 | A bug report gets a draft; only its author can open the issue, once, summarized without names and labeled; the daily cap holds; no draft without a GitHub token; no content in the log | Unit |
| BT-09 | The bot leaves groups it doesn't serve, and ignores members still being checked | Unit |
| BT-10 | The bot refuses to start without its token or Claude key, with a malformed chat ID or half a GitHub setup; bot/.env.example names every setting | Unit |

## E2E: browser tests

Titles and steps are in [e2e/README.md](../e2e/README.md); each test name starts with its ID.

| ID | Expectation | Level |
| --- | --- | --- |
| E2E-01 … | see e2e/README.md | E2E |

## MN: Manual checklist

| ID | Expectation | Level |
| --- | --- | --- |
| MN-01 | Sign in with a real Google account on the deployed instance | Manual |
| MN-02 | Sign in with a real GitHub account on the deployed instance | Manual |
| MN-03 | Add to the home screen on iPhone: icon, name and full-screen launch are right | Manual |
| MN-04 | Add to the home screen on Android: icon, name and full-screen launch are right | Manual |
| MN-05 | Pair a real child phone with a code and with the link | Manual |
| MN-06 | `scripts/backup.sh` makes a copy that restores and opens | Manual |
| MN-07 | Behind Caddy or nginx with real TLS, plain HTTP redirects and the padlock is valid | Manual |
