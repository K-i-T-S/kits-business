import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  MapPin, 
  Plus, 
  Edit, 
  Trash2, 
  Settings,
  Users,
  Package,
  TrendingUp,
  Phone,
  Mail,
  Globe,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import Layout from '../Layout';

interface Location {
  id: string;
  name: string;
  code: string;
  type: 'store' | 'warehouse' | 'office' | 'pop-up' | 'online';
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
  };
  contact: {
    phone: string;
    email: string;
    manager: string;
  };
  status: 'active' | 'inactive' | 'maintenance';
  created_at: string;
  metrics: {
    total_sales: number;
    total_inventory: number;
    total_customers: number;
    total_staff: number;
  };
}

interface InventoryTransfer {
  id: string;
  from_location_id: string;
  to_location_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  created_at: string;
  estimated_arrival?: string;
}

interface LocationStaff {
  id: string;
  location_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
  is_active: boolean;
}

export default function MultiLocationSupport() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [staff, setStaff] = useState<LocationStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateLocationOpen, setIsCreateLocationOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  const [newLocation, setNewLocation] = useState({
    name: '',
    code: '',
    type: 'store' as Location['type'],
    address: {
      street: '',
      city: '',
      state: '',
      country: '',
      postal_code: ''
    },
    contact: {
      phone: '',
      email: '',
      manager: ''
    }
  });

  const [newTransfer, setNewTransfer] = useState({
    from_location_id: '',
    to_location_id: '',
    product_id: '',
    product_name: '',
    quantity: 1
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Mock data for demonstration
      const mockLocations: Location[] = [
        {
          id: '1',
          name: 'Main Store Downtown',
          code: 'MS001',
          type: 'store',
          address: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            country: 'USA',
            postal_code: '10001'
          },
          contact: {
            phone: '+1-555-0101',
            email: 'main@store.com',
            manager: 'John Smith'
          },
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
          metrics: {
            total_sales: 150000,
            total_inventory: 5000,
            total_customers: 1200,
            total_staff: 15
          }
        },
        {
          id: '2',
          name: 'Central Warehouse',
          code: 'WH001',
          type: 'warehouse',
          address: {
            street: '456 Industrial Ave',
            city: 'New York',
            state: 'NY',
            country: 'USA',
            postal_code: '10002'
          },
          contact: {
            phone: '+1-555-0102',
            email: 'warehouse@store.com',
            manager: 'Sarah Johnson'
          },
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
          metrics: {
            total_sales: 0,
            total_inventory: 25000,
            total_customers: 0,
            total_staff: 8
          }
        },
        {
          id: '3',
          name: 'West Side Branch',
          code: 'WS001',
          type: 'store',
          address: {
            street: '789 Oak St',
            city: 'Los Angeles',
            state: 'CA',
            country: 'USA',
            postal_code: '90001'
          },
          contact: {
            phone: '+1-555-0103',
            email: 'west@store.com',
            manager: 'Mike Davis'
          },
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
          metrics: {
            total_sales: 85000,
            total_inventory: 3000,
            total_customers: 800,
            total_staff: 10
          }
        }
      ];

      const mockTransfers: InventoryTransfer[] = [
        {
          id: '1',
          from_location_id: '2',
          to_location_id: '1',
          product_id: 'PROD001',
          product_name: 'Premium Widget',
          quantity: 100,
          status: 'in_transit',
          created_at: '2024-01-15T10:00:00Z',
          estimated_arrival: '2024-01-16T14:00:00Z'
        },
        {
          id: '2',
          from_location_id: '2',
          to_location_id: '3',
          product_id: 'PROD002',
          product_name: 'Standard Widget',
          quantity: 50,
          status: 'completed',
          created_at: '2024-01-14T09:00:00Z'
        }
      ];

      const mockStaff: LocationStaff[] = [
        {
          id: '1',
          location_id: '1',
          user_id: 'U001',
          user_name: 'Alice Brown',
          user_email: 'alice@store.com',
          role: 'Store Manager',
          is_active: true
        },
        {
          id: '2',
          location_id: '1',
          user_id: 'U002',
          user_name: 'Bob Wilson',
          user_email: 'bob@store.com',
          role: 'Sales Associate',
          is_active: true
        },
        {
          id: '3',
          location_id: '2',
          user_id: 'U003',
          user_name: 'Charlie Davis',
          user_email: 'charlie@store.com',
          role: 'Warehouse Manager',
          is_active: true
        }
      ];

      setLocations(mockLocations);
      setTransfers(mockTransfers);
      setStaff(mockStaff);
    } catch (error) {
      toast.error('Failed to load location data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLocation = async () => {
    if (!newLocation.name || !newLocation.code || !newLocation.address.city) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const createdLocation: Location = {
        id: Date.now().toString(),
        ...newLocation,
        status: 'active',
        created_at: new Date().toISOString(),
        metrics: {
          total_sales: 0,
          total_inventory: 0,
          total_customers: 0,
          total_staff: 0
        }
      };

      setLocations([...locations, createdLocation]);
      setNewLocation({
        name: '',
        code: '',
        type: 'store',
        address: {
          street: '',
          city: '',
          state: '',
          country: '',
          postal_code: ''
        },
        contact: {
          phone: '',
          email: '',
          manager: ''
        }
      });
      setIsCreateLocationOpen(false);
      toast.success('Location created successfully');
    } catch (error) {
      toast.error('Failed to create location');
    }
  };

  const handleCreateTransfer = async () => {
    if (!newTransfer.from_location_id || !newTransfer.to_location_id || !newTransfer.product_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (newTransfer.from_location_id === newTransfer.to_location_id) {
      toast.error('Source and destination locations must be different');
      return;
    }

    try {
      const createdTransfer: InventoryTransfer = {
        id: Date.now().toString(),
        ...newTransfer,
        product_id: Date.now().toString(),
        status: 'pending',
        created_at: new Date().toISOString(),
        estimated_arrival: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      setTransfers([...transfers, createdTransfer]);
      setNewTransfer({
        from_location_id: '',
        to_location_id: '',
        product_id: '',
        product_name: '',
        quantity: 1
      });
      setIsTransferOpen(false);
      toast.success('Transfer created successfully');
    } catch (error) {
      toast.error('Failed to create transfer');
    }
  };

  const handleToggleLocationStatus = async (locationId: string) => {
    try {
      setLocations(locations.map(location => 
        location.id === locationId 
          ? { ...location, status: location.status === 'active' ? 'inactive' : 'active' }
          : location
      ));
      toast.success('Location status updated');
    } catch (error) {
      toast.error('Failed to update location status');
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    try {
      setLocations(locations.filter(location => location.id !== locationId));
      toast.success('Location deleted successfully');
    } catch (error) {
      toast.error('Failed to delete location');
    }
  };

  const getLocationTypeIcon = (type: string) => {
    switch (type) {
      case 'store':
        return <Package className="h-4 w-4" />;
      case 'warehouse':
        return <Globe className="h-4 w-4" />;
      case 'office':
        return <Users className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'maintenance':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTransferStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in_transit':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

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
      <div className="space-y-10">
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 sm:p-8 text-white">
          <Sparkles className="pointer-events-none absolute right-8 top-6 h-16 w-16 text-white/20" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="stat-chip bg-white/10 text-white/80">Multi-Location Management</p>
              <h1 className="mt-3 text-3xl font-semibold">
                Multi-Location Support
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                Manage multiple business locations, track inventory across sites, and coordinate operations between branches.
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Transfer Inventory
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Inventory Transfer</DialogTitle>
                    <DialogDescription>
                      Transfer inventory between locations
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="fromLocation">From Location</Label>
                        <Select value={newTransfer.from_location_id} onValueChange={(value) => 
                          setNewTransfer({ ...newTransfer, from_location_id: value })
                        }>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source location" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map((location) => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="toLocation">To Location</Label>
                        <Select value={newTransfer.to_location_id} onValueChange={(value) => 
                          setNewTransfer({ ...newTransfer, to_location_id: value })
                        }>
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination location" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map((location) => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="productName">Product Name</Label>
                      <Input
                        id="productName"
                        value={newTransfer.product_name}
                        onChange={(e) => setNewTransfer({ ...newTransfer, product_name: e.target.value })}
                        placeholder="Enter product name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={newTransfer.quantity}
                        onChange={(e) => setNewTransfer({ ...newTransfer, quantity: parseInt(e.target.value) || 1 })}
                        placeholder="Enter quantity"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsTransferOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateTransfer}>Create Transfer</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isCreateLocationOpen} onOpenChange={setIsCreateLocationOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-white text-slate-900 hover:bg-white/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Location
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Location</DialogTitle>
                    <DialogDescription>
                      Add a new business location to your enterprise
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="locationName">Location Name</Label>
                        <Input
                          id="locationName"
                          value={newLocation.name}
                          onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                          placeholder="Enter location name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="locationCode">Location Code</Label>
                        <Input
                          id="locationCode"
                          value={newLocation.code}
                          onChange={(e) => setNewLocation({ ...newLocation, code: e.target.value })}
                          placeholder="Enter location code"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="locationType">Location Type</Label>
                      <Select value={newLocation.type} onValueChange={(value: Location['type']) => 
                        setNewLocation({ ...newLocation, type: value })
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="Select location type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="store">Store</SelectItem>
                          <SelectItem value="warehouse">Warehouse</SelectItem>
                          <SelectItem value="office">Office</SelectItem>
                          <SelectItem value="pop-up">Pop-up Store</SelectItem>
                          <SelectItem value="online">Online</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Address</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          placeholder="Street"
                          value={newLocation.address.street}
                          onChange={(e) => setNewLocation({
                            ...newLocation,
                            address: { ...newLocation.address, street: e.target.value }
                          })}
                        />
                        <Input
                          placeholder="City"
                          value={newLocation.address.city}
                          onChange={(e) => setNewLocation({
                            ...newLocation,
                            address: { ...newLocation.address, city: e.target.value }
                          })}
                        />
                        <Input
                          placeholder="State"
                          value={newLocation.address.state}
                          onChange={(e) => setNewLocation({
                            ...newLocation,
                            address: { ...newLocation.address, state: e.target.value }
                          })}
                        />
                        <Input
                          placeholder="Postal Code"
                          value={newLocation.address.postal_code}
                          onChange={(e) => setNewLocation({
                            ...newLocation,
                            address: { ...newLocation.address, postal_code: e.target.value }
                          })}
                        />
                      </div>
                      <Input
                        placeholder="Country"
                        value={newLocation.address.country}
                        onChange={(e) => setNewLocation({
                          ...newLocation,
                          address: { ...newLocation.address, country: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Information</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          placeholder="Phone"
                          value={newLocation.contact.phone}
                          onChange={(e) => setNewLocation({
                            ...newLocation,
                            contact: { ...newLocation.contact, phone: e.target.value }
                          })}
                        />
                        <Input
                          placeholder="Email"
                          type="email"
                          value={newLocation.contact.email}
                          onChange={(e) => setNewLocation({
                            ...newLocation,
                            contact: { ...newLocation.contact, email: e.target.value }
                          })}
                        />
                      </div>
                      <Input
                        placeholder="Manager Name"
                        value={newLocation.contact.manager}
                        onChange={(e) => setNewLocation({
                          ...newLocation,
                          contact: { ...newLocation.contact, manager: e.target.value }
                        })}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsCreateLocationOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateLocation}>Add Location</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </section>

        <Tabs defaultValue="locations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
          </TabsList>

          <TabsContent value="locations" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {locations.map((location) => (
                <Card key={location.id} className="glass-panel">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getLocationTypeIcon(location.type)}
                        <CardTitle className="text-lg">{location.name}</CardTitle>
                        <Badge variant="outline">{location.code}</Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(location.status)}
                        <Switch
                          checked={location.status === 'active'}
                          onCheckedChange={() => handleToggleLocationStatus(location.id)}
                        />
                      </div>
                    </div>
                    <CardDescription className="capitalize">{location.type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{location.address.city}, {location.address.state}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{location.contact.phone}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{location.contact.manager}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                        <div className="text-center">
                          <div className="text-lg font-semibold">{location.metrics.total_staff}</div>
                          <div className="text-xs text-muted-foreground">Staff</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold">{location.metrics.total_inventory.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">Inventory</div>
                        </div>
                      </div>
                      <div className="flex space-x-2 pt-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteLocation(location.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="transfers" className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => {
                  const fromLocation = locations.find(l => l.id === transfer.from_location_id);
                  const toLocation = locations.find(l => l.id === transfer.to_location_id);
                  
                  return (
                    <TableRow key={transfer.id}>
                      <TableCell className="font-medium">{transfer.product_name}</TableCell>
                      <TableCell>{fromLocation?.name || 'Unknown'}</TableCell>
                      <TableCell>{toLocation?.name || 'Unknown'}</TableCell>
                      <TableCell>{transfer.quantity}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getTransferStatusIcon(transfer.status)}
                          <span className="capitalize">{transfer.status.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(transfer.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="staff" className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((staffMember) => {
                  const location = locations.find(l => l.id === staffMember.location_id);
                  
                  return (
                    <TableRow key={staffMember.id}>
                      <TableCell className="font-medium">{staffMember.user_name}</TableCell>
                      <TableCell>{staffMember.user_email}</TableCell>
                      <TableCell>{location?.name || 'Unknown'}</TableCell>
                      <TableCell>{staffMember.role}</TableCell>
                      <TableCell>
                        <Badge variant={staffMember.is_active ? "default" : "secondary"}>
                          {staffMember.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
