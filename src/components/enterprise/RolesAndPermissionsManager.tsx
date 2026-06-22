import { Shield, Users, CheckCircle, Sparkles } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import { supabase } from '../../utils/supabaseClient';
import Layout from '../Layout';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type EmployeeRole = 'owner' | 'manager' | 'cashier' | 'viewer';

interface Employee {
  id: string;
  name: string;
  email: string | null;
  role: EmployeeRole;
  is_active: boolean;
}

const ROLE_DESCRIPTIONS: Record<EmployeeRole, string> = {
  owner: 'Full access — manage settings, staff, financials',
  manager: 'Manage products, customers, sales, and reports',
  cashier: 'Process sales, view products and customers',
  viewer: 'Read-only access to all data',
};

const ROLE_COLORS: Record<EmployeeRole, string> = {
  owner: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  manager: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  cashier: 'bg-green-500/20 text-green-300 border-green-500/30',
  viewer: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

export default function RolesAndPermissionsManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('employees')
        .select('id, name, email, role, is_active')
        .order('name');

      if (error) throw error;

      setEmployees((data ?? []) as Employee[]);

      // Check if the current user is an owner by matching auth.uid to employee.user_id
      const { data: me } = await supabase
        .from('employees')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      setIsOwner(me?.role === 'owner');
    } catch (err) {
      toast.error('Failed to load employees');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const handleRoleChange = async (employeeId: string, newRole: EmployeeRole) => {
    if (!isOwner) {
      toast.error('Only owners can change roles');
      return;
    }
    setUpdatingId(employeeId);
    try {
      const { error } = await supabase
        .from('employees')
        .update({ role: newRole })
        .eq('id', employeeId);

      if (error) throw error;

      setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, role: newRole } : e));
      toast.success('Role updated');
    } catch (err) {
      toast.error('Failed to update role');
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-10 pb-4 lg:pb-6">
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 sm:p-8 text-white">
          <Sparkles className="pointer-events-none absolute right-8 top-6 h-16 w-16 text-white/20" />
          <div className="relative">
            <p className="stat-chip bg-white/10 text-white/80">Security Management</p>
            <h1 className="mt-3 text-3xl font-semibold">Roles & Permissions</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Manage your team's access levels. Only owners can change employee roles.
            </p>
          </div>
        </section>

        {/* Role Reference */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(ROLE_DESCRIPTIONS) as [EmployeeRole, string][]).map(([role, desc]) => (
            <div key={role} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-white/60" />
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ROLE_COLORS[role]} capitalize`}>
                  {role}
                </span>
              </div>
              <p className="text-xs text-white/60">{desc}</p>
            </div>
          ))}
        </section>

        {/* Employees Table */}
        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            <CardDescription className="text-white/60">
              {employees.length} employee{employees.length !== 1 ? 's' : ''} •{' '}
              {isOwner ? 'You can change roles' : 'Contact an owner to change roles'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {employees.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto h-10 w-10 text-white/30 mb-3" />
                <p className="text-white/60">No employees found</p>
                <p className="text-sm text-white/40 mt-1">Add employees from the Employees page</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-white/60">Name</TableHead>
                    <TableHead className="text-white/60">Email</TableHead>
                    <TableHead className="text-white/60">Status</TableHead>
                    <TableHead className="text-white/60">Role</TableHead>
                    {isOwner && <TableHead className="text-white/60">Change Role</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id} className="border-white/10">
                      <TableCell className="font-medium text-white">{employee.name}</TableCell>
                      <TableCell className="text-white/70">{employee.email ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className={`h-3 w-3 ${employee.is_active ? 'text-green-400' : 'text-white/30'}`} />
                          <span className="text-sm text-white/70">{employee.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${ROLE_COLORS[employee.role]}`}>
                          {employee.role}
                        </span>
                      </TableCell>
                      {isOwner && (
                        <TableCell>
                          <Select
                            value={employee.role}
                            onValueChange={(val) => handleRoleChange(employee.id, val as EmployeeRole)}
                            disabled={updatingId === employee.id}
                          >
                            <SelectTrigger className="w-32 h-8 border-white/20 bg-white/5 text-white text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="cashier">Cashier</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {!isOwner && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
            You need the <strong>owner</strong> role to modify team permissions. Contact your account owner.
          </div>
        )}
      </div>
    </Layout>
  );
}
