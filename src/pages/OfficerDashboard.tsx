import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin, Upload, WifiOff, CheckCircle, LogOut } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { PROGRAM_TYPES, Program } from '../types';
import { saveOfflineProgram, getOfflinePrograms, deleteOfflineProgram } from '../services/offlineStorage';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper to update map view
function MapUpdater({ programs }: { programs: Program[] }) {
  const map = useMap();
  useEffect(() => {
    if (programs.length > 0) {
      const validPoints = programs.filter(p => 
        p.latitude != null && p.longitude != null && 
        !isNaN(Number(p.latitude)) && !isNaN(Number(p.longitude))
      );
      
      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints.map(p => [p.latitude, p.longitude]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    } else {
      // Reset to default view if no programs
      map.setView([7.8731, 80.7718], 7);
    }
  }, [programs, map]);
  return null;
}

export default function OfficerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [recentPrograms, setRecentPrograms] = useState<Program[]>([]);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'all', 'month', 'year'
  const [totalPrograms, setTotalPrograms] = useState(0);
  const [statsByType, setStatsByType] = useState<{program_type: string, count: number}[]>([]);
  const [mapPrograms, setMapPrograms] = useState<Program[]>([]);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [quickEntryForm, setQuickEntryForm] = useState({
    program_type: '',
    description: '',
    location_name: '',
    latitude: '',
    longitude: '',
    plants_count: '',
    participants: '',
    aga_division: '',
    gn_division: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [programTypes, setProgramTypes] = useState<{id: number, name: string, description: string}[]>([]);

  const districts = [
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 
    'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 
    'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 
    'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
  ];

  const getColorBase = (type: string) => {
    // Generate consistent color based on type name
    const colors = ['green', 'orange', 'red', 'blue', 'purple', 'pink', 'indigo', 'teal', 'amber', 'lime'];
    const hash = type.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const getProgramTypeLabel = (type: string) => {
    const programType = programTypes.find(pt => pt.name === type);
    if (programType) {
      // Convert snake_case to Title Case for display
      return programType.name.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }
    return PROGRAM_TYPES[type as keyof typeof PROGRAM_TYPES] || type;
  };

  const getMarkerIcon = (type: string) => {
    let color = 'grey';
    switch (type) {
      case 'planting': color = 'green'; break;
      case 'school': color = 'orange'; break;
      case 'home_garden': color = 'red'; break;
      case 'community': color = 'blue'; break;
      case 'ngo': color = 'violet'; break;
      default: color = 'grey';
    }

    return new L.Icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
  };

  const [officerProfile, setOfficerProfile] = useState<{name: string, serviceNumber: string, rangeOffice: string} | null>(null);
  const [showProfileForm, setShowProfileForm] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRecentPrograms();
      checkOfflineData();
      fetchStats();
      fetchProgramTypes();
    }
  }, [viewMode, filterDistrict, filterPeriod, user]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setTotalPrograms(data.total);
        setStatsByType(data.byType);
      }
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  const fetchProgramTypes = async () => {
    try {
      const res = await fetch('/api/program-types');
      if (res.ok) {
        const data = await res.json();
        setProgramTypes(data);
      }
    } catch (err) {
      console.error("Failed to fetch program types", err);
    }
  };

  const fetchRecentPrograms = async () => {
    try {
      let query = '';
      
      // Date filtering logic
      const now = new Date();
      let startDate = '';
      let endDate = '';

      if (filterPeriod === 'month') {
        // First day of current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        // Last day of current month
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      } else if (filterPeriod === 'year') {
        // First day of current year
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        // Last day of current year
        endDate = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
      }

      if (viewMode === 'my') {
        if (!user) return;
        query = `?officer_id=${user.id}`;
      } else {
        // All Island view
        query = `?`; // Start query string
        if (filterDistrict) {
          query += `district=${filterDistrict}&`;
        }
      }

      // Append date filters if they exist
      if (startDate && endDate) {
        // Ensure query starts with ? or & correctly
        const separator = query.includes('?') ? '&' : '?';
        query += `${separator}start_date=${startDate}&end_date=${endDate}`;
      }

      const res = await fetch(`/api/programs${query}`, {
        headers: { 
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const data = await res.json();
        // If viewing all, maybe show more than 5? Let's show 20.
        setRecentPrograms(data.slice(0, 20));
        setMapPrograms(data); // Store all for map
      }
    } catch (err) {
      console.error("Failed to fetch programs", err);
    }
  };

  const handleRefresh = () => {
    fetchRecentPrograms();
    fetchStats();
  };

  const checkOfflineData = async () => {
    const offlineData = await getOfflinePrograms();
    setOfflineCount(offlineData.length);
  };

  const syncOfflineData = async () => {
    setIsSyncing(true);
    const offlineData = await getOfflinePrograms();
    
    for (const program of offlineData) {
      try {
        const res = await fetch('/api/programs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(program),
        });
        
        if (res.ok) {
          await deleteOfflineProgram(program.id);
        }
      } catch (err) {
        console.error("Sync failed for item", program.id);
      }
    }
    
    await checkOfflineData();
    await fetchRecentPrograms();
    setIsSyncing(false);
  };

  const handleQuickEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const programData = {
        program_type: quickEntryForm.program_type,
        officer_id: user?.id,
        date: new Date().toISOString().split('T')[0],
        description: quickEntryForm.description,
        location_name: quickEntryForm.location_name,
        latitude: quickEntryForm.latitude || null,
        longitude: quickEntryForm.longitude || null,
        plants_count: quickEntryForm.plants_count ? parseInt(quickEntryForm.plants_count) : 0,
        participants: quickEntryForm.participants ? parseInt(quickEntryForm.participants) : 0,
        aga_division: quickEntryForm.aga_division || null,
        gn_division: quickEntryForm.gn_division || null,
        details: {}
      };

      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(programData),
      });

      if (res.ok) {
        // Reset form
        setQuickEntryForm({
          program_type: '',
          description: '',
          location_name: '',
          latitude: '',
          longitude: '',
          plants_count: '',
          participants: '',
          aga_division: '',
          gn_division: ''
        });
        setShowQuickEntry(false);
        // Refresh data
        await fetchRecentPrograms();
        await fetchStats();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to submit program');
      }
    } catch (err) {
      console.error('Quick entry error:', err);
      alert('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickEntryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setQuickEntryForm({
      ...quickEntryForm,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-green-700 text-white p-6 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">
              Hello, {user?.name?.split(' ')[0] || 'Officer'}
            </h1>
            <p className="text-green-100 text-sm">
              {user?.range_office ? `${user.range_office} Range` : ''} 
              {user?.district ? ` • ${user.district}` : ''}
            </p>
            {user?.role === 'admin' && (
              <button 
                onClick={() => navigate('/admin')}
                className="mt-2 text-xs bg-green-800/50 hover:bg-green-800 text-green-100 px-3 py-1 rounded-full flex items-center gap-1 transition"
              >
                Go to Admin Panel →
              </button>
            )}
          </div>
          <button onClick={logout} className="p-2 bg-green-800 rounded-full hover:bg-green-600 transition">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Offline Status Card */}
        {offlineCount > 0 && (
          <div className="mt-6 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <WifiOff className="w-5 h-5 text-yellow-300" />
              <span className="text-sm font-medium">{offlineCount} records pending sync</span>
            </div>
            <button 
              onClick={syncOfflineData}
              disabled={isSyncing}
              className="px-3 py-1 bg-white text-green-700 text-xs font-bold rounded-full hover:bg-gray-100 disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        )}
      </div>

      {/* Quick Entry */}
      <div className="p-6 pt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-gray-800 font-bold">Quick Entry</h2>
          <button
            onClick={() => setShowQuickEntry(!showQuickEntry)}
            className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-md hover:shadow-lg"
          >
            {showQuickEntry ? 'Hide Form' : 'Add a Program'}
          </button>
        </div>
        
        {showQuickEntry && (
          <form onSubmit={handleQuickEntrySubmit} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Program Type</label>
              <select
                name="program_type"
                value={quickEntryForm.program_type}
                onChange={handleQuickEntryChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                required
              >
                <option value="">Select Program Type</option>
                {programTypes.map((pt) => (
                  <option key={pt.id} value={pt.name}>{getProgramTypeLabel(pt.name)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                value={quickEntryForm.description}
                onChange={handleQuickEntryChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                placeholder="Program description"
                required
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
              <input
                type="text"
                name="location_name"
                value={quickEntryForm.location_name}
                onChange={handleQuickEntryChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                placeholder="Village, school, or area name"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  value={quickEntryForm.latitude}
                  onChange={handleQuickEntryChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="7.8731"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  name="longitude"
                  value={quickEntryForm.longitude}
                  onChange={handleQuickEntryChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="80.7718"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plants Count</label>
                <input
                  type="number"
                  name="plants_count"
                  value={quickEntryForm.plants_count}
                  onChange={handleQuickEntryChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Participants</label>
                <input
                  type="number"
                  name="participants"
                  value={quickEntryForm.participants}
                  onChange={handleQuickEntryChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">AGA Division</label>
                <input
                  type="text"
                  name="aga_division"
                  value={quickEntryForm.aga_division}
                  onChange={handleQuickEntryChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GN Division</label>
                <input
                  type="text"
                  name="gn_division"
                  value={quickEntryForm.gn_division}
                  onChange={handleQuickEntryChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="Optional"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-3 rounded-lg transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Program'}
            </button>
          </form>
        )}
      </div>

      {/* View Toggle & Filters */}
      <div className="px-6 mb-4">
        <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 flex mb-4">
          <button 
            onClick={() => setViewMode('my')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${viewMode === 'my' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            My Programs
          </button>
          <button 
            onClick={() => setViewMode('all')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${viewMode === 'all' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            All Island
          </button>
        </div>

        {/* Period Filter */}
        <div className="mb-4">
          <select
            className="w-full p-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 focus:ring-2 focus:ring-green-500 outline-none"
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>

        {/* Live Map removed as per request */}

        {viewMode === 'my' && (
          <div className="mb-4 space-y-3">
            <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex items-center justify-between">
              <span className="text-sm text-green-800 font-medium">Total Records Submitted</span>
              <span className="text-lg font-bold text-green-700">{mapPrograms.length}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {programTypes.map((pt) => {
                const count = mapPrograms.filter(p => p.program_type === pt.name).length;
                if (count === 0) return null;
                const color = getColorBase(pt.name);
                return (
                  <div key={pt.id} className={`bg-white p-2 rounded-lg border border-${color}-100 shadow-sm flex flex-col`}>
                    <span className={`text-xs font-medium text-${color}-600 truncate`}>
                      {getProgramTypeLabel(pt.name)}
                    </span>
                    <span className="text-lg font-semibold text-gray-800">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'all' && (
          <div className="mb-4 space-y-3">
            <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex items-center justify-between">
              <span className="text-sm text-green-800 font-medium">Total Islandwide Programs</span>
              <span className="text-lg font-bold text-green-700">{totalPrograms}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {statsByType.map((stat) => {
                const color = getColorBase(stat.program_type);
                return (
                  <div key={stat.program_type} className={`bg-white p-2 rounded-lg border border-${color}-100 shadow-sm flex flex-col`}>
                    <span className={`text-xs font-medium text-${color}-600 truncate`}>
                      {getProgramTypeLabel(stat.program_type)}
                    </span>
                    <span className="text-lg font-semibold text-gray-800">{stat.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'all' && (
          <select
            className="w-full p-2 border border-gray-300 rounded-lg bg-white text-sm"
            value={filterDistrict}
            onChange={(e) => setFilterDistrict(e.target.value)}
          >
            <option value="">All Districts</option>
            {districts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
      </div>

      {/* Recent Activity */}
      <div className="px-6">
        <h2 className="text-gray-800 font-bold mb-4">
          {viewMode === 'my' ? 'My Recent Activity' : 'Islandwide Activity'}
        </h2>
        <div className="space-y-3">
          {recentPrograms.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No activities found.</p>
          ) : (
            recentPrograms.map((program) => {
              const color = getColorBase(program.program_type);
              return (
                <div key={program.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-${color}-100 text-${color}-600`}>
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{getProgramTypeLabel(program.program_type)}</h3>
                    <p className="text-xs text-gray-500">
                      {program.location_name} • {program.district} • {program.date}
                    </p>
                    {program.latitude && program.longitude && (
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {Number(program.latitude).toFixed(5)}, {Number(program.longitude).toFixed(5)}
                      </p>
                    )}
                    {viewMode === 'all' && (
                      <p className="text-xs text-green-600 font-medium mt-1">
                        By: {program.officer_name}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
