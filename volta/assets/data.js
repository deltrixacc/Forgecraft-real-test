/* ============================================================
   VOLTA - demo catalogue
   ------------------------------------------------------------
   SAMPLE DATA. Every price, rating, review count, review author
   and stock figure below is placeholder content for this demo
   build. In the live store these come from the Shopify Admin
   (products, metafields, and a reviews app).

   Three products, deliberately. The whole storefront is built
   around a range this size: grids take exactly three, and the
   comparison section exists because a shopper can hold the
   entire line in their head at once.
   ============================================================ */

/* Real product photography: one set per colourway, four locked camera angles.
   Files live in images/products/<handle>-<colour>-<angle>-<width>.webp */
const PHOTO_WIDTHS = [480, 720, 960, 1122];
const ANGLES = ['a', 'b', 'c', 'd'];
const ANGLE_LABELS = {
  a: 'three-quarter view',
  b: 'front view',
  c: 'open, showing the card slots',
  d: 'close detail of the stitched edge'
};

const photo = (handle, colour, angle, w) =>
  'images/products/' + handle + '-' + colour + '-' + angle + '-' + w + '.webp';
const photoSrcset = (handle, colour, angle) =>
  PHOTO_WIDTHS.map((w) => photo(handle, colour, angle, w) + ' ' + w + 'w').join(', ');

const COLOURS = {
  onyx: { name: 'Onyx', hex: '#17181a' },
  navy: { name: 'Navy', hex: '#232f45' }
};

const FINISHES = [
  { id: 'smooth',  name: 'Smooth',  note: 'Milled full-grain, matte' },
  { id: 'pebbled', name: 'Pebbled', note: 'Textured, hides marks' }
];

const PRODUCTS = [
  {
    handle: 'meridian-bifold',
    title: 'Meridian Bifold',
    tagline: 'Eight cards, folded notes, no bulk.',
    price: 98, compareAt: null,
    category: 'Bifolds',
    badge: 'Best seller',
    rating: 4.8, reviews: 126,
    colours: ['onyx', 'navy'],
    finishes: ['smooth', 'pebbled'],
    soldOut: [{ colour: 'navy', finish: 'pebbled' }],
    cards: 8, weight: 48, dims: '11.0 x 9.2 cm',
    notes: 'Full-width sleeve',
    coins: 'No',
    choose: 'You carry cards and notes every day and want one wallet for both.',
    features: ['Copper shield across both card walls', 'Eight card slots plus a full note sleeve', 'Skived edges, no bulk at the fold'],
    description: 'The Meridian is the wallet we build the rest of the range against. Two card walls, a full-width note sleeve, and a shield layer that runs edge to edge so a reader cannot find a way in from the side. Vegetable-tanned full-grain from a Tuscan tannery, cut and closed by hand.',
    care: 'Wipe with a dry cloth. Leather darkens with use, faster on Navy than on Onyx. Keep away from prolonged direct heat.',
    isNew: false
  },
  {
    handle: 'halden-cardholder',
    title: 'Halden Cardholder',
    tagline: 'The one that lives in a front pocket.',
    price: 62, compareAt: null,
    category: 'Cardholders',
    badge: null,
    rating: 4.9, reviews: 214,
    colours: ['onyx', 'navy'],
    finishes: ['smooth', 'pebbled'],
    soldOut: [],
    cards: 5, weight: 26, dims: '10.2 x 7.4 cm',
    notes: 'Folded, behind the cards',
    coins: 'No',
    choose: 'You carry five cards or fewer and want nothing in your back pocket.',
    features: ['Five slots, centre pull-tab', 'Shield on the outward face', 'One piece of leather, four seams'],
    description: 'Five cards and a folded note, nothing else. The centre pull-tab lifts the stack out in one movement instead of making you dig. Cut from a single piece so there is no lining to stretch or separate.',
    care: 'Wipe with a dry cloth. The pull-tab softens after a fortnight and stops springing back.',
    isNew: false
  },
  {
    handle: 'sever-zip-wallet',
    title: 'Sever Zip Wallet',
    tagline: 'Closes fully. Nothing works its way out.',
    price: 118, compareAt: 132,
    category: 'Zip wallets',
    badge: 'Reduced',
    rating: 4.7, reviews: 58,
    colours: ['onyx', 'navy'],
    finishes: ['smooth'],
    soldOut: [],
    cards: 10, weight: 92, dims: '12.4 x 9.8 cm',
    notes: 'Dedicated bay',
    coins: 'Yes, zipped bay',
    choose: 'You want coins, receipts and cards contained, with nothing falling out.',
    features: ['YKK Excella zip, brushed steel', 'Ten slots, coin bay, note bay', 'Shield wraps the full enclosure'],
    description: 'A zip changes what a wallet is for. Coins stay in, receipts stay in, and the shield wraps the whole enclosure rather than a single wall. Heavier than the Meridian on purpose, and it opens flat so you can see everything at once.',
    care: 'Run the zip dry. If it stiffens, a pencil along the teeth does more than any wax.',
    isNew: false
  }
];

/* Sample reviews. Live store: a Shopify reviews app such as Judge.me or Okendo. */
const REVIEWS = [
  { name: 'Jonas Weidner',    place: 'Leipzig',    rating: 5, product: 'Meridian Bifold',   date: '2026-06-14', text: 'Bought it after a card got skimmed on a tram. Fourteen months in, the leather has gone darker and the terminal at my office no longer picks anything up through it.' },
  { name: 'Marte Lindqvist',  place: 'Gothenburg', rating: 5, product: 'Halden Cardholder', date: '2026-07-02', text: 'I have gone through three cardholders in two years. This is the first where the pull-tab still springs back properly after a full winter in a coat pocket.' },
  { name: 'Pieter Haasnoot',  place: 'Utrecht',    rating: 4, product: 'Sever Zip Wallet',  date: '2026-05-28', text: 'Heavier than I expected and I am glad of it. The zip runs the same as it did in week one. Only wish it came in a smaller size.' },
  { name: 'Chiara Bertani',   place: 'Bologna',    rating: 5, product: 'Meridian Bifold',   date: '2026-07-19', text: 'The note sleeve takes a folded stack without the wallet gaping open, which is the thing every other bifold I owned got wrong.' },
  { name: 'Ana Ruiz Delgado', place: 'Valencia',   rating: 5, product: 'Halden Cardholder', date: '2026-06-30', text: 'Genuinely thin. It disappears in a front pocket, which is the only test I cared about, and the stitching has not shifted.' },
  { name: 'Tobias Ahlgren',   place: 'Aarhus',     rating: 4, product: 'Sever Zip Wallet',  date: '2026-04-11', text: 'Opens flat so I can see every slot at once. Took a week to stop feeling stiff, then it settled and has not changed since.' }
];

const FREE_SHIPPING_THRESHOLD = 80;
const FX = { code: 'EUR', symbol: '€' };

/* The gallery for one colourway: four locked angles shot in that exact hide.
   Shopify equivalent: variant.featured_media plus the product media list. */
function mediaFor(p, colour) {
  return ANGLES.map(function (angle) {
    return {
      src: photo(p.handle, colour, angle, 960),
      srcset: photoSrcset(p.handle, colour, angle),
      thumb: photo(p.handle, colour, angle, 480),
      full: photo(p.handle, colour, angle, 1122),
      alt: p.title + ' in ' + COLOURS[colour].name + ', ' + ANGLE_LABELS[angle]
    };
  });
}

const money = (n) => FX.symbol + n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const byHandle = (h) => PRODUCTS.find((p) => p.handle === h);
const totalReviews = () => PRODUCTS.reduce((s, p) => s + p.reviews, 0);
const averageRating = () =>
  PRODUCTS.reduce((s, p) => s + p.rating * p.reviews, 0) / totalReviews();
