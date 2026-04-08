'use client';

import { useState } from 'react';
import { useDashboardStats, useServiceLogs, useUser, useCompletedStops, useToggleStopComplete } from '@/lib/hooks';
import { StatCard } from '@/components/ui/stat-card';
import { CardSkeleton } from '@/components/ui/skeleton';
import { ServiceLogModal } from './service-log-modal';
import { Users, Calendar, CheckCircle, Tag, Clock, MapPin, Droplets, Sun, Plus, ClipboardList, Check, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import Link from 'next/link';

export function DashboardTab({ orgId, onNavigate }: { orgId: string; onNavigate?: (tab: string) => void }) {
  const [showServiceLog, setShowServiceLog] = useState(false);
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

  const handleStopClick = (stop: { id: string; customer_id?: string }) => {
    const isCompleted = completedStops?.[stop.id];
    if (!isCompleted) {
      // Mark complete and open service log
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
      {/* Date Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Good {today.getHours() < 12 ? 'morning' : today.getHours() < 17 ? 'afternoon' : 'evening'}
          </h2>
          <p className="text-gray-500 text-sm">{dayNames[today.getDay()]}, {format(today, 'MMMM d, yyyy')}</p>
        </div>
        {todayStops.length > 0 && (
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" stroke="#e2e8f0" strokeWidth="4" fill="none" />
              <circle
                cx="28" cy="28" r="24"
                stroke={progressPercent === 100 ? '#10b981' : '#3b82f6'}
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - progressPercent / 100)}`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xs font-bold ${progressPercent === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                {progressPercent}%
              </span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Daily Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-500/20"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-xs font-medium uppercase tracking-wide">Today&apos;s Schedule</p>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-4xl font-bold">{todayStops.length}</span>
              <span className="text-blue-200 text-sm mb-1">stop{todayStops.length !== 1 ? 's' : ''}</span>
            </div>
            <p className="text-blue-200 text-xs mt-1">
              {completedCount === todayStops.length && todayStops.length > 0
                ? 'All stops completed! Great work.'
                : todayStops.length === 0
                  ? 'No stops scheduled today'
                  : `${todayStops.length - completedCount} remaining`}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Sun className="w-12 h-12 text-yellow-300" />
            <div className="flex items-center gap-2 text-xs text-blue-200">
              <span className="flex items-center gap-0.5">
                <Clock size={10} />
                {(() => {
                  const totalMin = todayStops.reduce((sum: number, s: { estimated_duration_minutes: number }) => sum + s.estimated_duration_minutes, 0);
                  return totalMin > 0 ? `~${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : '0h';
                })()}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Today's Stops"
          value={stats?.todayStops ?? 0}
          icon={Calendar}
          color="blue"
          delay={0.15}
        />
        <StatCard
          label="Completed"
          value={`${completedCount}/${todayStops.length || stats?.completedToday || 0}`}
          icon={CheckCircle}
          color="green"
          delay={0.2}
        />
        <StatCard
          label="Total Customers"
          value={stats?.totalCustomers ?? 0}
          icon={Users}
          color="purple"
          delay={0.25}
        />
        <StatCard
          label="Active Discounts"
          value={stats?.activeDiscounts ?? 0}
          icon={Tag}
          color="orange"
          delay={0.3}
        />
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
        className="grid grid-cols-3 gap-3"
      >
        <button
          onClick={() => { setServiceLogCustomerId(undefined); setShowServiceLog(true); }}
          className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 font-medium shadow-sm shadow-emerald-500/20 hover:shadow-md transition-shadow"
        >
          <ClipboardList size={20} />
          <span className="text-xs">Log Service</span>
        </button>
        <button
          onClick={() => onNavigate?.('customers')}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 font-medium shadow-sm shadow-blue-500/20 hover:shadow-md transition-shadow"
        >
          <Plus size={20} />
          <span className="text-xs">Add Customer</span>
        </button>
        <Link
          href="/onboarding"
          className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 font-medium shadow-sm shadow-purple-500/20 hover:shadow-md transition-shadow"
        >
          <UserPlus size={20} />
          <span className="text-xs">Onboard</span>
        </Link>
      </motion.div>

      {/* Today's Route */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Today&apos;s Route</h3>
          </div>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {completedCount}/{todayStops.length} done
          </span>
        </div>
        {todayStops.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No stops scheduled for today</p>
            <p className="text-gray-400 text-xs mt-1">Add customers to your {dayNames[today.getDay()]} route</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {todayStops
              .sort((a: { stop_order: number }, b: { stop_order: number }) => a.stop_order - b.stop_order)
              .map((stop: { id: string; stop_order: number; estimated_duration_minutes: number; customer_id: string; customers: { name: string; address: string } }, index: number) => {
                const isCompleted = completedStops?.[stop.id];
                return (
                  <motion.div
                    key={stop.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                    onClick={() => handleStopClick(stop)}
                    className={`px-5 py-3.5 flex items-center gap-4 transition cursor-pointer ${
                      isCompleted ? 'bg-emerald-50/50' : 'hover:bg-gray-50/50'
                    }`}
                  >
                    <button
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        isCompleted
                          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                          : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                      }`}
                    >
                      {isCompleted ? <Check size={16} strokeWidth={3} /> : <span className="font-bold text-sm">{index + 1}</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate transition ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {stop.customers?.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{stop.customers?.address}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {isCompleted ? (
                        <span className="text-[10px] font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Done</span>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock size={12} />
                          <span>{stop.estimated_duration_minutes}min</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
          </div>
        )}
      </motion.div>

      {/* Recent Activity */}
      {recentLogs && recentLogs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-cyan-600" />
              <h3 className="font-semibold text-gray-900">Recent Services</h3>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {recentLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                  <Droplets size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{log.customers?.name}</p>
                  <p className="text-xs text-gray-500">
                    {log.ph_level && `pH ${log.ph_level}`}
                    {log.chlorine_level && ` · Cl ${log.chlorine_level}`}
                    {log.notes && ` · ${log.notes.substring(0, 30)}...`}
                  </p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {format(new Date(log.service_date), 'MMM d')}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Service Log Modal */}
      {showServiceLog && (
        <ServiceLogModal
          open={showServiceLog}
          onClose={() => { setShowServiceLog(false); setServiceLogCustomerId(undefined); }}
          orgId={orgId}
          technicianId={userData?.id ?? ''}
          preselectedCustomerId={serviceLogCustomerId}
        />
      )}
    </div>
  );
}
