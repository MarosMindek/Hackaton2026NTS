// guest-data.jsx — shared data for the guest app

const SCENARIOS = {
  resort: {
    id: 'resort',
    name: 'Linh Tran',
    salutation: 'Linh',
    room: 'Garden Suite 4127',
    pkg: 'All-Inclusive Wellness',
    pkgBadge: 'All-incl.',
    allergies: ['Peanut', 'Shellfish'],
    diet: ['Pescatarian'],
    family: true,
    accessibility: null,
    isExternal: false,
    payPerItem: false,
    booking: { table: 'A·12', time: '19:30', area: 'Lagoon Terrace', party: 4 },
  },
  external: {
    id: 'external',
    name: 'Sara Klein',
    salutation: 'Sara',
    room: 'Walk-in · external diner',
    pkg: 'Pay per item',
    pkgBadge: 'Pay per item',
    allergies: ['Gluten'],
    diet: [],
    family: false,
    accessibility: null,
    isExternal: true,
    payPerItem: true,
    booking: { table: 'A·14', time: '19:30', area: 'Lagoon Terrace', party: 2 },
  },
  assisted: {
    id: 'assisted',
    name: 'Mr. Hayashi',
    salutation: 'Mr. Hayashi',
    room: 'Wellness Suite 2208',
    pkg: 'Spa · Half-Board',
    pkgBadge: 'Half-board',
    allergies: [],
    diet: ['Low-sodium'],
    family: false,
    accessibility: { escort: true, tactileMenu: true, mobility: false },
    isExternal: false,
    payPerItem: false,
    booking: { table: 'B·22', time: '19:45', area: 'Indoor', party: 2 },
  },
};

const MENU = [
  { id:'s1', cat:'starters', name:'Lemongrass & Coconut Soup', desc:'Galangal, kaffir lime, market mushrooms.', price:14, dietary:['v','gf','low-sodium'], allergens:[], tag:"Chef's pick",
    img:'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80' },
  { id:'s2', cat:'starters', name:'Heirloom Tomato Tartare',   desc:'Smoked olive oil, basil seeds, sourdough crisps.', price:16, dietary:['v','vg'], allergens:['gluten'],
    img:'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=600&q=80' },
  { id:'s3', cat:'starters', name:'Burrata & Stone Fruit',     desc:'Compressed peach, aged balsamic, pistachios.', price:19, dietary:['v'], allergens:['nuts','dairy'],
    img:'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=600&q=80' },
  { id:'s4', cat:'starters', name:'Tuna Crudo',                desc:'Yellowfin, yuzu kosho, finger lime.', price:22, dietary:['gf','pescatarian','low-sodium'], allergens:['fish'],
    img:'https://images.unsplash.com/photo-1583032015879-e5022cb87c3b?w=600&q=80' },

  { id:'m1', cat:'mains', name:'Charcoal Sea Bass',  desc:'Banana-leaf wrapped, green chilli relish, jasmine rice.', price:38, dietary:['gf','pescatarian','low-sodium'], allergens:['fish'], tag:'Local catch',
    img:'https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=600&q=80' },
  { id:'m2', cat:'mains', name:'Garden Risotto',     desc:'Spring vegetables, lemon, aged parmesan.', price:28, dietary:['v','gf','low-sodium'], allergens:['dairy'],
    img:'https://images.unsplash.com/photo-1633436374961-09b92742047b?w=600&q=80' },
  { id:'m3', cat:'mains', name:'Grilled Lamb Loin',  desc:'Charred eggplant, salsa verde, smoked yoghurt.', price:42, dietary:[], allergens:['dairy'],
    img:'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80' },
  { id:'m4', cat:'mains', name:'Pad Thai · Tiger Prawn', desc:'Tamarind, palm sugar, peanuts.', price:24, dietary:[], allergens:['peanut','shellfish','egg'],
    img:'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=600&q=80' },
  { id:'m5', cat:'mains', name:'Quinoa & Charred Greens', desc:'Pomegranate, tahini, preserved lemon.', price:22, dietary:['vg','gf','low-sodium'], allergens:['sesame'],
    img:'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=600&q=80' },

  { id:'d1', cat:'desserts', name:'Lychee Sorbet',          desc:'Rose petals, micro mint.', price:10, dietary:['vg','gf','low-sodium'], allergens:[],
    img:'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=600&q=80' },
  { id:'d2', cat:'desserts', name:'Pandan Crème Brûlée',    desc:'Burnt sugar lid, coconut crumb.', price:12, dietary:['v','gf','low-sodium'], allergens:['dairy','egg'],
    img:'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=600&q=80' },
  { id:'d3', cat:'desserts', name:'Dark Chocolate Tart',    desc:'Smoked salt, olive oil.', price:13, dietary:['v'], allergens:['dairy','gluten','nuts'],
    img:'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&q=80' },

  { id:'k1', cat:'kids', name:'Mini Margherita',           desc:'Buffalo mozzarella, basil.', price:9, dietary:['v'], allergens:['dairy','gluten'],
    img:'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80' },
  { id:'k2', cat:'kids', name:'Chicken Skewers & Rice',    desc:'Mild marinade, cucumber yoghurt.', price:11, dietary:['gf','low-sodium'], allergens:['dairy'],
    img:'https://images.unsplash.com/photo-1626082927389-6cd097cee6a6?w=600&q=80' },
];

const DIET_RULE = {
  'Pescatarian': it => it.dietary.includes('pescatarian') || it.dietary.includes('v') || it.dietary.includes('vg'),
  'Low-sodium':  it => it.dietary.includes('low-sodium'),
  'Vegan':       it => it.dietary.includes('vg'),
  'Vegetarian':  it => it.dietary.includes('v') || it.dietary.includes('vg'),
};

const CATEGORIES = [
  { id:'starters', label:'Starters' },
  { id:'mains',    label:'Mains' },
  { id:'desserts', label:'Desserts' },
  { id:'kids',     label:'For kids' },
];

const TRAIL_BOXES = [
  { id:'t1', name:"Hiker's box", desc:'Sourdough sandwich, seasonal fruit, trail mix, electrolyte sachet.', price:18, dietary:[],
    img:'https://images.unsplash.com/photo-1521305916504-4a1121188589?w=600&q=80' },
  { id:'t2', name:'Vegan trail box', desc:'Falafel wrap, fruit, energy bar, water.', price:16, dietary:['vg','v'],
    img:'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=600&q=80' },
  { id:'t3', name:'Family bundle · 4', desc:'Mixed wraps, fruit, snacks, juices for four.', price:48, dietary:[],
    img:'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&q=80' },
  { id:'t4', name:'Vegan power bowl', desc:'Quinoa, roasted chickpeas, hummus, pickled veg, tahini dressing.', price:19, dietary:['vg','v','gf'],
    img:'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80' },
  { id:'t5', name:'Vegan banh mì', desc:'Lemongrass tofu, pickled daikon, herbs, chilli sambal, baguette.', price:17, dietary:['vg','v'],
    img:'https://images.unsplash.com/photo-1547928576-b822bc410bdf?w=600&q=80' },
  { id:'t6', name:'Vegetarian Mediterranean', desc:'Feta-stuffed flatbread, olives, tabbouleh, seasonal fruit.', price:17, dietary:['v'],
    img:'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80' },
  { id:'t7', name:'Gluten-free trail kit', desc:'Rice cakes, smoked turkey, fruit, GF energy bar.', price:18, dietary:['gf'],
    img:'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80' },
];

const DIETARY_LABELS = { v:'Vegetarian', vg:'Vegan', gf:'Gluten-free', pescatarian:'Pescatarian' };
const ALLERGEN_LABELS = { peanut:'Peanuts', shellfish:'Shellfish', fish:'Fish', gluten:'Gluten', dairy:'Dairy', egg:'Egg', nuts:'Tree nuts', sesame:'Sesame' };
const ALLERGY_TO_KEY = { 'Peanut':'peanut', 'Shellfish':'shellfish', 'Gluten':'gluten' };

const DINING_AREAS = [
  { id:'terrace', label:'Lagoon Terrace', desc:'Open-air, water view', accent:true },
  { id:'indoor',  label:'Indoor', desc:'Main dining room' },
  { id:'poolside',label:'Poolside', desc:'Beside the lap pool' },
  { id:'private', label:'Private booth', desc:'Quiet, 4–6 guests' },
];

const TIME_SLOTS = ['18:30','19:00','19:30','20:00','20:30','21:00'];

const SEAT_GRID = [
  { id:'A·11', x: 35,  y: 35, seats:2, area:'terrace', status:'avail' },
  { id:'A·12', x: 120, y: 30, seats:4, area:'terrace', status:'avail' },
  { id:'A·13', x: 200, y: 35, seats:4, area:'terrace', status:'reserved' },
  { id:'A·14', x: 280, y: 30, seats:2, area:'terrace', status:'reserved' },
  { id:'B·21', x: 45,  y: 130, seats:4, area:'indoor', status:'avail' },
  { id:'B·22', x: 145, y: 125, seats:6, area:'indoor', status:'avail' },
  { id:'B·23', x: 255, y: 135, seats:4, area:'indoor', status:'occupied' },
  { id:'C·31', x: 85,  y: 230, seats:2, area:'private', status:'avail' },
  { id:'C·32', x: 195, y: 230, seats:4, area:'private', status:'avail' },
];

Object.assign(window, {
  SCENARIOS, MENU, CATEGORIES, TRAIL_BOXES, DIETARY_LABELS, ALLERGEN_LABELS, ALLERGY_TO_KEY,
  DINING_AREAS, TIME_SLOTS, SEAT_GRID, DIET_RULE,
});
