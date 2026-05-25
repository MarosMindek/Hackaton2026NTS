// guest-app-v2.jsx — top-level state machine for the guest standalone app

const { useState, useReducer, useEffect } = React;

function cartReducer(state, action) {
  switch (action.type) {
    case 'add': {
      const cur = state.items[action.id]?.qty || 0;
      return { ...state, items: { ...state.items, [action.id]: { qty: cur + action.qty, price: action.price, note: action.note || state.items[action.id]?.note || '' } } };
    }
    case 'qty': {
      const items = { ...state.items };
      if (action.qty <= 0) delete items[action.id];
      else items[action.id] = { ...(items[action.id] || {}), qty: action.qty };
      return { ...state, items };
    }
    case 'reset': return { items: {} };
    default: return state;
  }
}

function reserveReducer(state, action) {
  if (action.type === 'set') return { ...state, ...action, type: undefined };
  if (action.type === 'commit') return { ...state, committed: true };
  if (action.type === 'reset') return action.initial;
  return state;
}

function App() {
  const tr = window.t || ((x) => x);
  const [lang, setLangState] = useLang();
  const [scenarioKey, setScenarioKey] = useState('resort');
  const s = SCENARIOS[scenarioKey];

  // Tabbar
  const [tab, setTab] = useState('home');
  // Sub-screen within a tab (e.g., menu's item detail)
  const [sub, setSub] = useState(null); // { kind:'item', id } | { kind:'cart' } | null
  // Wizard flow overlay
  const [flow, setFlow] = useState(null); // { type:'dine'|'room'|'trail'|'menu-after-reserve', step }
  // Help modal
  const [helpOpen, setHelpOpen] = useState(false);
  // Toast
  const [toast, setToast] = useState(null);

  // Cart (shared across flows during a session)
  const [cart, dispatchCart] = useReducer(cartReducer, { items: {} });

  // Active reservation (mutable)
  const initialReserve = {
    date: tr('Today'), time: s.booking.time, party: s.booking.party,
    area: 'terrace', tableId: s.booking.table, committed: true,
  };
  const [reservation, dispatchReserve] = useReducer(reserveReducer, initialReserve);

  // Order history (placed orders shown in Orders tab)
  const [history, setHistory] = useState([
    // a sample completed order to show layout
  ]);

  useEffect(() => {
    // When scenario changes, reset everything
    dispatchCart({ type: 'reset' });
    dispatchReserve({ type: 'reset', initial: {
      date: tr('Today'), time: SCENARIOS[scenarioKey].booking.time, party: SCENARIOS[scenarioKey].booking.party,
      area: SCENARIOS[scenarioKey].booking.area === 'Indoor' ? 'indoor' : 'terrace',
      tableId: SCENARIOS[scenarioKey].booking.table, committed: true,
    }});
    setTab('home'); setSub(null); setFlow(null);
    setHistory([]);
  }, [scenarioKey]);

  function addToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }
  function addOrder(o) {
    setHistory(h => [{ id: 'o' + Date.now(), ...o }, ...h]);
  }

  // Language switcher in the side panel
  useEffect(() => {
    const host = document.getElementById('lang-switch-host');
    if (!host) return;
    host.innerHTML = `
      <h4 style="font-family: var(--font-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); font-weight: 500; margin-bottom: 10px;">${tr('Language')}</h4>
      <div style="display:flex; gap:6px; padding:4px; background: var(--surface-2); border-radius: 999px; width: fit-content;">
        <button data-l="sk" style="appearance:none; border:0; cursor:pointer; padding:6px 14px; border-radius: 999px; font-family:inherit; font-size:12px; font-weight:700; background:${lang==='sk'?'var(--ink-1)':'transparent'}; color:${lang==='sk'?'#fff':'var(--ink-3)'};">SK</button>
        <button data-l="en" style="appearance:none; border:0; cursor:pointer; padding:6px 14px; border-radius: 999px; font-family:inherit; font-size:12px; font-weight:700; background:${lang==='en'?'var(--ink-1)':'transparent'}; color:${lang==='en'?'#fff':'var(--ink-3)'};">EN</button>
      </div>
      <div style="color: var(--ink-3); font-size: 11.5px; margin-top: 6px;">${tr('Primary language: Slovak. Secondary: English.')}</div>
    `;
    host.querySelectorAll('button[data-l]').forEach(b => {
      b.onclick = () => setLangState(b.getAttribute('data-l'));
    });
    // Translate the static side / context headings
    const map = {
      'side-h-switch': tr('Switch guest'),
      'side-h-profile': tr('Profile · pulled from PMS'),
      'ctx-h-steps': tr('Flow steps'),
      'ctx-h-happening': tr("What's happening"),
      'ctx-h-try': tr('Try it'),
      'stage-head-label': tr('Guest App · iOS · Pre-arrival → Service'),
    };
    Object.entries(map).forEach(([id, text]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    });
    const tryBody = document.getElementById('ctx-try-body');
    if (tryBody) tryBody.textContent = tr('Tap anywhere in the phone — the full flow is interactive. Switch scenarios on the left to see how the experience adapts to all-inclusive, walk-in or assisted-dining guests.');
    const back = document.querySelector('.back-link');
    if (back) back.textContent = tr('← Hub');
  }, [lang, scenarioKey]);

  // Render side scenario list
  useEffect(() => {
    const el = document.getElementById('scenarios');
    if (!el) return;
    el.innerHTML = '';
    Object.entries(SCENARIOS).forEach(([k, v]) => {
      const b = document.createElement('button');
      b.className = 'item ' + (k === scenarioKey ? 'active' : '');
      b.onclick = () => setScenarioKey(k);
      b.innerHTML = `<div class="name">${v.name}</div><div class="meta">${v.pkgBadge} · ${v.room.split(' · ')[0]}</div>`;
      el.appendChild(b);
    });
  }, [scenarioKey, lang]);

  // Render profile card
  useEffect(() => {
    const el = document.getElementById('profile-card');
    if (!el) return;
    el.innerHTML = `
      <div style="font-weight:700; font-size:14px; letter-spacing:-0.005em;">${s.name}</div>
      <div style="color:var(--ink-3); font-size:12px; margin-top:2px;">${s.room}</div>
      <div class="row"><span class="k">${tr('Package')}</span><span class="v">${s.pkgBadge}</span></div>
      ${s.allergies.length ? `<div class="row"><span class="k">${tr('Allergies')}</span><span class="v" style="color:var(--err);">⚠ ${s.allergies.join(', ')}</span></div>` : ''}
      ${s.diet.length ? `<div class="row"><span class="k">${tr('Dietary')}</span><span class="v">${s.diet.join(', ')}</span></div>` : ''}
      ${s.family ? `<div class="row"><span class="k">${tr('Party')}</span><span class="v">${tr('Family')} · 2+2</span></div>` : ''}
      ${s.accessibility ? `<div class="row"><span class="k">${tr('Accessibility')}</span><span class="v" style="color:var(--primary-700);">${tr('Escort')} · ${tr('Tactile menu')}</span></div>` : ''}
    `;
  }, [scenarioKey, lang]);

  // Render flow steps (right panel)
  useEffect(() => {
    const el = document.getElementById('steps');
    if (!el) return;
    el.innerHTML = '';
    const steps = computeSteps();
    steps.forEach((step, i) => {
      const div = document.createElement('div');
      div.className = 'step ' + (step.active ? 'active' : '');
      div.innerHTML = `<span class="n">0${i+1}</span><span>${step.label}</span>`;
      el.appendChild(div);
    });

    const info = document.getElementById('info');
    if (info) info.innerHTML = computeInfo();
  });

  function computeSteps() {
    if (flow?.type === 'dine') {
      return [
        { label: tr('Pick time & party'), active: flow.step === 1 },
        { label: tr('Pick area'), active: flow.step === 2 },
        { label: tr('Pick seat'), active: flow.step === 3 },
        { label: tr('Review & pre-order'), active: flow.step === 4 },
      ];
    }
    if (flow?.type === 'room') {
      return [
        { label: tr('Browse menu'), active: flow.step === 1 },
        { label: tr('Review cart'), active: flow.step === 2 },
        { label: tr('Pick delivery time'), active: flow.step === 3 },
      ];
    }
    if (flow?.type === 'trail') {
      return [
        { label: tr('Pick a box'), active: flow.step === 1 },
        { label: tr('Pick-up time'), active: flow.step === 2 },
      ];
    }
    if (sub?.kind === 'item') return [{ label: tr('Item detail'), active: true }];
    if (sub?.kind === 'cart') return [{ label: tr('Cart review'), active: true }];
    return [
      { label: tr('Home'), active: tab === 'home' },
      { label: tr('Menu'), active: tab === 'menu' },
      { label: tr('Orders & bookings'), active: tab === 'orders' },
      { label: tr('Profile'), active: tab === 'profile' },
    ];
  }

  function computeInfo() {
    if (window.LANG === 'sk') {
      if (flow?.type === 'dine') return `Rezervujete stôl na dnes večer. Mapa miest zobrazuje živú dostupnosť — obsadené miesta sú <b>tmavé</b>, vaše <b>modré</b>.`;
      if (flow?.type === 'room') return `Objednávka izbovej služby ide na samostatný KDS panel. Doručenie do <b>${s.room.split(' · ')[0]}</b>; nepotrebujete navigáciu.`;
      if (flow?.type === 'trail') return `Balené obedy sa pripravujú večer vopred. Vyzdvihnete si ich na recepcii ráno.`;
      if (sub?.kind === 'item') return `Alergény sa čítajú z profilu rezervácie — konflikty sú červené. Poznámky idú rovno do kuchyne.`;
      if (tab === 'home') return `Súhrn rezervácie + tri hlavné toky. Bannery alergie a prístupnosti sa zobrazia, len keď sú relevantné.`;
      if (tab === 'menu') return `Prehliadajte a pred-objednávajte pred príchodom. Položky s alergénmi z profilu sú skryté a dajú sa odhaliť jedným klepnutím.`;
      if (tab === 'orders') return `Živý stav izbových objednávok, dnešnej rezervácie a vyzdvihnutí — všetko na jednom mieste.`;
      if (tab === 'profile') return `Načítané z PMS pri rezervácii. Zmeny sa synchronizujú späť do PMS pri uložení.`;
      return '';
    }
    if (flow?.type === 'dine') return `Reserving a table for tonight. The seat map shows live availability — booked seats are <b>dark</b>, yours is <b>blue</b>.`;
    if (flow?.type === 'room') return `Room service order goes to a separate KDS rail. Delivery to <b>${s.room.split(' · ')[0]}</b>; no wayfinding required.`;
    if (flow?.type === 'trail') return `Packed lunches are fired during the previous evening's prep. Pick up at the front desk before you head out.`;
    if (sub?.kind === 'item') return `Allergens pulled from the booking profile — conflicts show in red. Notes go straight to the kitchen.`;
    if (tab === 'home') return `Booking summary + three primary flows. Allergy & accessibility banners only show when relevant.`;
    if (tab === 'menu') return `Browse pre-order before arrival. Items with profiled allergens are hidden by default with a one-tap reveal.`;
    if (tab === 'orders') return `Live status for room-service orders, today's booking, and packed-lunch pick-ups. One place.`;
    if (tab === 'profile') return `Sourced from the PMS at booking. Edits sync back to PMS on save.`;
    return '';
  }

  // Helpers passed into screens
  const openFlow = type => {
    setSub(null);
    if (type === 'dine') {
      dispatchReserve({ type: 'reset', initial: { date: tr('Today'), time: s.booking.time, party: s.booking.party, area: 'terrace', tableId: null, committed: false }});
      setFlow({ type: 'dine', step: 1 });
    }
    if (type === 'room') {
      dispatchCart({ type: 'reset' });
      setFlow({ type: 'room', step: 1 });
    }
    if (type === 'trail') {
      dispatchCart({ type: 'reset' });
      setFlow({ type: 'trail', step: 1 });
    }
  };
  const exitFlow = (destTab) => {
    setFlow(null);
    if (destTab) setTab(destTab);
  };

  // RENDER
  let body = null;

  // Wizard flows take over the body
  if (flow?.type === 'dine') {
    body = <DineWizard s={s} flow={flow} setFlow={setFlow} exit={() => setFlow(null)} dispatchReserve={dispatchReserve} reservation={reservation} addToast={addToast}/>;
  } else if (flow?.type === 'room') {
    if (sub?.kind === 'item') {
      body = <ScreenItem s={s} itemId={sub.id} back={() => setSub(null)} dispatchCart={dispatchCart} cart={cart} addToast={addToast}/>;
    } else {
      body = <RoomServiceFlow s={s} flow={flow} setFlow={setFlow} exit={(t) => exitFlow(t)} cart={cart} dispatchCart={dispatchCart} openItem={id => setSub({ kind:'item', id })} addToast={addToast} addOrder={addOrder}/>;
    }
  } else if (flow?.type === 'trail') {
    body = <TrailFlow s={s} flow={flow} setFlow={setFlow} exit={(t) => exitFlow(t)} cart={cart} dispatchCart={dispatchCart} addToast={addToast} addOrder={addOrder}/>;
  } else if (flow?.type === 'menu-after-reserve') {
    // After reservation, drop user into menu for pre-ordering
    if (sub?.kind === 'item') {
      body = <ScreenItem s={s} itemId={sub.id} back={() => setSub(null)} dispatchCart={dispatchCart} cart={cart} addToast={addToast}/>;
    } else if (sub?.kind === 'cart') {
      body = <ScreenCart s={s} cart={cart} dispatchCart={dispatchCart} back={() => setSub(null)} onSubmit={() => {
        const total = Object.entries(cart.items).reduce((t,[id,l])=>t+(MENU.find(m=>m.id===id)?.price||0)*l.qty,0);
        addOrder({ type:'dine', items: cart.items, total });
        dispatchCart({ type:'reset' });
        setFlow(null);
        setSub(null);
        addToast(tr('Pre-order sent to kitchen'));
        setTab('orders');
      }} context="dine"/>;
    } else {
      const cartCount = Object.values(cart.items).reduce((a,b)=>a+b.qty,0);
      body = (
        <div>
          <div style={{ padding: '14px 18px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => { setFlow(null); }} style={{ appearance: 'none', border: 0, background: 'var(--surface-2)', cursor: 'pointer', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>✕</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 600 }}>{tr('Booked')} · {reservation.tableId} · {reservation.time}</div>
              <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 22, letterSpacing: '-0.015em' }}>{tr('Pre-order for tonight')}</div>
            </div>
            <button onClick={() => { setFlow(null); setTab('orders'); }} style={{
              appearance: 'none', border: 0, cursor: 'pointer',
              padding: '8px 14px', borderRadius: 999,
              background: cartCount > 0 ? 'transparent' : 'var(--primary)',
              color: cartCount > 0 ? 'var(--primary)' : '#fff',
              fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            }}>{cartCount > 0 ? tr('Skip') : tr('Done →')}</button>
          </div>
          <ScreenMenu s={s} cart={cart} dispatchCart={dispatchCart} openItem={id => setSub({ kind:'item', id })} openCart={() => setSub({ kind:'cart' })} mode="wizard"/>
        </div>
      );
    }
  } else if (sub?.kind === 'item') {
    body = <ScreenItem s={s} itemId={sub.id} back={() => setSub(null)} dispatchCart={dispatchCart} cart={cart} addToast={addToast}/>;
  } else if (sub?.kind === 'cart') {
    body = <ScreenCart s={s} cart={cart} dispatchCart={dispatchCart} back={() => setSub(null)} onSubmit={() => {
      const total = Object.entries(cart.items).reduce((t,[id,l])=>t+(MENU.find(m=>m.id===id)?.price||0)*l.qty,0);
      addOrder({ type:'dine', items: cart.items, total });
      dispatchCart({ type:'reset' });
      setSub(null);
      addToast(tr('Pre-order sent'));
      setTab('orders');
    }} context="dine"/>;
  } else if (tab === 'home') {
    body = <ScreenHome s={s} hasBooking={reservation.committed} openFlow={openFlow} openMenu={() => setTab('menu')} openOrders={() => setTab('orders')}/>;
  } else if (tab === 'menu') {
    body = <ScreenMenu s={s} cart={cart} dispatchCart={dispatchCart} openItem={id => setSub({ kind:'item', id })} openCart={() => setSub({ kind:'cart' })}/>;
  } else if (tab === 'orders') {
    body = <ScreenOrders s={s} history={history} hasBooking={reservation.committed} reservation={reservation} openHelp={() => setHelpOpen(true)}/>;
  } else if (tab === 'profile') {
    body = <ScreenProfile s={s}/>;
  }

  // Tabbar — hidden during wizard
  useEffect(() => {
    const tabHost = document.getElementById('tabbar');
    if (!tabHost) return;
    if (flow || sub) { tabHost.style.display = 'none'; return; }
    tabHost.style.display = 'flex';
  }, [flow, sub]);

  // Update screen label
  useEffect(() => {
    const el = document.getElementById('screen-label');
    if (!el) return;
    if (flow?.type === 'dine') el.textContent = tr('Reserve · step {n}/4', { n: flow.step });
    else if (flow?.type === 'room') el.textContent = tr('Room service · step {n}/3', { n: flow.step });
    else if (flow?.type === 'trail') el.textContent = tr('Packed lunch · step {n}/2', { n: flow.step });
    else if (flow?.type === 'menu-after-reserve') el.textContent = tr('Pre-order menu');
    else if (sub?.kind === 'item') el.textContent = tr('Item detail');
    else if (sub?.kind === 'cart') el.textContent = tr('Cart review');
    else el.textContent = tr(tab.charAt(0).toUpperCase() + tab.slice(1));
  });

  // Update tabbar in DOM
  useEffect(() => {
    const tabHost = document.getElementById('tabbar');
    if (!tabHost) return;
    if (flow || sub) return;
    tabHost.innerHTML = '';
    const tabs = [
      ['home', tr('Home'), '<svg viewBox="0 0 22 22" fill="none"><path d="M3 19V8l8-5 8 5v11" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'],
      ['menu', tr('Menu'), '<svg viewBox="0 0 22 22" fill="none"><rect x="4" y="4" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 9h8M7 12h8M7 15h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'],
      ['orders', tr('Orders'), '<svg viewBox="0 0 22 22" fill="none"><path d="M5 3h12v18l-3-2-3 2-3-2-3 2V3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'],
      ['profile', tr('Profile'), '<svg viewBox="0 0 22 22" fill="none"><circle cx="11" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M3 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" stroke-width="1.8"/></svg>'],
    ];
    tabs.forEach(([k, l, ic]) => {
      const b = document.createElement('button');
      b.className = tab === k ? 'active' : '';
      b.onclick = () => { setTab(k); setSub(null); };
      b.innerHTML = `<span class="ic">${ic}</span>${l}`;
      tabHost.appendChild(b);
    });
  });

  return (
    <>
      {body}
      {helpOpen && <HelpModal close={() => setHelpOpen(false)} save={() => addToast('Assistance request sent')}/>}
      {toast && <div className="toast" style={{ left: '50%', transform: 'translateX(-50%)' }}>{toast}</div>}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
