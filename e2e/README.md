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
| E2E-16 | a note from the toast or History shows for parents; empty removes it                 |
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
| E2E-80 | the sign-in screen follows the browser's language (de, zh; unsupported → English)    |
| E2E-81 | each language (zh, es, fr, de) picked at setup: every main screen and Settings section translated, no English left, no `undefined` |
| E2E-82 | changing the language in Settings → Family re-renders and survives a reload          |
| E2E-83 | another device with an English browser shows the family's language                   |
| E2E-84 | German and Chinese sign-in and setup fit phone screens                               |
| E2E-85 | German and Chinese main screens and Settings sections fit phone screens              |
| E2E-90 | Try a demo opens a made-up family with a banner on every screen, and fits phones     |
| E2E-91 | the child's view shows what that child would see, and the parent's view returns      |
| E2E-92 | Settings in a demo: invites and devices off, no export or delete, Leave the demo     |
| E2E-93 | when every demo family is busy, a calm note says to come back                        |
| E2E-94 | the tour is offered once per device; No thanks sticks, and Settings offers it again  |
| E2E-95 | the parent tour switches tabs, outlines each part, goes back, and Escape closes it   |
| E2E-96 | the child tour from the demo banner walks its five steps                             |
| E2E-97 | Watch the video plays over the sign-in page and Escape closes it                     |
| E2E-98 | TOUR_VIDEO=0 hides Watch the video                                                   |
| E2E-100 | the operator invites a family; the invited parent opens the link and sets it up     |
| E2E-101 | a link that doesn't work shows the private note with Ask for a place                |
| E2E-102 | once LIMIT_FAMILIES is reached, a new parent sees the full screen                   |
| E2E-110 | with a dark device setting the page is dark, with light text                        |
| E2E-111 | with a light device setting the page stays light                                    |
| E2E-120 | a parent opens the weekly review from Week, prints it, and goes back               |
| E2E-121 | the weekly review fits a phone; its print view hides the buttons and tabs          |
| E2E-130 | a parent writes a message for the child, sees it on Today, and clears it          |
| E2E-131 | the child's view shows the parent's message, with no buttons                      |
| E2E-140 | a behavior for one child shows on that child's Today only, labelled in Settings  |
| E2E-141 | with one child the edit form has no "Who is it for?" choice                      |
| E2E-150 | Settings offers the evening reminder; the service worker registers under the CSP|
| E2E-151 | a parent turns notices on and off for a child in Settings -> Children          |
| E2E-160 | the sign-in page opens with the welcome: star, name, tagline, three reasons   |
| E2E-161 | the welcome stays still when the device asks for reduced motion               |
| E2E-170 | a parent picks an emoji for a behavior and a child, and Today shows them     |
