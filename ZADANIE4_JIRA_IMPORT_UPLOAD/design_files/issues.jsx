// Panel 3 — validation issues & stats
function Issues({ data, validated, onHoverKey, filter, setFilter }){
  const { VALIDATION } = data;

  const counts = validated ? {
    total: 100,
    ok: 42,
    warn: 58,
    err: 0,
  } : { total: 0, ok: 0, warn: 0, err: 0 };

  const filtered = validated
    ? VALIDATION.filter(v => filter === 'ALL' ? true : v.level === filter)
    : [];

  return (
    <section style={issStyles.panel}>
      <header style={issStyles.head}>
        <div style={{display:'flex', alignItems:'center', gap:14}}>
          <h3 style={issStyles.title}>Issues found</h3>
          <span style={{color:'#6b7588', fontSize:12}}>read before submitting</span>
        </div>

        <div style={issStyles.statsRow}>
          <Stat label="TOTAL" value={counts.total} tone="ink"/>
          <Stat label="OK"    value={counts.ok}    tone="ok"/>
          <Stat label="WARN"  value={counts.warn}  tone="warn"/>
          <Stat label="ERR"   value={counts.err}   tone="err"/>
        </div>
      </header>

      <div style={issStyles.tabs}>
        {['ALL','OK','WARN','ERR'].map(t=>(
          <button key={t}
            onClick={()=>setFilter(t)}
            style={issStyles.tab(filter===t, t)}>
            {t}
            <span style={issStyles.tabCount}>
              {t==='ALL'? counts.total : t==='OK'? counts.ok : t==='WARN'? counts.warn : counts.err}
            </span>
          </button>
        ))}
        <div style={{flex:1}}/>
        <div style={issStyles.legend}>
          <LegendDot color="#4ec97a" label="will submit"/>
          <LegendDot color="#e6b34a" label="submit w/ warning"/>
          <LegendDot color="#ef5d5d" label="blocked"/>
        </div>
      </div>

      <div style={issStyles.scroll}>
        {!validated && (
          <div style={issStyles.empty}>
            <div style={{fontSize:34, lineHeight:1, color:'#2a3242', fontFamily:'JetBrains Mono, monospace'}}>—</div>
            <div style={{marginTop:10, color:'#6b7588'}}>Run validation to see parsed entries here.</div>
            <div style={{marginTop:4, color:'#3f4658', fontSize:12}}>Tip: Dry Run does this without writing to Jira.</div>
          </div>
        )}
        {validated && filtered.map((v, i)=>(
          <div key={i}
            onMouseEnter={()=>onHoverKey(v.key)}
            onMouseLeave={()=>onHoverKey(null)}
            style={issStyles.line(v.level)}>
            <span style={issStyles.lineNo}>#{v.row}</span>
            <span style={issStyles.level(v.level)}>{v.level}</span>
            <span style={issStyles.sheet}>{v.sheet}</span>
            <span style={issStyles.key}>{v.key}</span>
            <span style={issStyles.date}>{v.date}</span>
            <span style={issStyles.hrs}>{v.hrs.toFixed(2)}h</span>
            <span style={issStyles.who}>{v.who}</span>
            <span style={issStyles.desc} title={v.desc}>{v.desc}</span>
            {v.flag && (
              <span style={issStyles.flag(v.level)}>
                <span style={{opacity:0.85}}>[!]</span> {v.flag}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value, tone }){
  const colors = { ink:'#e6edf3', ok:'#4ec97a', warn:'#e6b34a', err:'#ef5d5d' };
  return (
    <div style={{display:'flex',alignItems:'baseline',gap:6}}>
      <span style={{fontSize:10,letterSpacing:0.8,color:'#6b7588',fontWeight:700}}>{label}</span>
      <span style={{fontFamily:'JetBrains Mono, monospace',fontSize:15,fontWeight:700,color:colors[tone]}}>
        {value}
      </span>
    </div>
  );
}

function LegendDot({ color, label }){
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:6,color:'#6b7588',fontSize:11}}>
      <span style={{width:7,height:7,borderRadius:99,background:color}}/>
      {label}
    </span>
  );
}

const LEVEL_COLOR = { OK:'#4ec97a', WARN:'#e6b34a', ERR:'#ef5d5d' };

const issStyles = {
  panel:{
    background:'#11151c',
    border:'1px solid #1f2633',
    borderRadius:10,
    display:'flex', flexDirection:'column',
    overflow:'hidden',
    minHeight:0,
    height:'100%',
  },
  head:{
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 16px',
    borderBottom:'1px solid #1f2633',
    gap:18,
  },
  title:{ margin:0, fontSize:14, fontWeight:600, color:'#e6edf3', letterSpacing:0.2 },
  statsRow:{ display:'flex', gap:18 },

  tabs:{
    display:'flex', alignItems:'center', gap:6,
    padding:'8px 12px',
    borderBottom:'1px solid #1f2633',
    background:'#0e1218',
  },
  tab:(active, t)=>({
    appearance:'none',
    background: active ? '#1a2233' : 'transparent',
    border:'1px solid '+(active ? '#2c3a55' : 'transparent'),
    color: active ? (t==='OK'?'#4ec97a':t==='WARN'?'#e6b34a':t==='ERR'?'#ef5d5d':'#e6edf3') : '#9aa6b8',
    padding:'4px 10px', borderRadius:6,
    fontSize:11, fontWeight:700, letterSpacing:0.5,
    cursor:'pointer',
    display:'inline-flex', alignItems:'center', gap:6,
  }),
  tabCount:{
    fontFamily:'JetBrains Mono, monospace', fontSize:10,
    color:'#6b7588', fontWeight:600,
  },
  legend:{ display:'flex', gap:14 },

  scroll:{
    flex:1, overflow:'auto',
    fontFamily:'JetBrains Mono, monospace',
    fontSize:12,
    padding:'4px 0',
  },
  empty:{
    height:'100%',
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    textAlign:'center', padding:20,
  },
  line:(lvl)=>({
    display:'grid',
    gridTemplateColumns:'42px 50px 110px 70px 100px 56px 130px minmax(120px, 1fr) minmax(0, 1.4fr)',
    columnGap:10,
    alignItems:'center',
    padding:'6px 16px',
    borderLeft: '3px solid '+(lvl==='ERR'?'#ef5d5d':lvl==='WARN'?'#e6b34a':'transparent'),
    borderBottom:'1px solid #161c26',
    cursor:'default',
  }),
  lineNo:{ color:'#5a6478', textAlign:'right' },
  level:(lvl)=>({
    color: LEVEL_COLOR[lvl], fontWeight:700, letterSpacing:0.6, fontSize:11,
  }),
  sheet:{ color:'#9aa6b8' },
  key:{ color:'#5aa9ff', fontWeight:600 },
  date:{ color:'#cdd5e0' },
  hrs: { color:'#e6edf3', textAlign:'right' },
  who: { color:'#9aa6b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  desc:{ color:'#7a8499', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  flag:(lvl)=>({
    color: lvl==='ERR'?'#ef8a8a':'#f3c97a',
    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
  }),
};

window.Issues = Issues;
