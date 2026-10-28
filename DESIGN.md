# Pocket Arcade: design notes

How each game works and why, for keeping development consistent. The
README says what the games are; this says how they're meant to play.

## Principles shared by every game

- **Offline first, no accounts, no ads.** What you play is cached as you
  play it, so it works with no network after that: the app shell on the
  first visit, a game when it's opened, the whole arcade once you're on its
  home screen or have installed it. A link to one game (`#/morse`) is
  shareable and downloads just that game; every level page has a link to
  the arcade. Once you've had the whole arcade, every update downloads all
  of it (new games too) before it offers to install.
  Graphics are mostly drawn on a canvas and most sound is synthesised (Web
  Audio), which keeps the download small -- but recorded audio and images
  are fine where they make a game better (Lunar Lander's "The Eagle has
  landed" clip and its Earthrise scenery), as long as they're cached for
  offline play.
- **Phone first.** Every game plays with one thumb on a phone, upright
  unless the game needs the width (Breakout plays either way); tablets get
  the extra room used well, not just stretched.
- **Levels are the same for everyone.** Level *n* is built from a seed
  (`seedFor(n)`), so it's the same day, maze or puzzle on every device and
  every replay. Generated puzzles are checked solvable, and par is the
  solver's best.
- **Short sessions.** A level takes a few minutes at most; progress (the
  furthest level and the best stars) is saved on the device.
- **Fair scoring.** Stars measure how well you did against something
  concrete -- par moves, the computer's dispatcher, the letters found
  first time -- and the end card says what it was.
- **Learn by playing.** Rules are shown by a short intro card or a hint the
  first time they matter, not a manual.
- **Changelog for players.** `CHANGELOG.md` entries describe what players
  can see -- new games and features, changes to how things play, anything
  taken away -- not internal fixes or renames.

## Benji's Town

For a three-year-old (Benji, who loves cars): no reading, no losing, big
pictures and a sound for every touch.

- No levels: one little town that goes on from day to day, and is kept
  (it opens on the day you'd got to). Each day there are jobs in the
  morning (the bins, the post), at midday (building, parcels) and in the
  evening (the dog's walk), a few more as the days go by; when the
  evening's are done, night falls -- the sky deep blue, the moon and the
  stars out, lights on in the windows, the streetlamps on the corners and
  the cars' headlights glowing -- the helpers all go home, "Goodnight!",
  and it's the next morning ("Good morning!"). The sky goes round with the
  clock: gold at sunrise and sunset, the sun going over. The title shows
  the day and the time of day (🌅 🌤️ ☀️ 🌇 🌙).
- Nobody's ever late: the clock goes at an easy pace while there are jobs
  to do (a part of the day takes about a minute), and waits at the end of
  that part till they're done; with nothing to do it goes on quickly to
  the next (the whole night in about ten seconds). (`clock.js`.)
- The town grows as it goes: houses built stay built, and the jobs come
  to them too. (The button top right starts a new town, for a grown-up --
  it asks first.)

- A little town on a 13 x 13 grid: three streets each way, three tiles
  apart (room to queue between the corners), each running on two tiles
  past its last corner to a turning circle at the edge of town -- round an
  island with a little tree, keeping it on your left, instead of a U-turn.
  Between them houses, the post office, the dump, the builders' yard, the park, a shop,
  a café and empty lots (the post office's sign a red postbox 📮, so it
  isn't mistaken for a house waiting for a letter ✉️). Cars and people
  potter about; tap one and it honks or hops. A job at a place is done
  by pulling up on any street beside it (a corner house has two), and a
  helper's jobs come in any order -- except the trip to the dump, and
  home from the park, which come last.
- In 3D, seen from above at an angle (isometric), like a toy town on a
  block of earth: houses with walls, doors, windows and pitched roofs,
  trucks with cabs and wheels (the mixer's drum turning), people with legs
  that walk. Two big round-arrow buttons at the bottom turn the town a
  quarter turn either way (a smooth half-second spin), to see behind
  things; anything standing between you and a helper turns see-through.
- The camera follows the action: tap a helper and it glides in close and
  follows it on its job (the postal worker at the door, the dog in the
  park); a moment after it's done, it eases back out to show all the
  helpers. It starts on the whole town, and goes back to it with the
  confetti, and for the night. Dragging the ground looks round the town
  for a few seconds.
- Road safety, shown not told. Every street has a sidewalk down each side,
  and people (the dog walker too) keep to them, crossing only at the zebra
  crossings by the intersections. Three intersections, corner to corner
  across town, have traffic lights: east-west and north-south take turns
  (green, yellow, then a moment of all red). Each light stands on the far
  right-hand corner for the traffic it's for, facing it, as in a real
  (drive-on-the-right) town: its lamps show only from in front -- from the
  driver's seat, the one lit up ahead on the right is yours, and the cross
  street's show their backs. Cars stop at the line on red,
  and people wait at the curb for the little walking man -- the red hand
  blinks when it's about to change, and nobody starts out then. At the
  other intersections cars go through one at a time; at the lights, only
  cars coming the same way, or from opposite ways both going straight on,
  go through together (no turning across anyone, and a truck turning
  swings wide). Everywhere, a car waits for anyone on a crosswalk it's
  about to drive over, and people don't step out while a car is going
  over theirs. Cars keep to the right-hand lane and queue behind each
  other; no car ever drives into another (each is a box the size it's
  drawn), and none goes into an intersection without room to get out of
  it, or past a car waiting there ahead of it. Cars never turn round in
  the street: going somewhere behind them, they go round the block, and
  only down the end of a street to a door there. A truck parked at a door
  stops clear of the crosswalk; held up behind one, a car pulls up behind
  it if that's where it was going, or waits -- and a helper with nothing
  to do that's in the way drives off home, to the end of its street, so
  nothing ever gridlocks. When a helper is held up at a red light,
  the town says so: "Red light stop!" ... "Green light go!" (or "Wait
  for the walking man!" ... "Walk!").
- Helpers with jobs, shown in a tray of pictures that tick off: the
  **garbage truck** empties the bins put out by houses, then takes the load
  to the dump; the **mail van** takes letters and packages to the houses
  with a letter or package bubble, and at each the **postal worker** hops
  out, step by step and slowly enough to follow: round to the back of the
  van, the back doors swing open and out comes the letter or parcel, up to
  the house with it ("Here's your letter!", "A package for you!"), and
  back to hop in again (about seven seconds); the **dog walker** takes the dog to the park to play, and
  home again; the **cement mixer** builds a house on an empty lot in three
  trips (slab, walls, roof), going back to the yard to load up in between
  -- concrete for the slab and the walls; for the roof, wood and tiles,
  so the drum comes off and it's a flatbed stacked with timbers and roof
  tiles (🪵 on its button) -- and at each, a spell of hammering (synthesised, like every sound:
  for each hit, a crack, the knock of the wood and the ring of the nail).
  Houses built stay built: the town grows from day to day.
- **Fire!** Once a day, a little while into one part of it (which part,
  which house and when come from the day's seed), a fire breaks out at a
  house: flames licking up from the roof and smoke rising, a crackle, and
  "Fire! Call the fire engine!" -- the camera takes a look, a 🔥 joins the
  jobs in the tray, and the **fire engine** (red, a ladder on top, a
  light bar on the cab) waits by the **firehouse** next to the post office
  (red brick, a big white garage door, a 🚒 sign), its button bouncing.
  Off it goes with its siren -- driven by you, or by itself -- lights
  flashing red and blue (a glow round each end of the light bar; from the
  driver's seat, in the top corners of the windshield), and the siren
  going round, quieter, all the way there. It doesn't stop for red
  lights, and drives down the middle of the street; every car within
  earshot (three tiles) pulls over to the curb and stops
  till it's gone by -- even a helper stopped on a job -- then eases back
  into its lane. (It still waits for anyone on a crosswalk, and never
  drives into a car.) At the house the hose arcs water onto the roof for
  three seconds, lights still flashing (a rush of
  water; driving, the camera floats out of the cab to watch), the flames
  die down and the smoke turns to steam: "You put out the fire, great
  job!". That part of the day isn't done till the fire's out.
- Each helper that can be sent on a job has a big round button over it,
  in its colour, with a picture of its next job (a bin, a letter, the dog,
  a brick) and a little green "go" -- kept in view at the edge of the
  screen, pointing the way, when the helper's off it. Tap the button (or
  the helper) and it goes to that job; only then does a bouncing arrow in
  its colour show where, with little yellow arrows along the road (or
  sidewalk) pointing the way (and, once the mail van's out, the houses waiting for a letter
  or parcel show it). Every step is a tap: at the job it stops, and its
  button comes back for the next -- the dog plays in the park till you
  send them home, the mixer waits empty till you send it to load up.
- Jobs in any order: the bins -- trash (green) and recycling (blue) --
  whichever you like, and the dump whenever the truck has something on
  board (ticked off when it's all in); the letters and parcels any way
  round. Only what can't be: home before the park, the walls before the
  floor. Tap a job in the tray to do that one next: the camera goes to the
  helper who'll do it, its button bounces with that job's picture, and
  it's said; press the button to go. Several helpers can be out at once.
- A treat on the way, any time: tap the shop's sign (the apple) or the
  café's (the ice cream cone) and the helper you're driving -- or watching,
  or the nearest one out on a trip -- goes there (the arrow and dots show
  the way at once; driving, you take it there). At the door the driver
  hops out (the dog walker leaves the dog waiting), goes in, and comes
  out with an apple or an ice cream -- "A delicious apple!", "Yum! Ice
  cream!" -- hops back in, and goes on with the trip.
- Done, it says what you did: "You picked up all the garbage!", "You
  delivered all the mail!", "You took the dog for a walk!", "You built a
  house! Great job!". The cement mixer starts empty: "Time to build a
  house! Get some concrete for the foundation." -- then "Now build the
  foundation!", "Get more concrete for the walls!", "Now build the
  walls!", "Get wood and tiles for the roof!", "Now put the roof on!".
- Everything it says comes one line at a time, each after the last (and
  one that's waited too long, out of date by then, is left out). Left a moment with nothing going on, it says
  what to do next -- "The garbage needs to be picked up!", "Time to
  deliver the mail!", "Time to take the dog for a walk!" -- and that
  helper's button bounces, with a glowing ring, till it's tapped (a
  couple of seconds after each part of the day begins, then every ten
  seconds or so while nobody's busy, each helper in turn; never while
  one's out at work).
- The switch top right (your choice, kept) shows what a tap on it does:
  a steering wheel -- be the driver -- or the town from above -- back to
  watching them go. It's a real switch, in the middle of a job too: on,
  and you're straight into a driver's seat (the one you last got out of,
  if it's still got work; else the helper the town's suggesting, the one
  being watched, or any with a job); off, and you're back over the town,
  that helper stopping at the next corner till you're back. As the driver, tap a helper's button ("Let's go!") and the view
  drops into its seat: the same little town all round at street level, in
  perspective, from the cab of the garbage truck, the mail van or the
  cement mixer (a dashboard and a steering wheel that turns as you turn) --
  or walking the dog, the dog trotting ahead.
- Made for a three-year-old: a button you can press does something you
  can see and hear at once -- never later on -- and nothing is ever
  stuck. A button that would do nothing right now is faded, and does
  nothing: no queued presses. Three big buttons. Driving goes one block
  at a time, and the buttons work only while you're stopped -- mashing
  them as you go does nothing, and one press never takes you past the
  next corner. Stopped at the line, ◀ ▲ ▶ are the way through the corner
  -- the little yellow arrows along the road swing round through it
  (one set of arrows: a big one painted at the corner as well only said
  the same again), the wheel turns, and it's said ("Left!", "Straight on!",
  "Right!") -- and off you go (no holding), through it and up the next
  block, slowing down to stop at the line at the next corner ("Which
  way?"), the way to the job glowing. Stopped anywhere else (to begin
  with, after a job), ▲ takes you on to the corner.
  Walking the dog, you keep going (round the bends, the way to the job)
  and ◀ ▲ ▶ choose where the way next divides, the little arrows along
  the sidewalk going the way you chose. At the end of a street (the edge of town) you go
  round the turning circle by yourself, and it's said ("Turn around!") -- no reverse
  gear to get stuck in; the arrows fade till there's a corner ahead. At
  each job you stop: the arrows fade while it's done, then ▲ glows for
  the next. A finger dragged across the windshield looks round
  (the view follows the finger, like a panorama); let go and a moment
  later you look ahead again. A tap on the windshield honks.
- The rules hold you just the same, but you're told why, every time: at a
  red light a big traffic light shows up top and the town says "Red
  light. Stop!" (press anything and it says "Wait for green!"), and when
  it turns green you go on by yourself ("Green light go!"); someone on the
  crosswalk -- even one you've just turned toward -- and it's "Wait!
  Someone's crossing."; on foot, "Wait for the walking man!" ... "Walk!"
  -- and while you wait at the curb you look across the crosswalk at the
  walk signal on the far side, zoomed in a little.
  Jobs happen as you get there; at a house the mail van stops and the
  camera floats out of the cab to watch from the street just behind the
  van -- the postal worker taking it out of the back and up to the door
  -- and floats back in after.
  When the helper's jobs are done (or with the switch, top right)
  you're back over the town. Helpers start facing into town.
- Every part of the day done is a shower of confetti and a cheer -- the
  "yay" from the letter tracer (`sounds/yay.mp3`, the project owner's own)
  -- then what you did ("You built a house! Great job!"). No stars, no
  score.
- A step of a job done and more to do, it says what's next straight away
  (and, from above, that helper's button bounces): "Time to deliver the
  next package!", "Time to pick up the next garbage!", the mixer loaded
  -- "Time to drive to the construction site!" -- or the next kind of
  job ("Time to take the garbage to the dump!"). You're never left
  wondering what to do.
- Everything it says is in a child's voice: short clips recorded once (by
  `tools/benji-voice.py`, from the list in `voice.js`) and precached, so
  they play offline. A line without a clip -- or one that won't play -- is
  spoken by the phone's own voice instead.
- Its pictures -- the jobs in the tray and on the helpers' buttons, the
  shop signs, the time of day -- are emoji, but drawn from pictures that
  come with the game (Noto Emoji, the Android look; `emoji/`, fetched by
  `tools/benji-emoji.py`, precached), not the device's emoji font: some
  browsers have none (a Tesla's), and every picture came out blank.
- `town.js` (the town, routes along the streets, the days and their jobs),
  `clock.js` (the time of day, and the light and the sky with it),
  `streets.js` (the sidewalks and crosswalks, and the lights' timing) and
  `traffic.js` (lanes, stopping, queueing, waiting to cross) are all tested
  in Node -- a few minutes of busy traffic, checking every step that cars
  go on green, people start across on the walk signal, and nobody is ever
  on a crosswalk with a car; `steer.js` (driving yourself: the street or
  sidewalk on ahead, turning where asked, and which way to turn for the
  job -- tested by following the turn shown from everywhere to every door);
  `iso.js` (the 3D: the cameras -- from above, and the driver's eye, in
  perspective, cutting off what's behind it -- simple solids
  -- boxes, roofs, drums, balls -- flat-shaded and drawn back to front, and
  the town's things made of them), `draw.js` (the flat pictures that face
  you: lights, walk signals, bubbles, arrows), `play.js` (the screen and
  its camera).

## Car Jam

A top-down parking-lot puzzle. The lot is jammed full of cars and hedged in,
with only a few gates out to the ring road. Swipe a car (or tap it to drive
forwards) and it drives until it hits something; a car can only leave if it
lines up with a gate and its way there is clear, so you have to shuffle cars
out of each other's way to get everyone out. Clear every car to win.

- **Endless levels, generated on the device from a seed.** Level *n* is the
  same lot for everyone, and each level is a little tougher than the last,
  forever: the lot grows from a 3×3 tutorial to a packed 9×11 (the most that
  fits a phone), gates get scarcer (under a third of the edge is open on big
  lots), and every level from 3 on needs at least one car moved aside, rising
  to several. The generator searches harder for tough layouts the further you
  get.
- **Grannies** cross the street at the crosswalks. Cars wait for them (and they
  let you know about it).
- **Cones, trees, barriers and bollards** that never move, and **trucks** that
  take three spaces.
- **Stars** for matching par (the fewest possible moves, computed by the
  solver), plus **Undo**, **Restart** and a **Hint** button that always knows
  the best next move.

## Tap Maze

A board packed with non-crossing lines, each ending in an arrowhead. Tap an
arrow (or swipe it the way it points) and it slithers along its own line and
off the board, but only if nothing lies between its head and the edge. Tap a
blocked arrow and it bumps and bounces back, costing one of your three hearts.
Clear every arrow to win; hearts left are your stars.

- **Endless seeded mazes**: boards grow to 10×14, lines get longer and
  twistier, and the chain of arrows blocking other arrows gets deeper level by
  level. Every maze is checked to be clearable.
- **Hint** shows an arrow that is free to go; **Restart** resets the hearts.

## Breakout

The arcade classic. Pick **portrait** (8 columns) or **landscape** (14 columns,
like the 1976 original) before you play; once a game starts the screen
orientation is locked (Android Chrome: installed app, or fullscreen in a tab).
Where it can't be locked (iOS), turning the phone pauses the game until you
turn it back. Drag anywhere to move the paddle, tap to launch.

- Classic rules: rows score 1/3/5/7 from the bottom, the ball speeds up after
  4 and 12 hits and on reaching the orange and red rows, and the paddle
  shrinks once the ball breaks through to the back wall. Three balls, a bonus
  ball for each wall cleared.
- Endless walls: later walls are faster, vary their pattern, and add tough
  (multi-hit) and steel (unbreakable) bricks. Best score is kept per
  orientation.
- Square-wave sound effects for wall bounces, the paddle, and bricks (pitch
  rises with the row).

## Lunar Lander

Lift off from the launch pad, fly over the mountains and set down gently on
the base before the fuel runs out. Hold **THRUST** for the main engine and the
two rotate buttons for the side thrusters (arrow keys / WASD / space work too).

- Realistic momentum and rotational inertia under lunar gravity (1.62 m/s²):
  the side thrusters change the spin rate, so you counter-fire to stop.
  Equal bursts left and right cancel exactly. The side thrusters push at
  13°/s² -- the same for you and every autopilot -- so a quick
  tenth-of-a-second tap is a touch of about 1.3°/s, and a second's hold
  13°/s. With assist off, only a slow spin (under 2°/s) left alone ebbs
  away, at 0.5°/s², to a stop: a tap's nudge coasts to rest, since nulling
  a spin that small by hand is next to impossible. A spin of 2°/s or more
  is all yours -- it keeps going till you counter it. (History: at first
  26°/s², with slow spins under 1.5°/s halving every second; then a
  progressive button for you alone, dropped -- same controls for
  everyone; then 5°/s² with every spin ebbing, which felt sluggish and
  made fast spins die away by themselves.) The autopilots steer gently
  (they lean less and turn ahead of time). The spin rate shows in tenths when it's
  slow. The main engine gets punchier as fuel burns off.
- The camera follows the lander and zooms in as it gets close to anything
  -- the ground below, or the walls of a shaft, a cave or a tunnel, or rock
  overhead (the nearest surface in any direction) -- so the gap you're
  judging is always big on screen, in landscape too. Down among rock the
  far hills, the sky and the Earth fade out: seen through a shaft the hills
  would look like ground just below. The ground and any rock are filled as
  one shape through the terrain's own points (no seams where they meet, no
  shimmer as the view moves); craters lie only on gentle slopes, clipped
  to the ground.
- Green-phosphor instrument panel, laid out like the Apollo lunar module's:
  RANGE to the base, PRPLNT QTY (propellant, a bar) and the mission TIME
  as readouts; the attitude ball (red past 10°) with the lean and spin rate;
  the cross-pointer, its needles moving with the speed sideways and up or
  down (on a scale finer near zero), to be landed with the cross inside its
  dotted box; the ALT and RATE tapemeters, scales sliding past fixed
  pointers (altitude above the base, finer below 100 m; vertical speed,
  red past the 3 m/s safe touchdown); and caution lights -- DES QTY (low
  propellant), TERRAIN (high ground between you and the base), CONTACT
  (the probes under the feet touching: within 1.7 m) and ASSIST.
- Scored on touchdown speed, drift, tilt, centring and fuel left. Too hard,
  too fast sideways, too tilted, or a hull strike: fireball and wreckage.
- **ASSIST** (on to start) springs the lander back upright when you let go
  and damps sideways drift. A landing flown with it on at any point is
  marked with a little **A** on the mission grid (and said so on the score
  card) until the mission's been landed with it off: the stars count
  either way, the A says how they were earned.
- Scenery from Apollo 8's *Earthrise* photo: the Earth hangs over the far
  lunar horizon, and the ground you fly over is the photo's surface.
- Endless missions: every one is test-flown by an autopilot when generated,
  so it is always possible; fuel is what it needed plus a margin that shrinks
  from 2× to 1.25×, while mountains rise and the base narrows. (That careful
  pilot flies slowly: its fuel is what a careful player needs.) From 11,
  caves, tunnels and shafts in turn, with an open course between; from 27
  also the switchback (down a shaft, along a gallery, down a second shaft
  and back under the gallery to the base) and the zigzag tunnel (climbing
  and diving), as the caves and tunnels get lower and the shafts narrower.
- **Apollo 11** (a card above the missions, open to everyone): the first
  landing, down from orbit (`apollo.js`). Powered descent starts 15 km up at
  1,690 m/s; the guidance computer flies it, time sped up (16×, the TIME
  button), through P63 to High Gate (2 km, 140 m/s) and P64 to Low Gate
  (150 m) -- aiming, as Eagle's did, into West crater and its boulders. You
  choose where to take over (Low Gate like Armstrong, High Gate, or the
  whole descent), and can take over any time by touching a control; then
  it's P66, and you land anywhere flat and clear. Over flat ground the
  Moon's curve is a lift of vx²/R, which balances gravity at orbital speed;
  the engine is punchier than the missions' (as Eagle's was). The program
  alarms (1202, 1201), the gates, "60 seconds" / "30 seconds" (of fuel,
  hovering), "Contact light" and Aldrin-style altitude calls come up as
  messages -- the key ones in the real voices, from NASA's recordings; ALT reads the radar altitude, RANGE the distance to where Eagle
  landed. Here ASSIST is the LM's attitude hold: a turn button turns at a
  steady 20°/s and the lean holds when you let go. Scored like a mission,
  fuel counting full at a minute's hover; the card compares your fuel with
  Eagle's (about 25 s). Best stars per start are kept.
- The fly-over before each mission marks the highest peak on the way with
  its height as ALT will read it (above the base).
- The route shown before each mission and on the score card, and flown for
  **Show me**, is the autopilot's fastest landing (`pilot.js`): a smooth
  curve from pad to base -- over everything with room to spare, or through
  the cave, tunnel or shaft -- curving into a straight drop onto the base;
  the fastest speed along it the engine allows at each point (speeding up,
  slowing down and bending the flight against gravity, leaning at most 40°);
  the curve reshaped a point at a time for the quickest flight. A pilot
  follows it, turning ahead of time (turning is slow) and pulsing the
  engine; the boldest plan that lands wins, flown exactly the same in Show me.
- The main engine gives a light rumble you can feel (on phones that
  vibrate), as well as its sound.

## Night Driver

The 1976 Atari arcade racer: at night, all you see of the road is the white
posts along each side. Your left thumb drags the steering wheel and your right
thumb holds **GAS** and **BRAKE**. Both work at once (multi-touch); on a
keyboard, use the arrows or WASD.

- Seven-segment LED score, time and speed (mph). The clock runs down; every
  3 km adds time, a little less each time.
- Bends tighten the further you go, so the sharpest ones need the brake. Hit a
  post and you stop and lose time.
- After the opening stretch the road starts to fork. A green overhead sign
  says where each branch goes (read it while you can), in jokes and
  riddles: *FREE EGGS → take the EGGS-IT*, *EXIT 404: road not found*, *What
  has a bed but never sleeps?* One branch ends in a hazard, drawn
  realistically: a brick wall, a road on fire, a bridge that's out, the Grand
  Canyon (you fall in), a boiling volcano (you fall in), or a road washed
  away. Brake to a stop in time and you're sent back to the right road.
- The drawbridge is a gamble: both leaves are up, and at 70 mph or more you
  jump the river for +1000. Any slower and you're swimming.
- It starts out looking like the 1976 screen (big posts, steep arcade
  perspective) and eases into ordinary perspective before the first sign.
- No 3D engine: it's a hand-written perspective projection on a 2D canvas,
  with particle flames, smoke and embers, and short animated falls.

## Water Lab

A water-pouring puzzle in a closed system: beakers of different sizes and
shapes on a lab bench, some water, no tap and no drain. Drag a beaker onto
another (or tap one, then the other) to pour: it tips over and pours until
it's empty or the other is full. Measure the amount asked for: Professor
Fizz, the lab's host (salt-and-pepper hair, aviator glasses, moustache),
tells you what he needs and reacts as you go.

- Glassware of different shapes (graduated cylinder, beaker, Erlenmeyer and
  round-bottomed flasks, bottle, conical glass). Each is round in cross
  section, so the water level and the graduation marks follow real volume:
  marks crowd together in a wide bulb and spread out up a narrow neck. The
  number under each beaker says how much is in it.
- Goals: "I need exactly 4 ml of water" (in any beaker) to begin with; from
  level 7, every third level is an exact split (4 ml, 4 ml, empty), with gold
  lines on the beakers that must hold those amounts.
- Endless levels from a seed. Each is explored by breadth-first search over
  its states (water is conserved, so states lie on a plane), which proves it
  solvable and finds the fewest pours possible; harder levels have longer
  shortest solutions, or more beakers. Hint shows the next pour of a
  shortest solution from wherever you are.
- **Map** (beside Hint, and on the end-of-level card): the whole solution
  space in a pop-up -- every state the water can reach from the start, and
  every pour between them. With three beakers the total never changes, so
  a state (a, b, c) is a point in a plane, a·U₀ + b·U₁ + c·U₂ (unit
  vectors 120° apart), and a pour of t ml from beaker i to j moves it
  t·(Uⱼ − Uᵢ): one of just six directions, those of a hexagonal lattice.
  So every pour is a straight line along a lattice axis, as long as the
  amount poured (a compass shows which direction is which pour), and the
  states lie round the edge of the parallelogram the beakers allow (after
  any pour a beaker is empty or full); faint dots fill in the lattice
  points you can't reach. Every pour between reachable states is drawn,
  so the lattice is cross-connected all through, not just a tree out from
  the start. With four beakers the same idea, with unit vectors to a
  tetrahedron's corners, puts the states in a 3D lattice (stacked
  tetrahedra and octahedra), each pour along one of 12 directions --
  drawn in perspective-free 3D that you turn round with a finger (nearer
  states bigger and brighter); with five, the 4D lattice is shown through
  five vectors in 3D. Marked: the start, where you are now, the states that solve it
  (gold), your pours so far (blue) and the shortest way on (dashed gold).
  Drag to look round (or, in 3D, to turn it), pinch or the wheel to zoom,
  tap a state to see its volumes and how far it is from the start and
  from solving.

## Tangram

The classic Chinese puzzle: the seven pieces cut from a square -- two large
triangles, a medium one, two small ones, a square and a parallelogram --
and a figure in solid silhouette to make with all seven, no overlapping.

- Twelve figures, simple to hard: a house, a sailboat, a rocket, a cat, a
  rabbit, a swan, a rectangle, a runner, then the convex shapes -- the
  parallelogram, the trapezoid, the triangle -- and last the square the
  pieces came from. Pictures come first because their parts give the
  pieces away (a roof is two large triangles); the plain convex shapes
  give nothing away, and the square is famously the hard one.
- Every figure is stored as one way of making it (each piece's turn, flip
  and place), in games/tangram/figures.js -- generated by
  tools/tangram-figures.mjs, where the figures are designed: each as an
  outline, which the solver (games/tangram/solver.js) finds a way to make,
  or as the seven pieces' corners, checked to be the real pieces and not
  overlapping. The solver fills the topmost-leftmost corner of what's left
  with each piece in each of its turns, so it handles figures that mix
  pieces at 45° to each other -- the cat's head is a square on its corner
  over a body of upright triangles. To add a figure: add its design there,
  look at it with `--sheet`, and run the tool; a test fails if figures.js
  is out of date.
- Drag a piece to move it; tap it to turn it 45° (clockwise). Flip turns
  the parallelogram over -- the one piece whose mirror image is different
  (it says so on the first figure that needs it). The pieces start on a
  mat beside the figure, laid out to make them as big as the screen
  allows.
- A piece dropped near a corner snaps onto it: a corner of the figure,
  of another piece, or one where pieces meet in the stored solution (so a
  piece put about right lands exactly right). A click when a piece lands
  where the stored solution has it, a softer sound otherwise.
- Done when the pieces cover the silhouette (checked at points spread over
  it): they have its area between them, so covering it means nothing
  sticks out -- and any other way of making the figure counts too.
- Hint puts one more piece in its place (the large ones first), moving any
  piece in the way back to the mat. Three stars without a hint, two for
  one or two, one otherwise.

## Elevator Operator

You run the lifts for a whole working day -- 7 AM to 7:30 PM, with an
analog clock, the sun rising and crossing the sky and the city going dark at
night -- in an office building: parking below the street, the lobby at
street level, a restaurant on the 2nd floor, offices, a health club on the
top storey and a helipad on the roof. It's a career told a day at a time:
three days at each building, with more people every day. Maple Street
Offices (6 storeys, about five minutes a day; on the first day just one
lift and 6 people, then a second lift and 12), then Riverside House (10
storeys), Harbor Plaza (15, two parking levels) and The Empire (20, crowned
like the Empire State Building), each day a little longer as the buildings
grow: about 5, 6, 7½ and 10 minutes. From level 13 you run Parkview (the
apartments) and Commerce Tower (the offices) across the street from each
other, two lifts each, with more residents and workers every day and days
growing from 10 minutes to 15 at the hardest levels. Whenever the screen
is at rest -- nobody waiting or walking, the lifts empty and parked -- the
game eases up to five times as fast (▶▶ by the clock), and back down before
the next person sets off. Banners mark the day's moments (the doors open, the morning rush, lunchtime, home time,
nightfall). Played upright on a phone (either way on a tablet), to lift
music. On a big screen the building is as tall as it can be and no wider
than it needs to be, with the rest of the city round it -- just scenery,
windows lighting up and going dark through the day, and someone passing
behind a lit window now and then.

- **Tap a floor in a lift's shaft** to send it there. Tap more floors to
  line up to 4 stops (numbered in its shaft); it goes to them in order. A
  fifth tap gets a buzz. A lift you haven't sent anywhere waits with its
  doors open. At each stop it goes on only once everyone for that floor is
  out and everyone waiting there is in -- nobody is ever carried past their
  floor.
- Or **swipe a lift up or down** its shaft: it goes straight to the first
  floor that way where someone is waiting for a lift or a rider wants to
  get off -- the first it can still stop at, if it's on the move -- instead
  of any stops lined up. Nobody that way: a buzz. (Little ones love it.)
- When a lift stops, anyone for that floor walks out (one at a time), then
  everyone waiting who's going its way walks in (nobody gets in with people
  going the other way; an empty lift goes the way the first one in wants),
  up to 6 -- shown side by side, the same size as
  everyone on the floors (the lifts are drawn wide enough). People walk up
  to the lifts, press the button (it lights), and only then walk into a lift
  standing there, into their place in the car (and out the same way). On a
  phone the twin towers are one above the other. Each rider's floor is
  marked in that lift's shaft by a small arrow in the colour of their shirt,
  in the column where they stand. The call buttons light green for up, red
  for down.
- Every level is a different day: the first at each building an ordinary
  one, then each with a twist of its own -- rain (everyone drives, and
  lunches in), a traffic jam (all late at once), free pizza at noon, review
  week (meetings everywhere), a lunchtime fitness class, an all-hands
  meeting on the top floor, Friday (long lunches out, home by four), a trade
  fair (helicopters), launch day (working late), an early start. And each
  day the building is busy in different places: tenants of different sizes
  (some floors busy, some quiet, now and then one nearly empty) and one
  floor where most of the day's meetings are. A level is always the same
  day, with the same people. A bar at the top fills as they
  get where they're going.
- The day is made of people, each with their own day: an office worker
  arrives in the morning rush (around 8:30) -- walking in off the street,
  driving down into the garage, or now and then by helicopter -- may go to a
  meeting on another floor, goes to lunch around 12:30 (out to the street,
  down to the restaurant or up to the gym, back half an hour or so later),
  and leaves around 5:30, some by way of the gym. Each keeps their looks all
  day, and nobody starts a trip before finishing the last. The peaks come
  out like the surveys of modern office buildings (Peters Research): the
  morning rush nearly all arrivals (surveys: about 85%), lunch in and out.
- Two towers: at dawn every resident is asleep in the apartments; around 8
  they all leave -- most across the street to work in the offices (walking
  lobby to lobby, driving garage to garage, or flying roof to roof), the rest
  into town -- and come home in the evening, so the apartments end the day
  full.
- True occupancy: the only ways in or out of a building are its lobby,
  garage and roof; nobody ever sets off from a floor with nobody on it, and
  each floor shows how many people are on it.
- People are little 8-bit figures who walk out of their offices, press the
  call button by the lifts (it lights up: ▲ green, ▼ red) and queue; a "…" bubble
  means they've waited 20 s, a red "!" 40 s.
- At the end: a histogram of everyone's trip times (from pressing the button
  to getting out), yours against the computer's, the average and median, and
  the score: the RMS (root mean square) trip -- square every trip, average,
  take the square root, so a long wait counts for much more than a short
  one -- the computer dispatcher's over yours, with exactly the same people.
  The best possible schedule can't be computed in any reasonable time, so the
  yardstick is the "collective control" used by real lift groups: each lift
  keeps going its way, stopping where its riders want to get off and where
  people are waiting that the other lift isn't already heading for, and
  turns to its next job if the other lift gets there first. Idle lifts wait
  where the next calls will likely come from at that time of day -- the
  lobby while people are arriving, up among them when they're about to
  leave (offices at lunch and in the evening, homes in the morning). It's
  tried a few ways (with and without the staging, or assigning each call to
  whichever lift would get there soonest) and the best taken. You can watch
  it run your day.
- The music is synthesised: a bossa nova in C on electric
  piano, bass, vibraphone and shaker (the ♪ button turns it off).

## Morse Rain

Learn Morse code by ear. A cloud of Scrabble-like letter tiles drifts about
the screen; you hear the code for one of them -- a 600 Hz tone, always keyed
at 20 words a minute, so you learn each character as a sound -- again and
again until you find it. No hurry: through the lessons it comes round at
5 words a minute (every 2.4 seconds); after them, each review level a word
a minute quicker, up to 15 (every 0.8 seconds) -- any faster and there's no
time to find the tile in the cloud. Review levels show their speed.

- **Tap a tile with the letter you heard** and it's gone; then you hear the
  next. Clear the screen to win.
- Tap the wrong letter and a copy of the right one floats in, sounding
  again. If the cloud grows to twice its size, the level's over. Stars for
  how many you found without a wrong tap -- and, a little (a quarter of a
  wrong tap each), how many you only found after hearing them more than
  once, whether repeated or asked for again.
- The lessons: E I A N T to start, then a couple of new characters each
  level by how long their codes are (the rest of the short letters, the
  four-symbol ones), with reviews, then numbers and punctuation (. , ? /);
  after that, reviews of the lot with bigger, livelier clouds. The new ones
  are played half the time; before each lesson, tap one to hear it.
- **Letters to work on**, listening and sending apart. Each keeps a
  trouble weight for every character. Listening: a point each time its code
  sounded again before you found it (repeated, or asked for), three for each
  wrong letter tapped while it was the one to find. Sending: three when its
  tile reached the ground, one when you only shot it down low (the bottom
  quarter). After every ordinary game, won or lost, all the weights are
  multiplied by 0.9 and that game's points added, so older games fade (ten
  games on, a third) and the list follows you. Practice rounds don't count
  at all: they only drill the hardest letters, and counting them would keep
  those at the top. The screen (from each level page, which shows the top
  three) ranks them, marks the hardest seven, plays any you tap, and has
  your totals. **Practise** starts a level of just those seven, at the pace
  of your furthest level; no stars, no unlocking.
- All by ear: the dots and dashes are never shown (learning them printed
  only gets in the way of hearing them), so it needs the sound on.
- **Two sets of lessons, each with its own levels and stars, chosen by
  tabs on the level page: Listen (above) and Send.**
- **Sending**, Missile Command style: tiles drift down the screen (swaying
  a little). Tap anywhere to key -- a short tap a dit, a long one a dah --
  and you hear only your own sidetone. A pause ends the letter, and the
  cannon at the bottom fires a homing shot at the lowest tile with that
  letter, so the urgent ones come first (any can be hit). Key a letter
  that isn't there and the shot flies off across the screen carrying it
  (and it floats up by the cannon); key something that isn't a character
  at all and out pops a dud, which drops straight to the ground -- splat
  -- with a red ? by the cannon. A tile reaching the ground costs one of
  three lives. Stars by lives left (and not too much keyed at nothing).
- Timing is in units: a dit is one unit on, a dah three; one off between
  the parts of a letter, three between letters.
- Key a letter (of two or more parts) with excellent timing -- every dit
  and every pause inside it within about 15% of one unit, every dah of
  three, at your own speed -- and "Excellent timing!" fires two shots, at
  the two lowest tiles of that letter. The board keys anywhere (the
  header's buttons and the cards don't), with a KEY pad under the cannon
  to aim for.
- The rain comes at a sending speed, in words a minute (five letters a
  word, about five tiles on the screen at any speed): 5 wpm on the first
  level, a little quicker each level after (to 12). There are always at
  least three tiles to aim at while more are to come: clear them and the
  next drop in at once (placed away from the others near the top). It
  speeds up only when you're well ahead: a shot that leaves fewer than
  three (not counting those already shot at), all in the top half, makes
  it 10% faster (easing in, never past 20 wpm). A shot low (the bottom
  quarter) eases it back a little, and a life lost by a quarter (never
  below 5). The speed shows by the lives (with a rising arrow while it's
  climbing), and the top speed on the score card.
- Each level's tile shows your best effective speed there: letters keyed
  right a minute (five to a word), from the first tile in to the last
  letter sent -- so misses and dawdling count against it. The score card
  shows it too, and whether it's a new best.
- The keyer reads you by your own rhythm, not a fixed speed: it learns your
  dit and dah from your last 16 presses (where their lengths jump from
  short to long; or, all of a kind, whichever they're nearer), starting
  from about 15 words a minute, and remembers your speed between levels.
  As it learns, it re-reads the letter so far. It learns your pauses
  inside a letter too (only those short enough to be one -- under two and
  a half units by your presses): tapping on glass they're often longer
  than your dits. A pause twice that ends a letter -- halfway, keyed
  perfectly, between the one unit inside a letter and the three between
  letters -- so letters keyed one straight after another, properly spaced,
  each fire on their own. It starts generous (a letter ends after 0.24 s),
  for a beginner's pauses, and remembers both between levels. (A letter's ended by the next
  press too, if the screen hasn't caught up yet.) The lessons are the same
  as listening's.

## 15

The sliding puzzle. Tap a tile in line with the gap and it slides in, with
any tiles between; every tile moved counts as a move.

- **Exactly one solution, always solvable.** Every level is made from a
  seed. Small boards (up to 3x3) start an exact number of moves from
  solved, picked from a table of every position; bigger ones a number of
  random moves back from solved, or a full shuffle. Half of all
  arrangements can't be solved (the parity rule), and none of these is one.
  Tiles show numbers, a picture or a sequence (js/lib/patterns.js), and no
  two tiles of a level look alike: pictures are checked for it by tests
  (games/fifteen/solver.js, test/patterns.test.mjs).
- **The levels are difficulty only**: a board size (shown under each level
  number) and how scrambled -- 2x3, 3x3, 3x4, then 4x4, deeper each time,
  then 4x4s fully shuffled.
- **The tiles are the player's choice, for any level** -- a strip of
  previews on the level page, or the Tiles button mid-game (the board stays
  as it is): numbers; pictures (gradient, colour wheel, spiral, stained
  glass, topographic map, landscape -- drawn from the level's seed); sequences
  (a clock, the moon -- northern hemisphere, unlabelled, its phases evenly
  spaced by how much is lit, so the shadow's edge moves the same each frame
  even near full -- a plant growing, the sun across the sky, a glass of
  water filling); or a photo of your own (saved on the device, shared with
  Jigsaw, cropped to the board). "Numbers in the corner" puts little
  numbers on any of them. Pictures and photos are checked as they're cut
  (the same test as the pattern library's): if any two tiles look alike,
  they're numbered anyway, so there's always one solution.
- **The walk.** The game knows, after every move, exactly how far the board
  is from solved: a table of every position for small boards; IDA* with
  additive 5-5-5 pattern databases (and the board's mirror across the
  diagonal) for 3x4 and 4x4. The 4x4 databases ship ready-made
  (games/fifteen/tables-4x4.bin.gz, 544 KB; tools/build-fifteen-tables.mjs)
  since building them on a phone takes about 20 seconds. Every move changes
  the distance by exactly one, so the game keeps a best line as you play
  and only searches (one search, no deeper than one less) when you leave
  it; this runs in a worker, under a millisecond a move.
- **The score card** draws the walk: distance from solved after every move,
  down steps green and up (wrong-way) steps red, against a dashed best
  line. Moves = best + 2 x wrong-way moves. It names your longest climb the
  wrong way and your perfect finish. Stars: three for wrong-way moves at
  most a fifth of the best, two for at most as many as the best; a hint
  (the tile of a best next move glows) caps it at two.
- Hold Peek to see the picture or sequence solved. Solving it fills the gap:
  with the picture's missing corner, or a tile with a star.

## Trial Bike

A side-on trials bike over rough country, in the line of *Trials* and
*Elastomania*: there's nothing on the course but ground shaped against you,
and the whole game is in handling the bike. Your right thumb holds **GAS**
or **BRAKE**, your left drags the rider **back** (nose up) or **forward**
(nose down); both work at once, as in Night Driver. Arrows or WASD on a
keyboard.

- **One rigid body, two tyres.** The bike and rider are a single body with
  two wheels fixed to it; each tyre pushes back where it sinks into the
  ground (a stiff, damped spring, which is also the suspension) and grips
  along it up to a friction limit. The rear wheel drives, both brake, and a
  lean is a torque on the body -- in the air it turns the bike, on the
  ground it shifts weight between the wheels. The front lifts under hard
  throttle by itself, because the drive pushes at the ground, below the
  centre of mass. Nothing is scripted: a wheelie, a loop, an endo and a
  nose-first landing all fall out of the same few forces.
- **Crashes.** The rider's helmet touching the ground is a crash, as is
  falling out of the world, and so is a bad landing: coming down on the
  front wheel pitched more than 20° nose-down into the ground at over 7 m/s
  (about a 2.5 m fall), or on either wheel at over 11 m/s (about 6 m) --
  and a little less nose-down than that, the helmet reaches the ground
  first anyway. So a drop has to be landed on the back wheel or flat, and a
  cliff on both. Down in a pit below its lips is a crash too.
  Anything else -- a stall against a ledge, a nose-wheelie -- is yours to
  recover from. The bike tumbles for a moment, then the first touch puts
  you back on the last flag with the clock still running -- and where the
  wreck slides counts: past a flag, you go again from that one; over the
  line, you've finished, crash and all. Stuck with nowhere to go, the ↶
  button does the same at the price of a crash.
- **Endless courses from a seed**, and every one test-ridden. Course *n* is
  built from its seed (and re-rolled from the same seed, up to a dozen
  times, until the computer rider can finish it): a slow rise and fall of
  the land, with obstacles along it in a random order drawn from the kinds
  that course allows.
  Everything the bike can do is met early -- course 1 is hills and one
  small jump, then a log and a long climb on course 2, a drop-off on 3, a
  ledge up and down and a cliff on 4 and a gap on 5 -- and from there they
  grow in size and number and, more and more often, come one straight after
  another (a drop at the top of a climb, a cliff off the end of a jump).
  Hills and climbs are never steeper than about 35°, there's a run-up
  before every gap and the land holds level across it, and where a jump, a
  drop or a cliff comes down there's open ground -- or the next part of a
  combination, a further fall or the next kicker, never a log or a ledge.
  Two of the kinds are jumps with a reason: a **launch** (from course 5) is
  a kicker straight into a pit, so the speed is the whole question, and a
  **step-down** (from course 3) is a low roller at the brow of a long bank,
  where the faster line comes down on the bank and the timid one on the
  level past the roller. (A landing is measured straight into the ground,
  so a fast one on a bank is soft.) The far side of every pit is a steep
  bank, and a bike that comes up short slides down into it -- a fall, not
  a stall. From course 3, each course has a
  **set piece** past the middle, with a flag just before it and more
  course after: three kickers in a row, one long wall of a climb, a climb
  to a crest and a cliff straight off it, three ledges up and a cliff down
  the lot, or the big gap -- taken in turn from those the course's
  obstacles allow, never the same one two courses running, so the course
  has a moment the rest builds to. The computer rider rides each
  course at three paces as it is generated; one it can't finish is
  re-rolled, and its best time, rounded up to the second, is **par**.
- **Stars** against par and your crashes: three for beating par clean, two
  for within 1.5× par with at most one crash, one for getting there. The
  course tile shows your best time.
- **Flips.** Turn the bike over in the air (lean hard off a jump) and come
  down on the wheels -- either wheel first, three quarters of a turn or
  more -- and each turn takes two seconds off your clock: the only way to
  beat the computer rider's time by much, since it never flips. A turn that
  ends on the helmet is just a crash. One landed gets
  the big celebration: a fanfare, the banner swelling (with DOUBLE! or
  TRIPLE! under it for more), a flare going up from behind the finish for
  every turn, and the crowd there forty strong, arms up and jumping, for
  the rest of the ride.
- Every tenth course, someone grazes on a hilltop who doesn't mind the
  bikes, so long as they go over.
- **The computer rider** reads the ground ahead of the rear wheel -- the
  first wall (a rise too sheer to roll over), the first edge (ground falling
  away) and, if that edge is a pit, how wide -- and holds the bike's pitch to
  a target: the slope under it, nose-up for a wheelie sized to the wall,
  nose-up off an edge, and in the air the slope where it will come down. It
  carries the speed a gap needs and eases off everywhere else. **SHOW ME**,
  offered after a crash, runs it on the course, at 1×, 2× or 4×.
- **GHOST** (on from course 3, until you say otherwise) rides the computer's par run beside you: a
  faint blue bike and rider, behind yours, at the point the par ride had
  reached at your time on the clock (so it waits on the start line until
  you touch the gas, and a flip doesn't move it -- the bonus shows at the
  finish), with a hollow amber ring for it on the course line in the
  instruments. With it on, the finish card says who won and by how much,
  and beating it is the headline.
- **Landscape plays best** (the course is wide) but it works upright too,
  with the ground lower to leave room for the jumps. Not locked: the camera
  keeps the bike a third of the way across so you see what's coming.
- Sound is the shared motor loop, pitched to the speed, with a bump on a
  hard landing, the checkpoint chime at each flag, a fanfare and the
  flares' whoosh and crackle for a flip, and one other, from the hilltop.

## Crystal Cave

A bubble shooter in a cave, in the line of *Puzzle Bobble*: a honeycomb
roof of coloured crystals hangs from the top, and you fire crystals up into
it from a catapult at the bottom. Drag anywhere to aim -- a dotted guide
shows the shot as far as its first bounce off a wall, and where it will
land if that's sooner -- and let go to fire; tap the loaded crystal to swap
it for the next. Arrows, space and down on a keyboard. Upright.

- **The rules.** A shot bounces off the side walls, stops at the first
  crystal it touches (or the roof) and snaps into the nearest empty cell.
  Three or more of a colour touching shatter, and whatever is no longer
  joined to the roof drops into the mole's cart. Every few shots the roof
  creeps down a row; a crystal crossing the line at the bottom is a
  cave-in, and you go again from the start. The crystal you're handed is
  always a colour still on the roof (one waiting when its colour goes is
  drawn again). Clear the roof to win.
- **Levels from a seed**, and every one proved. Level *n* is a roof built
  from its seed in one of six shapes from level 3 (a slab, a V, stalactites,
  wings, pillars, an arch), its colours leaning on their neighbours' so there
  are pairs and small clumps to go for -- never more than four of a colour
  touching, so no roof falls at a touch -- and a seeded sequence of crystals
  to fire, so the same shots always meet the same crystals. The roof grows
  deeper (four rows to seven) and takes on more colours (three to five), grey
  **stone** that never matches and only drops when cut loose comes in from
  level 6, and the creep comes sooner (every ten shots, down to every five).
  Every tenth level the roof is a picture, hanging by its own top: a heart,
  a star, a smiley, a diamond, the mole himself.
- **The computer miner** plays every roof as it is generated: it tries an
  aim every two degrees across the arc, scores each shot by what it shatters
  and drops (and against adding to a low row), looks one shot ahead for its
  three best, and takes the best. A roof it can't clear, or clears in fewer
  shots than the level deserves (six, rising to eighteen by level 30) or
  more than twice that, is re-rolled from the same seed (up to sixteen
  tries; if none lands in that band, the nearest that clears is taken); its
  shot count is **par**, and its run is kept, so **SHOW ME** after a cave-in
  plays it back. (A roof none of sixteen tries can clear -- none of levels
  1-50 is -- would ship with a guessed par, no SHOW ME, and a word on screen.)
- **Stars** against par: three for clearing the roof in par or fewer shots,
  two within half as many again, one for clearing it. The level tile shows
  your fewest shots.
- **The cart pays.** Every eight crystals dropped -- dropped, not
  shattered: a shatter clears the roof, a drop fills the cart, so the shot
  that cuts a clump loose does both -- the cart is full and the crystal
  put up NEXT is a power-up (a drop big enough for two pays the second on
  the shot after), in turn: **BLAST** shatters itself and everything around
  it, **PRISM** matches any colour and joins every group around it that
  reaches three, **DRILL** stops at nothing and bores out everything on its
  way, off the walls and all, up to the roof. Each level's first payout is
  one further round, so all three come up. A power-up can be swapped like
  any crystal. The computer miner earns and uses them the same way, so par
  is fair. Each kind is a package: an entry in the engine's table (the
  engine traces the shot and the kind says what happens where it lands) and
  one in the view's table of looks -- a new kind is a new entry in each,
  not an edit to either.
- **Chambers.** The cave changes every five levels: a lamplit mine, an ice
  grotto, a lava vault, a mushroom hollow, a cenote under a shaft of
  daylight -- each its own palette, its own dressing on the walls and floor,
  and its own drift in the air. The middle of the screen stays quiet in all
  of them, so the shot and its guide read. Every tenth level from 15 the
  **lights are out**: the roof shows only in the mole's headlamp, a beam
  that follows your aim. (Par is the same; the computer miner needs no
  light.)
- A bat hangs from a ledge on the right wall, and yawns when you clear the
  roof. The mole jumps for joy when the cart pays and when the roof is
  cleared, and a cleared roof showers gems.
- Sound is the catapult's twang, a glassy shatter that grows with the group,
  a dull tick for a crystal that lands whole, the clink of each one into the
  cart, a rumble for the cave-in, a chime when the cart pays, and the shared
  fanfare for a roof cleared.

## Jigsaw

Turn your own photos into jigsaw puzzles. **Choose photo** opens the photo
picker and **Take photo** the camera; the picture is scaled to at most 2048 px
and saved on the device in IndexedDB (nothing is uploaded), so it's there for
future puzzles. Two built-in pictures are included too, and nine patterns
from the library 15 uses (js/lib/patterns.js) -- gradients, a colour
wheel, a spiral, stained glass, a topographic map, marble, a Truchet weave,
a landscape -- each a new one every time you pick it (its seed is kept with
the puzzle in progress, so it draws the same again when you come back).
Every piece has its own shape, so even the subtle gradient has one
solution.

- About 100 pieces by default (24 / 48 / 100 / 150 / 200), with the grid fitted
  to the photo so pieces are near-square, and classic tab-and-blank shapes.
- The picture fills as much of the screen as possible with a border on every
  side; loose pieces start scattered around it and turned every which way.
  Tap a piece to turn it a quarter; drag it near its spot, the right way up,
  and it snaps in. Pieces sit on an oak table, lit from the top left, and
  cast shadows on it.
- The picture stays hidden until the puzzle is done: hold the eye button to
  see it in a pop-up. Also: show edge pieces only, and scatter. The puzzle in
  progress is saved for later.
