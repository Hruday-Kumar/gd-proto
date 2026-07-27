#!/usr/bin/env bash
# Generates the 3 speech clips regression-room.js uses, via macOS's
# built-in `say` + `afconvert` -- a Mac-native equivalent of the spike's
# Windows-only gen-voices.ps1 (spike/media/gen-voices.ps1), since this
# harness needs to be runnable without Windows/PowerShell. Not committed
# to git (media/*.wav is gitignored, same convention as spike/media/) --
# regenerate any time with: bash scripts/regression/gen-voices.sh
set -euo pipefail
cd "$(dirname "$0")/media"

say -o /tmp/placeme-alice.aiff "Technology has changed education in remarkable ways for students everywhere."
say -o /tmp/placeme-bob.aiff "Remote work lets people balance their jobs and family life much better."
say -o /tmp/placeme-carol.aiff "Social media shapes how young people communicate with each other today."

afconvert -f WAVE -d LEI16@16000 -c 1 /tmp/placeme-alice.aiff alice.wav
afconvert -f WAVE -d LEI16@16000 -c 1 /tmp/placeme-bob.aiff bob.wav
afconvert -f WAVE -d LEI16@16000 -c 1 /tmp/placeme-carol.aiff carol.wav

rm -f /tmp/placeme-alice.aiff /tmp/placeme-bob.aiff /tmp/placeme-carol.aiff
echo "Generated alice.wav, bob.wav, carol.wav in $(pwd)"
