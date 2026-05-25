// Live terminal output panel (Panel 2).
const { useEffect, useRef, useState } = React;

const KIND_COLORS = {
  info:  '#5aa9ff',
  ok:    '#4ec97a',
  warn:  '#e6b34a',
  err:   '#ef5d5d',
  muted: '#6b7588',
  plain: '#cdd5e0',
};

function Terminal({ lines, runId, label, status }){
  // Stream lines in one at a time when runId changes.
  const [visible, setVisible] = useState(0);
  const scrollerRef = useRef(null);

  useEffect(()=>{
    if(!lines || lines.length === 0){ setVisible(0); return; }
    setVisible(0);
    let i = 0;
    let t;
    const tick = ()=>{
      i++;
      setVisible(i);
      if(i < lines.length){
        // OK rows are fast, info/warn slightly slower
        const k = lines[i-1].kind;
        const delay = k === 'ok' ? 90 : k === 'info' ? 240 : 140;
        t = setTimeout(tick, delay);
      }
    };
    t = setTimeout(tick, 200);
    return ()=>clearTimeout(t);
  }, [runId, lines]);

  // Auto-scroll
  useEffect(()=>{
    const el = scrollerRef.current;
    if(el) el.scrollTop = el.scrollHeight;
  }, [visible]);

  const running = visible < (lines?.length || 0);

  return (
    <section style={termStyles.panel}>
      <header style={termStyles.head}>
        <div style={termStyles.dots}>
          <span style={{...termStyles.dot, background:'#ef5d5d'}}/>
          <span style={{...termStyles.dot, background:'#e6b34a'}}/>
          <span style={{...termStyles.dot, background:'#4ec97a'}}/>
        </div>
        <div style={termStyles.title}>
          <span style={{color:'#9aa6b8'}}>terminal —</span>&nbsp;
          <span style={{color:'#e6edf3'}}>{label || 'idle'}</span>
        </div>
        <div style={termStyles.statusPill(status)}>
          <span style={{
            width:6,height:6,borderRadius:99,
            background: status==='running' ? '#e6b34a' : status==='done' ? '#4ec97a' : status==='err' ? '#ef5d5d' : '#6b7588',
            boxShadow: status==='running' ? '0 0 8px #e6b34a' : 'none',
            animation: status==='running' ? 'pulse 1.2s ease-in-out infinite' : 'none',
          }}/>
          {status || 'idle'}
        </div>
      </header>

      <div ref={scrollerRef} style={termStyles.body}>
        {(!lines || lines.length===0) && (
          <div style={{color:'#6b7588', fontStyle:'italic'}}>
            <div>// Waiting for input.</div>
            <div>// 1. Pick an .xlsx file with the Upload button.</div>
            <div>// 2. Press Dry Run to validate, or Submit to write to Jira.</div>
          </div>
        )}
        {lines && lines.slice(0, visible).map((ln, i)=>(
          <div key={i} style={{color: KIND_COLORS[ln.kind] || KIND_COLORS.plain, whiteSpace:'pre'}}>
            {ln.text}
          </div>
        ))}
        {running && (
          <div style={{display:'flex', alignItems:'center', gap:6, color:'#9aa6b8'}}>
            <span>$</span>
            <span style={{
              display:'inline-block', width:8, height:14,
              background:'#9aa6b8',
              animation:'blink 1s steps(2,start) infinite',
              transform:'translateY(2px)',
            }}/>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse{ 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes blink{ to { visibility:hidden } }
      `}</style>
    </section>
  );
}

const termStyles = {
  panel:{
    background:'#0b0e13',
    border:'1px solid #1f2633',
    borderRadius:10,
    display:'flex', flexDirection:'column',
    overflow:'hidden',
    minHeight:0,
    height:'100%',
  },
  head:{
    display:'flex', alignItems:'center', gap:12,
    padding:'10px 12px',
    background:'#11151c',
    borderBottom:'1px solid #1f2633',
  },
  dots:{ display:'flex', gap:6 },
  dot:{ width:10, height:10, borderRadius:99 },
  title:{
    fontFamily:'JetBrains Mono, monospace', fontSize:12,
    flex:1, textAlign:'center',
  },
  statusPill:(status)=>({
    display:'inline-flex', alignItems:'center', gap:6,
    padding:'3px 8px',
    borderRadius:99,
    fontFamily:'JetBrains Mono, monospace', fontSize:11,
    background:'#1a2030',
    color:'#cdd5e0',
    border:'1px solid #232c3d',
    textTransform:'uppercase', letterSpacing:0.5,
  }),
  body:{
    flex:1,
    overflow:'auto',
    padding:'14px 14px 18px',
    fontFamily:'JetBrains Mono, monospace',
    fontSize:12.5,
    lineHeight:1.55,
    background:
      'radial-gradient(1200px 400px at 0% 0%, rgba(243,112,33,0.04), transparent 60%),'+
      'radial-gradient(900px 600px at 100% 100%, rgba(90,169,255,0.04), transparent 60%),'+
      '#0b0e13',
  },
};

window.Terminal = Terminal;
