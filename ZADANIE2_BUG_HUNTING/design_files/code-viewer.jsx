/* Test suite code viewer — overlay showing test_bugs.py */

function CodeViewer({ open, onClose }) {
  const [source, setSource] = React.useState(null);
  const [activeSection, setActiveSection] = React.useState(null);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (open && !source) {
      fetch("data/test_bugs.py")
        .then(r => r.text())
        .then(t => setSource(t))
        .catch(() => setSource("# Nepodarilo sa načítať test_bugs.py"));
    }
  }, [open, source]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Parse sections (Bug #N, EXTRA, EDGE, etc.) from source
  const sections = React.useMemo(() => {
    if (!source) return [];
    const lines = source.split("\n");
    const result = [];
    lines.forEach((line, idx) => {
      // Detect section dividers — markers between ════ blocks
      const sectionMatch = line.match(/^print\(f"\{BOLD\}\s+(.+?)\{RESET\}"\)$/);
      if (sectionMatch && !sectionMatch[1].startsWith("═") && !sectionMatch[1].startsWith("KnihaPlus")) {
        result.push({ kind: "header", title: sectionMatch[1].trim(), line: idx + 1 });
      }
      // Detect bug/test starts: # ── Bug #X ── or # ── EXTRA-X ── etc
      const bugMatch = line.match(/^# ──\s+(Bug #[\d/]+|EXTRA-[A-Z]|EDGE-\d|INT-\d|TYPE-\d|FINE-\d|COMBO-\d|PERF-\d|SEC-\d|SMOKE-\d+)\s+──/);
      if (bugMatch) {
        result.push({ kind: "test", title: bugMatch[1], line: idx + 1, raw: line.replace(/^# ──\s+/, "").replace(/\s+──.*$/, "") });
      }
    });
    return result;
  }, [source]);

  const lines = source ? source.split("\n") : [];
  const totalLines = lines.length;

  const scrollToLine = (n) => {
    const el = scrollRef.current?.querySelector(`[data-line="${n}"]`);
    if (el) {
      const pane = scrollRef.current;
      const top = el.offsetTop - 60;
      pane.scrollTo({ top, behavior: "smooth" });
      setActiveSection(n);
    }
  };

  // Highlight code in chunks per line for line-numbered display
  const renderedLines = React.useMemo(() => {
    if (!source) return [];
    return lines.map((line, i) => {
      const tokens = highlightPy(line);
      return { num: i + 1, tokens };
    });
  }, [source]);

  return (
    <div className={`code-view-overlay ${open ? "open" : ""}`}>
      <div className="code-view-head">
        <div className="traffic"><span /><span /><span /></div>
        <div className="file-name">
          <Icon name="code" size={14} />
          <span className="path">data /</span>
          <span>test_bugs.py</span>
        </div>
        <div className="meta">
          <span className="pill">{totalLines} riadkov</span>
          <span className="pill fpt">94 testov</span>
          <span className="pill">Python 3</span>
        </div>
        <button className="code-view-close" onClick={onClose}>
          <Icon name="close" size={13} />
          Zavrieť
          <span className="kbd">Esc</span>
        </button>
      </div>

      <div className="code-view-body">
        <div className="code-view-sidebar">
          <div className="sidebar-section-title">Testovacie sekcie</div>
          {sections.length === 0 && (
            <div style={{ padding: "12px 18px", fontSize: 12, color: "oklch(0.5 0 0)" }}>
              {source ? "Žiadne sekcie." : "Načítavam..."}
            </div>
          )}
          {sections.map((s, i) => (
            <React.Fragment key={i}>
              {s.kind === "header" ? (
                <div className="sidebar-section-title">{s.title}</div>
              ) : (
                <div
                  className={`sidebar-item ${activeSection === s.line ? "active" : ""}`}
                  onClick={() => scrollToLine(s.line)}
                >
                  <span>{s.title}</span>
                  <span className="line-num">L{s.line}</span>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="code-view-pane" ref={scrollRef}>
          {!source && (
            <div style={{ padding: 40, color: "oklch(0.6 0 0)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
              Načítavam test_bugs.py...
            </div>
          )}
          {source && (
            <div className="code-pre">
              {renderedLines.map(({ num, tokens }) => (
                <div className="code-line" data-line={num} key={num}>
                  <span className="ln">{num}</span>
                  <span className="cl">
                    {tokens.length === 0 ? " " : tokens.map((tk, i) =>
                      tk.t === "text"
                        ? <span key={i}>{tk.v}</span>
                        : <span key={i} className={`tok-${tk.t}`}>{tk.v}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CodeViewer });
