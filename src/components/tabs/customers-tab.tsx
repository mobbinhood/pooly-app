'use client';

import { useState } from 'react';
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, usePools, useCreatePool, useDeletePool, useServiceLogs } from '@/lib/hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { customerSchema, type CustomerInput } from '@/lib/validations';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Plus, Search, Users, Phone, Mail, MapPin, Edit2, Trash2, ChevronRight, X, Loader2, Droplets, Beaker, Clock, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import type { Database } from '@/lib/supabase';

type Customer = Database['public']['Tables']['customers']['Row'];

export function CustomersTab({ orgId }: { orgId: string }) {
  const { data: customers, isLoading } = useCustomers(orgId);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const filtered = customers?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.address.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const openCreate = () => {
    setEditingCustomer(null);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Customers</h2>
        <button
          onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium hover:bg-blue-700 transition shadow-sm shadow-blue-600/20"
        >
          <Plus size={16} />
          Add New
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Customer List */}
      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'No results found' : 'No customers yet'}
          description={search ? 'Try a different search term' : 'Add your first customer to get started'}
          action={!search ? { label: 'Add Customer', onClick: openCreate } : undefined}
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <AnimatePresence>
            {filtered.map((customer, i) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="border-b border-gray-50 last:border-0"
              >
                <div
                  onClick={() => setSelectedCustomer(customer)}
                  className="px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50/50 transition cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{customer.name}</p>
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                      <MapPin size={10} />
                      {customer.address}, {customer.city}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Customer Form Modal */}
      <CustomerFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingCustomer(null); }}
        customer={editingCustomer}
        orgId={orgId}
        onCreate={createCustomer.mutateAsync}
        onUpdate={updateCustomer.mutateAsync}
        isSubmitting={createCustomer.isPending || updateCustomer.isPending}
      />

      {/* Customer Detail Sheet */}
      <CustomerDetailSheet
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        onEdit={(c) => { setSelectedCustomer(null); openEdit(c); }}
        onDelete={(c) => { setSelectedCustomer(null); setDeleteTarget(c); }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) await deleteCustomer.mutateAsync(deleteTarget.id); }}
        title="Delete Customer"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
      />
    </div>
  );
}

// Customer Form Modal
function CustomerFormModal({
  open, onClose, customer, orgId, onCreate, onUpdate, isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  orgId: string;
  onCreate: (input: Database['public']['Tables']['customers']['Insert']) => Promise<Customer>;
  onUpdate: (input: Database['public']['Tables']['customers']['Update'] & { id: string }) => Promise<Customer>;
  isSubmitting: boolean;
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    values: customer ? {
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address,
      city: customer.city,
      state: customer.state,
      zip: customer.zip,
    } : undefined,
  });

  const onSubmit = async (data: CustomerInput) => {
    if (customer) {
      await onUpdate({ id: customer.id, ...data });
    } else {
      await onCreate({ ...data, organization_id: orgId });
    }
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={customer ? 'Edit Customer' : 'New Customer'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
          <input {...register('name')} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="John Smith" />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input {...register('email')} type="email" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="john@email.com" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input {...register('phone')} type="tel" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="(555) 123-4567" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
          <input {...register('address')} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="123 Main St" />
          {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
            <input {...register('city')} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="Phoenix" />
            {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
            <input {...register('state')} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="AZ" />
            {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ZIP</label>
            <input {...register('zip')} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="85001" />
            {errors.zip && <p className="text-red-500 text-xs mt-1">{errors.zip.message}</p>}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {customer ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Customer Detail Bottom Sheet
function CustomerDetailSheet({
  customer, onClose, onEdit, onDelete,
}: {
  customer: Customer | null;
  onClose: () => void;
  onEdit: (c: Customer) => void;
  onDelete: (c: Customer) => void;
}) {
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'pools' | 'history'>('info');
  const [showPoolForm, setShowPoolForm] = useState(false);
  const { data: pools } = usePools(customer?.id);
  const { data: logs } = useServiceLogs(customer?.id);
  const createPool = useCreatePool();
  const deletePool = useDeletePool();
  const [deletePoolTarget, setDeletePoolTarget] = useState<string | null>(null);

  // Pool form state
  const [poolType, setPoolType] = useState('inground');
  const [poolSize, setPoolSize] = useState('');
  const [surfaceType, setSurfaceType] = useState('');
  const [equipmentNotes, setEquipmentNotes] = useState('');

  const handleAddPool = async () => {
    if (!customer) return;
    await createPool.mutateAsync({
      customer_id: customer.id,
      type: poolType,
      size_gallons: poolSize ? parseInt(poolSize) : null,
      surface_type: surfaceType || null,
      equipment_notes: equipmentNotes || null,
    });
    setShowPoolForm(false);
    setPoolType('inground');
    setPoolSize('');
    setSurfaceType('');
    setEquipmentNotes('');
  };

  if (!customer) return null;

  const detailTabs = [
    { id: 'info' as const, label: 'Info' },
    { id: 'pools' as const, label: `Pools${pools?.length ? ` (${pools.length})` : ''}` },
    { id: 'history' as const, label: 'History' },
  ];

  return (
    <Modal open={!!customer} onClose={onClose} title={customer.name} size="lg">
      <div className="space-y-4">
        {/* Customer Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{customer.name}</h3>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <MapPin size={12} />
              {customer.address}, {customer.city}, {customer.state}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {detailTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveDetailTab(tab.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                activeDetailTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Info Tab */}
        {activeDetailTab === 'info' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="flex items-center gap-2.5 p-3.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Mail size={14} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 font-medium uppercase">Email</p>
                    <p className="text-sm text-gray-700 truncate">{customer.email}</p>
                  </div>
                </a>
              )}
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-2.5 p-3.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Phone size={14} className="text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 font-medium uppercase">Phone</p>
                    <p className="text-sm text-gray-700">{customer.phone}</p>
                  </div>
                </a>
              )}
            </div>

            <div className="p-3.5 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <MapPin size={14} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-medium uppercase">Address</p>
                  <p className="text-sm text-gray-700">{customer.address}, {customer.city}, {customer.state} {customer.zip}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => onEdit(customer)}
                className="flex-1 py-2.5 flex items-center justify-center gap-2 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition text-sm"
              >
                <Edit2 size={14} />
                Edit
              </button>
              <button
                onClick={() => onDelete(customer)}
                className="flex-1 py-2.5 flex items-center justify-center gap-2 border border-red-200 rounded-xl text-red-600 font-medium hover:bg-red-50 transition text-sm"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Pools Tab */}
        {activeDetailTab === 'pools' && (
          <div className="space-y-3">
            {pools && pools.length > 0 ? (
              pools.map((pool) => (
                <div key={pool.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                        <Droplets size={18} className="text-cyan-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 capitalize">{pool.type.replace('_', ' ')}</p>
                        <p className="text-xs text-gray-500">
                          {pool.size_gallons ? `${pool.size_gallons.toLocaleString()} gal` : 'Size unknown'}
                          {pool.surface_type && ` · ${pool.surface_type}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDeletePoolTarget(pool.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {pool.equipment_notes && (
                    <p className="text-xs text-gray-500 mt-2 ml-13 pl-13">{pool.equipment_notes}</p>
                  )}
                </div>
              ))
            ) : !showPoolForm ? (
              <div className="text-center py-6">
                <Droplets className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No pools added yet</p>
              </div>
            ) : null}

            {showPoolForm ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-gray-50 rounded-xl p-4 space-y-3"
              >
                <select
                  value={poolType}
                  onChange={(e) => setPoolType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                >
                  <option value="inground">In-Ground</option>
                  <option value="above_ground">Above Ground</option>
                  <option value="spa">Spa / Hot Tub</option>
                  <option value="combo">Pool + Spa Combo</option>
                </select>
                <input
                  value={poolSize}
                  onChange={(e) => setPoolSize(e.target.value)}
                  type="number"
                  placeholder="Size (gallons)"
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <select
                  value={surfaceType}
                  onChange={(e) => setSurfaceType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                >
                  <option value="">Surface Type (optional)</option>
                  <option value="plaster">Plaster</option>
                  <option value="pebble">Pebble Tec</option>
                  <option value="vinyl">Vinyl</option>
                  <option value="fiberglass">Fiberglass</option>
                  <option value="tile">Tile</option>
                </select>
                <textarea
                  value={equipmentNotes}
                  onChange={(e) => setEquipmentNotes(e.target.value)}
                  placeholder="Equipment notes (pumps, filters, etc.)"
                  rows={2}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPoolForm(false)}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddPool}
                    disabled={createPool.isPending}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {createPool.isPending && <Loader2 size={14} className="animate-spin" />}
                    Add Pool
                  </button>
                </div>
              </motion.div>
            ) : (
              <button
                onClick={() => setShowPoolForm(true)}
                className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2"
              >
                <Plus size={14} />
                Add Pool
              </button>
            )}

            <ConfirmDialog
              open={!!deletePoolTarget}
              onClose={() => setDeletePoolTarget(null)}
              onConfirm={async () => {
                if (deletePoolTarget && customer) {
                  await deletePool.mutateAsync({ id: deletePoolTarget, customer_id: customer.id });
                }
              }}
              title="Remove Pool"
              message="Remove this pool from the customer?"
              confirmLabel="Remove"
            />
          </div>
        )}

        {/* History Tab */}
        {activeDetailTab === 'history' && (
          <div className="space-y-3">
            {logs && logs.length > 0 ? (
              logs.slice(0, 10).map((log) => (
                <div key={log.id} className="bg-gray-50 rounded-xl p-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center shrink-0">
                    <Beaker size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">
                        {format(new Date(log.service_date), 'MMM d, yyyy')}
                      </p>
                      {log.users?.name && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">{log.users.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {log.ph_level != null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          log.ph_level >= 7.2 && log.ph_level <= 7.8 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>pH {log.ph_level}</span>
                      )}
                      {log.chlorine_level != null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          log.chlorine_level >= 1.0 && log.chlorine_level <= 3.0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>Cl {log.chlorine_level}</span>
                      )}
                      {log.alkalinity != null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          log.alkalinity >= 80 && log.alkalinity <= 120 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>Alk {log.alkalinity}</span>
                      )}
                    </div>
                    {log.notes && <p className="text-xs text-gray-500 mt-1 truncate">{log.notes}</p>}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No service history yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
