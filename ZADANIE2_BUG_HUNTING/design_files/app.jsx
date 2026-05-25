/* Root app */

function App() {
  const [tab, setTab] = React.useState("overview");
  const [selectedBugId, setSelectedBugId] = React.useState(null);
  const [codeViewOpen, setCodeViewOpen] = React.useState(false);

  const openBug = (id) => {
    setSelectedBugId(id);
    if (tab !== "bugs") setTab("bugs");
  };

  // Keyboard: cmd/ctrl+k opens code view
  React.useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCodeViewOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const bugs = window.BUGS;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">K</div>
          <div className="brand-text">
            KnihaPlus<span className="ver">v2.3.1 · bug audit</span>
          </div>
        </div>

        <nav className="nav">
          <button
            className={tab === "overview" ? "active" : ""}
            onClick={() => setTab("overview")}
          >
            <Icon name="dashboard" size={14} />
            Prehľad
          </button>
          <button
            className={tab === "bugs" ? "active" : ""}
            onClick={() => setTab("bugs")}
          >
            <Icon name="bug" size={14} />
            Bugy
            <span className="count">{bugs.length}</span>
          </button>
        </nav>

        <div className="topbar-spacer" />

        <button className="topbar-action" onClick={() => setCodeViewOpen(true)}>
          <Icon name="code" size={13} />
          Zobraziť test_bugs.py
          <span className="kbd">⌘K</span>
        </button>
      </header>

      <main>
        {tab === "overview" && (
          <Overview onOpenBug={openBug} onSwitchTab={setTab} onOpenCode={() => setCodeViewOpen(true)} />
        )}
        {tab === "bugs" && (
          <BugsView
            selectedId={selectedBugId}
            onSelect={setSelectedBugId}
          />
        )}
      </main>

      <BugDetailPanel
        bugId={selectedBugId}
        onClose={() => setSelectedBugId(null)}
      />

      <CodeViewer
        open={codeViewOpen}
        onClose={() => setCodeViewOpen(false)}
      />

      <footer className="footer">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="fpt-stripe"><span /><span /><span /></div>
          <span>KnihaPlus bug audit · {bugs.length} bugov · 94 testov · verifikované test_bugs.py</span>
        </div>
        <span>generované {new Date().toLocaleDateString("sk-SK")}</span>
      </footer>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
