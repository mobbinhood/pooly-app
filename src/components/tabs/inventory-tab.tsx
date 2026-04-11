'use client';

import { useState } from 'react';
import { useChemicalInventory, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem, useDeductInventory } from '@/lib/hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inventoryItemSchema, type InventoryItemInput } from '@/lib/validations';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Plus, Package, Loader2, Minus, RotateCcw, Trash2, AlertTriangle, Edit2 } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export function InventoryTab({ orgId }: { orgId: string }) {
  const { data: inventory, isLoading } = useChemicalInventory(orgId);
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const deleteItem = useDeleteInventoryItem();
  const deductItem = useDeductInventory();

  const [showForm, setShowForm] = useState(false);
  const [deductTarget, setDeductTarget] = useState<{ id: string; name: string; qty: number } | null>(null);
  const [deductAmount, setDeductAmount] = useState('');
  const [restockTarget, setRestockTarget] = useState<{ id: string; name: string; qty: number } | null>(null);
  const [restockAmount, setRestockAmount] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; chemical_name: string; reorder_threshold: number | null } | null>(null);
  const [editThreshold, setEditThreshold] = useState('');

  const lowStockItems = inventory?.filter(i => i.reorder_threshold && i.quantity_on_hand <= i.reorder_threshold) ?? [];
  const totalItems = inventory?.length ?? 0;
  const healthyPct = totalItems > 0 ? Math.round(((totalItems - lowStockItems.length) / totalItems) * 100) : 100;

  if (isLoading) return <ListSkeleton rows={5} />;

  const handleDeduct = () => {
    if (!deductTarget || !deductAmount) return;
    const amt = parseFloat(deductAmount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    deductItem.mutate({ id: deductTarget.id, amount: amt });
    setDeductTarget(null);
    setDeductAmount('');
  };

  const handleRestock = () => {
    if (!restockTarget || !restockAmount) return;
    const amt = parseFloat(restockAmount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    updateItem.mutate({
      id: restockTarget.id,
      quantity_on_hand: restockTarget.qty + amt,
      last_restocked_at: new Date().toISOString(),
    });
    setRestockTarget(null);
    setRestockAmount('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#1A1A2E]">Chemical Inventory</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[#0066FF] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-[#0052CC] transition"
        >
          <Plus size={14} />
          Add Chemical
        </button>
      </div>

      {/* Summary Stats */}
      {(inventory?.length ?? 0) > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 border border-[#E2E8F0]">
            <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Total Items</p>
            <p className="text-lg font-bold text-[#1A1A2E] mt-0.5">{inventory?.length ?? 0}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#E2E8F0]">
            <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Low Stock</p>
            <p className={`text-lg font-bold mt-0.5 ${lowStockItems.length > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
              {lowStockItems.length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#E2E8F0]">
            <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Stock Health</p>
            <p className={`text-lg font-bold mt-0.5 ${healthyPct >= 80 ? 'text-[#10B981]' : healthyPct >= 50 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
              {healthyPct}%
            </p>
          </div>
        </div>
      )}

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-[#F59E0B]" />
            <span className="text-sm font-medium text-[#F59E0B]">Low Stock Alert</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map(item => (
              <span key={item.id} className="text-xs bg-white/80 text-[#F59E0B] px-2 py-1 rounded-md font-medium">
                {item.chemical_name}: {item.quantity_on_hand} {item.unit}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {!inventory?.length ? (
        <EmptyState
          icon={Package}
          title="No chemicals tracked"
          description="Add chemicals to track your truck inventory"
          action={{ label: 'Add Chemical', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-3">
          {inventory.map((item, i) => {
            const isLow = item.reorder_threshold && item.quantity_on_hand <= item.reorder_threshold;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`bg-white rounded-xl border overflow-hidden ${isLow ? 'border-[#F59E0B]/30' : 'border-[#E2E8F0]'}`}
              >
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isLow ? 'bg-[#F59E0B]/8' : 'bg-[#0066FF]/8'}`}>
                    <Package size={16} className={isLow ? 'text-[#F59E0B]' : 'text-[#0066FF]'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1A1A2E] text-sm">{item.chemical_name}</p>
                    <p className="text-xs text-[#64748B]">
                      <span className={`font-semibold ${isLow ? 'text-[#F59E0B]' : 'text-[#1A1A2E]'}`}>
                        {item.quantity_on_hand}
                      </span> {item.unit}
                      {item.reorder_threshold ? ` · Reorder at ${item.reorder_threshold}` : ''}
                      {item.last_restocked_at && (
                        <> · Restocked {new Date(item.last_restocked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditTarget({ id: item.id, chemical_name: item.chemical_name, reorder_threshold: item.reorder_threshold });
                        setEditThreshold(item.reorder_threshold?.toString() ?? '');
                      }}
                      className="p-1.5 hover:bg-[#0066FF]/5 rounded-lg text-[#94A3B8] hover:text-[#0066FF] transition"
                      title="Edit threshold"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeductTarget({ id: item.id, name: item.chemical_name, qty: item.quantity_on_hand })}
                      className="p-1.5 hover:bg-[#F59E0B]/5 rounded-lg text-[#94A3B8] hover:text-[#F59E0B] transition"
                      title="Use / deduct"
                    >
                      <Minus size={14} />
                    </button>
                    <button
                      onClick={() => setRestockTarget({ id: item.id, name: item.chemical_name, qty: item.quantity_on_hand })}
                      className="p-1.5 hover:bg-[#10B981]/5 rounded-lg text-[#94A3B8] hover:text-[#10B981] transition"
                      title="Restock"
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(item.id)}
                      className="p-1.5 hover:bg-[#EF4444]/5 rounded-lg text-[#94A3B8] hover:text-[#EF4444] transition"
                      title="Remove"
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

      {/* Add Chemical Form */}
      {showForm && (
        <AddChemicalModal
          open={showForm}
          onClose={() => setShowForm(false)}
          orgId={orgId}
          onCreate={createItem.mutateAsync}
          isSubmitting={createItem.isPending}
        />
      )}

      {/* Deduct Modal */}
      <Modal open={!!deductTarget} onClose={() => setDeductTarget(null)} title={`Use ${deductTarget?.name ?? ''}`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-[#64748B]">Current: {deductTarget?.qty}</p>
          <input
            type="number"
            step="0.1"
            value={deductAmount}
            onChange={(e) => setDeductAmount(e.target.value)}
            placeholder="Amount to deduct"
            className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
          />
          <button
            onClick={handleDeduct}
            className="w-full py-2.5 bg-[#F59E0B] text-white rounded-lg font-medium text-sm hover:bg-amber-600 transition"
          >
            Deduct
          </button>
        </div>
      </Modal>

      {/* Restock Modal */}
      <Modal open={!!restockTarget} onClose={() => setRestockTarget(null)} title={`Restock ${restockTarget?.name ?? ''}`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-[#64748B]">Current: {restockTarget?.qty}</p>
          <input
            type="number"
            step="0.1"
            value={restockAmount}
            onChange={(e) => setRestockAmount(e.target.value)}
            placeholder="Amount to add"
            className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
          />
          <button
            onClick={handleRestock}
            className="w-full py-2.5 bg-[#10B981] text-white rounded-lg font-medium text-sm hover:bg-emerald-600 transition"
          >
            Restock
          </button>
        </div>
      </Modal>

      {/* Edit Threshold Modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit ${editTarget?.chemical_name ?? ''}`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Reorder Threshold</label>
            <input
              type="number"
              step="0.1"
              value={editThreshold}
              onChange={(e) => setEditThreshold(e.target.value)}
              placeholder="Alert when below..."
              className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition"
            />
          </div>
          <button
            onClick={() => {
              if (!editTarget) return;
              const val = editThreshold ? parseFloat(editThreshold) : null;
              updateItem.mutate({ id: editTarget.id, reorder_threshold: val });
              setEditTarget(null);
              setEditThreshold('');
              toast.success('Threshold updated');
            }}
            className="w-full py-2.5 bg-[#0066FF] text-white rounded-lg font-medium text-sm hover:bg-[#0052CC] transition"
          >
            Save
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget ? deleteItem.mutateAsync(deleteTarget) : Promise.resolve()}
        title="Remove Chemical"
        message="Remove this chemical from your inventory?"
      />
    </div>
  );
}

function AddChemicalModal({
  open, onClose, orgId, onCreate, isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  onCreate: (input: any) => Promise<unknown>;
  isSubmitting: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<InventoryItemInput>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: { unit: 'lbs', quantity_on_hand: 0 },
  });

  const COMMON_CHEMICALS = [
    'Chlorine (Liquid)', 'Chlorine (Tablets)', 'Muriatic Acid', 'Sodium Bicarbonate',
    'Cyanuric Acid (CYA)', 'Calcium Chloride', 'Algaecide', 'Pool Shock',
    'Diatomaceous Earth', 'Salt', 'Phosphate Remover', 'Clarifier',
  ];

  const onSubmit = async (data: InventoryItemInput) => {
    await onCreate({ ...data, organization_id: orgId });
    onClose();
  };

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  return (
    <Modal open={open} onClose={onClose} title="Add Chemical" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Chemical Name</label>
          <input {...register('chemical_name')} className={inputClass} placeholder="e.g., Chlorine Tablets" list="chemicals" />
          <datalist id="chemicals">
            {COMMON_CHEMICALS.map(c => <option key={c} value={c} />)}
          </datalist>
          {errors.chemical_name && <p className="text-[#EF4444] text-xs mt-1">{errors.chemical_name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Quantity</label>
            <input {...register('quantity_on_hand', { valueAsNumber: true })} type="number" step="0.1" className={inputClass} />
            {errors.quantity_on_hand && <p className="text-[#EF4444] text-xs mt-1">{errors.quantity_on_hand.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1.5">Unit</label>
            <select {...register('unit')} className={inputClass}>
              <option value="lbs">lbs</option>
              <option value="oz">oz</option>
              <option value="gal">gal</option>
              <option value="L">L</option>
              <option value="tablets">tablets</option>
              <option value="bags">bags</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Reorder Threshold</label>
          <input {...register('reorder_threshold', { valueAsNumber: true })} type="number" step="0.1" placeholder="Alert when below..." className={inputClass} />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 bg-[#0066FF] text-white rounded-lg font-medium text-sm hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          Add to Inventory
        </button>
      </form>
    </Modal>
  );
}
