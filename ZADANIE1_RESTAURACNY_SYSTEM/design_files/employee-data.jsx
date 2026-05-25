// employee-data.jsx — shared data + helpers

const initialReservations = [
  { id:'r1', name:'Linh Tran',      party:4, time:'19:30', table:'A·12', area:'terrace',
    flags:['family','allergy'], allergies:['Peanut','Shellfish'], pkg:'All-Incl. Wellness', payPer:false,
    room:'Garden Suite 4127', status:'arriving', note:'High chair · seat away from kitchen', phone:'+84 90 123 4567',
    preorder: ['Lemongrass soup ×2','Charcoal sea bass ×2','Garden risotto'] },
  { id:'r2', name:'Sara Klein',     party:2, time:'19:30', table:'A·14', area:'terrace',
    flags:['external','allergy'], allergies:['Gluten'], pkg:'External · pay per item', payPer:true,
    room:'Walk-in', status:'seated', note:'Anniversary · cake at 20:30', phone:'+1 415 555 7782',
    preorder: ['Tuna crudo','Pad Thai'] },
  { id:'r3', name:'Mr. Hayashi',    party:2, time:'19:45', table:'B·22', area:'indoor',
    flags:['accessible','assisted'], allergies:[], pkg:'Spa · Half-Board', payPer:false,
    room:'Wellness Suite 2208', status:'arriving', note:'Escort + tactile menu · meet at spa lift 19:25', phone:'+81 80 222 3344',
    preorder: ['Quinoa & charred greens'] },
  { id:'r4', name:'Ortega family',  party:5, time:'20:00', table:'B·23', area:'indoor',
    flags:['family'], allergies:['Dairy (child)'], pkg:'All-Incl. Family', payPer:false,
    room:'Lagoon Villa 3304', status:'pending', note:'2 kids · crayons + activity set', phone:'+34 666 111 222',
    preorder: [] },
  { id:'r5', name:'Daniel Schwartz', party:2, time:'20:30', table:'C·31', area:'private',
    flags:['external'], allergies:[], pkg:'External', payPer:true, room:'Walk-in', status:'pending', note:'Booked via concierge',
    phone:'+49 30 5555 1212', preorder: [] },
  { id:'r6', name:'Nakamura group',  party:6, time:'21:00', table:'B·22', area:'private',
    flags:['vip'], allergies:[], pkg:'Pavilion Suite · Premier', payPer:false,
    room:'Pavilion Suite 5101', status:'pending', note:'Sommelier requested', phone:'+81 90 4444 5566',
    preorder: ['Burrata & stone fruit ×3','Grilled lamb ×4'] },
];

const initialOrders = [
  { id:'o1', table:'A·12', name:'Linh Tran', course:'Starters', channel:'in', lines:[
    {q:1, n:'Lemongrass & Coconut Soup'},
    {q:2, n:'Heirloom Tomato Tartare', sub:'no peanuts'},
  ], elapsed: 4, target: 8, status:'cooking' },
  { id:'o2', table:'A·14', name:'Sara Klein', course:'Mains', channel:'in', lines:[
    {q:1, n:'Charcoal Sea Bass', sub:'gluten-free side'},
    {q:1, n:'Garden Risotto'},
  ], elapsed: 11, target: 12, status:'cooking' },
  { id:'o3', table:'B·22', name:'Mr. Hayashi', course:'Mains', channel:'in', lines:[
    {q:2, n:'Quinoa & Charred Greens', sub:'low-sodium'},
  ], elapsed: 2, target: 12, status:'fired' },
];

const initialRoomOrders = [
  { id:'rs1', room:'4127', name:'Linh Tran', eta: '20:10', lines:[
    {q:2, n:'Pandan Crème Brûlée'}, {q:1, n:'Lychee Sorbet'},
  ], elapsed: 6, target: 25, status:'cooking', deliveredBy:'Marco' },
  { id:'rs2', room:'2208', name:'Mr. Hayashi', eta: '22:00', lines:[
    {q:2, n:'Chamomile tea'}, {q:1, n:'Fruit plate'},
  ], elapsed: 0, target: 25, status:'scheduled', deliveredBy:'—' },
];

const initialKiosk = [
  { id:'k1', when:'19:42', name:'Linh Tran', table:'A·12', card:'••32A · NFC', status:'arrived' },
  { id:'k2', when:'19:38', name:'Sara Klein', table:'A·14', card:'••18F · NFC', status:'arrived' },
];

const floorTables = [
  // Terrace
  {id:'A·11', x:80,  y:80,  seats:2, area:'terrace'},
  {id:'A·12', x:200, y:75,  seats:4, area:'terrace'},
  {id:'A·13', x:320, y:80,  seats:4, area:'terrace'},
  {id:'A·14', x:440, y:75,  seats:2, area:'terrace'},
  {id:'A·15', x:560, y:80,  seats:2, area:'terrace'},
  {id:'A·16', x:680, y:75,  seats:4, area:'terrace'},
  {id:'A·17', x:800, y:80,  seats:6, area:'terrace'},
  // Indoor
  {id:'B·21', x:110, y:215, seats:4, area:'indoor'},
  {id:'B·22', x:240, y:225, seats:6, area:'indoor'},
  {id:'B·23', x:390, y:215, seats:5, area:'indoor'},
  {id:'B·24', x:530, y:225, seats:4, area:'indoor'},
  {id:'B·25', x:660, y:215, seats:2, area:'indoor'},
  {id:'B·26', x:790, y:225, seats:4, area:'indoor'},
  // Booths
  {id:'C·31', x:130, y:370, seats:2, area:'private'},
  {id:'C·32', x:270, y:380, seats:4, area:'private'},
  {id:'C·33', x:420, y:375, seats:4, area:'private'},
  {id:'C·34', x:560, y:380, seats:6, area:'private'},
  // Poolside (bottom-right)
  {id:'D·41', x:700, y:370, seats:2, area:'pool'},
  {id:'D·42', x:790, y:380, seats:4, area:'pool'},
];

const sampleGuests = [
  { id:'g1', name:'Linh Tran', room:'Garden Suite 4127', pkg:'All-Incl. Wellness', allergies:['Peanut','Shellfish'], visits:3, lastVisit:'18 May' },
  { id:'g2', name:'Mr. Hayashi', room:'Wellness Suite 2208', pkg:'Spa Half-Board', allergies:[], visits:1, lastVisit:'Today' },
  { id:'g3', name:'Ortega family', room:'Lagoon Villa 3304', pkg:'All-Incl. Family', allergies:['Dairy (child)'], visits:7, lastVisit:'20 May' },
  { id:'g4', name:'Nakamura group', room:'Pavilion 5101', pkg:'Premier', allergies:[], visits:12, lastVisit:'19 May' },
  { id:'g5', name:'Anna Persson', room:'Garden 4204', pkg:'All-Incl.', allergies:[], visits:2, lastVisit:'14 May' },
];

const menuItems = [
  { id:'s1', cat:'starters', name:'Lemongrass & Coconut Soup', price:14, available:true },
  { id:'m1', cat:'mains',    name:'Charcoal Sea Bass',           price:38, available:true, tag:"Chef's pick"},
  { id:'m2', cat:'mains',    name:'Garden Risotto',              price:28, available:true },
  { id:'m3', cat:'mains',    name:'Grilled Lamb Loin',           price:42, available:true },
  { id:'m4', cat:'mains',    name:'Pad Thai · Tiger Prawn',      price:24, available:false }, // 86'd
  { id:'d1', cat:'desserts', name:'Lychee Sorbet',               price:10, available:true },
];

Object.assign(window, {
  initialReservations, initialOrders, initialRoomOrders, initialKiosk,
  floorTables, sampleGuests, menuItems,
});
