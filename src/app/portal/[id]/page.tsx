import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Droplets, Calendar, Clock, Beaker, Wrench, CheckCircle2, AlertCircle, DollarSign, FileText, Send, TrendingUp, TrendingDown, Minus, ArrowRight, Waves, Thermometer, Shield } from 'lucide-react';
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

  const [{ data: serviceLogs }, { data: routeStops }, { data: invoices }, { data: workOrders }, { data: pools }] = await Promise.all([
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
    supabase
      .from('work_orders')
      .select('id, title, description, status, priority, scheduled_date, created_at')
      .eq('customer_id', id)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('pools')
      .select('id, type, size_gallons, surface_type, has_pump, has_filter, filter_type, has_heater, heater_type, has_cleaner, cleaner_type, has_salt_system, salt_system_model, equipment_notes')
      .eq('customer_id', id),
  ]);

  const frequencyLabel: Record<string, string> = {
    weekly: 'Weekly', biweekly: 'Every 2 Weeks', monthly: 'Monthly', on_call: 'On Call',
  };

  // Calculate next service date from route schedule
  const nextServiceDate = (() => {
    if (!routeStops?.length) return null;
    const today = new Date();
    const todayDay = today.getDay();
    for (const stop of routeStops) {
      const route = stop.routes as unknown as { name: string; day_of_week: number; users: { name: string } | null } | null;
      if (!route) continue;
      let daysUntil = route.day_of_week - todayDay;
      if (daysUntil <= 0) daysUntil += 7;
      const nextDate = new Date(today);
      nextDate.setDate(today.getDate() + daysUntil);
      return nextDate;
    }
    return null;
  })();

  // Account standing
  const outstandingCents = invoices?.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total_cents, 0) ?? 0;
  const overdueCents = invoices?.filter(i => i.status === 'overdue').reduce((s, i) => s + i.total_cents, 0) ?? 0;
  const paidCents = invoices?.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_cents, 0) ?? 0;
  const lastServiceDate = serviceLogs?.[0]?.service_date;

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
          {/* Account Summary Card */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-[#E2E8F0]">
              {/* Next Service */}
              <div className="p-4 text-center">
                <div className="w-8 h-8 mx-auto mb-2 bg-[#0066FF]/8 rounded-lg flex items-center justify-center">
                  <Calendar size={14} className="text-[#0066FF]" />
                </div>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Next Service</p>
                <p className="text-sm font-semibold text-[#1A1A2E] mt-0.5">
                  {nextServiceDate
                    ? nextServiceDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    : 'Not scheduled'}
                </p>
              </div>
              {/* Last Service */}
              <div className="p-4 text-center">
                <div className="w-8 h-8 mx-auto mb-2 bg-[#10B981]/8 rounded-lg flex items-center justify-center">
                  <CheckCircle2 size={14} className="text-[#10B981]" />
                </div>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Last Service</p>
                <p className="text-sm font-semibold text-[#1A1A2E] mt-0.5">
                  {lastServiceDate ? formatDate(lastServiceDate) : 'None yet'}
                </p>
              </div>
            </div>
            {/* Account Standing */}
            {(outstandingCents > 0 || paidCents > 0) && (
              <div className={`px-4 py-3 border-t ${overdueCents > 0 ? 'bg-red-50' : outstandingCents > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {overdueCents > 0 ? (
                      <AlertCircle size={14} className="text-red-500" />
                    ) : outstandingCents > 0 ? (
                      <DollarSign size={14} className="text-amber-600" />
                    ) : (
                      <CheckCircle2 size={14} className="text-emerald-600" />
                    )}
                    <span className={`text-xs font-medium ${overdueCents > 0 ? 'text-red-700' : outstandingCents > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {overdueCents > 0
                        ? `$${(overdueCents / 100).toFixed(2)} overdue`
                        : outstandingCents > 0
                          ? `$${(outstandingCents / 100).toFixed(2)} balance due`
                          : 'Account current'}
                    </span>
                  </div>
                  {outstandingCents > 0 && (
                    <span className="text-[10px] font-medium text-[#64748B]">
                      Total due: ${(outstandingCents / 100).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Water Quality Summary */}
          {serviceLogs && serviceLogs.length > 0 && (() => {
            const latest = serviceLogs[0];
            const readings = [
              { label: 'pH', value: latest.ph_level, ideal: '7.2–7.6', unit: '', ok: latest.ph_level != null && latest.ph_level >= 7.2 && latest.ph_level <= 7.6 },
              { label: 'Chlorine', value: latest.chlorine_level, ideal: '1–3 ppm', unit: ' ppm', ok: latest.chlorine_level != null && latest.chlorine_level >= 1 && latest.chlorine_level <= 3 },
              { label: 'Alkalinity', value: latest.alkalinity, ideal: '80–120', unit: ' ppm', ok: latest.alkalinity != null && latest.alkalinity >= 80 && latest.alkalinity <= 120 },
              { label: 'CYA', value: latest.cya, ideal: '30–50', unit: ' ppm', ok: latest.cya != null && latest.cya >= 30 && latest.cya <= 50 },
            ].filter(r => r.value != null);
            const allGood = readings.every(r => r.ok);

            return (
              <section>
                <h3 className="text-sm font-semibold text-[#1A1A2E] mb-3 flex items-center gap-2">
                  <Droplets size={16} className="text-[#0066FF]" />
                  Water Quality
                  <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${allGood ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {allGood ? 'All Good' : 'Needs Attention'}
                  </span>
                </h3>
                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#F1F5F9]">
                    {readings.map((r) => (
                      <div key={r.label} className="p-3 text-center">
                        <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">{r.label}</p>
                        <p className={`text-lg font-bold mt-0.5 ${r.ok ? 'text-[#1A1A2E]' : 'text-amber-600'}`}>
                          {r.value}{r.unit}
                        </p>
                        <p className="text-[10px] text-[#94A3B8] mt-0.5">Ideal: {r.ideal}</p>
                      </div>
                    ))}
                  </div>
                  {latest.water_temp != null && (
                    <div className="border-t border-[#F1F5F9] px-4 py-2.5 flex items-center gap-2">
                      <Thermometer size={13} className="text-[#64748B]" />
                      <span className="text-xs text-[#64748B]">Water Temperature: <span className="font-medium text-[#1A1A2E]">{latest.water_temp}°F</span></span>
                      <span className="ml-auto text-[10px] text-[#94A3B8]">as of {formatDate(latest.service_date)}</span>
                    </div>
                  )}
                </div>
              </section>
            );
          })()}

          {/* Pool Details */}
          {pools && pools.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-[#1A1A2E] mb-3 flex items-center gap-2">
                <Waves size={16} className="text-[#0066FF]" />
                Pool Details
              </h3>
              <div className="space-y-2">
                {pools.map((pool) => {
                  const equipment = [
                    pool.has_pump && 'Pump',
                    pool.has_filter && `Filter${pool.filter_type ? ` (${pool.filter_type})` : ''}`,
                    pool.has_heater && `Heater${pool.heater_type ? ` (${pool.heater_type})` : ''}`,
                    pool.has_cleaner && `Cleaner${pool.cleaner_type ? ` (${pool.cleaner_type})` : ''}`,
                    pool.has_salt_system && `Salt System${pool.salt_system_model ? ` (${pool.salt_system_model})` : ''}`,
                  ].filter(Boolean);

                  return (
                    <div key={pool.id} className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-[#1A1A2E] capitalize">{pool.type} Pool</p>
                        {pool.size_gallons && (
                          <span className="text-xs text-[#64748B]">{pool.size_gallons.toLocaleString()} gal</span>
                        )}
                      </div>
                      {pool.surface_type && (
                        <p className="text-xs text-[#64748B] mb-1.5">Surface: {pool.surface_type}</p>
                      )}
                      {equipment.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {equipment.map((eq) => (
                            <span key={eq as string} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                              {eq}
                            </span>
                          ))}
                        </div>
                      )}
                      {pool.equipment_notes && (
                        <p className="text-xs text-[#94A3B8] mt-2">{pool.equipment_notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

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

          {/* Active Work Orders */}
          {workOrders && workOrders.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-[#1A1A2E] mb-3 flex items-center gap-2">
                <Wrench size={16} className="text-[#F59E0B]" />
                Active Work Orders
              </h3>
              <div className="space-y-2">
                {workOrders.map((wo) => {
                  const priorityColors: Record<string, string> = {
                    urgent: 'bg-red-50 text-red-600 border-red-200',
                    high: 'bg-amber-50 text-amber-600 border-amber-200',
                    normal: 'bg-blue-50 text-[#0066FF] border-blue-200',
                    low: 'bg-slate-50 text-slate-500 border-slate-200',
                  };
                  const statusLabels: Record<string, string> = {
                    open: 'Open',
                    in_progress: 'In Progress',
                  };
                  return (
                    <div key={wo.id} className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1A1A2E]">{wo.title}</p>
                          {wo.description && (
                            <p className="text-xs text-[#64748B] mt-0.5 line-clamp-2">{wo.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${priorityColors[wo.priority] || priorityColors.normal}`}>
                            {wo.priority}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${wo.status === 'in_progress' ? 'bg-[#0066FF]/10 text-[#0066FF]' : 'bg-slate-100 text-slate-500'}`}>
                            {statusLabels[wo.status] || wo.status}
                          </span>
                        </div>
                      </div>
                      {wo.scheduled_date && (
                        <p className="text-xs text-[#94A3B8] mt-1.5 flex items-center gap-1">
                          <Calendar size={11} />
                          Scheduled: {formatDate(wo.scheduled_date)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

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
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 text-center">
                    <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Outstanding</p>
                    <p className="text-lg font-bold text-[#1A1A2E] mt-0.5">
                      ${(outstandingCents / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className={`rounded-xl border p-3 text-center ${overdueCents > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-[#E2E8F0]'}`}>
                    <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Overdue</p>
                    <p className={`text-lg font-bold mt-0.5 ${overdueCents > 0 ? 'text-red-500' : 'text-[#1A1A2E]'}`}>
                      ${(overdueCents / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 text-center">
                    <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Paid</p>
                    <p className="text-lg font-bold text-[#10B981] mt-0.5">
                      ${(paidCents / 100).toFixed(2)}
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
                {serviceLogs.map((log, logIndex) => {
                  const tech = log.users as unknown as { name: string } | null;
                  const chemicals = (log.chemicals_added ?? []) as ChemicalAdded[];
                  const equipment = (log.equipment_status ?? {}) as EquipmentStatus;
                  const equipmentEntries = Object.entries(equipment).filter(([, v]) => v);
                  const prevLog = serviceLogs[logIndex + 1] ?? null;

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
                            <ReadingBadge label="Chlorine" value={log.chlorine_level} unit="ppm" prevValue={prevLog?.chlorine_level} />
                          )}
                          {log.ph_level != null && (
                            <ReadingBadge label="pH" value={log.ph_level} prevValue={prevLog?.ph_level} />
                          )}
                          {log.alkalinity != null && (
                            <ReadingBadge label="Alkalinity" value={log.alkalinity} unit="ppm" prevValue={prevLog?.alkalinity} />
                          )}
                          {log.cya != null && (
                            <ReadingBadge label="CYA" value={log.cya} unit="ppm" prevValue={prevLog?.cya} />
                          )}
                          {log.calcium != null && (
                            <ReadingBadge label="Calcium" value={log.calcium} unit="ppm" prevValue={prevLog?.calcium} />
                          )}
                          {log.salt_level != null && (
                            <ReadingBadge label="Salt" value={log.salt_level} unit="ppm" prevValue={prevLog?.salt_level} />
                          )}
                          {log.water_temp != null && (
                            <ReadingBadge label="Temp" value={log.water_temp} unit="°F" prevValue={prevLog?.water_temp} />
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

        {/* Service Status Banner */}
        <div className="px-4 pb-2">
          <div className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#10B981]/8 rounded-lg flex items-center justify-center shrink-0">
                <Shield size={18} className="text-[#10B981]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A1A2E]">Your pool is being taken care of</p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {serviceLogs?.length ?? 0} service visits recorded
                  {lastServiceDate && <> &middot; Last visit {formatDate(lastServiceDate)}</>}
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="px-4 py-6 text-center">
          <p className="text-xs text-[#94A3B8]">Powered by Pooly</p>
        </footer>
      </div>
    </div>
  );
}

function ReadingBadge({ label, value, unit, prevValue }: { label: string; value: number; unit?: string; prevValue?: number | null }) {
  const trend = prevValue != null ? value - prevValue : null;
  return (
    <div className="bg-[#F8FAFC] rounded-lg px-2.5 py-2 text-center">
      <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-[#1A1A2E] tabular-nums flex items-center justify-center gap-0.5">
        {value}{unit && <span className="text-[10px] font-normal text-[#94A3B8] ml-0.5">{unit}</span>}
        {trend != null && Math.abs(trend) > 0.01 && (
          trend > 0
            ? <TrendingUp size={10} className="text-amber-500 ml-0.5" />
            : <TrendingDown size={10} className="text-blue-500 ml-0.5" />
        )}
        {trend != null && Math.abs(trend) <= 0.01 && (
          <Minus size={10} className="text-emerald-500 ml-0.5" />
        )}
      </p>
    </div>
  );
}
