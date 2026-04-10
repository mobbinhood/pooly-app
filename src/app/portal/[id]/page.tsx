import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Droplets, Calendar, Clock, Beaker, Wrench, CheckCircle2, AlertCircle, DollarSign, FileText, Send } from 'lucide-react';
import type { ChemicalAdded, EquipmentStatus } from '@/lib/supabase';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function getEquipmentLabel(key: string) {
  const labels: Record<string, string> = {
    pump: 'Pump', filter: 'Filter', cleaner: 'Cleaner', heater: 'Heater', salt_system: 'Salt System',
  };
  return labels[key] || key;
}

function getStatusColor(status: string) {
  if (status === 'good') return 'text-emerald-600 bg-emerald-50';
  if (status === 'off') return 'text-slate-500 bg-slate-50';
  return 'text-amber-600 bg-amber-50';
}

export default async function CustomerPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, address, city, state, zip, service_frequency')
    .eq('id', id)
    .single();

  if (!customer) notFound();

  const [{ data: serviceLogs }, { data: routeStops }, { data: invoices }] = await Promise.all([
    supabase
      .from('service_logs')
      .select('id, service_date, chlorine_level, ph_level, alkalinity, cya, calcium, salt_level, water_temp, chemicals_added, equipment_status, notes, time_on_site_minutes, technician_id, users:technician_id(name)')
      .eq('customer_id', id)
      .order('service_date', { ascending: false })
      .limit(20),
    supabase
      .from('route_stops')
      .select('id, stop_order, estimated_duration_minutes, routes:route_id(name, day_of_week, users:technician_id(name))')
      .eq('customer_id', id),
    supabase
      .from('invoices')
      .select('id, invoice_number, issued_date, due_date, total_cents, status, invoice_items(id, description, quantity, unit_price_cents, total_cents)')
      .eq('customer_id', id)
      .order('issued_date', { ascending: false })
      .limit(10),
  ]);

  const frequencyLabel: Record<string, string> = {
    weekly: 'Weekly', biweekly: 'Every 2 Weeks', monthly: 'Monthly', on_call: 'On Call',
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="bg-white border-b border-[#E2E8F0] px-5 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#0066FF] rounded-lg flex items-center justify-center">
              <Droplets className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1A1A2E]">Pooly</h1>
              <p className="text-xs text-[#64748B]">Customer Portal</p>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1A1A2E]">{customer.name}</h2>
            <p className="text-sm text-[#64748B] mt-0.5">
              {customer.address}, {customer.city}, {customer.state} {customer.zip}
            </p>
            <span className="inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full bg-[#0066FF]/8 text-[#0066FF]">
              {frequencyLabel[customer.service_frequency] || customer.service_frequency} Service
            </span>
          </div>
        </header>

        <main className="px-4 py-5 space-y-5">
          {/* Upcoming Services */}
          <section>
            <h3 className="text-sm font-semibold text-[#1A1A2E] mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-[#0066FF]" />
              Scheduled Services
            </h3>
            {!routeStops?.length ? (
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 text-center">
                <p className="text-sm text-[#94A3B8]">No scheduled services at this time</p>
              </div>
            ) : (
              <div className="space-y-2">
                {routeStops.map((stop) => {
                  const route = stop.routes as unknown as { name: string; day_of_week: number; users: { name: string } | null } | null;
                  return (
                    <div key={stop.id} className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold bg-[#0066FF]/8 text-[#0066FF]">
                        {route ? DAY_NAMES[route.day_of_week].slice(0, 3) : '—'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A1A2E]">
                          {route ? `${DAY_NAMES[route.day_of_week]}s — ${route.name}` : 'Scheduled'}
                        </p>
                        <p className="text-xs text-[#64748B]">
                          {route?.users?.name && <>Tech: {route.users.name} · </>}
                          ~{stop.estimated_duration_minutes} min
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Billing & Invoices */}
          <section>
            <h3 className="text-sm font-semibold text-[#1A1A2E] mb-3 flex items-center gap-2">
              <DollarSign size={16} className="text-[#0066FF]" />
              Billing & Invoices
            </h3>
            {!invoices?.length ? (
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 text-center">
                <p className="text-sm text-[#94A3B8]">No invoices at this time</p>
              </div>
            ) : (
              <>
                {/* Billing Summary */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 text-center">
                    <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Outstanding</p>
                    <p className="text-lg font-bold text-[#1A1A2E] mt-0.5">
                      ${(invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total_cents, 0) / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 text-center">
                    <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Paid</p>
                    <p className="text-lg font-bold text-[#10B981] mt-0.5">
                      ${(invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_cents, 0) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Invoice List */}
                <div className="space-y-2">
                  {invoices.map((invoice) => {
                    const statusConfig: Record<string, { label: string; color: string; Icon: typeof FileText }> = {
                      draft: { label: 'Draft', color: 'bg-slate-100 text-slate-500', Icon: FileText },
                      sent: { label: 'Sent', color: 'bg-[#0066FF]/10 text-[#0066FF]', Icon: Send },
                      paid: { label: 'Paid', color: 'bg-emerald-50 text-emerald-600', Icon: CheckCircle2 },
                      overdue: { label: 'Overdue', color: 'bg-red-50 text-red-500', Icon: AlertCircle },
                      cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-400', Icon: FileText },
                    };
                    const cfg = statusConfig[invoice.status] ?? statusConfig.draft;

                    return (
                      <div key={invoice.id} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                        <div className="px-4 py-3 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-[#1A1A2E]">{invoice.invoice_number}</p>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.color}`}>
                                {cfg.label}
                              </span>
                            </div>
                            <p className="text-xs text-[#64748B] mt-0.5">
                              Issued {formatDate(invoice.issued_date)} · Due {formatDate(invoice.due_date)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-[#1A1A2E]">
                            ${(invoice.total_cents / 100).toFixed(2)}
                          </p>
                        </div>
                        {invoice.invoice_items && invoice.invoice_items.length > 0 && (
                          <div className="border-t border-[#F1F5F9] px-4 py-2">
                            {invoice.invoice_items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between py-1 text-xs text-[#64748B]">
                                <span>{item.description}</span>
                                <span className="tabular-nums">{item.quantity} x ${(item.unit_price_cents / 100).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          {/* Service History */}
          <section>
            <h3 className="text-sm font-semibold text-[#1A1A2E] mb-3 flex items-center gap-2">
              <Clock size={16} className="text-[#0066FF]" />
              Service History
            </h3>
            {!serviceLogs?.length ? (
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 text-center">
                <p className="text-sm text-[#94A3B8]">No service history yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {serviceLogs.map((log) => {
                  const tech = log.users as unknown as { name: string } | null;
                  const chemicals = (log.chemicals_added ?? []) as ChemicalAdded[];
                  const equipment = (log.equipment_status ?? {}) as EquipmentStatus;
                  const equipmentEntries = Object.entries(equipment).filter(([, v]) => v);

                  return (
                    <div key={log.id} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#1A1A2E]">{formatDate(log.service_date)}</p>
                          <p className="text-xs text-[#64748B]">
                            {tech?.name && <>By {tech.name}</>}
                            {log.time_on_site_minutes && <> · {log.time_on_site_minutes} min on site</>}
                          </p>
                        </div>
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      </div>

                      {/* Chemical Readings */}
                      <div className="px-4 py-3">
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {log.chlorine_level != null && (
                            <ReadingBadge label="Chlorine" value={log.chlorine_level} unit="ppm" />
                          )}
                          {log.ph_level != null && (
                            <ReadingBadge label="pH" value={log.ph_level} />
                          )}
                          {log.alkalinity != null && (
                            <ReadingBadge label="Alkalinity" value={log.alkalinity} unit="ppm" />
                          )}
                          {log.cya != null && (
                            <ReadingBadge label="CYA" value={log.cya} unit="ppm" />
                          )}
                          {log.calcium != null && (
                            <ReadingBadge label="Calcium" value={log.calcium} unit="ppm" />
                          )}
                          {log.salt_level != null && (
                            <ReadingBadge label="Salt" value={log.salt_level} unit="ppm" />
                          )}
                          {log.water_temp != null && (
                            <ReadingBadge label="Temp" value={log.water_temp} unit="°F" />
                          )}
                        </div>
                      </div>

                      {/* Chemicals Added */}
                      {chemicals.length > 0 && (
                        <div className="px-4 pb-3">
                          <p className="text-xs font-medium text-[#64748B] mb-1.5 flex items-center gap-1">
                            <Beaker size={12} /> Chemicals Added
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {chemicals.map((c, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                {c.chemical}: {c.amount} {c.unit}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Equipment Status */}
                      {equipmentEntries.length > 0 && (
                        <div className="px-4 pb-3">
                          <p className="text-xs font-medium text-[#64748B] mb-1.5 flex items-center gap-1">
                            <Wrench size={12} /> Equipment
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {equipmentEntries.map(([key, status]) => (
                              <span key={key} className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(status!)}`}>
                                {getEquipmentLabel(key)}: {status!.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {log.notes && (
                        <div className="px-4 pb-3">
                          <p className="text-xs text-[#64748B] flex items-start gap-1">
                            <AlertCircle size={12} className="mt-0.5 shrink-0" />
                            {log.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        <footer className="px-4 py-6 text-center">
          <p className="text-xs text-[#94A3B8]">Powered by Pooly</p>
        </footer>
      </div>
    </div>
  );
}

function ReadingBadge({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="bg-[#F8FAFC] rounded-lg px-2.5 py-2 text-center">
      <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-[#1A1A2E] tabular-nums">
        {value}{unit && <span className="text-[10px] font-normal text-[#94A3B8] ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}
