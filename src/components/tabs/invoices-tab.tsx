'use client';

import { useState } from 'react';
import {
  useInvoices,
  useCreateInvoice,
  useUpdateInvoiceStatus,
  useDeleteInvoice,
  useNextInvoiceNumber,
  useCustomers,
} from '@/lib/hooks';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { invoiceSchema, type InvoiceInput } from '@/lib/validations';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import {
  Plus,
  FileText,
  DollarSign,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  ChevronRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { Database } from '@/lib/supabase';

type Invoice = Database['public']['Tables']['invoices']['Row'];
type InvoiceWithRelations = Invoice & {
  customers: { name: string; email: string | null };
  invoice_items: Database['public']['Tables']['invoice_items']['Row'][];
};

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-[#F1F5F9] text-[#64748B]', icon: FileText },
  sent: { label: 'Sent', color: 'bg-[#0066FF]/10 text-[#0066FF]', icon: Send },
  paid: { label: 'Paid', color: 'bg-[#10B981]/10 text-[#10B981]', icon: CheckCircle2 },
  overdue: { label: 'Overdue', color: 'bg-[#EF4444]/10 text-[#EF4444]', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-[#F1F5F9] text-[#94A3B8]', icon: XCircle },
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function InvoicesTab({ orgId }: { orgId: string }) {
  const { data: invoices, isLoading } = useInvoices(orgId);
  const updateStatus = useUpdateInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();

  const [showForm, setShowForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceWithRelations | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = invoices?.filter(inv =>
    statusFilter === 'all' || inv.status === statusFilter
  ) ?? [];

  const stats = {
    total: invoices?.length ?? 0,
    unpaid: invoices?.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total_cents, 0) ?? 0,
    paid: invoices?.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_cents, 0) ?? 0,
    overdue: invoices?.filter(i => i.status === 'overdue').length ?? 0,
  };

  if (isLoading) return <ListSkeleton rows={4} />;

  if (selectedInvoice) {
    return (
      <InvoiceDetail
        invoice={selectedInvoice}
        onBack={() => setSelectedInvoice(null)}
        onStatusChange={(status) => {
          updateStatus.mutate(
            {
              id: selectedInvoice.id,
              status,
              paid_at: status === 'paid' ? new Date().toISOString() : null,
            },
            {
              onSuccess: () => {
                setSelectedInvoice({ ...selectedInvoice, status: status as Invoice['status'] });
              },
            }
          );
        }}
        isUpdating={updateStatus.isPending}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#1A1A2E]">Invoices</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[#0066FF] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-[#0052CC] transition"
        >
          <Plus size={14} />
          New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 border border-[#E2E8F0]">
          <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Outstanding</p>
          <p className="text-lg font-bold text-[#1A1A2E] mt-0.5">{formatCents(stats.unpaid)}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-[#E2E8F0]">
          <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Collected</p>
          <p className="text-lg font-bold text-[#10B981] mt-0.5">{formatCents(stats.paid)}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-[#E2E8F0]">
          <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Overdue</p>
          <p className="text-lg font-bold text-[#EF4444] mt-0.5">{stats.overdue}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['all', 'draft', 'sent', 'paid', 'overdue'].map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
              statusFilter === f
                ? 'bg-[#0066FF] text-white'
                : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:border-[#CBD5E1]'
            }`}
          >
            {f === 'all' ? 'All' : STATUS_CONFIG[f as keyof typeof STATUS_CONFIG].label}
            {f !== 'all' && ` (${invoices?.filter(i => i.status === f).length ?? 0})`}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {!filtered.length ? (
        <EmptyState
          icon={FileText}
          title={statusFilter === 'all' ? 'No invoices yet' : `No ${statusFilter} invoices`}
          description="Create invoices from service logs or manually for one-time charges"
          action={statusFilter === 'all' ? { label: 'Create Invoice', onClick: () => setShowForm(true) } : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((invoice, i) => {
            const config = STATUS_CONFIG[invoice.status];
            const StatusIcon = config.icon;
            return (
              <motion.button
                key={invoice.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedInvoice(invoice)}
                className="w-full bg-white rounded-xl p-4 border border-[#E2E8F0] hover:border-[#CBD5E1] transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#0066FF]/8">
                    <DollarSign size={16} className="text-[#0066FF]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[#1A1A2E] text-sm truncate">{invoice.customers?.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 ${config.color}`}>
                        <StatusIcon size={10} />
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-[#64748B]">{invoice.invoice_number}</p>
                      <span className="text-[#CBD5E1]">·</span>
                      <p className="text-xs text-[#94A3B8]">{formatDate(invoice.issued_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[#1A1A2E] text-sm">{formatCents(invoice.total_cents)}</p>
                    <ChevronRight size={14} className="text-[#CBD5E1]" />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      <InvoiceFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        orgId={orgId}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await deleteInvoice.mutateAsync(deleteTarget.id);
        }}
        title="Delete Invoice"
        message={`Delete invoice ${deleteTarget?.invoice_number}? This cannot be undone.`}
      />
    </div>
  );
}

/* ─── Invoice Detail View ─── */
function InvoiceDetail({
  invoice,
  onBack,
  onStatusChange,
  isUpdating,
}: {
  invoice: InvoiceWithRelations;
  onBack: () => void;
  onStatusChange: (status: string) => void;
  isUpdating: boolean;
}) {
  const config = STATUS_CONFIG[invoice.status];
  const StatusIcon = config.icon;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[#64748B] text-sm hover:text-[#1A1A2E] transition">
        <ArrowLeft size={16} />
        Back to Invoices
      </button>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#F1F5F9]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-bold text-[#1A1A2E]">{invoice.invoice_number}</p>
              <p className="text-sm text-[#64748B] mt-0.5">{invoice.customers?.name}</p>
              {invoice.customers?.email && (
                <p className="text-xs text-[#94A3B8]">{invoice.customers.email}</p>
              )}
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${config.color}`}>
              <StatusIcon size={12} />
              {config.label}
            </span>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-[#64748B]">
            <div>
              <span className="text-[#94A3B8]">Issued:</span> {formatDate(invoice.issued_date)}
            </div>
            <div>
              <span className="text-[#94A3B8]">Due:</span> {formatDate(invoice.due_date)}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">
                <th className="pb-2">Description</th>
                <th className="pb-2 text-right">Qty</th>
                <th className="pb-2 text-right">Price</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="text-[#1A1A2E]">
              {invoice.invoice_items?.map(item => (
                <tr key={item.id} className="border-t border-[#F1F5F9]">
                  <td className="py-2.5">{item.description}</td>
                  <td className="py-2.5 text-right text-[#64748B]">{item.quantity}</td>
                  <td className="py-2.5 text-right text-[#64748B]">{formatCents(item.unit_price_cents)}</td>
                  <td className="py-2.5 text-right font-medium">{formatCents(item.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-[#E2E8F0] mt-2 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-[#64748B]">
              <span>Subtotal</span>
              <span>{formatCents(invoice.subtotal_cents)}</span>
            </div>
            {invoice.tax_cents > 0 && (
              <div className="flex justify-between text-sm text-[#64748B]">
                <span>Tax</span>
                <span>{formatCents(invoice.tax_cents)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-[#1A1A2E] pt-1">
              <span>Total</span>
              <span>{formatCents(invoice.total_cents)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="px-5 pb-5">
            <p className="text-xs text-[#94A3B8] font-medium mb-1">Notes</p>
            <p className="text-sm text-[#64748B]">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {invoice.status === 'draft' && (
          <button
            onClick={() => onStatusChange('sent')}
            disabled={isUpdating}
            className="flex-1 py-2.5 bg-[#0066FF] text-white rounded-lg font-medium text-sm hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Mark as Sent
          </button>
        )}
        {(invoice.status === 'sent' || invoice.status === 'overdue') && (
          <button
            onClick={() => onStatusChange('paid')}
            disabled={isUpdating}
            className="flex-1 py-2.5 bg-[#10B981] text-white rounded-lg font-medium text-sm hover:bg-[#059669] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Mark as Paid
          </button>
        )}
        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
          <button
            onClick={() => onStatusChange('cancelled')}
            disabled={isUpdating}
            className="py-2.5 px-4 bg-white border border-[#E2E8F0] text-[#64748B] rounded-lg font-medium text-sm hover:border-[#CBD5E1] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <XCircle size={14} />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Invoice Form Modal ─── */
function InvoiceFormModal({
  open,
  onClose,
  orgId,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  prefill?: {
    customer_id: string;
    service_log_id?: string;
    items?: { description: string; quantity: number; unit_price_cents: number }[];
  };
}) {
  const { data: customers } = useCustomers(orgId);
  const { data: invoiceNumber } = useNextInvoiceNumber(orgId);
  const createInvoice = useCreateInvoice();

  const today = new Date().toISOString().split('T')[0];
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<InvoiceInput>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customer_id: prefill?.customer_id || '',
      issued_date: today,
      due_date: thirtyDays,
      notes: '',
      items: prefill?.items || [{ description: '', quantity: 1, unit_price_cents: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');

  const subtotal = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price_cents || 0), 0);

  const onSubmit = async (data: InvoiceInput) => {
    const itemsForDb = data.items.map(item => ({
      invoice_id: '', // will be set by hook
      description: item.description,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      total_cents: item.quantity * item.unit_price_cents,
    }));

    await createInvoice.mutateAsync({
      invoice: {
        organization_id: orgId,
        customer_id: data.customer_id,
        service_log_id: prefill?.service_log_id || null,
        invoice_number: invoiceNumber || 'INV-0001',
        issued_date: data.issued_date,
        due_date: data.due_date,
        subtotal_cents: subtotal,
        tax_cents: 0,
        total_cents: subtotal,
        notes: data.notes || null,
      },
      items: itemsForDb,
    });

    reset();
    onClose();
  };

  const inputClass =
    'w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition';

  return (
    <Modal open={open} onClose={onClose} title="New Invoice" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Invoice Number */}
        <div className="flex items-center gap-2 bg-[#F8FAFC] rounded-lg px-3.5 py-2.5 border border-[#F1F5F9]">
          <FileText size={14} className="text-[#94A3B8]" />
          <span className="text-sm font-medium text-[#1A1A2E]">{invoiceNumber || 'INV-0001'}</span>
        </div>

        {/* Customer */}
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Customer</label>
          <select {...register('customer_id')} className={inputClass}>
            <option value="">Select customer...</option>
            {customers?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.customer_id && <p className="text-[#EF4444] text-xs mt-1">{errors.customer_id.message}</p>}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Issue Date</label>
            <input type="date" {...register('issued_date')} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Due Date</label>
            <input type="date" {...register('due_date')} className={inputClass} />
          </div>
        </div>

        {/* Line Items */}
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Line Items</label>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="bg-[#F8FAFC] rounded-lg p-3 border border-[#F1F5F9]">
                <div className="flex gap-2">
                  <input
                    {...register(`items.${index}.description`)}
                    placeholder="Description"
                    className="flex-1 px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#1A1A2E] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                  />
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-2 hover:bg-[#EF4444]/5 rounded-lg text-[#94A3B8] hover:text-[#EF4444] transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <label className="text-[10px] text-[#94A3B8]">Qty</label>
                    <input
                      type="number"
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                      min="1"
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-sm text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#94A3B8]">Unit Price (¢)</label>
                    <input
                      type="number"
                      {...register(`items.${index}.unit_price_cents`, { valueAsNumber: true })}
                      min="0"
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-sm text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#94A3B8]">Total</label>
                    <div className="px-2.5 py-1.5 bg-[#F1F5F9] rounded-lg text-sm text-center font-medium text-[#1A1A2E]">
                      {formatCents((items[index]?.quantity || 0) * (items[index]?.unit_price_cents || 0))}
                    </div>
                  </div>
                </div>
                {errors.items?.[index]?.description && (
                  <p className="text-[#EF4444] text-xs mt-1">{errors.items[index].description?.message}</p>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => append({ description: '', quantity: 1, unit_price_cents: 0 })}
            className="mt-2 w-full py-2 border border-dashed border-[#CBD5E1] rounded-lg text-xs font-medium text-[#64748B] hover:border-[#0066FF] hover:text-[#0066FF] transition flex items-center justify-center gap-1"
          >
            <Plus size={12} />
            Add Line Item
          </button>
          {errors.items?.message && <p className="text-[#EF4444] text-xs mt-1">{errors.items.message}</p>}
        </div>

        {/* Total */}
        <div className="bg-[#F8FAFC] rounded-lg p-3 border border-[#F1F5F9] flex justify-between items-center">
          <span className="text-sm font-medium text-[#64748B]">Total</span>
          <span className="text-lg font-bold text-[#1A1A2E]">{formatCents(subtotal)}</span>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Notes</label>
          <textarea
            {...register('notes')}
            rows={2}
            className={inputClass}
            placeholder="Payment terms, thank you message..."
          />
        </div>

        <button
          type="submit"
          disabled={createInvoice.isPending}
          className="w-full py-2.5 bg-[#0066FF] text-white rounded-lg font-medium text-sm hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {createInvoice.isPending && <Loader2 size={14} className="animate-spin" />}
          Create Invoice
        </button>
      </form>
    </Modal>
  );
}

export { InvoiceFormModal };
