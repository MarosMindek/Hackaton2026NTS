/* Components & helpers for KnihaPlus Bug Dashboard */

const SEV_CLASS = { Critical: "crit", High: "high", Medium: "med", Low: "low" };
const SEV_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

function sevColor(sev) {
  return {
    Critical: "var(--sev-critical)",
    High: "var(--sev-high)",
    Medium: "var(--sev-medium)",
    Low: "var(--sev-low)",
  }[sev];
}

/* Simple Python syntax highlighter — outputs JSX spans */
const PY_KEYWORDS = new Set([
  "def","return","if","elif","else","for","while","in","not","and","or",
  "import","from","as","try","except","finally","raise","with","class",
  "True","False","None","pass","break","continue","is","lambda","global","yield"
]);
const PY_BUILTINS = new Set([
  "print","len","range","str","int","float","list","dict","set","tuple",
  "isinstance","next","sorted","sum","max","min","abs","map","filter",
  "open","type","repr","hasattr","getattr","setattr","callable","enumerate"
]);

function highlightPy(src) {
  // Returns array of {t: 'text'|'com'|'str'|'kw'|'num'|'fn'|'builtin', v: string}
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    // comments
    if (c === "#") {
      let j = i;
      while (j < src.length && src[j] !== "\n") j++;
      tokens.push({ t: "com", v: src.slice(i, j) });
      i = j;
      continue;
    }
    // triple-string / string
    if (c === '"' || c === "'") {
      const q = c;
      let j = i + 1;
      const triple = src[i+1] === q && src[i+2] === q;
      if (triple) {
        j = i + 3;
        while (j < src.length - 2 && !(src[j] === q && src[j+1] === q && src[j+2] === q)) j++;
        j = Math.min(src.length, j + 3);
      } else {
        while (j < src.length && src[j] !== q && src[j] !== "\n") {
          if (src[j] === "\\") j++;
          j++;
        }
        if (j < src.length && src[j] === q) j++;
      }
      tokens.push({ t: "str", v: src.slice(i, j) });
      i = j;
      continue;
    }
    // numbers
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9_.xXa-fA-F]/.test(src[j])) j++;
      tokens.push({ t: "num", v: src.slice(i, j) });
      i = j;
      continue;
    }
    // identifiers
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      // check if followed by ( -> function name
      let k = j;
      while (k < src.length && src[k] === " ") k++;
      const isCall = src[k] === "(";
      if (PY_KEYWORDS.has(word)) tokens.push({ t: "kw", v: word });
      else if (PY_BUILTINS.has(word)) tokens.push({ t: "builtin", v: word });
      else if (isCall) tokens.push({ t: "fn", v: word });
      else tokens.push({ t: "text", v: word });
      i = j;
      continue;
    }
    // everything else
    let j = i;
    while (j < src.length && !/[A-Za-z_0-9#"'\n]/.test(src[j])) j++;
    if (j === i) j = i + 1;
    tokens.push({ t: "text", v: src.slice(i, j) });
    i = j;
  }
  return tokens;
}

function CodeBlock({ code, label, variant }) {
  const tokens = highlightPy(code);
  return (
    <div className={`codeblock ${variant || ""}`}>
      {label ? <div className="codeblock-label">{label}</div> : null}
      <pre>{tokens.map((tk, i) =>
        tk.t === "text"
          ? tk.v
          : <span key={i} className={`tok-${tk.t}`}>{tk.v}</span>
      )}</pre>
    </div>
  );
}

/* Inline code formatter — replaces `...` in description with <code> */
function FormattedText({ text }) {
  // split on `...`
  const parts = [];
  let i = 0;
  const re = /`([^`]+)`/g;
  let m;
  let last = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<code key={m.index}>{m[1]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((p, i) => typeof p === "string" ? <span key={i}>{p}</span> : p)}</>;
}

function SevBadge({ sev }) {
  return <span className={`bug-sev ${SEV_CLASS[sev]}`}>{sev}</span>;
}

function Icon({ name, size = 16 }) {
  const s = size;
  const stroke = "currentColor";
  const props = { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></>,
    bug: <><path d="M8 2l2 2M16 2l-2 2"/><rect x="6" y="6" width="12" height="14" rx="6"/><path d="M2 14h4M18 14h4M2 9l3 2M22 9l-3 2M2 19l3-2M22 19l-3-2M12 6v14"/></>,
    code: <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
    close: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    search: <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    arrow: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    chevron: <><polyline points="9 18 15 12 9 6"/></>,
    info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
  };
  return <svg {...props}>{paths[name]}</svg>;
}

Object.assign(window, { SEV_CLASS, SEV_ORDER, sevColor, CodeBlock, FormattedText, SevBadge, Icon, highlightPy });
