import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, Save, Loader2 } from 'lucide-react';
import { PROGRAM_TYPES, Program } from '../types';
import { saveOfflineProgram } from '../services/offlineStorage';
import CoordinateInput from '../components/CoordinateInput';
import { coordinateDetailsFields, ResolvedCoordinates } from '../utils/coordinates';

export default function NewRecord() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') as Program['program_type'] || 'school';

  const [loading, setLoading] = useState(false);
  const [coordsResolved, setCoordsResolved] = useState<ResolvedCoordinates | null>(null);

  const [formData, setFormData] = useState<Partial<Program>>({
    program_type: initialType,
    date: new Date().toISOString().split('T')[0],
    description: '',
    participants: 0,
    cost: 0,
    location_name: '',
    district: user?.district === 'Islandwide' ? '' : user?.district,
    details: {}
  });

  const [details, setDetails] = useState<Record<string, any>>({});

  const districts = [
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha',
    'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala',
    'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa',
    'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!coordsResolved?.isValid || coordsResolved.latitude == null || coordsResolved.longitude == null) {
      alert(coordsResolved?.error || 'Please enter valid coordinates using your preferred system.');
      return;
    }

    setLoading(true);

    const coordDetails = coordinateDetailsFields(coordsResolved);
    const payload = {
      ...formData,
      officer_id: user?.id,
      latitude: coordsResolved.latitude,
      longitude: coordsResolved.longitude,
      cost: Number(formData.cost) || 0,
      aga_division: details.aga_division || null,
      gn_division: details.gn_division || null,
      details: {
        ...details,
        cost: Number(formData.cost) || 0,
        ...coordDetails,
      }
    };

    try {
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('Record saved successfully!');
        navigate('/officer');
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Server error');
      }
    } catch (err) {
      console.log('Saving offline due to error:', err);
      await saveOfflineProgram(payload);
      alert('Network unavailable. Record saved offline and will sync later.');
      navigate('/officer');
    } finally {
      setLoading(false);
    }
  };

  const coordsReady = coordsResolved?.isValid && coordsResolved.latitude != null;

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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Program Type</label>
          <select
            className="w-full p-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
            value={formData.program_type}
            onChange={(e) => setFormData({ ...formData, program_type: e.target.value as any })}
          >
            {Object.entries(PROGRAM_TYPES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              required
              className="w-full p-3 border border-gray-300 rounded-xl"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
            <select
              required
              className="w-full p-3 border border-gray-300 rounded-xl bg-white"
              value={formData.district || ''}
              onChange={(e) => setFormData({ ...formData, district: e.target.value })}
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
              onChange={(e) => setDetails({ ...details, aga_division: e.target.value })}
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
              onChange={(e) => setDetails({ ...details, range_forest_office: e.target.value })}
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
              onChange={(e) => setDetails({ ...details, gn_division: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, participants: parseInt(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program Cost (LKR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full p-3 border border-gray-300 rounded-xl"
              value={formData.cost ?? ''}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value ? parseFloat(e.target.value) : 0 })}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-xl border border-green-100 space-y-4">
          <h3 className="font-semibold text-green-800 text-sm uppercase tracking-wide">Specific Details</h3>

          {formData.program_type === 'school' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
              <input
                type="text"
                className="w-full p-3 bg-white border border-green-200 rounded-xl"
                onChange={(e) => setDetails({ ...details, school_name: e.target.value })}
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
                  onChange={(e) => setDetails({ ...details, species: e.target.value })}
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Area Size (Acres)</label>
                <input
                  type="text"
                  className="w-full p-3 bg-white border border-green-200 rounded-xl"
                  onChange={(e) => setDetails({ ...details, area: e.target.value })}
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
                onChange={(e) => setDetails({ ...details, household: e.target.value })}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description / Notes</label>
            <textarea
              className="w-full p-3 bg-white border border-green-200 rounded-xl"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            ></textarea>
          </div>
        </div>

        <CoordinateInput required onChange={setCoordsResolved} />

        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition cursor-pointer">
          <Camera className="w-8 h-8 mb-2" />
          <span className="text-sm">Tap to take photos</span>
          <span className="text-xs">(Feature simulated)</span>
        </div>

        <button
          type="submit"
          disabled={loading || !coordsReady}
          className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Submit Record
        </button>

      </form>
    </div>
  );
}
