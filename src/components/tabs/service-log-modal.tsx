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

  return (
    <Modal open={open} onClose={onClose} title="Log Service Visit" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Timer */}
        <div className="flex items-center gap-2 bg-blue-50 rounded-xl p-3 border border-blue-100">
          <Clock size={16} className="text-blue-600" />
          <span className="text-sm text-blue-800 font-medium">Time on site: {elapsed} min</span>
        </div>

        {/* Customer Select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer</label>
          <select
            {...register('customer_id')}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          >
            <option value="">Select customer...</option>
            {customers?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.customer_id && <p className="text-red-500 text-xs mt-1">{errors.customer_id.message}</p>}
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Service Date</label>
          <input
            {...register('service_date')}
            type="date"
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* Chemical Readings */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Beaker size={16} className="text-cyan-600" />
            <span className="text-sm font-medium text-gray-700">Chemical Readings</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">pH Level</label>
              <input
                {...register('ph_level', { valueAsNumber: true })}
                type="number"
                step="0.1"
                placeholder="7.2-7.8"
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Chlorine</label>
              <input
                {...register('chlorine_level', { valueAsNumber: true })}
                type="number"
                step="0.1"
                placeholder="1.0-3.0"
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Alkalinity</label>
              <input
                {...register('alkalinity', { valueAsNumber: true })}
                type="number"
                placeholder="80-120"
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          </div>
          {/* Reading indicators */}
          <div className="flex gap-2 mt-2">
            <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full">pH: 7.2-7.8</span>
            <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Cl: 1.0-3.0</span>
            <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Alk: 80-120</span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
          <textarea
            {...register('notes')}
            rows={3}
            placeholder="Service notes, issues found, chemicals added..."
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
          />
        </div>

        {/* Photo Upload */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Camera size={16} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Photos</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {photos.map((url, i) => (
              <div key={i} className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            <label className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-blue-400 transition">
              {uploading ? (
                <Loader2 size={16} className="animate-spin text-gray-400" />
              ) : (
                <Camera size={16} className="text-gray-400" />
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
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {createLog.isPending ? <Loader2 size={16} className="animate-spin" /> : <Droplets size={16} />}
          Save Service Log
        </button>
      </form>
    </Modal>
  );
}
