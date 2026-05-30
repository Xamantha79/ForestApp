import proj4 from 'proj4';

proj4.defs(
  'EPSG:5234',
  '+proj=tmerc +lat_0=7.00048028 +lon_0=80.77171111 +k=0.9999238418 +x_0=200000 +y_0=200000 +ellps=everest +towgs84=-97,787,86,0,0,0,0 +units=m +no_defs'
);

export type CoordinateMode = 'wgs84' | 'kandawala';

export const COORDINATE_PREFERENCE_KEY = 'forest_coord_mode';

export function getStoredCoordinateMode(): CoordinateMode {
  const stored = localStorage.getItem(COORDINATE_PREFERENCE_KEY);
  return stored === 'kandawala' ? 'kandawala' : 'wgs84';
}

export function storeCoordinateMode(mode: CoordinateMode) {
  localStorage.setItem(COORDINATE_PREFERENCE_KEY, mode);
}

export function isWithinSriLanka(lat: number, lon: number) {
  return lat >= 5.9 && lat <= 9.9 && lon >= 79.5 && lon <= 82.0;
}

export function wgs84ToKandawala(lat: number, lon: number) {
  const [easting, northing] = proj4('EPSG:4326', 'EPSG:5234', [lon, lat]);
  return {
    eastings: easting.toFixed(3),
    northings: northing.toFixed(3),
  };
}

export function kandawalaToWgs84(eastings: number, northings: number) {
  const [lon, lat] = proj4('EPSG:5234', 'EPSG:4326', [eastings, northings]);
  return { latitude: lat, longitude: lon };
}

export interface ResolvedCoordinates {
  latitude: number | null;
  longitude: number | null;
  northings: string;
  eastings: string;
  coordinateMode: CoordinateMode;
  isValid: boolean;
  error?: string;
}

export function resolveCoordinates(
  mode: CoordinateMode,
  wgs84: { latitude: string; longitude: string },
  kandawala: { northings: string; eastings: string },
  required = false
): ResolvedCoordinates {
  const emptyWgs =
    !wgs84.latitude.trim() && !wgs84.longitude.trim();
  const emptyK =
    !kandawala.northings.trim() && !kandawala.eastings.trim();

  if (!required && ((mode === 'wgs84' && emptyWgs) || (mode === 'kandawala' && emptyK))) {
    return {
      latitude: null,
      longitude: null,
      northings: '',
      eastings: '',
      coordinateMode: mode,
      isValid: true,
    };
  }

  if (mode === 'wgs84') {
    const lat = parseFloat(wgs84.latitude);
    const lon = parseFloat(wgs84.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return {
        latitude: null,
        longitude: null,
        northings: '',
        eastings: '',
        coordinateMode: mode,
        isValid: false,
        error: 'Enter valid latitude and longitude.',
      };
    }
    if (!isWithinSriLanka(lat, lon)) {
      return {
        latitude: null,
        longitude: null,
        northings: '',
        eastings: '',
        coordinateMode: mode,
        isValid: false,
        error: 'Coordinates must be within Sri Lanka.',
      };
    }
    const grid = wgs84ToKandawala(lat, lon);
    return {
      latitude: lat,
      longitude: lon,
      northings: grid.northings,
      eastings: grid.eastings,
      coordinateMode: mode,
      isValid: true,
    };
  }

  const n = parseFloat(kandawala.northings.replace(/,/g, ''));
  const e = parseFloat(kandawala.eastings.replace(/,/g, ''));
  if (!Number.isFinite(n) || !Number.isFinite(e)) {
    return {
      latitude: null,
      longitude: null,
      northings: kandawala.northings,
      eastings: kandawala.eastings,
      coordinateMode: mode,
      isValid: false,
      error: 'Enter valid northing and easting values.',
    };
  }

  try {
    const { latitude, longitude } = kandawalaToWgs84(e, n);
    if (!isWithinSriLanka(latitude, longitude)) {
      return {
        latitude: null,
        longitude: null,
        northings: kandawala.northings,
        eastings: kandawala.eastings,
        coordinateMode: mode,
        isValid: false,
        error: 'Grid coordinates must fall within Sri Lanka.',
      };
    }
    return {
      latitude,
      longitude,
      northings: kandawala.northings,
      eastings: kandawala.eastings,
      coordinateMode: mode,
      isValid: true,
    };
  } catch {
    return {
      latitude: null,
      longitude: null,
      northings: kandawala.northings,
      eastings: kandawala.eastings,
      coordinateMode: mode,
      isValid: false,
      error: 'Could not convert grid coordinates.',
    };
  }
}

export function coordinateDetailsFields(resolved: ResolvedCoordinates) {
  return {
    coordinate_mode: resolved.coordinateMode,
    kandawala_northings: resolved.northings || null,
    kandawala_eastings: resolved.eastings || null,
  };
}
