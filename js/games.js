// Registry of games in the arcade. To add a game, create games/<id>/index.js
// exporting mount(el, ctx, route) and add an entry here. The service worker
// precaches everything under games/ automatically (npm run build).
// credit (optional): { name, url } of whoever contributed the game, shown
// on its card and its level list.
export const GAMES = [
  {
    id: 'benji',
    title: 'Benji’s Town',
    blurb: 'For little ones: tap the garbage truck, the postal worker’s van, the dog walker and the cement mixer to send them off to work around town, from morning to night, day after day -- then be the driver yourself.',
    color: '#ffb703',
    load: () => import('../games/benji/index.js'),
    art: () => import('../games/benji/art.js'),
  },
  {
    id: 'car-jam',
    title: 'Car Jam',
    blurb: 'Swipe cars out of a jammed parking lot. Mind the grannies!',
    color: '#ff9f1c',
    load: () => import('../games/car-jam/index.js'),
    art: () => import('../games/car-jam/art.js'),
  },
  {
    id: 'tap-maze',
    title: 'Tap Maze',
    blurb: 'Tap arrows to send them flying off the board. Only the ones with a clear path can go!',
    color: '#7b5cff',
    load: () => import('../games/tap-maze/index.js'),
    art: () => import('../games/tap-maze/art.js'),
  },
  {
    id: 'breakout',
    title: 'Breakout',
    blurb: 'The arcade classic. Smash the wall, one bounce at a time — in portrait or landscape.',
    color: '#e5383b',
    load: () => import('../games/breakout/index.js'),
    art: () => import('../games/breakout/art.js'),
  },
  {
    id: 'lander',
    title: 'Lunar Lander',
    blurb: 'Fly over the mountains and set down gently on the base before the fuel runs out.',
    color: '#3dff7a',
    load: () => import('../games/lander/index.js'),
    art: () => import('../games/lander/art.js'),
  },
  {
    id: 'night-driver',
    title: 'Night Driver',
    blurb: 'The 1976 arcade racer: stay between the lights in the dark. Later, read the road signs — one way is a dead end.',
    color: '#ff3b2f',
    load: () => import('../games/night-driver/index.js'),
    art: () => import('../games/night-driver/art.js'),
  },
  {
    id: 'water',
    title: 'Water Lab',
    blurb: 'Pour water between beakers of different sizes and shapes to measure exactly the amount asked for.',
    color: '#4cc9f0',
    load: () => import('../games/water/index.js'),
    art: () => import('../games/water/art.js'),
  },
  {
    id: 'tangram',
    title: 'Tangram',
    blurb: 'The classic puzzle of seven pieces cut from a square: move, turn and flip them to make each shape in silhouette, from a house and a cat to a swan, and back to the square.',
    color: '#e76f51',
    load: () => import('../games/tangram/index.js'),
    art: () => import('../games/tangram/art.js'),
  },
  {
    id: 'elevator',
    title: 'Elevator Operator',
    blurb: 'Run the lifts through a whole working day, from a six-storey office block to twin towers: tap a floor to send a lift there and get everyone where they’re going. Can you beat the computer?',
    color: '#2a9d8f',
    load: () => import('../games/elevator/index.js'),
    art: () => import('../games/elevator/art.js'),
  },
  {
    id: 'morse',
    title: 'Morse Rain',
    blurb: 'Learn Morse code by ear: hear a letter’s code and tap it in the drifting cloud -- or key letters yourself and shoot them down.',
    color: '#2d6a4f',
    load: () => import('../games/morse/index.js'),
    art: () => import('../games/morse/art.js'),
  },
  {
    id: 'fifteen',
    title: '15',
    blurb: 'The sliding puzzle: put the tiles back in order -- numbers, pictures, clocks and moons, or your own photos. Then see a graph of every move you made against the best possible.',
    color: '#b5835a',
    load: () => import('../games/fifteen/index.js'),
    art: () => import('../games/fifteen/art.js'),
  },
  {
    id: 'trial-bike',
    title: 'Trial Bike',
    credit: { name: 'Garnett Callis', url: 'https://github.com/garnett-ui' },
    blurb: 'Ride a trials bike over hills, logs, ledges and gaps: gas, brake and lean. Beat the computer rider’s time without a crash.',
    color: '#e63946',
    load: () => import('../games/trial-bike/index.js'),
    art: () => import('../games/trial-bike/art.js'),
  },
  {
    id: 'crystal-cave',
    title: 'Crystal Cave',
    blurb: 'Fire crystals up into the roof of a cave: three of a colour shatter, and whatever they held up drops into your cart. Clear the roof before it creeps down to you.',
    color: '#b06bff',
    load: () => import('../games/crystal-cave/index.js'),
    art: () => import('../games/crystal-cave/art.js'),
  },
  {
    id: 'jigsaw',
    title: 'Jigsaw',
    blurb: 'Turn your own photos into jigsaw puzzles. About 100 pieces, or as many as you like.',
    color: '#4361ee',
    load: () => import('../games/jigsaw/index.js'),
    art: () => import('../games/jigsaw/art.js'),
  },
];

// The card after the games: a link to a form for suggesting the next one.
export const COMING_SOON = [
  { title: 'Suggest a game', blurb: 'More games are on the way. Which one would you like next? Tell me here.', emoji: '💡', href: 'https://forms.gle/c4VowgiYLaTZehYG7' },
];
