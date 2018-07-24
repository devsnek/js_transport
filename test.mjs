import { pack, unpack } from './index';

const p = pack([
  10n,
  10,
  new Date('2015-01-01'),
  /a/,
  'awoo',
]);

console.log(p);

console.log(unpack(p));
