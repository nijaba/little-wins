#!/usr/bin/env python3
"""Add the voice-over to the tour video: docs/video/tour.webm becomes public/tour.mp4.

The app serves the MP4 at /tour.mp4 (with byte ranges), and the README links there: GitHub
does not play videos kept in a repository. The phone-sized recording is centered in a
1280 x 720 frame in the app's navy.

Each row of the cue table in docs/video/tour-voiceover.md is spoken by Kokoro, an open-source
neural voice (Apache 2.0) that runs offline, and placed at its time. The script also saves a
poster frame, docs/video/tour-poster.png, for the README.

It needs tools the app does not (the app has no runtime dependencies), so give them their own
environment, outside the repository:

    python3 -m venv ~/.venvs/voice
    ~/.venvs/voice/bin/pip install kokoro-onnx soundfile imageio-ffmpeg
    mkdir -p ~/.cache/kokoro && cd ~/.cache/kokoro
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

Then, from the repository:

    node scripts/tour-video.js                             # the silent recording, when a screen changed
    ~/.venvs/voice/bin/python scripts/tour-voiceover.py    # the narrated MP4 and the poster

$KOKORO_DIR names another folder for the two model files. ffmpeg (with libx264 and AAC) is
the one $FFMPEG names, the one on the PATH, or imageio-ffmpeg's.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / "docs" / "video"
SILENT = FOLDER / "tour.webm"
NARRATED = ROOT / "public" / "tour.mp4"
POSTER = FOLDER / "tour-poster.png"
SCRIPT = FOLDER / "tour-voiceover.md"
VOICE = "af_heart"  # Kokoro's warm American English voice
SPEED = 1.0
MODELS = Path(os.environ.get("KOKORO_DIR", Path.home() / ".cache" / "kokoro"))
POSTER_AT = 14.5  # seconds: the weekly challenges step, with today just marked perfect
FRAME = "scale=-2:720,pad=1280:720:(ow-iw)/2:0:color=0x1f3a5f,setsar=1"
CUE = re.compile(r"^\| (\d+):(\d+(?:\.\d+)?) \| [^|]+ \| ([^|]+) \|$")


def cues() -> list[tuple[float, str]]:
    found = []
    for line in SCRIPT.read_text().splitlines():
        m = CUE.match(line.strip())
        if m:
            found.append((int(m[1]) * 60 + float(m[2]), m[3].strip()))
    if not found:
        raise SystemExit(f"no cues found in {SCRIPT.relative_to(ROOT)}")
    return found


def ffmpeg() -> str:
    exe = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        raise SystemExit(
            "needs ffmpeg: install it, set FFMPEG, or pip install imageio-ffmpeg"
        ) from None


def voice():
    """A function that writes one line of speech to a WAV file and returns its length."""
    try:
        import soundfile
        from kokoro_onnx import Kokoro
    except ImportError:
        raise SystemExit("needs kokoro-onnx and soundfile: see this script's docstring") from None
    model, voices = MODELS / "kokoro-v1.0.onnx", MODELS / "voices-v1.0.bin"
    if not (model.is_file() and voices.is_file()):
        raise SystemExit(f"Kokoro's model files are not in {MODELS}: see this script's docstring")
    kokoro = Kokoro(str(model), str(voices))

    def speak(text: str, path: Path) -> float:
        samples, rate = kokoro.create(text, voice=VOICE, speed=SPEED, lang="en-us")
        soundfile.write(path, samples, rate)
        return len(samples) / rate

    return speak


def main() -> None:
    if not SILENT.is_file():
        raise SystemExit("record the video first: node scripts/tour-video.js")
    speak = voice()
    exe = ffmpeg()
    lines = cues()
    with tempfile.TemporaryDirectory() as tmp:
        clips = []
        for i, (at, text) in enumerate(lines):
            clip = Path(tmp) / f"line{i}.wav"
            ends = at + speak(text, clip)
            following = lines[i + 1][0] if i + 1 < len(lines) else None
            late = following is not None and ends > following
            note = "  (runs into the next cue)" if late else ""
            print(f"{at:5.1f}s to {ends:5.1f}s  {text}{note}")
            clips.append((at, clip))

        inputs = ["-i", str(SILENT)]
        chains = [f"[0:v]{FRAME}[v]"]
        for i, (at, clip) in enumerate(clips, start=1):
            inputs += ["-i", str(clip)]
            ms = int(at * 1000)
            chains.append(f"[{i}:a]aresample=48000,adelay={ms}:all=1[a{i}]")
        mix = "".join(f"[a{i}]" for i in range(1, len(clips) + 1))
        # Loudness to -16 LUFS, the usual level for video on the web.
        level = "aresample=48000,loudnorm=I=-16:TP=-2,aresample=48000"
        chains.append(f"{mix}amix=inputs={len(clips)}:normalize=0,{level},apad[voice]")
        subprocess.run(
            [exe, "-y", "-loglevel", "error", *inputs]
            + ["-filter_complex", ";".join(chains), "-map", "[v]", "-map", "[voice]"]
            + ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "slow"]
            + ["-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart"]
            + [str(NARRATED)],
            check=True,
        )
    subprocess.run(
        [exe, "-y", "-loglevel", "error", "-ss", str(POSTER_AT), "-i", str(SILENT)]
        + ["-frames:v", "1", "-vf", FRAME, str(POSTER)],
        check=True,
    )
    print(f"wrote {NARRATED.relative_to(ROOT)} and {POSTER.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
