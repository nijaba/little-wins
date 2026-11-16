# Browser tests (Playwright)

`npm run test:e2e` runs them in Chromium (phone viewport) and WebKit (iPhone 13). First time:
`npx playwright install chromium webkit` (`npm run e2e:install` adds system dependencies on Linux).

Each test starts its own server (`fixtures.js`: temp database, fake sign-in, free port) and creates its own
family. Every test fails on a CSP violation, an uncaught page error or an unexpected dialog. Dialogs the
app is meant to open are handled with `expectDialog`.

## Tests

| ID     | Title                                                                                |
| ------ | ------------------------------------------------------------------------------------ |
| E2E-01 | sign in and set up a family with the starter list                                    |
| E2E-02 | set up a family without the starter list                                             |
| E2E-03 | a person who is not allowed sees the private message and stays signed out            |
| E2E-04 | delete the family from Settings                                                      |
| E2E-05 | declining the delete confirmation keeps the family                                   |
| E2E-10 | a fixed behavior adds points, with a toast and Undo                                  |
| E2E-11 | a ranged behavior asks for the points in a prompt                                    |
| E2E-12 | cancelling the points prompt records nothing                                         |
| E2E-13 | a penalty asks to confirm before it takes points away                                |
| E2E-14 | the warning counter goes up and Undo takes it back                                   |
| E2E-15 | History lists what was recorded and undo from History works                          |
| E2E-20 | user-entered names render as text everywhere                                         |
| E2E-30 | the bottom tabs have an icon and a label, the selected one is marked                 |
| E2E-31 | the Settings sections start folded, with counts                                      |
| E2E-32 | an open Settings section stays open across a poll, an edit and a cancel              |
| E2E-33 | saving an edit keeps its section open                                                |
| E2E-34 | removing a behavior asks first and updates the count                                 |
| E2E-40 | tapping a day cycles its mark                                                        |
| E2E-41 | future days are shown but cannot be tapped                                           |
| E2E-42 | the previous week can be browsed and marked, and Back returns                        |
| E2E-43 | the selected past week survives the background poll                                  |
| E2E-50 | with several children the parent switches between them                               |
| E2E-51 | the chosen child stays chosen across background polls                                |
| E2E-52 | a change made on another device shows up on the chosen child, not the first          |
| E2E-53 | the chosen child is remembered after a reload |
| E2E-60 | a child device pairs with a typed code and sees only the child view                  |
| E2E-61 | a child device pairs by opening the link                                             |
| E2E-62 | a wrong code shows a message on the sign-in screen                                   |
| E2E-63 | a parent joins through an invite link                                                |
| E2E-64 | "Not now" on an invite screen goes back to the sign-in screen                        |
| E2E-70 | the sign-in and setup screens fit phone screens (360x640, 375x667, 390x844, 430x932) |
| E2E-71 | every main screen and every Settings section fits phone screens                      |
