/* Bugs list + detail side panel */

function BugsView({ selectedId, onSelect }) {
  const bugs = window.BUGS;
  const [sevFilter, setSevFilter] = React.useState("all");
  const [fileFilter, setFileFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState("id");

  const sevCounts = { all: bugs.length, Critical: 0, High: 0, Medium: 0, Low: 0 };
  bugs.forEach(b => sevCounts[b.severity]++);

  const fileCounts = {
    all: bugs.length,
    "app.py": bugs.filter(b => b.file === "app.py").length,
    "models.py": bugs.filter(b => b.file === "models.py").length,
    both: bugs.filter(b => b.file.includes("/")).length,
  };

  const allTypes = [...new Set(bugs.map(b => b.type))];

  const filtered = bugs.filter(b => {
    if (sevFilter !== "all" && b.severity !== sevFilter) return false;
    if (fileFilter !== "all") {
      if (fileFilter === "both" && !b.file.includes("/")) return false;
      if (fileFilter !== "both" && b.file !== fileFilter) return false;
    }
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (typeFilter !== "all" && b.type !== typeFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (!b.title.toLowerCase().includes(q) &&
          !b.desc.toLowerCase().includes(q) &&
          !b.type.toLowerCase().includes(q) &&
          !String(b.id).includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "severity") return SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.id - b.id;
    return a.id - b.id;
  });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Bug tracker · {filtered.length} z {bugs.length}</div>
          <h1 className="page-title">Všetky bugy</h1>
          <p className="page-sub">Klikni na riadok pre detail s popisom, reprodukciou a navrhovanou opravou</p>
        </div>
      </div>

      <div className="bugs-layout">
        <aside className="bugs-filters">
          <div className="filter-section">
            <div className="filter-label">Vyhľadávanie</div>
            <div className="search-input-wrap">
              <span className="search-icon"><Icon name="search" size={14} /></span>
              <input
                className="search-input"
                placeholder="Hľadať bug..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-label">Závažnosť</div>
            <div className="filter-chips">
              {[
                ["all", "Všetky", null],
                ["Critical", "Critical", "crit"],
                ["High", "High", "high"],
                ["Medium", "Medium", "med"],
                ["Low", "Low", "low"],
              ].map(([key, label, dot]) => (
                <button
                  key={key}
                  className={`chip ${sevFilter === key ? "active" : ""}`}
                  onClick={() => setSevFilter(key)}
                >
                  {dot && <span className={`chip-dot sev-dot ${dot}`} style={{ background: sevColor(key) }} />}
                  {label}
                  <span className="chip-count">{sevCounts[key]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-label">Súbor</div>
            <div className="filter-chips">
              {[
                ["all", "Všetky"],
                ["app.py", "app.py"],
                ["models.py", "models.py"],
                ["both", "Oba"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`chip ${fileFilter === key ? "active" : ""}`}
                  onClick={() => setFileFilter(key)}
                >
                  {label}
                  <span className="chip-count">{fileCounts[key]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-label">Status</div>
            <div className="filter-chips">
              <button
                className={`chip ${statusFilter === "all" ? "active" : ""}`}
                onClick={() => setStatusFilter("all")}
              >Všetky</button>
              <button
                className={`chip ${statusFilter === "confirmed" ? "active" : ""}`}
                onClick={() => setStatusFilter("confirmed")}
              >
                <span className="chip-dot" style={{ background: "var(--confirmed)" }} />
                Potvrdené
                <span className="chip-count">{bugs.filter(b => b.status === "confirmed").length}</span>
              </button>
              <button
                className={`chip ${statusFilter === "false-positive" ? "active" : ""}`}
                onClick={() => setStatusFilter("false-positive")}
              >
                <span className="chip-dot" style={{ background: "var(--sev-medium)" }} />
                False+
                <span className="chip-count">{bugs.filter(b => b.status === "false-positive").length}</span>
              </button>
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-label">Typ</div>
            <div className="filter-chips">
              <button
                className={`chip ${typeFilter === "all" ? "active" : ""}`}
                onClick={() => setTypeFilter("all")}
              >Všetky</button>
              {allTypes.map(t => (
                <button
                  key={t}
                  className={`chip ${typeFilter === t ? "active" : ""}`}
                  onClick={() => setTypeFilter(t)}
                >
                  {t}
                  <span className="chip-count">{bugs.filter(b => b.type === t).length}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div>
          <div className="bugs-toolbar">
            <div className="results-count">{sorted.length} výsledkov</div>
            <div className="sort">
              <button className={sort === "id" ? "active" : ""} onClick={() => setSort("id")}>Podľa #</button>
              <button className={sort === "severity" ? "active" : ""} onClick={() => setSort("severity")}>Závažnosť</button>
            </div>
          </div>

          <div className="bugs-table">
            {sorted.length === 0 && (
              <div className="bugs-empty">Žiadne bugy neodpovedajú filtrom.</div>
            )}
            {sorted.map(bug => (
              <div
                key={bug.id}
                className={`bug-row ${selectedId === bug.id ? "selected" : ""} ${bug.status === "false-positive" ? "fp" : ""}`}
                onClick={() => onSelect(bug.id)}
              >
                <div className="bug-id">#{bug.id}</div>
                <SevBadge sev={bug.severity} />
                <div className="bug-title">
                  <span className="title-text">{bug.title.replace(/`/g, "")}</span>
                  {bug.status === "false-positive" && <span className="fp-tag">False+</span>}
                </div>
                <div className="bug-type">{bug.type}</div>
                <div className="bug-location">
                  <code>{bug.file}:{bug.line}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BugDetailPanel({ bugId, onClose }) {
  const bug = window.BUGS.find(b => b.id === bugId);
  const open = !!bug;

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      <div className={`detail-backdrop ${open ? "open" : ""}`} onClick={onClose} />
      <aside className={`detail-panel ${open ? "open" : ""}`}>
        {bug && (
          <>
            <div className="detail-head">
              <div className="detail-meta">
                <span className="detail-id">Bug #{bug.id}</span>
                <SevBadge sev={bug.severity} />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{bug.type}</span>
                {bug.status === "false-positive" && (
                  <span className="fp-tag" style={{
                    fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700,
                    background: "var(--sev-medium-bg)", color: "oklch(0.5 0.13 85)",
                    padding: "3px 7px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.04em"
                  }}>
                    False positive
                  </span>
                )}
                <button className="detail-close" onClick={onClose} aria-label="Close">
                  <Icon name="close" size={16} />
                </button>
              </div>
              <h2 className="detail-title">
                <FormattedText text={bug.title} />
              </h2>
              <div className="detail-locrow">
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="file" size={13} />
                  <code>{bug.file}</code>
                </span>
                <span className="div">·</span>
                <span>riadok <code>{bug.line}</code></span>
                <span className="div">·</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="sev-dot" style={{ background: "var(--confirmed)", width: 7, height: 7, borderRadius: "50%" }} />
                  {bug.status === "confirmed" ? "Verifikované testom" : "Nie je bug v kóde"}
                </span>
              </div>
            </div>

            <div className="detail-body">
              <div className="detail-section">
                <h4>Popis</h4>
                <p><FormattedText text={bug.desc} /></p>
              </div>

              <div className="detail-section">
                <h4>Reprodukcia</h4>
                <CodeBlock code={bug.repro} label="Python" />
              </div>

              <div className="detail-section">
                <h4>Navrhovaná oprava</h4>
                <CodeBlock code={bug.fix} label="Fix" variant="fix" />
              </div>

              <div className="detail-section">
                <h4>Súvisiace</h4>
                <RelatedBugs bug={bug} />
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function RelatedBugs({ bug }) {
  // Find bugs in same file with same type
  const related = window.BUGS.filter(b =>
    b.id !== bug.id && (b.type === bug.type || b.file === bug.file)
  ).slice(0, 4);
  if (!related.length) return <p style={{ color: "var(--text-muted)" }}>Žiadne súvisiace bugy.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {related.map(b => (
        <div key={b.id}
             style={{
               display: "flex", alignItems: "center", gap: 12,
               padding: "10px 12px", background: "var(--bg-sunken)",
               borderRadius: "var(--r-sm)", fontSize: 13
             }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>#{b.id}</span>
          <SevBadge sev={b.severity} />
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {b.title.replace(/`/g, "")}
          </span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { BugsView, BugDetailPanel });
