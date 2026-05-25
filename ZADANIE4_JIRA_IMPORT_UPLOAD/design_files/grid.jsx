// Panel 1: Jira / Tempo-style data grid — tasks x days
// Three modes:
//   - 'empty'   : nothing uploaded / not validated yet
//   - 'preview' : after dry run, shows Current (in Jira) vs Adding (incoming) vs New Total, with per-day adds
//   - 'final'   : after submit, simplified single-total view (everything is now "in Jira")

function Grid({ data, mode, highlightedKey, dim }){
  if(mode === 'empty') return <GridEmpty/>;

  const { TASKS, DAYS, MATRIX, CURRENT_MATRIX,
          DAY_TOTALS, CURRENT_DAY_TOTALS,
          GRAND_TOTAL, CURRENT_GRAND_TOTAL } = data;

  const isFinal = mode === 'final';

  return (
    <section style={gridStyles.panel}>
      <header style={gridStyles.head}>
        <div>
          <div style={gridStyles.eyebrow}>
            {isFinal ? 'Submitted — worklogs now live in Jira / Tempo' : 'Preview — diff between Jira and incoming Excel'}
          </div>
          <h2 style={gridStyles.title}>Brightline · Worklog import</h2>
        </div>
        <div style={gridStyles.headRight}>
          {!isFinal && (
            <div style={gridStyles.legend}>
              <span style={gridStyles.swatch('#3a4256')}/> in Jira
              <span style={{...gridStyles.swatch('#F37021'), marginLeft:10}}/> being added
            </div>
          )}
          {isFinal && (
            <div style={{...gridStyles.legend, color:'#4ec97a', borderColor:'#264a33', background:'rgba(78,201,122,0.06)'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ec97a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{marginLeft:6}}>100 worklog(s) written</span>
            </div>
          )}
          <div style={gridStyles.dateBox}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa6b8" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
            03/May/26 — 16/May/26
          </div>
        </div>
      </header>

      <div style={gridStyles.scroller}>
        <div style={gridStyles.gridWrap}>
          {/* Header row */}
          <div style={gridStyles.row(true, false, false, false, isFinal)}>
            <div style={gridStyles.taskCol}>
              <span style={gridStyles.colLabel}>Issue</span>
            </div>
            <div style={gridStyles.keyCol}>
              <span style={gridStyles.colLabel}>Key</span>
            </div>
            {!isFinal && (
              <div style={gridStyles.numCol}>
                <span style={gridStyles.colLabel}>In Jira</span>
              </div>
            )}
            {!isFinal && (
              <div style={gridStyles.numCol}>
                <span style={{...gridStyles.colLabel, color:'#F37021'}}>+ Adding</span>
              </div>
            )}
            <div style={gridStyles.numCol}>
              <span style={gridStyles.colLabel}>{isFinal ? 'Logged' : 'New total'}</span>
            </div>
            {DAYS.map((d,i)=>(
              <div key={i} style={gridStyles.dayHead(d.off)}>
                <div style={{fontSize:12,fontWeight:700,color:d.off?'#5a6478':'#e6edf3'}}>{d.d}</div>
                <div style={{fontSize:10,letterSpacing:0.6,color:d.off?'#3f4658':'#7a8499'}}>{d.wd}</div>
              </div>
            ))}
          </div>

          {/* Body */}
          {TASKS.map((t, ti)=>{
            const hi = highlightedKey === t.key;
            const dimmed = dim && !hi;
            const current = t.currentJira;
            const adding  = t.total;
            const newTotal = current + adding;
            return (
              <div key={t.key} style={gridStyles.row(false, hi, dimmed, false, isFinal)}>
                <div style={gridStyles.taskCol}>
                  <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
                    <span style={gridStyles.checkbox}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#1F7AE0" strokeWidth="4"><path d="M4 12l5 5L20 6"/></svg>
                    </span>
                    <span style={gridStyles.taskText} title={t.title}>{t.title}</span>
                  </div>
                </div>
                <div style={gridStyles.keyCol}>
                  <span style={gridStyles.keyChip}>{t.key}</span>
                </div>
                {!isFinal && (
                  <div style={gridStyles.numCol}>
                    <span style={gridStyles.numCurrent}>{current === 0 ? '—' : current.toFixed(current%1===0?0:1)}</span>
                  </div>
                )}
                {!isFinal && (
                  <div style={gridStyles.numCol}>
                    <span style={gridStyles.numAdding}>+{adding.toFixed(adding%1===0?0:1)}</span>
                  </div>
                )}
                <div style={gridStyles.numCol}>
                  <span style={gridStyles.numTotal}>{newTotal.toFixed(newTotal%1===0?0:1)}</span>
                </div>
                {DAYS.map((d, di)=>{
                  const cur = CURRENT_MATRIX[ti][di];
                  const add = MATRIX[ti][di];
                  return <DayCell key={di} off={d.off} cur={cur} add={add} merged={isFinal}/>;
                })}
              </div>
            );
          })}

          {/* Total row */}
          <div style={gridStyles.row(false, false, false, true, isFinal)}>
            <div style={gridStyles.taskCol}>
              <strong style={{color:'#e6edf3'}}>Total</strong>
            </div>
            <div style={gridStyles.keyCol}/>
            {!isFinal && (
              <div style={gridStyles.numCol}>
                <span style={gridStyles.numCurrentTotal}>{CURRENT_GRAND_TOTAL.toFixed(1)}</span>
              </div>
            )}
            {!isFinal && (
              <div style={gridStyles.numCol}>
                <span style={gridStyles.numAddingTotal}>+{GRAND_TOTAL.toFixed(1)}</span>
              </div>
            )}
            <div style={gridStyles.numCol}>
              <span style={gridStyles.numGrand}>{(CURRENT_GRAND_TOTAL + GRAND_TOTAL).toFixed(1)}</span>
            </div>
            {DAYS.map((d,di)=>(
              <DayCell key={di} off={d.off}
                cur={CURRENT_DAY_TOTALS[di]}
                add={DAY_TOTALS[di]}
                merged={isFinal}
                isTotal/>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DayCell({ off, cur, add, isTotal, merged }){
  const hasCur = cur > 0;
  const hasAdd = add > 0;
  const fmt = (v) => v % 1 === 0 ? v.toFixed(0) : v.toFixed(2);

  // After submit, the orange add is folded into the current value.
  if(merged){
    const total = cur + add;
    const hasTotal = total > 0;
    // Briefly flash the just-written cells green-ish via a subtle bg tint.
    return (
      <div style={gridStyles.cell(off, false, isTotal, hasAdd && !off)}>
        {hasTotal ? (
          <div style={{
            fontSize:12, lineHeight:1.1, fontWeight: hasAdd ? 700 : 500,
            color: hasAdd ? '#e6edf3' : '#9aa6b8',
            fontFamily:'JetBrains Mono, monospace',
          }}>{fmt(total)}</div>
        ) : (
          <span style={{color: off ? '#2b3346' : '#3a4256'}}>·</span>
        )}
      </div>
    );
  }

  return (
    <div style={gridStyles.cell(off, hasAdd, isTotal)}>
      {hasCur && (
        <div style={{
          fontSize:10, lineHeight:1.1,
          color: off ? '#2b3346' : isTotal ? '#7a8499' : '#5a6478',
          fontFamily:'JetBrains Mono, monospace',
        }}>{fmt(cur)}</div>
      )}
      {hasAdd && (
        <div style={{
          fontSize:12, lineHeight:1.1, fontWeight:600,
          color:'#F37021',
          fontFamily:'JetBrains Mono, monospace',
          marginTop: hasCur ? 1 : 0,
        }}>+{fmt(add)}</div>
      )}
      {!hasCur && !hasAdd && (
        <span style={{color: off ? '#2b3346' : '#3a4256'}}>·</span>
      )}
    </div>
  );
}

function GridEmpty(){
  return (
    <section style={gridStyles.panel}>
      <header style={gridStyles.head}>
        <div>
          <div style={gridStyles.eyebrow}>Preview</div>
          <h2 style={gridStyles.title}>Brightline · Worklog import</h2>
        </div>
      </header>
      <div style={emptyStyles.body}>
        <div style={emptyStyles.glyph}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#3a4256" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/>
            <line x1="8" y1="17" x2="13" y2="17"/>
          </svg>
        </div>
        <div style={emptyStyles.title}>No data yet</div>
        <div style={emptyStyles.sub}>
          Upload an <span style={{color:'#cdd5e0', fontFamily:'JetBrains Mono, monospace'}}>.xlsx</span> file and run validation to see how worklogs will be added to Jira.
        </div>
        <ol style={emptyStyles.steps}>
          <li><span style={emptyStyles.stepNum}>1</span> Upload your Excel file</li>
          <li><span style={emptyStyles.stepNum}>2</span> Run a <strong style={{color:'#cdd5e0'}}>Dry run</strong> to validate &amp; pull current Jira hours</li>
          <li><span style={emptyStyles.stepNum}>3</span> Review the diff here, then submit</li>
        </ol>
      </div>
    </section>
  );
}

const gridStyles = {
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
    display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16,
    padding:'14px 18px',
    borderBottom:'1px solid #1f2633',
    background:'linear-gradient(180deg, #161b22 0%, #11151c 100%)',
  },
  eyebrow:{
    color:'#6b7588', fontSize:11, letterSpacing:0.6, textTransform:'uppercase', fontWeight:600,
  },
  title:{
    margin:'4px 0 0', fontSize:18, fontWeight:600, color:'#e6edf3',
  },
  headRight:{ display:'flex', alignItems:'center', gap:10 },
  legend:{
    display:'inline-flex', alignItems:'center', gap:6,
    fontSize:11, color:'#9aa6b8',
    padding:'6px 10px',
    border:'1px solid #2a3242', borderRadius:6, background:'#0e1218',
  },
  swatch:(c)=>({
    display:'inline-block', width:10, height:10, borderRadius:2, background:c,
    marginRight:4,
  }),
  dateBox:{
    display:'inline-flex', alignItems:'center', gap:8,
    fontSize:12, fontFamily:'JetBrains Mono, monospace',
    color:'#cdd5e0',
    padding:'6px 10px',
    border:'1px solid #2a3242', borderRadius:6, background:'#0e1218',
  },
  colLabel:{
    color:'#9aa6b8', fontWeight:600, fontSize:10.5, letterSpacing:0.7, textTransform:'uppercase',
  },
  scroller:{ flex:1, overflow:'auto' },
  gridWrap:{ minWidth: 1320 },

  row:(isHead, highlight, dimmed, total, isFinal)=>({
    display:'grid',
    gridTemplateColumns: isFinal
      ? 'minmax(280px,1.6fr) 90px 90px repeat(14, 48px)'
      : 'minmax(240px,1.4fr) 80px 64px 72px 78px repeat(14, 42px)',
    alignItems:'center',
    borderBottom: isHead ? '1px solid #232c3d' : '1px solid #1a2030',
    background: total ? '#161d2a' : highlight ? 'rgba(243,112,33,0.08)' : isHead ? '#0e1218' : 'transparent',
    opacity: dimmed ? 0.35 : 1,
    transition:'background .25s, opacity .25s',
    position: total ? 'sticky' : 'static',
    bottom: total ? 0 : undefined,
    boxShadow: total ? '0 -8px 12px -8px rgba(0,0,0,0.6)' : 'none',
  }),
  taskCol:{ padding:'8px 12px', minWidth:0 },
  keyCol:{ padding:'8px 8px', textAlign:'left' },
  numCol:{ padding:'8px 8px', textAlign:'right', fontFamily:'JetBrains Mono, monospace' },

  taskText:{
    color:'#cdd5e0', fontSize:13,
    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
    display:'block', minWidth:0,
  },
  checkbox:{
    width:14, height:14, borderRadius:3,
    background:'#0e1218', border:'1.5px solid #1F7AE0',
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    flexShrink:0,
  },
  keyChip:{
    fontFamily:'JetBrains Mono, monospace',
    fontSize:11.5, color:'#5aa9ff', fontWeight:600, letterSpacing:0.3,
  },

  numCurrent:{ color:'#7a8499', fontSize:12, fontWeight:500 },
  numAdding: { color:'#F37021', fontSize:12.5, fontWeight:700 },
  numTotal:  { color:'#e6edf3', fontSize:13, fontWeight:700 },
  numCurrentTotal:{ color:'#cdd5e0', fontSize:12.5, fontWeight:600 },
  numAddingTotal: { color:'#F37021', fontSize:13.5, fontWeight:800 },
  numGrand:       { color:'#fff',    fontSize:14, fontWeight:800 },

  dayHead:(off)=>({
    padding:'8px 0',
    textAlign:'center',
    background: off ? '#0b0e13' : 'transparent',
    borderLeft:'1px solid #1a2030',
  }),
  cell:(off, hasAdd, isTotal, justWritten)=>({
    padding:'6px 0',
    textAlign:'center',
    fontFamily:'JetBrains Mono, monospace',
    background: off ? '#0b0e13'
              : justWritten ? 'rgba(78,201,122,0.08)'
              : hasAdd ? 'rgba(243,112,33,0.06)'
              : isTotal ? '#161d2a'
              : 'transparent',
    borderLeft:'1px solid #1a2030',
    minHeight: 38,
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
  }),
};

const emptyStyles = {
  body:{
    flex:1,
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    padding:30, textAlign:'center', gap:8,
  },
  glyph:{
    width:104, height:104, borderRadius:99,
    border:'1px dashed #2a3242',
    display:'flex', alignItems:'center', justifyContent:'center',
    background:'#0e1218',
    marginBottom:6,
  },
  title:{ fontSize:18, fontWeight:600, color:'#cdd5e0' },
  sub:{ fontSize:13, color:'#6b7588', maxWidth:420, lineHeight:1.6 },
  steps:{
    listStyle:'none', padding:0, margin:'14px 0 0',
    display:'flex', flexDirection:'column', gap:8,
    fontSize:12.5, color:'#7a8499', textAlign:'left',
  },
  stepNum:{
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    width:20, height:20, borderRadius:99,
    background:'#1a2030', border:'1px solid #2a3242',
    color:'#9aa6b8', fontSize:11, fontWeight:700,
    marginRight:10, fontFamily:'JetBrains Mono, monospace',
  },
};

window.Grid = Grid;
