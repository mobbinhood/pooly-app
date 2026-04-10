'use client';

import { useState } from 'react';
import { useWorkOrders, useCreateWorkOrder, useUpdateWorkOrder, useDeleteWorkOrder, useCustomers, useTechnicians } from '@/lib/hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { workOrderSchema, type WorkOrderInput } from '@/lib/validations';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Plus, Wrench, Loader2, ChevronDown, ChevronUp, Calendar, DollarSign, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const PRIORITY_COLORS = {
  low: { bg: 'bg-[#64748B]/8', text: 'text-[#64748B]' },
  normal: { bg: 'bg-[#0066FF]/8', text: 'text-[#0066FF]' },
  high: { bg: 'bg-[#F59E0B]/8', text: 'text-[#F59E0B]' },
  urgent: { bg: 'bg-[#EF4444]/8', text: 'text-[#EF4444]' },
};

const STATUS_CONFIG = {
  open: { icon: Clock, color: 'text-[#0066FF]', bg: 'bg-[#0066FF]/8', label: 'Open' },
  in_progress: { icon: Wrench, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/8', label: 'In Progress' },
  completed: { icon: CheckCircle2, color: 'text-[#10B981]', bg: 'bg-[#10B981]/8', label: 'Completed' },
  cancelled: { icon: XCircle, color: 'text-[#94A3B8]', bg: 'bg-[#94A3B8]/8', label: 'Cancelled' },
};

export function WorkOrdersTab({ orgId }: { orgId: string }) {
  const { data: workOrders, isLoading } = useWorkOrders(orgId);
  const createWorkOrder = useCreateWorkOrder();
  const updateWorkOrder = useUpdateWorkOrder();
  const deleteWorkOrder = useDeleteWorkOrder();
  const { data: customers } = useCustomers(orgId);
  const { data: technicians } = useTechnicians(orgId);

  const [showForm, setShowForm] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = workOrders?.filter(wo =>
    statusFilter === 'all' || wo.status === statusFilter
  );

  if (isLoading) return <ListSkeleton rows={5} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#1A1A2E]">Work Orders</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[#0066FF] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-[#0052CC] transition"
        >
          <Plus size={14} />
          New Order
        </button>
      </div>

      {/* Summary Stats */}
      {(workOrders?.length ?? 0) > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white rounded-xl p-3 border border-[#E2E8F0] text-center">
            <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Open</p>
            <p className="text-lg font-bold text-[#0066FF] mt-0.5">
              {workOrders?.filter(wo => wo.status === 'open').length ?? 0}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#E2E8F0] text-center">
            <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">In Progress</p>
            <p className="text-lg font-bold text-[#F59E0B] mt-0.5">
              {workOrders?.filter(wo => wo.status === 'in_progress').length ?? 0}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#E2E8F0] text-center">
            <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Done</p>
            <p className="text-lg font-bold text-[#10B981] mt-0.5">
              {workOrders?.filter(wo => wo.status === 'completed').length ?? 0}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#E2E8F0] text-center">
            <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Urgent</p>
            <p className={`text-lg font-bold mt-0.5 ${(workOrders?.filter(wo => wo.priority === 'urgent' && wo.status !== 'completed' && wo.status !== 'cancelled').length ?? 0) > 0 ? 'text-[#EF4444]' : 'text-[#94A3B8]'}`}>
              {workOrders?.filter(wo => wo.priority === 'urgent' && wo.status !== 'completed' && wo.status !== 'cancelled').length ?? 0}
            </p>
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['all', 'open', 'in_progress', 'completed', 'cancelled'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
              statusFilter === status
                ? 'bg-[#0066FF] text-white'
                : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
            }`}
          >
            {status === 'all' ? 'All' : status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {!filtered?.length ? (
        <EmptyState
          icon={Wrench}
          title="No work orders"
          description={statusFilter === 'all' ? 'Create a work order for repair jobs' : `No ${statusFilter.replace('_', ' ')} work orders`}
          action={{ label: 'Create Work Order', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((wo) => {
            const isExpanded = expandedOrder === wo.id;
            const statusCfg = STATUS_CONFIG[wo.status];
            const priorityCfg = PRIORITY_COLORS[wo.priority];
            const StatusIcon = statusCfg.icon;

            return (
              <motion.div key={wo.id} layout className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                <button
                  onClick={() => setExpandedOrder(isExpanded ? null : wo.id)}
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${statusCfg.bg}`}>
                    <StatusIcon size={16} className={statusCfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1A1A2E] text-sm truncate">{wo.title}</p>
                    <p className="text-xs text-[#64748B] truncate">
                      {wo.customers?.name}
                      {wo.scheduled_date && <> · {format(new Date(wo.scheduled_date), 'MMM d')}</>}
                    </p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priorityCfg.bg} ${priorityCfg.text}`}>
                    {wo.priority}
                  </span>
                  {isExpanded ? <ChevronUp size={14} className="text-[#94A3B8]" /> : <ChevronDown size={14} className="text-[#94A3B8]" />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-[#F1F5F9] px-4 py-3 space-y-3">
                        {wo.description && (
                          <p className="text-sm text-[#64748B]">{wo.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {wo.users?.name && (
                            <span className="text-xs bg-[#F1F5F9] text-[#64748B] px-2 py-1 rounded-md">
                              Assigned: {wo.users.name}
                            </span>
                          )}
                          {wo.estimated_cost_cents != null && (
                            <span className="text-xs bg-[#F1F5F9] text-[#64748B] px-2 py-1 rounded-md">
                              Est: ${(wo.estimated_cost_cents / 100).toFixed(0)}
                            </span>
                          )}
                          {wo.actual_cost_cents != null && (
                            <span className="text-xs bg-[#10B981]/8 text-[#10B981] px-2 py-1 rounded-md">
                              Actual: ${(wo.actual_cost_cents / 100).toFixed(0)}
                            </span>
                          )}
                        </div>
                        {wo.notes && (
                          <p className="text-xs text-[#94A3B8] italic">{wo.notes}</p>
                        )}

                        {/* Status Actions */}
                        <div className="flex gap-2 pt-1">
                          {wo.status === 'open' && (
                            <button
                              onClick={() => updateWorkOrder.mutate({ id: wo.id, status: 'in_progress' })}
                              className="flex-1 py-2 bg-[#F59E0B]/10 text-[#F59E0B] rounded-lg text-xs font-medium hover:bg-[#F59E0B]/20 transition"
                            >
                              Start Work
                            </button>
                          )}
                          {wo.status === 'in_progress' && (
                            <button
                              onClick={() => updateWorkOrder.mutate({ id: wo.id, status: 'completed', completed_date: new Date().toISOString().split('T')[0] })}
                              className="flex-1 py-2 bg-[#10B981]/10 text-[#10B981] rounded-lg text-xs font-medium hover:bg-[#10B981]/20 transition"
                            >
                              Mark Complete
                            </button>
                          )}
                          {(wo.status === 'open' || wo.status === 'in_progress') && (
                            <button
                              onClick={() => updateWorkOrder.mutate({ id: wo.id, status: 'cancelled' })}
                              className="py-2 px-3 bg-[#EF4444]/5 text-[#EF4444] rounded-lg text-xs font-medium hover:bg-[#EF4444]/10 transition"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(wo.id)}
                            className="py-2 px-3 bg-[#EF4444]/5 text-[#EF4444] rounded-lg text-xs font-medium hover:bg-[#EF4444]/10 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {showForm && (
        <WorkOrderFormModal
          open={showForm}
          onClose={() => setShowForm(false)}
          orgId={orgId}
          customers={customers ?? []}
          technicians={technicians ?? []}
          onCreate={createWorkOrder.mutateAsync as (input: Record<string, unknown>) => Promise<unknown>}
          isSubmitting={createWorkOrder.isPending}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget ? deleteWorkOrder.mutateAsync(deleteTarget) : Promise.resolve()}
        title="Delete Work Order"
        message="This will permanently delete this work order."
      />
    </div>
  );
}

function WorkOrderFormModal({
  open, onClose, orgId, customers, technicians, onCreate, isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  customers: { id: string; name: string }[];
  technicians: { id: string; name: string }[];
  onCreate: (input: Record<string, unknown>) => Promise<unknown>;
  isSubmitting: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<WorkOrderInput>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: { priority: 'normal' },
  });

  const onSubmit = async (data: WorkOrderInput) => {
    await onCreate({
      ...data,
      organization_id: orgId,
      estimated_cost_cents: data.estimated_cost_cents ? Math.round(data.estimated_cost_cents * 100) : undefined,
    });
    onClose();
  };

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  return (
    <Modal open={open} onClose={onClose} title="New Work Order" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Title</label>
          <input {...register('title')} className={inputClass} placeholder="e.g., Replace pool pump" />
          {errors.title && <p className="text-[#EF4444] text-xs mt-1">{errors.title.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Customer</label>
          <select {...register('customer_id')} className={inputClass}>
            <option value="">Select customer...</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {errors.customer_id && <p className="text-[#EF4444] text-xs mt-1">{errors.customer_id.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Priority</label>
            <select {...register('priority')} className={inputClass}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Assigned To</label>
            <select {...register('assigned_to')} className={inputClass}>
              <option value="">Unassigned</option>
              {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Scheduled Date</label>
            <input {...register('scheduled_date')} type="date" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Estimated Cost ($)</label>
            <input {...register('estimated_cost_cents', { valueAsNumber: true })} type="number" step="0.01" placeholder="0.00" className={inputClass} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Description</label>
          <textarea {...register('description')} rows={3} className={`${inputClass} resize-none`} placeholder="Details about the repair..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Notes</label>
          <textarea {...register('notes')} rows={2} className={`${inputClass} resize-none`} placeholder="Internal notes..." />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 bg-[#0066FF] text-white rounded-lg font-medium text-sm hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          Create Work Order
        </button>
      </form>
    </Modal>
  );
}
