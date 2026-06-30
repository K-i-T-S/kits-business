import {
  Plus,
  Search,
  Shield,
  Mail,
  DollarSign,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import CustomRolesManager from '../components/CustomRolesManager';
import InviteTeamMemberModal from '../components/InviteTeamMemberModal';
import Layout from '../components/Layout';
import TenantSwitcher from '../components/TenantSwitcher';
import { useApp } from '../context/AppContext';
import { ROLE_LABELS } from '../types/subscription';

type Tab = 'team' | 'roles';

export default function Employees() {
  const { employees, sales, addEmployee, currentTenant } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('team');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    role: 'cashier' as 'admin' | 'manager' | 'cashier' | 'supervisor' | 'accountant' | 'stockkeeper' | 'viewer',
    commission: 3,
  });

  const filteredEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          employee.email.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [employees, searchQuery],
  );

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);

  const formatCurrency = (value: number) =>
    (value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const statCards = [
    {
      title: 'Team members',
      value: (employees?.length || 0).toLocaleString(),
      helper: 'Add your staffing target here',
      accent: 'from-indigo-500/95 via-indigo-400/85 to-sky-400/80',
    },
    {
      title: 'Leadership coverage',
      value: (employees?.filter((e) => e.role !== 'cashier' && e.role !== 'viewer').length || 0).toLocaleString(),
      helper: 'Admins + managers online',
      accent: 'from-purple-500/95 via-purple-400/85 to-pink-400/80',
    },
    {
      title: 'Gross revenue handled',
      value: formatCurrency(totalRevenue),
      helper: 'All-time sales recorded',
      accent: 'from-emerald-500/95 via-emerald-400/85 to-lime-400/80',
    },
    {
      title: 'Avg revenue / teammate',
      value:
        employees.length > 0 ? formatCurrency(totalRevenue / employees.length) : formatCurrency(0),
      helper: 'Use this to track productivity',
      accent: 'from-amber-500/95 via-amber-400/85 to-orange-400/80',
    },
  ];

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();

    const employee = {
      id: Date.now().toString(),
      ...newEmployee,
      totalSales: 0,
      shifts: [],
    };

    void addEmployee(employee);
    setNewEmployee({ name: '', email: '', role: 'cashier', commission: 3 });
    setShowAddModal(false);
  };

  const calculateEmployeeStats = (employeeId: string) => {
    const employeeSales = sales.filter(s => s.employeeId === employeeId);
    const totalRev = employeeSales.reduce((sum, s) => sum + s.total, 0);
    const totalSalesCount = employeeSales.length;

    const employee = employees.find(e => e.id === employeeId);
    const commission = employee ? (totalRev * employee.commission) / 100 : 0;

    return { totalRevenue: totalRev, totalSalesCount, commission };
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
      case 'admin': return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
      case 'manager': return 'bg-sky-500/20 text-sky-300 border border-sky-500/30';
      case 'supervisor': return 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
      case 'cashier': return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      case 'accountant': return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
      case 'stockkeeper': return 'bg-orange-500/20 text-orange-300 border border-orange-500/30';
      default: return 'bg-white/10 text-white/60 border border-white/20';
    }
  };

  return (
    <Layout>
      <div className="space-y-10 pb-4 lg:pb-6">
        {/* Hero */}
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 md:p-8 text-white">
          <Sparkles className="pointer-events-none absolute -end-6 -top-6 h-24 w-24 text-white/20" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-4 mb-4">
                <p className="stat-chip bg-white/10 text-white/80">People operations</p>
                <TenantSwitcher />
              </div>
              <h1 className="mt-3 text-3xl font-semibold text-white">
                Build a legendary frontline team.
              </h1>
              <p className="mt-2 text-sm text-white/80">
                Manage roles, commissions, and performance for your {currentTenant?.name || 'business'} team.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowInviteModal(true)}
                className="tilt-hover inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/10 px-6 py-3 text-sm font-semibold text-white shadow-lg"
              >
                <UserPlus className="h-5 w-5" />
                Invite by email
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="tilt-hover inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 btn-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25"
              >
                <Plus className="h-5 w-5" />
                Add teammate
              </button>
            </div>
          </div>
        </section>

        {/* Stat cards */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.title}
              className={`tilt-hover rounded-3xl border border-white/10 bg-gradient-to-br ${card.accent} p-5 text-white shadow-lg shadow-slate-900/15`}
            >
              <p className="text-xs uppercase tracking-[0.25em] text-white/70">{card.title}</p>
              <p className="mt-3 text-2xl font-semibold">{card.value}</p>
              <p className="text-sm text-white/80">{card.helper}</p>
            </div>
          ))}
        </section>

        {/* Tab bar */}
        <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 w-fit">
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'team'
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Users className="h-4 w-4" />
            Team Members
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'roles'
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Shield className="h-4 w-4" />
            Roles
          </button>
        </div>

        {/* Team Members tab */}
        {activeTab === 'team' && (
          <>
            <section className="hero-gradient glass-panel p-6 text-white">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">Directory</p>
                  <h2 className="text-lg font-semibold text-white">Filter by name or email</h2>
                </div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/70">
                  Kits team directory
                </p>
              </div>
              <div className="mt-4 relative">
                <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
                <input
                  type="text"
                  placeholder="Search by name, email, or role…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-white/30 bg-white/20 py-3 ps-12 pe-4 text-sm text-white placeholder-white/50 shadow-inner focus:border-white/50 focus:outline-none"
                />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
              {filteredEmployees.map((employee) => {
                const stats = calculateEmployeeStats(employee.id);

                return (
                  <article key={employee.id} className="hero-gradient glass-panel p-5 sm:p-6 text-white">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2 sm:space-x-3">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-semibold text-white">
                          {employee.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold text-white">{employee.name}</h3>
                          <div className="mt-1 flex items-center gap-2 text-sm text-white/80">
                            <Mail className="h-4 w-4 text-white/60" />
                            <p className="truncate">{employee.email}</p>
                          </div>
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeColor(employee.role)}`}>
                        {ROLE_LABELS[employee.role] ?? (employee.role.charAt(0).toUpperCase() + employee.role.slice(1))}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white/10 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/70">Total sales</p>
                        <p className="text-lg font-semibold text-white">{formatCurrency(stats.totalRevenue)}</p>
                      </div>
                      <div className="rounded-2xl bg-white/10 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/70">Commission</p>
                        <p className="text-lg font-semibold text-white">{formatCurrency(stats.commission)}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 rounded-2xl border border-white/20 bg-white/10 p-3 text-xs text-white/80">
                      <div className="flex justify-between">
                        <span>Transactions</span>
                        <span className="font-semibold text-white">{stats.totalSalesCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Commission rate</span>
                        <span className="font-semibold text-white">{employee.commission}%</span>
                      </div>
                      {stats.totalSalesCount > 0 && (
                        <div className="flex justify-between">
                          <span>Avg per transaction</span>
                          <span className="font-semibold text-white">
                            {formatCurrency(stats.totalRevenue / stats.totalSalesCount)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-xs uppercase tracking-[0.3em] text-white/70">
                        Performance snapshot
                      </div>
                      <button className="rounded-2xl border border-white/30 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/20">
                        View performance report
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>

            {filteredEmployees.length === 0 && (
              <div className="hero-gradient glass-panel rounded-2xl p-8 sm:p-12 text-center">
                <Users className="h-12 w-12 text-white/20 mx-auto mb-4" />
                <p className="text-white font-medium mb-1">No team members found</p>
                <p className="text-sm text-white/50">Add a teammate or invite someone by email to get started.</p>
              </div>
            )}
          </>
        )}

        {/* Roles tab */}
        {activeTab === 'roles' && (
          <section className="hero-gradient glass-panel p-6 text-white">
            <CustomRolesManager />
          </section>
        )}
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="rounded-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: 'rgba(11, 15, 36, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '1.5rem',
              color: '#f8faff',
              boxShadow: '0 35px 85px rgba(2, 3, 12, 0.6)',
              backdropFilter: 'blur(28px)',
            }}
          >
            <h2 className="text-lg sm:text-xl mb-4 font-semibold" style={{ color: '#f8faff' }}>
              Add New Employee
            </h2>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-sm sm:text-base mb-2" style={{ color: 'rgba(248, 250, 255, 0.8)' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  className="w-full px-4 py-2 sm:py-3 rounded-lg transition-colors"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8faff',
                  }}
                  required
                />
              </div>
              <div>
                <label className="block text-sm sm:text-base mb-2" style={{ color: 'rgba(248, 250, 255, 0.8)' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  className="w-full px-4 py-2 sm:py-3 rounded-lg transition-colors"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8faff',
                  }}
                  required
                />
              </div>
              <div>
                <label className="block text-sm sm:text-base mb-2" style={{ color: 'rgba(248, 250, 255, 0.8)' }}>
                  Role
                </label>
                <select
                  value={newEmployee.role}
                  onChange={(e) =>
                    setNewEmployee({
                      ...newEmployee,
                      role: e.target.value as typeof newEmployee.role,
                    })
                  }
                  className="w-full px-4 py-2 sm:py-3 rounded-lg transition-colors"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8faff',
                  }}
                >
                  <option value="cashier">Cashier</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="accountant">Accountant</option>
                  <option value="stockkeeper">Stock Manager</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm sm:text-base mb-2" style={{ color: 'rgba(248, 250, 255, 0.8)' }}>
                  Commission Rate (%)
                </label>
                <div className="relative">
                  <DollarSign
                    className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: 'rgba(255, 255, 255, 0.4)' }}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={newEmployee.commission}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, commission: parseFloat(e.target.value) })
                    }
                    className="w-full ps-9 pe-4 py-2 sm:py-3 rounded-lg transition-colors"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f8faff',
                    }}
                    required
                  />
                </div>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8faff',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 sm:py-3 rounded-lg transition-colors text-sm sm:text-base"
                  style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none' }}
                >
                  Add Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Team Member Modal */}
      <InviteTeamMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={() => {
          setShowInviteModal(false);
        }}
      />
    </Layout>
  );
}
