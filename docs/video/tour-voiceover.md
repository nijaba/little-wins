# Tour video: voice-over script

For `public/tour.mp4`, the narrated video the app serves at `/tour.mp4`, and [`tour.webm`](tour.webm), the
silent recording it is made from: 30 seconds, a phone screen (390 × 844) centered in a 1280 × 720 frame. A
parent opens a demo family, takes the guided tour (adding points, a warning and a mark on the way) and ends
on the child's view. Everything on screen is the demo's made-up family.

`node scripts/tour-video.js` records the silent video again after a screen changes, and prints the time each
step starts. Keep the cues below in line with those times. `scripts/tour-voiceover.py` then speaks each line
of the table at its cue, in Kokoro's open-source neural voice `af_heart`, and makes `public/tour.mp4` and the
README's poster, `docs/video/tour-poster.png`; its docstring says how to set Kokoro up. A voice actor can read
the same lines to the same cues instead.

**Pace:** about 2.5 words a second, calm and friendly. Each line fits inside its step with a breath to spare;
start each one on its cue rather than running lines together.

| Time | On screen | Voice-over |
| --- | --- | --- |
| 0:00.0 | The sign-in page; Try a demo opens the demo family | Here's Little Wins, with a made-up demo family. |
| 0:03.0 | **Earning points** outlined; + adds five points | Tap plus when your child does something good. |
| 0:06.5 | **Warnings** outlined; a warning is counted | A warning is a gentle heads-up. |
| 0:09.3 | **Penalties** outlined | Penalties are for parents' eyes only. |
| 0:12.3 | **Weekly challenges** outlined; today is marked perfect | Two perfect days in a week win a star. |
| 0:15.7 | **Rewards** outlined, with the progress ring | Stars and points unlock rewards. |
| 0:18.7 | **History and undo** outlined | Made a mistake? Undo it in History. |
| 0:21.6 | **Settings** outlined in the tab bar | Make the lists your own. |
| 0:24.2 | **Your child's phone**: Add a device outlined | Add your child's phone with a code. |
| 0:27.5 | Mia's view, as her own phone shows it | And this is what your child sees. |

## Whole script

Here's Little Wins, with a made-up demo family.
Tap plus when your child does something good.
A warning is a gentle heads-up.
Penalties are for parents' eyes only.
Two perfect days in a week win a star.
Stars and points unlock rewards.
Made a mistake? Undo it in History.
Make the lists your own.
Add your child's phone with a code.
And this is what your child sees.

(About 65 words.)
