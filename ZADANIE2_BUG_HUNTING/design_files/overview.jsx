/* Overview / Dashboard view — FPT editorial style */

function Overview({ onOpenBug, onSwitchTab, onOpenCode }) {
  const bugs = window.BUGS;

  const totalBugs = bugs.length;
  const confirmed = bugs.filter(b => b.status === "confirmed").length;
  const falsePos = bugs.filter(b => b.status === "false-positive").length;
  const original = bugs.filter(b => b.id <= 27).length;
  const additional = bugs.filter(b => b.id > 27).length;
  const sevCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  bugs.forEach(b => sevCounts[b.severity]++);
  const critPlusHigh = sevCounts.Critical + sevCounts.High;

  const typeCounts = {};
  bugs.forEach(b => {
    typeCounts[b.type] = (typeCounts[b.type] || 0) + 1;
  });
  const types = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const maxType = Math.max(...types.map(t => t[1]));

  const fileCounts = { "app.py": 0, "models.py": 0, both: 0 };
  bugs.forEach(b => {
    if (b.file === "app.py") fileCounts["app.py"]++;
    else if (b.file === "models.py") fileCounts["models.py"]++;
    else fileCounts.both++;
  });

  const securityBugs = bugs.filter(b => b.type === "Security");

  const appPct = (fileCounts["app.py"] / totalBugs) * 100;
  const modelsPct = (fileCounts["models.py"] / totalBugs) * 100;
  const bothPct = (fileCounts.both / totalBugs) * 100;

  return (
    <div className="page">

      {/* HERO */}
      <section className="hero fade-up">
        <div className="hero-grid">
          <div className="hero-left">
            <div className="page-eyebrow" style={{ color: "#FFB070" }}>
              Bug audit · KnihaPlus v2.3.1
            </div>
            <h1>
              Audit odhalil <span className="hl">48 bugov</span> v systéme správy knižnice.
            </h1>
            <p>
              Z toho <strong style={{ color: "white" }}>19 priamo ohrozuje funkčnosť alebo bezpečnosť</strong>.
              Pôvodný počet bol podhodnotený o 77 % — 21 chýb sa našlo až pri dôkladnej druhej iterácii.
            </p>
            <div className="hero-tags">
              <span className="hero-tag crit"><span className="dot" />3 critical</span>
              <span className="hero-tag high"><span className="dot" />16 high</span>
              <span className="hero-tag tests"><span className="dot" />94 testov · 100 % overených</span>
              <span className="hero-tag audit"><span className="dot" />2 false positives</span>
            </div>
          </div>
          <div className="hero-stat">
            <div className="big">48</div>
            <div className="lbl">Total · {confirmed} potvrdených</div>
          </div>
        </div>
      </section>

      {/* KPI Row */}
      <div className="kpi-row">
        <div className="kpi fade-up" style={{ animationDelay: "60ms" }}>
          <div className="kpi-icon red">
            <Icon name="shield" size={18} />
          </div>
          <div className="kpi-label">Vysoké riziko</div>
          <div className="kpi-value">{critPlusHigh}<span className="unit">z {totalBugs}</span></div>
          <div className="kpi-foot">
            <span className="neg">39.6 %</span> Critical + High
          </div>
        </div>
        <div className="kpi fade-up" style={{ animationDelay: "120ms" }}>
          <div className="kpi-icon">
            <Icon name="bug" size={16} />
          </div>
          <div className="kpi-label">Dodatočne objavené</div>
          <div className="kpi-value">+{additional}<span className="unit">nad {original}</span></div>
          <div className="kpi-foot">
            <span className="neg">+77 %</span> nad pôvodný odhad
          </div>
        </div>
        <div className="kpi fade-up" style={{ animationDelay: "180ms" }}>
          <div className="kpi-icon green">
            <Icon name="check" size={16} />
          </div>
          <div className="kpi-label">Potvrdených testom</div>
          <div className="kpi-value">{confirmed}<span className="unit">/ {totalBugs}</span></div>
          <div className="kpi-foot">
            <span className="pos">95.8 %</span> verifikované
          </div>
        </div>
        <div className="kpi fade-up" style={{ animationDelay: "240ms" }}>
          <div className="kpi-icon blue">
            <Icon name="code" size={16} />
          </div>
          <div className="kpi-label">Testovacie pokrytie</div>
          <div className="kpi-value">94<span className="unit">testov</span></div>
          <div className="kpi-foot">
            <a onClick={onOpenCode} style={{ cursor: "pointer", color: "var(--fpt-blue)", fontWeight: 600 }}>
              test_bugs.py →
            </a>
          </div>
        </div>
      </div>

      {/* Severity + Types */}
      <div className="grid-2 fade-up" style={{ animationDelay: "300ms" }}>
        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">Rozdelenie podľa závažnosti</h3>
              <p className="card-sub">Plocha segmentu zodpovedá podielu bugov v danej kategórii</p>
            </div>
          </div>
          <div className="sev-stacked">
            <div className="seg crit" style={{ flex: sevCounts.Critical }}>
              <div className="seg-num">{sevCounts.Critical}</div>
              <div className="seg-pct">{((sevCounts.Critical/totalBugs)*100).toFixed(1)}%</div>
            </div>
            <div className="seg high" style={{ flex: sevCounts.High }}>
              <div className="seg-num">{sevCounts.High}</div>
              <div className="seg-pct">{((sevCounts.High/totalBugs)*100).toFixed(1)}%</div>
            </div>
            <div className="seg med" style={{ flex: sevCounts.Medium }}>
              <div className="seg-num">{sevCounts.Medium}</div>
              <div className="seg-pct">{((sevCounts.Medium/totalBugs)*100).toFixed(1)}%</div>
            </div>
            <div className="seg low" style={{ flex: sevCounts.Low }}>
              <div className="seg-num">{sevCounts.Low}</div>
              <div className="seg-pct">{((sevCounts.Low/totalBugs)*100).toFixed(1)}%</div>
            </div>
          </div>
          <div className="sev-legend">
            {[
              ["Critical", "crit", sevCounts.Critical],
              ["High", "high", sevCounts.High],
              ["Medium", "med", sevCounts.Medium],
              ["Low", "low", sevCounts.Low],
            ].map(([name, cls, n]) => (
              <div className="sev-legend-row" key={name}>
                <span className={`sev-dot ${cls}`} />
                <span className="sev-label">{name}</span>
                <span className="sev-num">{n}</span>
                <span className="sev-pct">{((n / totalBugs) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">Typy chýb</h3>
              <p className="card-sub">Logic + Input Validation = takmer polovica</p>
            </div>
          </div>
          <div className="type-list">
            {types.map(([name, n], i) => (
              <div className="type-row" key={name}>
                <span className="type-name">{name}</span>
                <div className="type-bar-wrap">
                  <div className="type-bar" style={{ width: `${(n / maxType) * 100}%`, animationDelay: `${i * 40}ms` }} />
                </div>
                <span className="type-count">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* File breakdown + Security */}
      <div className="grid-2 fade-up" style={{ animationDelay: "380ms" }}>
        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">Distribúcia podľa súboru</h3>
              <p className="card-sub"><code style={{ background: "var(--bg-sunken)", padding: "2px 7px", borderRadius: 4, fontSize: 12, color: "var(--fpt-orange-deep)" }}>app.py</code> obsahuje 79 % všetkých bugov</p>
            </div>
          </div>
          <div className="file-stat">
            <DonutChart
              size={160}
              data={[
                { value: fileCounts["app.py"], color: "var(--fpt-orange)" },
                { value: fileCounts["models.py"], color: "var(--fpt-blue)" },
                { value: fileCounts.both, color: "var(--fpt-green)" },
              ]}
              centerBig={fileCounts["app.py"]}
              centerSmall="v app.py"
            />
            <div className="file-legend">
              <div className="file-row">
                <span className="dot" style={{ background: "var(--fpt-orange)" }} />
                <span><code>app.py</code> výlučne</span>
                <span className="count">{fileCounts["app.py"]}<span className="pct">{appPct.toFixed(0)}%</span></span>
              </div>
              <div className="file-row">
                <span className="dot" style={{ background: "var(--fpt-blue)" }} />
                <span><code>models.py</code> výlučne</span>
                <span className="count">{fileCounts["models.py"]}<span className="pct">{modelsPct.toFixed(0)}%</span></span>
              </div>
              <div className="file-row">
                <span className="dot" style={{ background: "var(--fpt-green)" }} />
                <span>Oba súbory</span>
                <span className="count">{fileCounts.both}<span className="pct">{bothPct.toFixed(0)}%</span></span>
              </div>
            </div>
          </div>
        </div>

        <div className="sec-card">
          <div className="sec-head">
            <div className="sec-icon">
              <Icon name="shield" size={18} />
            </div>
            <div>
              <h3>Bezpečnostné zraniteľnosti</h3>
              <div className="sec-sub">{securityBugs.length} bugy · vyžadujú okamžitú pozornosť</div>
            </div>
          </div>
          <div className="sec-list">
            {securityBugs.map(b => (
              <div className="sec-item" key={b.id} onClick={() => onOpenBug(b.id)}>
                <span className="num">#{b.id}</span>
                <span className="text">{b.title.replace(/`/g, "")}</span>
                <span className={`badge ${SEV_CLASS[b.severity]}`}>{b.severity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key insights */}
      <div className="card fade-up" style={{ marginTop: 16, animationDelay: "460ms" }}>
        <div className="card-head">
          <div>
            <h3 className="card-title">Kľúčové zistenia auditu</h3>
            <p className="card-sub">Top 5 bodov, ktoré treba adresovať pred ďalším release</p>
          </div>
        </div>
        <div className="insight-list">
          <div className="insight">
            <span className="insight-num">01</span>
            <div className="insight-body">
              <strong>1 z 3 Critical bugov</strong> je bezpečnostná zraniteľnosť — heslo <code>admin123</code> v zdrojovom kóde + MD5 hash, ktorý sa dá crack-núť za sekundu cez rainbow tables.
            </div>
          </div>
          <div className="insight">
            <span className="insight-num">02</span>
            <div className="insight-body">
              <strong>Pokuta sa účtovala aj za včasné vrátenie</strong> knihy (Bug #7 — Critical) — funkcia <code>abs()</code> prekrucovala záporné dni omeškania na kladné.
            </div>
          </div>
          <div className="insight">
            <span className="insight-num">03</span>
            <div className="insight-body">
              <strong>21 bugov objavených navyše</strong> nad pôvodných 27 — pôvodný počet podhodnotil rozsah o takmer 78 %.
            </div>
          </div>
          <div className="insight">
            <span className="insight-num">04</span>
            <div className="insight-body">
              Dominantné kategórie: <code>Logic ({((typeCounts.Logic||0)/totalBugs*100).toFixed(0)}%)</code> a <code>Input Validation ({((typeCounts["Input Validation"]||0)/totalBugs*100).toFixed(0)}%)</code> — spolu pokrývajú takmer polovicu všetkých chýb.
            </div>
          </div>
          <div className="insight">
            <span className="insight-num">05</span>
            <div className="insight-body">
              <code>app.py</code> obsahuje <strong>79 % všetkých bugov</strong> — väčšinu logiky a vstupných ciest má v sebe jeden súbor, čo je signál pre refaktor.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* SVG donut chart helper */
function DonutChart({ size = 160, data, centerBig, centerSmall }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - 30) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 18;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} stroke="var(--bg-sunken)" strokeWidth={stroke} fill="none" />
        {data.map((d, i) => {
          const len = (d.value / total) * circumference;
          const dashArray = `${len} ${circumference}`;
          const dashOffset = -offset;
          offset += len;
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              stroke={d.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div className="donut-center">
        <div className="big">{centerBig}</div>
        <div className="small">{centerSmall}</div>
      </div>
    </div>
  );
}

Object.assign(window, { Overview });
