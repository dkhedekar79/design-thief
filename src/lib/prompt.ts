import type { DesignScheme, SchemeColor } from './types';

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const value = hex.replace('#', '');
  if (!/^[0-9a-f]{3,8}$/i.test(value)) return null;
  const expand = (part: string) => parseInt(part.length === 1 ? part + part : part, 16);
  if (value.length === 3 || value.length === 4) {
    return { r: expand(value[0]), g: expand(value[1]), b: expand(value[2]) };
  }
  return { r: expand(value.slice(0, 2)), g: expand(value.slice(2, 4)), b: expand(value.slice(4, 6)) };
}

/** Pick black or white text for a swatch, by WCAG relative luminance. */
export function contrastText(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#11141b';
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  return luminance > 0.42 ? '#11141b' : '#ffffff';
}

export function domainOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function paletteVariables(palette: SchemeColor[]): { name: string; value: string; comment: string }[] {
  const seen = new Set<string>();
  return palette.slice(0, 10).map((color) => {
    let name = `--color-${slug(color.role === 'Measured' ? color.name : color.role)}`;
    let index = 2;
    while (seen.has(name)) {
      name = `--color-${slug(color.role)}-${index}`;
      index += 1;
    }
    seen.add(name);
    return { name, value: color.hex, comment: color.usage };
  });
}

export function buildCssVariables(scheme: DesignScheme): string {
  const palette = paletteVariables(scheme.palette);
  const radii = scheme.radii.slice(0, 5).map((value, index) => {
    const label = index === scheme.radii.slice(0, 5).length - 1 ? 'pill' : ['sm', 'md', 'lg', 'xl'][index] ?? `r${index}`;
    return `  --radius-${label}: ${value};`;
  });
  const spacing = scheme.spacing.slice(0, 8).map((value, index) => `  --space-${index + 1}: ${value};`);
  const shadows = scheme.shadows.slice(0, 3).map((value, index) => `  --shadow-${index + 1}: ${value};`);
  const type = scheme.typeScale.slice(0, 6).map((entry) => `  --text-${slug(entry.label)}: ${entry.size};`);

  return [
    '/* Design tokens measured by Design Thief */',
    `/* Source: ${scheme.finalUrl} */`,
    ':root {',
    ...palette.map((token) => `  ${token.name}: ${token.value}; /* ${token.comment} */`),
    '',
    `  --font-display: "${scheme.fonts[0]?.family ?? 'system-ui'}", system-ui, sans-serif;`,
    `  --font-body: "${scheme.fonts[1]?.family ?? scheme.fonts[0]?.family ?? 'system-ui'}", system-ui, sans-serif;`,
    ...(scheme.fonts[2] ? [`  --font-mono: "${scheme.fonts[2].family}", ui-monospace, monospace;`] : []),
    '',
    ...type,
    '',
    ...radii,
    '',
    ...spacing,
    '',
    ...shadows,
    '}',
  ].join('\n');
}

export function buildPrompt(scheme: DesignScheme): string {
  const host = domainOf(scheme.finalUrl);
  const display = scheme.fonts.find((font) => font.role === 'Display');
  const body = scheme.fonts.find((font) => font.role === 'Body');
  const mono = scheme.fonts.find((font) => font.role === 'Mono');
  const css = buildCssVariables(scheme);

  const typeRows = scheme.typeScale
    .slice(0, 6)
    .map(
      (entry) =>
        `| ${entry.label} | ${entry.size} | ${entry.weight} | ${entry.lineHeight} | ${entry.tracking} |`,
    )
    .join('\n');

  const swatchRows = scheme.palette
    .slice(0, 8)
    .map((color) => `| \`${color.hex}\` | ${color.name} | ${color.role} — ${color.usage} |`)
    .join('\n');

  const componentLines = scheme.buttons.length
    ? scheme.buttons.map(
        (button, index) =>
          `- Button ${index + 1}: background \`${button.background}\`, colour \`${button.color}\`, radius \`${button.radius}\`, padding \`${button.padding}\`, shadow \`${button.shadow}\`.`,
      )
    : [
        `- Buttons: solid \`${scheme.brand.primary}\` fills with \`${scheme.radii[0] ?? '10px'}\` corners and white labels; hover one step darker.`,
      ];

  return `# Rebuild the visual system of ${host}

You are implementing a UI that matches the design system below. Every value was measured from the site's own stylesheets by Design Thief. Treat the tokens as hard constraints, not inspiration: use the exact hex values, type sizes, radii, spacing and shadows unless a value is marked "fallback".

## 1. Context

- Source: ${scheme.finalUrl}
- Page title: ${scheme.site.title}
- Scheme: ${scheme.site.colorScheme === 'mixed' ? 'light with dark-mode rules' : scheme.site.colorScheme}
- Mood: ${scheme.brand.mood}
- Framework seen on the page: ${scheme.site.framework ?? 'not detected'}
- Fonts: display **${display?.family ?? 'system-ui'}**, body **${body?.family ?? 'system-ui'}**${mono ? `, mono **${mono.family}**` : ''}

## 2. Design tokens

\`\`\`css
${css}
\`\`\`

## 3. Colour roles

| Hex | Name | Use |
| --- | --- | --- |
${swatchRows}

Rules:
1. Brand colour \`${scheme.brand.primary}\` is for primary actions, links and active states only — not decoration.
2. Page background is \`${scheme.brand.paper}\`, primary text is \`${scheme.brand.ink}\`. Keep body copy at or near the ink value; never pure black on pure white unless the tokens say so.
3. One accent beyond the brand colour, \`${scheme.brand.accent}\`, is enough. Do not introduce new hues.

## 4. Typography

Display family: \`${display?.family ?? 'system-ui'}\` (weights ${display?.weight ?? '600–700'}).
Body family: \`${body?.family ?? 'system-ui'}\` (weights ${body?.weight ?? '400–500'}).
${mono ? `Mono family: \`${mono.family}\` for code and token values.\n` : ''}
| Step | Size | Weight | Line height | Letter spacing |
| --- | --- | --- | --- | --- |
${typeRows}

Rules:
1. Headings use the display family and the tight letter-spacing above; never letter-space body copy.
2. Long-form body text stays between ${scheme.typeScale.find((entry) => entry.px < 20)?.size ?? '16px'} and ${scheme.typeScale.find((entry) => entry.px >= 16 && entry.px < 24)?.size ?? '18px'} with 1.5–1.65 line height.
3. Maximum two families. Skip the mono font outside code, tables of values and keyboard hints.
${display?.source === 'Google Fonts' ? `4. Load \`${display.family}\` from Google Fonts with \`display=swap\` and a system-ui fallback.` : '4. Bundle or self-host the fonts; do not substitute a different family silently.'}

## 5. Shape, depth and rhythm

- Radii in use: ${scheme.radii.map((value) => `\`${value}\``).join(', ') || '`8px`'}.
- Shadows in use: ${scheme.shadows.map((value) => `\`${value}\``).join(', ') || 'flat surfaces, hairline borders instead of shadows'}.
- Spacing steps: ${scheme.spacing.map((value) => `\`${value}\``).join(', ') || '`4px`, `8px`, `16px`, `24px`, `48px`'}.
- Breakpoints seen: ${scheme.breakpoints.map((value) => `\`${value}\``).join(', ') || '`640px`, `900px`, `1200px`'}.
${scheme.gradients.length ? `- Gradients to reuse: ${scheme.gradients.map((value) => `\`${value}\``).join(', ')}.` : '- No gradients in the source system — keep surfaces flat.'}

## 6. Components

${componentLines.join('\n')}

Build these with the tokens above:
- **Buttons** — one primary (brand fill), one secondary (paper fill, ink text, hairline border). Radius and heights follow the measured values; never mix two radii in one control.
- **Cards** — paper surface, hairline border \`${scheme.brand.ink}14\`, radius \`${scheme.radii[0] ?? '12px'}\`, padding from the spacing scale.
- **Inputs** — paper fill, 1px border, focus ring using the brand colour at 30% alpha.
- **Sections** — generous vertical padding (${scheme.spacing[scheme.spacing.length - 1] ?? '64px'} or more), max content width ~1100–1200px, single accent per section.

## 7. Working rules

1. Start by writing the tokens into one CSS variables block or Tailwind theme; reference tokens everywhere. No raw hex values in components.
2. Build mobile-first at 375px, then 768px, then 1280px. Check that headings never overflow.
3. Match the type scale exactly; if a size is missing for a case, interpolate within the measured scale instead of inventing a new step.
4. Keep the colour count low: brand, accent, ink, paper, plus neutrals. Contrast must pass WCAG AA for text.
5. Use real content, not lorem ipsum. Keep the source's tone: ${scheme.site.description ? scheme.site.description.slice(0, 220) : 'clear, plain and product-first'}.
6. Do not add gradients, glow effects, drop shadows or decorative illustrations that are not in the list above.
7. Do not copy the source site's logo, wordmark, imagery or copy. Reuse the visual system only.

## 8. Provenance

- Extracted from ${scheme.stats.stylesheets} stylesheet(s), ${Math.round(scheme.stats.cssBytes / 1024)} kB of CSS, ${scheme.stats.rules} rules, ${scheme.stats.colors} distinct colours.
- ${scheme.notes.join('\n- ')}

When you finish, list which tokens you used where, and flag any place where the measured values were insufficient.`;
}
