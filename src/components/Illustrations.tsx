export function SkyBackdrop() {
  return (
    <div className="sky" aria-hidden="true">
      <div className="sky-base" />
      <svg className="sky-clouds" viewBox="0 0 1440 760" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="cloudBlur" x="-40%" y="-60%" width="180%" height="220%">
            <feGaussianBlur stdDeviation="24" />
          </filter>
          <filter id="cloudBlurFine" x="-40%" y="-60%" width="180%" height="220%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="1" stopColor="#f2f9ff" stopOpacity="0.96" />
          </linearGradient>
        </defs>

        <g fill="#ffffff" filter="url(#cloudBlur)">
          <Cloud x={120} y={520} scale={1.35} opacity={0.72} />
          <Cloud x={430} y={660} scale={1.05} opacity={0.6} />
          <Cloud x={1180} y={555} scale={1.5} opacity={0.66} />
          <Cloud x={860} y={700} scale={1.2} opacity={0.5} />
          <Cloud x={-40} y={690} scale={0.9} opacity={0.5} />
          <Cloud x={1340} y={700} scale={0.95} opacity={0.45} />
        </g>

        <g fill="#ffffff" filter="url(#cloudBlurFine)">
          <Cloud x={170} y={560} scale={0.72} opacity={0.62} />
          <Cloud x={1120} y={600} scale={0.9} opacity={0.52} />
          <Cloud x={700} y={712} scale={0.6} opacity={0.4} />
        </g>

        <rect x="0" y="430" width="1440" height="330" fill="url(#haze)" />
      </svg>
      <div className="sky-fade" />
    </div>
  );
}

function Cloud({ x, y, scale, opacity }: { x: number; y: number; scale: number; opacity: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <ellipse cx="0" cy="0" rx="150" ry="52" />
      <ellipse cx="-86" cy="14" rx="86" ry="36" />
      <ellipse cx="92" cy="16" rx="98" ry="38" />
      <ellipse cx="4" cy="-34" rx="76" ry="48" />
      <ellipse cx="-46" cy="-14" rx="58" ry="36" />
      <ellipse cx="62" cy="-10" rx="62" ry="38" />
    </g>
  );
}

export function ArrowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h11M10.5 4.5 16 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m4 10.5 4 4 8-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GlobeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.9 10h14.2M10 2.8c2 2 2.9 4.4 2.9 7.2S12 15.2 10 17.2C8 15.2 7.1 12.8 7.1 10S8 4.8 10 2.8Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function CopyIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="7" y="7" width="9" height="9" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13 4.6A2.6 2.6 0 0 0 10.4 2H6.2A3.2 3.2 0 0 0 3 5.2v4.2A2.6 2.6 0 0 0 5.6 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function DownloadIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 3v9m0 0 3.4-3.4M10 12 6.6 8.6M4 15.5h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SparkIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2.5l1.7 4.6 4.8 1.7-4.8 1.7L10 15.1 8.3 10.5 3.5 8.8l4.8-1.7L10 2.5Z" fill="currentColor" />
      <path d="M15.6 13.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" fill="currentColor" opacity=".55" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 6h13M3.5 10h13M3.5 14h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function StepArt({ step }: { step: 1 | 2 | 3 }) {
  if (step === 1) {
    return (
      <div className="art art-url" aria-hidden="true">
        <div className="art-browser">
          <span className="art-dot" />
          <span className="art-dot" />
          <span className="art-dot" />
          <div className="art-address">
            <GlobeIcon size={13} />
            <span>yournextidea.com</span>
          </div>
        </div>
        <div className="art-url-row">
          <span className="art-cursor">|</span>
          <span className="art-url-text">https://stripe.com</span>
          <span className="art-url-go">Extract</span>
        </div>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="art art-tokens" aria-hidden="true">
        <div className="art-swatches">
          <span style={{ background: '#2a54ef' }} />
          <span style={{ background: '#8b5cf6' }} />
          <span style={{ background: '#0f172a' }} />
          <span style={{ background: '#eef2ff' }} />
          <span style={{ background: '#f59e0b' }} />
        </div>
        <div className="art-token-type">
          <span className="art-aa">Aa</span>
          <span className="art-token-meta">
            <b>Display / 64</b>
            <i>−0.04em · 600</i>
          </span>
        </div>
        <div className="art-bars">
          <span style={{ width: '86%' }} />
          <span style={{ width: '64%' }} />
          <span style={{ width: '42%' }} />
        </div>
      </div>
    );
  }
  return (
    <div className="art art-prompt" aria-hidden="true">
      <div className="art-prompt-head">
        <span>claude-code-prompt.md</span>
        <span className="art-prompt-copy">Copy</span>
      </div>
      <div className="art-prompt-body">
        <span className="art-line"><b>#</b> Rebuild the visual system</span>
        <span className="art-line"><b>--</b>color-brand: #2a54ef;</span>
        <span className="art-line"><b>--</b>font-display: Geist;</span>
        <span className="art-line art-line-dim">Use the exact tokens…</span>
        <span className="art-line art-line-dim">No raw hex in components…</span>
      </div>
    </div>
  );
}
