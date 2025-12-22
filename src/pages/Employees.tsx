import { useState } from 'react';
import { Plus, Search, Shield, Mail, DollarSign, TrendingUp, Clock } from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';

export default function Employees() {
  const { employees, sales, addEmployee } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    role: 'cashier' as 'admin' | 'manager' | 'cashier',
    commission: 3
  });

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    
    const employee = {
      id: Date.now().toString(),
      ...newEmployee,
      totalSales: 0,
      shifts: []
    };

    addEmployee(employee);
    setNewEmployee({ name: '', email: '', role: 'cashier', commission: 3 });
    setShowAddModal(false);
  };

  const calculateEmployeeStats = (employeeId: string) => {
    const employeeSales = sales.filter(s => s.employeeId === employeeId);
    const totalRevenue = employeeSales.reduce((sum, s) => sum + s.total, 0);
    const totalSalesCount = employeeSales.length;
    
    const employee = employees.find(e => e.id === employeeId);
    const commission = employee ? (totalRevenue * employee.commission) / 100 : 0;

    return { totalRevenue, totalSalesCount, commission };
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-600';
      case 'manager': return 'bg-blue-100 text-blue-600';
      case 'cashier': return 'bg-green-100 text-green-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-gray-900">Employee Management</h1>
            <p className="text-gray-600">Manage staff, roles, and track performance</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Employee</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-600 mb-1">Total Employees</p>
            <p className="text-gray-900">{employees.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-600 mb-1">Admins</p>
            <p className="text-gray-900">{employees.filter(e => e.role === 'admin').length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-600 mb-1">Managers</p>
            <p className="text-gray-900">{employees.filter(e => e.role === 'manager').length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-600 mb-1">Cashiers</p>
            <p className="text-gray-900">{employees.filter(e => e.role === 'cashier').length}</p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
        </div>

        {/* Employees List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredEmployees.map((employee) => {
            const stats = calculateEmployeeStats(employee.id);

            return (
              <div key={employee.id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 text-lg">
                        {employee.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-gray-900">{employee.name}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <p className="text-gray-600 text-sm">{employee.email}</p>
                      </div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${getRoleBadgeColor(employee.role)}`}>
                    {employee.role.charAt(0).toUpperCase() + employee.role.slice(1)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <p className="text-gray-600 text-sm">Total Sales</p>
                    </div>
                    <p className="text-gray-900">${stats.totalRevenue.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <DollarSign className="w-4 h-4 text-indigo-500" />
                      <p className="text-gray-600 text-sm">Commission</p>
                    </div>
                    <p className="text-gray-900">${stats.commission.toFixed(2)}</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Transactions</span>
                    <span className="text-gray-900">{stats.totalSalesCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Commission Rate</span>
                    <span className="text-gray-900">{employee.commission}%</span>
                  </div>
                  {stats.totalSalesCount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Avg per Transaction</span>
                      <span className="text-gray-900">
                        ${(stats.totalRevenue / stats.totalSalesCount).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button className="w-full py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                    View Performance Report
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredEmployees.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-600">No employees found</p>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-gray-900 mb-4">Add New Employee</h2>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Role</label>
                <select
                  value={newEmployee.role}
                  onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Commission Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={newEmployee.commission}
                  onChange={(e) => setNewEmployee({ ...newEmployee, commission: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  required
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Add Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}