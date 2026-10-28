# Pocket Arcade

An installable, offline-first collection of casual games for phones and
tablets. No accounts, no ads, no network needed after the first visit: open
the site once, add it to your home screen, and play anywhere.

Play at **https://games.mckoss.com/**. Each game has its own link to share
-- `https://games.mckoss.com/#/morse`, `#/lander`, `#/elevator` and so on --
which opens straight into that game, no install needed, and downloads just
that game (it's then playable offline too). Its level page links back to
the whole arcade.

## Games

- **Benji's Town** -- for little ones: tap the garbage truck, the postal worker's van,
  the dog walker and the cement mixer to send them off to work around a
  little town in 3D -- with sidewalks, crosswalks and traffic lights; later,
  be the driver (or walk the dog), from the driver's seat.
- **Car Jam** -- swipe cars out of a jammed parking lot; mind the grannies.
- **Tap Maze** -- tap arrows to send them off the board, if their path is clear.
- **Breakout** -- the arcade classic, in portrait or landscape.
- **Lunar Lander** -- fly over the mountains and set down gently on the base.
- **Night Driver** -- the 1976 arcade racer: stay between the lights in the dark.
- **Water Lab** -- pour water between beakers to measure an exact amount.
- **Tangram** -- the classic puzzle: seven pieces cut from a square, moved,
  turned and flipped to make each shape in silhouette, simple to hard.
- **Elevator Operator** -- run the lifts through a working day, from a
  six-storey office block to twin towers, against the computer.
- **Morse Rain** -- learn Morse code by ear: hear a letter and tap it in
  the drifting cloud, or key letters yourself and shoot them down.
- **15** -- the sliding puzzle, with numbers, pictures, sequences (a clock,
  the moon, the sun across the sky) or your own photos on any level, and a
  graph of every move against the best possible.
- **Trial Bike** -- ride a trials bike over hills, logs, ledges and gaps;
  beat the computer rider's time without a crash. Contributed by
  [Garnett Callis](https://github.com/garnett-ui).
- **Crystal Cave** -- fire crystals up into the roof of a cave: three of a
  colour shatter, and whatever they held up drops into your cart. Clear
  the roof in the computer miner's number of shots.
- **Jigsaw** -- turn your own photos into jigsaw puzzles, or a pattern: a
  colour wheel, stained glass, a map and more, new every time.

How each one is meant to play, and the decisions behind it, are in
[DESIGN.md](DESIGN.md).

## Installing on a device

- **iPhone / iPad (Safari):** open the site, tap **Share**, then **Add to
  Home Screen**.
- **Android (Chrome):** open the site and tap **Install** on the banner (or
  ⋮ menu → **Install app**).

Progress is saved on the device.

## Development

There is no build step: the app is plain HTML, CSS and ES modules, drawn on a
canvas, with most sound synthesised; recorded audio and images are welcome
where they make a game better (Lunar Lander has both), cached for offline
play like everything else.

```sh
npm install           # dev dependency: Playwright for the browser tests
npm start             # serve at http://localhost:8080
npm test              # unit tests + headless-browser play-through + offline check
```

After changing any app file, run `npm run build` to refresh the generated
files (`sw-manifest.js` and `js/version.js`); the tests fail if they are stale.

### Versions and updates

The app version is `version` in `package.json` (semver: minor for new games
and features, patch for fixes), shown at the bottom of the home screen and
recorded in `CHANGELOG.md`. Bump it, add a changelog entry and run
`npm run build` for each release. Installed apps check for a new version when
they come back to the foreground (and hourly), then show a prompt naming the
new version; **Update** installs it and reloads.

Other scripts:

- Levels come from `games/car-jam/levels.js`: `specFor(n)` is the difficulty
  curve and `makeLevel(n)` builds level *n* from `seedFor(n)`. Every level is
  verified solvable and its par is the solver's optimum. Bump `GEN_VERSION`
  when generation changes so levels cached on devices are rebuilt.
- `npm run icons`: re-render the PNG app icons from `icons/icon.svg`.

### Layout

```
index.html, css/, js/       app shell: hub, routing, audio, settings, install
js/games.js                 registry of games
games/car-jam/model.js      rules, solver, level generator (pure, shared with Node)
games/car-jam/levels.js     seeded difficulty curve; worker.js builds levels off-thread
games/car-jam/play.js       simulation, input, rendering for a level
games/car-jam/draw.js       vector sprites (cars, grannies, obstacles)
games/car-jam/index.js      level select, HUD, win dialog
games/tap-maze/             Tap Maze: model.js (rules, generator), levels.js,
                            play.js, draw.js, index.js, worker.js
games/breakout/             Breakout: engine.js (physics, rules), play.js, index.js
games/lander/               Lunar Lander: engine.js (physics, terrain, autopilot), pilot.js (the fastest flight), apollo.js (Apollo 11 from orbit), play.js
games/night-driver/         Night Driver: engine.js (road, car, forks; runs in Node), play.js (view), signs.js
games/morse/                Morse Rain: code.js (the code, lessons, timing; runs in Node), play.js (the cloud)
games/water/                Water Lab: model.js (pours, BFS solver, levels), shapes.js (glassware), space.js (the solution-space map), play.js
games/tangram/              Tangram: model.js (the pieces, coverage and snapping; runs in Node), solver.js (makes a silhouette from the pieces), figures.js (generated), play.js
games/elevator/             Elevator Operator: engine.js (buildings, lifts, arrivals, levels, dispatcher; runs in Node), play.js (towers), sprites.js (8-bit people), cat.js (an easter egg), city.js (the city round about), pace.js (fast through the lulls)
games/trial-bike/           Trial Bike: engine.js (bike physics, courses, the computer rider; runs in Node), play.js (view), worker.js
games/crystal-cave/         Crystal Cave: engine.js (the roof, the shot, the kinds, the computer miner; runs in Node), play.js (view, chambers), worker.js
games/jigsaw/               Jigsaw: puzzle.js (grid, piece shapes), play.js, samples.js
games/benji/                Benji's Town: town.js (the town, routes, the days and their jobs), clock.js (the time of day, the sky), streets.js (sidewalks, crosswalks, lights), traffic.js (lanes, stopping, crossing), steer.js (driving yourself: the way ahead, which way to turn) -- all run in Node; iso.js (the 3D: from above, and from the driver's seat), draw.js, play.js
js/lib/photos.js            the player's photos, stored on the device (IndexedDB)
js/lib/orientation.js       orientation lock with fallback
js/lib/campaign.js          shared level select, progress and dialogs
js/lib/level-source.js      builds levels in a worker, prefetches and caches
sw.js, sw-manifest.js       offline support
tools/                      icon and service-worker generators; tangram-figures.mjs (designs, checks and writes the Tangram figures)
test/                       node:test unit + Playwright end-to-end tests
```

### Adding a game

Create `games/<id>/index.js` exporting `mount(element, ctx, route)` that
returns `{ route(sub), destroy() }`, add an entry to `js/games.js`, and run
`npm run build`.

### Analytics

`js/lib/analytics.js` reports to Google Analytics 4 (the mckoss.com property,
`G-GBPSK1HQ34`). Events are queued on the device and sent whenever it is
online, so play while offline is uploaded on the next connection (tagged with
`queued_minutes`). Events: `page_view`, `app_open` (installed vs browser),
`app_installed`, `level_start`, `level_complete` (with `stars`) and
`level_fail`, each with `game` and `level`. Nothing is sent from localhost.

### Deployment

The app is a static site hosted on GitHub Pages. `.github/workflows/ci.yml`
runs the tests on every push and, on `main`, publishes the site to Pages at
https://games.mckoss.com/ (custom domain set in Settings → Pages). One-time setup: Settings → Pages → Source: **GitHub Actions**.

## Contributing

Pull requests are welcome -- new games, or fixes to the ones here. See
[CONTRIBUTING.md](CONTRIBUTING.md): one thing per pull request, rebased on
the latest `main`, `npm test` passing; they're squash-merged by hand.

## License

[MIT](LICENSE). The Lunar Lander scenery is cut from *Earthrise* (Apollo 8,
AS08-14-2383, NASA), and its landing sound is Apollo 11's "The Eagle has
landed" (NASA audio); both are in the public domain. The voices in its
Apollo 11 flight (`games/lander/audio/a11-*.mp3`: "GO for powered descent",
the 1202 and 1201 alarms, "60 seconds", "30 seconds", "Contact light") are
cut from NASA's *Apollo 11 Audio Highlights* reel, also public domain
([Internet Archive](https://archive.org/details/Apollo11AudioHighlights)),
by way of [seankd3/orbital-mechanics](https://github.com/seankd3/orbital-mechanics).
Using them implies no endorsement by NASA.

Benji's Town's spoken lines (`games/benji/voice/*.mp3`) were recorded once,
at build time, by `tools/benji-voice.py` in Microsoft Edge's read-aloud child
voice (en-US-AnaNeural), through the community `edge-tts` wrapper -- as in
[mckoss/letter-tracer](https://github.com/mckoss/letter-tracer); the game
never calls a service. Microsoft publishes no grant of redistribution rights
for that output; the clips are committed at the project owner's direction,
knowing that. If that needs undoing: a paid voice service whose terms allow
redistribution, or recordings of a real child.

Benji's Town's pictures of emoji (`games/benji/emoji/*.svg`) are Google's
[Noto Emoji](https://github.com/googlefonts/noto-emoji), Apache License
2.0, fetched by `tools/benji-emoji.py`: the town draws those rather than
relying on the device's emoji font, which some browsers (a car's) lack.
Its cheer (`games/benji/sounds/yay.mp3`) is the one from
[mckoss/letter-tracer](https://github.com/mckoss/letter-tracer), supplied by
the project owner.
