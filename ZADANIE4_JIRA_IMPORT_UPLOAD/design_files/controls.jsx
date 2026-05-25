// Bottom-right controls cluster — Dry Run (4), Submit (5), Upload (6)
function Controls({ phase, fileName, onUpload, onDryRun, onSubmit, onReset }){
  const fileRef = React.useRef(null);
  const canDry    = (phase === 'fileReady' || phase === 'dryDone' || phase === 'submitDone');
  const canSubmit = (phase === 'dryDone');
  const busy      = phase === 'dryRunning' || phase === 'submitting';

  return (
    <section style={ctlStyles.panel}>
      {/* File status + config (compact) */}
      <div style={ctlStyles.fileBlock}>
        <div style={ctlStyles.fileRow}>
          <FileIcon/>
          <div style={{minWidth:0, flex:1}}>
            <div style={ctlStyles.fileLabel}>Source file</div>
            <div style={ctlStyles.fileName} title={fileName || 'No file selected'}>
              {fileName || <span style={{color:'#6b7588'}}>No file selected</span>}
            </div>
          </div>
          {fileName && (
            <button onClick={onReset} style={ctlStyles.linkBtn}>change</button>
          )}
        </div>

        <div style={ctlStyles.metaLine}>
          <MetaInline label="PROJECT" value="ATX · Brightline"/>
          <MetaInline label="PERIOD"  value="03–16 May"/>
          <MetaInline label="TARGET"  value="jira.fpt.com · Tempo"/>
          <MetaInline label="MAP"     value="9 keys"/>
        </div>
      </div>

      {/* Action buttons — single row: 6 (wide) on top, 4 + 5 below */}
      <div style={ctlStyles.actions}>
        <UploadButton
          ref={fileRef}
          onPick={(name)=>onUpload(name)}
          disabled={busy}
        />
        <div style={ctlStyles.runRow}>
          <button
            onClick={onDryRun}
            disabled={!canDry || busy}
            style={ctlStyles.dryBtn(canDry && !busy)}>
            <BeakerIcon/>
            <span>
              <strong style={{display:'block', fontSize:13, lineHeight:1.2}}>Dry run</strong>
              <span style={{display:'block', fontSize:11, color:'#9aa6b8', lineHeight:1.2}}>validate only</span>
            </span>
          </button>
          <button
            onClick={onSubmit}
            disabled={!canSubmit || busy}
            style={ctlStyles.submitBtn(canSubmit && !busy)}>
            <RocketIcon/>
            <span>
              <strong style={{display:'block', fontSize:13, lineHeight:1.2}}>Submit to Jira</strong>
              <span style={{display:'block', fontSize:11, color:'rgba(255,255,255,0.75)', lineHeight:1.2}}>write 100 worklogs</span>
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

const UploadButton = React.forwardRef(({ onPick, disabled }, ref)=>{
  const inputRef = React.useRef(null);
  return (
    <label style={ctlStyles.uploadBtn(!disabled)}>
      <UploadIcon/>
      <span>
        <strong style={{display:'block', fontSize:13}}>Upload .xlsx</strong>
        <span style={{display:'block', fontSize:11, color:'#9aa6b8'}}>or drop a file</span>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{display:'none'}}
        disabled={disabled}
        onChange={(e)=>{
          const f = e.target.files && e.target.files[0];
          if(f) onPick(f.name);
          else  onPick('JIRA_EXPORT_2026-05.xlsx'); // demo fallback
          e.target.value = '';
        }}
      />
    </label>
  );
});

function MetaInline({ label, value }){
  return (
    <div style={ctlStyles.metaInline}>
      <span style={ctlStyles.metaLabel}>{label}</span>
      <span style={ctlStyles.metaValueInline}>{value}</span>
    </div>
  );
}

/* --- icons --- */
function UploadIcon(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}
function BeakerIcon(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6"/>
      <path d="M10 3v6L5 19a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 19l-5-10V3"/>
      <path d="M7.5 14h9"/>
    </svg>
  );
}
function RocketIcon(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
  );
}
function FileIcon(){
  return (
    <div style={{
      width:38, height:38, borderRadius:8,
      background:'linear-gradient(135deg, #1F7AE0 0%, #3FB54A 100%)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'JetBrains Mono, monospace', fontWeight:800, fontSize:11, color:'#fff',
      flexShrink:0,
      boxShadow:'inset 0 -2px 0 rgba(0,0,0,0.15)',
    }}>XLS</div>
  );
}

const ctlStyles = {
  panel:{
    background:'#11151c',
    border:'1px solid #1f2633',
    borderRadius:10,
    padding:12,
    display:'flex', flexDirection:'column', gap:10,
    height:'100%',
    minHeight:0,
    overflow:'hidden',
  },
  fileBlock:{
    background:'#0b0e13',
    border:'1px solid #1c2230',
    borderRadius:8,
    padding:10,
    display:'flex', flexDirection:'column', gap:8,
  },
  fileRow:{
    display:'flex', alignItems:'center', gap:12,
  },
  fileLabel:{
    fontSize:10, letterSpacing:0.8, textTransform:'uppercase', color:'#6b7588', fontWeight:700,
  },
  fileName:{
    fontFamily:'JetBrains Mono, monospace', fontSize:13, color:'#e6edf3',
    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
  },
  linkBtn:{
    appearance:'none', background:'transparent', border:'none',
    color:'#5aa9ff', fontSize:11, cursor:'pointer', padding:0,
    textDecoration:'underline', textUnderlineOffset:3,
  },
  metaLine:{
    display:'flex', flexWrap:'wrap', gap:'4px 12px',
    paddingTop:2,
  },
  metaInline:{
    display:'inline-flex', alignItems:'baseline', gap:5, minWidth:0,
  },
  metaLabel:{
    fontSize:9.5, letterSpacing:0.7, color:'#6b7588', textTransform:'uppercase', fontWeight:700,
  },
  metaValueInline:{
    fontSize:11.5, color:'#cdd5e0', fontFamily:'JetBrains Mono, monospace',
    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
  },

  actions:{
    display:'flex', flexDirection:'column', gap:8,
    flex:1, minHeight:0,
  },
  runRow:{
    display:'grid', gridTemplateColumns:'1fr 1fr', gap:8,
  },

  uploadBtn:(enabled)=>({
    cursor: enabled ? 'pointer' : 'not-allowed',
    display:'flex', alignItems:'center', gap:10,
    padding:'10px 14px', borderRadius:8,
    background:'#1a2030',
    border:'1px dashed #3a4258',
    color:'#e6edf3',
    transition:'all .15s',
  }),
  dryBtn:(enabled)=>({
    cursor: enabled ? 'pointer' : 'not-allowed',
    display:'flex', alignItems:'center', gap:9,
    padding:'10px 12px', borderRadius:8,
    background:'#161d2a',
    border:'1px solid #2c3a55',
    color: enabled ? '#e6edf3' : '#5a6478',
    textAlign:'left',
    opacity: enabled ? 1 : 0.55,
    transition:'all .15s',
  }),
  submitBtn:(enabled)=>({
    cursor: enabled ? 'pointer' : 'not-allowed',
    display:'flex', alignItems:'center', gap:9,
    padding:'10px 12px', borderRadius:8,
    background: enabled
      ? 'linear-gradient(180deg, #F37021 0%, #d85d10 100%)'
      : '#2a1d12',
    border:'1px solid '+(enabled?'#f88a4a':'#3a2618'),
    color: enabled ? '#fff' : '#6b5040',
    textAlign:'left',
    boxShadow: enabled ? '0 4px 14px -4px rgba(243,112,33,0.5)' : 'none',
    opacity: enabled ? 1 : 0.6,
    transition:'all .15s',
  }),
};

window.Controls = Controls;
