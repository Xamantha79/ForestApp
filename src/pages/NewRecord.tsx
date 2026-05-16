import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Camera, Save, Loader2 } from 'lucide-react';
import { PROGRAM_TYPES, Program } from '../types';
import { saveOfflineProgram } from '../services/offlineStorage';
import proj4 from 'proj4';

// Define Kandawala Grid (Sri Lanka)
// Using standard definition for Kandawala / Sri Lanka Grid
proj4.defs("EPSG:5234", "+proj=tmerc +lat_0=7.00048028 +lon_0=80.77171111 +k=0.9999238418 +x_0=200000 +y_0=200000 +ellps=everest +towgs84=-97,787,86,0,0,0,0 +units=m +no_defs");

export default function NewRecord() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') as Program['program_type'] || 'school';

  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Program>>({
    program_type: initialType,
    date: new Date().toISOString().split('T')[0],
    description: '',
    participants: 0,
    location_name: '',
    district: user?.district === 'Islandwide' ? '' : user?.district, // Default to user district unless islandwide
    latitude: 0,
    longitude: 0,
    details: {}
  });

  // Kandawala Grid State
  const [kandawalaCoords, setKandawalaCoords] = useState({
    northings: '',
    eastings: ''
  });

  // Dynamic fields based on type
  const [details, setDetails] = useState<Record<string, any>>({});
  
  const districts = [
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 
    'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 
    'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 
    'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
  ];

  const getLocation = () => {
    setLocationLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          // Convert WGS84 to Kandawala
          try {
            const [easting, northing] = proj4("EPSG:4326", "EPSG:5234", [lon, lat]);
            setKandawalaCoords({
              northings: northing.toFixed(3),
              eastings: easting.toFixed(3)
            });
          } catch (err) {
            console.error("Projection error", err);
          }

          setFormData(prev => ({
            ...prev,
            latitude: lat,
            longitude: lon
          }));
          setLocationLoading(false);
        },
        (error) => {
          console.error("Error getting location", error);
          alert("Could not get location. Please ensure GPS is enabled.");
          setLocationLoading(false);
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
      setLocationLoading(false);
    }
  };

  // Handle manual Kandawala input changes
  const handleKandawalaChange = (field: 'northings' | 'eastings', value: string) => {
    // Allow numbers, dots, and commas (but strip commas for calculation)
    const newCoords = { ...kandawalaCoords, [field]: value };
    setKandawalaCoords(newCoords);

    const cleanNorthings = newCoords.northings.replace(/,/g, '');
    const cleanEastings = newCoords.eastings.replace(/,/g, '');

    if (cleanNorthings && cleanEastings) {
      const n = parseFloat(cleanNorthings);
      const e = parseFloat(cleanEastings);
      
      if (!isNaN(n) && !isNaN(e)) {
        try {
          // Convert Kandawala to WGS84
          const [lon, lat] = proj4("EPSG:5234", "EPSG:4326", [e, n]);
          
          // Check if coordinates are within Sri Lanka bounds (rough check)
          // Lat: 5.9 - 9.9, Lon: 79.5 - 82.0
          if (lat >= 5.9 && lat <= 9.9 && lon >= 79.5 && lon <= 82.0) {
             setFormData(prev => ({
              ...prev,
              latitude: lat,
              longitude: lon
            }));
          } else {
            // Coordinates out of bounds, maybe swapped?
            console.warn("Coordinates out of Sri Lanka bounds:", lat, lon);
          }
        } catch (err) {
          console.error("Projection error", err);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...formData,
      officer_id: user?.id,
      details: {
        ...details,
        kandawala_northings: kandawalaCoords.northings,
        kandawala_eastings: kandawalaCoords.eastings
      }
    };

    try {
      // Try online first
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('Record saved successfully!');
        navigate('/officer');
      } else {
        throw new Error('Server error');
      }
    } catch (err) {
      // Fallback to offline
      console.log("Saving offline due to error:", err);
      await saveOfflineProgram(payload);
      alert('Network unavailable. Record saved offline and will sync later.');
      navigate('/officer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center p-4 gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-800">New Activity Record</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6 max-w-lg mx-auto">
        
        {/* Program Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Program Type</label>
          <select 
            className="w-full p-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
            value={formData.program_type}
            onChange={(e) => setFormData({...formData, program_type: e.target.value as any})}
          >
            {Object.entries(PROGRAM_TYPES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input 
              type="date" 
              required
              className="w-full p-3 border border-gray-300 rounded-xl"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location Name / Village</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Kandy Central School"
              className="w-full p-3 border border-gray-300 rounded-xl"
              value={formData.location_name}
              onChange={(e) => setFormData({...formData, location_name: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
            <select
              required
              className="w-full p-3 border border-gray-300 rounded-xl bg-white"
              value={formData.district || ''}
              onChange={(e) => setFormData({...formData, district: e.target.value})}
            >
              <option value="" disabled>Select District</option>
              {districts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AGA Division</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Ududumbara"
              className="w-full p-3 border border-gray-300 rounded-xl"
              value={details.aga_division || ''}
              onChange={(e) => setDetails({...details, aga_division: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Range Forest Office</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Hunnasgiriya"
              className="w-full p-3 border border-gray-300 rounded-xl"
              value={details.range_forest_office || ''}
              onChange={(e) => setDetails({...details, range_forest_office: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GN Division</label>
            <input 
              type="text" 
              required
              placeholder="e.g. 123A"
              className="w-full p-3 border border-gray-300 rounded-xl"
              value={details.gn_division || ''}
              onChange={(e) => setDetails({...details, gn_division: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Participants</label>
            <input 
              type="number" 
              required
              min="0"
              className="w-full p-3 border border-gray-300 rounded-xl"
              value={formData.participants}
              onChange={(e) => setFormData({...formData, participants: parseInt(e.target.value)})}
            />
          </div>
        </div>

        {/* Dynamic Fields based on Type */}
        <div className="bg-green-50 p-4 rounded-xl border border-green-100 space-y-4">
          <h3 className="font-semibold text-green-800 text-sm uppercase tracking-wide">Specific Details</h3>
          
          {formData.program_type === 'school' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
              <input 
                type="text" 
                className="w-full p-3 bg-white border border-green-200 rounded-xl"
                onChange={(e) => setDetails({...details, school_name: e.target.value})}
              />
            </div>
          )}

          {formData.program_type === 'planting' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tree Species</label>
                <input 
                  type="text" 
                  placeholder="e.g. Teak, Mahogany"
                  className="w-full p-3 bg-white border border-green-200 rounded-xl"
                  onChange={(e) => setDetails({...details, species: e.target.value})}
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Area Size (Acres)</label>
                <input 
                  type="text" 
                  className="w-full p-3 bg-white border border-green-200 rounded-xl"
                  onChange={(e) => setDetails({...details, area: e.target.value})}
                />
              </div>
            </>
          )}

          {formData.program_type === 'home_garden' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Household Name</label>
              <input 
                type="text" 
                className="w-full p-3 bg-white border border-green-200 rounded-xl"
                onChange={(e) => setDetails({...details, household: e.target.value})}
              />
            </div>
          )}
          
          {/* Common Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description / Notes</label>
            <textarea 
              className="w-full p-3 bg-white border border-green-200 rounded-xl"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            ></textarea>
          </div>
        </div>

        {/* GPS Location (Kandawala Grid) */}
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <div className="flex justify-between items-center mb-2">
            <label className="font-semibold text-blue-800 text-sm uppercase tracking-wide">GPS Location (Kandawala Grid)</label>
            <button 
              type="button"
              onClick={getLocation}
              className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full flex items-center gap-1 hover:bg-blue-700"
            >
              <MapPin className="w-3 h-3" />
              {locationLoading ? 'Locating...' : 'Auto-Detect'}
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-gray-500 block mb-1">Northings (Y)</span>
              <input 
                type="number" 
                step="any"
                placeholder="e.g. 200000"
                className="w-full font-mono text-sm bg-white p-2 rounded border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none"
                value={kandawalaCoords.northings}
                onChange={(e) => handleKandawalaChange('northings', e.target.value)}
              />
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-1">Eastings (X)</span>
              <input 
                type="number" 
                step="any"
                placeholder="e.g. 200000"
                className="w-full font-mono text-sm bg-white p-2 rounded border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none"
                value={kandawalaCoords.eastings}
                onChange={(e) => handleKandawalaChange('eastings', e.target.value)}
              />
            </div>
          </div>
          
          {/* WGS84 Display */}
          {(formData.latitude !== 0 && formData.longitude !== 0) && (
            <div className="mt-3 bg-blue-100 p-2 rounded text-xs text-blue-800 font-mono flex justify-between items-center">
              <span>WGS 84 (Map Format):</span>
              <span className="font-bold">{formData.latitude?.toFixed(5)}, {formData.longitude?.toFixed(5)}</span>
            </div>
          )}

          {(formData.latitude === 0 || !kandawalaCoords.northings) && (
            <p className="text-xs text-red-500 mt-2">* GPS coordinates are required. Use Auto-Detect or enter manually.</p>
          )}
        </div>

        {/* Photos (Mock) */}
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition cursor-pointer">
          <Camera className="w-8 h-8 mb-2" />
          <span className="text-sm">Tap to take photos</span>
          <span className="text-xs">(Feature simulated)</span>
        </div>

        <button 
          type="submit" 
          disabled={loading || formData.latitude === 0}
          className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Submit Record
        </button>

      </form>
    </div>
  );
}
