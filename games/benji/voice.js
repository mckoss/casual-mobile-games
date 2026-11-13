// Benji's Town: everything it says out loud. Each line is recorded in a
// child's voice by tools/benji-voice.py (into games/benji/voice/, precached
// with the rest, so it plays offline); a line not recorded yet is spoken by
// the phone's own voice instead.

export const LINES = [
  'Let’s go!',
  'Left!',
  'Right!',
  'Straight on!',
  'Turn around!',
  'Which way?',
  'Wait for green!',
  'Wait! Someone’s crossing.',
  'Wait for the car!',
  'Red light stop!',
  'Green light go!',
  'Wait for the walking man!',
  'Walk!',
  'Here’s your letter!',
  'A package for you!',
  'Good morning!',
  'Lunch time!',
  'Good evening!',
  'Goodnight!',
  'The garbage needs to be picked up!',
  'Time to take the garbage to the dump!',
  'Time to deliver the mail!',
  'Time to deliver the next letter!',
  'Time to deliver the next package!',
  'Time to pick up the next garbage!',
  'Time to pick up the next recycling!',
  'Time to drive to the construction site!',
  'Time to take the dog for a walk!',
  'Time to take the dog home!',
  'The recycling needs to be picked up!',
  'Time to build a house! Get some concrete for the foundation.',
  'Now build the foundation!',
  'Get more concrete for the walls!',
  'Now build the walls!',
  'Get wood and tiles for the roof!',
  'Now put the roof on!',
  'You picked up all the garbage! Great job!',
  'You delivered all the mail! Great job!',
  'You took the dog for a walk! Great job!',
  'You built a house! Great job!',
  'Fire! Call the fire engine!',
  'Time to put out the fire!',
  'You put out the fire, great job!',
  'Robber! Call the police!',
  'Time to catch the robber!',
  'You caught the robber!',
  'Time to take the robber to jail!',
  'You took the robber to jail! Great job!',
  'Yum! Ice cream!',
  'A delicious apple!',
  'The kids need a ride to school!',
  'Time to pick up the next kid!',
  'Hop on the bus!',
  'Time to take the kids to school!',
  'Have a great day at school!',
  'You took the kids to school! Great job!',
  'The money needs to go to the bank!',
  'Time to pick up more money!',
  'Here’s the money!',
  'Time to take the money to the bank!',
  'The money is safe in the bank!',
  'You took the money to the bank! Great job!',
  'Bank robber! Call the police!',
];

// The lines recorded so far. (Rewritten by tools/benji-voice.py.)
export const RECORDED = ['Let’s go!', 'Left!', 'Right!', 'Straight on!', 'Turn around!', 'Which way?', 'Wait for green!', 'Wait! Someone’s crossing.', 'Wait for the car!', 'Red light stop!', 'Green light go!', 'Wait for the walking man!', 'Walk!', 'Here’s your letter!', 'A package for you!', 'Good morning!', 'Lunch time!', 'Good evening!', 'Goodnight!', 'The garbage needs to be picked up!', 'Time to take the garbage to the dump!', 'Time to deliver the mail!', 'Time to deliver the next letter!', 'Time to deliver the next package!', 'Time to pick up the next garbage!', 'Time to pick up the next recycling!', 'Time to drive to the construction site!', 'Time to take the dog for a walk!', 'Time to take the dog home!', 'The recycling needs to be picked up!', 'Time to build a house! Get some concrete for the foundation.', 'Now build the foundation!', 'Get more concrete for the walls!', 'Now build the walls!', 'Get wood and tiles for the roof!', 'Now put the roof on!', 'You picked up all the garbage! Great job!', 'You delivered all the mail! Great job!', 'You took the dog for a walk! Great job!', 'You built a house! Great job!', 'Fire! Call the fire engine!', 'Time to put out the fire!', 'You put out the fire, great job!', 'Robber! Call the police!', 'Time to catch the robber!', 'You caught the robber!', 'Time to take the robber to jail!', 'You took the robber to jail! Great job!', 'Yum! Ice cream!', 'A delicious apple!', 'The kids need a ride to school!', 'Time to pick up the next kid!', 'Hop on the bus!', 'Time to take the kids to school!', 'Have a great day at school!', 'You took the kids to school! Great job!', 'The money needs to go to the bank!', 'Time to pick up more money!', 'Here’s the money!', 'Time to take the money to the bank!', 'The money is safe in the bank!', 'You took the money to the bank! Great job!', 'Bank robber! Call the police!'];

// A line's file name: 'Red light stop!' -> red-light-stop.
export const slug = (text) => text.toLowerCase().replace(/’/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Where a line's recording is, if it has one.
export const clipFor = (text) => (RECORDED.includes(text) ? new URL(`./voice/${slug(text)}.mp3`, import.meta.url).href : null);
