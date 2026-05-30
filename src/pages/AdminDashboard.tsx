import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Tooltip as MapTooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Program, PROGRAM_TYPES } from '../types';
import { Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { LogOut, Download, MapPin, Plus, Trash2, X, BarChart3 } from 'lucide-react';
import L from 'leaflet';
import {
  getProgramTypeColor,
  getProgramTypeMarkerIcon,
  getProgramTypeBadgeStyle,
  getProgramTypeDotStyle,
  registerProgramTypes,
} from '../utils/programTypeColors';

// Fix Leaflet marker icons
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
        const bounds = L.latLngBounds(validPoints.map(p => [Number(p.latitude), Number(p.longitude)]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [programs, map]);
  return null;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [programTypes, setProgramTypes] = useState<any[]>([]);
  const [showProgramTypeForm, setShowProgramTypeForm] = useState(false);
  const [newProgramType, setNewProgramType] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useMemo(() => {
    registerProgramTypes([
      ...programTypes.map((t) => t.name),
      ...programs.map((p) => p.program_type),
      ...(stats?.byType?.map((t: { program_type: string }) => t.program_type) || []),
    ]);
  }, [programTypes, programs, stats]);

  const getProgramTypeLabel = (type: string | null | undefined) => {
    if (!type) return 'Unknown';
    const programType = programTypes.find(pt => pt.name === type);
    if (programType) {
      return programType.name.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }
    return PROGRAM_TYPES[type as keyof typeof PROGRAM_TYPES] || type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchData();
    fetchProgramTypes();
  }, []);

  const fetchData = async () => {
    try {
      const [progRes, statRes] = await Promise.all([
        fetch('/api/programs'),
        fetch('/api/stats')
      ]);

      if (progRes.ok) setPrograms(await progRes.json());
      if (statRes.ok) setStats(await statRes.json());

    } catch (err) {
      console.error("Error fetching admin data", err);
    }
  };

  const fetchProgramTypes = async () => {
    try {
      const res = await fetch('/api/program-types');
      if (res.ok) {
        setProgramTypes(await res.json());
      }
    } catch (err) {
      console.error("Error fetching program types", err);
    }
  };

  const handleCreateProgramType = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/program-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProgramType),
      });
      const data = await res.json();
      if (data.success) {
        setNewProgramType({ name: '', description: '' });
        setShowProgramTypeForm(false);
        await fetchProgramTypes();
        await fetchData();
      } else {
        alert(data.message || 'Failed to create program type');
      }
    } catch (err) {
      console.error('Error creating program type:', err);
      alert('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProgramType = async (id: number) => {
    if (!confirm('Are you sure you want to delete this program type?')) return;
    try {
      const res = await fetch(`/api/program-types/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        await fetchProgramTypes();
        await fetchData();
      } else {
        alert(data.message || 'Failed to delete program type');
      }
    } catch (err) {
      console.error('Error deleting program type:', err);
      alert('Network error. Please try again.');
    }
  };

  // Prepare chart data
  const typeData = stats?.byType.map((item: any) => ({
    name: getProgramTypeLabel(item.program_type),
    value: item.count,
    type: item.program_type,
    color: getProgramTypeColor(item.program_type),
  })) || [];

  const programTypeSummary = programs.reduce<Record<string, number>>((acc, p) => {
    const key = p.program_type || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Bar */}
      <header className="bg-white shadow-sm z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-green-700 text-white p-2 rounded-lg font-bold">FD</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-none">Extension Work Performance</h1>
              <p className="text-xs text-gray-500 mt-1 font-medium">
                {currentDateTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • {currentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/analytics')}
              className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">View Analytics</span>
            </button>
            <span className="text-sm text-gray-500 hidden md:block">Welcome, {user?.name}</span>
            <button onClick={logout} className="text-gray-500 hover:text-red-600">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm font-medium">Total Programs</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.total || 0}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm font-medium">Trees Planted</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">{stats?.totalTrees || 0}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm font-medium">Active Districts</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">{stats?.byDistrict.length || 0}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm font-medium">Program Types</h3>
            <p className="text-3xl font-bold text-purple-600 mt-2">{programTypes.length}</p>
          </div>
        </div>

        {/* Program Types Management */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-bold text-gray-800">Program Types</h2>
            <button
              onClick={() => setShowProgramTypeForm(!showProgramTypeForm)}
              className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-md hover:shadow-lg flex items-center gap-2"
            >
              {showProgramTypeForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showProgramTypeForm ? 'Cancel' : 'Add Program Type'}
            </button>
          </div>

          {showProgramTypeForm && (
            <div className="p-6 bg-gray-50 border-b border-gray-100">
              <form onSubmit={handleCreateProgramType} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Program Type Name</label>
                    <input
                      type="text"
                      value={newProgramType.name}
                      onChange={(e) => setNewProgramType({ ...newProgramType, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                      placeholder="e.g., workshop, training"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={newProgramType.description}
                      onChange={(e) => setNewProgramType({ ...newProgramType, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                      placeholder="Brief description"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-green-700 hover:bg-green-800 text-white font-medium px-4 py-2 rounded-lg transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Program Type'}
                </button>
              </form>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3">Programs Count</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {programTypes.map((type) => (
                  <tr key={type.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-900">{type.id}</td>
                    <td className="px-6 py-3 font-medium text-gray-900">{type.name}</td>
                    <td className="px-6 py-3 text-gray-600">{type.description || '-'}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {programs.filter(p => p.program_type === type.name).length}
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => handleDeleteProgramType(type.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition"
                        title="Delete Program Type"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Map & Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Map Section */}
          <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-[500px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-gray-800">Live Activity Map</h2>
            </div>
            <div className="flex-1 rounded-lg overflow-hidden border border-gray-200 relative z-0">
              <MapContainer 
                center={[7.8731, 80.7718]} 
                zoom={7} 
                style={{ height: '100%', width: '100%' }}
                maxBounds={[[5.8, 79.5], [10.0, 82.0]]}
                minZoom={7}
              >
                <MapUpdater programs={programs} />
                <TileLayer
                  attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
                {programs
                  .filter(prog => prog.latitude != null && prog.longitude != null && !isNaN(Number(prog.latitude)) && !isNaN(Number(prog.longitude)))
                  .map((prog) => (
                    <Marker 
                      key={prog.id} 
                      position={[Number(prog.latitude), Number(prog.longitude)]}
                      icon={getProgramTypeMarkerIcon(prog.program_type)}
                    >
                    <MapTooltip>
                      <span>{getProgramTypeLabel(prog.program_type)} - {prog.location_name}</span>
                    </MapTooltip>
                    <Popup>
                      <div className="p-1">
                        <strong className="block text-sm" style={{ color: getProgramTypeColor(prog.program_type) }}>
                          {getProgramTypeLabel(prog.program_type)}
                        </strong>
                        <span className="text-xs text-gray-600">{prog.location_name}</span><br/>
                        <span className="text-xs text-gray-500">{prog.date} • {prog.officer_name}</span>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>

          {/* Charts Section */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <h2 className="font-bold text-gray-800 mb-4">Program Distribution</h2>
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {typeData.map((entry: { type?: string; color?: string; name: string }, index: number) => (
                      <Cell key={entry.type || entry.name || index} fill={entry.color || getProgramTypeColor(entry.type)} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-bold text-gray-800">Recent Submissions</h2>
            <button className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
          
          {/* Summary Counts */}
          <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-100 flex flex-wrap gap-4 items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Summary:</span>
            {Object.entries(programTypeSummary).map(([key, count]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full shrink-0" style={getProgramTypeDotStyle(key)} />
                <span className="text-gray-600">{getProgramTypeLabel(key)}:</span>
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-sm ml-auto border-l pl-4 border-gray-200">
              <span className="text-gray-600">Total:</span>
              <span className="font-bold text-gray-900">{programs.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Location</th>
                  <th className="px-6 py-3">Coordinates</th>
                  <th className="px-6 py-3">Officer</th>
                  <th className="px-6 py-3">Participants</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {programs.map((prog) => (
                  <tr key={prog.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-900">{prog.date}</td>
                    <td className="px-6 py-3">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-medium border"
                        style={getProgramTypeBadgeStyle(prog.program_type)}
                      >
                        {getProgramTypeLabel(prog.program_type)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{prog.location_name}</td>
                    <td className="px-6 py-3 text-gray-500 font-mono text-xs">
                      {prog.latitude && prog.longitude ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span>{Number(prog.latitude).toFixed(5)}, {Number(prog.longitude).toFixed(5)}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{prog.officer_name}</td>
                    <td className="px-6 py-3 text-gray-600">{prog.participants}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
