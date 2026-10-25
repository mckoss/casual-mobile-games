// Benji's Town: everything it says out loud. Each line is recorded in a
// child's voice by tools/benji-voice.py (into games/benji/voice/, precached
// with the rest, so it plays offline); a line not recorded yet is spoken by
// the phone's own voice instead.

export const LINES = [
  'Tap a truck!',
  'Tap a truck and drive it!',
  'Let’s go!',
  'Left!',
  'Right!',
  'Straight on!',
  'Turn around!',
  'Which way?',
  'Wait for green!',
  'Wait! Someone’s crossing.',
  'Wait for the car!',
  'Red light. Stop!',
  'Green light. Go!',
  'Wait for the walking man!',
  'Walk!',
  'Here’s your letter!',
  'A package for you!',
  'Yay! Great job!',
  'Good morning!',
  'Lunch time!',
  'Good evening!',
  'Goodnight!',
  'The garbage needs to be picked up!',
  'Time to take the garbage to the dump!',
  'Time to deliver the mail!',
  'Time to take the dog for a walk!',
  'Time to take the dog home!',
  'Time to build a house!',
  'Time to fill up the cement mixer!',
];

// The lines recorded so far. (Rewritten by tools/benji-voice.py.)
export const RECORDED = ['Tap a truck!', 'Tap a truck and drive it!', 'Let’s go!', 'Left!', 'Right!', 'Straight on!', 'Turn around!', 'Which way?', 'Wait for green!', 'Wait! Someone’s crossing.', 'Wait for the car!', 'Red light. Stop!', 'Green light. Go!', 'Wait for the walking man!', 'Walk!', 'Here’s your letter!', 'A package for you!', 'Yay! Great job!', 'Good morning!', 'Lunch time!', 'Good evening!', 'Goodnight!', 'The garbage needs to be picked up!', 'Time to take the garbage to the dump!', 'Time to deliver the mail!', 'Time to take the dog for a walk!', 'Time to take the dog home!', 'Time to build a house!', 'Time to fill up the cement mixer!'];

// A line's file name: 'Red light. Stop!' -> red-light-stop.
export const slug = (text) => text.toLowerCase().replace(/’/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Where a line's recording is, if it has one.
export const clipFor = (text) => (RECORDED.includes(text) ? new URL(`./voice/${slug(text)}.mp3`, import.meta.url).href : null);
