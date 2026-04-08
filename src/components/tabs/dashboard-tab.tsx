'use client';

import { useState } from 'react';
import { useDashboardStats, useServiceLogs, useUser, useCompletedStops, useToggleStopComplete } from '@/lib/hooks';
import { StatCard } from '@/components/ui/stat-card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { ServiceLogModal } from './service-log-modal';
import { Calendar, CheckCircle, AlertTriangle, Clock, MapPin, Droplets, ClipboardList, Check, Navigation, Calculator } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { StandaloneDosingCalculator } from '@/components/chemical-calculator';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

export function DashboardTab({ orgId, onNavigate }: { orgId: string; onNavigate?: (tab: string) => void }) {
  const [showServiceLog, setShowServiceLog] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [serviceLogCustomerId, setServiceLogCustomerId] = useState<string | undefined>();
  const { data: userData } = useUser();
  const { data: stats, isLoading } = useDashboardStats(orgId);
  const { data: recentLogs } = useServiceLogs();
  const { data: completedStops } = useCompletedStops();
  const toggleComplete = useToggleStopComplete();

  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const todayStops = stats?.todayRoute?.route_stops ?? [];
  const completedCount = todayStops.filter((s: { id: string }) => completedStops?.[s.id]).length;
  const progressPercent = todayStops.length > 0 ? Math.round((completedCount / todayStops.length) * 100) : 0;
  const remainingStops = todayStops.length - completedCount;
  const remainingMinutes = todayStops
    .filter((s: { id: string }) => !completedStops?.[s.id])
    .reduce((sum: number, s: { estimated_duration_minutes: number }) => sum + s.estimated_duration_minutes, 0);

  const sortedStops = [...todayStops].sort((a: { stop_order: number }, b: { stop_order: number }) => a.stop_order - b.stop_order);
  const nextStop = sortedStops.find((s: { id: string }) => !completedStops?.[s.id]) as { id: string; customer_id: string; customers: { name: string; address: string }; estimated_duration_minutes: number } | undefined;

  const handleStopClick = (stop: { id: string; customer_id?: string }) => {
    const isCompleted = completedStops?.[stop.id];
    if (!isCompleted) {
      toggleComplete.mutate({ stopId: stop.id, completed: true });
      if (stop.customer_id) {
        setServiceLogCustomerId(stop.customer_id);
        setShowServiceLog(true);
      }
    } else {
      toggleComplete.mutate({ stopId: stop.id, completed: false });
    }
  };

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-[#1A1A2E]">
          Good {today.getHours() < 12 ? 'morning' : today.getHours() < 17 ? 'afternoon' : 'evening'}
        </h2>
        <p className="text-[#64748B] text-sm">{dayNames[today.getDay()]}, {format(today, 'MMMM d')}</p>
      </motion.div>

      {/* Next Stop Card */}
      {nextStop && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[#0066FF] rounded-xl p-5 text-white"
        >
          <div className="flex items-center gap-2 mb-3">
            <Navigation size={14} />
            <span className="text-xs font-medium text-blue-200 uppercase tracking-wide">Next Stop</span>
          </div>
          <p className="text-lg font-semibold">{nextStop.customers?.name}</p>
          <p className="text-blue-200 text-sm mt-0.5">{nextStop.customers?.address}</p>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5 text-sm text-blue-200">
              <Clock size={14} />
              <span>~{nextStop.estimated_duration_minutes}min</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-blue-200">
              <MapPin size={14} />
              <span>{remainingStops} stop{remainingStops !== 1 ? 's' : ''} left</span>
            </div>
          </div>
          <button
            onClick={() => handleStopClick(nextStop)}
            className="mt-4 w-full bg-white/15 hover:bg-white/25 text-white py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
          >
            <ClipboardList size={16} />
            Complete & Log Service
          </button>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Today's Route"
          value={`${completedCount}/${todayStops.length}`}
          icon={CheckCircle}
          color={progressPercent === 100 ? 'green' : 'blue'}
          delay={0.1}
        />
        <StatCard
          label="Time Remaining"
          value={remainingMinutes > 0 ? `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m` : 'Done'}
          icon={Clock}
          color={remainingMinutes === 0 && todayStops.length > 0 ? 'green' : 'blue'}
          delay={0.15}
        />
        <StatCard
          label="Total Customers"
          value={stats?.totalCustomers ?? 0}
          icon={Calendar}
          color="blue"
          delay={0.2}
        />
        <StatCard
          label="Needs Attention"
          value={recentLogs?.filter(l =>
            (l.ph_level != null && (l.ph_level < 7.0 || l.ph_level > 7.8)) ||
            (l.chlorine_level != null && (l.chlorine_level < 1.0 || l.chlorine_level > 5.0))
          ).length ?? 0}
          icon={AlertTriangle}
          color={
            (recentLogs?.filter(l =>
              (l.ph_level != null && (l.ph_level < 7.0 || l.ph_level > 7.8)) ||
              (l.chlorine_level != null && (l.chlorine_level < 1.0 || l.chlorine_level > 5.0))
            ).length ?? 0) > 0 ? 'amber' : 'green'
          }
          delay={0.25}
        />
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="grid grid-cols-3 gap-3"
      >
        <button
          onClick={() => { setServiceLogCustomerId(undefined); setShowServiceLog(true); }}
          className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col items-center gap-2 hover:border-[#0066FF]/30 transition"
        >
          <div className="w-10 h-10 bg-[#10B981]/8 rounded-lg flex items-center justify-center">
            <ClipboardList size={18} className="text-[#10B981]" />
          </div>
          <span className="text-xs font-medium text-[#1A1A2E]">Log Service</span>
        </button>
        <button
          onClick={() => setShowCalculator(true)}
          className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col items-center gap-2 hover:border-[#0066FF]/30 transition"
        >
          <div className="w-10 h-10 bg-[#F59E0B]/8 rounded-lg flex items-center justify-center">
            <Calculator size={18} className="text-[#F59E0B]" />
          </div>
          <span className="text-xs font-medium text-[#1A1A2E]">Dosing Calc</span>
        </button>
        <button
          onClick={() => onNavigate?.('customers')}
          className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col items-center gap-2 hover:border-[#0066FF]/30 transition"
        >
          <div className="w-10 h-10 bg-[#0066FF]/8 rounded-lg flex items-center justify-center">
            <MapPin size={18} className="text-[#0066FF]" />
          </div>
          <span className="text-xs font-medium text-[#1A1A2E]">Customers</span>
        </button>
      </motion.div>

      {/* Today's Route */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
        className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
          <h3 className="font-semibold text-[#1A1A2E] text-sm">Today&apos;s Route</h3>
          {todayStops.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#10B981] rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-[#64748B] tabular-nums">
                {completedCount}/{todayStops.length}
              </span>
            </div>
          )}
        </div>
        {todayStops.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
            <p className="text-[#64748B] text-sm">No stops scheduled today</p>
            <p className="text-[#94A3B8] text-xs mt-1">Add customers to your {dayNames[today.getDay()]} route</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {sortedStops.map((stop: { id: string; stop_order: number; estimated_duration_minutes: number; customer_id: string; customers: { name: string; address: string } }, index: number) => {
              const isCompleted = completedStops?.[stop.id];
              return (
                <div
                  key={stop.id}
                  onClick={() => handleStopClick(stop)}
                  className={`px-5 py-3.5 flex items-center gap-3 transition cursor-pointer ${
                    isCompleted ? 'bg-[#F0FDF4]' : 'hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold transition-all ${
                      isCompleted ? 'bg-[#10B981] text-white' : 'bg-[#F1F5F9] text-[#64748B]'
                    }`}
                  >
                    {isCompleted ? <Check size={14} strokeWidth={3} /> : index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isCompleted ? 'text-[#94A3B8] line-through' : 'text-[#1A1A2E]'}`}>
                      {stop.customers?.name}
                    </p>
                    <p className="text-xs text-[#94A3B8] truncate">{stop.customers?.address}</p>
                  </div>
                  <div className="shrink-0">
                    {isCompleted ? (
                      <span className="text-[10px] font-medium bg-[#10B981]/10 text-[#10B981] px-2 py-0.5 rounded-full">Done</span>
                    ) : (
                      <span className="text-xs text-[#94A3B8] tabular-nums">{stop.estimated_duration_minutes}m</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Recent Activity */}
      {recentLogs && recentLogs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-[#F1F5F9]">
            <h3 className="font-semibold text-[#1A1A2E] text-sm">Recent Services</h3>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {recentLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#0066FF]/6 text-[#0066FF] flex items-center justify-center shrink-0">
                  <Droplets size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A2E] truncate">{log.customers?.name}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {log.ph_level && `pH ${log.ph_level}`}
                    {log.chlorine_level && ` · Cl ${log.chlorine_level}`}
                  </p>
                </div>
                <span className="text-xs text-[#94A3B8] shrink-0">
                  {format(new Date(log.service_date), 'MMM d')}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {showServiceLog && (
        <ServiceLogModal
          open={showServiceLog}
          onClose={() => { setShowServiceLog(false); setServiceLogCustomerId(undefined); }}
          orgId={orgId}
          technicianId={userData?.id ?? ''}
          preselectedCustomerId={serviceLogCustomerId}
        />
      )}

      <Modal open={showCalculator} onClose={() => setShowCalculator(false)} title="Chemical Dosing Calculator" size="md">
        <StandaloneDosingCalculator />
      </Modal>
    </div>
  );
}
