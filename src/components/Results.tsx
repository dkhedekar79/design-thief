import { useMemo, useState } from 'react';
import type { DesignScheme } from '../lib/types';
import { buildCssVariables, buildPrompt, contrastText, domainOf } from '../lib/prompt';
import { ArrowIcon, CopyIcon, DownloadIcon } from './Illustrations';

type View = 'board' | 'prompt' | 'tokens';

const views: { id: View; label: string }[] = [
  { id: 'board', label: 'Brand board' },
  { id: 'prompt', label: 'Claude Code prompt' },
  { id: 'tokens', label: 'Tokens' },
];

function safeValue(value: string, fallback: string): string {
  if (!value || value.length > 220) return fallback;
  if (/var\(|url\(|expression|inherit|currentcolor|transparent/i.test(value)) return fallback;
  return value;
}

export default function Results({ scheme }: { scheme: DesignScheme }) {
  const [view, setView] = useState<View>('board');
  const [copied, setCopied] = useState('');
  const prompt = useMemo(() => buildPrompt(scheme), [scheme]);
  const css = useMemo(() => buildCssVariables(scheme), [scheme]);
  const json = useMemo(() => JSON.stringify(scheme, null, 2), [scheme]);
  const host = domainOf(scheme.finalUrl);
  const displayFont = scheme.fonts.find((font) => font.role === 'Display')?.family ?? 'system-ui';
  const bodyFont = scheme.fonts.find((font) => font.role === 'Body')?.family ?? displayFont;

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access can be blocked; still confirm the action.
    }
    setCopied(key);
    window.setTimeout(() => setCopied(''), 1800);
  };

  const download = (filename: string, value: string, type: string) => {
    const blob = new Blob([value], { type });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  };

  const headerButtonStyle = (button: DesignScheme['buttons'][number] | undefined) => {
    if (!button) {
      return {
        background: scheme.brand.primary,
        color: contrastText(scheme.brand.primary),
        borderRadius: scheme.radii[0] ?? '9999px',
        boxShadow: scheme.shadows[0] ?? 'none',
      };
    }
    return {
      background: safeValue(button.background, scheme.brand.primary),
      color: safeValue(button.color, contrastText(scheme.brand.primary)),
      borderRadius: safeValue(button.radius, '9999px'),
      boxShadow: button.shadow === 'none' ? 'none' : safeValue(button.shadow, 'none'),
    };
  };

  return (
    <div className="results-card">
      <div className="results-head">
        <div className="results-source">
          <span className="results-favicon">
            {scheme.site.favicon ? (
              <img
                src={scheme.site.favicon}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <span className="results-favicon-fallback">{host.slice(0, 1).toUpperCase()}</span>
            )}
          </span>
          <div>
            <span className="results-host">{host}</span>
            <span className="results-facts">
              {scheme.stats.stylesheets} stylesheets · {scheme.stats.rules.toLocaleString()} rules ·{' '}
              {Math.max(1, Math.round(scheme.stats.cssBytes / 1024)).toLocaleString()} kB CSS
            </span>
          </div>
        </div>
        <div className="results-actions">
          <div className="tabs" role="tablist" aria-label="Extraction output">
            {views.map((entry) => (
              <button
                key={entry.id}
                role="tab"
                aria-selected={view === entry.id}
                className={`tab ${view === entry.id ? 'is-active' : ''}`}
                onClick={() => setView(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'board' && (
        <div className="board">
          <div className="board-intro">
            <div>
              <p className="eyebrow">Measured design system</p>
              <h3 className="board-title">{scheme.site.title}</h3>
              <p className="board-sub">{scheme.brand.mood}</p>
            </div>
            <div className="board-meta">
              <span className="meta-pill">{scheme.site.colorScheme} mode</span>
              {scheme.site.framework && <span className="meta-pill">{scheme.site.framework}</span>}
              <span className="meta-pill">{scheme.stats.colors} colours</span>
              <span className="meta-pill">{scheme.stats.fonts} fonts</span>
            </div>
          </div>

          <div className="brand-tiles">
            {[
              { role: 'Brand', hex: scheme.brand.primary, note: 'Primary actions' },
              { role: 'Ink', hex: scheme.brand.ink, note: 'Headings, body copy' },
              { role: 'Paper', hex: scheme.brand.paper, note: 'Page background' },
              { role: 'Accent', hex: scheme.brand.accent, note: 'Highlights, badges' },
            ].map((tile) => (
              <button
                key={tile.role}
                className="brand-tile"
                style={{ background: tile.hex, color: contrastText(tile.hex) }}
                onClick={() => copy(tile.hex, tile.role)}
                title={`Copy ${tile.hex}`}
              >
                <span className="brand-tile-role">{tile.role}</span>
                <span className="brand-tile-hex">{tile.hex}</span>
                <span className="brand-tile-note">{copied === tile.role ? 'Copied' : tile.note}</span>
              </button>
            ))}
          </div>

          <div className="board-columns">
            <section className="panel">
              <header className="panel-head">
                <h4>Typography</h4>
                <span>
                  {new Set(scheme.fonts.map((font) => font.family)).size}{' '}
                  {new Set(scheme.fonts.map((font) => font.family)).size === 1 ? 'family' : 'families'}
                </span>
              </header>
              <div className="type-specimen" style={{ fontFamily: `"${displayFont}", system-ui, sans-serif` }}>
                <span className="specimen-glyph">Aa</span>
                <div className="specimen-meta">
                  <strong>{displayFont}</strong>
                  <span>Display · {scheme.fonts[0]?.source ?? 'Stylesheet'}</span>
                  <span>Body: {bodyFont}</span>
                </div>
              </div>
              <ul className="scale-list">
                {scheme.typeScale.slice(0, 6).map((entry) => (
                  <li key={`${entry.label}-${entry.size}`}>
                    <span className="scale-label">{entry.label}</span>
                    <span className="scale-sample" style={{ fontFamily: `"${displayFont}", system-ui, sans-serif` }}>
                      Ag
                    </span>
                    <span className="scale-size">{entry.size}</span>
                    <span className="scale-weight">{entry.weight}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel">
              <header className="panel-head">
                <h4>Components</h4>
                <span>Live with extracted values</span>
              </header>
              <div className="component-demo">
                <div className="demo-row">
                  <button className="demo-button" style={headerButtonStyle(scheme.buttons[0])}>
                    Primary action <ArrowIcon size={14} />
                  </button>
                  <button className="demo-button demo-button-ghost">Secondary</button>
                </div>
                <div className="demo-input">
                  <span>you@company.com</span>
                  <span className="demo-input-ring" />
                </div>
                <div className="demo-row">
                  <span className="demo-pill" style={{ color: scheme.brand.primary, background: `${scheme.brand.primary}14` }}>
                    Badge
                  </span>
                  <span className="demo-pill demo-pill-muted">Neutral</span>
                </div>
                <div className="demo-card">
                  <strong>Card surface</strong>
                  <span>Paper, hairline border, measured radius.</span>
                </div>
              </div>
            </section>
          </div>

          <section className="panel">
            <header className="panel-head">
              <h4>Measured palette</h4>
              <span>Click a swatch to copy</span>
            </header>
            <div className="swatch-grid">
              {scheme.swatches.map((color) => (
                <button
                  key={color.hex}
                  className="swatch"
                  style={{ background: color.hex, color: contrastText(color.hex) }}
                  onClick={() => copy(color.hex, color.hex)}
                >
                  <span className="swatch-name">{color.name}</span>
                  <span className="swatch-hex">{copied === color.hex ? 'Copied' : color.hex}</span>
                  <span className="swatch-count">{color.count}×</span>
                </button>
              ))}
            </div>
          </section>

          <div className="board-columns">
            <section className="panel">
              <header className="panel-head">
                <h4>Radius &amp; depth</h4>
                <span>{scheme.radii.length} radius values</span>
              </header>
              <div className="radius-row">
                {scheme.radii.slice(0, 5).map((radius) => (
                  <div key={radius} className="radius-demo">
                    <span className="radius-shape" style={{ borderRadius: radius }} />
                    <span>{radius}</span>
                  </div>
                ))}
              </div>
              <div className="shadow-stack">
                {scheme.shadows.slice(0, 3).map((shadow) => (
                  <div key={shadow} className="shadow-demo" style={{ boxShadow: shadow }}>
                    <span>Elevation</span>
                  </div>
                ))}
                {scheme.shadows.length === 0 && <p className="panel-empty">No shadow declarations — hairline borders instead.</p>}
              </div>
            </section>

            <section className="panel">
              <header className="panel-head">
                <h4>Spacing &amp; surfaces</h4>
                <span>{scheme.spacing.length} steps</span>
              </header>
              <div className="spacing-list">
                {scheme.spacing.slice(0, 8).map((value) => (
                  <div key={value} className="spacing-row">
                    <span>{value}</span>
                    <span className="spacing-bar" style={{ width: `min(100%, ${parseFloat(value) * 2}px)` }} />
                  </div>
                ))}
              </div>
              {scheme.gradients.length > 0 && (
                <div className="gradient-strips">
                  {scheme.gradients.slice(0, 3).map((gradient) => (
                    <div key={gradient} className="gradient-strip" style={{ background: gradient }} />
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="board-foot">
            <p>
              Read from the site’s own CSS: {scheme.stats.colors} distinct colours and {scheme.stats.fonts} font
              families after de-duplication.
            </p>
            <div className="board-foot-actions">
              <button className="link-button" onClick={() => copy(css, 'css')}>
                <CopyIcon /> {copied === 'css' ? 'Copied CSS variables' : 'Copy CSS variables'}
              </button>
              <button className="link-button" onClick={() => download(`${host}-tokens.css`, css, 'text/css')}>
                <DownloadIcon /> Download tokens.css
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'prompt' && (
        <div className="prompt-view">
          <div className="prompt-bar">
            <div>
              <strong>Paste this into Claude Code</strong>
              <span>Markdown · {prompt.length.toLocaleString()} characters · exact tokens, component rules and guardrails</span>
            </div>
            <div className="prompt-actions">
              <button className="ghost-button" onClick={() => copy(prompt, 'prompt')}>
                <CopyIcon /> {copied === 'prompt' ? 'Copied' : 'Copy prompt'}
              </button>
              <button
                className="ghost-button"
                onClick={() => download(`${host}-design-prompt.md`, prompt, 'text/markdown')}
              >
                <DownloadIcon /> Download .md
              </button>
            </div>
          </div>
          <pre className="code-block prompt-block">{prompt}</pre>
        </div>
      )}

      {view === 'tokens' && (
        <div className="tokens-view">
          <div className="tokens-grid">
            <section className="panel">
              <header className="panel-head">
                <h4>CSS variables</h4>
                <button className="link-button" onClick={() => copy(css, 'css')}>
                  <CopyIcon /> {copied === 'css' ? 'Copied' : 'Copy'}
                </button>
              </header>
              <pre className="code-block">{css}</pre>
            </section>
            <section className="panel">
              <header className="panel-head">
                <h4>Raw extraction</h4>
                <button className="link-button" onClick={() => copy(json, 'json')}>
                  <CopyIcon /> {copied === 'json' ? 'Copied' : 'Copy JSON'}
                </button>
              </header>
              <pre className="code-block code-block-tall">{json}</pre>
            </section>
          </div>
          <ul className="notes-list">
            {scheme.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
