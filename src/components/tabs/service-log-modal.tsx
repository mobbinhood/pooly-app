'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { serviceLogSchema, type ServiceLogInput } from '@/lib/validations';
import { useCreateServiceLog, useCustomers } from '@/lib/hooks';
import { Modal } from '@/components/ui/modal';
import { Droplets, Beaker, Loader2, Camera, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface ServiceLogModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  technicianId: string;
  preselectedCustomerId?: string;
}

export function ServiceLogModal({ open, onClose, orgId, technicianId, preselectedCustomerId }: ServiceLogModalProps) {
  const { data: customers } = useCustomers(orgId);
  const createLog = useCreateServiceLog();
  const supabase = createClient();
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [startTime] = useState(new Date());

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ServiceLogInput>({
    resolver: zodResolver(serviceLogSchema),
    defaultValues: {
      customer_id: preselectedCustomerId || '',
      service_date: new Date().toISOString().split('T')[0],
    },
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    const newPhotos: string[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `service-photos/${orgId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage.from('pool-photos').upload(path, file);
      if (error) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage.from('pool-photos').getPublicUrl(path);
      newPhotos.push(publicUrl);
    }

    setPhotos(prev => [...prev, ...newPhotos]);
    setUploading(false);
  };

  const onSubmit = async (data: ServiceLogInput) => {
    await createLog.mutateAsync({
      ...data,
      technician_id: technicianId,
      photos,
    });
    reset();
    setPhotos([]);
    onClose();
  };

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTime.getTime()) / 60000));
    }, 30000);
    return () => clearInterval(interval);
  }, [startTime]);

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  return (
    <Modal open={open} onClose={onClose} title="Log Service Visit" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Timer */}
        <div className="flex items-center gap-2 bg-[#0066FF]/5 rounded-lg p-3 border border-[#0066FF]/10">
          <Clock size={14} className="text-[#0066FF]" />
          <span className="text-sm text-[#0066FF] font-medium tabular-nums">Time on site: {elapsed} min</span>
        </div>

        {/* Customer Select */}
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

        {/* Date */}
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Service Date</label>
          <input {...register('service_date')} type="date" className={inputClass} />
        </div>

        {/* Chemical Readings */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Beaker size={14} className="text-[#0066FF]" />
            <span className="text-xs font-medium text-[#64748B]">Chemical Readings</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">pH Level</label>
              <input
                {...register('ph_level', { valueAsNumber: true })}
                type="number"
                step="0.1"
                placeholder="7.2-7.8"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">Chlorine</label>
              <input
                {...register('chlorine_level', { valueAsNumber: true })}
                type="number"
                step="0.1"
                placeholder="1.0-3.0"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">Alkalinity</label>
              <input
                {...register('alkalinity', { valueAsNumber: true })}
                type="number"
                placeholder="80-120"
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded-full font-medium">pH: 7.2-7.8</span>
            <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded-full font-medium">Cl: 1.0-3.0</span>
            <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded-full font-medium">Alk: 80-120</span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Notes</label>
          <textarea
            {...register('notes')}
            rows={3}
            placeholder="Service notes, issues found, chemicals added..."
            className={`${inputClass} resize-none`}
          />
        </div>

        {/* Photo Upload */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Camera size={14} className="text-[#64748B]" />
            <span className="text-xs font-medium text-[#64748B]">Photos</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {photos.map((url, i) => (
              <div key={i} className="w-14 h-14 rounded-lg overflow-hidden bg-[#F1F5F9]">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            <label className="w-14 h-14 border-2 border-dashed border-[#E2E8F0] rounded-lg flex items-center justify-center cursor-pointer hover:border-[#0066FF]/40 transition">
              {uploading ? (
                <Loader2 size={14} className="animate-spin text-[#94A3B8]" />
              ) : (
                <Camera size={14} className="text-[#94A3B8]" />
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="sr-only"
              />
            </label>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={createLog.isPending}
          className="w-full py-2.5 bg-[#0066FF] text-white rounded-lg font-medium text-sm hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {createLog.isPending ? <Loader2 size={14} className="animate-spin" /> : <Droplets size={14} />}
          Save Service Log
        </button>
      </form>
    </Modal>
  );
}
