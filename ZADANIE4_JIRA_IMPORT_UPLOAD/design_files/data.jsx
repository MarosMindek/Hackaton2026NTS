// Mock data for the importer prototype. All names/keys are fictional.

const PEOPLE = [
  'Aria.Holden', 'Lena.Carver', 'Felix.Doran',
  'Mira.Tovar', 'Nadia.Wells', 'Theo.Marsh',
  'Jonas.Vale', 'Iris.Penn'
];

// Each task carries `currentJira` — hours already logged in Jira before this import.
// `total` is what's INCOMING from the Excel sheet (to be added).
const TASKS = [
  { key:'ATX-101', title:'CZ — Brightline Platform / SSO & Audit baseline',     currentJira: 22.0,  total: 16.5 },
  { key:'ATX-102', title:'CZ — Brightline Platform / Module ID 131824',         currentJira: 18.5,  total: 79.5 },
  { key:'ATX-103', title:'CZ — Brightline Platform / GL-AA New KeyFigure',      currentJira: 6.0,   total: 10.0 },
  { key:'ATX-104', title:'CZ — Brightline Platform / GL-CO Reconciliation',     currentJira: 14.5,  total: 21.0 },
  { key:'ATX-105', title:'CZ — Brightline Platform / RP4 RE-FX Data sync',      currentJira: 12.0,  total: 8.0  },
  { key:'ATX-106', title:'CZ — Brightline Platform / Services Resource pool',   currentJira: 38.0,  total: 40.0 },
  { key:'ATX-107', title:'CZ — Brightline Platform / Lola KT Mentoring',        currentJira: 4.5,   total: 12.0 },
  { key:'ATX-108', title:'CZ — Brightline Platform / KTLO INC02118742',         currentJira: 56.0,  total: 122.0 },
  { key:'ATX-109', title:'CZ — Brightline Platform / GL-AA Extension',          currentJira: 0,     total: 12.0 },
  { key:'ATX-110', title:'CZ — Brightline Platform / Ticket SM209114',          currentJira: 9.0,   total: 9.0  },
  { key:'ATX-111', title:'CZ — Brightline Platform / People Ops sync',          currentJira: 2.5,   total: 6.5  },
  { key:'ATX-112', title:'CZ — Brightline Platform / GL-AA Margin v2',          currentJira: 11.0,  total: 14.0 },
  { key:'ATX-113', title:'CZ — Brightline Platform / RE-FX Master Data',        currentJira: 7.5,   total: 18.5 },
];

// 14 days, starting Sun 03-May.
const DAYS = [
  {d:'03', wd:'SUN', off:true},
  {d:'04', wd:'MON'}, {d:'05', wd:'TUE'}, {d:'06', wd:'WED'},
  {d:'07', wd:'THU'}, {d:'08', wd:'FRI'},
  {d:'09', wd:'SAT', off:true}, {d:'10', wd:'SUN', off:true},
  {d:'11', wd:'MON'}, {d:'12', wd:'TUE'}, {d:'13', wd:'WED'},
  {d:'14', wd:'THU'}, {d:'15', wd:'FRI'},
  {d:'16', wd:'SAT', off:true},
];

// deterministic pseudo-random
function rand(seed){ let x = Math.sin(seed)*10000; return x - Math.floor(x); }

// Incoming-from-Excel matrix (the data that WILL be added)
const MATRIX = TASKS.map((t,ti)=>{
  const picks = 3 + Math.floor(rand(ti+1)*4);
  const idxs = DAYS.map((_,i)=>i).filter(i=>!DAYS[i].off);
  for(let i=idxs.length-1;i>0;i--){
    const j = Math.floor(rand(ti*7+i)*(i+1));
    [idxs[i],idxs[j]] = [idxs[j],idxs[i]];
  }
  const chosen = idxs.slice(0,picks);
  let rem = t.total;
  const row = DAYS.map(()=>0);
  chosen.forEach((di,ci)=>{
    const isLast = ci===chosen.length-1;
    let h;
    if(isLast){ h = Math.max(0.25, Math.round(rem*4)/4); }
    else {
      const max = Math.min(rem - 0.25*(chosen.length-1-ci), 8);
      h = Math.max(0.25, Math.round(rand(ti*13+ci+1)*max*4)/4);
    }
    if(h>rem) h = rem;
    row[di] = h;
    rem -= h;
  });
  return row;
});

// Existing-in-Jira matrix (what's already logged, day-by-day)
// Roughly distribute each task's currentJira across the same 2-week window.
const CURRENT_MATRIX = TASKS.map((t,ti)=>{
  if(t.currentJira === 0) return DAYS.map(()=>0);
  const picks = 2 + Math.floor(rand(ti+999)*4);
  const idxs = DAYS.map((_,i)=>i).filter(i=>!DAYS[i].off);
  for(let i=idxs.length-1;i>0;i--){
    const j = Math.floor(rand(ti*31+i+50)*(i+1));
    [idxs[i],idxs[j]] = [idxs[j],idxs[i]];
  }
  const chosen = idxs.slice(0, Math.min(picks, idxs.length));
  let rem = t.currentJira;
  const row = DAYS.map(()=>0);
  chosen.forEach((di,ci)=>{
    const isLast = ci===chosen.length-1;
    let h;
    if(isLast){ h = Math.max(0.25, Math.round(rem*4)/4); }
    else {
      const max = Math.min(rem - 0.25*(chosen.length-1-ci), 6);
      h = Math.max(0.25, Math.round(rand(ti*17+ci+77)*max*4)/4);
    }
    if(h>rem) h = rem;
    row[di] = h;
    rem -= h;
  });
  return row;
});

// Day totals (incoming)
const DAY_TOTALS = DAYS.map((_,di)=>{
  return MATRIX.reduce((s,row)=>s+row[di],0);
});
const CURRENT_DAY_TOTALS = DAYS.map((_,di)=>{
  return CURRENT_MATRIX.reduce((s,row)=>s+row[di],0);
});
const GRAND_TOTAL         = DAY_TOTALS.reduce((s,v)=>s+v,0);
const CURRENT_GRAND_TOTAL = CURRENT_DAY_TOTALS.reduce((s,v)=>s+v,0);

// Validation lines (rolled out by the dry run)
const VALIDATION = [
  { row:63, level:'WARN', sheet:'JIRA_EXPORT', key:'ATX-101', date:'2026-05-13', hrs:6.50, who:'Aria.Holden',  desc:'SSO & Audit — review session', flag:'Duplicate: same Issue Key + date detected' },
  { row:64, level:'WARN', sheet:'JIRA_EXPORT', key:'ATX-102', date:'2026-05-13', hrs:2.50, who:'Lena.Carver',  desc:'Module 131824 / GL-AA New KeyFigure', flag:'Duplicate: same Issue Key + date detected' },
  { row:65, level:'WARN', sheet:'JIRA_EXPORT', key:'ATX-102', date:'2026-05-13', hrs:1.50, who:'Lena.Carver',  desc:'Module 131985 Extension', flag:'Duplicate: same Issue Key + date detected' },
  { row:66, level:'WARN', sheet:'JIRA_EXPORT', key:'ATX-102', date:'2026-05-13', hrs:1.00, who:'Lena.Carver',  desc:'Lola — KT — Mentoring effort estimation', flag:'Duplicate: same Issue Key + date detected' },
  { row:67, level:'WARN', sheet:'JIRA_EXPORT', key:'ATX-102', date:'2026-05-13', hrs:0.75, who:'Lena.Carver',  desc:'KTLO INC02118742 RP4 RE-FX/AA Data', flag:'Duplicate: same Issue Key + date detected' },
  { row:68, level:'WARN', sheet:'JIRA_EXPORT', key:'ATX-102', date:'2026-05-14', hrs:1.00, who:'Lena.Carver',  desc:'Module 131985 GL-AA Extension', flag:'Duplicate: same Issue Key + date detected' },
  { row:69, level:'OK',   sheet:'JIRA_EXPORT', key:'ATX-103', date:'2026-05-14', hrs:1.00, who:'Felix.Doran',  desc:'SM209114 prep' },
  { row:70, level:'OK',   sheet:'JIRA_EXPORT', key:'ATX-108', date:'2026-05-14', hrs:2.00, who:'Mira.Tovar',   desc:'tax computation' },
  { row:71, level:'WARN', sheet:'JIRA_EXPORT', key:'ATX-101', date:'2026-05-14', hrs:1.00, who:'Aria.Holden',  desc:'People Ops sync', flag:'Duplicate: same Issue Key + date detected' },
  { row:72, level:'WARN', sheet:'JIRA_EXPORT', key:'ATX-101', date:'2026-05-14', hrs:6.50, who:'Aria.Holden',  desc:'SSO & Audit review (2nd block)', flag:'Duplicate: same Issue Key + date detected' },
  { row:73, level:'OK',   sheet:'JIRA_EXPORT', key:'ATX-106', date:'2026-05-14', hrs:4.00, who:'Nadia.Wells',  desc:'Services AddRes RES- SM00001318' },
  { row:74, level:'WARN', sheet:'JIRA_EXPORT', key:'ATX-102', date:'2026-05-14', hrs:3.00, who:'Lena.Carver',  desc:'Module 131824 GL-AA New KeyFigure', flag:'Duplicate: same Issue Key + date detected' },
  { row:75, level:'OK',   sheet:'JIRA_EXPORT', key:'ATX-107', date:'2026-05-15', hrs:2.50, who:'Theo.Marsh',   desc:'KT session prep' },
  { row:76, level:'ERR',  sheet:'JIRA_EXPORT', key:'ATX-999', date:'2026-05-15', hrs:1.00, who:'Jonas.Vale',   desc:'unknown issue', flag:'BLOCKED — issue key not found in Jira' },
  { row:77, level:'OK',   sheet:'JIRA_EXPORT', key:'ATX-108', date:'2026-05-15', hrs:4.50, who:'Mira.Tovar',   desc:'KTLO INC02118742' },
];

// Build the scripted terminal output for the dry run
const TERMINAL_DRY_LINES = [
  { kind:'info', text:'[*] Key remap loaded: 9 issue key(s) remapped from key_mapping.json' },
  { kind:'info', text:'[*] Parsing JIRA export:  JIRA_EXPORT.xlsx' },
  { kind:'info', text:'[*] Parsing Brightline export:   BRIGHTLINE_export.xlsx' },
  { kind:'info', text:'[*] Remapped 89 worklog issue key(s) to new Jira keys.' },
  { kind:'info', text:'[*] Parsed 100 entries total.' },
  { kind:'info', text:'[*] Validating 13 unique issue key(s) via Jira API…' },
  { kind:'ok',   text:'  ATX-101: OK' },
  { kind:'ok',   text:'  ATX-102: OK' },
  { kind:'ok',   text:'  ATX-103: OK' },
  { kind:'ok',   text:'  ATX-104: OK' },
  { kind:'ok',   text:'  ATX-105: OK' },
  { kind:'ok',   text:'  ATX-106: OK' },
  { kind:'ok',   text:'  ATX-107: OK' },
  { kind:'ok',   text:'  ATX-108: OK' },
  { kind:'ok',   text:'  ATX-109: OK' },
  { kind:'ok',   text:'  ATX-110: OK' },
  { kind:'ok',   text:'  ATX-111: OK' },
  { kind:'ok',   text:'  ATX-112: OK' },
  { kind:'ok',   text:'  ATX-113: OK' },
  { kind:'info', text:'[*] Resolving numeric Jira IDs for 13 issue key(s)…' },
  { kind:'info', text:'[*] Pulling current logged hours from Jira for diff…' },
  { kind:'info', text:'[*] Cross-checking dates against Tempo periods…' },
  { kind:'warn', text:'[!] 58 warning(s) detected — see Issues panel for details.' },
  { kind:'info', text:'[*] Dry run complete. No data written to Jira.' },
  { kind:'muted',text:'    Ready: press “Submit to Jira” to write 100 worklog(s).' },
];

const TERMINAL_SUBMIT_LINES = [
  { kind:'info', text:'[SUBMIT → TEMPO] Sending 100 worklog(s) to Jira/Tempo…' },
  { kind:'ok',   text:'  [OK] #1  ATX-101  2026-05-04   6.50h' },
  { kind:'ok',   text:'  [OK] #2  ATX-102  2026-05-04   1.00h' },
  { kind:'ok',   text:'  [OK] #3  ATX-102  2026-05-04   0.50h' },
  { kind:'ok',   text:'  [OK] #4  ATX-103  2026-05-04   0.50h' },
  { kind:'ok',   text:'  [OK] #5  ATX-103  2026-05-04   0.50h' },
  { kind:'ok',   text:'  [OK] #6  ATX-103  2026-05-04   1.00h' },
  { kind:'ok',   text:'  [OK] #7  ATX-102  2026-05-04   0.75h' },
  { kind:'ok',   text:'  [OK] #8  ATX-104  2026-05-04   0.50h' },
  { kind:'ok',   text:'  [OK] #9  ATX-101  2026-05-04   1.00h' },
  { kind:'ok',   text:'  [OK] #10 ATX-105  2026-05-04   1.00h' },
  { kind:'ok',   text:'  [OK] #11 ATX-106  2026-05-04   2.00h' },
  { kind:'ok',   text:'  [OK] #12 ATX-107  2026-05-04   3.00h' },
  { kind:'ok',   text:'  [OK] #13 ATX-108  2026-05-04   6.50h' },
  { kind:'muted',text:'  … 87 more worklog(s) …' },
  { kind:'info', text:'[*] Submission complete: 100 / 100 worklog(s) accepted.' },
  { kind:'ok',   text:'[✓] All worklogs written to Jira. Total: 469.5h' },
];

window.IMPORTER_DATA = {
  PEOPLE, TASKS, DAYS, MATRIX, CURRENT_MATRIX,
  DAY_TOTALS, CURRENT_DAY_TOTALS,
  GRAND_TOTAL, CURRENT_GRAND_TOTAL,
  VALIDATION, TERMINAL_DRY_LINES, TERMINAL_SUBMIT_LINES
};
