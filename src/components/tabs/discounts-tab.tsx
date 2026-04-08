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
        <h2 className="text-xl font-bold text-gray-900">Discounts</h2>
        <button
          onClick={() => { setEditingDiscount(null); setShowForm(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium hover:bg-blue-700 transition shadow-sm shadow-blue-600/20"
        >
          <Plus size={16} />
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
                className={`bg-white rounded-2xl p-4 shadow-sm border transition ${discount.active ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    discount.type === 'percentage' ? 'bg-purple-100 text-purple-600' :
                    discount.type === 'fixed' ? 'bg-green-100 text-green-600' :
                    'bg-orange-100 text-orange-600'
                  }`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{discount.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${discount.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {discount.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {discount.type === 'percentage' && `${discount.value}% off`}
                      {discount.type === 'fixed' && `$${discount.value} off`}
                      {discount.type === 'free_months' && `${discount.value} month${discount.value !== 1 ? 's' : ''} free`}
                      {' · '}{discount.duration_months} month{discount.duration_months !== 1 ? 's' : ''}
                    </p>
                    {discount.description && (
                      <p className="text-xs text-gray-400 mt-1">{discount.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(discount)}
                      className="p-1.5 hover:bg-gray-50 rounded-lg transition"
                      title={discount.active ? 'Deactivate' : 'Activate'}
                    >
                      {discount.active
                        ? <ToggleRight size={18} className="text-green-600" />
                        : <ToggleLeft size={18} className="text-gray-400" />
                      }
                    </button>
                    <button
                      onClick={() => { setEditingDiscount(discount); setShowForm(true); }}
                      className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-gray-600 transition"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(discount)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Discount Form Modal */}
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

  return (
    <Modal open={open} onClose={onClose} title={discount ? 'Edit Discount' : 'New Discount'} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
          <input {...register('name')} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="Summer Special" />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <input {...register('description')} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="Optional description" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(['percentage', 'fixed', 'free_months'] as const).map(t => (
              <label
                key={t}
                className={`flex flex-col items-center p-3 border-2 rounded-xl cursor-pointer transition ${
                  type === t ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input type="radio" {...register('type')} value={t} className="sr-only" />
                {t === 'percentage' && <Percent size={16} className="text-purple-600 mb-1" />}
                {t === 'fixed' && <DollarSign size={16} className="text-green-600 mb-1" />}
                {t === 'free_months' && <Gift size={16} className="text-orange-600 mb-1" />}
                <span className="text-xs font-medium text-gray-700">{TYPE_LABELS[t]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {type === 'percentage' ? 'Percentage' : type === 'fixed' ? 'Amount ($)' : 'Free Months'}
            </label>
            <input {...register('value', { valueAsNumber: true })} type="number" step="0.01" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
            {errors.value && <p className="text-red-500 text-xs mt-1">{errors.value.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration (months)</label>
            <input {...register('duration_months', { valueAsNumber: true })} type="number" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
            {errors.duration_months && <p className="text-red-500 text-xs mt-1">{errors.duration_months.message}</p>}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {discount ? 'Update' : 'Create'} Discount
        </button>
      </form>
    </Modal>
  );
}
