// employee-views.jsx — main panel views for the employee console
const { useState, useMemo, useEffect } = React;

// Translation shim — `window.t` is provided by i18n.js. Fallback to identity.
const tr = (s, vars) => window.t ? window.t(s, vars) : s;

// ─────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────
function PageHead({ kicker, title, sub, right }) {
  return (
    <div style={{ padding: '24px 32px 18px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
      <div>
        {kicker && <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 500, marginBottom: 4 }}>{kicker}</div>}
        <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 30, letterSpacing: '-0.022em', lineHeight: 1.05 }}>{title}</div>
        {sub && <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 6 }}>{sub}</div>}
      </div>
      {right && <div style={{ display: 'flex', gap: 8 }}>{right}</div>}
    </div>);

}

function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-soft)', borderRadius: 10 }}>
      {tabs.map((t) =>
      <button key={t.k} onClick={() => onChange(t.k)} style={{
        appearance: 'none', border: 0, padding: '7px 14px', borderRadius: 6,
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
        background: active === t.k ? 'var(--surface)' : 'transparent',
        color: active === t.k ? 'var(--ink-1)' : 'var(--ink-3)',
        boxShadow: active === t.k ? 'var(--shadow-sm)' : 'none'
      }}>{t.l}{t.count != null && <span style={{ marginLeft: 6, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{t.count}</span>}</button>
      )}
    </div>);

}

function Chip({ children, tone = 'neutral', soft }) {
  const tones = {
    neutral: { bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
    primary: { bg: 'var(--primary-100)', fg: 'var(--primary-700)' },
    orange: { bg: 'var(--fpt-orange-100)', fg: 'var(--fpt-orange-700)' },
    green: { bg: 'var(--fpt-green-100)', fg: 'var(--fpt-green-700)' },
    danger: { bg: 'var(--err-100)', fg: 'var(--err)' },
    dark: { bg: 'var(--ink-1)', fg: '#fff' }
  };
  const c = tones[tone] || tones.neutral;
  return <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 9px', borderRadius: 999,
    background: c.bg, color: c.fg, fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase'
  }}>{children}</span>;
}

// ─────────────────────────────────────────────────────────────
// LIVE FLOOR — default view
// ─────────────────────────────────────────────────────────────
function LiveFloorView({ state, actions, openModal }) {
  const tr = window.t || ((x) => x);
  const [areaFilter, setAreaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null); // table id
  const [editMode, setEditMode] = useState(false);
  const [mergePick, setMergePick] = useState(null); // first id picked for merge

  // Tables come from state (mutable) — fall back to global seed if not present
  const allTables = state.floorPlan || floorTables;

  function tableStatus(tab) {
    const r = state.reservations.find((rr) => rr.table === tab.id);
    if (!r) return 'free';
    return r.status; // pending | arriving | seated
  }

  const tables = allTables.filter((t) => {
    if (areaFilter !== 'all' && t.area !== areaFilter) return false;
    if (statusFilter === 'all') return true;
    const s = tableStatus(t);
    if (statusFilter === 'free') return s === 'free';
    if (statusFilter === 'reserved') return s === 'pending' || s === 'arriving';
    if (statusFilter === 'occupied') return s === 'seated';
    return true;
  });

  const filteredRes = state.reservations.filter((r) => !state.selectedRes || r.id === state.selectedRes);
  const selRes = state.reservations.find((r) => r.table === selected);
  const selTable = allTables.find((t) => t.id === selected);

  const seated = state.reservations.filter((r) => r.status === 'seated').length;
  const arriving = state.reservations.filter((r) => r.status === 'arriving').length;
  const flagsCount = state.reservations.filter((r) => r.allergies.length > 0).length;

  function onTableClick(id) {
    if (editMode && mergePick) {
      if (mergePick === id) {setMergePick(null);return;}
      actions.mergeTables(mergePick, id);
      setMergePick(null);
      setSelected(null);
      return;
    }
    setSelected(id);
  }

  return (
    <div>
      <PageHead
        kicker={tr('Tue 21 May · Service 17:00 → 23:00')}
        title={tr('Live floor')}
        sub={`${state.reservations.length} ${tr('covers booked')} · ${seated} ${tr('seated')} · ${arriving} ${tr('arriving next 30 min')}`}
        right={[
        <button key="e" className={`btn ${editMode ? 'btn-primary' : 'btn-ghost'}`} onClick={() => {setEditMode(!editMode);setMergePick(null);setSelected(null);}}>
            {editMode ? '✓ ' + tr('Done editing') : '✎ ' + tr('Edit floor')}
          </button>,
        <button key="q" className="btn btn-ghost" onClick={() => openModal({ kind: 'quickAssign' })} disabled={editMode}>{tr('⌥ Quick assign')}</button>,
        <button key="n" className="btn btn-primary" onClick={() => openModal({ kind: 'newReservation' })} disabled={editMode}>{tr('+ New reservation')}</button>]
        } />
      

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18, alignItems: 'flex-start' }}>
        {/* Floor panel */}
        <div>
          {/* Stat row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
            <Stat l={tr('Covers tonight')} n={state.reservations.length} d={tr('+8 vs avg Tue')} />
            <Stat l={tr('Seated')} n={seated} d={`${Math.round(seated / state.reservations.length * 100)}% ${tr('Occupied').toLowerCase()}`} tone="green" />
            <Stat l={tr('Arriving · 30m')} n={arriving} d={`${state.reservations.filter((r) => r.flags.includes('accessible')).length} ${tr('need escort').toLowerCase()}`} />
            <Stat l={tr('Allergy flags')} n={flagsCount} d={tr('Sent to KDS')} tone="danger" />
            <Stat l={tr('In kitchen')} n={state.orders.length} d={`${state.orders.filter((o) => o.elapsed >= o.target).length} ${tr('over target')}`} tone={state.orders.some((o) => o.elapsed >= o.target) ? "warn" : "neutral"} />
          </div>

          {editMode &&
          <div style={{ marginBottom: 14, padding: 14, background: 'var(--primary-50)', border: '1px solid var(--primary)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--primary-700)', fontWeight: 700 }}>{tr('Edit floor')}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-1)', marginTop: 4 }}>
                  {mergePick ?
                tr('Pick a second table to merge with.') + ' ' + tr('Selected') + ': ' + mergePick :
                tr('Drag tables to reposition. Tap to select.')}
                </div>
              </div>
              {mergePick &&
            <button className="btn btn-ghost" onClick={() => setMergePick(null)}>{tr('Cancel')}</button>
            }
            </div>
          }

          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>{tr('Floor plan')}</div>
                <Tabs tabs={[
                { k: 'all', l: tr('All') },
                { k: 'terrace', l: tr('Terrace') },
                { k: 'indoor', l: tr('Indoor') },
                { k: 'private', l: tr('Booth') },
                { k: 'pool', l: tr('Pool') }]
                } active={areaFilter} onChange={setAreaFilter} />
                {!editMode &&
                <Tabs tabs={[
                { k: 'all', l: tr('Any') },
                { k: 'free', l: tr('Free'), count: allTables.filter((t) => !state.reservations.find((r) => r.table === t.id)).length },
                { k: 'reserved', l: tr('Reserved'), count: state.reservations.filter((r) => r.status === 'pending' || r.status === 'arriving').length },
                { k: 'occupied', l: tr('Occupied'), count: state.reservations.filter((r) => r.status === 'seated').length }]
                } active={statusFilter} onChange={setStatusFilter} />
                }
              </div>
              {!editMode &&
              <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--ink-3)' }}>
                  <Legend color="var(--line-strong)" label={tr('Free')} />
                  <Legend color="var(--ink-1)" label={tr('Reserved')} />
                  <Legend color="var(--fpt-orange)" label={tr('Occupied')} />
                  <Legend color="var(--primary)" label={tr('Selected')} />
                </div>
              }
            </div>

            <FloorPlanSvg tables={tables} reservations={state.reservations} selected={selected} setSelected={onTableClick} editMode={editMode} mergePick={mergePick}
            onDrag={(id, x, y) => actions.updateTable(id, { x, y })} />
          </div>

          {/* Upcoming strip — hide while editing */}
          {!editMode &&
          <div style={{ marginTop: 14, padding: 14, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12, overflowX: 'auto' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{tr('Arrival queue')}</div>
              {state.reservations.filter((r) => r.status === 'arriving' || r.status === 'pending').slice(0, 5).map((r) =>
            <div key={r.id} onClick={() => {setSelected(r.table);}} style={{
              padding: 10, background: r.status === 'arriving' ? 'var(--primary-50)' : 'var(--bg)',
              border: '1px solid ' + (r.status === 'arriving' ? 'var(--primary)' : 'var(--line)'),
              borderRadius: 10, minWidth: 180, cursor: 'pointer'
            }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)' }}>
                    <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--ink-1)' }}>{r.time}</span>
                    <span>{r.party} pax · {r.table}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{r.name}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', minHeight: 18 }}>
                    {r.flags.includes('allergy') && <Chip tone="danger">⚠</Chip>}
                    {r.flags.includes('family') && <Chip tone="orange">{tr('Family')}</Chip>}
                    {r.flags.includes('accessible') && <Chip tone="primary">♿</Chip>}
                    {r.flags.includes('external') && <Chip>{tr('Ext.')}</Chip>}
                    {r.flags.includes('vip') && <Chip tone="green">VIP</Chip>}
                  </div>
                </div>
            )}
            </div>
          }
        </div>

        {/* Right rail — edit panel or reservation detail */}
        <div>
          {editMode ?
          <EditTablePanel
            tables={allTables}
            selected={selTable}
            actions={actions}
            mergePick={mergePick}
            setMergePick={setMergePick}
            setSelected={setSelected} /> :

          selRes ?
          <ReservationDetailCard r={selRes} actions={actions} onClose={() => setSelected(null)} openModal={openModal} /> :

          <EmptyDetailCard selected={selected} />
          }
        </div>
      </div>
    </div>);

}

// Edit-mode side panel for the selected table
function EditTablePanel({ tables, selected, actions, mergePick, setMergePick, setSelected }) {
  const tr = window.t || ((x) => x);

  const AreaButton = ({ id, label, tone }) =>
  <button onClick={() => actions.addTable(id)} className="btn btn-ghost" style={{
    width: '100%', justifyContent: 'space-between', textAlign: 'left', padding: '10px 14px',
    borderColor: 'var(--line)', background: 'var(--surface)'
  }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone, display: 'inline-block' }} />
        {label}
      </span>
      <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>+</span>
    </button>;


  if (!selected) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{tr('Edit floor')}</div>
        <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 18, letterSpacing: '-0.015em', marginTop: 4 }}>{tr('Add a table')}</div>
        <div style={{ color: 'var(--ink-3)', fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>{tr('Pick the area where the new table should appear. You can resize, reshape and drag it afterwards.')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          <AreaButton id="terrace" label={tr('Terrace')} tone="rgba(0,102,179,.55)" />
          <AreaButton id="indoor" label={tr('Indoor')} tone="rgba(0,140,68,.55)" />
          <AreaButton id="private" label={tr('Booth')} tone="rgba(243,112,33,.55)" />
          <AreaButton id="pool" label={tr('Poolside')} tone="rgba(199,124,0,.55)" />
        </div>
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--bg)', border: '1px dashed var(--line-strong)', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          {tr('Drag tables to reposition. Tap a table to edit, merge or delete it.')}
        </div>
      </div>);

  }

  const shape = selected.shape || 'round';
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20, position: 'sticky', top: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{tr('Selected table')}</div>
          <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22, letterSpacing: '-0.015em', marginTop: 2 }}>{selected.id}</div>
          <div style={{ color: 'var(--ink-3)', fontSize: 12.5, marginTop: 2, textTransform: 'capitalize' }}>{tr(selected.area.charAt(0).toUpperCase() + selected.area.slice(1))}</div>
        </div>
        <button onClick={() => setSelected(null)} style={{ appearance: 'none', border: 0, background: 'var(--surface-2)', cursor: 'pointer', width: 28, height: 28, borderRadius: '50%', fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' }}>×</button>
      </div>

      {/* Shape selector */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }}>{tr('Shape')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={() => actions.updateTable(selected.id, { shape: 'round' })} style={{
            appearance: 'none', cursor: 'pointer', padding: 14, borderRadius: 10, fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            background: shape === 'round' ? 'var(--primary)' : 'var(--surface)',
            color: shape === 'round' ? '#fff' : 'var(--ink-1)',
            border: shape === 'round' ? 0 : '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
            {tr('Round')}
          </button>
          <button onClick={() => actions.updateTable(selected.id, { shape: 'rect' })} style={{
            appearance: 'none', cursor: 'pointer', padding: 14, borderRadius: 10, fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            background: shape === 'rect' ? 'var(--primary)' : 'var(--surface)',
            color: shape === 'rect' ? '#fff' : 'var(--ink-1)',
            border: shape === 'rect' ? 0 : '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
            {tr('Square')}
          </button>
        </div>
      </div>

      {/* Seats stepper */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }}>{tr('Seats')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', padding: 6, borderRadius: 12, border: '1px solid var(--line)' }}>
          <button onClick={() => actions.updateTable(selected.id, { seats: Math.max(1, selected.seats - 1) })} style={{ appearance: 'none', border: 0, cursor: 'pointer', width: 36, height: 36, borderRadius: 8, background: 'var(--surface)', fontFamily: 'inherit', fontSize: 18, fontWeight: 700 }}>−</button>
          <div style={{ flex: 1, textAlign: 'center', fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em' }}>{selected.seats}</div>
          <button onClick={() => actions.updateTable(selected.id, { seats: Math.min(16, selected.seats + 1) })} style={{ appearance: 'none', border: 0, cursor: 'pointer', width: 36, height: 36, borderRadius: 8, background: 'var(--surface)', fontFamily: 'inherit', fontSize: 18, fontWeight: 700 }}>+</button>
        </div>
      </div>

      {/* Merge / unmerge */}
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {selected.mergedFrom ?
        <button className="btn btn-ghost" onClick={() => {actions.unmergeTable(selected.id);setSelected(null);}} style={{ width: '100%', justifyContent: 'center' }}>
            {tr('Unmerge')} ({selected.mergedFrom.join(' + ')})
          </button> :
        mergePick === selected.id ?
        <button className="btn btn-ghost" onClick={() => setMergePick(null)} style={{ width: '100%', justifyContent: 'center' }}>
            {tr('Cancel')}
          </button> :

        <button className="btn btn-ghost" onClick={() => setMergePick(selected.id)} style={{ width: '100%', justifyContent: 'center' }}>
            ⊕ {tr('Merge with…')}
          </button>
        }

        {/* Remove */}
        <button className="btn btn-ghost" onClick={() => {
          if (window.confirm(tr('Remove table {id}?', { id: selected.id }))) {
            actions.removeTable(selected.id);
            setSelected(null);
          }
        }} style={{ width: '100%', justifyContent: 'center', color: 'var(--err)' }}>
          🗑 {tr('Remove table')}
        </button>
      </div>

      <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line)', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
        {tr('Drag tables to reposition. Tap to select.')}
      </div>
    </div>);

}

function Stat({ l, n, d, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: 'var(--surface)', fg: 'var(--ink-1)' },
    green: { bg: 'var(--fpt-green-100)', fg: 'var(--fpt-green-700)', border: 'rgba(0,140,68,.2)' },
    danger: { bg: 'var(--err-100)', fg: 'var(--err)', border: 'rgba(184,50,39,.2)' },
    warn: { bg: 'var(--fpt-orange-100)', fg: 'var(--fpt-orange-700)', border: 'rgba(243,112,33,.2)' }
  };
  const t = tones[tone] || tones.neutral;
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.border || 'var(--line)'}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{l}</div>
      <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', marginTop: 4, color: t.fg }}>{n}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{d}</div>
    </div>);

}

function Legend({ color, label }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: color }} />{label}
  </span>;
}

function FloorPlanSvg({ tables, reservations, selected, setSelected, editMode, mergePick, onDrag }) {
  const w = 880,h = 460;
  const svgRef = React.useRef(null);
  const [dragId, setDragId] = useState(null);
  const dragRef = React.useRef({ id: null, offX: 0, offY: 0 });

  function onMouseDown(e, tab) {
    if (!editMode) return;
    const pt = svgPoint(e);
    dragRef.current = { id: tab.id, offX: pt.x - tab.x, offY: pt.y - tab.y, moved: false };
    setDragId(tab.id);
    e.stopPropagation();
  }
  function onMouseMove(e) {
    if (!dragRef.current.id) return;
    const pt = svgPoint(e);
    dragRef.current.moved = true;
    onDrag && onDrag(dragRef.current.id, Math.max(40, Math.min(w - 40, pt.x - dragRef.current.offX)), Math.max(40, Math.min(h - 40, pt.y - dragRef.current.offY)));
  }
  function onMouseUp(e) {
    if (dragRef.current.id && !dragRef.current.moved) {
      setSelected(dragRef.current.id);
    }
    dragRef.current = { id: null, offX: 0, offY: 0, moved: false };
    setDragId(null);
  }
  function svgPoint(e) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  return (
    <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block', cursor: editMode && dragId ? 'grabbing' : 'default' }}
    onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
      <defs>
        <pattern id="dotgrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="rgba(13,27,46,.07)" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill="url(#dotgrid)" />

      {/* Areas */}
      <AreaBg x={40} y={20} w={w - 80} h={120} fill="rgba(0,102,179,.05)" stroke="rgba(0,102,179,.25)" label={tr('A · TERRACE · LAGOON')} />
      <AreaBg x={40} y={170} w={w - 80} h={100} fill="rgba(0,140,68,.05)" stroke="rgba(0,140,68,.25)" label={tr('B · INDOOR · MAIN ROOM')} />
      <AreaBg x={40} y={320} w={580} h={100} fill="rgba(243,112,33,.05)" stroke="rgba(243,112,33,.25)" label={tr('C · BOOTHS')} />
      <AreaBg x={640} y={320} w={200} h={100} fill="rgba(199,124,0,.05)" stroke="rgba(199,124,0,.25)" label={tr('D · POOL')} />

      {tables.map((tab) => {
        const r = reservations.find((rr) => rr.table === tab.id);
        const isSel = tab.id === selected;
        const isMergePick = mergePick === tab.id;
        const status = r?.status || 'avail';
        const fill = editMode ?
        isMergePick ? 'var(--fpt-orange)' : isSel ? 'var(--primary)' : 'var(--surface-2)' :
        isSel ? 'var(--primary)' :
        status === 'seated' ? 'var(--fpt-orange)' :
        status === 'arriving' || status === 'pending' ? 'var(--ink-1)' :
        'var(--surface)';
        const stroke = editMode ?
        isMergePick ? 'var(--fpt-orange)' : isSel ? 'var(--primary)' : 'var(--ink-1)' :
        isSel ? 'var(--primary)' :
        status === 'seated' ? 'var(--fpt-orange)' :
        status === 'arriving' || status === 'pending' ? 'var(--ink-1)' :
        'var(--line-strong)';
        const txt = editMode ?
        isSel || isMergePick ? '#fff' : 'var(--ink-1)' :
        (status === 'avail' || status === 'free') && !isSel ? 'var(--ink-1)' : '#fff';
        const rad = tab.seats <= 2 ? 18 : tab.seats <= 4 ? 22 : tab.seats <= 6 ? 26 : 30;
        const shape = tab.shape || 'round';
        const isRect = shape === 'rect';
        // Rectangles are wider than tall for visual variety
        const rectW = rad * 2.2,rectH = rad * 1.6;

        return (
          <g key={tab.id} style={{ cursor: editMode ? dragId === tab.id ? 'grabbing' : 'grab' : 'pointer' }}
          onMouseDown={(e) => onMouseDown(e, tab)}
          onClick={(e) => {if (!editMode) setSelected(tab.id);}}>
            {isSel && !editMode && <circle cx={tab.x} cy={tab.y} r={rad + 10} fill="rgba(0,102,179,.18)" />}
            {isMergePick && <rect x={tab.x - rad - 8} y={tab.y - rad - 8} width={rad * 2 + 16} height={rad * 2 + 16} rx={isRect ? 8 : rad + 8} fill="none" stroke="var(--fpt-orange)" strokeWidth="2" strokeDasharray="4 4" />}
            {isRect ?
            <rect x={tab.x - rectW / 2} y={tab.y - rectH / 2} width={rectW} height={rectH} rx="6" fill={fill} stroke={stroke} strokeWidth="1.5" /> :

            <circle cx={tab.x} cy={tab.y} r={rad} fill={fill} stroke={stroke} strokeWidth="1.5" />
            }
            <text x={tab.x} y={tab.y + 4} textAnchor="middle" fontFamily="Plus Jakarta Sans" fontWeight="700" fontSize="11" fill={txt} style={{ pointerEvents: 'none' }}>{tab.id.length > 6 ? tab.id.split('+')[0] + '+' : tab.id}</text>
            {Array.from({ length: tab.seats }).map((_, i) => {
              if (isRect) {
                // Distribute seats around rect perimeter
                const perim = (rectW + rectH) * 2;
                const step = perim / tab.seats;
                let d = i * step + step / 2;
                let sx, sy;
                if (d < rectW) {sx = tab.x - rectW / 2 + d;sy = tab.y - rectH / 2 - 6;} else
                if (d < rectW + rectH) {sx = tab.x + rectW / 2 + 6;sy = tab.y - rectH / 2 + (d - rectW);} else
                if (d < rectW * 2 + rectH) {sx = tab.x + rectW / 2 - (d - rectW - rectH);sy = tab.y + rectH / 2 + 6;} else
                {sx = tab.x - rectW / 2 - 6;sy = tab.y + rectH / 2 - (d - rectW * 2 - rectH);}
                return <circle key={i} cx={sx} cy={sy} r="3" fill={fill} opacity=".55" style={{ pointerEvents: 'none' }} />;
              }
              const a = i / tab.seats * Math.PI * 2 - Math.PI / 2;
              return <circle key={i} cx={tab.x + Math.cos(a) * (rad + 7)} cy={tab.y + Math.sin(a) * (rad + 7)} r="3" fill={fill} opacity=".55" style={{ pointerEvents: 'none' }} />;
            })}
            {!editMode && r?.flags?.includes('allergy') && <FlagDot x={tab.x + rad - 3} y={tab.y - rad + 3} color="var(--err)" />}
            {!editMode && r?.flags?.includes('family') && <FlagDot x={tab.x + rad + 4} y={tab.y - rad - 3} color="var(--accent)" />}
            {!editMode && r?.flags?.includes('accessible') && <FlagDot x={tab.x - rad - 3} y={tab.y - rad - 3} color="var(--primary)" />}
            {!editMode && r?.flags?.includes('vip') && <FlagDot x={tab.x - rad + 3} y={tab.y - rad + 3} color="var(--success)" />}
          </g>);

      })}

      {/* Kitchen */}
      <rect x="40" y={h - 22} width={w - 80} height="16" fill="rgba(13,27,46,.06)" />
      <text x={w / 2} y={h - 10} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="var(--ink-3)" letterSpacing="2">{tr('KITCHEN PASS')}</text>
    </svg>);

}

function AreaBg({ x, y, w, h, fill, stroke, label }) {
  return <g>
    <rect x={x} y={y} width={w} height={h} rx="8" fill={fill} stroke={stroke} strokeDasharray="4 6" />
    <text x={x + 12} y={y + 18} fontFamily="JetBrains Mono" fontSize="9" fontWeight="600" fill="rgba(13,27,46,.5)" letterSpacing="1.5">{label}</text>
  </g>;
}

function FlagDot({ x, y, color }) {
  return <circle cx={x} cy={y} r="4.5" fill={color} stroke="#fff" strokeWidth="1.5" />;
}

function ReservationDetailCard({ r, actions, onClose, openModal }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20, position: 'sticky', top: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{tr('Table')} {r.table}</div>
          <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22, letterSpacing: '-0.015em', marginTop: 2 }}>{r.name}</div>
          <div style={{ color: 'var(--ink-3)', fontSize: 12.5, marginTop: 2 }}>{r.room} · {r.party} {tr('guests')}</div>
        </div>
        <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 13 }}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: 5, marginTop: 12, flexWrap: 'wrap' }}>
        <Chip tone="primary">{tr(r.pkg)}</Chip>
        {r.flags.includes('family') && <Chip tone="orange">{tr('Family')}</Chip>}
        {r.flags.includes('accessible') && <Chip tone="primary">{tr('Assisted')}</Chip>}
        {r.flags.includes('vip') && <Chip tone="green">VIP</Chip>}
        {r.flags.includes('external') && <Chip>{tr('External · pay per item')}</Chip>}
        <Chip tone={r.status === 'seated' ? 'orange' : 'neutral'}>● {tr(r.status)}</Chip>
      </div>

      {r.allergies.length > 0 &&
      <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--err-100)', border: '1px solid rgba(184,50,39,.2)' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--err)', fontWeight: 700, marginBottom: 4 }}>{tr('Allergens — synced to KDS')}</div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--err)' }}>{r.allergies.join(' · ')}</div>
        </div>
      }

      {r.note &&
      <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'var(--primary-50)', border: '1px solid var(--primary-100)' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--primary-700)', fontWeight: 700, marginBottom: 4 }}>{tr('Service note')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-1)', lineHeight: 1.5 }}>{tr(r.note)}</div>
        </div>
      }

      {r.preorder.length > 0 &&
      <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6 }}>{tr('Pre-order')} · {r.preorder.length} {tr('items')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {r.preorder.map((p, i) =>
          <div key={i} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, fontSize: 12.5 }}>{p}</div>
          )}
          </div>
        </div>
      }

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {r.status !== 'seated' ?
        <button className="btn btn-primary" onClick={() => actions.markSeated(r.id)} style={{ width: '100%', justifyContent: 'center' }}>{tr('Mark as seated')}</button> :

        <button className="btn btn-primary" onClick={() => actions.sendToKitchen(r)} style={{ width: '100%', justifyContent: 'center' }}>{tr('Send pre-order to KDS')}</button>
        }
        <button className="btn btn-ghost" onClick={() => openModal({ kind: 'orderForGuest', reservation: r })} style={{ width: '100%', justifyContent: 'center' }}>{tr('Take order on behalf →')}</button>
        <button className="btn btn-ghost" onClick={() => openModal({ kind: 'moveTable', reservation: r })} style={{ width: '100%', justifyContent: 'center' }}>{tr('Move to another table')}</button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost" onClick={() => actions.printTicket(r)} style={{ flex: 1, justifyContent: 'center', fontSize: 12.5 }}>{tr('🖨 Kitchen ticket')}</button>
          <button className="btn btn-ghost" onClick={() => actions.printReceipt(r)} style={{ flex: 1, justifyContent: 'center', fontSize: 12.5 }}>{tr('🖨 Receipt')}</button>
        </div>
        <button className="btn btn-ghost" onClick={() => actions.cancelReservation(r.id)} style={{ width: '100%', justifyContent: 'center', color: 'var(--err)' }}>{tr('Cancel reservation')}</button>
      </div>

      {!r.flags.includes('external') &&
      <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line)' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700, marginBottom: 6 }}>{tr('Open account')}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, alignItems: 'center' }}>
            <span style={{ color: 'var(--ink-2)' }}>{tr('Spend tonight')}</span>
            <span style={{ fontWeight: 700 }}>{r.payPer ? '$' + (40 + r.party * 22) : '— · all-incl.'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginTop: 4, alignItems: 'center' }}>
            <span style={{ color: 'var(--ink-2)' }}>{tr('Daily limit')}</span>
            <span style={{ fontWeight: 700 }}>{r.payPer ? '$ 320' : '∞'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginTop: 4, alignItems: 'center' }}>
            <span style={{ color: 'var(--ink-2)' }}>{tr('Expires')}</span>
            <span style={{ fontWeight: 700 }}>{tr('on checkout')}</span>
          </div>
        </div>
      }
    </div>);

}

function EmptyDetailCard({ selected }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px dashed var(--line-strong)', borderRadius: 16, padding: 28, textAlign: 'center', color: 'var(--ink-3)' }}>
      <div style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 15, fontWeight: 700, color: 'var(--ink-2)' }}>{selected ? `${tr('Table')} ${selected}` : tr('Click a table')}</div>
      <div style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.5 }}>{selected ? tr('No reservation on this table right now.') : tr('Tap a circle on the floor plan to see guest details and act on their booking.')}</div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// RESERVATIONS — full list view
// ─────────────────────────────────────────────────────────────
function ReservationsView({ state, actions, openModal }) {
  const tr = window.t || ((x) => x);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const filtered = state.reservations.filter((r) => {
    if (tab !== 'all' && r.status !== tab) return false;
    if (q && !r.name.toLowerCase().includes(q.toLowerCase()) && !r.table.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  return (
    <div>
      <PageHead
        kicker={`${state.reservations.length} ${tr('covers booked')}`}
        title={tr('Reservations')}
        sub={tr('Click a row to edit, mark seated, or take an order on behalf.')}
        right={[
        <button key="n" className="btn btn-primary" onClick={() => openModal({ kind: 'newReservation' })}>{tr('+ New reservation')}</button>]
        } />
      
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Tabs tabs={[
          { k: 'all', l: tr('All'), count: state.reservations.length },
          { k: 'pending', l: tr('Pending'), count: state.reservations.filter((r) => r.status === 'pending').length },
          { k: 'arriving', l: tr('Arriving'), count: state.reservations.filter((r) => r.status === 'arriving').length },
          { k: 'seated', l: tr('Seated'), count: state.reservations.filter((r) => r.status === 'seated').length }]
          } active={tab} onChange={setTab} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Search name or table…')} style={{ padding: '8px 14px', border: '1px solid var(--line)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, width: 240 }} />
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1.2fr 1.2fr 80px 100px 1.4fr 260px', padding: '14px 20px', background: 'var(--bg-soft)', borderBottom: '1px solid var(--line)', fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, gap: 14 }}>
            <span>{tr('Time')}</span><span>{tr('Guest')}</span><span>{tr('Room / package')}</span><span>{tr('Party')}</span><span>{tr('Table')}</span><span>{tr('Flags & note')}</span><span style={{ textAlign: 'right' }}>{tr('Actions')}</span>
          </div>
          {/* + Add row */}
          <div onClick={() => openModal({ kind: 'newReservation' })} style={{
            padding: '14px 20px', borderBottom: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            background: 'var(--primary-50)', transition: 'background .15s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-100)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary-50)'}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>+</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary-700)' }}>{tr('New reservation')}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{tr('Walk-in, phone-ahead, or on behalf of an in-house guest')}</div>
            </div>
            <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>{tr('Add →')}</span>
          </div>
          {filtered.map((r) =>
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '80px 1.2fr 1.2fr 80px 100px 1.4fr 260px', padding: '14px 20px', borderBottom: '1px solid var(--line)', gap: 14, alignItems: 'center', fontSize: 13 }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{r.time}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{r.name}</div>
                <div style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>{r.phone}</div>
              </div>
              <div>
                <div style={{ fontSize: 12.5 }}>{r.room}</div>
                <div style={{ color: 'var(--ink-3)', fontSize: 11.5, marginTop: 2 }}>{tr(r.pkg)}</div>
              </div>
              <div>{r.party}</div>
              <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, color: 'var(--primary)' }}>{r.table}</div>
              <div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {r.allergies.length > 0 && <Chip tone="danger">⚠ {tr(r.allergies[0])}{r.allergies.length > 1 ? '+' : ''}</Chip>}
                  {r.flags.includes('family') && <Chip tone="orange">{tr('Family')}</Chip>}
                  {r.flags.includes('accessible') && <Chip tone="primary">{tr('Escort')}</Chip>}
                  {r.flags.includes('vip') && <Chip tone="green">VIP</Chip>}
                  {r.flags.includes('external') && <Chip>{tr('Ext.')}</Chip>}
                  <Chip tone={r.status === 'seated' ? 'orange' : r.status === 'arriving' ? 'primary' : 'neutral'}>● {tr(r.status)}</Chip>
                </div>
                {r.note && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontStyle: 'italic', marginTop: 4 }}>{tr(r.note)}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {r.status !== 'seated' ?
              <button className="btn btn-primary" onClick={() => actions.markSeated(r.id)} style={{ padding: '6px 12px', fontSize: 12 }}>{tr('Seat')}</button> :

              <Chip tone="orange">{tr('seated')}</Chip>
              }
                <button className="btn btn-ghost" onClick={() => openModal({ kind: 'orderForGuest', reservation: r })} style={{ padding: '6px 12px', fontSize: 12 }}>{tr('Order')}</button>
                <button className="btn btn-ghost" onClick={() => openModal({ kind: 'editReservation', reservation: r })} style={{ padding: '6px 10px', fontSize: 12 }}>⋯</button>
              </div>
            </div>
          )}
          {filtered.length === 0 &&
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>{tr('No reservations match.')}</div>
          }
        </div>
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// ORDERS — kitchen queue
// ─────────────────────────────────────────────────────────────
function OrdersView({ state, actions }) {
  const tr = window.t || ((x) => x);
  return (
    <div>
      <PageHead
        kicker={`${state.orders.length} ${tr('active')}`}
        title={tr('Order queue · KDS bridge')}
        sub={tr('Restaurant orders fired to the kitchen. Bumps here clear the line.')} />
      
      <div style={{ padding: 24 }}>
        {state.orders.length === 0 ?
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)', background: 'var(--surface)', borderRadius: 14, border: '1px dashed var(--line-strong)' }}>
            <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 18 }}>{tr('Kitchen is clear.')}</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>{tr("All courses bumped. New orders will appear here as they're fired.")}</div>
          </div> :

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {state.orders.map((o) =>
          <OrderCard key={o.id} o={o} bump={() => actions.bumpOrder(o.id)} hold={() => actions.holdOrder(o.id)} />
          )}
          </div>
        }
      </div>
    </div>);

}

function OrderCard({ o, bump, hold }) {
  const overdue = o.elapsed >= o.target;
  const close = o.elapsed >= o.target * 0.8;
  return (
    <div style={{
      padding: 16, borderRadius: 14,
      background: overdue ? 'var(--err-100)' : close ? 'var(--fpt-orange-100)' : 'var(--surface)',
      border: `1px solid ${overdue ? 'rgba(184,50,39,.3)' : close ? 'rgba(243,112,33,.3)' : 'var(--line)'}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, letterSpacing: '.1em', color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 600 }}>{tr(o.course)}</div>
          <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22, color: overdue ? 'var(--err)' : 'var(--primary)', letterSpacing: '-0.015em' }}>{o.table}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{o.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 18, color: overdue ? 'var(--err)' : 'var(--ink-1)' }}>{o.elapsed}<small style={{ fontSize: 12, color: 'var(--ink-3)' }}>/{o.target}m</small></div>
          <Chip tone={o.status === 'cooking' ? 'orange' : 'primary'}>{tr(o.status)}</Chip>
        </div>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', fontSize: 13.5 }}>
        {o.lines.map((l, i) =>
        <li key={i} style={{ padding: '4px 0', display: 'flex', gap: 8 }}>
            <b style={{ minWidth: 22 }}>{l.q}×</b>
            <span>{tr(l.n)}
              {l.sub && <em style={{ color: 'var(--err)', fontStyle: 'normal', fontWeight: 700, marginLeft: 8 }}>· {tr(l.sub)}</em>}
            </span>
          </li>
        )}
      </ul>
      <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
        <button className="btn btn-primary" onClick={bump} style={{ flex: 1, justifyContent: 'center', fontSize: 12.5, padding: "8px 12px", alignItems: "center" }}>Posunuť</button>
        <button className="btn btn-ghost" onClick={hold} style={{ padding: '8px 12px', fontSize: 12.5 }}>Pozdržať</button>
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// ROOM SERVICE
// ─────────────────────────────────────────────────────────────
function RoomServiceView({ state, actions, openModal }) {
  const tr = window.t || ((x) => x);
  const STATUS_META = {
    scheduled: { label: tr('Scheduled'), step: 0, tone: 'neutral', next: tr('Fire now') },
    cooking: { label: tr('Cooking'), step: 1, tone: 'orange', next: tr('Mark en route') },
    enroute: { label: tr('En route'), step: 2, tone: 'primary', next: tr('Mark delivered') },
    delivered: { label: tr('Delivered'), step: 3, tone: 'green', next: tr('Clear') }
  };

  return (
    <div>
      <PageHead
        kicker={`${state.roomOrders.length} ${tr('active')}`}
        title={tr('Room service queue')}
        sub={tr('In-room dining orders. Tracker shows where each runner is.')} />
      
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {state.roomOrders.length === 0 ?
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)', background: 'var(--surface)', borderRadius: 14, border: '1px dashed var(--line-strong)' }}>
            <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 18 }}>No room service in flight.</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Orders fired from the guest app land here.</div>
          </div> :
        state.roomOrders.map((o) => {
          const meta = STATUS_META[o.status] || STATUS_META.scheduled;
          return (
            <div key={o.id} style={{ padding: 18, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, display: 'grid', gridTemplateColumns: '120px 1fr 240px 220px', gap: 20, alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{tr('Room')}</div>
                <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 28, color: 'var(--primary)', letterSpacing: '-0.025em' }}>{o.room}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{o.name}</div>
              </div>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 4 }}>{o.lines.length} {tr('items')}</div>
                {o.lines.map((l, i) =>
                <div key={i} style={{ fontSize: 13, padding: '2px 0' }}><b style={{ marginRight: 6 }}>{l.q}×</b>{tr(l.n)}</div>
                )}
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{o.status === 'scheduled' ? tr('Scheduled') + ' · ' + o.eta : 'ETA ' + o.eta}</span>
                  <Chip tone={meta.tone}>{meta.label}</Chip>
                </div>
                <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                  {['Received', 'Cooking', 'En route', 'Delivered'].map((s, i) =>
                  <div key={s} style={{ flex: 1, height: 5, borderRadius: 2, background: i <= meta.step ? 'var(--primary)' : 'var(--line)' }} title={tr(s)} />
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{tr('Runner:')} <b style={{ color: 'var(--ink-1)' }}>{o.deliveredBy}</b></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button className="btn btn-primary" onClick={() => actions.advanceRoomOrder(o.id)} style={{ padding: '8px 12px', fontSize: 13, justifyContent: 'center' }}>
                  {meta.next}
                </button>
                <button className="btn btn-ghost" onClick={() => openModal({ kind: 'assignRunner', order: o })} style={{ padding: '8px 12px', fontSize: 12.5, justifyContent: 'center' }}>{tr('Assign runner')}</button>
              </div>
            </div>);

        })}
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// KIOSK ACTIVITY
// ─────────────────────────────────────────────────────────────
function KioskView({ state }) {
  const tr = window.t || ((x) => x);
  return (
    <div>
      <PageHead kicker={tr('Lobby kiosk · last hour')} title={tr('Kiosk arrivals')}
      sub={tr('Touchless check-ins from the entrance kiosk. Auto-routes assistance flags to hosts.')} />
      <div style={{ padding: 24 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1.4fr 120px 1.2fr 160px', padding: '12px 20px', background: 'var(--bg-soft)', borderBottom: '1px solid var(--line)', fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, gap: 12 }}>
            <span>{tr('Time')}</span><span>{tr('Guest')}</span><span>{tr('Table')}</span><span>{tr('Card')}</span><span style={{ textAlign: 'right' }}>{tr('Status')}</span>
          </div>
          {state.kiosk.map((k) =>
          <div key={k.id} style={{ display: 'grid', gridTemplateColumns: '100px 1.4fr 120px 1.2fr 160px', padding: '14px 20px', borderBottom: '1px solid var(--line)', gap: 12, alignItems: 'center', fontSize: 13 }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{k.when}</div>
              <div style={{ fontWeight: 700 }}>{k.name}</div>
              <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, color: 'var(--primary)' }}>{k.table}</div>
              <div style={{ color: 'var(--ink-3)', fontFamily: 'JetBrains Mono', fontSize: 11.5 }}>{k.card}</div>
              <div style={{ textAlign: 'right' }}><Chip tone="green">✓ {tr(k.status)}</Chip></div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 24, padding: 18, background: 'var(--primary-50)', border: '1px solid var(--primary-100)', borderRadius: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{tr('Try the kiosk view →')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4 }}>{tr('Walk through the guest-facing kiosk surface in its own tab.')}</div>
          <a href="kiosk.html" className="btn btn-primary" style={{ marginTop: 12, textDecoration: 'none' }}>{tr('Open kiosk →')}</a>
        </div>
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// GUESTS
// ─────────────────────────────────────────────────────────────
function GuestsView({ openModal }) {
  const [q, setQ] = useState('');
  const filtered = sampleGuests.filter((g) => !q || g.name.toLowerCase().includes(q.toLowerCase()) || g.room.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHead kicker={tr('From PMS')} title={tr('Guest profiles')}
      sub={tr('Search by name, room or wristband ID. Profiles are pulled live and read-only here.')}
      right={[<input key="s" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Search guests…')} style={{ padding: '8px 14px', border: '1px solid var(--line)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, width: 280 }} />]} />
      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map((g) =>
          <div key={g.id} style={{ padding: 18, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 16 }}>
                  {g.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 15 }}>{g.name}</div>
                  <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{g.room}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5, marginTop: 12, flexWrap: 'wrap' }}>
                <Chip tone="primary">{tr(g.pkg)}</Chip>
                {g.allergies.map((a) => <Chip key={a} tone="danger">⚠ {tr(a)}</Chip>)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: 'var(--ink-3)' }}>
                <span>{tr('Visits')} · <b style={{ color: 'var(--ink-1)' }}>{g.visits}</b></span>
                <span>{tr('Last')} · <b style={{ color: 'var(--ink-1)' }}>{tr(g.lastVisit)}</b></span>
              </div>
              <button onClick={() => openModal({ kind: 'newReservation', guest: g })} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12, fontSize: 13 }}>{tr('+ Reserve for guest')}</button>
            </div>
          )}
        </div>
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// MENU EDITOR
// ─────────────────────────────────────────────────────────────
function MenuView({ state, actions }) {
  const tr = window.t || ((x) => x);
  return (
    <div>
      <PageHead kicker={tr("Tonight's service")} title={tr('Menu editor')}
      sub={tr('Toggle items off (86) when sold out. KDS and guest app sync instantly.')} />
      <div style={{ padding: 24 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1.6fr 100px 1fr 120px', padding: '12px 20px', background: 'var(--bg-soft)', borderBottom: '1px solid var(--line)', fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, gap: 12 }}>
            <span>{tr('Course')}</span><span>{tr('Item')}</span><span>{tr('Price')}</span><span>{tr('Tag')}</span><span style={{ textAlign: 'right' }}>{tr('Available')}</span>
          </div>
          {state.menu.map((m) =>
          <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '100px 1.6fr 100px 1fr 120px', padding: '14px 20px', borderBottom: '1px solid var(--line)', gap: 12, alignItems: 'center', fontSize: 13.5, opacity: m.available ? 1 : .55 }}>
              <div style={{ textTransform: 'capitalize', color: 'var(--ink-3)' }}>{tr(m.cat)}</div>
              <div style={{ fontWeight: 700 }}>{tr(m.name)}</div>
              <div>${m.price}</div>
              <div>{m.tag && <Chip tone="primary">{tr(m.tag)}</Chip>}</div>
              <div style={{ textAlign: 'right' }}>
                <button onClick={() => actions.toggleAvailable(m.id)} style={{
                appearance: 'none', cursor: 'pointer', border: 0, padding: '6px 12px', borderRadius: 999,
                background: m.available ? 'var(--fpt-green-100)' : 'var(--err-100)',
                color: m.available ? 'var(--fpt-green-700)' : 'var(--err)',
                fontWeight: 700, fontSize: 11, fontFamily: 'inherit', letterSpacing: '.04em', textTransform: 'uppercase'
              }}>{m.available ? '● Live' : '✕ 86\'d'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// REPORTS — simple stub but with real-looking data
// ─────────────────────────────────────────────────────────────
function ReportsView({ state }) {
  const waiters = [
  { name: 'Marco · Senior', covers: 28, turnover: 1840, avg: 65 },
  { name: 'Aki', covers: 22, turnover: 1402, avg: 64 },
  { name: 'Priya', covers: 19, turnover: 1255, avg: 66 },
  { name: 'Dani', covers: 14, turnover: 890, avg: 64 }];

  const stockAlerts = [
  { item: 'Sea bass · fillet', stock: 4, min: 8, expires: 'tomorrow', area: 'buffer' },
  { item: 'Tomato · heirloom', stock: 22, min: 10, expires: '4 days', area: 'central' },
  { item: 'Pandan leaves', stock: 3, min: 5, expires: '2 days', area: 'buffer' },
  { item: 'Tiger prawn', stock: 12, min: 6, expires: 'today', area: 'central' }];

  return (
    <div>
      <PageHead kicker={tr('Last 7 days · service')} title={tr('Reports')}
      sub={tr('Read-only summary. Full dashboards live in the Insights module.')} />
      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <Stat l={tr('Covers · week')} n="312" d={tr('+11% WoW')} tone="green" />
        <Stat l={tr('Avg cover · week')} n="$68" d={tr('External diners only')} />
        <Stat l={tr('Allergy incidents')} n="0" d={tr('None this week')} tone="green" />
        <Stat l={tr('On-time · KDS')} n="91%" d={tr('Target 95')} tone="warn" />
      </div>

      <div style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 17, marginBottom: 14 }}>{tr('Covers · this week')}</div>
          <Sparkline points={[28, 36, 42, 38, 45, 51, 42]} labels={['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue']} />
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 17, marginBottom: 14 }}>{tr('Waiter performance · tonight')}</div>
          {waiters.map((w) =>
          <div key={w.name} style={{ display: 'grid', gridTemplateColumns: '1fr 50px 70px 60px', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12.5 }}>
              <span style={{ fontWeight: 600 }}>{tr(w.name)}</span>
              <span style={{ color: 'var(--ink-3)', textAlign: 'right' }}>{w.covers} {tr('pax')}</span>
              <span style={{ color: 'var(--ink-3)', textAlign: 'right' }}>${w.turnover}</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)', textAlign: 'right' }}>${w.avg}</span>
            </div>
          )}
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 8, fontFamily: 'var(--font-mono)', letterSpacing: '.1em', textTransform: 'uppercase' }}>{tr('Waiter · covers · turnover · avg/cover')}</div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 17 }}>{tr('Stock alerts · buffer & central')}</div>
            <Chip tone="orange">{stockAlerts.filter((a) => a.stock < a.min || a.expires === 'today' || a.expires === 'tomorrow').length} {tr('need restock')}</Chip>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 100px 100px 110px 100px', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>
            <span>{tr('Material')}</span><span>{tr('On hand')}</span><span>{tr('Min')}</span><span>{tr('Expires')}</span><span>{tr('Stock')}</span>
          </div>
          {stockAlerts.map((a) => {
            const low = a.stock < a.min;
            const exp = a.expires === 'today' || a.expires === 'tomorrow';
            return (
              <div key={a.item} style={{ display: 'grid', gridTemplateColumns: '1.6fr 100px 100px 110px 100px', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{tr(a.item)}</span>
                <span style={{ color: low ? 'var(--err)' : 'var(--ink-1)', fontWeight: low ? 700 : 500 }}>{a.stock}</span>
                <span style={{ color: 'var(--ink-3)' }}>{a.min}</span>
                <span style={{ color: exp ? 'var(--err)' : 'var(--ink-2)', fontWeight: exp ? 700 : 500 }}>{tr(a.expires)}</span>
                <Chip tone={a.area === 'buffer' ? 'orange' : 'neutral'}>{tr(a.area)}</Chip>
              </div>);

          })}
        </div>
      </div>
    </div>);

}

function Sparkline({ points, labels }) {
  const max = Math.max(...points);
  const w = 800,h = 200,pad = 24;
  const step = (w - pad * 2) / (points.length - 1);
  const ys = points.map((p) => h - pad - p / max * (h - pad * 2));
  const xs = points.map((_, i) => pad + i * step);
  const path = xs.map((x, i) => (i === 0 ? 'M' : 'L') + x + ' ' + ys[i]).join(' ');
  const area = path + ` L ${xs[xs.length - 1]} ${h - pad} L ${xs[0]} ${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <path d={area} fill="var(--primary-50)" />
      <path d={path} stroke="var(--primary)" strokeWidth="2.5" fill="none" />
      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r="4" fill="var(--primary)" />)}
      {xs.map((x, i) => <text key={i} x={x} y={h - 6} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="var(--ink-3)">{labels[i]}</text>)}
    </svg>);

}

// ─────────────────────────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────────────────────────
function NewReservationModal({ close, save, prefilled }) {
  const [step, setStep] = useState(1);
  const [guest, setGuest] = useState(prefilled || null);
  const [search, setSearch] = useState('');
  const [time, setTime] = useState('19:30');
  const [party, setParty] = useState(2);
  const [area, setArea] = useState('terrace');
  const [table, setTable] = useState('A·12');
  const [note, setNote] = useState('');

  const matches = sampleGuests.filter((g) => !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.room.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="modal-back" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{tr('Step {n} of {total} · on behalf of guest', { n: step, total: 3 })}</div>
            <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22, letterSpacing: '-0.015em', marginTop: 2 }}>{tr('New reservation')}</div>
          </div>
          <button onClick={close} className="btn btn-ghost" style={{ padding: '6px 10px' }}>✕</button>
        </div>

        <div className="mbody">
          {step === 1 &&
          <>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }}>{tr('Find guest in PMS · or create walk-in')}</div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr('Name, room number, NFC card or wristband ID…')} style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, fontFamily: 'inherit', fontSize: 14 }} />
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                {matches.map((g) =>
              <div key={g.id} onClick={() => {setGuest(g);setStep(2);}} style={{ padding: 12, borderRadius: 10, border: guest?.id === g.id ? '2px solid var(--primary)' : '1px solid var(--line)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{g.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{g.room} · {g.pkg}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {g.allergies.map((a) => <Chip key={a} tone="danger">⚠ {a}</Chip>)}
                    </div>
                  </div>
              )}
                <div onClick={() => {setGuest({ name: 'Walk-in guest', room: 'External', pkg: tr('Pay per item'), allergies: [] });setStep(2);}} style={{ padding: 14, borderRadius: 10, border: '1px dashed var(--line-strong)', cursor: 'pointer', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, fontWeight: 600 }}>
                  + {tr('Walk-in · external diner (no profile)')}
                </div>
              </div>
            </>
          }
          {step === 2 && guest &&
          <>
              <div style={{ marginBottom: 16, padding: 12, background: 'var(--primary-50)', borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{tr('Booking for')}</div>
                <div style={{ fontWeight: 700 }}>{guest.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{guest.room} · {guest.pkg}</div>
              </div>
              <FormSection label={tr('Time')}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                  {['18:30', '19:00', '19:30', '20:00', '20:30', '21:00'].map((t) =>
                <button key={t} onClick={() => setTime(t)} className={time === t ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '10px 0', justifyContent: 'center', fontSize: 13 }}>{t}</button>
                )}
                </div>
              </FormSection>
              <FormSection label={tr('Party size')}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[2, 3, 4, 5, 6, 8].map((n) =>
                <button key={n} onClick={() => setParty(n)} className={party === n ? 'btn btn-dark' : 'btn btn-ghost'} style={{ flex: 1, padding: '10px 0', justifyContent: 'center', fontSize: 13 }}>{n}</button>
                )}
                </div>
              </FormSection>
              <FormSection label={tr('Area')}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {[['terrace', tr('Terrace')], ['indoor', tr('Indoor')], ['private', tr('Booth')], ['pool', tr('Poolside')]].map(([k, l]) =>
                <button key={k} onClick={() => setArea(k)} className={area === k ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '10px 0', justifyContent: 'center', fontSize: 13 }}>{l}</button>
                )}
                </div>
              </FormSection>
              <FormSection label={tr('Table')}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {floorTables.filter((t) => t.area === area).map((t) =>
                <button key={t.id} onClick={() => setTable(t.id)} className={table === t.id ? 'btn btn-dark' : 'btn btn-ghost'} style={{ padding: '8px 14px', fontSize: 12.5, fontFamily: 'var(--font-mono)' }}>{t.id}</button>
                )}
                </div>
              </FormSection>
            </>
          }
          {step === 3 && guest &&
          <>
              <div style={{ padding: 18, background: 'var(--bg)', borderRadius: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{tr('Reservation summary')}</div>
                    <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22, letterSpacing: '-0.015em' }}>{guest.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 26, color: 'var(--primary)' }}>{table}</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--ink-3)' }}>{time} · {party} pax</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 12 }}>
                  <Chip tone="primary">{tr(area)}</Chip>
                  {guest.allergies?.map((a) => <Chip key={a} tone="danger">⚠ {tr(a)}</Chip>)}
                </div>
              </div>
              <FormSection label={tr('Service note (optional)')}>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr('High chair · away from kitchen · anniversary…')}
              style={{ width: '100%', minHeight: 80, border: '1px solid var(--line)', borderRadius: 10, padding: 12, fontFamily: 'inherit', fontSize: 13.5, resize: 'none' }} />
              </FormSection>
            </>
          }
        </div>

        <div className="mfoot">
          <button onClick={close} className="btn btn-ghost">{tr('Cancel')}</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && <button onClick={() => setStep(step - 1)} className="btn btn-ghost">{tr('← Previous')}</button>}
            {step < 3 ?
            <button onClick={() => setStep(step + 1)} className="btn btn-primary" disabled={step === 1 && !guest}>{tr('Continue →')}</button> :

            <button onClick={() => save({ guest, time, party, area, table, note })} className="btn btn-primary">{tr('Confirm reservation')}</button>
            }
          </div>
        </div>
      </div>
    </div>);

}

function FormSection({ label, children }) {
  return <div style={{ marginBottom: 16 }}>
    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6 }}>{label}</div>
    {children}
  </div>;
}

function MoveTableModal({ close, save, reservation }) {
  const [target, setTarget] = useState(null);
  const [area, setArea] = useState(reservation.area);
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="mhead">
          <div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{reservation.name} · {reservation.table}</div>
            <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22, marginTop: 2 }}>{tr('Move table')}</div>
          </div>
          <button onClick={close} className="btn btn-ghost" style={{ padding: '6px 10px' }}>✕</button>
        </div>
        <div className="mbody">
          <FormSection label={tr('Area')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[['terrace', tr('Terrace')], ['indoor', tr('Indoor')], ['private', tr('Booth')], ['pool', tr('Poolside')]].map(([k, l]) =>
              <button key={k} onClick={() => setArea(k)} className={area === k ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '10px 0', justifyContent: 'center', fontSize: 13 }}>{l}</button>
              )}
            </div>
          </FormSection>
          <FormSection label={tr('Available tables')}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {floorTables.filter((t) => t.area === area && t.id !== reservation.table).map((t) =>
              <button key={t.id} onClick={() => setTarget(t.id)} className={target === t.id ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '8px 14px', fontSize: 12.5, fontFamily: 'var(--font-mono)' }}>{t.id} · {t.seats}p</button>
              )}
            </div>
          </FormSection>
        </div>
        <div className="mfoot">
          <button onClick={close} className="btn btn-ghost">{tr('Cancel')}</button>
          <button onClick={() => target && save(target)} className="btn btn-primary" disabled={!target}>{tr('Move to')} {target || '…'}</button>
        </div>
      </div>
    </div>);

}

function OrderForGuestModal({ close, save, reservation, menu }) {
  const [cart, setCart] = useState({});
  const add = (id) => setCart({ ...cart, [id]: (cart[id] || 0) + 1 });
  const remove = (id) => {
    const c = { ...cart };
    if (c[id] > 1) c[id]--;else delete c[id];
    setCart(c);
  };
  const total = Object.entries(cart).reduce((s, [id, q]) => s + (menu.find((m) => m.id === id)?.price || 0) * q, 0);
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{tr('Acting as')} {reservation.name}</div>
            <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22, marginTop: 2 }}>{tr('Take order on behalf')}</div>
          </div>
          <button onClick={close} className="btn btn-ghost" style={{ padding: '6px 10px' }}>✕</button>
        </div>
        <div className="mbody" style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 18 }}>
          <div>
            {reservation.allergies.length > 0 &&
            <div style={{ padding: 10, background: 'var(--err-100)', borderRadius: 8, marginBottom: 12, fontSize: 12.5, color: 'var(--err)', fontWeight: 600 }}>⚠ {tr('Allergens')} · {reservation.allergies.join(', ')} · {tr('auto-flagged on KDS')}</div>
            }
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {menu.filter((m) => m.available).map((m) =>
              <div key={m.id} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{tr(m.name)}</div>
                    <div style={{ color: 'var(--ink-3)', fontSize: 11.5, marginTop: 2 }}>{tr(m.cat)} · ${m.price}</div>
                  </div>
                  {cart[m.id] ?
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg)', borderRadius: 999, padding: 2 }}>
                      <button onClick={() => remove(m.id)} style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', width: 24, height: 24, borderRadius: '50%', fontWeight: 700 }}>−</button>
                      <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 700, fontSize: 13 }}>{cart[m.id]}</span>
                      <button onClick={() => add(m.id)} style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', width: 24, height: 24, borderRadius: '50%', fontWeight: 700 }}>+</button>
                    </div> :

                <button onClick={() => add(m.id)} className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12 }}>{tr('Add')}</button>
                }
                </div>
              )}
            </div>
          </div>
          <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 12 }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }}>{tr('Order summary')}</div>
            {Object.entries(cart).length === 0 ?
            <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{tr('Add items to start.')}</div> :

            <>
                {Object.entries(cart).map(([id, q]) => {
                const m = menu.find((x) => x.id === id);
                return <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0' }}>
                    <span><b>{q}×</b> {m?.name}</span>
                    <span>${(m?.price || 0) * q}</span>
                  </div>;
              })}
                <div style={{ borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                  <span>{tr('Total')}</span><span>{reservation.payPer ? '$' + total : tr('Included')}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-3)' }}>{reservation.payPer ? tr('Charged to') + ' ' + (reservation.flags.includes('external') ? tr('card on file') : tr('room bill')) : tr('All-inclusive')}</div>
              </>
            }
          </div>
        </div>
        <div className="mfoot">
          <button onClick={close} className="btn btn-ghost">{tr('Cancel')}</button>
          <button onClick={() => save(cart)} className="btn btn-primary" disabled={Object.keys(cart).length === 0}>{tr('Send to KDS')}</button>
        </div>
      </div>
    </div>);

}

function QuickAssignModal({ close, save, reservations, tables }) {
  const pending = reservations.filter((r) => r.status === 'pending' || r.status === 'arriving');
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="mhead">
          <div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{tr('Walk-in seat finder')}</div>
            <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22, marginTop: 2 }}>{tr('Quick assign')}</div>
          </div>
          <button onClick={close} className="btn btn-ghost" style={{ padding: '6px 10px' }}>✕</button>
        </div>
        <div className="mbody">
          <div style={{ color: 'var(--ink-2)', fontSize: 13.5, marginBottom: 14 }}>{tr('Drop a walk-in into the next free table. The system avoids tables held for upcoming reservations.')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {tables.filter((t) => !reservations.find((r) => r.table === t.id)).slice(0, 9).map((t) =>
            <button key={t.id} onClick={() => save(t.id)} className="btn btn-ghost" style={{ padding: 14, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22, color: 'var(--primary)' }}>{t.id}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t.seats} {tr('seats')} · {tr(t.area)}</div>
              </button>
            )}
          </div>
        </div>
        <div className="mfoot"><button onClick={close} className="btn btn-ghost">{tr('Close')}</button></div>
      </div>
    </div>);

}

function AssignRunnerModal({ close, save, order }) {
  const runners = ['Marco', 'Aki', 'Priya', 'Dani', 'Jonas'];
  const [pick, setPick] = useState(order?.deliveredBy && order.deliveredBy !== '—' ? order.deliveredBy : null);
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="mhead">
          <div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{tr('Room')} {order?.room} · ETA {order?.eta}</div>
            <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22, marginTop: 2 }}>{tr('Assign runner')}</div>
          </div>
          <button onClick={close} className="btn btn-ghost" style={{ padding: '6px 10px' }}>✕</button>
        </div>
        <div className="mbody">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {runners.map((r) =>
            <button key={r} onClick={() => setPick(r)} className={pick === r ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '12px 14px', justifyContent: 'flex-start', fontSize: 14 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: pick === r ? 'rgba(255,255,255,.2)' : 'var(--primary-100)', color: pick === r ? '#fff' : 'var(--primary-700)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, marginRight: 10 }}>{r.slice(0, 2).toUpperCase()}</span>
                {r}
              </button>
            )}
          </div>
        </div>
        <div className="mfoot">
          <button onClick={close} className="btn btn-ghost">{tr('Cancel')}</button>
          <button onClick={() => pick && save(pick)} className="btn btn-primary" disabled={!pick}>{tr('Assign')} {pick || '…'}</button>
        </div>
      </div>
    </div>);

}

Object.assign(window, {
  PageHead, Tabs, Chip, Stat, Legend,
  LiveFloorView, ReservationsView, OrdersView, RoomServiceView,
  KioskView, GuestsView, MenuView, ReportsView,
  NewReservationModal, MoveTableModal, OrderForGuestModal, QuickAssignModal, AssignRunnerModal
});