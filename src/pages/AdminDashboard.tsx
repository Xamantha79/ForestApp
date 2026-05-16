import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Tooltip as MapTooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Program, PROGRAM_TYPES } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { LogOut, Filter, Download, MapPin } from 'lucide-react';
import L from 'leaflet';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

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
    }
  }, [programs, map]);
  return null;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterRange, setFilterRange] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const districts = [
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 
    'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 
    'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 
    'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
  ];

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

  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchData();
  }, [filterDistrict, filterRange, startDate, endDate]);

  const fetchData = async () => {
    try {
      let query = '?';
      if (filterDistrict) query += `district=${filterDistrict}&`;
      if (filterRange) query += `range=${filterRange}&`;
      if (startDate) query += `start_date=${startDate}&`;
      if (endDate) query += `end_date=${endDate}&`;
      
      const [progRes, statRes] = await Promise.all([
        fetch(`/api/programs${query}`),
        fetch('/api/stats')
      ]);

      if (progRes.ok) setPrograms(await progRes.json());
      if (statRes.ok) setStats(await statRes.json());

    } catch (err) {
      console.error("Error fetching admin data", err);
    }
  };

  // Prepare chart data
  const typeData = stats?.byType.map((item: any) => ({
    name: PROGRAM_TYPES[item.program_type as keyof typeof PROGRAM_TYPES],
    value: item.count
  })) || [];

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
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:block">Welcome, {user?.name}</span>
            <button onClick={logout} className="text-gray-500 hover:text-red-600">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 text-gray-500">
            <Filter className="w-5 h-5" />
            <span className="font-medium">Filters:</span>
          </div>
          
          <div className="flex-1 min-w-[200px]">
            <select 
              className="w-full p-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-green-500 outline-none"
              value={filterDistrict}
              onChange={(e) => setFilterDistrict(e.target.value)}
            >
              <option value="">All Districts</option>
              {districts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <input 
              type="text"
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
              value={filterRange}
              onChange={(e) => setFilterRange(e.target.value)}
              placeholder="Search Range Office (e.g. Kadawala)"
            />
          </div>

          <div className="flex gap-2">
            <input 
              type="date"
              className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="self-center text-gray-400">-</span>
            <input 
              type="date"
              className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {(filterDistrict || filterRange || startDate || endDate) && (
            <button 
              onClick={() => {
                setFilterDistrict('');
                setFilterRange('');
                setStartDate('');
                setEndDate('');
              }}
              className="text-sm text-red-600 hover:text-red-700 font-medium px-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm font-medium">Total Programs</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.total || 0}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm font-medium">Active Districts</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">{stats?.byDistrict.length || 0}</p>
          </div>
          {/* Add more stats as needed */}
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
                {programs.map((prog) => (
                  <Marker 
                    key={prog.id} 
                    position={[prog.latitude, prog.longitude]}
                    icon={getMarkerIcon(prog.program_type)}
                  >
                    <MapTooltip>
                      <span>{PROGRAM_TYPES[prog.program_type]} - {prog.location_name}</span>
                    </MapTooltip>
                    <Popup>
                      <div className="p-1">
                        <strong className="block text-sm text-green-700">{PROGRAM_TYPES[prog.program_type]}</strong>
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
                    {typeData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
            {Object.entries(PROGRAM_TYPES).map(([key, label]) => {
              const count = programs.filter(p => p.program_type === key).length;
              if (count === 0) return null;
              
              let colorClass = 'bg-gray-500';
              if (key === 'planting') colorClass = 'bg-green-500';
              else if (key === 'school') colorClass = 'bg-orange-500';
              else if (key === 'home_garden') colorClass = 'bg-red-500';
              else if (key === 'community') colorClass = 'bg-blue-500';
              else if (key === 'ngo') colorClass = 'bg-violet-500';

              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full ${colorClass}`} />
                  <span className="text-gray-600">{label}:</span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </div>
              );
            })}
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
                      <span className={`px-2 py-1 rounded-full text-xs font-medium
                        ${prog.program_type === 'planting' ? 'bg-green-100 text-green-700' : 
                          prog.program_type === 'school' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                        {PROGRAM_TYPES[prog.program_type]}
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
