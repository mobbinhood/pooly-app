'use client';

import { Modal } from './modal';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  variant = 'danger',
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onClose();
  };

  const btnClass = variant === 'danger'
    ? 'bg-[#EF4444] hover:bg-red-600 text-white'
    : 'bg-[#F59E0B] hover:bg-amber-600 text-white';

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="text-center">
        <div className="w-12 h-12 bg-[#EF4444]/8 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-[#EF4444]" />
        </div>
        <p className="text-[#64748B] text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 border border-[#E2E8F0] rounded-lg font-medium text-[#1A1A2E] hover:bg-[#F8FAFC] transition text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm ${btnClass}`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
