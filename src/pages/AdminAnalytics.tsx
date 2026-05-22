import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PROGRAM_TYPES } from '../types';
import {
  ArrowLeft,
  LogOut,
  Search,
  Filter,
  BarChart3,
  Users,
  TreePine,
  Calendar,
  MapPin,
  Activity,
  UserX,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

const COLORS = ['#15803d', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#ec4899', '#14b8a6'];

interface AnalyticsData {
  summary: {
    totalPrograms: number;
    totalTrees: number;
    totalParticipants: number;
    activeOfficers: number;
    activeDays: number;
    firstDate: string | null;
    lastDate: string | null;
  };
  byType: { program_type: string; count: number; trees: number; participants: number }[];
  byDistrict: { district: string; count: number; trees: number }[];
  byZonal: { zonal_office: string; count: number }[];
  byRange: { range_office: string; count: number; trees: number }[];
  byOfficer: {
    officer_id: number;
    officer_name: string;
    range_office: string;
    district: string;
    count: number;
    trees: number;
    participants: number;
    first_activity: string;
    last_activity: string;
    active_days: number;
  }[];
  byMonth: { year: number; month: number; count: number; trees: number; participants: number }[];
  activityLog: {
    id: number;
    date: string;
    program_type: string;
    location_name: string;
    description: string;
    plants_count: number;
    participants: number;
    officer_id: number;
    officer_name: string;
    range_forest_office: string;
    district: string;
    zonal_office: string;
  }[];
  inactiveOfficers: { id: number; name: string; range_office: string; district: string }[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AdminAnalytics() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [programTypes, setProgramTypes] = useState<{ id: number; name: string }[]>([]);
  const [officers, setOfficers] = useState<{ id: number; name: string; range_office?: string }[]>([]);
  const [zonalOffices, setZonalOffices] = useState<{ id: number; name: string }[]>([]);
  const [districts, setDistricts] = useState<{ id: number; name: string }[]>([]);
  const [rangeOffices, setRangeOffices] = useState<{ id: number; name: string }[]>([]);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterZonal, setFilterZonal] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterRange, setFilterRange] = useState('');
  const [filterOfficer, setFilterOfficer] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [activeTab, setActiveTab] = useState<'officers' | 'geography' | 'activity' | 'inactive'>('officers');
  const [activityFilter, setActivityFilter] = useState('');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => currentYear - i);

  const getProgramTypeLabel = (type: string | null | undefined) => {
    if (!type) return 'Unknown';
    const pt = programTypes.find((p) => p.name === type);
    if (pt) {
      return pt.name.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    return PROGRAM_TYPES[type as keyof typeof PROGRAM_TYPES] ||
      type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (filterZonal) params.set('zonal_office', filterZonal);
    if (filterDistrict) params.set('district', filterDistrict);
    if (filterRange) params.set('range_office', filterRange);
    if (filterOfficer) params.set('officer_id', filterOfficer);
    if (filterType) params.set('program_type', filterType);
    if (filterYear) params.set('year', filterYear);
    if (filterStart) params.set('start_date', filterStart);
    if (filterEnd) params.set('end_date', filterEnd);
    return params.toString() ? `?${params.toString()}` : '';
  }, [search, filterZonal, filterDistrict, filterRange, filterOfficer, filterType, filterYear, filterStart, filterEnd]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics${buildQuery()}`);
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    const loadMeta = async () => {
      const [hierarchyRes, officersRes, typesRes] = await Promise.all([
        fetch('/api/hierarchy'),
        fetch('/api/officers'),
        fetch('/api/program-types'),
      ]);
      if (hierarchyRes.ok) {
        const h = await hierarchyRes.json();
        setZonalOffices(h.zonal_offices || []);
        setDistricts(h.districts || []);
        setRangeOffices(h.range_forest_offices || []);
      }
      if (officersRes.ok) setOfficers(await officersRes.json());
      if (typesRes.ok) setProgramTypes(await typesRes.json());
    };
    loadMeta();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setFilterZonal('');
    setFilterDistrict('');
    setFilterRange('');
    setFilterOfficer('');
    setFilterType('');
    setFilterYear('');
    setFilterStart('');
    setFilterEnd('');
  };

  const monthChartData = useMemo(
    () =>
      (data?.byMonth || []).map((m) => ({
        name: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
        programs: m.count,
        trees: m.trees,
        participants: m.participants,
      })),
    [data?.byMonth]
  );

  const typeChartData = useMemo(
    () =>
      (data?.byType || []).map((t) => ({
        name: getProgramTypeLabel(t.program_type),
        value: t.count,
      })),
    [data?.byType, programTypes]
  );

  const topOfficersChart = useMemo(
    () =>
      (data?.byOfficer || []).slice(0, 10).map((o) => ({
        name: o.officer_name?.split(' ')[0] || 'Unknown',
        programs: o.count,
        trees: o.trees,
      })),
    [data?.byOfficer]
  );

  const filteredActivity = useMemo(() => {
    if (!data?.activityLog) return [];
    if (!activityFilter.trim()) return data.activityLog;
    const q = activityFilter.toLowerCase();
    return data.activityLog.filter(
      (a) =>
        a.officer_name?.toLowerCase().includes(q) ||
        a.location_name?.toLowerCase().includes(q) ||
        a.program_type?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.district?.toLowerCase().includes(q)
    );
  }, [data?.activityLog, activityFilter]);

  const hasFilters =
    search || filterZonal || filterDistrict || filterRange || filterOfficer ||
    filterType || filterYear || filterStart || filterEnd;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm z-20 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-1 text-gray-600 hover:text-green-700 text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </button>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-700" />
              <h1 className="text-lg font-bold text-gray-900">Officer Analytics</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:block">{user?.name}</span>
            <button onClick={logout} className="text-gray-500 hover:text-red-600">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Filters */}
        <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 text-gray-700">
            <Filter className="w-5 h-5 text-green-700" />
            <h2 className="font-semibold">Filters & Search</h2>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search officer, location, description, district, type..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <select value={filterZonal} onChange={(e) => setFilterZonal(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">All Zones</option>
              {zonalOffices.map((z) => (
                <option key={z.id} value={z.name}>{z.name}</option>
              ))}
            </select>
            <select value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">All Districts</option>
              {districts.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
            <select value={filterRange} onChange={(e) => setFilterRange(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">All Ranges</option>
              {rangeOffices.map((r) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
            <select value={filterOfficer} onChange={(e) => setFilterOfficer(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">All Officers</option>
              {officers.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">All Types</option>
              {programTypes.map((t) => (
                <option key={t.id} value={t.name}>{getProgramTypeLabel(t.name)}</option>
              ))}
            </select>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">All Years</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm" title="From date" />
            <input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm" title="To date" />
          </div>

          <div className="flex gap-2">
            {hasFilters && (
              <button onClick={clearFilters} className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-1.5">
                Clear all
              </button>
            )}
            <button
              onClick={fetchAnalytics}
              className="text-sm bg-green-700 hover:bg-green-800 text-white font-medium px-4 py-1.5 rounded-lg"
            >
              Refresh
            </button>
          </div>
        </section>

        {loading && !data ? (
          <div className="text-center py-16 text-gray-500">Loading analytics...</div>
        ) : data ? (
          <>
            {/* Summary */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total Programs', value: data.summary.totalPrograms, icon: Activity, color: 'text-gray-900' },
                { label: 'Trees Planted', value: data.summary.totalTrees, icon: TreePine, color: 'text-green-600' },
                { label: 'Participants', value: data.summary.totalParticipants, icon: Users, color: 'text-blue-600' },
                { label: 'Active Officers', value: data.summary.activeOfficers, icon: Users, color: 'text-purple-600' },
                { label: 'Active Days', value: data.summary.activeDays, icon: Calendar, color: 'text-orange-600' },
                {
                  label: 'Date Range',
                  value: data.summary.firstDate && data.summary.lastDate
                    ? `${data.summary.firstDate} → ${data.summary.lastDate}`
                    : '—',
                  icon: Calendar,
                  color: 'text-gray-700 text-sm',
                  small: true,
                },
              ].map((card) => (
                <div key={card.label} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
                    <card.icon className="w-3.5 h-3.5" />
                    {card.label}
                  </div>
                  <p className={`font-bold ${(card as { small?: boolean }).small ? 'text-sm' : 'text-2xl'} ${card.color}`}>
                    {card.value}
                  </p>
                </div>
              ))}
            </section>

            {/* Charts */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4">Activity Over Time</h3>
                <div className="h-64">
                  {monthChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="programs" stroke="#15803d" strokeWidth={2} name="Programs" />
                        <Line type="monotone" dataKey="trees" stroke="#0ea5e9" strokeWidth={2} name="Trees" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-400 text-sm text-center py-12">No data for selected filters</p>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4">By Program Type</h3>
                <div className="h-64">
                  {typeChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={typeChartData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4}>
                          {typeChartData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={48} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-400 text-sm text-center py-12">No data</p>
                  )}
                </div>
              </div>
            </section>

            <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4">Top 10 Officers by Submissions</h3>
              <div className="h-56">
                {topOfficersChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topOfficersChart} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="programs" fill="#15803d" name="Programs" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-8">No officer data</p>
                )}
              </div>
            </section>

            {/* Tabbed tables */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex border-b border-gray-100 overflow-x-auto">
                {[
                  { id: 'officers' as const, label: 'Officer Performance', icon: Users },
                  { id: 'geography' as const, label: 'Geographic Breakdown', icon: MapPin },
                  { id: 'activity' as const, label: 'Activity Log', icon: Activity },
                  { id: 'inactive' as const, label: `Inactive (${data.inactiveOfficers.length})`, icon: UserX },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                      activeTab === tab.id
                        ? 'border-green-700 text-green-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-4 overflow-x-auto">
                {activeTab === 'officers' && (
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                      <tr>
                        <th className="px-4 py-2">Officer</th>
                        <th className="px-4 py-2">Range</th>
                        <th className="px-4 py-2">District</th>
                        <th className="px-4 py-2">Programs</th>
                        <th className="px-4 py-2">Trees</th>
                        <th className="px-4 py-2">Participants</th>
                        <th className="px-4 py-2">Active Days</th>
                        <th className="px-4 py-2">First</th>
                        <th className="px-4 py-2">Last</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.byOfficer.length === 0 ? (
                        <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No results</td></tr>
                      ) : (
                        data.byOfficer.map((o) => (
                          <tr key={o.officer_id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium">{o.officer_name}</td>
                            <td className="px-4 py-2 text-gray-600">{o.range_office || '—'}</td>
                            <td className="px-4 py-2 text-gray-600">{o.district || '—'}</td>
                            <td className="px-4 py-2 font-semibold">{o.count}</td>
                            <td className="px-4 py-2">{o.trees}</td>
                            <td className="px-4 py-2">{o.participants}</td>
                            <td className="px-4 py-2">{o.active_days}</td>
                            <td className="px-4 py-2 text-gray-500">{o.first_activity || '—'}</td>
                            <td className="px-4 py-2 text-gray-500">{o.last_activity || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === 'geography' && (
                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">By District</h4>
                      <table className="w-full text-sm">
                        <thead><tr className="text-gray-500"><th className="text-left py-1">District</th><th className="text-right py-1">Count</th><th className="text-right py-1">Trees</th></tr></thead>
                        <tbody>
                          {data.byDistrict.map((d) => (
                            <tr key={d.district} className="border-t border-gray-50">
                              <td className="py-1.5">{d.district || 'Unknown'}</td>
                              <td className="text-right font-medium">{d.count}</td>
                              <td className="text-right text-green-700">{d.trees}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">By Zonal Office</h4>
                      <table className="w-full text-sm">
                        <thead><tr className="text-gray-500"><th className="text-left py-1">Zone</th><th className="text-right py-1">Count</th></tr></thead>
                        <tbody>
                          {data.byZonal.map((z) => (
                            <tr key={z.zonal_office} className="border-t border-gray-50">
                              <td className="py-1.5">{z.zonal_office || 'Unknown'}</td>
                              <td className="text-right font-medium">{z.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">By Range Office</h4>
                      <table className="w-full text-sm">
                        <thead><tr className="text-gray-500"><th className="text-left py-1">Range</th><th className="text-right py-1">Count</th><th className="text-right py-1">Trees</th></tr></thead>
                        <tbody>
                          {data.byRange.map((r) => (
                            <tr key={r.range_office} className="border-t border-gray-50">
                              <td className="py-1.5">{r.range_office || 'Unknown'}</td>
                              <td className="text-right font-medium">{r.count}</td>
                              <td className="text-right text-green-700">{r.trees}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'activity' && (
                  <>
                    <div className="mb-3 relative max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Filter this table..."
                        value={activityFilter}
                        onChange={(e) => setActivityFilter(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-500 font-medium">
                        <tr>
                          <th className="px-4 py-2">Date</th>
                          <th className="px-4 py-2">Officer</th>
                          <th className="px-4 py-2">Type</th>
                          <th className="px-4 py-2">Location</th>
                          <th className="px-4 py-2">District</th>
                          <th className="px-4 py-2">Trees</th>
                          <th className="px-4 py-2">Participants</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredActivity.length === 0 ? (
                          <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No activity found</td></tr>
                        ) : (
                          filteredActivity.map((a) => (
                            <tr key={a.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 whitespace-nowrap">{a.date}</td>
                              <td className="px-4 py-2 font-medium">{a.officer_name || '—'}</td>
                              <td className="px-4 py-2">
                                <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">
                                  {getProgramTypeLabel(a.program_type)}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-gray-600 max-w-[200px] truncate" title={a.location_name}>{a.location_name || '—'}</td>
                              <td className="px-4 py-2 text-gray-600">{a.district || '—'}</td>
                              <td className="px-4 py-2">{a.plants_count}</td>
                              <td className="px-4 py-2">{a.participants}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    <p className="text-xs text-gray-400 mt-2">Showing {filteredActivity.length} of {data.activityLog.length} records (max 200 from server)</p>
                  </>
                )}

                {activeTab === 'inactive' && (
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                      <tr>
                        <th className="px-4 py-2">Officer</th>
                        <th className="px-4 py-2">Range</th>
                        <th className="px-4 py-2">District</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.inactiveOfficers.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">All officers have submissions in this scope</td></tr>
                      ) : (
                        data.inactiveOfficers.map((o) => (
                          <tr key={o.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium">{o.name}</td>
                            <td className="px-4 py-2 text-gray-600">{o.range_office || '—'}</td>
                            <td className="px-4 py-2 text-gray-600">{o.district || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* Type breakdown detail */}
            <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-3">Program Type Impact</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-right">Programs</th>
                      <th className="px-4 py-2 text-right">Trees</th>
                      <th className="px-4 py-2 text-right">Participants</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.byType.map((t) => (
                      <tr key={t.program_type}>
                        <td className="px-4 py-2 font-medium">{getProgramTypeLabel(t.program_type)}</td>
                        <td className="px-4 py-2 text-right">{t.count}</td>
                        <td className="px-4 py-2 text-right text-green-700">{t.trees}</td>
                        <td className="px-4 py-2 text-right">{t.participants}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <div className="text-center py-16 text-gray-500">Failed to load analytics</div>
        )}
      </main>
    </div>
  );
}
