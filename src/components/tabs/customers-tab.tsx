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
import { Plus, Search, Users, Phone, Mail, MapPin, Edit2, Trash2, ChevronRight, X, Loader2, Droplets, Beaker, Calendar, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import Link from 'next/link';
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
        <h2 className="text-xl font-bold text-[#1A1A2E]">Customers</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreate}
            className="border border-[#E2E8F0] text-[#1A1A2E] px-3 py-2 rounded-lg flex items-center gap-1.5 text-sm font-medium hover:bg-[#F8FAFC] transition"
          >
            <Plus size={14} />
            Quick Add
          </button>
          <Link
            href="/onboarding"
            className="bg-[#0066FF] text-white px-3 py-2 rounded-lg flex items-center gap-1.5 text-sm font-medium hover:bg-[#0052CC] transition"
          >
            <UserPlus size={14} />
            Full Onboard
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" size={16} />
        <input
          type="text"
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]">
            <X size={14} />
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
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <AnimatePresence>
            {filtered.map((customer, i) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="border-b border-[#F1F5F9] last:border-0"
              >
                <div
                  onClick={() => setSelectedCustomer(customer)}
                  className="px-4 py-3.5 flex items-center gap-3 hover:bg-[#F8FAFC] transition cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-full bg-[#0066FF]/8 text-[#0066FF] flex items-center justify-center font-semibold text-sm shrink-0">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1A1A2E] text-sm truncate">{customer.name}</p>
                    <p className="text-xs text-[#94A3B8] truncate flex items-center gap-1">
                      <MapPin size={10} />
                      {customer.address}, {customer.city}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-[#CBD5E1] shrink-0" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <CustomerFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingCustomer(null); }}
        customer={editingCustomer}
        orgId={orgId}
        onCreate={createCustomer.mutateAsync}
        onUpdate={updateCustomer.mutateAsync}
        isSubmitting={createCustomer.isPending || updateCustomer.isPending}
      />

      <CustomerDetailSheet
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        onEdit={(c) => { setSelectedCustomer(null); openEdit(c); }}
        onDelete={(c) => { setSelectedCustomer(null); setDeleteTarget(c); }}
      />

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

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  return (
    <Modal open={open} onClose={onClose} title={customer ? 'Edit Customer' : 'New Customer'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Full Name</label>
          <input {...register('name')} className={inputClass} placeholder="John Smith" />
          {errors.name && <p className="text-[#EF4444] text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Email</label>
            <input {...register('email')} type="email" className={inputClass} placeholder="john@email.com" />
            {errors.email && <p className="text-[#EF4444] text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Phone</label>
            <input {...register('phone')} type="tel" className={inputClass} placeholder="(555) 123-4567" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Address</label>
          <input {...register('address')} className={inputClass} placeholder="123 Main St" />
          {errors.address && <p className="text-[#EF4444] text-xs mt-1">{errors.address.message}</p>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">City</label>
            <input {...register('city')} className={inputClass} placeholder="Phoenix" />
            {errors.city && <p className="text-[#EF4444] text-xs mt-1">{errors.city.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">State</label>
            <input {...register('state')} className={inputClass} placeholder="AZ" />
            {errors.state && <p className="text-[#EF4444] text-xs mt-1">{errors.state.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">ZIP</label>
            <input {...register('zip')} className={inputClass} placeholder="85001" />
            {errors.zip && <p className="text-[#EF4444] text-xs mt-1">{errors.zip.message}</p>}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-lg font-medium text-[#1A1A2E] hover:bg-[#F8FAFC] transition text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-2.5 bg-[#0066FF] text-white rounded-lg font-medium hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            {customer ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

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

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#1A1A2E] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  return (
    <Modal open={!!customer} onClose={onClose} title={customer.name} size="lg">
      <div className="space-y-4">
        {/* Customer Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#0066FF] text-white flex items-center justify-center font-bold text-lg">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[#1A1A2E]">{customer.name}</h3>
            <p className="text-sm text-[#64748B] flex items-center gap-1">
              <MapPin size={12} />
              {customer.address}, {customer.city}, {customer.state}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-[#F1F5F9] rounded-lg p-1">
          {detailTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveDetailTab(tab.id)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition ${
                activeDetailTab === tab.id
                  ? 'bg-white text-[#1A1A2E] shadow-sm'
                  : 'text-[#64748B] hover:text-[#1A1A2E]'
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
                <a href={`mailto:${customer.email}`} className="flex items-center gap-2.5 p-3.5 bg-[#F8FAFC] rounded-lg hover:bg-[#F1F5F9] transition">
                  <div className="w-8 h-8 bg-[#0066FF]/8 rounded-lg flex items-center justify-center">
                    <Mail size={14} className="text-[#0066FF]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Email</p>
                    <p className="text-sm text-[#1A1A2E] truncate">{customer.email}</p>
                  </div>
                </a>
              )}
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-2.5 p-3.5 bg-[#F8FAFC] rounded-lg hover:bg-[#F1F5F9] transition">
                  <div className="w-8 h-8 bg-[#10B981]/8 rounded-lg flex items-center justify-center">
                    <Phone size={14} className="text-[#10B981]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Phone</p>
                    <p className="text-sm text-[#1A1A2E]">{customer.phone}</p>
                  </div>
                </a>
              )}
            </div>

            <div className="p-3.5 bg-[#F8FAFC] rounded-lg">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#0066FF]/8 rounded-lg flex items-center justify-center">
                  <MapPin size={14} className="text-[#0066FF]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Address</p>
                  <p className="text-sm text-[#1A1A2E]">{customer.address}, {customer.city}, {customer.state} {customer.zip}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => onEdit(customer)}
                className="flex-1 py-2.5 flex items-center justify-center gap-2 border border-[#E2E8F0] rounded-lg text-[#1A1A2E] font-medium hover:bg-[#F8FAFC] transition text-sm"
              >
                <Edit2 size={14} />
                Edit
              </button>
              <button
                onClick={() => onDelete(customer)}
                className="flex-1 py-2.5 flex items-center justify-center gap-2 border border-[#EF4444]/20 rounded-lg text-[#EF4444] font-medium hover:bg-[#EF4444]/5 transition text-sm"
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
                <div key={pool.id} className="bg-[#F8FAFC] rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#0066FF]/8 rounded-lg flex items-center justify-center">
                        <Droplets size={16} className="text-[#0066FF]" />
                      </div>
                      <div>
                        <p className="font-medium text-[#1A1A2E] capitalize text-sm">{pool.type.replace('_', ' ')}</p>
                        <p className="text-xs text-[#64748B]">
                          {pool.size_gallons ? `${pool.size_gallons.toLocaleString()} gal` : 'Size unknown'}
                          {pool.surface_type && ` · ${pool.surface_type}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDeletePoolTarget(pool.id)}
                      className="p-1.5 hover:bg-[#EF4444]/5 rounded-lg text-[#94A3B8] hover:text-[#EF4444] transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {pool.equipment_notes && (
                    <p className="text-xs text-[#64748B] mt-2 ml-12">{pool.equipment_notes}</p>
                  )}
                </div>
              ))
            ) : !showPoolForm ? (
              <div className="text-center py-6">
                <Droplets className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-[#64748B] text-sm">No pools added yet</p>
              </div>
            ) : null}

            {showPoolForm ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-[#F8FAFC] rounded-lg p-4 space-y-3"
              >
                <select value={poolType} onChange={(e) => setPoolType(e.target.value)} className={inputClass}>
                  <option value="inground">In-Ground</option>
                  <option value="above_ground">Above Ground</option>
                  <option value="spa">Spa / Hot Tub</option>
                  <option value="combo">Pool + Spa Combo</option>
                </select>
                <input value={poolSize} onChange={(e) => setPoolSize(e.target.value)} type="number" placeholder="Size (gallons)" className={inputClass} />
                <select value={surfaceType} onChange={(e) => setSurfaceType(e.target.value)} className={inputClass}>
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
                  className={`${inputClass} resize-none`}
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowPoolForm(false)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-lg text-sm font-medium text-[#1A1A2E] hover:bg-white transition">
                    Cancel
                  </button>
                  <button
                    onClick={handleAddPool}
                    disabled={createPool.isPending}
                    className="flex-1 py-2.5 bg-[#0066FF] text-white rounded-lg text-sm font-medium hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {createPool.isPending && <Loader2 size={14} className="animate-spin" />}
                    Add Pool
                  </button>
                </div>
              </motion.div>
            ) : (
              <button
                onClick={() => setShowPoolForm(true)}
                className="w-full py-2.5 border-2 border-dashed border-[#E2E8F0] rounded-lg text-sm text-[#64748B] hover:border-[#0066FF]/40 hover:text-[#0066FF] transition flex items-center justify-center gap-2"
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
                <div key={log.id} className="bg-[#F8FAFC] rounded-lg p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#0066FF]/8 text-[#0066FF] flex items-center justify-center shrink-0">
                    <Beaker size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#1A1A2E]">
                        {format(new Date(log.service_date), 'MMM d, yyyy')}
                      </p>
                      {log.users?.name && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#0066FF]/8 text-[#0066FF] rounded-full">{log.users.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {log.ph_level != null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          log.ph_level >= 7.2 && log.ph_level <= 7.8 ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#F59E0B]/10 text-[#F59E0B]'
                        }`}>pH {log.ph_level}</span>
                      )}
                      {log.chlorine_level != null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          log.chlorine_level >= 1.0 && log.chlorine_level <= 3.0 ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#F59E0B]/10 text-[#F59E0B]'
                        }`}>Cl {log.chlorine_level}</span>
                      )}
                      {log.alkalinity != null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          log.alkalinity >= 80 && log.alkalinity <= 120 ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#F59E0B]/10 text-[#F59E0B]'
                        }`}>Alk {log.alkalinity}</span>
                      )}
                    </div>
                    {log.notes && <p className="text-xs text-[#64748B] mt-1 truncate">{log.notes}</p>}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <Calendar className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-[#64748B] text-sm">No service history yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
