// Main app — orchestrates the 4-panel layout and the state machine.
const { useState, useMemo, useCallback } = React;
const { Logo, Terminal, Grid, Issues, Controls } = window;
const DATA = window.IMPORTER_DATA;

/*
  Phase machine:
    idle         -> no file picked
    fileReady    -> file picked, nothing run
    dryRunning   -> validation streaming
    dryDone      -> validation finished, issues panel populated
    submitting   -> actually writing to Jira/Tempo
    submitDone   -> all worklogs written
*/

function App(){
  const [phase, setPhase]         = useState('idle');
  const [fileName, setFileName]   = useState(null);
  const [runId, setRunId]         = useState(0);
  const [filter, setFilter]       = useState('ALL');
  const [hoveredKey, setHovered]  = useState(null);

  const handleUpload = (name) => {
    setFileName(name);
    setPhase('fileReady');
    setFilter('ALL');
  };

  const handleReset = () => {
    setFileName(null);
    setPhase('idle');
    setFilter('ALL');
  };

  const handleDryRun = () => {
    setPhase('dryRunning');
    setRunId(id => id+1);
    // total duration ~= number of lines * avg delay; use a rough timer
    const lines = DATA.TERMINAL_DRY_LINES.length;
    const dur = 200 + lines * 160;
    setTimeout(()=>setPhase('dryDone'), dur);
  };

  const handleSubmit = () => {
    setPhase('submitting');
    setRunId(id => id+1);
    const lines = DATA.TERMINAL_SUBMIT_LINES.length;
    const dur = 200 + lines * 150;
    setTimeout(()=>setPhase('submitDone'), dur);
  };

  // Pick terminal content & status
  const terminalLines =
    phase === 'dryRunning' || phase === 'dryDone'      ? DATA.TERMINAL_DRY_LINES :
    phase === 'submitting' || phase === 'submitDone'   ? DATA.TERMINAL_SUBMIT_LINES :
    null;

  const terminalLabel =
    phase === 'idle'         ? 'jira-importer' :
    phase === 'fileReady'    ? `jira-importer · ${fileName}` :
    phase === 'dryRunning'   ? 'dry-run.py' :
    phase === 'dryDone'      ? 'dry-run.py (done)' :
    phase === 'submitting'   ? 'submit.py' :
    'submit.py (done)';

  const terminalStatus =
    phase === 'dryRunning' || phase === 'submitting' ? 'running' :
    phase === 'dryDone'   || phase === 'submitDone' ? 'done'    :
    'idle';

  const validated = phase === 'dryDone' || phase === 'submitting' || phase === 'submitDone';

  // Grid is empty until dry run completes; then shows diff; after submit it shows the final state.
  const gridMode =
    phase === 'submitDone' ? 'final' :
    (phase === 'dryDone' || phase === 'submitting') ? 'preview' :
    'empty';

  return (
    <div style={app.shell}>
      {/* Top bar */}
      <header style={app.topbar}>
        <div style={app.topLeft}>
          <Logo/>
          <div style={app.divider}/>
          <div>
            <div style={app.appTitle}>Jira Worklog Importer</div>
            <div style={app.appSub}>v2.4 · internal tool · Excel → Jira / Tempo</div>
          </div>
        </div>

        <div style={app.topRight}>
          <PhasePill phase={phase}/>
          <div style={app.user}>
            <div style={app.avatar}>TM</div>
            <div>
              <div style={{fontSize:12, color:'#e6edf3', fontWeight:600}}>Theo Marsh</div>
              <div style={{fontSize:11, color:'#6b7588'}}>tmarsh@fpt.com</div>
            </div>
          </div>
        </div>
      </header>

      {/* 4-panel layout */}
      <main style={app.grid}>
        {/* Panel 1 — Jira preview (large, top-left) */}
        <div style={{...app.cell, gridArea:'a'}}>
          <Grid
            data={DATA}
            mode={gridMode}
            highlightedKey={hoveredKey}
            dim={hoveredKey != null}/>
        </div>

        {/* Panel 2 — terminal (right) */}
        <div style={{...app.cell, gridArea:'b'}}>
          <Terminal
            lines={terminalLines}
            runId={runId}
            label={terminalLabel}
            status={terminalStatus}/>
        </div>

        {/* Panel 3 — issues / stats (bottom-left) */}
        <div style={{...app.cell, gridArea:'c'}}>
          <Issues
            data={DATA}
            validated={validated}
            onHoverKey={setHovered}
            filter={filter}
            setFilter={setFilter}/>
        </div>

        {/* Controls (bottom-right) */}
        <div style={{...app.cell, gridArea:'d'}}>
          <Controls
            phase={phase}
            fileName={fileName}
            onUpload={handleUpload}
            onReset={handleReset}
            onDryRun={handleDryRun}
            onSubmit={handleSubmit}/>
        </div>
      </main>
    </div>
  );
}

function PhasePill({ phase }){
  const map = {
    idle:        { label:'Awaiting file',   color:'#6b7588', dot:'#6b7588' },
    fileReady:   { label:'Ready to run',    color:'#5aa9ff', dot:'#5aa9ff' },
    dryRunning:  { label:'Dry run · running', color:'#e6b34a', dot:'#e6b34a', pulse:true },
    dryDone:     { label:'Dry run complete', color:'#4ec97a', dot:'#4ec97a' },
    submitting:  { label:'Submitting to Jira', color:'#F37021', dot:'#F37021', pulse:true },
    submitDone:  { label:'Submitted ✓',     color:'#4ec97a', dot:'#4ec97a' },
  };
  const m = map[phase];
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:8,
      padding:'6px 12px', borderRadius:99,
      background:'#161d2a', border:'1px solid #232c3d',
      color:m.color, fontSize:12, fontWeight:600,
    }}>
      <span style={{
        width:8, height:8, borderRadius:99, background:m.dot,
        boxShadow: m.pulse ? `0 0 10px ${m.dot}` : 'none',
        animation: m.pulse ? 'pulse 1.2s ease-in-out infinite' : 'none',
      }}/>
      {m.label}
    </div>
  );
}

const app = {
  shell:{
    height:'100vh',
    overflow:'hidden',
    display:'flex', flexDirection:'column',
    background:'#0e1116',
    background:
      'radial-gradient(1200px 700px at 100% 0%, rgba(243,112,33,0.05), transparent 60%),'+
      'radial-gradient(900px 600px at 0% 100%, rgba(31,122,224,0.05), transparent 60%),'+
      '#0e1116',
  },
  topbar:{
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'14px 22px',
    borderBottom:'1px solid #1f2633',
    background:'rgba(17, 21, 28, 0.6)',
    backdropFilter:'blur(8px)',
  },
  topLeft:{ display:'flex', alignItems:'center', gap:16 },
  divider:{ width:1, height:28, background:'#262d3a' },
  appTitle:{ fontSize:14, fontWeight:600, color:'#e6edf3', letterSpacing:0.2 },
  appSub:{ fontSize:11, color:'#6b7588' },
  topRight:{ display:'flex', alignItems:'center', gap:16 },
  user:{ display:'flex', alignItems:'center', gap:10 },
  avatar:{
    width:32, height:32, borderRadius:99,
    background:'linear-gradient(135deg, #F37021 0%, #1F7AE0 100%)',
    color:'#fff', fontWeight:700, fontSize:11,
    display:'flex', alignItems:'center', justifyContent:'center',
    letterSpacing:0.5,
  },

  grid:{
    flex:1,
    display:'grid',
    gridTemplateColumns:'minmax(0, 1fr) 460px',
    gridTemplateRows:'minmax(0, 1.45fr) minmax(0, 1fr)',
    gridTemplateAreas:`
      "a b"
      "c d"
    `,
    gap:14,
    padding:14,
    height:'calc(100vh - 65px)',
    minHeight:0,
    overflow:'hidden',
  },
  cell:{ minHeight:0, minWidth:0 },
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
