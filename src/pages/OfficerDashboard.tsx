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

  const districts = [
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 
    'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 
    'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 
    'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
  ];

  const getColorBase = (type: string) => {
    switch (type) {
      case 'planting': return 'green';
      case 'school': return 'orange';
      case 'home_garden': return 'red';
      case 'community': return 'blue';
      case 'ngo': return 'purple';
      default: return 'gray';
    }
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

      {/* Quick Actions */}
      <div className="p-6 pt-8">
        <h2 className="text-gray-800 font-bold mb-4">Quick Entry</h2>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(PROGRAM_TYPES).map(([key, label]) => {
            const color = getColorBase(key);
            return (
              <button 
                key={key}
                onClick={() => navigate(`/officer/new?type=${key}`)}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition text-center"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-${color}-100 text-${color}-600`}>
                  {key === 'planting' ? <Plus className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                </div>
                <span className="text-xs font-medium text-gray-700">{label}</span>
              </button>
            );
          })}
        </div>
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
              {Object.entries(PROGRAM_TYPES).map(([key, label]) => {
                const count = mapPrograms.filter(p => p.program_type === key).length;
                if (count === 0) return null;
                const color = getColorBase(key);
                return (
                  <div key={key} className={`bg-white p-2 rounded-lg border border-${color}-100 shadow-sm flex flex-col`}>
                    <span className={`text-xs font-medium text-${color}-600 truncate`}>
                      {label}
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
                      {PROGRAM_TYPES[stat.program_type as keyof typeof PROGRAM_TYPES]}
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
                    <h3 className="font-medium text-gray-900 truncate">{PROGRAM_TYPES[program.program_type]}</h3>
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
