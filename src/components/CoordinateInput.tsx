import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import {
  CoordinateMode,
  getStoredCoordinateMode,
  storeCoordinateMode,
  wgs84ToKandawala,
  resolveCoordinates,
  ResolvedCoordinates,
} from '../utils/coordinates';

interface CoordinateInputProps {
  required?: boolean;
  onChange: (resolved: ResolvedCoordinates) => void;
  className?: string;
}

export default function CoordinateInput({ required = false, onChange, className = '' }: CoordinateInputProps) {
  const [mode, setMode] = useState<CoordinateMode>(getStoredCoordinateMode());
  const [locationLoading, setLocationLoading] = useState(false);
  const [wgs84, setWgs84] = useState({ latitude: '', longitude: '' });
  const [kandawala, setKandawala] = useState({ northings: '', eastings: '' });

  const resolved = resolveCoordinates(mode, wgs84, kandawala, required);

  useEffect(() => {
    onChange(resolved);
  }, [mode, wgs84.latitude, wgs84.longitude, kandawala.northings, kandawala.eastings, required]);

  const handleModeChange = (next: CoordinateMode) => {
    setMode(next);
    storeCoordinateMode(next);
  };

  const getLocation = () => {
    setLocationLoading(true);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const grid = wgs84ToKandawala(lat, lon);

        setWgs84({
          latitude: lat.toFixed(6),
          longitude: lon.toFixed(6),
        });
        setKandawala({
          northings: grid.northings,
          eastings: grid.eastings,
        });
        setLocationLoading(false);
      },
      () => {
        alert('Could not get location. Please ensure GPS is enabled.');
        setLocationLoading(false);
      }
    );
  };

  const preview =
    resolved.latitude != null && resolved.longitude != null
      ? mode === 'wgs84'
        ? `Grid: N ${resolved.northings}, E ${resolved.eastings} (m)`
        : `WGS84: ${resolved.latitude.toFixed(5)}, ${resolved.longitude.toFixed(5)}`
      : null;

  return (
    <div className={`bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3 ${className}`}>
      <div className="flex flex-wrap justify-between items-center gap-2">
        <label className="font-semibold text-blue-800 text-sm">Location Coordinates</label>
        <button
          type="button"
          onClick={getLocation}
          className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full flex items-center gap-1 hover:bg-blue-700"
        >
          <MapPin className="w-3 h-3" />
          {locationLoading ? 'Locating...' : 'Auto-Detect GPS'}
        </button>
      </div>

      <div>
        <p className="text-xs text-gray-600 mb-2">Choose your preferred coordinate system:</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleModeChange('wgs84')}
            className={`py-2 px-3 rounded-lg text-sm font-medium border transition ${
              mode === 'wgs84'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Latitude / Longitude
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('kandawala')}
            className={`py-2 px-3 rounded-lg text-sm font-medium border transition ${
              mode === 'kandawala'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Easting / Northing (m)
          </button>
        </div>
      </div>

      {mode === 'wgs84' ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-gray-500 block mb-1">Latitude</span>
            <input
              type="number"
              step="any"
              placeholder="e.g. 7.8731"
              className="w-full font-mono text-sm bg-white p-2 rounded border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none"
              value={wgs84.latitude}
              onChange={(e) => setWgs84({ ...wgs84, latitude: e.target.value })}
            />
          </div>
          <div>
            <span className="text-xs text-gray-500 block mb-1">Longitude</span>
            <input
              type="number"
              step="any"
              placeholder="e.g. 80.7718"
              className="w-full font-mono text-sm bg-white p-2 rounded border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none"
              value={wgs84.longitude}
              onChange={(e) => setWgs84({ ...wgs84, longitude: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-gray-500 block mb-1">Northing (Y) — metres</span>
            <input
              type="number"
              step="any"
              placeholder="e.g. 200000"
              className="w-full font-mono text-sm bg-white p-2 rounded border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none"
              value={kandawala.northings}
              onChange={(e) => setKandawala({ ...kandawala, northings: e.target.value })}
            />
          </div>
          <div>
            <span className="text-xs text-gray-500 block mb-1">Easting (X) — metres</span>
            <input
              type="number"
              step="any"
              placeholder="e.g. 200000"
              className="w-full font-mono text-sm bg-white p-2 rounded border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none"
              value={kandawala.eastings}
              onChange={(e) => setKandawala({ ...kandawala, eastings: e.target.value })}
            />
          </div>
        </div>
      )}

      {preview && (
        <div className="bg-blue-100 p-2 rounded text-xs text-blue-800 font-mono">
          Converted: {preview}
        </div>
      )}

      {required && !resolved.isValid && (
        <p className="text-xs text-red-500">
          * {resolved.error || 'Coordinates are required for this submission.'}
        </p>
      )}

      {!required && !resolved.isValid && resolved.error && (
        <p className="text-xs text-red-500">{resolved.error}</p>
      )}
    </div>
  );
}
