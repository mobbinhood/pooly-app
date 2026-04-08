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
import { Plus, Search, Users, Phone, Mail, MapPin, Edit2, Trash2, ChevronRight, X, Loader2, Droplets, Beaker, Calendar, UserPlus, Clock, ChevronDown, ChevronUp, Wrench, AlertCircle, CheckCircle2, Camera, MessageSquare, CalendarPlus, Key, Car, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Database } from '@/lib/supabase';

type Customer = Database['public']['Tables']['customers']['Row'];

export function CustomersTab({ orgId }: { orgId: string }) {
  const { data: customers, isLoading } = useCustomers(orgId);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const router = useRouter();

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
                  onClick={() => router.push(`/customer/${customer.id}`)}
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
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'equipment' | 'history'>('info');
  const [showPoolForm, setShowPoolForm] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
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

  // Get last service date for equipment
  const lastServiceDate = logs?.[0]?.service_date;
  const lastEquipmentStatus = logs?.[0]?.equipment_status as Record<string, string> | null;

  const detailTabs = [
    { id: 'info' as const, label: 'Info' },
    { id: 'history' as const, label: `History${logs?.length ? ` (${logs.length})` : ''}` },
    { id: 'equipment' as const, label: `Equipment${pools?.length ? ` (${pools.length})` : ''}` },
  ];

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#1A1A2E] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  const equipmentStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-[#10B981]/10 text-[#10B981]';
      case 'needs_cleaning': case 'needs_attention': return 'bg-[#F59E0B]/10 text-[#F59E0B]';
      case 'not_working': return 'bg-[#EF4444]/10 text-[#EF4444]';
      default: return 'bg-[#94A3B8]/10 text-[#94A3B8]';
    }
  };

  const equipmentStatusLabel = (status: string) => status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

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

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2">
          {customer.phone && (
            <a href={`tel:${customer.phone}`} className="flex flex-col items-center gap-1.5 p-3 bg-[#10B981]/5 rounded-lg hover:bg-[#10B981]/10 transition">
              <Phone size={16} className="text-[#10B981]" />
              <span className="text-[10px] font-medium text-[#10B981]">Call</span>
            </a>
          )}
          {customer.email && (
            <a href={`mailto:${customer.email}`} className="flex flex-col items-center gap-1.5 p-3 bg-[#0066FF]/5 rounded-lg hover:bg-[#0066FF]/10 transition">
              <Mail size={16} className="text-[#0066FF]" />
              <span className="text-[10px] font-medium text-[#0066FF]">Email</span>
            </a>
          )}
          <button onClick={() => onEdit(customer)} className="flex flex-col items-center gap-1.5 p-3 bg-[#F59E0B]/5 rounded-lg hover:bg-[#F59E0B]/10 transition">
            <Edit2 size={16} className="text-[#F59E0B]" />
            <span className="text-[10px] font-medium text-[#F59E0B]">Edit</span>
          </button>
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
                <div className="flex items-center gap-2.5 p-3.5 bg-[#F8FAFC] rounded-lg">
                  <div className="w-8 h-8 bg-[#0066FF]/8 rounded-lg flex items-center justify-center shrink-0">
                    <Mail size={14} className="text-[#0066FF]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Email</p>
                    <p className="text-sm text-[#1A1A2E] truncate">{customer.email}</p>
                  </div>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2.5 p-3.5 bg-[#F8FAFC] rounded-lg">
                  <div className="w-8 h-8 bg-[#10B981]/8 rounded-lg flex items-center justify-center shrink-0">
                    <Phone size={14} className="text-[#10B981]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Phone</p>
                    <p className="text-sm text-[#1A1A2E]">{customer.phone}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3.5 bg-[#F8FAFC] rounded-lg">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#0066FF]/8 rounded-lg flex items-center justify-center shrink-0">
                  <MapPin size={14} className="text-[#0066FF]" />
                </div>
                <div>
                  <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Address</p>
                  <p className="text-sm text-[#1A1A2E]">{customer.address}, {customer.city}, {customer.state} {customer.zip}</p>
                </div>
              </div>
            </div>

            {/* Access Details */}
            {(customer.gate_code || customer.access_notes || customer.parking_info) && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-[#64748B]">Access Details</p>
                {customer.gate_code && (
                  <div className="flex items-center gap-2.5 p-3 bg-[#F8FAFC] rounded-lg">
                    <Key size={14} className="text-[#64748B] shrink-0" />
                    <div>
                      <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Gate Code</p>
                      <p className="text-sm text-[#1A1A2E] font-mono">{customer.gate_code}</p>
                    </div>
                  </div>
                )}
                {customer.access_notes && (
                  <div className="flex items-start gap-2.5 p-3 bg-[#F8FAFC] rounded-lg">
                    <FileText size={14} className="text-[#64748B] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Access Notes</p>
                      <p className="text-sm text-[#1A1A2E]">{customer.access_notes}</p>
                    </div>
                  </div>
                )}
                {customer.parking_info && (
                  <div className="flex items-start gap-2.5 p-3 bg-[#F8FAFC] rounded-lg">
                    <Car size={14} className="text-[#64748B] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Parking</p>
                      <p className="text-sm text-[#1A1A2E]">{customer.parking_info}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pool Summary */}
            {pools && pools.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-[#64748B]">Pools</p>
                {pools.map(pool => (
                  <div key={pool.id} className="flex items-center gap-2.5 p-3 bg-[#F8FAFC] rounded-lg">
                    <Droplets size={14} className="text-[#0066FF] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#1A1A2E] capitalize">{pool.type.replace('_', ' ')}</p>
                      <p className="text-xs text-[#94A3B8]">
                        {pool.size_gallons ? `${pool.size_gallons.toLocaleString()} gal` : 'Size unknown'}
                        {pool.surface_type && ` · ${pool.surface_type}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Customer Since + Last Service */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#F8FAFC] rounded-lg text-center">
                <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Customer Since</p>
                <p className="text-sm font-medium text-[#1A1A2E] mt-0.5">{format(new Date(customer.created_at), 'MMM yyyy')}</p>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded-lg text-center">
                <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Last Service</p>
                <p className="text-sm font-medium text-[#1A1A2E] mt-0.5">
                  {lastServiceDate ? format(new Date(lastServiceDate), 'MMM d, yyyy') : 'None'}
                </p>
              </div>
            </div>

            <button
              onClick={() => onDelete(customer)}
              className="w-full py-2.5 flex items-center justify-center gap-2 border border-[#EF4444]/20 rounded-lg text-[#EF4444] font-medium hover:bg-[#EF4444]/5 transition text-sm"
            >
              <Trash2 size={14} />
              Delete Customer
            </button>
          </div>
        )}

        {/* History Tab - Service Timeline */}
        {activeDetailTab === 'history' && (
          <div className="space-y-3">
            {logs && logs.length > 0 ? (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[18px] top-4 bottom-4 w-px bg-[#E2E8F0]" />
                <div className="space-y-3">
                  {logs.map((log) => {
                    const isExpanded = expandedLog === log.id;
                    const equipStatus = log.equipment_status as Record<string, string> | null;
                    const chemicals = log.chemicals_added as Array<{ chemical: string; amount: number; unit: string }> | null;
                    return (
                      <div key={log.id} className="relative pl-10">
                        {/* Timeline dot */}
                        <div className="absolute left-[14px] top-3.5 w-2.5 h-2.5 rounded-full bg-[#0066FF] border-2 border-white ring-2 ring-[#0066FF]/20 z-10" />
                        <div
                          onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                          className="bg-[#F8FAFC] rounded-lg p-3.5 cursor-pointer hover:bg-[#F1F5F9] transition"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-[#1A1A2E]">
                                {format(new Date(log.service_date), 'MMM d, yyyy')}
                              </p>
                              {log.users?.name && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-[#0066FF]/8 text-[#0066FF] rounded-full">{log.users.name}</span>
                              )}
                            </div>
                            {isExpanded ? <ChevronUp size={14} className="text-[#94A3B8]" /> : <ChevronDown size={14} className="text-[#94A3B8]" />}
                          </div>
                          {/* Chemical Readings Badges */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
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
                            {log.time_on_site_minutes != null && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#64748B]/10 text-[#64748B] font-medium flex items-center gap-0.5">
                                <Clock size={8} />{log.time_on_site_minutes}m
                              </span>
                            )}
                          </div>

                          {/* Expanded Details */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 pt-3 border-t border-[#E2E8F0] space-y-3">
                                  {/* Full Readings */}
                                  <div>
                                    <p className="text-[10px] text-[#94A3B8] font-medium uppercase mb-1.5">Water Chemistry</p>
                                    <div className="grid grid-cols-3 gap-2">
                                      {log.ph_level != null && (
                                        <div className="text-center p-2 bg-white rounded-md">
                                          <p className="text-[10px] text-[#94A3B8]">pH</p>
                                          <p className="text-sm font-semibold text-[#1A1A2E]">{log.ph_level}</p>
                                        </div>
                                      )}
                                      {log.chlorine_level != null && (
                                        <div className="text-center p-2 bg-white rounded-md">
                                          <p className="text-[10px] text-[#94A3B8]">Chlorine</p>
                                          <p className="text-sm font-semibold text-[#1A1A2E]">{log.chlorine_level}</p>
                                        </div>
                                      )}
                                      {log.alkalinity != null && (
                                        <div className="text-center p-2 bg-white rounded-md">
                                          <p className="text-[10px] text-[#94A3B8]">Alkalinity</p>
                                          <p className="text-sm font-semibold text-[#1A1A2E]">{log.alkalinity}</p>
                                        </div>
                                      )}
                                      {log.cya != null && (
                                        <div className="text-center p-2 bg-white rounded-md">
                                          <p className="text-[10px] text-[#94A3B8]">CYA</p>
                                          <p className="text-sm font-semibold text-[#1A1A2E]">{log.cya}</p>
                                        </div>
                                      )}
                                      {log.calcium != null && (
                                        <div className="text-center p-2 bg-white rounded-md">
                                          <p className="text-[10px] text-[#94A3B8]">Calcium</p>
                                          <p className="text-sm font-semibold text-[#1A1A2E]">{log.calcium}</p>
                                        </div>
                                      )}
                                      {log.salt_level != null && (
                                        <div className="text-center p-2 bg-white rounded-md">
                                          <p className="text-[10px] text-[#94A3B8]">Salt</p>
                                          <p className="text-sm font-semibold text-[#1A1A2E]">{log.salt_level}</p>
                                        </div>
                                      )}
                                      {log.water_temp != null && (
                                        <div className="text-center p-2 bg-white rounded-md">
                                          <p className="text-[10px] text-[#94A3B8]">Temp</p>
                                          <p className="text-sm font-semibold text-[#1A1A2E]">{log.water_temp}°</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Equipment Status */}
                                  {equipStatus && Object.keys(equipStatus).length > 0 && (
                                    <div>
                                      <p className="text-[10px] text-[#94A3B8] font-medium uppercase mb-1.5">Equipment Status</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(equipStatus).map(([key, val]) => (
                                          <span key={key} className={`text-[10px] px-2 py-1 rounded-full font-medium capitalize ${equipmentStatusColor(val)}`}>
                                            {key.replace('_', ' ')}: {equipmentStatusLabel(val)}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Chemicals Added */}
                                  {chemicals && chemicals.length > 0 && (
                                    <div>
                                      <p className="text-[10px] text-[#94A3B8] font-medium uppercase mb-1.5">Chemicals Added</p>
                                      <div className="space-y-1">
                                        {chemicals.map((c, i) => (
                                          <div key={i} className="flex items-center gap-2 text-sm text-[#1A1A2E]">
                                            <Beaker size={12} className="text-[#64748B]" />
                                            <span>{c.chemical} - {c.amount} {c.unit}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Notes */}
                                  {log.notes && (
                                    <div>
                                      <p className="text-[10px] text-[#94A3B8] font-medium uppercase mb-1">Notes</p>
                                      <div className="flex items-start gap-2">
                                        <MessageSquare size={12} className="text-[#64748B] shrink-0 mt-0.5" />
                                        <p className="text-sm text-[#1A1A2E]">{log.notes}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Photos */}
                                  {log.photos && log.photos.length > 0 && (
                                    <div>
                                      <p className="text-[10px] text-[#94A3B8] font-medium uppercase mb-1.5 flex items-center gap-1">
                                        <Camera size={10} /> {log.photos.length} Photo{log.photos.length > 1 ? 's' : ''}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-10 h-10 text-[#CBD5E1] mx-auto mb-3" />
                <p className="text-[#64748B] text-sm font-medium">No service history yet</p>
                <p className="text-[#94A3B8] text-xs mt-1">Service visits will appear here as a timeline</p>
              </div>
            )}
          </div>
        )}

        {/* Equipment Tab */}
        {activeDetailTab === 'equipment' && (
          <div className="space-y-3">
            {pools && pools.length > 0 ? (
              pools.map((pool) => (
                <div key={pool.id} className="bg-[#F8FAFC] rounded-lg p-4 space-y-3">
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

                  {/* Equipment Items */}
                  <div className="space-y-2 ml-12">
                    {pool.has_pump && (
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-lg">
                        <div className="flex items-center gap-2">
                          <Wrench size={12} className="text-[#64748B]" />
                          <div>
                            <p className="text-sm text-[#1A1A2E]">Pump</p>
                            {lastEquipmentStatus?.pump && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${equipmentStatusColor(lastEquipmentStatus.pump)}`}>
                                {equipmentStatusLabel(lastEquipmentStatus.pump)}
                              </span>
                            )}
                          </div>
                        </div>
                        {lastServiceDate && (
                          <p className="text-[10px] text-[#94A3B8]">Last: {format(new Date(lastServiceDate), 'MMM d')}</p>
                        )}
                      </div>
                    )}
                    {pool.has_filter && (
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-lg">
                        <div className="flex items-center gap-2">
                          <Wrench size={12} className="text-[#64748B]" />
                          <div>
                            <p className="text-sm text-[#1A1A2E]">Filter{pool.filter_type ? ` (${pool.filter_type})` : ''}</p>
                            {lastEquipmentStatus?.filter && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${equipmentStatusColor(lastEquipmentStatus.filter)}`}>
                                {equipmentStatusLabel(lastEquipmentStatus.filter)}
                              </span>
                            )}
                          </div>
                        </div>
                        {lastServiceDate && (
                          <p className="text-[10px] text-[#94A3B8]">Last: {format(new Date(lastServiceDate), 'MMM d')}</p>
                        )}
                      </div>
                    )}
                    {pool.has_heater && (
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-lg">
                        <div className="flex items-center gap-2">
                          <Wrench size={12} className="text-[#64748B]" />
                          <div>
                            <p className="text-sm text-[#1A1A2E]">Heater{pool.heater_type ? ` (${pool.heater_type})` : ''}</p>
                            {lastEquipmentStatus?.heater && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${equipmentStatusColor(lastEquipmentStatus.heater)}`}>
                                {equipmentStatusLabel(lastEquipmentStatus.heater)}
                              </span>
                            )}
                          </div>
                        </div>
                        {lastServiceDate && (
                          <p className="text-[10px] text-[#94A3B8]">Last: {format(new Date(lastServiceDate), 'MMM d')}</p>
                        )}
                      </div>
                    )}
                    {pool.has_cleaner && (
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-lg">
                        <div className="flex items-center gap-2">
                          <Wrench size={12} className="text-[#64748B]" />
                          <div>
                            <p className="text-sm text-[#1A1A2E]">Cleaner{pool.cleaner_type ? ` (${pool.cleaner_type})` : ''}</p>
                            {lastEquipmentStatus?.cleaner && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${equipmentStatusColor(lastEquipmentStatus.cleaner)}`}>
                                {equipmentStatusLabel(lastEquipmentStatus.cleaner)}
                              </span>
                            )}
                          </div>
                        </div>
                        {lastServiceDate && (
                          <p className="text-[10px] text-[#94A3B8]">Last: {format(new Date(lastServiceDate), 'MMM d')}</p>
                        )}
                      </div>
                    )}
                    {pool.has_salt_system && (
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-lg">
                        <div className="flex items-center gap-2">
                          <Wrench size={12} className="text-[#64748B]" />
                          <div>
                            <p className="text-sm text-[#1A1A2E]">Salt System{pool.salt_system_model ? ` (${pool.salt_system_model})` : ''}</p>
                            {lastEquipmentStatus?.salt_system && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${equipmentStatusColor(lastEquipmentStatus.salt_system)}`}>
                                {equipmentStatusLabel(lastEquipmentStatus.salt_system)}
                              </span>
                            )}
                          </div>
                        </div>
                        {lastServiceDate && (
                          <p className="text-[10px] text-[#94A3B8]">Last: {format(new Date(lastServiceDate), 'MMM d')}</p>
                        )}
                      </div>
                    )}
                    {!pool.has_pump && !pool.has_filter && !pool.has_heater && !pool.has_cleaner && !pool.has_salt_system && (
                      <p className="text-xs text-[#94A3B8] italic">No equipment tracked for this pool</p>
                    )}
                  </div>

                  {pool.equipment_notes && (
                    <div className="ml-12 flex items-start gap-2 p-2.5 bg-white rounded-lg">
                      <FileText size={12} className="text-[#64748B] shrink-0 mt-0.5" />
                      <p className="text-xs text-[#64748B]">{pool.equipment_notes}</p>
                    </div>
                  )}
                </div>
              ))
            ) : !showPoolForm ? (
              <div className="text-center py-6">
                <Wrench className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-[#64748B] text-sm">No pools or equipment yet</p>
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
      </div>
    </Modal>
  );
}
