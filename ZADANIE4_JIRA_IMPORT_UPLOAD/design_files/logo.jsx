// Original FPT-style wordmark (not a recreation of any proprietary mark).
// Three squares (orange/green/blue) + "FPT Software" wordmark.
function Logo(){
  return (
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <svg width="40" height="22" viewBox="0 0 80 44" aria-hidden>
        <rect x="0"  y="2" width="22" height="22" rx="3" fill="#F37021"/>
        <rect x="26" y="2" width="22" height="22" rx="3" fill="#3FB54A"/>
        <rect x="52" y="2" width="22" height="22" rx="3" fill="#1F7AE0"/>
        <text x="0" y="40" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="13" fill="#e6edf3" letterSpacing="0.5">FPT SOFTWARE</text>
      </svg>
    </div>
  );
}
window.Logo = Logo;
