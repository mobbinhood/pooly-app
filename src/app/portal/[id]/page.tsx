import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Droplets, Calendar, Clock, Beaker, Wrench, CheckCircle2, AlertCircle, DollarSign, FileText, Send, TrendingUp, TrendingDown, Minus, Waves, Thermometer, Shield, BarChart3, Phone, Mail, User, Camera, Lightbulb, Activity, Share2, Zap } from 'lucide-react';
import type { ChemicalAdded, EquipmentStatus } from '@/lib/supabase';
import { CollapsibleSection, ServiceRequestForm, ServiceFeedbackWidget, SharePortalButton } from './portal-client';

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
      .select('id, service_date, chlorine_level, ph_level, alkalinity, cya, calcium, salt_level, water_temp, chemicals_added, equipment_status, notes, time_on_site_minutes, technician_id, photos, users:technician_id(name)')
      .eq('customer_id', id)
      .order('service_date', { ascending: false })
      .limit(30),
    supabase
      .from('route_stops')
      .select('id, stop_order, estimated_duration_minutes, routes:route_id(name, day_of_week, users:technician_id(name, email, phone))')
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
      const route = stop.routes as unknown as { name: string; day_of_week: number; users: { name: string; email?: string; phone?: string } | null } | null;
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

  // Pool Health Score (0-100) — composite of water quality, service consistency, and equipment
  const healthScore = (() => {
    let score = 0;
    let factors = 0;

    // Water quality factor (0-40 points)
    if (serviceLogs?.length) {
      const latest = serviceLogs[0];
      const checks = [
        { val: latest.ph_level, min: 7.2, max: 7.6, wideMin: 7.0, wideMax: 7.8 },
        { val: latest.chlorine_level, min: 1, max: 3, wideMin: 0.5, wideMax: 5 },
        { val: latest.alkalinity, min: 80, max: 120, wideMin: 60, wideMax: 150 },
        { val: latest.cya, min: 30, max: 50, wideMin: 20, wideMax: 70 },
      ].filter(c => c.val != null);
      if (checks.length > 0) {
        const waterScore = checks.reduce((sum, c) => {
          if (c.val! >= c.min && c.val! <= c.max) return sum + 40 / checks.length;
          if (c.val! >= c.wideMin && c.val! <= c.wideMax) return sum + 25 / checks.length;
          return sum;
        }, 0);
        score += waterScore;
        factors++;
      }
    }

    // Service consistency factor (0-30 points)
    if (serviceLogs && serviceLogs.length >= 2) {
      const dates = serviceLogs.slice(0, 10).map(l => new Date(l.service_date + 'T00:00:00').getTime());
      const intervals: number[] = [];
      for (let i = 0; i < dates.length - 1; i++) {
        intervals.push((dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24));
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const expectedInterval = customer.service_frequency === 'weekly' ? 7 : customer.service_frequency === 'biweekly' ? 14 : 30;
      const consistency = Math.max(0, 1 - Math.abs(avgInterval - expectedInterval) / expectedInterval);
      score += consistency * 30;
      factors++;
    }

    // Recency factor (0-30 points)
    if (lastServiceDate) {
      const daysSince = Math.floor((Date.now() - new Date(lastServiceDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
      const expectedDays = customer.service_frequency === 'weekly' ? 7 : customer.service_frequency === 'biweekly' ? 14 : 30;
      if (daysSince <= expectedDays) score += 30;
      else if (daysSince <= expectedDays * 1.5) score += 20;
      else if (daysSince <= expectedDays * 2) score += 10;
      factors++;
    }

    if (factors === 0) return null;
    return Math.round(score);
  })();

  // Seasonal tip
  const seasonalTip = (() => {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return { season: 'Spring', tip: 'Time to open your pool! Check equipment, balance chemicals, and clear debris after winter.', color: 'text-emerald-600 bg-emerald-50' };
    if (month >= 5 && month <= 7) return { season: 'Summer', tip: 'Peak swim season — run your pump 8-12 hours daily and monitor chlorine levels closely.', color: 'text-blue-600 bg-blue-50' };
    if (month >= 8 && month <= 10) return { season: 'Fall', tip: 'Keep leaves out with a cover and reduce pump runtime as temperatures drop.', color: 'text-amber-600 bg-amber-50' };
    return { season: 'Winter', tip: 'Protect pipes from freezing. Run the pump during cold snaps and maintain chemical levels.', color: 'text-slate-600 bg-slate-50' };
  })();

  // Water quality grade (A-F based on how many readings are in ideal range)
  const waterGrade = (() => {
    if (!serviceLogs?.length) return null;
    const latest = serviceLogs[0];
    const checks = [
      { val: latest.ph_level, min: 7.2, max: 7.6 },
      { val: latest.chlorine_level, min: 1, max: 3 },
      { val: latest.alkalinity, min: 80, max: 120 },
      { val: latest.cya, min: 30, max: 50 },
    ].filter(c => c.val != null);
    if (checks.length === 0) return null;
    const passing = checks.filter(c => c.val! >= c.min && c.val! <= c.max).length;
    const pct = passing / checks.length;
    if (pct >= 1) return { grade: 'A', color: 'text-emerald-600 bg-emerald-50', label: 'Excellent' };
    if (pct >= 0.75) return { grade: 'B', color: 'text-emerald-600 bg-emerald-50', label: 'Good' };
    if (pct >= 0.5) return { grade: 'C', color: 'text-amber-600 bg-amber-50', label: 'Fair' };
    if (pct >= 0.25) return { grade: 'D', color: 'text-orange-600 bg-orange-50', label: 'Needs Work' };
    return { grade: 'F', color: 'text-red-600 bg-red-50', label: 'Critical' };
  })();

  // Service photos from recent visits
  const servicePhotos = serviceLogs
    ?.flatMap(log => (log.photos as string[] ?? []).map(url => ({ url, date: log.service_date })))
    .slice(0, 8) ?? [];

  // Health score trend (calculate for last 6 visits)
  const healthTrend = (() => {
    if (!serviceLogs || serviceLogs.length < 3) return null;
    const scores: { date: string; score: number }[] = [];
    for (let idx = Math.min(5, serviceLogs.length - 1); idx >= 0; idx--) {
      const log = serviceLogs[idx];
      let score = 0;
      let factors = 0;
      // Water quality
      const checks = [
        { val: log.ph_level, min: 7.2, max: 7.6, wideMin: 7.0, wideMax: 7.8 },
        { val: log.chlorine_level, min: 1, max: 3, wideMin: 0.5, wideMax: 5 },
        { val: log.alkalinity, min: 80, max: 120, wideMin: 60, wideMax: 150 },
        { val: log.cya, min: 30, max: 50, wideMin: 20, wideMax: 70 },
      ].filter(c => c.val != null);
      if (checks.length > 0) {
        score += checks.reduce((sum, c) => {
          if (c.val! >= c.min && c.val! <= c.max) return sum + 40 / checks.length;
          if (c.val! >= c.wideMin && c.val! <= c.wideMax) return sum + 25 / checks.length;
          return sum;
        }, 0);
        factors++;
      }
      // Recency: for historical points, check distance from previous visit
      if (idx > 0 || lastServiceDate) {
        const daysSince = idx === 0
          ? Math.floor((Date.now() - new Date(log.service_date + 'T00:00:00').getTime()) / 86400000)
          : 0;
        const expectedDays = customer.service_frequency === 'weekly' ? 7 : customer.service_frequency === 'biweekly' ? 14 : 30;
        if (daysSince <= expectedDays) score += 30;
        else if (daysSince <= expectedDays * 1.5) score += 20;
        else score += 10;
        factors++;
      }
      if (factors > 0) scores.push({ date: log.service_date, score: Math.round(score) });
    }
    if (scores.length < 2) return null;
    const trend = scores[scores.length - 1].score - scores[0].score;
    return { scores, trend };
  })();

  // Service value summary
  const serviceValue = (() => {
    if (!serviceLogs || serviceLogs.length === 0) return null;
    let totalChemicals = 0;
    let totalMinutes = 0;
    let equipmentChecks = 0;
    for (const log of serviceLogs) {
      const chemicals = (log.chemicals_added ?? []) as ChemicalAdded[];
      totalChemicals += chemicals.length;
      totalMinutes += log.time_on_site_minutes ?? 0;
      const equipment = (log.equipment_status ?? {}) as EquipmentStatus;
      equipmentChecks += Object.keys(equipment).length;
    }
    return {
      visits: serviceLogs.length,
      totalChemicals,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      equipmentChecks,
    };
  })();

  // Equipment health (from latest service log)
  const equipmentHealth = (() => {
    if (!serviceLogs?.length) return null;
    const latest = serviceLogs[0];
    const equipment = (latest.equipment_status ?? {}) as EquipmentStatus;
    const entries = Object.entries(equipment).filter(([, v]) => v);
    if (entries.length === 0) return null;
    const goodCount = entries.filter(([, v]) => v === 'good').length;
    const issues = entries.filter(([, v]) => v !== 'good' && v !== 'off');
    return { entries, goodCount, total: entries.length, issues, date: latest.service_date };
  })();

  // Get assigned technician info
  const assignedTech = (() => {
    if (!routeStops?.length) return null;
    for (const stop of routeStops) {
      const route = stop.routes as unknown as { name: string; day_of_week: number; users: { name: string; email?: string; phone?: string } | null } | null;
      if (route?.users) return route.users;
    }
    return null;
  })();

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
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#0066FF]/8 text-[#0066FF]">
                {frequencyLabel[customer.service_frequency] || customer.service_frequency} Service
              </span>
              {waterGrade && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${waterGrade.color}`}>
                  {waterGrade.grade} — {waterGrade.label}
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="px-4 py-5 space-y-5">
          {/* Pool Health Score */}
          {healthScore != null && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
              <div className="flex items-center gap-5">
                {/* Circular gauge */}
                <div className="relative w-20 h-20 shrink-0">
                  <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="#F1F5F9" strokeWidth="6" />
                    <circle
                      cx="40" cy="40" r="34" fill="none"
                      stroke={healthScore >= 75 ? '#10B981' : healthScore >= 50 ? '#F59E0B' : '#EF4444'}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${(healthScore / 100) * 213.6} 213.6`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-xl font-bold ${healthScore >= 75 ? 'text-emerald-600' : healthScore >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                      {healthScore}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-[#1A1A2E]">Pool Health Score</h3>
                  <p className={`text-xs font-medium mt-0.5 ${healthScore >= 75 ? 'text-emerald-600' : healthScore >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                    {healthScore >= 90 ? 'Excellent' : healthScore >= 75 ? 'Great' : healthScore >= 50 ? 'Good — Room for Improvement' : 'Needs Attention'}
                  </p>
                  <p className="text-[10px] text-[#94A3B8] mt-1">Based on water quality, service consistency, and recency</p>
                </div>
              </div>
              {/* Health Score Trend */}
              {healthTrend && (
                <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Recent Trend</span>
                    <span className={`text-[10px] font-medium flex items-center gap-0.5 ${healthTrend.trend > 0 ? 'text-emerald-600' : healthTrend.trend < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                      {healthTrend.trend > 0 ? '+' : ''}{healthTrend.trend} pts
                      {healthTrend.trend > 0 ? <TrendingUp size={10} /> : healthTrend.trend < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                    </span>
                  </div>
                  <svg viewBox="0 0 200 32" className="w-full h-8" preserveAspectRatio="none">
                    {/* Background */}
                    <rect x="0" y="0" width="200" height="32" fill="none" />
                    {/* Good zone */}
                    <rect x="0" y={32 - (75 / 100) * 32} width="200" height={(25 / 100) * 32} fill="#10B981" opacity="0.06" />
                    {/* Trend line */}
                    <path
                      d={healthTrend.scores.map((s, i) => {
                        const x = (i / (healthTrend.scores.length - 1)) * 200;
                        const y = 32 - (s.score / 100) * 30 - 1;
                        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke={healthTrend.trend >= 0 ? '#10B981' : '#EF4444'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Data points */}
                    {healthTrend.scores.map((s, i) => (
                      <circle
                        key={i}
                        cx={(i / (healthTrend.scores.length - 1)) * 200}
                        cy={32 - (s.score / 100) * 30 - 1}
                        r={i === healthTrend.scores.length - 1 ? 3 : 2}
                        fill={i === healthTrend.scores.length - 1 ? (healthTrend.trend >= 0 ? '#10B981' : '#EF4444') : '#94A3B8'}
                      />
                    ))}
                  </svg>
                </div>
              )}
            </div>
          )}

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
                {nextServiceDate && (() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const next = new Date(nextServiceDate);
                  next.setHours(0, 0, 0, 0);
                  const diffDays = Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  const label = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : `in ${diffDays} days`;
                  const expectedDays = customer.service_frequency === 'weekly' ? 7 : customer.service_frequency === 'biweekly' ? 14 : 30;
                  const progress = Math.min(100, Math.round(((expectedDays - diffDays) / expectedDays) * 100));
                  return (
                    <>
                      <p className="text-[10px] text-[#0066FF] font-medium mt-0.5">{label}</p>
                      <div className="w-full h-1 bg-[#F1F5F9] rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-[#0066FF] rounded-full transition-all" style={{ width: `${Math.max(5, progress)}%` }} />
                      </div>
                    </>
                  );
                })()}
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
                {lastServiceDate && (() => {
                  const daysSince = Math.floor((Date.now() - new Date(lastServiceDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
                  return <p className="text-[10px] text-[#94A3B8] mt-0.5">{daysSince === 0 ? 'Today' : `${daysSince} day${daysSince !== 1 ? 's' : ''} ago`}</p>;
                })()}
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

          {/* Service Request */}
          <ServiceRequestForm customerId={customer.id} />

          {/* Service Feedback - show within 3 days of last service */}
          {serviceLogs && serviceLogs.length > 0 && (() => {
            const lastDate = new Date(serviceLogs[0].service_date + 'T00:00:00');
            const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince > 3) return null;
            return <ServiceFeedbackWidget customerId={customer.id} serviceLogId={serviceLogs[0].id} />;
          })()}

          {/* Service Photos Gallery */}
          {servicePhotos.length > 0 && (
            <CollapsibleSection
              title="Service Photos"
              icon={<Camera size={16} className="text-[#0066FF]" />}
              badge={<span className="ml-auto text-[10px] text-[#94A3B8]">{servicePhotos.length} photo{servicePhotos.length !== 1 ? 's' : ''}</span>}
              defaultOpen={false}
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {servicePhotos.map((photo, i) => (
                  <a key={i} href={photo.url} target="_blank" rel="noopener noreferrer" className="block">
                    <div className="relative aspect-square rounded-xl overflow-hidden border border-[#E2E8F0] bg-[#F1F5F9]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={`Service photo from ${formatDate(photo.date)}`} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1.5">
                        <p className="text-[10px] text-white font-medium">{formatDate(photo.date)}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Your Technician */}
          {assignedTech && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#0066FF]/8 rounded-full flex items-center justify-center shrink-0">
                  <User size={18} className="text-[#0066FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A2E]">{assignedTech.name}</p>
                  <p className="text-xs text-[#64748B]">Your assigned technician</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {assignedTech.phone && (
                    <a href={`tel:${assignedTech.phone}`} className="w-8 h-8 rounded-lg bg-[#10B981]/8 flex items-center justify-center">
                      <Phone size={14} className="text-[#10B981]" />
                    </a>
                  )}
                  {assignedTech.email && (
                    <a href={`mailto:${assignedTech.email}`} className="w-8 h-8 rounded-lg bg-[#0066FF]/8 flex items-center justify-center">
                      <Mail size={14} className="text-[#0066FF]" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Service Consistency */}
          {serviceLogs && serviceLogs.length >= 3 && (() => {
            const totalVisits = serviceLogs.length;
            const dates = serviceLogs.map(l => new Date(l.service_date + 'T00:00:00').getTime());
            const intervals: number[] = [];
            for (let i = 0; i < dates.length - 1; i++) {
              intervals.push((dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24));
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const firstDate = new Date(serviceLogs[serviceLogs.length - 1].service_date + 'T00:00:00');
            const monthsActive = Math.max(1, Math.round((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));

            return (
              <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                <div className="grid grid-cols-3 divide-x divide-[#E2E8F0]">
                  <div className="p-3 text-center">
                    <p className="text-lg font-bold text-[#1A1A2E]">{totalVisits}</p>
                    <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Total Visits</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-lg font-bold text-[#1A1A2E]">{Math.round(avgInterval)}d</p>
                    <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Avg Interval</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-lg font-bold text-[#1A1A2E]">{monthsActive}</p>
                    <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Months Active</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Service Value Summary */}
          {serviceValue && serviceValue.visits >= 2 && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-[#0066FF]" />
                <h3 className="text-sm font-semibold text-[#1A1A2E]">Service Value</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#F8FAFC] rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-[#0066FF]">{serviceValue.visits}</p>
                  <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Visits</p>
                </div>
                <div className="bg-[#F8FAFC] rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-[#10B981]">{serviceValue.totalHours}h</p>
                  <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">On-Site</p>
                </div>
                <div className="bg-[#F8FAFC] rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-[#6366F1]">{serviceValue.totalChemicals}</p>
                  <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Chemicals</p>
                </div>
                <div className="bg-[#F8FAFC] rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-[#F59E0B]">{serviceValue.equipmentChecks}</p>
                  <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Equip Checks</p>
                </div>
              </div>
            </div>
          )}

          {/* Equipment Health */}
          {equipmentHealth && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-[#0066FF]" />
                  <h3 className="text-sm font-semibold text-[#1A1A2E]">Equipment Status</h3>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  equipmentHealth.issues.length === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {equipmentHealth.goodCount}/{equipmentHealth.total} Good
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {equipmentHealth.entries.map(([key, status]) => (
                  <span
                    key={key}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(status!)}`}
                  >
                    {getEquipmentLabel(key)}: {status!.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
              {equipmentHealth.issues.length > 0 && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {equipmentHealth.issues.length} item{equipmentHealth.issues.length !== 1 ? 's' : ''} need{equipmentHealth.issues.length === 1 ? 's' : ''} attention
                </p>
              )}
              <p className="text-[10px] text-[#94A3B8] mt-2">Last checked: {formatDate(equipmentHealth.date)}</p>
            </div>
          )}

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
              <CollapsibleSection
                title="Water Quality"
                icon={<Droplets size={16} className="text-[#0066FF]" />}
                badge={
                  <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${allGood ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {allGood ? 'All Good' : 'Needs Attention'}
                  </span>
                }
              >
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
              </CollapsibleSection>
            );
          })()}

          {/* Water Quality Trends (last 10 readings) */}
          {serviceLogs && serviceLogs.length >= 3 && (() => {
            const trendLogs = [...serviceLogs].reverse().slice(-10);
            const metrics = [
              { key: 'ph_level' as const, label: 'pH', color: '#6366F1', min: 7.0, max: 8.0, idealMin: 7.2, idealMax: 7.6 },
              { key: 'chlorine_level' as const, label: 'Chlorine', color: '#0066FF', min: 0, max: 5, idealMin: 1, idealMax: 3 },
              { key: 'alkalinity' as const, label: 'Alkalinity', color: '#10B981', min: 40, max: 180, idealMin: 80, idealMax: 120 },
              { key: 'cya' as const, label: 'CYA', color: '#F59E0B', min: 0, max: 80, idealMin: 30, idealMax: 50 },
            ].filter(m => trendLogs.some(l => l[m.key] != null));

            if (metrics.length === 0) return null;

            return (
              <CollapsibleSection
                title="Water Quality Trends"
                icon={<BarChart3 size={16} className="text-[#0066FF]" />}
                badge={<span className="ml-auto text-[10px] text-[#94A3B8]">Last {trendLogs.length} readings</span>}
                defaultOpen={false}
              >
                <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden divide-y divide-[#F1F5F9]">
                  {metrics.map((metric) => {
                    const points = trendLogs
                      .map(l => l[metric.key])
                      .filter((v): v is number => v != null);
                    if (points.length < 2) return null;

                    const range = metric.max - metric.min;
                    const svgW = 200;
                    const svgH = 40;
                    const stepX = svgW / (points.length - 1);
                    const pathD = points
                      .map((v, i) => {
                        const x = i * stepX;
                        const y = svgH - ((v - metric.min) / range) * svgH;
                        return `${i === 0 ? 'M' : 'L'}${x},${Math.max(2, Math.min(svgH - 2, y))}`;
                      })
                      .join(' ');
                    // Ideal zone band
                    const idealTop = svgH - ((metric.idealMax - metric.min) / range) * svgH;
                    const idealBottom = svgH - ((metric.idealMin - metric.min) / range) * svgH;
                    const latest = points[points.length - 1];
                    const inRange = latest >= metric.idealMin && latest <= metric.idealMax;

                    return (
                      <div key={metric.key} className="px-4 py-3 flex items-center gap-3">
                        <div className="w-16 shrink-0">
                          <p className="text-xs font-medium text-[#1A1A2E]">{metric.label}</p>
                          <p className={`text-sm font-bold tabular-nums ${inRange ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {latest}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-10" preserveAspectRatio="none">
                            {/* Ideal zone */}
                            <rect x="0" y={Math.max(0, idealTop)} width={svgW} height={Math.max(1, idealBottom - idealTop)} fill={metric.color} opacity="0.08" rx="2" />
                            {/* Trend line */}
                            <path d={pathD} fill="none" stroke={metric.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            {/* Latest point */}
                            <circle
                              cx={(points.length - 1) * stepX}
                              cy={Math.max(2, Math.min(svgH - 2, svgH - ((latest - metric.min) / range) * svgH))}
                              r="3"
                              fill={metric.color}
                            />
                          </svg>
                        </div>
                        <div className="w-12 text-right shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${inRange ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {inRange ? 'Good' : 'Low'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            );
          })()}

          {/* Pool Care Tips - shown only when water quality has issues */}
          {serviceLogs && serviceLogs.length > 0 && (() => {
            const latest = serviceLogs[0];
            const tips: string[] = [];
            if (latest.ph_level != null) {
              if (latest.ph_level < 7.2) tips.push('Add soda ash to raise pH. Target: 7.2-7.6');
              if (latest.ph_level > 7.6) tips.push('Add muriatic acid to lower pH. Target: 7.2-7.6');
            }
            if (latest.chlorine_level != null) {
              if (latest.chlorine_level < 1) tips.push('Shock the pool to boost chlorine levels. Target: 1-3 ppm');
              if (latest.chlorine_level > 3) tips.push('Let chlorine dissipate naturally or reduce dosing. Target: 1-3 ppm');
            }
            if (latest.alkalinity != null) {
              if (latest.alkalinity < 80) tips.push('Add sodium bicarbonate (baking soda). Target: 80-120 ppm');
              if (latest.alkalinity > 120) tips.push('Add muriatic acid to lower alkalinity. Target: 80-120 ppm');
            }
            if (latest.cya != null) {
              if (latest.cya < 30) tips.push('Add cyanuric acid (stabilizer). Target: 30-50 ppm');
              if (latest.cya > 50) tips.push('Partially drain and refill pool to reduce CYA. Target: 30-50 ppm');
            }
            if (tips.length === 0) return null;
            return (
              <div className="bg-white rounded-xl border border-amber-300 overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-2">
                  <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                    <Lightbulb size={14} className="text-amber-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#1A1A2E]">Pool Care Tips</h3>
                </div>
                <ul className="px-4 pb-4 space-y-2">
                  {tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[#64748B]">
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1 shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {/* Pool Details */}
          {pools && pools.length > 0 && (
            <CollapsibleSection
              title="Pool Details"
              icon={<Waves size={16} className="text-[#0066FF]" />}
              defaultOpen={false}
            >
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
            </CollapsibleSection>
          )}

          {/* Upcoming Services */}
          <CollapsibleSection
            title="Scheduled Services"
            icon={<Calendar size={16} className="text-[#0066FF]" />}
          >
            {!routeStops?.length ? (
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 text-center">
                <p className="text-sm text-[#94A3B8]">No scheduled services at this time</p>
              </div>
            ) : (
              <div className="space-y-2">
                {routeStops.map((stop) => {
                  const route = stop.routes as unknown as { name: string; day_of_week: number; users: { name: string; email?: string; phone?: string } | null } | null;
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
          </CollapsibleSection>

          {/* Active Work Orders */}
          {workOrders && workOrders.length > 0 && (
            <CollapsibleSection
              title="Active Work Orders"
              icon={<Wrench size={16} className="text-[#F59E0B]" />}
            >
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
            </CollapsibleSection>
          )}

          {/* Billing & Invoices */}
          <CollapsibleSection
            title="Billing & Invoices"
            icon={<DollarSign size={16} className="text-[#0066FF]" />}
          >
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

                {/* Monthly Spending Summary */}
                {(() => {
                  const monthMap = new Map<string, { total: number; count: number }>();
                  invoices.filter(i => i.status === 'paid').forEach(inv => {
                    const d = new Date(inv.issued_date + 'T00:00:00');
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const existing = monthMap.get(key) ?? { total: 0, count: 0 };
                    monthMap.set(key, { total: existing.total + inv.total_cents, count: existing.count + 1 });
                  });
                  const months = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-4);
                  if (months.length < 2) return null;
                  const maxTotal = Math.max(...months.map(([, v]) => v.total));

                  return (
                    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 mb-3">
                      <p className="text-xs font-medium text-[#64748B] mb-3">Monthly Spending</p>
                      <div className="flex items-end gap-2 h-20">
                        {months.map(([month, data]) => {
                          const heightPct = maxTotal > 0 ? (data.total / maxTotal) * 100 : 0;
                          const label = new Date(month + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short' });
                          return (
                            <div key={month} className="flex-1 flex flex-col items-center gap-1">
                              <span className="text-[10px] font-medium text-[#1A1A2E] tabular-nums">
                                ${(data.total / 100).toFixed(0)}
                              </span>
                              <div className="w-full bg-[#F1F5F9] rounded-t-sm overflow-hidden" style={{ height: '48px' }}>
                                <div
                                  className="w-full bg-[#0066FF]/20 rounded-t-sm mt-auto"
                                  style={{ height: `${heightPct}%`, marginTop: `${100 - heightPct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-[#94A3B8]">{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

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
          </CollapsibleSection>

          {/* Service History */}
          <CollapsibleSection
            title="Service History"
            icon={<Clock size={16} className="text-[#0066FF]" />}
            badge={serviceLogs && serviceLogs.length > 0 ? (
              <span className="ml-auto text-[10px] text-[#94A3B8]">{serviceLogs.length} visits</span>
            ) : undefined}
            defaultOpen={false}
          >
            {/* Service Stats */}
            {serviceLogs && serviceLogs.length >= 2 && (() => {
              const avgTimeOnSite = serviceLogs
                .filter(l => l.time_on_site_minutes)
                .reduce((sum, l, _, arr) => sum + (l.time_on_site_minutes ?? 0) / arr.length, 0);
              const dates = serviceLogs.map(l => new Date(l.service_date + 'T00:00:00').getTime());
              const intervals: number[] = [];
              for (let i = 0; i < dates.length - 1; i++) {
                intervals.push((dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24));
              }
              const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;

              return (
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-3 mb-3 grid grid-cols-2 divide-x divide-[#F1F5F9]">
                  <div className="text-center">
                    <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Avg. Visit</p>
                    <p className="text-sm font-semibold text-[#1A1A2E]">{Math.round(avgTimeOnSite)} min</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Avg. Interval</p>
                    <p className="text-sm font-semibold text-[#1A1A2E]">{Math.round(avgInterval)} days</p>
                  </div>
                </div>
              );
            })()}
            {!serviceLogs?.length ? (
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 text-center">
                <p className="text-sm text-[#94A3B8]">No service history yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {serviceLogs.slice(0, 15).map((log, logIndex) => {
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
                {serviceLogs.length > 15 && (
                  <p className="text-xs text-[#94A3B8] text-center pt-2">
                    Showing 15 of {serviceLogs.length} visits
                  </p>
                )}
              </div>
            )}
          </CollapsibleSection>
        </main>

        {/* Seasonal Tip */}
        <div className="px-4 pb-2">
          <div className={`rounded-xl border border-[#E2E8F0] px-4 py-3 ${seasonalTip.color}`}>
            <p className="text-xs font-semibold mb-1">{seasonalTip.season} Pool Tip</p>
            <p className="text-xs opacity-80">{seasonalTip.tip}</p>
          </div>
        </div>

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

        <footer className="px-4 py-6 text-center space-y-3">
          <SharePortalButton />
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
