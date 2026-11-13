#!/usr/bin/env python3
"""Benji's Town: fetch the emoji pictures it draws.

Some browsers (a car's, say) have no colour emoji font, so the town draws
its emoji from pictures that come with the game -- as does The Chopping
Game, from the same folder: Google's Noto Emoji (the
look Android phones have), Apache License 2.0. This finds every emoji in
games/benji/*.js and fetches any picture not there yet, into
games/benji/emoji/<code points>.svg (e.g. 1f5d1.svg for the wastebasket;
no variation selector).

Run from the repo root:  python3 tools/benji-emoji.py

(1f9b9.svg isn't Noto's: the 🦹 supervillain looked like Dracula, so
Benji's robber is a picture of our own -- a cartoon burglar all in black.
Pictures already there aren't fetched again, so it stays.)
"""
import glob
import os
import re
import sys
import urllib.request

HERE = os.path.join('games', 'benji')
OUT = os.path.join(HERE, 'emoji')
SRC = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/v2.047/svg/emoji_u{}.svg'
# Pictographs (and their joiners and selectors). Plain symbols the
# ordinary fonts have -- ✓ ✕ ↻ -- aren't in these ranges.
EMOJI = re.compile('[\U0001F300-\U0001FAFF☀-➿⭐⭕][️‍\U0001F3FB-\U0001F3FF\U0001F300-\U0001FAFF☀-➿]*')
PLAIN = {'✓', '✕', '↻'}


def code(ch):
    return '-'.join(f'{ord(c):x}' for c in ch if c != '️')


def main():
    found = set()
    # (The Chopping Game draws its surprises with Benji's pictures too.)
    for f in glob.glob(os.path.join(HERE, '*.js')) + glob.glob(os.path.join('games', 'chop', '*.js')):
        for m in EMOJI.findall(open(f, encoding='utf-8').read()):
            if m not in PLAIN:
                found.add(m)
    os.makedirs(OUT, exist_ok=True)
    fetched = 0
    for ch in sorted(found):
        path = os.path.join(OUT, code(ch) + '.svg')
        if os.path.exists(path):
            continue
        url = SRC.format(code(ch).replace('-', '_'))
        try:
            data = urllib.request.urlopen(url, timeout=30).read()
        except Exception as e:  # noqa: BLE001 -- say which, and go on
            print(f'  {ch}  {url}: {e}', file=sys.stderr)
            continue
        open(path, 'wb').write(data)
        fetched += 1
        print(f'{code(ch)}.svg  <-  {ch}')
    print(f'{len(found)} emoji; {fetched} fetched.')


if __name__ == '__main__':
    main()
