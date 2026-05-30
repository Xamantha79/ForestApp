/** Shared program-type colors — guaranteed unique, visually distinct hex per type */
import type { CSSProperties } from 'react';
import L from 'leaflet';

/** High-contrast hues — no two adjacent entries look alike */
const DISTINCT_PALETTE = [
  '#1B5E20', // dark green — planting
  '#0D47A1', // blue — community
  '#E65100', // orange — school
  '#B71C1C', // red — home garden
  '#4A148C', // purple — ngo
  '#006064', // cyan
  '#F57F17', // amber
  '#880E4F', // magenta
  '#1A237E', // indigo
  '#33691E', // olive
  '#3E2723', // brown
  '#263238', // blue-grey
  '#AD1457', // pink
  '#827717', // lime-olive
  '#01579B', // light-blue
  '#BF360C', // deep orange
] as const;

const PREFERRED_BY_KEY: Record<string, number> = {
  planting: 0,
  tree_planting: 0,
  community: 1,
  community_program: 1,
  school: 2,
  school_awareness: 2,
  home_garden: 3,
  homegarden: 3,
  ngo: 4,
  ngo_gov_program: 4,
  ngo_gov: 4,
};

let typeColorMap: Record<string, string> = {};

function normalizeTypeKey(type: string): string {
  return type.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lig - c / 2;
  let r = 0;
  let g =  0;
  let b = 0;

  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function nextGeneratedColor(used: Set<string>, slot: number): string {
  let i = 0;
  while (i < 72) {
    const hue = Math.round((slot * 137.508 + i * 23) % 360);
    const hex = hslToHex(hue, 78, 42);
    if (!used.has(hex)) return hex;
    i++;
  }
  return hslToHex((slot * 47) % 360, 78, 42);
}

function buildColorMap(types: string[]): Record<string, string> {
  const unique = [...new Set(types.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  const map: Record<string, string> = {};
  const used = new Set<string>();

  for (const type of unique) {
    const preferred = PREFERRED_BY_KEY[normalizeTypeKey(type)];
    if (preferred === undefined) continue;
    const color = DISTINCT_PALETTE[preferred % DISTINCT_PALETTE.length];
    if (!used.has(color)) {
      map[type] = color;
      used.add(color);
    }
  }

  let paletteCursor = 0;
  for (const type of unique) {
    if (map[type]) continue;

    while (paletteCursor < DISTINCT_PALETTE.length && used.has(DISTINCT_PALETTE[paletteCursor])) {
      paletteCursor++;
    }

    if (paletteCursor < DISTINCT_PALETTE.length) {
      const color = DISTINCT_PALETTE[paletteCursor];
      map[type] = color;
      used.add(color);
      paletteCursor++;
    } else {
      const color = nextGeneratedColor(used, Object.keys(map).length);
      map[type] = color;
      used.add(color);
    }
  }

  return map;
}

/** Register all program types so each gets a unique color (call before reading colors) */
export function registerProgramTypes(types: (string | null | undefined)[]) {
  typeColorMap = buildColorMap(types.filter((t): t is string => Boolean(t)));
}

export function getProgramTypeColor(type: string | null | undefined): string {
  if (!type) return DISTINCT_PALETTE[11];
  if (typeColorMap[type]) return typeColorMap[type];

  const normalized = normalizeTypeKey(type);
  for (const [key, color] of Object.entries(typeColorMap)) {
    if (normalizeTypeKey(key) === normalized) return color;
  }

  return nextGeneratedColor(new Set(Object.values(typeColorMap)), type.length);
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const markerIconCache: Record<string, L.DivIcon> = {};

export function getProgramTypeMarkerIcon(type: string | null | undefined): L.DivIcon {
  const cacheKey = type || '__unknown__';
  if (markerIconCache[cacheKey]) return markerIconCache[cacheKey];

  const hex = getProgramTypeColor(type);
  markerIconCache[cacheKey] = L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40" aria-hidden="true">
      <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="${hex}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="5" fill="rgba(255,255,255,0.9)"/>
    </svg>`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
  });

  return markerIconCache[cacheKey];
}

export function getProgramTypeBadgeStyle(type: string | null | undefined): CSSProperties {
  const hex = getProgramTypeColor(type);
  return {
    backgroundColor: hexWithAlpha(hex, 0.12),
    color: hex,
    borderColor: hexWithAlpha(hex, 0.35),
  };
}

export function getProgramTypeDotStyle(type: string | null | undefined): CSSProperties {
  return { backgroundColor: getProgramTypeColor(type) };
}

export function getProgramTypeIconStyle(type: string | null | undefined): CSSProperties {
  const hex = getProgramTypeColor(type);
  return {
    backgroundColor: hexWithAlpha(hex, 0.15),
    color: hex,
  };
}

export function getProgramTypeCardStyle(type: string | null | undefined): CSSProperties {
  const hex = getProgramTypeColor(type);
  return {
    borderColor: hexWithAlpha(hex, 0.3),
    backgroundColor: '#fff',
  };
}

export function getProgramTypeLabelStyle(type: string | null | undefined): CSSProperties {
  return { color: getProgramTypeColor(type) };
}
