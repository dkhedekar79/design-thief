# Design Thief

[Live demo](https://site-1ebaf9f8ab2d4edb99442ba70908028e.freebuff.page) · [GitHub](https://github.com/dkhedekar79/design-thief) · MIT licensed

A one-page, open-source design system extractor. Give it any public URL and it reads the
site's own stylesheets, then hands back either:

- a **brand board** — colour roles, measured palette, type scale, components, radii, shadows,
  spacing and gradients, built live from the extracted tokens, and
- a **Claude Code prompt** — a paste-ready markdown brief with the exact tokens, component
  rules and guardrails an agent needs to rebuild the look.

It also exposes the raw extraction as CSS variables and JSON.

## Quick start

Requires Node 18+ (uses the built-in `fetch`).

```bash
npm install
npm run dev          # http://localhost:3000
```

Production:

```bash
npm run build
npm start            # PORT=3000 by default
```

There is no database, no account and no analytics. The only network calls are to the site
you ask it to read.

### Environment

| Variable        | Purpose                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `PORT`          | Port for the production server (default `3000`).                       |
| `ALLOWED_HOSTS` | Comma-separated extra hostnames allowed by the Vite dev server.        |

Allowing a tunnelled preview host is the only reason `ALLOWED_HOSTS` exists; leave it unset
locally.

## How it works

1. The server fetches the page (following up to five redirects, with a byte cap and timeout).
2. It collects the linked stylesheets, inline `<style>` blocks and `style` attributes.
3. It measures, from the CSS text:
   - colours, de-duplicated by RGB distance and ranked by declaration count, with a boost
     for values assigned to `--brand`, `--primary` or `--accent` variables and button fills;
   - font families (including Google Fonts links) and a heading/body split from selector names;
   - font sizes, weights, line heights and letter spacing, plus a type scale;
   - radii, shadows, gradients, spacing steps and breakpoints;
   - button backgrounds, colours, radii and shadows;
   - CSS custom properties worth keeping.
4. The browser ranks those values into roles and renders the board, the prompt and the tokens.

### What it does not do

It does not run a browser, so it cannot see values produced by JavaScript, computed layout
after media-query resolution, scroll effects or canvas artwork. Colours are ranked by how
often a site declares them, not by visual area. Sites that block server requests, hide CSS
behind a login or serve it from a protected CDN will fail — the UI says so rather than
inventing tokens.

Local and private addresses are blocked to keep the endpoint from being used as an SSRF
proxy.

## Fair use

Design Thief reads CSS that a site already serves to every visitor. Use the output as
reference: learn a visual language, or build something in the same spirit. Do not reuse
another company's logo, wordmark, photography, illustrations or copy. The generated prompt
tells the model to leave those out. Check the licence of any font before shipping it.

## Deploying

`npm run build` emits the SPA into `dist/` and bundles the extractor into
`worker-dist/worker.js`. `deploy.json` is a static-assets Worker manifest: the Worker answers
`/api/analyze` and hands everything else to `env.ASSETS`. Any static host with a serverless
function can run it the same way; the extractor itself uses only Web APIs.

On Node the server additionally resolves each hostname and refuses private addresses. The
Worker relies on the platform's network isolation for that check.

## Stack

Vite + React + TypeScript for the page, two small Node ESM modules for extraction and
serving, and a thin Worker entry for hosting. No component library, no CSS framework, no
runtime dependencies beyond React.

## Licence

MIT.
