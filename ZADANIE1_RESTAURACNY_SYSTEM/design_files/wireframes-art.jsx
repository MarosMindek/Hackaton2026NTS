// wireframes-art.jsx — sketchy lo-fi wireframes for FPT Restaurant Module
// 5 screens × 3 directions, presented inside DCSection / DCArtboard.

const { useState } = React;

// ── Wireframe primitives ───────────────────────────────────────
const Box = ({children, style, dashed, solid, accent, placeholder, ...rest}) => (
  <div className={`b ${dashed?'dashed':''} ${solid?'solid':''} ${accent?'accent':''} ${placeholder?'placeholder':''}`} style={style} {...rest}>{children}</div>
);
const Line = ({w='60%', h=2}) => <div style={{width:w, height:h, background:'currentColor', borderRadius:1}}/>;
const Pill = ({children, on, accent, style}) => (
  <span className={`pill ${on?'solid':''} ${accent?'accent':''}`} style={style}>{children}</span>
);
const Spacer = ({h=8}) => <div style={{height:h}}/>;
const Hdr = ({title, action}) => (
  <div className="h"><div className="h-title">{title}</div>{action && <span className="pill">{action}</span>}</div>
);
const PhTop = () => <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 6px', marginBottom:8}}>
  <span style={{fontSize: 10, fontWeight: 700}}>9:41</span>
  <span style={{fontSize: 10}}>●●● ⚡</span>
</div>;
const Note = ({children}) => <div className="note">{children}</div>;
const Annotation = ({pos='tl', children}) => <div className={`ann ${pos}`}>↗ {children}</div>;

const MOB_W = 280, MOB_H = 530;
const DSK_W = 560, DSK_H = 380;

// ───────────────────────────────────────────────────────────────
// Mobile sketches
// ───────────────────────────────────────────────────────────────

// Guest Home — A · Stacked
const GuestHomeA = () => (
  <div className="wf wf-mob">
    <PhTop/>
    <Hdr title="Good evening, Linh" action="profile"/>
    <Box style={{padding:12, marginBottom:10}}>
      <div className="scribble"/>
      <Spacer h={6}/>
      <Pill on>Table A·12 · 7:30 pm</Pill>
      <Spacer h={6}/>
      <Note>+ "tonight" booking summary</Note>
    </Box>
    <div className="stack">
      <Box>📋 Menu — pre-order</Box>
      <Box>🪑 Reserve a seat</Box>
      <Box>🚪 Room service</Box>
      <Box>🥪 Packed lunch</Box>
      <Box>♿ Assistance</Box>
    </div>
    <Spacer h={10}/>
    <Hdr title="Chef's pick"/>
    <Box placeholder style={{height:60}}/>
    <Spacer h={6}/>
    <Box>Sea bass · "Included" tag</Box>
  </div>
);

// Guest Home — B · Card-grid
const GuestHomeB = () => (
  <div className="wf wf-mob">
    <PhTop/>
    <div style={{fontSize: 18, fontWeight: 800, marginBottom: 8}}>Hello,</div>
    <Box solid style={{padding:12, marginBottom:10}}>
      <div style={{fontSize:10, opacity:.7}}>TONIGHT</div>
      <div className="scribble" style={{background:'#fff', height:2, marginTop:4}}/>
      <Spacer h={4}/>
      <Pill style={{background:'#fff', color:'#1A1714'}}>A·12 · 7:30</Pill>
    </Box>
    <div className="grid2">
      <Box style={{height: 80}}><Note>Pre-order menu</Note></Box>
      <Box style={{height: 80}}><Note>Reserve</Note></Box>
      <Box style={{height: 80}}><Note>Room svc.</Note></Box>
      <Box style={{height: 80}}><Note>Trail box</Note></Box>
    </div>
    <Spacer h={8}/>
    <Box dashed style={{padding: 8}}><Note>⚠ Allergens auto-flagged</Note></Box>
    <Spacer h={8}/>
    <Hdr title="Quick add"/>
    <div className="row" style={{gap:6, overflowX:'auto'}}>
      <Box style={{minWidth:80, height:60}}/>
      <Box style={{minWidth:80, height:60}}/>
      <Box style={{minWidth:80, height:60}}/>
    </div>
  </div>
);

// Guest Home — C · Conversational
const GuestHomeC = () => (
  <div className="wf wf-mob">
    <PhTop/>
    <div style={{textAlign:'center', fontSize: 12, fontWeight:600, marginBottom:14}}>Concierge</div>
    <div className="stack">
      <Box style={{padding:10, marginRight:24, borderRadius:'12px 12px 12px 4px'}}>
        <Note>Bot · 19:42</Note>
        <div className="scribbles"><div/><div/></div>
        <div style={{fontSize:11}}>"Table on terrace at 7:30. Want to pre-order?"</div>
      </Box>
      <Box solid style={{padding:10, marginLeft:24, borderRadius:'12px 12px 4px 12px'}}>
        <div style={{fontSize:11}}>"Yes — sea bass & risotto."</div>
      </Box>
      <Box style={{padding:10, marginRight:24, borderRadius:'12px 12px 12px 4px'}}>
        <div style={{fontSize:11}}>"Sea bass has peanut allergen flag for you — swap green chilli sauce?"</div>
        <div className="row" style={{gap:4, marginTop:6}}>
          <Pill accent>Yes</Pill><Pill>Show me</Pill>
        </div>
      </Box>
      <Box dashed style={{padding:8}}>
        <Note>Text input + voice mic</Note>
      </Box>
    </div>
    <div style={{position:'absolute', bottom:14, left:14, right:14}}>
      <Box dashed style={{padding:8, textAlign:'center'}}>type or 🎙</Box>
    </div>
  </div>
);

// Menu — A · List w/ filter chips
const MenuA = () => (
  <div className="wf wf-mob">
    <PhTop/>
    <Hdr title="Menu · tonight"/>
    <div className="row" style={{gap:4, overflowX:'auto', paddingBottom:6}}>
      <Pill on>All</Pill><Pill>Veg</Pill><Pill>GF</Pill><Pill>Pescat.</Pill><Pill>Vegan</Pill>
    </div>
    <Spacer h={4}/>
    <Box dashed style={{padding:6, marginBottom:6}}><Note>⚠ hide peanut/shellfish · toggle</Note></Box>
    <div className="stack">
      {['Lemongrass soup','Tomato tartare','Tuna crudo','Sea bass ★','Garden risotto'].map(n=>(
        <div className="row" key={n} style={{gap:8}}>
          <Box placeholder style={{width:48, height:48, padding:0}}/>
          <div className="col" style={{flex:1, gap:2}}>
            <div style={{fontSize:12, fontWeight:700}}>{n}</div>
            <div className="scribble" style={{width:'80%'}}/>
            <div className="row" style={{gap:4, marginTop:2}}><Pill>v</Pill><Pill>gf</Pill></div>
          </div>
        </div>
      ))}
    </div>
    <Spacer h={6}/>
    <Box accent style={{textAlign:'center', padding:8}}>Pre-order · 3 items</Box>
  </div>
);

// Menu — B · Gallery
const MenuB = () => (
  <div className="wf wf-mob">
    <PhTop/>
    <div style={{fontSize: 18, fontWeight: 800, marginBottom: 4}}>Tonight</div>
    <Note>swipe a course →</Note>
    <Spacer h={8}/>
    <div className="row" style={{gap:6}}>
      <Pill on>Starters</Pill><Pill>Mains</Pill><Pill>Dessert</Pill>
    </div>
    <Spacer h={10}/>
    <div className="grid2" style={{gap:8}}>
      {[1,2,3,4].map(i=>(
        <div key={i} className="col" style={{gap:4}}>
          <Box placeholder style={{height:90, padding:0}}/>
          <div style={{fontSize:11, fontWeight:700}}>Dish #{i}</div>
          <div className="row" style={{gap:4}}>
            <Pill>v</Pill>
            {i===3 && <Pill style={{background:'#FDE7E2', borderColor:'#B83227', color:'#B83227'}}>⚠</Pill>}
          </div>
        </div>
      ))}
    </div>
    <Annotation pos="tr">image-first</Annotation>
  </div>
);

// Menu — C · Course tabs
const MenuC = () => (
  <div className="wf wf-mob">
    <PhTop/>
    <Hdr title="Menu"/>
    <div className="row" style={{gap:0, borderBottom:'1.5px solid var(--ink)', paddingBottom:4}}>
      {['Starter','Main','Dessert','Kids'].map((t,i)=>(
        <div key={t} style={{flex:1, textAlign:'center', fontSize:11, fontWeight:700, padding:4,
          borderBottom: i===1?'3px solid var(--accent)':'none', marginBottom:-2}}>{t}</div>
      ))}
    </div>
    <Spacer h={6}/>
    <Note>Mains · 5 items</Note>
    <Spacer h={4}/>
    <div className="stack">
      {[0,1,2].map(i=>(
        <Box key={i} style={{padding:8}}>
          <div className="row" style={{justifyContent:'space-between'}}>
            <div style={{fontWeight:700, fontSize:12}}>Item name</div>
            <Pill>$32</Pill>
          </div>
          <div className="scribble" style={{marginTop:4, width:'90%'}}/>
          <div className="scribble" style={{marginTop:4, width:'60%'}}/>
        </Box>
      ))}
    </div>
    <Spacer h={6}/>
    <div className="row" style={{justifyContent:'space-between', borderTop:'1.5px solid var(--ink)', paddingTop:6}}>
      <Note>2 of 5</Note>
      <Pill accent>add</Pill>
    </div>
  </div>
);

// Seat map — A · Floor plan
const SeatA = () => (
  <div className="wf wf-mob">
    <PhTop/>
    <Hdr title="Pick a seat"/>
    <Note>Lagoon terrace · 7:30 pm</Note>
    <Spacer h={6}/>
    <Box style={{padding: 8, height: 280, position:'relative'}}>
      <Note>top-down floor plan</Note>
      {[
        [40,40,'A·11', false],[100,30,'A·12', true],[170,40,'A·13', false],[230,30,'A·14','x'],
        [40,110,'B·21',false],[110,110,'B·22',false],[200,110,'B·23','x'],
        [70,180,'C·31',false],[170,180,'C·32',false],
      ].map(([x,y,id,sel])=>(
        <div key={id} style={{position:'absolute', left:x, top:y, width:30, height:30, borderRadius:'50%',
          border:'1.5px solid var(--ink)',
          background: sel===true ? 'var(--accent)' : sel==='x' ? '#1A1714' : '#fff',
          color: sel===true||sel==='x' ? '#fff' : 'var(--ink)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700,
        }}>{id}</div>
      ))}
      <div style={{position:'absolute', bottom:6, left:8, right:8, height:8, background:'rgba(0,0,0,.1)', borderRadius:2}}/>
      <div style={{position:'absolute', bottom:-2, left:0, right:0, textAlign:'center', fontSize:8}}>KITCHEN PASS</div>
    </Box>
    <Spacer h={8}/>
    <Box solid style={{padding:8}}>
      <div className="row" style={{justifyContent:'space-between'}}>
        <span style={{fontSize:14, fontWeight:800, color:'var(--accent)'}}>A·12</span>
        <Note>4 guests · window</Note>
      </div>
    </Box>
    <Spacer h={4}/>
    <Box accent style={{textAlign:'center', padding:8}}>Confirm</Box>
  </div>
);

// Seat map — B · List by area
const SeatB = () => (
  <div className="wf wf-mob">
    <PhTop/>
    <Hdr title="Pick a seat" action="map"/>
    <div className="row" style={{gap:4, overflowX:'auto'}}>
      <Pill on>Terrace</Pill><Pill>Indoor</Pill><Pill>Booth</Pill><Pill>Pool</Pill>
    </div>
    <Spacer h={8}/>
    {[
      ['A·11','2 seats · railing','avail'],
      ['A·12','4 seats · window ★','sel'],
      ['A·13','4 seats','avail'],
      ['A·14','2 seats · close to pass','x'],
      ['A·15','2 seats','avail'],
      ['A·16','6 seats · family','avail'],
    ].map(([id,m,s])=>(
      <div key={id} className="row" style={{padding:6, borderBottom:'1px dashed var(--ink)', gap:8,
        background: s==='sel'?'rgba(243,112,33,.1)':'transparent'}}>
        <div style={{width:36, height:36, borderRadius:'50%',
          background: s==='sel'?'var(--accent)':s==='x'?'#1A1714':'transparent',
          border:'1.5px solid var(--ink)', display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:9, fontWeight:700, color: s==='sel'||s==='x'?'#fff':'var(--ink)'
        }}>{id}</div>
        <div className="col" style={{flex:1}}>
          <div style={{fontWeight:700, fontSize:12}}>{id}</div>
          <Note>{m}</Note>
        </div>
        {s==='x' ? <Note>taken</Note> : <Pill on={s==='sel'} accent={s==='sel'}>{s==='sel'?'✓':'pick'}</Pill>}
      </div>
    ))}
  </div>
);

// Seat map — C · Time strip
const SeatC = () => (
  <div className="wf wf-mob">
    <PhTop/>
    <Hdr title="When?"/>
    <Note>tap a row + slot</Note>
    <Spacer h={6}/>
    <div className="grid3" style={{gridTemplateColumns:'80px 1fr', gap:2}}>
      <div></div>
      <div className="row" style={{justifyContent:'space-between', fontSize:9}}>
        <span>18:00</span><span>19:00</span><span>20:00</span><span>21:00</span>
      </div>
      {['Terrace','Indoor','Booth','Pool'].map((row, ri)=>(
        <React.Fragment key={row}>
          <div style={{fontSize:11, fontWeight:700, padding:'8px 4px'}}>{row}</div>
          <div className="row" style={{gap:2}}>
            {Array.from({length:12}).map((_,i)=>{
              const taken = (ri+i)%5===0;
              const sel = ri===0 && i===6;
              return <div key={i} style={{flex:1, height: 28, border:'1.5px solid var(--ink)',
                background: sel?'var(--accent)':taken?'#1A1714':'#fff'}}/>;
            })}
          </div>
        </React.Fragment>
      ))}
    </div>
    <Spacer h={8}/>
    <Box solid style={{padding:8, textAlign:'center'}}>
      <span style={{fontSize:14, fontWeight:800}}>Terrace · 19:30 · A·12</span>
    </Box>
    <Spacer h={4}/>
    <Box accent style={{padding:8, textAlign:'center'}}>Book</Box>
  </div>
);

// ───────────────────────────────────────────────────────────────
// Desktop sketches — Employee
// ───────────────────────────────────────────────────────────────

// Console — A · Three-pane
const ConsoleA = () => (
  <div className="wf" style={{width: DSK_W, height: DSK_H, padding: 10}}>
    <div className="row" style={{gap:8, height: '100%'}}>
      <div className="col" style={{width: 90, gap:4, borderRight:'1.5px solid var(--ink)', paddingRight:8}}>
        <div style={{fontWeight:800, fontSize:13}}>FPT Rest.</div>
        <Spacer h={4}/>
        <Pill on>Live floor</Pill>
        <Pill>Reservations</Pill>
        <Pill>Orders</Pill>
        <Pill>Room svc</Pill>
        <Pill>KDS</Pill>
        <Pill>Guests</Pill>
      </div>
      <div className="col" style={{flex:1, gap:6}}>
        <div className="row" style={{justifyContent:'space-between'}}>
          <div style={{fontWeight:800, fontSize:14}}>Live floor</div>
          <div className="row" style={{gap:4}}><Pill>Search</Pill><Pill accent>+ New</Pill></div>
        </div>
        <div className="row" style={{gap:4}}>
          <Box style={{flex:1, padding:4}}><Note>42 covers</Note></Box>
          <Box style={{flex:1, padding:4}}><Note>12 seated</Note></Box>
          <Box style={{flex:1, padding:4}}><Note>3 ⚠</Note></Box>
        </div>
        <Box style={{height:160, position:'relative', padding:6}}>
          <Note>floor plan SVG · circles per table</Note>
          {[[60,40],[120,30],[180,40],[240,30],[80,90],[150,100],[210,90],[100,140],[180,150]].map(([x,y],i)=>(
            <div key={i} style={{position:'absolute', left:x, top:y, width:22, height:22, borderRadius:'50%',
              background: i===1?'var(--accent)':i===3||i===6?'#1A1714':'#fff', border:'1.5px solid var(--ink)'}}/>
          ))}
        </Box>
        <Note>+ "next 30 min" strip</Note>
      </div>
      <div className="col" style={{width: 130, borderLeft:'1.5px solid var(--ink)', paddingLeft:8, gap:4}}>
        <div style={{fontWeight:800, fontSize:12}}>Reservations</div>
        <Note>tabs: list / guest / orders</Note>
        {[0,1,2,3].map(i=>(
          <Box key={i} style={{padding:4}}>
            <div className="row" style={{justifyContent:'space-between'}}>
              <span style={{fontSize:10, fontWeight:700}}>Name {i+1}</span>
              <span style={{fontSize:9}}>19:30</span>
            </div>
            <div className="scribble" style={{width:'80%', marginTop:2}}/>
          </Box>
        ))}
      </div>
    </div>
  </div>
);

// Console — B · Timeline-first
const ConsoleB = () => (
  <div className="wf" style={{width: DSK_W, height: DSK_H, padding: 10}}>
    <Hdr title="Tonight · timeline" action="floor"/>
    <Note>each row = a table · each block = a booking</Note>
    <Spacer h={6}/>
    <div className="row" style={{fontSize:9, gap:4}}>
      <div style={{width:60}}></div>
      <div style={{flex:1, display:'flex', justifyContent:'space-between'}}>
        <span>17:00</span><span>18:00</span><span>19:00</span><span>20:00</span><span>21:00</span><span>22:00</span>
      </div>
    </div>
    {['A·11','A·12','A·13','A·14','B·21','B·22','C·31'].map((id,ri)=>(
      <div key={id} className="row" style={{gap:4, marginBottom:4}}>
        <div style={{width:60, fontSize:11, fontWeight:700, padding:'4px 0'}}>{id}</div>
        <div className="row" style={{flex:1, height:22, border:'1.5px solid var(--ink)', position:'relative', background:'#fff'}}>
          {ri%3===0 && <div style={{position:'absolute', left: `${15 + ri*4}%`, top:0, bottom:0, width:'18%', background:'var(--ink)', color:'#fff', fontSize:9, padding:'3px 4px'}}>Tran·4</div>}
          {ri===1 && <div style={{position:'absolute', left:'48%', top:0, bottom:0, width:'14%', background:'var(--accent)', color:'#fff', fontSize:9, padding:'3px 4px'}}>★ Linh</div>}
          {ri===4 && <div style={{position:'absolute', left:'62%', top:0, bottom:0, width:'15%', background:'var(--ink)', color:'#fff', fontSize:9, padding:'3px 4px'}}>Ortega·5</div>}
          {ri===5 && <div style={{position:'absolute', left:'25%', top:0, bottom:0, width:'12%', background:'var(--ink)', color:'#fff', fontSize:9, padding:'3px 4px'}}>Hayashi♿</div>}
        </div>
      </div>
    ))}
    <Spacer h={6}/>
    <Note>click block → guest detail · drag to extend / move</Note>
  </div>
);

// Console — C · Map-fullscreen w/ floating panels
const ConsoleC = () => (
  <div className="wf" style={{width: DSK_W, height: DSK_H, padding: 0, position:'relative'}}>
    <Box style={{position:'absolute', inset:8, padding:0, background:'#FDFBF6'}}>
      <Note style={{padding:8}}>Full-bleed floor map</Note>
      {[[80,60],[160,40],[240,60],[320,40],[400,60],[80,140],[180,150],[300,140],[120,230],[260,230],[400,200]].map(([x,y],i)=>(
        <div key={i} style={{position:'absolute', left:x, top:y, width:32, height:32, borderRadius:'50%',
          background: i===1?'var(--accent)':[3,5,8].includes(i)?'#1A1714':'#fff',
          border:'1.5px solid var(--ink)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700,
          color:[3,5,8].includes(i)||i===1?'#fff':'var(--ink)'}}>{`T${i+1}`}</div>
      ))}
    </Box>
    {/* Floating top-left search */}
    <Box style={{position:'absolute', top:18, left:20, width:170, padding:6, background:'#fff'}}>
      <div className="row" style={{gap:4}}>
        <span style={{fontSize:11}}>🔍</span>
        <div className="scribble"/>
      </div>
    </Box>
    {/* Floating top-right next */}
    <Box style={{position:'absolute', top:18, right:20, padding:6, background:'#fff'}}>
      <Pill accent>+ Reservation</Pill>
    </Box>
    {/* Floating bottom card */}
    <Box solid style={{position:'absolute', bottom:18, left:18, right:18, padding:10}}>
      <div className="row" style={{justifyContent:'space-between'}}>
        <span style={{fontWeight:800, fontSize:13, color:'var(--accent)'}}>A·12 · Linh Tran</span>
        <Note style={{color:'rgba(255,255,255,.7)'}}>4 pax · 19:30</Note>
      </div>
      <div className="row" style={{gap:4, marginTop:6}}>
        <Pill style={{background:'#FDE7E2', color:'#B83227', borderColor:'#B83227'}}>⚠ peanut</Pill>
        <Pill style={{background:'#fff', color:'#1A1714'}}>family</Pill>
        <Pill style={{background:'#fff', color:'#1A1714'}}>incl.</Pill>
      </div>
    </Box>
  </div>
);

// ───────────────────────────────────────────────────────────────
// Kiosk sketches
// ───────────────────────────────────────────────────────────────
const KiW = 280, KiH = 420;

const KioskA = () => (
  <div className="wf" style={{width: KiW, height: KiH, padding: 14}}>
    <div className="row" style={{justifyContent:'space-between'}}>
      <div style={{fontWeight:800, fontSize:13}}>Lagoon · check-in</div>
      <Pill>EN ⇣</Pill>
    </div>
    <Spacer h={20}/>
    <div style={{textAlign:'center', fontSize:18, fontWeight:800}}>Tap to find</div>
    <div style={{textAlign:'center', fontSize:18, fontWeight:800}}>your table.</div>
    <Spacer h={20}/>
    <div style={{margin:'0 auto', width: 160, height: 160, border:'2px dashed var(--accent)', borderRadius:'50%',
      display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{width: 92, height: 92, borderRadius:'50%', background:'var(--accent)', color:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:32}}>📶</div>
    </div>
    <Spacer h={16}/>
    <div style={{textAlign:'center', fontSize:11}}>Tap the orange ring</div>
    <Note style={{textAlign:'center', display:'block', marginTop:4}}>or manual lookup</Note>
  </div>
);

const KioskB = () => (
  <div className="wf" style={{width: KiW, height: KiH, padding: 14}}>
    <div className="row" style={{justifyContent:'space-between'}}>
      <div style={{fontWeight:800, fontSize:13}}>Find your booking</div>
      <Pill>EN</Pill>
    </div>
    <Spacer h={14}/>
    <Box solid style={{padding:12, textAlign:'center', fontSize:18, fontWeight:800}}>4 1 2 _</Box>
    <Note style={{textAlign:'center', display:'block', marginTop:4}}>Room number</Note>
    <Spacer h={10}/>
    <div className="grid3" style={{gap:4}}>
      {[1,2,3,4,5,6,7,8,9,'⌫',0,'✓'].map(k=>(
        <Box key={k} style={{height:38, textAlign:'center', padding:8, fontWeight:800}}>{k}</Box>
      ))}
    </div>
    <Spacer h={10}/>
    <Note style={{textAlign:'center', display:'block'}}>or tap wristband</Note>
  </div>
);

const KioskC = () => (
  <div className="wf" style={{width: KiW, height: KiH, padding: 14}}>
    <div style={{textAlign:'center', fontSize:13, fontWeight:800, marginBottom: 8}}>Scan your room QR</div>
    <Note style={{textAlign:'center', display:'block', marginBottom: 14}}>found in welcome email</Note>
    <div style={{margin:'0 auto', width: 180, height: 180, padding: 8,
      background: 'repeating-conic-gradient(var(--ink) 0% 5%, #FDFBF6 5% 10%)',
      border:'1.5px solid var(--ink)'}}>
      <div style={{width:'100%', height:'100%', background: 'radial-gradient(circle, var(--bg) 30%, transparent 30%) 0 0/16px 16px'}}/>
    </div>
    <Spacer h={14}/>
    <div className="row" style={{gap:6, justifyContent:'center'}}>
      <Pill>or tap wristband</Pill>
      <Pill>or keypad</Pill>
    </div>
    <Spacer h={20}/>
    <Box dashed style={{padding:8, textAlign:'center'}}>📷 camera preview</Box>
  </div>
);

// ───────────────────────────────────────────────────────────────
// Canvas
// ───────────────────────────────────────────────────────────────
function App() {
  return (
    <DesignCanvas>
      <DCSection id="guest-home" title="Guest · Home / today" subtitle="Where the journey starts — booking summary + quick actions">
        <DCArtboard id="ga" label="A · Stacked list" width={MOB_W} height={MOB_H}><GuestHomeA/></DCArtboard>
        <DCArtboard id="gb" label="B · Card grid" width={MOB_W} height={MOB_H}><GuestHomeB/></DCArtboard>
        <DCArtboard id="gc" label="C · Conversational" width={MOB_W} height={MOB_H}><GuestHomeC/></DCArtboard>
      </DCSection>

      <DCSection id="menu" title="Guest · Menu browsing" subtitle="Filter, dietary auto-hide, pre-order">
        <DCArtboard id="ma" label="A · List + filter chips" width={MOB_W} height={MOB_H}><MenuA/></DCArtboard>
        <DCArtboard id="mb" label="B · Image-first gallery" width={MOB_W} height={MOB_H}><MenuB/></DCArtboard>
        <DCArtboard id="mc" label="C · Course tabs" width={MOB_W} height={MOB_H}><MenuC/></DCArtboard>
      </DCSection>

      <DCSection id="seat" title="Guest · Seat selection" subtitle="Indoor / outdoor / poolside / booth · accessibility">
        <DCArtboard id="sa" label="A · Floor plan" width={MOB_W} height={MOB_H}><SeatA/></DCArtboard>
        <DCArtboard id="sb" label="B · List by area" width={MOB_W} height={MOB_H}><SeatB/></DCArtboard>
        <DCArtboard id="sc" label="C · Time-strip grid" width={MOB_W} height={MOB_H}><SeatC/></DCArtboard>
      </DCSection>

      <DCSection id="console" title="Employee · Live floor console" subtitle="The host & floor-manager view">
        <DCArtboard id="ca" label="A · Three-pane" width={DSK_W} height={DSK_H}><ConsoleA/></DCArtboard>
        <DCArtboard id="cb" label="B · Timeline-first" width={DSK_W} height={DSK_H}><ConsoleB/></DCArtboard>
        <DCArtboard id="cc" label="C · Map-fullscreen + floating" width={DSK_W} height={DSK_H}><ConsoleC/></DCArtboard>
      </DCSection>

      <DCSection id="kiosk" title="Kiosk · Self-service check-in" subtitle="Touchless arrival at the restaurant door">
        <DCArtboard id="ka" label="A · Tap NFC" width={KiW} height={KiH}><KioskA/></DCArtboard>
        <DCArtboard id="kb" label="B · Keypad" width={KiW} height={KiH}><KioskB/></DCArtboard>
        <DCArtboard id="kc" label="C · QR" width={KiW} height={KiH}><KioskC/></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
