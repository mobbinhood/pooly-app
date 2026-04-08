'use client';

import { useState, use } from 'react';
import { useCustomer, useServiceLogs, useInvoices } from '@/lib/hooks';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Key,
  Car,
  FileText,
  Droplets,
  Wrench,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Beaker,
  MessageSquare,
  Camera,
  Navigation,
  ClipboardList,
  Receipt,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import type { Database, EquipmentStatus } from '@/lib/supabase';

type Pool = Database['public']['Tables']['pools']['Row'];

function useOrgId() {
  const supabase = createClient();
  return useQuery({
    queryKey: ['current-org'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
      return data?.organization_id ?? null;
    },
  });
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: customer, isLoading } = useCustomer(id);
  const { data: serviceLogs } = useServiceLogs(id);
  const { data: orgId } = useOrgId();
  const { data: invoices } = useInvoices(orgId ?? undefined, id);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const pools = (customer as { pools?: Pool[] } | undefined)?.pools ?? [];
  const logs = serviceLogs?.slice(0, 10) ?? [];

  const equipmentStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-[#10B981]/10 text-[#10B981]';
      case 'needs_cleaning': case 'needs_attention': return 'bg-[#F59E0B]/10 text-[#F59E0B]';
      case 'not_working': return 'bg-[#EF4444]/10 text-[#EF4444]';
      default: return 'bg-[#94A3B8]/10 text-[#94A3B8]';
    }
  };

  const equipmentStatusLabel = (status: string) => status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <Droplets className="w-8 h-8 text-[#0066FF]" />
        </motion.div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-12 h-12 text-[#94A3B8]" />
        <p className="text-[#64748B] font-medium">Customer not found</p>
        <button onClick={() => router.back()} className="text-[#0066FF] text-sm font-medium">Go Back</button>
      </div>
    );
  }

  const fullAddress = `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`;
  const mapsUrl = `https://maps.apple.com/?daddr=${encodeURIComponent(fullAddress)}`;
  const lastServiceDate = logs[0]?.service_date;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-2xl mx-auto pb-8">
        {/* Header */}
        <header className="bg-white border-b border-[#E2E8F0] px-5 pt-4 pb-5 sticky top-0 z-30">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-[#F8FAFC] rounded-lg transition">
              <ArrowLeft size={20} className="text-[#1A1A2E]" />
            </button>
            <span className="text-sm text-[#64748B]">Customer Details</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#0066FF] text-white flex items-center justify-center font-bold text-xl shrink-0">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-[#1A1A2E] truncate">{customer.name}</h1>
              <p className="text-sm text-[#64748B] flex items-center gap-1 truncate">
                <MapPin size={12} />
                {customer.address}, {customer.city}
              </p>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Customer since {format(new Date(customer.created_at), 'MMM yyyy')}
              </p>
            </div>
          </div>
        </header>

        <main className="px-4 pt-5 space-y-5">
          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-2">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 p-3.5 bg-white border border-[#E2E8F0] rounded-xl hover:border-[#0066FF]/30 hover:bg-[#0066FF]/5 transition"
            >
              <div className="w-9 h-9 bg-[#10B981]/8 rounded-lg flex items-center justify-center">
                <Navigation size={16} className="text-[#10B981]" />
              </div>
              <span className="text-xs font-medium text-[#1A1A2E]">Navigate</span>
            </a>
            <button
              onClick={() => router.push(`/?tab=home&logService=${id}`)}
              className="flex flex-col items-center gap-1.5 p-3.5 bg-white border border-[#E2E8F0] rounded-xl hover:border-[#0066FF]/30 hover:bg-[#0066FF]/5 transition"
            >
              <div className="w-9 h-9 bg-[#0066FF]/8 rounded-lg flex items-center justify-center">
                <ClipboardList size={16} className="text-[#0066FF]" />
              </div>
              <span className="text-xs font-medium text-[#1A1A2E]">Log Service</span>
            </button>
            <button
              onClick={() => router.push(`/?tab=invoices&createFor=${id}`)}
              className="flex flex-col items-center gap-1.5 p-3.5 bg-white border border-[#E2E8F0] rounded-xl hover:border-[#0066FF]/30 hover:bg-[#0066FF]/5 transition"
            >
              <div className="w-9 h-9 bg-[#F59E0B]/8 rounded-lg flex items-center justify-center">
                <Receipt size={16} className="text-[#F59E0B]" />
              </div>
              <span className="text-xs font-medium text-[#1A1A2E]">Create Invoice</span>
            </button>
          </div>

          {/* Contact Info */}
          <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#F1F5F9]">
              <h2 className="text-sm font-semibold text-[#1A1A2E]">Contact Information</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#0066FF]/8 rounded-lg flex items-center justify-center shrink-0">
                  <MapPin size={14} className="text-[#0066FF]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Address</p>
                  <p className="text-sm text-[#1A1A2E]">{fullAddress}</p>
                </div>
              </div>
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#10B981]/8 rounded-lg flex items-center justify-center shrink-0">
                    <Phone size={14} className="text-[#10B981]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Phone</p>
                    <p className="text-sm text-[#0066FF]">{customer.phone}</p>
                  </div>
                </a>
              )}
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#0066FF]/8 rounded-lg flex items-center justify-center shrink-0">
                    <Mail size={14} className="text-[#0066FF]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Email</p>
                    <p className="text-sm text-[#0066FF] truncate">{customer.email}</p>
                  </div>
                </a>
              )}
            </div>
          </section>

          {/* Gate Codes & Access Notes */}
          {(customer.gate_code || customer.access_notes || customer.parking_info) && (
            <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#F1F5F9]">
                <h2 className="text-sm font-semibold text-[#1A1A2E]">Access Details</h2>
              </div>
              <div className="p-4 space-y-3">
                {customer.gate_code && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#F59E0B]/8 rounded-lg flex items-center justify-center shrink-0">
                      <Key size={14} className="text-[#F59E0B]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Gate Code</p>
                      <p className="text-sm text-[#1A1A2E] font-mono font-semibold">{customer.gate_code}</p>
                    </div>
                  </div>
                )}
                {customer.access_notes && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#64748B]/8 rounded-lg flex items-center justify-center shrink-0">
                      <FileText size={14} className="text-[#64748B]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Access Notes</p>
                      <p className="text-sm text-[#1A1A2E]">{customer.access_notes}</p>
                    </div>
                  </div>
                )}
                {customer.parking_info && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#64748B]/8 rounded-lg flex items-center justify-center shrink-0">
                      <Car size={14} className="text-[#64748B]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#94A3B8] font-medium uppercase">Parking</p>
                      <p className="text-sm text-[#1A1A2E]">{customer.parking_info}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Pool Info */}
          <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#F1F5F9]">
              <h2 className="text-sm font-semibold text-[#1A1A2E]">
                Pool Information {pools.length > 0 && <span className="text-[#94A3B8] font-normal">({pools.length})</span>}
              </h2>
            </div>
            {pools.length > 0 ? (
              <div className="divide-y divide-[#F1F5F9]">
                {pools.map((pool: Pool) => (
                  <div key={pool.id} className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#0066FF]/8 rounded-lg flex items-center justify-center">
                        <Droplets size={16} className="text-[#0066FF]" />
                      </div>
                      <div>
                        <p className="font-medium text-[#1A1A2E] capitalize text-sm">{pool.type.replace('_', ' ')}</p>
                        <p className="text-xs text-[#64748B]">
                          {pool.size_gallons ? `${pool.size_gallons.toLocaleString()} gallons` : 'Size unknown'}
                          {pool.surface_type && ` · ${pool.surface_type}`}
                        </p>
                      </div>
                    </div>

                    {/* Equipment List */}
                    <div className="space-y-1.5 ml-12">
                      {pool.has_pump && (
                        <div className="flex items-center gap-2 text-sm">
                          <Wrench size={12} className="text-[#64748B]" />
                          <span className="text-[#1A1A2E]">Pump</span>
                        </div>
                      )}
                      {pool.has_filter && (
                        <div className="flex items-center gap-2 text-sm">
                          <Wrench size={12} className="text-[#64748B]" />
                          <span className="text-[#1A1A2E]">Filter{pool.filter_type ? ` (${pool.filter_type})` : ''}</span>
                        </div>
                      )}
                      {pool.has_heater && (
                        <div className="flex items-center gap-2 text-sm">
                          <Wrench size={12} className="text-[#64748B]" />
                          <span className="text-[#1A1A2E]">Heater{pool.heater_type ? ` (${pool.heater_type})` : ''}</span>
                        </div>
                      )}
                      {pool.has_cleaner && (
                        <div className="flex items-center gap-2 text-sm">
                          <Wrench size={12} className="text-[#64748B]" />
                          <span className="text-[#1A1A2E]">Cleaner{pool.cleaner_type ? ` (${pool.cleaner_type})` : ''}</span>
                        </div>
                      )}
                      {pool.has_salt_system && (
                        <div className="flex items-center gap-2 text-sm">
                          <Wrench size={12} className="text-[#64748B]" />
                          <span className="text-[#1A1A2E]">Salt System{pool.salt_system_model ? ` (${pool.salt_system_model})` : ''}</span>
                        </div>
                      )}
                    </div>

                    {pool.equipment_notes && (
                      <div className="ml-12 p-2.5 bg-[#F8FAFC] rounded-lg">
                        <p className="text-xs text-[#64748B]">{pool.equipment_notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Droplets className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-sm text-[#64748B]">No pool information yet</p>
              </div>
            )}
          </section>

          {/* Service History */}
          <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#F1F5F9]">
              <h2 className="text-sm font-semibold text-[#1A1A2E]">
                Service History {logs.length > 0 && <span className="text-[#94A3B8] font-normal">(Last {logs.length})</span>}
              </h2>
            </div>
            {logs.length > 0 ? (
              <div className="p-4">
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
                                        <div className="flex gap-2 flex-wrap">
                                          {log.photos.map((url, i) => (
                                            <div key={i} className="w-14 h-14 rounded-lg overflow-hidden bg-[#F1F5F9]">
                                              <img src={url} alt="" className="w-full h-full object-cover" />
                                            </div>
                                          ))}
                                        </div>
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
              </div>
            ) : (
              <div className="p-8 text-center">
                <Calendar className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-sm text-[#64748B]">No service history yet</p>
              </div>
            )}
          </section>

          {/* Recent Invoices */}
          {invoices && invoices.length > 0 && (
            <section className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#F1F5F9]">
                <h2 className="text-sm font-semibold text-[#1A1A2E]">
                  Recent Invoices <span className="text-[#94A3B8] font-normal">({invoices.length})</span>
                </h2>
              </div>
              <div className="divide-y divide-[#F1F5F9]">
                {invoices.slice(0, 5).map((inv) => (
                  <div key={inv.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#1A1A2E]">{inv.invoice_number}</p>
                      <p className="text-xs text-[#94A3B8]">{format(new Date(inv.issued_date), 'MMM d, yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#1A1A2E]">${(inv.total_cents / 100).toFixed(2)}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        inv.status === 'paid' ? 'bg-[#10B981]/10 text-[#10B981]' :
                        inv.status === 'overdue' ? 'bg-[#EF4444]/10 text-[#EF4444]' :
                        inv.status === 'sent' ? 'bg-[#0066FF]/10 text-[#0066FF]' :
                        'bg-[#F1F5F9] text-[#64748B]'
                      }`}>{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
