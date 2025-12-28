import { Shield, Users, Settings, Plus, Edit, Trash2, Key, Lock, CheckCircle, XCircle, AlertTriangle, UserPlus, Sparkles } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

import Layout from '../Layout';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  is_active: boolean;
  created_at: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  roles: Role[];
}

export default function RolesAndPermissionsManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [isAssignRoleOpen, setIsAssignRoleOpen] = useState(false);

  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  const [roleAssignment, setRoleAssignment] = useState({
    userId: '',
    roleId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Mock data for demonstration
      const mockPermissions: Permission[] = [
        { id: '1', name: 'products.read', description: 'View products', resource: 'products', action: 'read' },
        { id: '2', name: 'products.create', description: 'Create products', resource: 'products', action: 'create' },
        { id: '3', name: 'products.update', description: 'Update products', resource: 'products', action: 'update' },
        { id: '4', name: 'products.delete', description: 'Delete products', resource: 'products', action: 'delete' },
        { id: '5', name: 'sales.read', description: 'View sales', resource: 'sales', action: 'read' },
        { id: '6', name: 'sales.create', description: 'Create sales', resource: 'sales', action: 'create' },
        { id: '7', name: 'customers.read', description: 'View customers', resource: 'customers', action: 'read' },
        { id: '8', name: 'customers.create', description: 'Create customers', resource: 'customers', action: 'create' },
        { id: '9', name: 'inventory.read', description: 'View inventory', resource: 'inventory', action: 'read' },
        { id: '10', name: 'inventory.update', description: 'Update inventory', resource: 'inventory', action: 'update' },
        { id: '11', name: 'locations.read', description: 'View locations', resource: 'locations', action: 'read' },
        { id: '12', name: 'locations.create', description: 'Create locations', resource: 'locations', action: 'create' },
        { id: '13', name: 'reports.view', description: 'View reports', resource: 'reports', action: 'view' },
        { id: '14', name: 'api.admin', description: 'Admin API access', resource: 'api', action: 'admin' },
      ];

      const mockRoles: Role[] = [
        {
          id: '1',
          name: 'Super Admin',
          description: 'Full system access',
          permissions: mockPermissions.map(p => p.id),
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Manager',
          description: 'Business management access',
          permissions: ['1', '2', '3', '5', '6', '7', '8', '9', '10', '13'],
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: '3',
          name: 'Cashier',
          description: 'Point of sale access',
          permissions: ['1', '5', '6', '7', '8'],
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const mockUsers: User[] = [
        {
          id: '1',
          email: 'admin@example.com',
          name: 'Admin User',
          roles: [mockRoles[0]!],
        },
        {
          id: '2',
          email: 'manager@example.com',
          name: 'Manager User',
          roles: [mockRoles[1]!],
        },
        {
          id: '3',
          email: 'cashier@example.com',
          name: 'Cashier User',
          roles: [mockRoles[2]!],
        },
      ];

      setPermissions(mockPermissions);
      setRoles(mockRoles);
      setUsers(mockUsers);
    } catch (error) {
      toast.error('Failed to load roles and permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRole.name || newRole.permissions.length === 0) {
      toast.error('Please provide role name and select permissions');
      return;
    }

    try {
      const createdRole: Role = {
        id: Date.now().toString(),
        ...newRole,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      setRoles([...roles, createdRole]);
      setNewRole({ name: '', description: '', permissions: [] });
      setIsCreateRoleOpen(false);
      toast.success('Role created successfully');
    } catch (error) {
      toast.error('Failed to create role');
    }
  };

  const handleAssignRole = async () => {
    if (!roleAssignment.userId || !roleAssignment.roleId) {
      toast.error('Please select user and role');
      return;
    }

    try {
      const role = roles.find(r => r.id === roleAssignment.roleId);
      const user = users.find(u => u.id === roleAssignment.userId);

      if (role && user) {
        const updatedUsers = users.map(u =>
          u.id === roleAssignment.userId
            ? { ...u, roles: [...u.roles.filter(r => r.id !== role!.id), role!] }
            : u,
        );
        setUsers(updatedUsers);
        setRoleAssignment({ userId: '', roleId: '' });
        setIsAssignRoleOpen(false);
        toast.success('Role assigned successfully');
      }
    } catch (error) {
      toast.error('Failed to assign role');
    }
  };

  const handleToggleRole = async (roleId: string) => {
    try {
      setRoles(roles.map(role =>
        role.id === roleId ? { ...role, is_active: !role.is_active } : role,
      ));
      toast.success('Role status updated');
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      setRoles(roles.filter(role => role.id !== roleId));
      toast.success('Role deleted successfully');
    } catch (error) {
      toast.error('Failed to delete role');
    }
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = [];
    }
    acc[permission.resource]!.push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-10 pb-20 lg:pb-0">
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 sm:p-8 text-white">
          <Sparkles className="pointer-events-none absolute right-8 top-6 h-16 w-16 text-white/20" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="stat-chip bg-white/10 text-white/80">Security Management</p>
              <h1 className="mt-3 text-3xl font-semibold">
                Roles & Permissions
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                Manage user roles, permissions, and access control. Configure granular permissions for enterprise security.
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isAssignRoleOpen} onOpenChange={setIsAssignRoleOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign Role
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Role to User</DialogTitle>
                    <DialogDescription>
                      Assign a role to a user
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="user">User</Label>
                      <Select value={roleAssignment.userId} onValueChange={(value) =>
                        setRoleAssignment({ ...roleAssignment, userId: value })
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="role">Role</Label>
                      <Select value={roleAssignment.roleId} onValueChange={(value) =>
                        setRoleAssignment({ ...roleAssignment, roleId: value })
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsAssignRoleOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAssignRole}>Assign Role</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isCreateRoleOpen} onOpenChange={setIsCreateRoleOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-white text-slate-900 hover:bg-white/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Role
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New Role</DialogTitle>
                    <DialogDescription>
                      Create a custom role with specific permissions
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="roleName">Role Name</Label>
                      <Input
                        id="roleName"
                        value={newRole.name}
                        onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                        placeholder="Enter role name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="roleDescription">Description</Label>
                      <Textarea
                        id="roleDescription"
                        value={newRole.description}
                        onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                        placeholder="Describe the role's purpose"
                      />
                    </div>
                    <div>
                      <Label>Permissions</Label>
                      <div className="space-y-3 max-h-48 overflow-y-auto">
                        {Object.entries(groupedPermissions).map(([resource, perms]) => (
                          <div key={resource}>
                            <h4 className="font-medium capitalize mb-2">{resource}</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {perms.map((permission) => (
                                <div key={permission.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={permission.id}
                                    checked={newRole.permissions.includes(permission.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setNewRole({
                                          ...newRole,
                                          permissions: [...newRole.permissions, permission.id],
                                        });
                                      } else {
                                        setNewRole({
                                          ...newRole,
                                          permissions: newRole.permissions.filter(p => p !== permission.id),
                                        });
                                      }
                                    }}
                                  />
                                  <Label htmlFor={permission.id} className="text-sm">
                                    {permission.action}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsCreateRoleOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateRole}>Create Role</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </section>

        <Tabs defaultValue="roles" className="space-y-4">
          <TabsList>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="space-y-4">
            <div className="grid gap-4">
              {roles.map((role) => (
                <Card key={role.id} className="glass-panel">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Shield className="h-5 w-5" />
                        <CardTitle>{role.name}</CardTitle>
                        <Badge variant={role.is_active ? 'default' : 'secondary'}>
                          {role.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={role.is_active}
                          onCheckedChange={() => handleToggleRole(role.id)}
                        />
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRole(role.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{role.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        {role.permissions.length} permissions
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.slice(0, 5).map((permissionId) => {
                          const permission = permissions.find(p => p.id === permissionId);
                          return permission ? (
                            <Badge key={permissionId} variant="outline" className="text-xs">
                              {permission.name}
                            </Badge>
                          ) : null;
                        })}
                        {role.permissions.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{role.permissions.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <div className="grid gap-4">
              {Object.entries(groupedPermissions).map(([resource, perms]) => (
                <Card key={resource} className="glass-panel">
                  <CardHeader>
                    <CardTitle className="capitalize">{resource}</CardTitle>
                    <CardDescription>Permissions for {resource}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2">
                      {perms.map((permission) => (
                        <div key={permission.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <span className="font-medium">{permission.name}</span>
                            <span className="text-muted-foreground ml-2">{permission.description}</span>
                          </div>
                          <Badge variant="outline">{permission.action}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge key={role.id} variant="outline">
                            {role.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
