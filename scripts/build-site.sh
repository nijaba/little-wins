#!/bin/sh
# Assemble the project page (site/) with the guide pictures and the tour video into _site/,
# ready for GitHub Pages.
#   scripts/build-site.sh            # then open _site/index.html, or serve the folder
#   scripts/build-site.sh OUT        # into another folder (test/site.test.js uses this)
set -eu
cd "$(dirname "$0")/.."
out="${1:-_site}"
rm -rf "$out"
mkdir -p "$out/images"
cp site/index.html site/style.css "$out/"
cp public/tour.mp4 public/icon.svg public/apple-touch-icon.png "$out/"
cp docs/images/parent-today.png docs/images/parent-week.png docs/images/parent-rewards.png \
  docs/images/child-today.png docs/images/child-rewards.png docs/video/tour-poster.png \
  "$out/images/"
touch "$out/.nojekyll"
echo "built $out/"
