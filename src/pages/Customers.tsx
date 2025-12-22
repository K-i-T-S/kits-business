import { useState } from 'react';
import { Plus, Search, Phone, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';

export default function Customers() {
  const { customers, addCustomer, updateCustomer } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery)
  );

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    
    const customer = {
      id: Date.now().toString(),
      name: newCustomer.name,
      phone: newCustomer.phone,
      debtBalance: 0,
      totalPurchases: 0
    };

    addCustomer(customer);
    setNewCustomer({ name: '', phone: '' });
    setShowAddModal(false);
  };

  const handlePayDebt = (customerId: string, amount: number) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      const newBalance = Math.max(0, customer.debtBalance - amount);
      updateCustomer(customerId, { debtBalance: newBalance });
    }
  };

  const totalDebt = customers.reduce((sum, c) => sum + c.debtBalance, 0);
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalPurchases, 0);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-gray-900">Customer Management</h1>
            <p className="text-gray-600">Track customers, purchases, and debt balances</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Customer</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-600 mb-1">Total Customers</p>
            <p className="text-gray-900">{customers.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-600 mb-1">Total Revenue</p>
            <p className="text-gray-900">${totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-600 mb-1">Outstanding Debt</p>
            <p className="text-orange-600">${totalDebt.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-600 mb-1">Customers w/ Debt</p>
            <p className="text-gray-900">{customers.filter(c => c.debtBalance > 0).length}</p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
        </div>

        {/* Customers List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-gray-600">Customer</th>
                  <th className="px-6 py-3 text-left text-gray-600">Phone</th>
                  <th className="px-6 py-3 text-left text-gray-600">Total Purchases</th>
                  <th className="px-6 py-3 text-left text-gray-600">Debt Balance</th>
                  <th className="px-6 py-3 text-left text-gray-600">Last Purchase</th>
                  <th className="px-6 py-3 text-left text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-indigo-600">
                            {customer.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-gray-900">{customer.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{customer.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700">${customer.totalPurchases.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {customer.debtBalance > 0 ? (
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 text-orange-500" />
                          <span className="text-orange-600">${customer.debtBalance.toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="text-green-600">$0.00</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-700 text-sm">
                      {customer.lastPurchaseDate
                        ? new Date(customer.lastPurchaseDate).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      {customer.debtBalance > 0 && (
                        <button
                          onClick={() => {
                            const amount = prompt(`Enter payment amount (Max: $${customer.debtBalance.toFixed(2)}):`);
                            if (amount) {
                              handlePayDebt(customer.id, parseFloat(amount));
                            }
                          }}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm"
                        >
                          <DollarSign className="w-4 h-4" />
                          <span>Pay Debt</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">No customers found</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-gray-900 mb-4">Add New Customer</h2>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Customer Name</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
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
                  Add Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
