import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { DesignScheme, ExtractStatus } from './lib/types';
import Results from './components/Results';
import Faq from './components/Faq';
import { ArrowIcon, CheckIcon, GlobeIcon, MenuIcon, SkyBackdrop, SparkIcon, StepArt } from './components/Illustrations';

const examples = ['stripe.com', 'linear.app', 'vercel.com', 'notion.so'];
const repoUrl = 'https://github.com/dkhedekar79/design-thief';

const loadingSteps = ['Fetching the page', 'Reading its stylesheets', 'Measuring tokens', 'Writing the board'];

function Logo() {
  return (
    <a className="brand" href="#top" aria-label="Design Thief home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="21" height="21" fill="none">
          <path
            d="M4.6 9.4c1.8-1.9 4-1.9 6.4 0 2.4-1.9 4.6-1.9 6.4 0 1.5 1.5 1.2 3.3-.9 5.1-1.5 1.3-3.1 2.5-4.5 3.9h-2c-1.4-1.4-3-2.6-4.5-3.9C3.4 12.7 3.1 10.9 4.6 9.4Z"
            fill="#fff"
          />
          <circle cx="7.9" cy="12" r="1.35" fill="#2a54ef" />
          <circle cx="14.1" cy="12" r="1.35" fill="#2a54ef" />
        </svg>
      </span>
      <span className="brand-name">Design Thief</span>
      <span className="brand-tag">open source</span>
    </a>
  );
}

function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ExtractStatus>('idle');
  const [scheme, setScheme] = useState<DesignScheme | null>(null);
  const [error, setError] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [step, setStep] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (status !== 'loading') {
      setStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setStep((current) => (current + 1) % loadingSteps.length);
    }, 1600);
    return () => window.clearInterval(timer);
  }, [status]);

  const scrollToResults = () => {
    window.setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const run = async (target?: string) => {
    const value = (target ?? url).trim();
    if (!value) {
      setStatus('error');
      setError('Paste a website address first — for example stripe.com.');
      scrollToResults();
      return;
    }
    setStatus('loading');
    setError('');
    setScheme(null);
    scrollToResults();
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'That site could not be read.');
      setScheme(data as DesignScheme);
      setStatus('ready');
      scrollToResults();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That site could not be read.');
      setStatus('error');
      scrollToResults();
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run();
  };

  return (
    <div className="site" id="top">
      <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="container nav">
          <Logo />
          <nav className="nav-links" aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#tool">Brand board</a>
            <a href="#tool">Prompt</a>
            <a href="#faq">FAQ</a>
            <a href={repoUrl} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
          <div className="nav-actions">
            <a className="nav-cta" href="#extract">
              Extract a site <ArrowIcon size={15} />
            </a>
            <a className="nav-menu" href="#how" aria-label="Jump to how it works">
              <MenuIcon />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <SkyBackdrop />
          <div className="hero-inner container">
            <span className="hero-badge">
              <SparkIcon size={14} /> Open-source design extractor
            </span>
            <h1 className="hero-title">
              <span>Copy any website’s design system.</span>
              <span className="hero-title-accent">Then hand it to Claude Code.</span>
            </h1>
            <p className="hero-sub">
              Design Thief reads the stylesheets a site ships and measures its{' '}
              <strong>colours, type scale, radii, shadows and spacing</strong>. Get back a{' '}
              <strong>brand board</strong> or a <strong>paste-ready Claude Code prompt</strong>.
            </p>

            <form className="extract-form" onSubmit={submit} id="extract">
              <span className="extract-icon" aria-hidden="true">
                <GlobeIcon />
              </span>
              <label className="visually-hidden" htmlFor="site-url">
                Website address
              </label>
              <input
                id="site-url"
                name="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="stripe.com or any public URL"
                autoComplete="url"
                spellCheck={false}
                inputMode="url"
              />
              <button className="primary-cta" type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Reading…' : 'Extract design'}
                {status !== 'loading' && <ArrowIcon size={16} />}
              </button>
            </form>

            <div className="examples">
              <span>Try</span>
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="example-chip"
                  onClick={() => {
                    setUrl(example);
                    void run(example);
                  }}
                >
                  {example}
                </button>
              ))}
            </div>

            <ul className="trust-row">
              <li>
                <CheckIcon /> Open source, MIT
              </li>
              <li>
                <CheckIcon /> No account, nothing stored
              </li>
              <li>
                <CheckIcon /> Board and prompt in one go
              </li>
            </ul>
          </div>
        </section>

        <section className="editorial">
          <div className="container">
            <h2>You shouldn’t have to eyedropper every hex.</h2>
            <p className="editorial-body">
              Your idea deserves more than a screenshot and a guess. <a href="#extract">Drop in a URL</a> and Design
              Thief reads what the site actually ships: <a href="#tool">the palette</a>, the type scale,{' '}
              <a href="#tool">the radii, shadows and spacing</a>. Then it writes it up as a brand board, or as{' '}
              <a href="#tool">a prompt Claude Code can build from</a>.
            </p>
          </div>
        </section>

        <section className="how" id="how">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">How it works</p>
              <h2 className="section-title">Three steps, no browser extensions.</h2>
              <p className="section-lede">
                Nothing to install and nothing to sign. Paste a link, let the server read it, take the output.
              </p>
            </div>

            <div className="steps-grid">
              {[
                {
                  n: 1,
                  title: 'Paste a link',
                  body: 'Any public page. Design Thief fetches the HTML itself, so CORS and pop-up readers never get in the way.',
                },
                {
                  n: 2,
                  title: 'It measures the tokens',
                  body: 'Colours, type families, sizes, radii, shadows, spacing and breakpoints, ranked by how the site actually declares them.',
                },
                {
                  n: 3,
                  title: 'Take the board or the prompt',
                  body: 'Browse a brand board you can copy from, or grab a Claude Code prompt that rebuilds the look with those exact values.',
                },
              ].map((item) => (
                <article className="step-card" key={item.n}>
                  <div className="step-media">
                    <StepArt step={item.n as 1 | 2 | 3} />
                  </div>
                  <div className="step-copy">
                    <p className="step-eyebrow">
                      Step {item.n} of 3 <b>{item.title}</b>
                    </p>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="workspace" id="tool">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">The output</p>
              <h2 className="section-title">Your design system, one request later.</h2>
              <p className="section-lede">
                A board for the humans, a prompt for the agent. Both come from the same measured tokens.
              </p>
            </div>

            <div ref={resultRef} className="results-anchor">
              {status === 'ready' && scheme && <Results scheme={scheme} />}

              {status === 'loading' && (
                <div className="state-card" aria-live="polite">
                  <span className="spinner" aria-hidden="true" />
                  <h3>Reading the site</h3>
                  <p>Fetching the page, then its stylesheets. Larger sites can take a few seconds.</p>
                  <ol className="loading-steps">
                    {loadingSteps.map((label, index) => (
                      <li key={label} className={index <= step ? 'is-done' : ''}>
                        {label}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {status === 'error' && (
                <div className="state-card" aria-live="polite">
                  <span className="state-flag">Couldn’t read that site</span>
                  <h3>{error}</h3>
                  <p>Try the homepage of a site that loads without a login. Local and private addresses are blocked.</p>
                  <button className="ghost-button" type="button" onClick={() => void run(url || examples[0])}>
                    Try again
                  </button>
                </div>
              )}

              {status === 'idle' && (
                <div className="state-card state-card-idle">
                  <span className="state-flag">Waiting for a URL</span>
                  <h3>Nothing stolen yet.</h3>
                  <p>Paste a link above and the board fills in here: palette, type, components, tokens and prompt.</p>
                  <div className="empty-preview" aria-hidden="true">
                    <div className="empty-swatches">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="empty-panels">
                      <span>Colour roles</span>
                      <span>Type scale</span>
                      <span>Radii &amp; shadows</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <Faq />

        <section className="closing">
          <div className="container">
            <div className="closing-card">
              <span className="hero-badge closing-badge">
                <SparkIcon size={14} /> For designers, builders and their agents
              </span>
              <h2>Steal your next design system.</h2>
              <p>
                One page, one request, no account. Take the look you like and make it yours — with the values
                written down instead of guessed.
              </p>
              <a className="primary-cta closing-cta" href="#extract">
                Extract a design <ArrowIcon size={16} />
              </a>
              <span className="closing-note">MIT licensed · self-host it · reads public CSS only</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <Logo />
              <p>Copy the system, not the brand. Built as a one-page open-source tool.</p>
            </div>
            <div className="footer-col">
              <h4>Tool</h4>
              <a href="#extract">Extract a URL</a>
              <a href="#tool">Brand board</a>
              <a href="#tool">Claude Code prompt</a>
            </div>
            <div className="footer-col">
              <h4>Project</h4>
              <a href={repoUrl} target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a href={`${repoUrl}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
                MIT licence
              </a>
              <a href={`${repoUrl}/issues`} target="_blank" rel="noreferrer">
                Report an issue
              </a>
            </div>
            <div className="footer-col">
              <h4>Good to know</h4>
              <a href="#faq">What it reads</a>
              <a href="#faq">Fair use</a>
              <a href="#faq">Fonts &amp; licensing</a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Design Thief contributors</span>
            <span>Measured from public stylesheets. Use it for inspiration, not impersonation.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
