/**
 * Design Thief — extraction engine.
 *
 * Reads a public page and its stylesheets server-side (no CSSOM, so we report
 * what the stylesheet declares rather than what the browser computes) and turns
 * those declarations into a compact design scheme.
 */
import { lookup } from 'node:dns/promises';
import net from 'node:net';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 DesignThief/0.1 (+https://github.com/dkhedekar79/design-thief)';
const MAX_HTML = 1_500_000;
const MAX_CSS_EACH = 2_000_000;
const MAX_CSS_TOTAL = 6_000_000;
const MAX_STYLESHEETS = 8;
const TIMEOUT_MS = 15_000;

const GENERIC_FONTS = new Set([
  'inherit', 'initial', 'unset', 'sans-serif', 'serif', 'monospace', 'system-ui', 'ui-sans-serif',
  'ui-serif', 'ui-monospace', 'ui-rounded', '-apple-system', 'blinkmacsystemfont', 'segoe ui',
  'roboto', 'helvetica', 'helvetica neue', 'arial', 'var', 'revert',
]);

export class AnalyzeError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'AnalyzeError';
    this.status = status;
  }
}

/* ------------------------------------------------------------------ network */

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const value = ip.toLowerCase();
    if (value === '::1' || value === '::') return true;
    if (value.startsWith('fe80') || value.startsWith('fc') || value.startsWith('fd')) return true;
    if (value.startsWith('::ffff:')) return isPrivateIp(value.slice(7));
    return false;
  }
  return false;
}

async function assertPublicHost(hostname) {
  const host = hostname.toLowerCase();
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new AnalyzeError('Local and private addresses are blocked.', 403);
    return;
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new AnalyzeError('Local and private addresses are blocked.', 403);
  }
  let addresses;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new AnalyzeError(`We could not resolve ${host}. Check the address and try again.`, 422);
  }
  if (addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new AnalyzeError('Local and private addresses are blocked.', 403);
  }
}

function normalizeUrl(input) {
  let raw = String(input ?? '').trim();
  if (!raw) throw new AnalyzeError('Paste a website address first.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new AnalyzeError('That does not look like a website address.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AnalyzeError('Only http and https addresses are supported.');
  }
  return url;
}

async function fetchText(startUrl, limit, accept) {
  let current = startUrl;
  for (let hop = 0; hop < 5; hop += 1) {
    const url = new URL(current);
    await assertPublicHost(url.hostname);
    let response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': UA, accept, 'accept-language': 'en-GB,en;q=0.9' },
      });
    } catch {
      throw new AnalyzeError(`Could not reach ${url.hostname}. It may block automated requests.`, 422);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new AnalyzeError('That site redirected without a destination.', 422);
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) {
      throw new AnalyzeError(`That site answered ${response.status}. Try the homepage instead.`, 422);
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.body) return { url: current, text: '', bytes: 0, contentType };
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      bytes += value.byteLength;
      if (bytes > limit) {
        chunks.push(value.subarray(0, Math.max(0, value.byteLength - (bytes - limit))));
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    return { url: current, text: buffer.toString('utf8'), bytes: buffer.length, contentType };
  }
  throw new AnalyzeError('That site redirected too many times.', 422);
}

/* -------------------------------------------------------------------- color */

function parseColor(value) {
  const input = String(value ?? '').trim().toLowerCase();
  if (!input) return null;
  if (input.startsWith('#')) {
    const hex = input.slice(1);
    const expand = (part) => parseInt(part.length === 1 ? part + part : part, 16);
    if (hex.length === 3 || hex.length === 4) {
      return {
        r: expand(hex[0]),
        g: expand(hex[1]),
        b: expand(hex[2]),
        a: hex.length === 4 ? expand(hex[3]) / 255 : 1,
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: expand(hex.slice(0, 2)),
        g: expand(hex.slice(2, 4)),
        b: expand(hex.slice(4, 6)),
        a: hex.length === 8 ? expand(hex.slice(6, 8)) / 255 : 1,
      };
    }
    return null;
  }
  const rgb = input.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channel = (part) =>
      part.endsWith('%') ? Math.round((parseFloat(part) / 100) * 255) : Math.round(parseFloat(part));
    const rawAlpha = parts[3];
    const alpha = rawAlpha === undefined ? 1 : rawAlpha.endsWith('%') ? parseFloat(rawAlpha) / 100 : parseFloat(rawAlpha);
    return { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: Number.isFinite(alpha) ? alpha : 1 };
  }
  const hsl = input.match(/^hsla?\(([^)]+)\)$/);
  if (hsl) {
    const parts = hsl[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const h = parseFloat(parts[0].replace('deg', '')) || 0;
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    const a = parts[3] === undefined ? 1 : parseFloat(parts[3]);
    const k = (n) => (n + h / 30) % 12;
    const chroma = s * Math.min(l, 1 - l);
    const channel = (n) =>
      Math.round(255 * (l - chroma * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
    return { r: channel(0), g: channel(8), b: channel(4), a: Number.isFinite(a) ? a : 1 };
  }
  return null;
}

function toHex(color) {
  const part = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${part(color.r)}${part(color.g)}${part(color.b)}`;
}

function colorInfo(color) {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { h, s, l, luminance };
}

function hueDistance(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function colorDistance(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function colorName(color) {
  const { h, s, l } = colorInfo(color);
  if (l < 0.06) return 'Black';
  if (l > 0.97) return 'White';
  if (s < 0.08) {
    if (l < 0.25) return 'Ink';
    if (l < 0.5) return 'Slate';
    if (l < 0.72) return 'Grey';
    if (l < 0.9) return 'Mist';
    return 'Paper';
  }
  const names = [
    [15, 'Red'], [40, 'Orange'], [58, 'Amber'], [75, 'Lime'], [155, 'Green'], [190, 'Teal'],
    [215, 'Blue'], [245, 'Indigo'], [270, 'Violet'], [300, 'Magenta'], [335, 'Pink'], [360, 'Red'],
  ];
  const base = names.find(([limit]) => h <= limit)?.[1] ?? 'Blue';
  if (l < 0.28) return `Deep ${base.toLowerCase()}`;
  if (l > 0.82) return `Pale ${base.toLowerCase()}`;
  return base;
}

/* ----------------------------------------------------------------- css text */

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function normalizeSpace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function firstFamily(stack) {
  const first = stack.split(',')[0] ?? '';
  return first.replace(/["']/g, '').trim();
}

function isRealFont(family) {
  const name = String(family ?? '').toLowerCase().trim();
  if (!name || name.length > 48) return false;
  if (GENERIC_FONTS.has(name)) return false;
  if (name.startsWith('var(') || name.includes('${')) return false;
  return true;
}

function parseRules(css) {
  const rules = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(css))) {
    rules.push({ selector: normalizeSpace(match[1]).slice(0, 300), body: match[2] });
  }
  return rules;
}

function collectDeclarations(css) {
  const counts = new Map();
  const pattern = /([a-zA-Z-]+)\s*:\s*([^;{}]+)(?=;|})/g;
  let match;
  while ((match = pattern.exec(css))) {
    const value = normalizeSpace(match[2]).slice(0, 240);
    const key = `${match[1].toLowerCase()}: ${value}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function topValues(counts, property, max = 8) {
  const prefix = `${property}: `;
  const found = [];
  counts.forEach((count, key) => {
    if (key.startsWith(prefix)) found.push({ value: key.slice(prefix.length), count });
  });
  return found.sort((a, b) => b.count - a.count).slice(0, max);
}

function sanitizeWeight(value, fallback) {
  const input = String(value ?? '').trim();
  const numeric = input.match(/\b([1-9]00)\b/);
  if (numeric) return numeric[1];
  if (/bold/i.test(input)) return '700';
  if (/medium|semibold|demibold/i.test(input)) return '600';
  return fallback;
}

function toPx(value) {
  const input = String(value ?? '').trim().toLowerCase();
  const clamp = input.match(/^clamp\(([^)]+)\)$/);
  if (clamp) {
    const parts = clamp[1].split(',').map((part) => toPx(part));
    const max = parts.filter((part) => part !== null).pop();
    return max ?? null;
  }
  const match = input.match(/^(-?\d*\.?\d+)(px|rem|em)$/);
  if (!match) return null;
  const number = parseFloat(match[1]);
  if (!Number.isFinite(number)) return null;
  if (match[2] === 'rem' || match[2] === 'em') return Math.round(number * 16 * 10) / 10;
  return Math.round(number * 10) / 10;
}

/* ------------------------------------------------------------------ extract */

function pickMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${escaped}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function absolutize(href, base) {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function detectFramework(html) {
  if (/__NEXT_DATA__|\/_next\//.test(html)) return 'Next.js';
  if (/\/_nuxt\//.test(html)) return 'Nuxt';
  if (/___gatsby/.test(html)) return 'Gatsby';
  if (/astro-island|astro-/.test(html)) return 'Astro';
  if (/wp-content|wp-includes/.test(html)) return 'WordPress';
  if (/cdn\.shopify\.com/.test(html)) return 'Shopify';
  if (/data-wf-page|data-wf-site/.test(html)) return 'Webflow';
  if (/\bdata-v-[0-9a-f]{6,}/.test(html)) return 'Vue';
  if (/__remixContext/.test(html)) return 'Remix';
  if (/id=["']root["']/.test(html)) return 'React';
  return null;
}

export async function analyzeUrl(input) {
  const url = normalizeUrl(input);
  const page = await fetchText(url.toString(), MAX_HTML, 'text/html,application/xhtml+xml');
  if (page.contentType && !/html|xml/i.test(page.contentType)) {
    throw new AnalyzeError('That address did not return a web page.', 422);
  }
  const html = page.text;

  const linkPattern = /<link\b[^>]*>/gi;
  const stylesheetHrefs = [];
  let linkMatch;
  while ((linkMatch = linkPattern.exec(html))) {
    const tag = linkMatch[0];
    if (!/rel=["']?[^"'>]*stylesheet/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const absolute = absolutize(href, page.url);
    if (absolute && /^https?:/i.test(absolute)) stylesheetHrefs.push(absolute);
  }

  const inlineStyles = [];
  const stylePattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = stylePattern.exec(html))) inlineStyles.push(styleMatch[1]);

  const attributeStyles = [];
  const attributePattern = /style=["']([^"']+)["']/gi;
  let attributeMatch;
  while ((attributeMatch = attributePattern.exec(html))) attributeStyles.push(attributeMatch[1]);

  const uniqueSheets = Array.from(new Set(stylesheetHrefs)).slice(0, MAX_STYLESHEETS);
  const sheets = [];
  let cssBytes = 0;
  await Promise.all(
    uniqueSheets.map(async (href) => {
      if (cssBytes > MAX_CSS_TOTAL) return;
      try {
        const sheet = await fetchText(href, MAX_CSS_EACH, 'text/css,*/*;q=0.1');
        if (!/css|text\/plain/i.test(sheet.contentType) && !/[{]/.test(sheet.text)) return;
        cssBytes += sheet.bytes;
        sheets.push(sheet.text);
      } catch {
        // One blocked stylesheet should not fail the whole extraction.
      }
    }),
  );

  const css = stripComments([...sheets, ...inlineStyles].join('\n'));
  const inlineCss = stripComments(attributeStyles.join(';'));
  const rules = parseRules(css);
  const declarations = collectDeclarations(css);

  /* colour hints: brand variables and button fills beat raw frequency */
  const colorBoost = new Map();
  const bump = (raw, weight) => {
    const value = normalizeSpace(String(raw ?? ''));
    const triple = value.match(/^-?\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/);
    const parsed = parseColor(triple ? `hsl(${value})` : value);
    if (!parsed || parsed.a < 0.5) return;
    const hex = toHex(parsed);
    colorBoost.set(hex, (colorBoost.get(hex) ?? 0) + weight);
  };
  const brandVariable = /--[a-z0-9-]*(brand|primary|accent)[a-z0-9-]*\s*:\s*([^;}]+)/gi;
  let brandMatch;
  while ((brandMatch = brandVariable.exec(css))) bump(brandMatch[2], 45);
  const buttonishRules = rules.filter((rule) => /(^|[\s,>.])(btn|button|cta)\b/i.test(rule.selector));
  buttonishRules.forEach((rule) => {
    const pattern = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;
    let match;
    while ((match = pattern.exec(rule.body))) bump(match[0], 10);
  });

  /* colors */
  const found = new Map();
  const scan = (text, inCss) => {
    const pattern = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;
    let match;
    while ((match = pattern.exec(text))) {
      const parsed = parseColor(match[0]);
      if (!parsed) continue;
      if (parsed.a < 0.35) continue;
      const hex = toHex(parsed);
      const entry = found.get(hex) ?? { color: { ...parsed, a: 1 }, count: 0, inCss };
      entry.count += 1;
      entry.inCss = entry.inCss || inCss;
      found.set(hex, entry);
    }
  };
  scan(css, true);
  scan(inlineCss, true);
  scan(html.replace(/<style[\s\S]*?<\/style>/gi, ' '), false);

  const ranked = Array.from(found.entries())
    .map(([hex, entry]) => ({ hex, ...entry }))
    .filter((entry) => entry.count >= 2 || entry.inCss)
    .sort((a, b) => b.count - a.count);

  const distinct = [];
  for (const candidate of ranked) {
    const clash = distinct.some(
      (other) => other.hex === candidate.hex || colorDistance(other.color, candidate.color) < 16,
    );
    if (!clash) distinct.push(candidate);
    if (distinct.length >= 24) break;
  }

  const colorScore = (entry) => entry.count + (colorBoost.get(entry.hex) ?? 0);
  const chromatic = distinct
    .filter((entry) => {
      const { s, l } = colorInfo(entry.color);
      return s > 0.2 && l > 0.04 && l < 0.96;
    })
    .sort((a, b) => colorScore(b) - colorScore(a));
  const neutrals = distinct.filter((entry) => !chromatic.includes(entry));

  const primaryEntry = chromatic[0] ?? distinct.find((entry) => colorInfo(entry.color).l < 0.55) ?? ranked[0];
  const accentEntry = chromatic.find(
    (entry) => hueDistance(colorInfo(entry.color).h, colorInfo(primaryEntry.color).h) > 28,
  );
  const inkEntry =
    neutrals.filter((entry) => colorInfo(entry.color).l < 0.35).sort((a, b) => b.count - a.count)[0] ?? ranked[0];
  const paperEntry =
    neutrals.filter((entry) => colorInfo(entry.color).l > 0.92).sort((a, b) => b.count - a.count)[0] ?? ranked[0];

  const palette = [];
  const pushToken = (entry, role, usage) => {
    if (!entry) return;
    if (palette.some((token) => token.hex === entry.hex)) return;
    palette.push({
      hex: entry.hex,
      rgb: `rgb(${Math.round(entry.color.r)} ${Math.round(entry.color.g)} ${Math.round(entry.color.b)})`,
      name: colorName(entry.color),
      role,
      count: entry.count,
      usage,
    });
  };
  pushToken(primaryEntry, 'Brand', 'Primary actions, links and emphasis');
  pushToken(accentEntry, 'Accent', 'Highlights, badges and hovers');
  pushToken(inkEntry, 'Ink', 'Body copy and headings');
  pushToken(paperEntry, 'Paper', 'Page background');
  distinct
    .filter((entry) => !palette.some((token) => token.hex === entry.hex))
    .slice(0, 8)
    .forEach((entry) => {
      const { l, s } = colorInfo(entry.color);
      const role = s < 0.12 ? (l > 0.8 ? 'Surface' : 'Neutral') : 'Supporting';
      pushToken(entry, role, role === 'Surface' ? 'Cards, panels and section backgrounds' : 'Secondary accents and detail');
    });

  const swatches = distinct.slice(0, 12).map((entry) => ({
    hex: entry.hex,
    rgb: `rgb(${Math.round(entry.color.r)} ${Math.round(entry.color.g)} ${Math.round(entry.color.b)})`,
    name: colorName(entry.color),
    role: 'Measured',
    count: entry.count,
    usage: `${entry.count} declarations`,
  }));

  /* fonts */
  const fontCounts = new Map();
  const fontPattern = /font-family\s*:\s*([^;}]+)/gi;
  let fontMatch;
  while ((fontMatch = fontPattern.exec(css))) {
    const family = firstFamily(fontMatch[1]);
    if (!isRealFont(family)) continue;
    fontCounts.set(family, (fontCounts.get(family) ?? 0) + 1);
  }
  const googleFamilies = [];
  const googlePattern = /fonts\.googleapis\.com\/css2?\?([^"']+)/gi;
  let googleMatch;
  while ((googleMatch = googlePattern.exec(html))) {
    const params = new URLSearchParams(googleMatch[1].replace(/&amp;/g, '&'));
    params.getAll('family').forEach((family) => {
      const name = family.split(':')[0].replace(/\+/g, ' ').trim();
      if (name && !googleFamilies.includes(name)) googleFamilies.push(name);
    });
  }

  const rankedFonts = Array.from(fontCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([family, count]) => ({ family, count }));

  const headingFamily =
    rules
      .filter((rule) => /(^|[\s,>])(h1|h2|\.hero|\.display|\.heading|\.title)\b/i.test(rule.selector))
      .map((rule) => rule.body.match(/font-family\s*:\s*([^;}]+)/i)?.[1])
      .map((stack) => (stack ? firstFamily(stack) : ''))
      .find((family) => isRealFont(family)) ?? null;

  const bodyFamily =
    rules
      .filter((rule) => /(^|[\s,>])(body|html|:root|#root|\.page|\.app)\b/i.test(rule.selector))
      .map((rule) => rule.body.match(/font-family\s*:\s*([^;}]+)/i)?.[1])
      .map((stack) => (stack ? firstFamily(stack) : ''))
      .find((family) => isRealFont(family)) ?? null;

  const displayFamily = headingFamily ?? rankedFonts[0]?.family ?? googleFamilies[0] ?? 'System UI';
  const textFamily =
    bodyFamily ?? rankedFonts.find((entry) => entry.family !== displayFamily)?.family ?? displayFamily;

  const headingRule = rules.find(
    (rule) =>
      /(^|[\s,>])h1\b/i.test(rule.selector) &&
      /font-size/i.test(rule.body) &&
      /font-weight|line-height/i.test(rule.body),
  );

  const fonts = [
    {
      family: displayFamily,
      role: 'Display',
      weight: '600–700',
      source: googleFamilies.includes(displayFamily) ? 'Google Fonts' : 'Stylesheet',
    },
    {
      family: textFamily,
      role: 'Body',
      weight: '400–500',
      source: googleFamilies.includes(textFamily) ? 'Google Fonts' : 'Stylesheet',
    },
  ];
  const monoFamily = rankedFonts.find((entry) => /mono|code|jetbrains|fira|source code/i.test(entry.family));
  if (monoFamily && monoFamily.family !== displayFamily && monoFamily.family !== textFamily) {
    fonts.push({ family: monoFamily.family, role: 'Mono', weight: '400–500', source: 'Stylesheet' });
  }

  /* type scale */
  const sizeCounts = new Map();
  topValues(declarations, 'font-size', 80).forEach((entry) => {
    const px = toPx(entry.value);
    if (px === null || px < 9 || px > 180) return;
    sizeCounts.set(px, (sizeCounts.get(px) ?? 0) + entry.count);
  });
  const sizeVariable = /--[a-z0-9-]*(?:font-size|text-size|fs)[a-z0-9-]*\s*:\s*([^;}]+)/gi;
  let sizeVarMatch;
  while ((sizeVarMatch = sizeVariable.exec(css))) {
    const px = toPx(sizeVarMatch[1]);
    if (px === null || px < 9 || px > 180) continue;
    sizeCounts.set(px, (sizeCounts.get(px) ?? 0) + 2);
  }
  const sizes = Array.from(sizeCounts.entries())
    .sort((a, b) => b[0] - a[0])
    .slice(0, 8)
    .map(([px, count]) => ({ px, count }));

  const headingSize = headingRule?.body.match(/font-size\s*:\s*([^;}]+)/i)?.[1];
  const headingPx = headingSize ? toPx(headingSize) : null;
  const headingWeight = sanitizeWeight(headingRule?.body.match(/font-weight\s*:\s*([^;}]+)/i)?.[1], '600');
  const headingLineHeight = headingRule?.body.match(/line-height\s*:\s*([^;}]+)/i)?.[1]?.trim() ?? '1.08';
  const headingTracking = headingRule?.body.match(/letter-spacing\s*:\s*([^;}]+)/i)?.[1]?.trim() ?? '-0.03em';

  const labels = ['Display', 'Heading 1', 'Heading 2', 'Heading 3', 'Body large', 'Body', 'Small', 'Caption'];
  const typeScale = sizes.map((entry, index) => ({
    label: labels[index] ?? `Size ${index + 1}`,
    size: `${entry.px}px`,
    px: entry.px,
    weight: index <= 2 ? headingWeight : index <= 4 ? '500' : '400',
    lineHeight: index <= 2 ? headingLineHeight : '1.55',
    tracking: index <= 2 ? headingTracking : 'normal',
  }));
  if (headingPx !== null && !typeScale.some((entry) => entry.px === headingPx)) {
    typeScale.unshift({
      label: 'Display',
      size: `${headingPx}px`,
      px: headingPx,
      weight: headingWeight,
      lineHeight: headingLineHeight,
      tracking: headingTracking,
    });
  }
  typeScale.forEach((entry, index) => {
    entry.label = labels[index] ?? `Size ${index + 1}`;
  });

  /* radii, shadows, gradients, spacing */
  const radiusCounts = topValues(declarations, 'border-radius', 60);
  const radii = Array.from(
    new Set(
      radiusCounts
        .map((entry) => entry.value)
        .filter((value) => !/^(0|0px|none|inherit)$/i.test(value) && value.length < 40),
    ),
  )
    .filter((value) => !/50%|9999px/.test(value))
    .slice(0, 6);
  if (radiusCounts.some((entry) => /9999px|999px|50px/.test(entry.value))) radii.push('9999px');

  const shadows = Array.from(
    new Set(
      topValues(declarations, 'box-shadow', 40)
        .map((entry) => entry.value)
        .filter((value) => !/^none$/i.test(value) && value.includes('px')),
    ),
  )
    .sort((a, b) => a.length - b.length)
    .slice(0, 4);

  const gradientCounts = new Map();
  const gradientPattern = /(?:linear|radial|conic)-gradient\([^;{}"']{0,220}\)/gi;
  let gradientMatch;
  while ((gradientMatch = gradientPattern.exec(css))) {
    const value = normalizeSpace(gradientMatch[0]);
    if (value.length > 260) continue;
    gradientCounts.set(value, (gradientCounts.get(value) ?? 0) + 1);
  }
  const gradients = Array.from(gradientCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([value]) => value);

  const spacingCounts = new Map();
  ['padding', 'padding-top', 'padding-bottom', 'margin', 'gap', 'row-gap', 'column-gap'].forEach((property) => {
    topValues(declarations, property, 100).forEach((entry) => {
      entry.value.split(/\s+/).forEach((part) => {
        const px = toPx(part);
        if (px === null || px <= 0 || px > 160) return;
        spacingCounts.set(px, (spacingCounts.get(px) ?? 0) + entry.count);
      });
    });
  });
  const spacing = Array.from(spacingCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([px]) => `${px}px`)
    .sort((a, b) => parseFloat(a) - parseFloat(b));

  const breakpointCounts = new Map();
  const mediaPattern = /@media[^{]*?min-width\s*:\s*(\d+(?:\.\d+)?(?:px|rem|em))/gi;
  let mediaMatch;
  while ((mediaMatch = mediaPattern.exec(css))) {
    const value = mediaMatch[1];
    breakpointCounts.set(value, (breakpointCounts.get(value) ?? 0) + 1);
  }
  const breakpoints = Array.from(breakpointCounts.entries())
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .slice(0, 6)
    .map(([value]) => value);

  /* buttons */
  const buttonRules = buttonishRules.filter((rule) => /background|border-radius/.test(rule.body));
  const buttons = buttonRules
    .map((rule) => ({
      background: rule.body.match(/background(?:-color|-image)?\s*:\s*([^;}]+)/i)?.[1]?.trim() ?? 'transparent',
      color: rule.body.match(/(^|[;{\s])color\s*:\s*([^;}]+)/i)?.[2]?.trim() ?? 'inherit',
      radius: rule.body.match(/border-radius\s*:\s*([^;}]+)/i)?.[1]?.trim() ?? radii[0] ?? '8px',
      padding: rule.body.match(/padding\s*:\s*([^;}]+)/i)?.[1]?.trim() ?? '12px 20px',
      shadow: rule.body.match(/box-shadow\s*:\s*([^;}]+)/i)?.[1]?.trim() ?? 'none',
    }))
    .filter((button) => button.background !== 'transparent' && button.background.length < 200)
    .filter((button, index, list) => list.findIndex((other) => other.background === button.background) === index)
    .slice(0, 3);

  /* css variables */
  const variables = [];
  const variablePattern = /(--[a-z0-9-]+)\s*:\s*([^;}]+)/gi;
  let variableMatch;
  while ((variableMatch = variablePattern.exec(css))) {
    const name = variableMatch[1];
    const value = normalizeSpace(variableMatch[2]);
    if (value.length > 90) continue;
    if (!/^(#|rgb|hsl|var\(|\d)/i.test(value)) continue;
    if (variables.some((entry) => entry.name === name)) continue;
    variables.push({ name, value });
    if (variables.length >= 60) break;
  }
  const interestingVariable =
    /(brand|primary|accent|background|foreground|bg|fg|ink|text|muted|border|radius|font|shadow|surface|card|ring)/i;
  const chosenVariables = [
    ...variables.filter((entry) => interestingVariable.test(entry.name)),
    ...variables.filter((entry) => !interestingVariable.test(entry.name)),
  ].slice(0, 24);

  /* meta */
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? url.hostname).replace(/\s+/g, ' ').trim();
  const description = pickMeta(html, 'description') ?? pickMeta(html, 'og:description') ?? '';
  const faviconHref =
    html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1] ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*icon/i)?.[1] ??
    '/favicon.ico';
  const favicon = absolutize(faviconHref, page.url);
  const ogImage = absolutize(pickMeta(html, 'og:image') ?? '', page.url);
  const themeColor = pickMeta(html, 'theme-color');
  const themeRgb = themeColor ? parseColor(themeColor) : null;
  const paperRgb = parseColor(paperEntry?.hex ?? '#ffffff');
  const hasDarkScheme = /prefers-color-scheme\s*:\s*dark/i.test(css);
  const colorScheme = (() => {
    if (hasDarkScheme) return 'mixed';
    const base = themeRgb ?? paperRgb;
    if (!base) return 'light';
    return colorInfo(base).l < 0.4 ? 'dark' : 'light';
  })();

  const primaryInfo = colorInfo(primaryEntry?.color ?? { r: 0, g: 0, b: 0, a: 1 });
  const mood =
    primaryInfo.s > 0.55 && primaryInfo.l > 0.3
      ? 'Confident, high-saturation brand colour with generous contrast.'
      : primaryInfo.s < 0.15
        ? 'Restrained, near-monochrome palette that leans on type and spacing.'
        : 'Measured, product-first palette with one clear accent.';

  const notes = [
    'Measured from the site’s own HTML and stylesheets — computed layout values (actual rendered font sizes, scroll effects) are not read.',
    'Colours are ranked by how often the site declares them, not by visual area.',
  ];
  if (sheets.length === 0) notes.push('No external stylesheets were readable; results come from inline styles only.');
  if (colorScheme === 'mixed') notes.push('The site ships both light and dark rules; this board shows the light values.');

  return {
    url: url.toString(),
    finalUrl: page.url,
    site: {
      title,
      description,
      favicon: favicon && /^https?:/i.test(favicon) ? favicon : null,
      ogImage: ogImage && /^https?:/i.test(ogImage) ? ogImage : null,
      themeColor,
      colorScheme,
      framework: detectFramework(html),
    },
    brand: {
      primary: primaryEntry?.hex ?? '#2a54ef',
      accent: accentEntry?.hex ?? primaryEntry?.hex ?? '#8b5cf6',
      ink: inkEntry?.hex ?? '#11141b',
      paper: paperEntry?.hex ?? '#ffffff',
      mood,
    },
    palette,
    swatches,
    fonts,
    typeScale,
    radii: radii.length ? radii : ['8px', '12px', '9999px'],
    shadows,
    gradients,
    spacing,
    breakpoints,
    buttons,
    variables: chosenVariables,
    stats: {
      stylesheets: sheets.length,
      cssBytes,
      rules: rules.length,
      colors: distinct.length,
      fonts: Math.max(rankedFonts.length, fonts.length),
    },
    notes,
  };
}
