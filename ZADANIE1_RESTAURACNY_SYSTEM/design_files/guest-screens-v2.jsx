// guest-screens-v2.jsx — clean, simplified guest screens
// Hosted inside the phone frame in guest.html

const { useState, useEffect, useMemo } = React;

// Translation shim — `window.t` is provided by i18n.js. Fallback to identity.
const tr = (s, vars) => window.t ? window.t(s, vars) : s;

// ─────────────────────────────────────────────────────────────
// Visual primitives
// ─────────────────────────────────────────────────────────────
function Pill({ children, tone = 'neutral', size = 'sm' }) {
  const tones = {
    neutral: { bg: 'var(--surface-2)', fg: 'var(--ink-2)' },
    primary: { bg: 'var(--primary-100)', fg: 'var(--primary-700)' },
    orange: { bg: 'var(--fpt-orange-100)', fg: 'var(--fpt-orange-700)' },
    green: { bg: 'var(--fpt-green-100)', fg: 'var(--fpt-green-700)' },
    danger: { bg: 'var(--err-100)', fg: 'var(--err)' },
    dark: { bg: 'rgba(255,255,255,.18)', fg: '#fff' }
  };
  const c = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: size === 'sm' ? '3px 8px' : '5px 11px',
      borderRadius: 999, background: c.bg, color: c.fg,
      fontSize: size === 'sm' ? 10.5 : 12, fontWeight: 700,
      letterSpacing: '.04em', textTransform: 'uppercase', width: "87px", textAlign: "center"
    }}>{children}</span>);

}

function Btn({ children, onClick, kind = 'primary', full = true, style = {} }) {
  const kinds = {
    primary: { bg: 'var(--primary)', fg: '#fff', shadow: 'var(--shadow-blue)' },
    dark: { bg: 'var(--ink-1)', fg: '#fff' },
    ghost: { bg: 'transparent', fg: 'var(--ink-1)', border: '1.5px solid var(--line-strong)' },
    soft: { bg: 'var(--primary-50)', fg: 'var(--primary-700)' },
    accent: { bg: 'var(--accent)', fg: '#fff' }
  };
  const k = kinds[kind] || kinds.primary;
  return (
    <button onClick={onClick} style={{
      appearance: 'none', border: k.border || 0, cursor: 'pointer',
      width: full ? '100%' : 'auto',
      padding: '14px 20px', borderRadius: 14,
      background: k.bg, color: k.fg,
      fontFamily: 'inherit', fontWeight: 700, fontSize: 15,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      boxShadow: k.shadow || 'none',
      transition: 'transform .1s, box-shadow .15s',
      ...style
    }}>{children}</button>);

}

function PhotoTile({ h = 160, label = '', tone = 'cool', src = null }) {
  if (src) {
    return (
      <div style={{
        height: h, width: '100%', borderRadius: 12, overflow: 'hidden',
        background: 'var(--surface-2)', position: 'relative'
      }}>
        <img src={src} alt={label} loading="lazy" style={{
          width: '100%', height: '100%', objectFit: 'cover', display: 'block'
        }} />
      </div>);

  }
  const grads = {
    cool: 'linear-gradient(135deg, #B5D2EB 0%, var(--primary) 100%)',
    warm: 'linear-gradient(135deg, #FFD8AC 0%, var(--accent) 100%)',
    green: 'linear-gradient(135deg, #B5DCC4 0%, var(--success) 100%)',
    dark: 'linear-gradient(135deg, #2A4060 0%, #0D1B2E 100%)'
  };
  return (
    <div style={{
      height: h, borderRadius: 12, background: grads[tone] || grads.cool,
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'flex-end', padding: 12
    }}>
      <div style={{ position: 'absolute', inset: 0,
        background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 16px, transparent 16px 32px)'
      }} />
      <div style={{ position: 'relative', fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.1em',
        textTransform: 'uppercase', color: 'rgba(255,255,255,.85)', fontWeight: 600
      }}>{label}</div>
    </div>);

}

function ScreenTitle({ kicker, title, sub }) {
  return (
    <div style={{ padding: '14px 22px 8px' }}>
      {kicker && <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 500, marginBottom: 6 }}>{kicker}</div>}
      <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 28, letterSpacing: '-0.025em', lineHeight: 1.05 }}>{title}</div>
      {sub && <div style={{ color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.5, marginTop: 8 }}>{sub}</div>}
    </div>);

}

function WizardChrome({ title, step, total, onBack, children, footer }) {
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding: '10px 18px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)' }}>
        <button onClick={onBack} style={{
          appearance: 'none', border: 0, background: 'var(--surface-2)', cursor: 'pointer',
          width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: 'var(--ink-1)'
        }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{tr('Step {n} of {total}', { n: step, total })}</div>
          <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 18, letterSpacing: '-0.015em', marginTop: 1 }}>{title}</div>
        </div>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: total }).map((_, i) =>
          <div key={i} style={{
            width: i + 1 === step ? 18 : 6, height: 6, borderRadius: 999,
            background: i + 1 <= step ? 'var(--primary)' : 'var(--line)',
            transition: 'all .2s'
          }} />
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
      {footer && <div style={{ padding: 18, borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>{footer}</div>}
    </div>);

}

// ─────────────────────────────────────────────────────────────
// HOME
// ─────────────────────────────────────────────────────────────
function ScreenHome({ s, hasBooking, openFlow, openMenu, openOrders }) {
  const greeting = (() => {
    const h = 19;
    return h < 12 ? tr('Good morning') : h < 17 ? tr('Good afternoon') : tr('Good evening');
  })();
  return (
    <div style={{ padding: '14px 0 24px' }}>
      <div style={{ padding: '0 22px 4px' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'JetBrains Mono', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600 }}>{greeting}</div>
        <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 30, letterSpacing: '-0.025em', marginTop: 2 }}>{s.salutation}.</div>
      </div>

      {/* Booking card */}
      {hasBooking ?
      <div style={{ margin: '18px 18px 0', padding: 20, borderRadius: 18, background: 'var(--ink-1)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -30, top: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,102,179,.6), transparent 65%)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', opacity: .65 }}>{tr('Tonight · Tue 21 May')}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
              <div>
                <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em' }}>{tr(s.booking.area)}</div>
                <div style={{ opacity: .75, fontSize: 13, marginTop: 2 }}>{tr('Table')} {s.booking.table} · {s.booking.party} {tr('guests')} · {s.booking.time}</div>
              </div>
              <Pill tone="dark" size="md">{s.pkgBadge}</Pill>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={openMenu} style={{ flex: 1, appearance: 'none', padding: '11px 14px', borderRadius: 12, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.16)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{tr('Pre-order menu')}</button>
              <button onClick={openOrders} style={{ flex: 1, appearance: 'none', padding: '11px 14px', borderRadius: 12, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.16)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{tr('My reservations')}</button>
            </div>
          </div>
        </div> :

      <div style={{ margin: '18px 18px 0', padding: 20, borderRadius: 18, background: 'var(--primary-50)', border: '1px dashed var(--primary)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 18, letterSpacing: '-0.015em' }}>{tr('No booking tonight')}</div>
          <div style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 4 }}>{tr('Reserve a seat or order in — your choice.')}</div>
        </div>
      }

      <ScreenTitle kicker={tr('What can we set up?')} title={tr('Dining')} />

      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ActionRow tone="primary" icon={iconTable()} title={tr('Reserve a table')} sub={tr('Indoor, terrace, poolside or booth')} onClick={() => openFlow('dine')} />
        <ActionRow tone="accent" icon={iconRoom()} title={tr('Room service')} sub={tr('Delivered to') + ' ' + (s.room.includes('Walk-in') ? tr('your seat') : s.room.split(' · ')[0])} onClick={() => openFlow('room')} disabled={s.isExternal} />
        <ActionRow tone="green" icon={iconBox()} title={tr('Trail / packed lunch')} sub={tr('Tomorrow morning, ready at the front desk')} onClick={() => openFlow('trail')} />
      </div>

      {/* Allergy summary */}
      {s.allergies.length > 0 &&
      <div style={{ margin: '20px 18px 0', padding: 14, borderRadius: 14, background: 'var(--err-100)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--err)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>⚠</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--err)' }}>{tr('Allergens on file')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>{s.allergies.map((a) => tr(a)).join(' · ')} — {tr('hidden from every menu')}.</div>
          </div>
        </div>
      }

      {s.accessibility?.escort &&
      <div style={{ margin: '12px 18px 0', padding: 14, borderRadius: 14, background: 'var(--primary-50)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>♿</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary-700)' }}>{tr('Escort booked')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>{tr('Tactile menu ready. Meet hostess at spa lift, 15 min before.')}</div>
          </div>
        </div>
      }
    </div>);

}

function ActionRow({ tone, icon, title, sub, onClick, disabled }) {
  const tones = {
    primary: { bg: 'var(--primary-50)', accent: 'var(--primary)', fg: 'var(--primary-700)' },
    accent: { bg: 'var(--fpt-orange-100)', accent: 'var(--accent)', fg: 'var(--fpt-orange-700)' },
    green: { bg: 'var(--fpt-green-100)', accent: 'var(--success)', fg: 'var(--fpt-green-700)' }
  };
  const t = tones[tone] || tones.primary;
  return (
    <button onClick={disabled ? null : onClick} disabled={disabled} style={{
      appearance: 'none', border: 0, textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
      padding: 16, borderRadius: 16, background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 14,
      border: '1px solid var(--line)', fontFamily: 'inherit', width: '100%', opacity: disabled ? .45 : 1
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: t.bg, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15.5, letterSpacing: '-0.01em' }}>{title}</div>
        <div style={{ color: 'var(--ink-3)', fontSize: 12.5, marginTop: 2 }}>{sub}</div>
      </div>
      <span style={{ color: 'var(--ink-3)', fontSize: 16 }}>→</span>
    </button>);

}

// Icons
function iconTable() {
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="6" width="18" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><path d="M5 9v10M17 9v10M11 9v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
function iconRoom() {
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 19V8l8-5 8 5v11" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M8 19v-6h6v6" stroke="currentColor" strokeWidth="1.8" /></svg>;
}
function iconBox() {
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 7l8-4 8 4-8 4-8-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M3 7v9l8 4 8-4V7" stroke="currentColor" strokeWidth="1.8" /><path d="M11 11v9" stroke="currentColor" strokeWidth="1.8" /></svg>;
}

// ─────────────────────────────────────────────────────────────
// DINE-IN WIZARD
// ─────────────────────────────────────────────────────────────
function DineWizard({ s, flow, setFlow, exit, dispatchReserve, reservation, addToast }) {
  const step = flow.step;

  if (step === 1) {
    return <WizardChrome title={tr('When?')} step={1} total={4} onBack={exit}
    footer={<Btn onClick={() => setFlow({ ...flow, step: 2 })}>{tr('Continue')}</Btn>}>
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }}>{tr('Date')}</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {[tr('Today'), tr('Tomorrow'), tr('Thu 23'), tr('Fri 24')].map((d) =>
          <button key={d} onClick={() => dispatchReserve({ type: 'set', date: d })} style={{
            flex: 1, appearance: 'none', padding: '12px 0', borderRadius: 12, cursor: 'pointer',
            background: reservation.date === d ? 'var(--ink-1)' : 'var(--surface)',
            color: reservation.date === d ? '#fff' : 'var(--ink-1)',
            border: reservation.date === d ? 0 : '1px solid var(--line)',
            fontWeight: 600, fontSize: 13, fontFamily: 'inherit'
          }}>{d}</button>
          )}
        </div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }}>{tr('Time')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {TIME_SLOTS.map((t) =>
          <button key={t} onClick={() => dispatchReserve({ type: 'set', time: t })} style={{
            appearance: 'none', padding: '14px 0', borderRadius: 12, cursor: 'pointer',
            background: reservation.time === t ? 'var(--primary)' : 'var(--surface)',
            color: reservation.time === t ? '#fff' : 'var(--ink-1)',
            border: reservation.time === t ? 0 : '1px solid var(--line)',
            fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
            boxShadow: reservation.time === t ? 'var(--shadow-blue)' : 'none'
          }}>{t}</button>
          )}
        </div>

        <div style={{ marginTop: 22, fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }}>{tr('Party size')}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[2, 3, 4, 5, 6, '7+'].map((n) =>
          <button key={n} onClick={() => typeof n === 'number' && dispatchReserve({ type: 'set', party: n })} style={{
            flex: 1, appearance: 'none', padding: '12px 0', borderRadius: 12, cursor: 'pointer',
            background: reservation.party === n ? 'var(--ink-1)' : 'var(--surface)',
            color: reservation.party === n ? '#fff' : 'var(--ink-1)',
            border: reservation.party === n ? 0 : '1px solid var(--line)',
            fontWeight: 700, fontSize: 14, fontFamily: 'inherit'
          }}>{n}</button>
          )}
        </div>
      </div>
    </WizardChrome>;
  }

  if (step === 2) {
    return <WizardChrome title={tr('Where?')} step={2} total={4} onBack={() => setFlow({ ...flow, step: 1 })}
    footer={<Btn onClick={() => setFlow({ ...flow, step: 3 })}>{tr('Pick a seat')}</Btn>}>
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 14 }}>{tr('Pick a dining area.')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {DINING_AREAS.map((a) =>
          <button key={a.id} onClick={() => dispatchReserve({ type: 'set', area: a.id })} style={{
            appearance: 'none', cursor: 'pointer', textAlign: 'left',
            padding: 0, borderRadius: 14, overflow: 'hidden',
            background: 'var(--surface)',
            border: reservation.area === a.id ? '2px solid var(--primary)' : '1px solid var(--line)',
            fontFamily: 'inherit'
          }}>
              <PhotoTile h={80} tone={a.id === 'terrace' ? 'cool' : a.id === 'poolside' ? 'cool' : a.id === 'private' ? 'dark' : 'green'} label={tr(a.label)} />
              <div style={{ padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.005em' }}>{tr(a.label)}</div>
                <div style={{ color: 'var(--ink-3)', fontSize: 11.5, marginTop: 2 }}>{tr(a.desc)}</div>
              </div>
            </button>
          )}
        </div>
      </div>
    </WizardChrome>;
  }

  if (step === 3) {
    const tables = SEAT_GRID.filter((t) => !reservation.area || reservation.area === 'private' ? t.area === reservation.area : t.area === reservation.area);
    const selected = reservation.tableId || tables.find((t) => t.status === 'avail')?.id;
    return <WizardChrome title={tr('Pick a seat')} step={3} total={4} onBack={() => setFlow({ ...flow, step: 2 })}
    footer={<Btn onClick={() => {dispatchReserve({ type: 'set', tableId: selected });setFlow({ ...flow, step: 4 });}}>{tr('Continue · ')}{selected}</Btn>}>
      <div style={{ padding: '14px 18px 0' }}>
        <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{tr(DINING_AREAS.find((a) => a.id === reservation.area)?.label || '')} · {reservation.time} · {reservation.party} {tr('guests')}</div>
        <div style={{ display: 'flex', gap: 14, padding: '12px 0', fontSize: 11, color: 'var(--ink-3)' }}>
          <LegendDot color="var(--line-strong)" label={tr('Available')} />
          <LegendDot color="var(--primary)" label={tr('Your seat')} />
          <LegendDot color="var(--ink-1)" label={tr('Booked')} />
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 14, position: 'relative' }}>
          <SeatMap tables={tables} selected={selected} onPick={(id) => dispatchReserve({ type: 'set', tableId: id })} />
        </div>
        {selected && (() => {
          const t = SEAT_GRID.find((x) => x.id === selected);
          return <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: 'var(--ink-1)', color: '#fff', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 24, color: 'var(--primary)' }}>{t.id}</div>
            <div style={{ flex: 1, fontSize: 13, opacity: .9 }}>
              <div>{t.seats} {tr('seats')} · {tr(DINING_AREAS.find((a) => a.id === t.area)?.label || '')}</div>
              <div style={{ opacity: .6, fontSize: 11, marginTop: 2 }}>{tr('Window view')}</div>
            </div>
          </div>;
        })()}
      </div>
    </WizardChrome>;
  }

  if (step === 4) {
    const area = DINING_AREAS.find((a) => a.id === reservation.area);
    return <WizardChrome title={tr('Review')} step={4} total={4} onBack={() => setFlow({ ...flow, step: 3 })}
    footer={
    <div style={{ display: 'flex', gap: 8 }}>
          <Btn kind="ghost" full={false} onClick={() => {dispatchReserve({ type: 'commit' });exit();}}>{tr('Just the table')}</Btn>
          <Btn onClick={() => {dispatchReserve({ type: 'commit' });addToast(tr('Reservation confirmed'));setFlow({ type: 'menu-after-reserve', step: 0 });}} style={{ flex: 1 }}>{tr('Confirm & pre-order')}</Btn>
        </div>
    }>
      <div style={{ padding: 18 }}>
        <PhotoTile h={140} tone="cool" label={tr(area?.label || 'Lagoon Terrace')} />
        <div style={{ marginTop: 16, padding: 18, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{tr('Table')}</div>
              <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 32, color: 'var(--primary)', letterSpacing: '-0.025em' }}>{reservation.tableId}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{reservation.date}</div>
              <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22 }}>{reservation.time}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
            <Pill tone="primary">{tr(area?.label || '')}</Pill>
            <Pill>{reservation.party} {tr('guests')}</Pill>
            {s.family && <Pill tone="orange">{tr('High chair')}</Pill>}
            {s.accessibility?.escort && <Pill tone="primary">{tr('Escort booked')}</Pill>}
            {s.allergies.length > 0 && <Pill tone="danger">⚠ {s.allergies.map((a) => tr(a)).join(' · ')}</Pill>}
          </div>
        </div>
        <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: 'var(--primary-50)', color: 'var(--primary-700)', fontSize: 13, lineHeight: 1.5 }}>
          <b>{tr('Pre-order to skip the wait.')}</b> {tr('The kitchen will start your courses just before you arrive. Or, just lock in the table.')}
        </div>
      </div>
    </WizardChrome>;
  }

  return null;
}

function LegendDot({ color, label }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: color }} />{label}
  </span>;
}

function SeatMap({ tables, selected, onPick }) {
  const w = 340,h = 280;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect x="6" y="6" width={w - 12} height={h - 12} rx="14" fill="var(--primary-50)" stroke="var(--primary-200)" strokeDasharray="3 5" />
      <text x="14" y="22" fontFamily="JetBrains Mono" fontSize="9" fill="var(--ink-3)" letterSpacing="1.5">{tr('RAILING · VIEW')}</text>
      {tables.map((t) => {
        const r = t.seats <= 2 ? 14 : t.seats <= 4 ? 18 : 22;
        const isSel = t.id === selected;
        const color = isSel ? 'var(--primary)' :
        t.status === 'reserved' || t.status === 'occupied' ? 'var(--ink-1)' :
        'var(--line-strong)';
        return (
          <g key={t.id} style={{ cursor: t.status === 'avail' ? 'pointer' : 'not-allowed' }} onClick={() => t.status === 'avail' && onPick(t.id)}>
            {isSel && <circle cx={t.x + r} cy={t.y + r} r={r + 6} fill="rgba(0,102,179,.18)" />}
            <circle cx={t.x + r} cy={t.y + r} r={r} fill={color} />
            <text x={t.x + r} y={t.y + r + 3.5} textAnchor="middle" fontFamily="Plus Jakarta Sans" fontWeight="700" fontSize="9" fill={t.status === 'avail' && !isSel ? 'var(--ink-1)' : '#fff'}>{t.id}</text>
          </g>);

      })}
      <rect x="6" y={h - 30} width={w - 12} height="24" rx="6" fill="rgba(0,0,0,.05)" />
      <text x={w / 2} y={h - 14} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="var(--ink-3)" letterSpacing="1.5">{tr('KITCHEN PASS')}</text>
    </svg>);

}

// ─────────────────────────────────────────────────────────────
// MENU SCREEN — for browsing tonight's menu
// ─────────────────────────────────────────────────────────────
function ScreenMenu({ s, cart, dispatchCart, openItem, openCart, mode = 'tab' }) {
  const [cat, setCat] = useState('starters');
  const [hideAllergens, setHideAllergens] = useState(true);
  const userAllergens = s.allergies.map((a) => ALLERGY_TO_KEY[a]).filter(Boolean);
  const dietName = s.diet[0];
  const dietRule = dietName ? DIET_RULE[dietName] : null;
  const items = MENU.filter((m) => m.cat === cat).filter((it) => !dietRule || dietRule(it));
  const cartCount = Object.values(cart.items).reduce((a, b) => a + b.qty, 0);

  return (
    <div style={{ padding: '0 0 24px' }}>
      <ScreenTitle kicker={mode === 'wizard' ? tr('Pre-order · table {n}', { n: s.booking.table }) : tr("Tonight · Chef's menu")} title={tr('Menu')} />

      {/* Locked diet banner */}
      {dietRule &&
      <div style={{ margin: '6px 18px 0', padding: 12, borderRadius: 12, background: 'var(--primary-50)', border: '1px solid var(--primary-100)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>♡</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--primary-700)' }}>{tr(dietName)} {tr('plan · set by your booking')}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>{tr('Only compatible dishes shown.')}</div>
          </div>
        </div>
      }

      {/* Category strip */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 18px 4px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {(s.family ? CATEGORIES : CATEGORIES.filter((c) => c.id !== 'kids')).map((c) =>
        <button key={c.id} onClick={() => setCat(c.id)} style={{
          appearance: 'none', border: 0, cursor: 'pointer', whiteSpace: 'nowrap',
          padding: '9px 14px', borderRadius: 999,
          background: cat === c.id ? 'var(--ink-1)' : 'var(--surface)',
          color: cat === c.id ? '#fff' : 'var(--ink-2)',
          border: cat === c.id ? 0 : '1px solid var(--line)',
          fontWeight: 600, fontSize: 13, fontFamily: 'inherit'
        }}>{tr(c.label)}</button>
        )}
      </div>

      {/* Allergy toggle */}
      {userAllergens.length > 0 &&
      <div style={{ margin: '8px 18px 0', padding: 12, borderRadius: 12, background: 'var(--err-100)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--err)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>⚠</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--err)' }}>{tr('Hiding items with {x}', { x: s.allergies.map((a) => tr(a)).join(' / ') })}</div>
          </div>
          <Switch on={hideAllergens} onChange={setHideAllergens} />
        </div>
      }

      <div style={{ padding: '12px 18px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it) => {
          const hasA = userAllergens.some((k) => it.allergens.includes(k));
          if (hideAllergens && hasA) {
            return <div key={it.id} style={{ borderRadius: 12, padding: 12, background: 'var(--err-100)', border: '1px dashed var(--err)', fontSize: 12.5, color: 'var(--err)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><b>{tr(it.name)}</b> · {tr('hidden')}</span>
              <button onClick={() => setHideAllergens(false)} style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--err)', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>{tr('SHOW')}</button>
            </div>;
          }
          const qty = cart.items[it.id]?.qty || 0;
          return <MenuRow key={it.id} it={it} payPer={s.payPerItem} qty={qty} onClick={() => openItem(it.id)} onAdd={() => dispatchCart({ type: 'add', id: it.id, qty: 1, price: it.price })} />;
        })}
      </div>

      {cartCount > 0 &&
      <div style={{ position: 'sticky', bottom: 12, margin: '18px 18px 0', zIndex: 2 }}>
          <Btn onClick={openCart}>{tr('Review pre-order · {n} items', { n: cartCount })}</Btn>
        </div>
      }
    </div>);

}

function MenuRow({ it, payPer, qty, onClick, onAdd }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', gap: 12, padding: 12, borderRadius: 14,
      background: 'var(--surface)', border: '1px solid var(--line)',
      alignItems: 'flex-start', cursor: 'pointer'
    }}>
      <div style={{ width: 70, height: 70, borderRadius: 10, flexShrink: 0, overflow: 'hidden' }}>
        <PhotoTile h={70} src={it.img} tone={it.dietary.includes('vg') ? 'green' : it.cat === 'desserts' ? 'warm' : 'cool'} label="" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          {it.tag && <Pill tone="primary">{tr(it.tag)}</Pill>}
          {it.dietary.includes('vg') && <Pill tone="green">{tr('Vegan')}</Pill>}
          {it.dietary.includes('v') && !it.dietary.includes('vg') && <Pill tone="green">{tr('Veg')}</Pill>}
          {it.dietary.includes('gf') && <Pill>GF</Pill>}
        </div>
        <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 15, letterSpacing: '-0.005em', lineHeight: 1.25 }}>{tr(it.name)}</div>
        <div style={{ color: 'var(--ink-3)', fontSize: 12, lineHeight: 1.4, marginTop: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{tr(it.desc)}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{payPer ? `$${it.price}` : tr('Included')}</span>
          {qty > 0 ?
          <Pill tone="primary">{qty} {tr('in cart')}</Pill> :

          <button onClick={(e) => {e.stopPropagation();onAdd();}} style={{
            appearance: 'none', border: 0, cursor: 'pointer',
            padding: '6px 12px', borderRadius: 999,
            background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 12, fontFamily: 'inherit'
          }}>{tr('Add')}</button>
          }
        </div>
      </div>
    </div>);

}

function Switch({ on, onChange }) {
  return <button onClick={() => onChange(!on)} style={{
    width: 40, height: 24, borderRadius: 999, border: 0, cursor: 'pointer',
    background: on ? 'var(--primary)' : 'var(--line-strong)',
    position: 'relative', padding: 0, appearance: 'none'
  }}>
    <span style={{ position: 'absolute', top: 3, left: on ? 19 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .18s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
  </button>;
}

// ─────────────────────────────────────────────────────────────
// ITEM DETAIL
// ─────────────────────────────────────────────────────────────
function ScreenItem({ s, itemId, back, dispatchCart, cart, addToast }) {
  const it = MENU.find((x) => x.id === itemId);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const userAllergens = s.allergies.map((a) => ALLERGY_TO_KEY[a]).filter(Boolean);
  const conflict = userAllergens.find((k) => it.allergens.includes(k));

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <div style={{ position: 'relative' }}>
        <PhotoTile h={300} src={it.img} tone={it.dietary.includes('vg') ? 'green' : 'cool'} label={tr(it.name)} />
        <button onClick={back} style={{
          position: 'absolute', top: 14, left: 14, width: 38, height: 38, borderRadius: '50%', border: 0, cursor: 'pointer',
          background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(10px)', fontSize: 18, fontWeight: 700
        }}>←</button>
      </div>

      <div style={{ padding: '18px 20px 0', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {it.tag && <Pill tone="primary">{tr(it.tag)}</Pill>}
        {it.dietary.map((d) => <Pill key={d} tone={d === 'vg' || d === 'v' ? 'green' : 'neutral'}>{tr(DIETARY_LABELS[d] || d)}</Pill>)}
      </div>
      <div style={{ padding: '10px 20px 0' }}>
        <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{tr(it.name)}</div>
        <div style={{ color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.55, marginTop: 8 }}>{tr(it.desc)}</div>
      </div>

      {conflict &&
      <div style={{ margin: '16px 20px 0', padding: 14, borderRadius: 12, background: 'var(--err-100)', display: 'flex', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--err)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>⚠</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--err)' }}>Contains {ALLERGEN_LABELS[conflict]}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>{tr('Flagged from your profile. The kitchen can adapt — note it below.')}</div>
          </div>
        </div>
      }

      {it.allergens.length > 0 &&
      <div style={{ padding: '14px 20px 0' }}>
          <div style={{ fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6, fontFamily: 'JetBrains Mono' }}>{tr('Allergens')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {it.allergens.map((a) => <Pill key={a} tone={userAllergens.includes(a) ? 'danger' : 'neutral'}>{ALLERGEN_LABELS[a]}</Pill>)}
          </div>
        </div>
      }

      <div style={{ padding: '18px 20px 0' }}>
        <div style={{ fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6, fontFamily: 'JetBrains Mono' }}>{tr('Notes for chef')}</div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tr('e.g. omit chili, no peanuts please')}
        style={{ width: '100%', minHeight: 64, resize: 'none', borderRadius: 12, border: '1px solid var(--line)', padding: 12, fontFamily: 'inherit', fontSize: 13.5, background: 'var(--surface)', color: 'var(--ink-1)' }} />
      </div>

      <div style={{ padding: '16px 20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 999, padding: 4 }}>
          <button onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 32, height: 32, borderRadius: '50%', border: 0, background: 'transparent', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>−</button>
          <div style={{ minWidth: 22, textAlign: 'center', fontWeight: 700 }}>{qty}</div>
          <button onClick={() => setQty(qty + 1)} style={{ width: 32, height: 32, borderRadius: '50%', border: 0, background: 'transparent', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>+</button>
        </div>
        <div style={{ flex: 1 }}>
          <Btn onClick={() => {dispatchCart({ type: 'add', id: it.id, qty, price: it.price, note: notes });addToast(tr('Added to cart'));back();}}>
            Add · {s.payPerItem ? `$${it.price * qty}` : tr('Included')}
          </Btn>
        </div>
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// CART
// ─────────────────────────────────────────────────────────────
function ScreenCart({ s, cart, dispatchCart, back, onSubmit, context = 'dine' }) {
  const lines = Object.entries(cart.items).map(([id, l]) => {
    const it = MENU.find((x) => x.id === id) || TRAIL_BOXES.find((x) => x.id === id);
    return { ...l, it, id };
  }).filter((l) => l.it);
  const total = lines.reduce((sum, l) => sum + (l.it.price || 0) * l.qty, 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px' }}>
        <button onClick={back} style={{ appearance: 'none', border: 0, background: 'var(--surface-2)', cursor: 'pointer', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{context === 'room' ? tr('Room service') : context === 'trail' ? tr('Trail box') : tr('Pre-order')}</div>
          <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22, letterSpacing: '-0.015em' }}>{tr('Your order')}</div>
        </div>
      </div>

      {lines.length === 0 ?
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: 14 }}>{tr('Nothing here yet.')}</div>
        </div> :

      <>
          <div style={{ padding: '6px 18px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lines.map((l) =>
          <div key={l.id} style={{ display: 'flex', gap: 10, padding: 10, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--line)' }}>
                <div style={{ width: 50, height: 50, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                  <PhotoTile h={50} src={l.it.img} tone="cool" label="" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.005em' }}>{tr(l.it.name)}</div>
                  {l.note && <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', marginTop: 2 }}>"{l.note}"</div>}
                  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', borderRadius: 999, padding: 2 }}>
                      <button onClick={() => dispatchCart({ type: 'qty', id: l.id, qty: l.qty - 1 })} style={{ width: 26, height: 26, borderRadius: '50%', border: 0, background: 'transparent', cursor: 'pointer', fontWeight: 700 }}>−</button>
                      <span style={{ minWidth: 20, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{l.qty}</span>
                      <button onClick={() => dispatchCart({ type: 'qty', id: l.id, qty: l.qty + 1 })} style={{ width: 26, height: 26, borderRadius: '50%', border: 0, background: 'transparent', cursor: 'pointer', fontWeight: 700 }}>+</button>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{s.payPerItem ? `$${l.it.price * l.qty}` : tr('Included')}</div>
                  </div>
                </div>
              </div>
          )}
          </div>

          <div style={{ margin: '16px 18px 0', padding: 16, borderRadius: 14, background: s.payPerItem ? 'var(--fpt-orange-100)' : 'var(--fpt-green-100)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)' }}>
              <span>{count} {tr('items')}</span>
              <span>{s.payPerItem ? `$${total}` : tr('Included · all-incl.')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>
              <span>{s.payPerItem ? tr('Charged to') : tr('Coverage')}</span>
              <span style={{ fontWeight: 700 }}>{s.isExternal ? tr('Card on file') : s.payPerItem ? tr('Your room bill') : s.pkgBadge}</span>
            </div>
            <div style={{ height: 1, background: 'rgba(0,0,0,.08)', margin: '10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800 }}>
              <span>{tr('Total')}</span>
              <span>{s.payPerItem ? `$${total}` : '$0'}</span>
            </div>
          </div>

          <div style={{ padding: '16px 18px 24px' }}>
            <Btn onClick={onSubmit}>{context === 'room' ? tr('Send to kitchen') : context === 'trail' ? tr('Confirm pick-up') : tr('Send pre-order')}</Btn>
          </div>
        </>
      }
    </div>);

}

// ─────────────────────────────────────────────────────────────
// ROOM SERVICE FLOW (different chrome — no "show route")
// ─────────────────────────────────────────────────────────────
function RoomServiceFlow({ s, flow, setFlow, exit, cart, dispatchCart, openItem, addToast, addOrder }) {
  const step = flow.step;

  if (step === 1) {
    return <WizardChrome title={tr('Room service · menu')} step={1} total={3} onBack={exit}
    footer={Object.values(cart.items).reduce((a, b) => a + b.qty, 0) > 0 ? <Btn onClick={() => setFlow({ ...flow, step: 2 })}>{tr('Review · {n} items', { n: Object.values(cart.items).reduce((a, b) => a + b.qty, 0) })}</Btn> : null}>
      <div style={{ padding: '14px 18px 0' }}>
        <div style={{ padding: 12, borderRadius: 12, background: 'var(--primary-50)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🚪</div>
          <div style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 700, color: 'var(--primary-700)' }}>{tr('Delivering to')} {s.room.split(' · ')[0]}</div>
            <div style={{ color: 'var(--ink-2)' }}>{tr('You\'ll set the time on the next step.')}</div>
          </div>
        </div>
      </div>
      <ScreenMenu s={s} cart={cart} dispatchCart={dispatchCart} openItem={openItem} openCart={() => setFlow({ ...flow, step: 2 })} mode="wizard" />
    </WizardChrome>;
  }

  if (step === 2) {
    return <ScreenCart s={s} cart={cart} dispatchCart={dispatchCart} back={() => setFlow({ ...flow, step: 1 })} onSubmit={() => setFlow({ ...flow, step: 3 })} context="room" />;
  }

  if (step === 3) {
    const [delivery, setDelivery] = useState('30');
    return <WizardChrome title={tr('When?')} step={3} total={3} onBack={() => setFlow({ ...flow, step: 2 })}
    footer={<Btn onClick={() => {
      const total = Object.entries(cart.items).reduce((s, [id, l]) => s + (MENU.find((m) => m.id === id)?.price || 0) * l.qty, 0);
      addOrder({ type: 'room', items: cart.items, total, eta: delivery, room: s.room });
      dispatchCart({ type: 'reset' });
      addToast(tr('Order placed · runner notified'));
      exit('orders');
    }}>{tr('Confirm room service')}</Btn>}>
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 14 }}>{tr('When should we knock?')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
          { k: '15', l: tr('In 15 minutes'), sub: tr('Express prep · quick courses') },
          { k: '30', l: tr('In 30 minutes'), sub: tr('Most common') },
          { k: '45', l: tr('In 45 minutes'), sub: tr('Time for a shower first') },
          { k: '60', l: tr('In an hour'), sub: tr('No rush') }].
          map((o) =>
          <button key={o.k} onClick={() => setDelivery(o.k)} style={{
            appearance: 'none', textAlign: 'left', cursor: 'pointer',
            padding: 14, borderRadius: 14, fontFamily: 'inherit',
            background: 'var(--surface)',
            border: delivery === o.k ? '2px solid var(--primary)' : '1px solid var(--line)',
            display: 'flex', alignItems: 'center', gap: 12
          }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {delivery === o.k && <div style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--primary)' }} />}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{o.l}</div>
                <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 2 }}>{o.sub}</div>
              </div>
            </button>
          )}
        </div>
        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: 'var(--surface-2)', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          {tr('Allergens auto-flagged. Charges')} {s.payPerItem ? tr('added to your room bill') : tr('covered by your all-inclusive plan')}.
        </div>
      </div>
    </WizardChrome>;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// TRAIL / PACKED LUNCH FLOW
// ─────────────────────────────────────────────────────────────
function TrailFlow({ s, flow, setFlow, exit, cart, dispatchCart, addToast, addOrder }) {
  const step = flow.step;
  const tr = window.t || ((x) => x);

  // Diet filter — null = no filter; persists during this flow session
  const [diet, setDiet] = useState(s.diet && s.diet.includes('Vegan') ? 'vg' : s.diet && s.diet.includes('Vegetarian') ? 'v' : null);
  const [pickup, setPickup] = useState('07:00');

  if (step === 1) {
    const filtered = diet ? TRAIL_BOXES.filter((b) => b.dietary.includes(diet)) : TRAIL_BOXES;
    const filterChips = [
    { k: null, l: tr('All') },
    { k: 'vg', l: tr('Vegan'), icon: '🌱' },
    { k: 'v', l: tr('Vegetarian'), icon: '🥬' },
    { k: 'gf', l: tr('Gluten-free'), icon: '🌾' }];

    return <WizardChrome title={tr('Pick a box')} step={1} total={2} onBack={exit}
    footer={Object.values(cart.items).reduce((a, b) => a + b.qty, 0) > 0 ? <Btn onClick={() => setFlow({ ...flow, step: 2 })}>{tr('Continue')}</Btn> : null}>
      <div style={{ padding: '14px 18px 0' }}>
        <div style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 12 }}>{tr('Ready at the front desk tomorrow morning.')}</div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
          {filterChips.map((c) => {
            const active = diet === c.k;
            return <button key={c.l} onClick={() => setDiet(c.k)} style={{
              appearance: 'none', border: 0, cursor: 'pointer',
              padding: '7px 13px', borderRadius: 999, fontFamily: 'inherit',
              fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
              background: active ? 'var(--ink-1)' : 'var(--surface)',
              color: active ? '#fff' : 'var(--ink-2)',
              border: active ? '1px solid var(--ink-1)' : '1px solid var(--line)',
              display: 'inline-flex', alignItems: 'center', gap: 4
            }}>{c.icon && <span style={{ fontSize: 13 }}>{c.icon}</span>}{c.l}</button>;
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.length === 0 &&
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', background: 'var(--surface)', borderRadius: 14, border: '1px dashed var(--line-strong)', fontSize: 13 }}>
              {tr('No boxes match this filter.')}
            </div>
          }
          {filtered.map((b) => {
            const qty = cart.items[b.id]?.qty || 0;
            return <div key={b.id} style={{ display: 'flex', gap: 12, padding: 12, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--line)' }}>
              <div style={{ width: 72, height: 72, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                <PhotoTile h={72} src={b.img} tone={b.dietary.includes('vg') ? 'green' : 'warm'} label="" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 15, letterSpacing: '-0.005em' }}>{b.name}</div>
                  {b.dietary.includes('vg') && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: 'var(--fpt-green-100)', color: 'var(--fpt-green-700)' }}>VG</span>}
                  {b.dietary.includes('v') && !b.dietary.includes('vg') && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: 'var(--fpt-green-100)', color: 'var(--fpt-green-700)' }}>V</span>}
                  {b.dietary.includes('gf') && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: 'var(--primary-50)', color: 'var(--primary-700)' }}>GF</span>}
                </div>
                <div style={{ color: 'var(--ink-3)', fontSize: 12, lineHeight: 1.45, marginTop: 2 }}>{b.desc}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>${b.price}</span>
                  {qty > 0 ?
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-2)', borderRadius: 999, padding: 2 }}>
                        <button onClick={() => dispatchCart({ type: 'qty', id: b.id, qty: qty - 1 })} style={{ width: 26, height: 26, borderRadius: '50%', border: 0, background: 'transparent', cursor: 'pointer', fontWeight: 700 }}>−</button>
                        <span style={{ minWidth: 20, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{qty}</span>
                        <button onClick={() => dispatchCart({ type: 'add', id: b.id, qty: 1, price: b.price })} style={{ width: 26, height: 26, borderRadius: '50%', border: 0, background: 'transparent', cursor: 'pointer', fontWeight: 700 }}>+</button>
                      </div> :
                  <button onClick={() => dispatchCart({ type: 'add', id: b.id, qty: 1, price: b.price })} style={{ appearance: 'none', border: 0, cursor: 'pointer', padding: '6px 14px', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>{tr('Add')}</button>
                  }
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>
    </WizardChrome>;
  }

  if (step === 2) {
    return <WizardChrome title={tr('Pick-up time')} step={2} total={2} onBack={() => setFlow({ ...flow, step: 1 })}
    footer={<Btn onClick={() => {
      const total = Object.entries(cart.items).reduce((s, [id, l]) => s + (TRAIL_BOXES.find((b) => b.id === id)?.price || 0) * l.qty, 0);
      addOrder({ type: 'trail', items: cart.items, total, pickup });
      dispatchCart({ type: 'reset' });
      addToast(tr('Pick-up confirmed for tomorrow'));
      exit('orders');
    }}>{tr('Confirm pick-up')}</Btn>}>
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 14 }}>{tr('Pick up tomorrow morning at the front desk.')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {['06:00', '06:30', '07:00', '07:30'].map((t) =>
          <button key={t} onClick={() => setPickup(t)} style={{
            appearance: 'none', padding: '14px 0', borderRadius: 12, cursor: 'pointer',
            background: pickup === t ? 'var(--primary)' : 'var(--surface)',
            color: pickup === t ? '#fff' : 'var(--ink-1)',
            border: pickup === t ? 0 : '1px solid var(--line)',
            fontWeight: 700, fontSize: 14, fontFamily: 'inherit'
          }}>{t}</button>
          )}
        </div>
      </div>
    </WizardChrome>;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// ORDERS / RESERVATIONS
// ─────────────────────────────────────────────────────────────
function ScreenOrders({ s, history, openHelp, hasBooking, reservation }) {
  return (
    <div style={{ padding: '14px 0 24px' }}>
      <ScreenTitle kicker="Your day" title="Orders & bookings" />

      {/* Active reservation */}
      {hasBooking &&
      <>
          <div style={{ padding: '14px 18px 8px', fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{tr('Tonight')}</div>
          <div style={{ padding: '0 18px' }}>
            <div style={{ padding: 18, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22, color: 'var(--primary)' }}>{reservation.tableId || s.booking.table}</div>
                  <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 2 }}>{tr(DINING_AREAS.find((a) => a.id === reservation.area)?.label || s.booking.area)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 18 }}>{reservation.time || s.booking.time}</div>
                  <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 2 }}>{reservation.party || s.booking.party} {tr('guests')}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <Pill tone="primary">Confirmed</Pill>
                {s.allergies.length > 0 && <Pill tone="danger">Allergens flagged</Pill>}
              </div>
            </div>
          </div>
        </>
      }

      {/* Active orders */}
      <div style={{ padding: '20px 18px 8px', fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{tr('Active orders')}</div>
      {history.length === 0 ?
      <div style={{ margin: '0 18px', padding: 18, borderRadius: 14, border: '1px dashed var(--line-strong)', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
          Nothing in the kitchen yet.
        </div> :

      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {history.map((o) =>
        <div key={o.id} style={{ padding: 14, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.005em' }}>
                    {o.type === 'room' ? tr('Room service · {x}', { x: (o.room || '').split(' · ')[0] }) :
                o.type === 'trail' ? tr('Trail box · pick-up {x}', { x: o.pickup }) :
                tr('Pre-order · in kitchen')}
                  </div>
                  <div style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 2 }}>
                    {Object.values(o.items).reduce((s, l) => s + l.qty, 0)} items · {s.payPerItem ? `$${o.total}` : tr('Included')}
                  </div>
                </div>
                <Pill tone={o.type === 'room' ? 'primary' : 'green'}>{o.type === 'room' ? tr('EN ROUTE') : o.type === 'trail' ? tr('BOOKED') : tr('PREPARING')}</Pill>
              </div>

              {o.type === 'room' &&
          <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {['Received', 'Cooking', 'En route', 'Knock'].map((s, i) =>
              <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= 1 ? 'var(--primary)' : 'var(--line)' }} />
              )}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>Cooking · ~{o.eta} min away</div>
                </div>
          }
            </div>
        )}
        </div>
      }

      {/* Help */}
      <div style={{ padding: '20px 18px 0' }}>
        <button onClick={openHelp} style={{ appearance: 'none', border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', padding: 14, borderRadius: 14, width: '100%', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-100)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>♿</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{tr('Request assistance')}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{tr('Escort, tactile menu, eating help')}</div>
          </div>
          <span style={{ color: 'var(--ink-3)' }}>→</span>
        </button>
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────
function ScreenProfile({ s }) {
  return (
    <div style={{ padding: '14px 0 24px' }}>
      <ScreenTitle kicker={tr('From your booking')} title={tr('Profile')} />
      <div style={{ padding: '0 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 20 }}>
            {s.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 18 }}>{s.name}</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 12.5, marginTop: 2 }}>{s.room}</div>
          </div>
        </div>
      </div>

      <ProfileSection title={tr('Package')}>
        <Row k={tr('Plan')} v={tr(s.pkg)} />
        <Row k={tr('Coverage')} v={s.payPerItem ? tr('Pay per item') : tr('All meals included')} />
      </ProfileSection>

      <ProfileSection title={tr('Dietary')}>
        {s.allergies.length > 0 && <Row k={tr('Allergies')} v={<span style={{ color: 'var(--err)' }}>{s.allergies.map((a) => tr(a)).join(', ')}</span>} />}
        {s.diet.length > 0 && <Row k={tr('Preferences')} v={s.diet.map((d) => tr(d)).join(', ')} />}
        {s.allergies.length === 0 && s.diet.length === 0 && <Row k="" v={<span style={{ color: 'var(--ink-3)' }}>{tr('None on file')}</span>} />}
      </ProfileSection>

      {s.accessibility &&
      <ProfileSection title={tr('Accessibility')}>
          {s.accessibility.escort && <Row k={tr('Escort')} v={tr('Booked')} />}
          {s.accessibility.tactileMenu && <Row k={tr('Tactile menu')} v={tr('Ready')} />}
          {s.accessibility.mobility && <Row k={tr('Mobility')} v={tr('Wheelchair access')} />}
        </ProfileSection>
      }

      <ProfileSection title={tr('Language')}>
        <Row k={tr('Interface')} v={tr('English · change')} />
      </ProfileSection>
    </div>);

}

function ProfileSection({ title, children }) {
  return <div style={{ padding: '20px 18px 0' }}>
    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }}>{title}</div>
    <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--line)', overflow: 'hidden' }}>{children}</div>
  </div>;
}
function Row({ k, v }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
    <span style={{ color: 'var(--ink-3)' }}>{k}</span>
    <span style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{v}</span>
  </div>;
}

// ─────────────────────────────────────────────────────────────
// HELP MODAL
// ─────────────────────────────────────────────────────────────
function HelpModal({ close, save }) {
  const [r, setR] = useState({ escort: false, tactile: false, wheelchair: false, eating: false });
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,27,46,.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
      <div style={{ width: '100%', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85%', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, background: 'var(--line)', borderRadius: 2, margin: '0 auto 14px' }} />
        <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', marginBottom: 6 }}>{tr('Request assistance')}</div>
        <div style={{ color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.5, marginBottom: 14 }}>{tr('Saved to your profile. Routed to the host, server and kitchen.')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
          ['escort', tr('Escort to the table'), tr('Meet me at the spa lift')],
          ['tactile', tr('Tactile or large-print menu'), tr('Braille available')],
          ['wheelchair', tr('Wheelchair-accessible seat'), tr('Wider aisle, lower table')],
          ['eating', tr('Assistance with eating'), tr('Server briefed quietly')]].
          map(([k, t, sub]) =>
          <div key={k} onClick={() => setR({ ...r, [k]: !r[k] })} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12,
            border: r[k] ? '2px solid var(--primary)' : '1px solid var(--line)',
            background: r[k] ? 'var(--primary-50)' : 'var(--surface)',
            cursor: 'pointer'
          }}>
              <Switch on={r[k]} onChange={() => setR({ ...r, [k]: !r[k] })} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t}</div>
                <div style={{ color: 'var(--ink-3)', fontSize: 11.5, marginTop: 2 }}>{sub}</div>
              </div>
            </div>
          )}
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <Btn kind="ghost" full={false} onClick={close} style={{ flex: 1 }}>{tr('Cancel')}</Btn>
          <Btn onClick={() => {save(r);close();}} style={{ flex: 1 }}>{tr('Save')}</Btn>
        </div>
      </div>
    </div>);

}

Object.assign(window, {
  Pill, Btn, PhotoTile, ScreenTitle, WizardChrome, Switch, LegendDot,
  ScreenHome, DineWizard, ScreenMenu, MenuRow, ScreenItem, ScreenCart,
  RoomServiceFlow, TrailFlow, ScreenOrders, ScreenProfile, HelpModal
});