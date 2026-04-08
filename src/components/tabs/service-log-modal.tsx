'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { serviceLogSchema, type ServiceLogInput } from '@/lib/validations';
import { useCreateServiceLog, useCustomers } from '@/lib/hooks';
import { Modal } from '@/components/ui/modal';
import { Droplets, Beaker, Loader2, Camera, Clock, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { InlineDosingCalculator } from '@/components/chemical-calculator';
import toast from 'react-hot-toast';

interface ServiceLogModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  technicianId: string;
  preselectedCustomerId?: string;
  onInvoiceRequest?: (customerId: string, serviceLogId: string) => void;
}

export function ServiceLogModal({ open, onClose, orgId, technicianId, preselectedCustomerId, onInvoiceRequest }: ServiceLogModalProps) {
  const { data: customers } = useCustomers(orgId);
  const createLog = useCreateServiceLog();
  const supabase = createClient();
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sendReport, setSendReport] = useState(true);
  const [createInvoice, setCreateInvoice] = useState(false);
  const [startTime] = useState(new Date());

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ServiceLogInput>({
    resolver: zodResolver(serviceLogSchema),
    defaultValues: {
      customer_id: preselectedCustomerId || '',
      service_date: new Date().toISOString().split('T')[0],
    },
  });

  const watchedCustomerId = watch('customer_id');
  const watchedPh = watch('ph_level');
  const watchedChlorine = watch('chlorine_level');
  const watchedAlkalinity = watch('alkalinity');

  // Look up pool size from selected customer
  const selectedCustomer = customers?.find(c => c.id === watchedCustomerId);
  const poolSizeGallons = selectedCustomer?.pools?.[0]?.size_gallons ?? null;

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
    const customerHasEmail = !!selectedCustomer?.email;
    const shouldSendEmail = sendReport && customerHasEmail;

    const log = await createLog.mutateAsync({
      ...data,
      technician_id: technicianId,
      photos,
      ...(shouldSendEmail ? { email_status: 'pending' as const } : {}),
    });

    // Fire-and-forget email send
    if (shouldSendEmail && log?.id) {
      fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_log_id: log.id }),
      }).then(res => {
        if (res.ok) toast.success('Service report emailed to customer');
        else toast.error('Failed to send report email');
      }).catch(() => toast.error('Failed to send report email'));
    }

    // Trigger invoice creation if requested
    if (createInvoice && log?.id && onInvoiceRequest) {
      onInvoiceRequest(data.customer_id, log.id);
    }

    reset();
    setPhotos([]);
    setSendReport(true);
    setCreateInvoice(false);
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
    <Modal open={open} onClose={onClose} title="Start Service" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Timer */}
        <div className="flex items-center gap-2 bg-[#0066FF]/5 rounded-lg p-3 border border-[#0066FF]/10">
          <Clock size={14} className="text-[#0066FF]" />
          <span className="text-sm text-[#0066FF] font-medium tabular-nums">Time on site: {elapsed} min</span>
        </div>

        {/* Customer Info */}
        {preselectedCustomerId && selectedCustomer ? (
          <div className="flex items-center gap-3 bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0]">
            <div className="w-10 h-10 rounded-full bg-[#0066FF]/10 flex items-center justify-center">
              <span className="text-sm font-bold text-[#0066FF]">{selectedCustomer.name?.charAt(0)}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-[#1A1A2E]">{selectedCustomer.name}</p>
              {selectedCustomer.email && <p className="text-xs text-[#64748B]">{selectedCustomer.email}</p>}
            </div>
            <input type="hidden" {...register('customer_id')} />
          </div>
        ) : (
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
        )}

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
              <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">Free Chlorine</label>
              <input
                {...register('chlorine_level', { valueAsNumber: true })}
                type="number"
                step="0.1"
                placeholder="1.0-3.0"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">Combined Cl</label>
              <input
                {...register('combined_chlorine', { valueAsNumber: true })}
                type="number"
                step="0.1"
                placeholder="0.0-0.2"
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
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">CYA</label>
              <input
                {...register('cya', { valueAsNumber: true })}
                type="number"
                placeholder="30-50"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">Calcium</label>
              <input
                {...register('calcium', { valueAsNumber: true })}
                type="number"
                placeholder="200-400"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">Salt (ppm)</label>
              <input
                {...register('salt', { valueAsNumber: true })}
                type="number"
                placeholder="2700-3400"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">TDS</label>
              <input
                {...register('tds', { valueAsNumber: true })}
                type="number"
                placeholder="<3000"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">Water Temp °F</label>
              <input
                {...register('water_temp', { valueAsNumber: true })}
                type="number"
                placeholder="78-82"
                className={inputClass}
              />
            </div>
          </div>

          {/* Filter PSI */}
          <div className="mt-3">
            <label className="block text-[10px] text-[#94A3B8] mb-1 uppercase font-medium">Filter PSI</label>
            <input
              {...register('filter_psi', { valueAsNumber: true })}
              type="number"
              placeholder="Normal range for filter"
              className={inputClass}
            />
          </div>

          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded-full font-medium">pH: 7.2-7.8</span>
            <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded-full font-medium">FC: 1.0-3.0</span>
            <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded-full font-medium">CC: 0-0.2</span>
            <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded-full font-medium">Alk: 80-120</span>
            <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded-full font-medium">CYA: 30-50</span>
            <span className="text-[10px] px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded-full font-medium">Ca: 200-400</span>
          </div>
        </div>

        {/* Dosing Calculator */}
        <InlineDosingCalculator
          readings={{
            ph_level: watchedPh || undefined,
            chlorine_level: watchedChlorine || undefined,
            alkalinity: watchedAlkalinity || undefined,
          }}
          poolSizeGallons={poolSizeGallons}
        />

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

        {/* Send Report Toggle */}
        <label className="flex items-center gap-3 p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={sendReport}
              onChange={(e) => setSendReport(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-[#CBD5E1] rounded-full peer-checked:bg-[#0066FF] transition" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition" />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Mail size={14} className="text-[#64748B]" />
            <span className="text-sm text-[#475569] font-medium">Email report to customer</span>
          </div>
          {selectedCustomer && !selectedCustomer.email && (
            <span className="text-[10px] text-[#F59E0B] font-medium">No email on file</span>
          )}
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={createLog.isPending}
          className="w-full py-2.5 bg-[#0066FF] text-white rounded-lg font-medium text-sm hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {createLog.isPending ? <Loader2 size={14} className="animate-spin" /> : <Droplets size={14} />}
          Complete & Save Service
        </button>
      </form>
    </Modal>
  );
}
