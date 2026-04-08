'use client';

import { useState } from 'react';
import { useDiscounts, useCreateDiscount, useUpdateDiscount, useDeleteDiscount } from '@/lib/hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { discountSchema, type DiscountInput } from '@/lib/validations';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Plus, Tag, Percent, DollarSign, Gift, Edit2, Trash2, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Database } from '@/lib/supabase';

type Discount = Database['public']['Tables']['discounts']['Row'];

const TYPE_ICONS = {
  percentage: Percent,
  fixed: DollarSign,
  free_months: Gift,
};

const TYPE_LABELS = {
  percentage: 'Percentage Off',
  fixed: 'Fixed Amount',
  free_months: 'Free Months',
};

export function DiscountsTab({ orgId }: { orgId: string }) {
  const { data: discounts, isLoading } = useDiscounts(orgId);
  const createDiscount = useCreateDiscount();
  const updateDiscount = useUpdateDiscount();
  const deleteDiscount = useDeleteDiscount();

  const [showForm, setShowForm] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null);

  const toggleActive = (discount: Discount) => {
    updateDiscount.mutate({ id: discount.id, active: !discount.active });
  };

  if (isLoading) return <ListSkeleton rows={4} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#1A1A2E]">Discounts</h2>
        <button
          onClick={() => { setEditingDiscount(null); setShowForm(true); }}
          className="bg-[#0066FF] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-[#0052CC] transition"
        >
          <Plus size={14} />
          Create Discount
        </button>
      </div>

      {!discounts?.length ? (
        <EmptyState
          icon={Tag}
          title="No discounts yet"
          description="Create discount codes to attract new customers"
          action={{ label: 'Create Discount', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-3">
          {discounts.map((discount, i) => {
            const Icon = TYPE_ICONS[discount.type];
            return (
              <motion.div
                key={discount.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`bg-white rounded-xl p-4 border border-[#E2E8F0] transition ${!discount.active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#0066FF]/8">
                    <Icon size={16} className="text-[#0066FF]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[#1A1A2E] text-sm">{discount.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${discount.active ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
                        {discount.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {discount.type === 'percentage' && `${discount.value}% off`}
                      {discount.type === 'fixed' && `$${discount.value} off`}
                      {discount.type === 'free_months' && `${discount.value} month${discount.value !== 1 ? 's' : ''} free`}
                      {' · '}{discount.duration_months} month{discount.duration_months !== 1 ? 's' : ''}
                    </p>
                    {discount.description && (
                      <p className="text-xs text-[#94A3B8] mt-1">{discount.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleActive(discount)} className="p-1.5 hover:bg-[#F8FAFC] rounded-lg transition" title={discount.active ? 'Deactivate' : 'Activate'}>
                      {discount.active
                        ? <ToggleRight size={18} className="text-[#10B981]" />
                        : <ToggleLeft size={18} className="text-[#94A3B8]" />
                      }
                    </button>
                    <button onClick={() => { setEditingDiscount(discount); setShowForm(true); }} className="p-1.5 hover:bg-[#F8FAFC] rounded-lg text-[#94A3B8] hover:text-[#64748B] transition">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDeleteTarget(discount)} className="p-1.5 hover:bg-[#EF4444]/5 rounded-lg text-[#94A3B8] hover:text-[#EF4444] transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <DiscountFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingDiscount(null); }}
        discount={editingDiscount}
        orgId={orgId}
        onCreate={createDiscount.mutateAsync}
        onUpdate={updateDiscount.mutateAsync}
        isSubmitting={createDiscount.isPending || updateDiscount.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) await deleteDiscount.mutateAsync(deleteTarget.id); }}
        title="Delete Discount"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
      />
    </div>
  );
}

function DiscountFormModal({
  open, onClose, discount, orgId, onCreate, onUpdate, isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  discount: Discount | null;
  orgId: string;
  onCreate: (input: Database['public']['Tables']['discounts']['Insert']) => Promise<Discount>;
  onUpdate: (input: Database['public']['Tables']['discounts']['Update'] & { id: string }) => Promise<Discount>;
  isSubmitting: boolean;
}) {
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<DiscountInput>({
    resolver: zodResolver(discountSchema),
    values: discount ? {
      name: discount.name,
      description: discount.description || '',
      type: discount.type,
      value: discount.value,
      duration_months: discount.duration_months,
    } : { type: 'percentage', value: 0, duration_months: 1, name: '', description: '' },
  });

  const type = watch('type');

  const onSubmit = async (data: DiscountInput) => {
    if (discount) {
      await onUpdate({ id: discount.id, ...data });
    } else {
      await onCreate({ ...data, organization_id: orgId });
    }
    reset();
    onClose();
  };

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  return (
    <Modal open={open} onClose={onClose} title={discount ? 'Edit Discount' : 'New Discount'} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Name</label>
          <input {...register('name')} className={inputClass} placeholder="Summer Special" />
          {errors.name && <p className="text-[#EF4444] text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Description</label>
          <input {...register('description')} className={inputClass} placeholder="Optional description" />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(['percentage', 'fixed', 'free_months'] as const).map(t => (
              <label
                key={t}
                className={`flex flex-col items-center p-3 border-2 rounded-lg cursor-pointer transition ${
                  type === t ? 'border-[#0066FF] bg-[#0066FF]/5' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                }`}
              >
                <input type="radio" {...register('type')} value={t} className="sr-only" />
                {t === 'percentage' && <Percent size={16} className="text-[#0066FF] mb-1" />}
                {t === 'fixed' && <DollarSign size={16} className="text-[#0066FF] mb-1" />}
                {t === 'free_months' && <Gift size={16} className="text-[#0066FF] mb-1" />}
                <span className="text-xs font-medium text-[#1A1A2E]">{TYPE_LABELS[t]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">
              {type === 'percentage' ? 'Percentage' : type === 'fixed' ? 'Amount ($)' : 'Free Months'}
            </label>
            <input {...register('value', { valueAsNumber: true })} type="number" step="0.01" className={inputClass} />
            {errors.value && <p className="text-[#EF4444] text-xs mt-1">{errors.value.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Duration (months)</label>
            <input {...register('duration_months', { valueAsNumber: true })} type="number" className={inputClass} />
            {errors.duration_months && <p className="text-[#EF4444] text-xs mt-1">{errors.duration_months.message}</p>}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 bg-[#0066FF] text-white rounded-lg font-medium text-sm hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          {discount ? 'Update' : 'Create'} Discount
        </button>
      </form>
    </Modal>
  );
}
