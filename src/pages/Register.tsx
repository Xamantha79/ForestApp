import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TreePine, UserPlus, ArrowLeft } from 'lucide-react';

interface RangeForestOffice {
  id: number;
  name: string;
  district_id: number;
  district_name: string;
  zonal_office_id: number;
  zonal_office_name: string;
}

export default function Register() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    range_forest_office: '',
    phone: '',
    role: 'officer'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rangeForestOffices, setRangeForestOffices] = useState<RangeForestOffice[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<RangeForestOffice | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch hierarchy data on component mount
    fetchHierarchy();
  }, []);

  const fetchHierarchy = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/hierarchy');
      const data = await res.json();
      setRangeForestOffices(data.range_forest_offices || []);
    } catch (err) {
      setError('Failed to load range forest offices');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // When range forest office is selected, find and display district and zonal office
    if (name === 'range_forest_office') {
      const selected = rangeForestOffices.find(rfo => rfo.name === value);
      setSelectedOffice(selected || null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!formData.range_forest_office) {
      setError('Please select a range forest office');
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          name: formData.name,
          range_forest_office: formData.range_forest_office,
          phone: formData.phone,
          role: formData.role
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Officer registered successfully! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-green-100">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-green-100 p-4 rounded-full mb-4">
            <UserPlus className="w-12 h-12 text-green-700" />
          </div>
          <h1 className="text-2xl font-bold text-green-900 text-center">Register Officer</h1>
          <p className="text-green-600 text-sm">Forest Department Extension</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              placeholder="Choose username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              placeholder="Full name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Range Forest Office</label>
            <select
              name="range_forest_office"
              value={formData.range_forest_office}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              required
              disabled={loading}
            >
              <option value="">Select Range Forest Office</option>
              {rangeForestOffices.map((rfo) => (
                <option key={rfo.id} value={rfo.name}>
                  {rfo.name}
                </option>
              ))}
            </select>
            {selectedOffice && (
              <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-green-800">District:</span>
                  <span className="text-green-700">{selectedOffice.district_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm mt-1">
                  <span className="font-medium text-green-800">Zonal Office:</span>
                  <span className="text-green-700">{selectedOffice.zonal_office_name}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              placeholder="Phone number"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            >
              <option value="officer">Officer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              placeholder="Password (min 6 characters)"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              placeholder="Confirm password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-600 text-sm p-3 rounded-lg">
              {success}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-3 rounded-lg transition shadow-md hover:shadow-lg"
          >
            Register Officer
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/login')}
            className="text-green-600 hover:text-green-700 text-sm flex items-center justify-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
