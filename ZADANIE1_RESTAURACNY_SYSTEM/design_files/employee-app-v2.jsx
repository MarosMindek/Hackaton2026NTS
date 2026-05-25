// employee-app-v2.jsx — top-level employee console shell
const { useState, useReducer, useEffect } = React;

// Translation shim — `window.t` is provided by i18n.js. Fallback to identity.
const tr = (s, vars) => (window.t ? window.t(s, vars) : s);

const VIEWS = [
{ k: 'floor', label: 'Live floor', section: 'Tonight', ic: '⟁', count: 'live' },
{ k: 'reservations', label: 'Reservations', section: 'Tonight', count: 'res' },
{ k: 'orders', label: 'Order queue', section: 'Tonight', count: 'ord' },
{ k: 'rooms', label: 'Room service', section: 'Tonight', count: 'roomCount' },
{ k: 'kiosk', label: 'Kiosk arrivals', section: 'Tonight', count: 'kioskCount' },
{ k: 'guests', label: 'Guest profiles', section: 'People' },
{ k: 'menu', label: 'Menu editor', section: 'Setup' },
{ k: 'reports', label: 'Reports', section: 'Insights' }];


function App() {
  const tr = window.t || ((x) => x);
  const [lang, setLangState] = useLang();
  const [view, setView] = useState('floor');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [clock, setClock] = useState('19:42');

  // Lift floor-plan tables into state so edit-mode can mutate them
  const [floorPlan, setFloorPlan] = useState(floorTables);
  const [reservations, setReservations] = useState(initialReservations);
  const [orders, setOrders] = useState(initialOrders);
  const [roomOrders, setRoomOrders] = useState(initialRoomOrders);
  const [kiosk, setKiosk] = useState(initialKiosk);
  const [menu, setMenu] = useState(menuItems);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  const actions = {
    markSeated(id) {
      setReservations((rs) => rs.map((r) => r.id === id ? { ...r, status: 'seated' } : r));
      const r = reservations.find((x) => x.id === id);
      showToast(`${r?.name} seated at ${r?.table}`);
    },
    cancelReservation(id) {
      const r = reservations.find((x) => x.id === id);
      setReservations((rs) => rs.filter((x) => x.id !== id));
      showToast(`${r?.name}'s reservation cancelled`);
    },
    sendToKitchen(r) {
      // Add a new order to the KDS queue
      if (r.preorder.length === 0) {
        showToast(`No pre-order for ${r.name}`);
        return;
      }
      const lines = r.preorder.map((p) => {
        const match = p.match(/^(.+?)(?:\s+×(\d+))?$/);
        const sub = r.allergies.length > 0 ? `no ${r.allergies[0].toLowerCase()}` : null;
        return { q: match[2] ? parseInt(match[2]) : 1, n: match[1], sub };
      });
      const newOrder = {
        id: 'o' + Date.now(),
        table: r.table, name: r.name, course: 'Starters', channel: 'in',
        lines, elapsed: 0, target: 10, status: 'fired'
      };
      setOrders((os) => [newOrder, ...os]);
      showToast(`Pre-order for ${r.name} sent to KDS`);
    },
    bumpOrder(id) {
      setOrders((os) => os.filter((o) => o.id !== id));
      showToast('Order bumped · cleared from kitchen');
    },
    holdOrder(id) {
      setOrders((os) => os.map((o) => o.id === id ? { ...o, status: 'hold' } : o));
      showToast('Order on hold');
    },
    advanceRoomOrder(id) {
      setRoomOrders((rs) => rs.flatMap((r) => {
        if (r.id !== id) return [r];
        if (r.status === 'scheduled') return [{ ...r, status: 'cooking', elapsed: 1 }];
        if (r.status === 'cooking') return [{ ...r, status: 'enroute' }];
        if (r.status === 'enroute') return [{ ...r, status: 'delivered' }];
        if (r.status === 'delivered') return []; // remove from queue
        return [r];
      }));
      const current = roomOrders.find((r) => r.id === id);
      const nextLabel = current?.status === 'scheduled' ? 'now cooking' :
      current?.status === 'cooking' ? 'en route' :
      current?.status === 'enroute' ? 'delivered' :
      'cleared';
      showToast(`Room service · ${nextLabel}`);
    },
    assignRunner(id, runnerName) {
      setRoomOrders((rs) => rs.map((r) => r.id === id ? { ...r, deliveredBy: runnerName } : r));
      showToast(`${runnerName} assigned to room ${roomOrders.find((r) => r.id === id)?.room}`);
    },
    printTicket(reservation) {
      showToast(`Printing kitchen ticket · ${reservation.name} · ${reservation.table}`);
    },
    printReceipt(reservation) {
      showToast(`Preliminary receipt printed · ${reservation.name}`);
    },
    toggleAvailable(id) {
      setMenu((ms) => ms.map((m) => m.id === id ? { ...m, available: !m.available } : m));
      const m = menu.find((x) => x.id === id);
      showToast(m.available ? `${m.name} 86'd · synced` : `${m.name} back on menu`);
    },
    moveTable(reservationId, newTable) {
      setReservations((rs) => rs.map((r) => r.id === reservationId ? { ...r, table: newTable } : r));
      showToast(`Moved to ${newTable}`);
    },
    createReservation(data) {
      const r = {
        id: 'r' + Date.now(),
        name: data.guest.name, party: data.party, time: data.time, table: data.table, area: data.area,
        flags: data.guest.allergies?.length ? ['allergy'] : [],
        allergies: data.guest.allergies || [],
        pkg: data.guest.pkg || 'External', payPer: data.guest.pkg?.includes('External') || data.guest.pkg?.includes('per item'),
        room: data.guest.room, status: 'pending', note: data.note, phone: '—', preorder: []
      };
      setReservations((rs) => [...rs, r]);
      showToast(`Reservation created · ${r.name} · ${r.table}`);
    },
    addOrderForGuest(reservation, cart) {
      const lines = Object.entries(cart).map(([id, q]) => {
        const m = menu.find((x) => x.id === id);
        const sub = reservation.allergies.length > 0 && (m?.name.toLowerCase().includes('thai') || m?.name.toLowerCase().includes('bass')) ? `${reservation.allergies[0]}-free prep` : null;
        return { q, n: m?.name, sub };
      });
      const newOrder = {
        id: 'o' + Date.now(),
        table: reservation.table, name: reservation.name, course: 'Mains', channel: 'in',
        lines, elapsed: 0, target: 12, status: 'fired'
      };
      setOrders((os) => [newOrder, ...os]);
      showToast(`Order fired for ${reservation.name}`);
    },
    quickAssign(tableId) {
      const r = {
        id: 'r' + Date.now(),
        name: 'Walk-in · ' + tableId, party: 2, time: clock, table: tableId, area: floorTables.find((t) => t.id === tableId)?.area,
        flags: ['external'], allergies: [], pkg: 'External · pay per item', payPer: true,
        room: 'Walk-in', status: 'seated', note: 'Quick assigned at front desk', phone: '—', preorder: []
      };
      setReservations((rs) => [...rs, r]);
      showToast(`Walk-in seated at ${tableId}`);
    }
  };

  const state = { reservations, orders, roomOrders, kiosk, menu, floorPlan };

  const floorActions = {
    setFloorPlan,
    updateTable(id, patch) {
      setFloorPlan((fs) => fs.map((t) => t.id === id ? { ...t, ...patch } : t));
    },
    mergeTables(idA, idB) {
      setFloorPlan((fs) => {
        const a = fs.find((t) => t.id === idA);
        const b = fs.find((t) => t.id === idB);
        if (!a || !b) return fs;
        const mergedId = a.id + '+' + b.id;
        const merged = {
          id: mergedId, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
          seats: a.seats + b.seats, area: a.area, shape: 'rect',
          mergedFrom: [a.id, b.id],
        };
        return fs.filter((t) => t.id !== idA && t.id !== idB).concat(merged);
      });
      showToast(tr('Tables merged'));
    },
    unmergeTable(id) {
      setFloorPlan((fs) => {
        const t = fs.find((x) => x.id === id);
        if (!t || !t.mergedFrom) return fs;
        const originals = t.mergedFrom.map((origId) => floorTables.find((o) => o.id === origId)).filter(Boolean);
        return fs.filter((x) => x.id !== id).concat(originals);
      });
      showToast(tr('Tables split'));
    },
    addTable(area) {
      setFloorPlan((fs) => {
        // pick a sensible default id and position for the area
        const prefix = area === 'terrace' ? 'A' : area === 'indoor' ? 'B' : area === 'private' ? 'C' : 'D';
        let n = 1;
        const taken = new Set(fs.map((t) => t.id));
        while (taken.has(`${prefix}·${10 + n}`)) n++;
        const id = `${prefix}·${10 + n}`;
        // Center of each area zone (approx from FloorPlanSvg coords)
        const zone = area === 'terrace' ? { x: 200 + ((n - 1) % 5) * 130, y: 80 } :
          area === 'indoor' ? { x: 200 + ((n - 1) % 5) * 130, y: 220 } :
          area === 'private' ? { x: 160 + ((n - 1) % 4) * 140, y: 370 } :
          { x: 680 + ((n - 1) % 2) * 80, y: 370 };
        return fs.concat([{ id, x: zone.x, y: zone.y, seats: 4, area, shape: 'round' }]);
      });
      showToast(tr('Table added'));
    },
    removeTable(id) {
      setFloorPlan((fs) => fs.filter((t) => t.id !== id));
      showToast(tr('Table removed') + ' · ' + id);
    },
  };
  Object.assign(actions, floorActions);

  const counts = {
    live: '', res: reservations.length, ord: orders.length,
    roomCount: roomOrders.length, kioskCount: kiosk.length
  };

  function renderView() {
    switch (view) {
      case 'floor':return <LiveFloorView state={state} actions={actions} openModal={setModal} />;
      case 'reservations':return <ReservationsView state={state} actions={actions} openModal={setModal} />;
      case 'orders':return <OrdersView state={state} actions={actions} />;
      case 'rooms':return <RoomServiceView state={state} actions={actions} openModal={setModal} />;
      case 'kiosk':return <KioskView state={state} />;
      case 'guests':return <GuestsView openModal={setModal} />;
      case 'menu':return <MenuView state={state} actions={actions} />;
      case 'reports':return <ReportsView state={state} />;
      default:return null;
    }
  }

  // Group nav by section
  const sections = {};
  VIEWS.forEach((v) => {
    sections[v.section] = sections[v.section] || [];
    sections[v.section].push(v);
  });

  // Translated section labels
  const sectionLabel = (en) => tr(en);

  return (
    <div className="app">
      <header className="topbar">
        <a href="index.html" className="back">{tr('← Hub')}</a>
        <div className="brand"><span className="b"></span>{tr('FPT Restaurant system')}</div>
        <span className="property">{tr('Lagoon Terrace · Resort 01')}</span>
        <div className="search">
          <span style={{ color: 'var(--ink-3)' }}>🔍</span>
          <input placeholder={tr('Search guest, table, room…')} />
          <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', padding: '2px 6px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 4 }}>⌘K</kbd>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--bg)', borderRadius: 999, border: '1px solid var(--line)' }}>
          <button onClick={() => setLangState('sk')} style={{ appearance: 'none', border: 0, cursor: 'pointer', padding: '4px 10px', borderRadius: 999, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, background: lang === 'sk' ? 'var(--ink-1)' : 'transparent', color: lang === 'sk' ? '#fff' : 'var(--ink-3)' }}>SK</button>
          <button onClick={() => setLangState('en')} style={{ appearance: 'none', border: 0, cursor: 'pointer', padding: '4px 10px', borderRadius: 999, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, background: lang === 'en' ? 'var(--ink-1)' : 'transparent', color: lang === 'en' ? '#fff' : 'var(--ink-3)' }}>EN</button>
        </div>
        <div className="clock">● {clock}</div>
        <div className="user">
          <div className="av">JM</div>
          <div className="name">{tr('Jenna · Floor manager')}</div>
        </div>
      </header>

      <nav className="side">
        {Object.entries(sections).map(([section, items]) =>
        <React.Fragment key={section}>
            <h4>{sectionLabel(section)}</h4>
            {items.map((v) =>
          <button key={v.k} className={`item ${view === v.k ? 'active' : ''}`} onClick={() => setView(v.k)}>
                <span>{tr(v.label)}</span>
                {v.count && counts[v.count] !== '' && <span className="count">{counts[v.count]}</span>}
              </button>
          )}
          </React.Fragment>
        )}
        <div className="footer">{tr('FPT Spa & Hospitality · Restaurant v2.0')}</div>
      </nav>

      <main className="main">{renderView()}</main>

      {modal?.kind === 'newReservation' && <NewReservationModal close={() => setModal(null)} prefilled={modal.guest} save={(data) => {actions.createReservation(data);setModal(null);}} />}
      {modal?.kind === 'moveTable' && <MoveTableModal close={() => setModal(null)} reservation={modal.reservation} save={(target) => {actions.moveTable(modal.reservation.id, target);setModal(null);}} />}
      {modal?.kind === 'orderForGuest' && <OrderForGuestModal close={() => setModal(null)} reservation={modal.reservation} menu={menu} save={(cart) => {actions.addOrderForGuest(modal.reservation, cart);setModal(null);}} />}
      {modal?.kind === 'quickAssign' && <QuickAssignModal close={() => setModal(null)} reservations={reservations} tables={floorTables} save={(tableId) => {actions.quickAssign(tableId);setModal(null);}} />}
      {modal?.kind === 'editReservation' && <NewReservationModal close={() => setModal(null)} prefilled={{ name: modal.reservation.name, room: modal.reservation.room, pkg: modal.reservation.pkg, allergies: modal.reservation.allergies }} save={() => setModal(null)} />}
      {modal?.kind === 'assignRunner' && <AssignRunnerModal close={() => setModal(null)} order={modal.order} save={(runner) => {actions.assignRunner(modal.order.id, runner);setModal(null);}} />}

      {toast && <div className="toast">{toast}</div>}
    </div>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);