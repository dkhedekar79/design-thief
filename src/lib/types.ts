export type SchemeColor = {
  hex: string;
  rgb: string;
  name: string;
  role: string;
  count: number;
  usage: string;
};

export type DesignScheme = {
  url: string;
  finalUrl: string;
  site: {
    title: string;
    description: string;
    favicon: string | null;
    ogImage: string | null;
    themeColor: string | null;
    colorScheme: 'light' | 'dark' | 'mixed';
    framework: string | null;
  };
  brand: { primary: string; accent: string; ink: string; paper: string; mood: string };
  palette: SchemeColor[];
  swatches: SchemeColor[];
  fonts: { family: string; role: string; weight: string; source: string }[];
  typeScale: { label: string; size: string; px: number; weight: string; lineHeight: string; tracking: string }[];
  radii: string[];
  shadows: string[];
  gradients: string[];
  spacing: string[];
  breakpoints: string[];
  buttons: { background: string; color: string; radius: string; padding: string; shadow: string }[];
  variables: { name: string; value: string }[];
  stats: { stylesheets: number; cssBytes: number; rules: number; colors: number; fonts: number };
  notes: string[];
};

export type ExtractStatus = 'idle' | 'loading' | 'ready' | 'error';
