'use client';

import { useState, useMemo } from 'react';
import { useRoutes, useServiceLogs } from '@/lib/hooks';
import { ChevronLeft, ChevronRight, MapPin, Clock, CheckCircle2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarTab({ orgId }: { orgId: string }) {
  const { data: routes } = useRoutes(orgId);
  const { data: serviceLogs } = useServiceLogs();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Map routes to their days of week
  const routesByDay = useMemo(() => {
    const map = new Map<number, typeof routes>();
    routes?.forEach(route => {
      const existing = map.get(route.day_of_week) ?? [];
      existing.push(route);
      map.set(route.day_of_week, existing);
    });
    return map;
  }, [routes]);

  // Map service logs by date
  const logsByDate = useMemo(() => {
    const map = new Map<string, number>();
    serviceLogs?.forEach(log => {
      const key = log.service_date;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [serviceLogs]);

  const getRoutesForDate = (date: Date) => {
    const dayOfWeek = date.getDay();
    return routesByDay.get(dayOfWeek) ?? [];
  };

  const getCompletedCount = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    return logsByDate.get(key) ?? 0;
  };

  const today = new Date();

  // Selected date details
  const selectedRoutes = selectedDate ? getRoutesForDate(selectedDate) : [];
  const selectedCompleted = selectedDate ? getCompletedCount(selectedDate) : 0;
  const totalStopsSelected = selectedRoutes.reduce((sum, r) => sum + (r.route_stops?.length ?? 0), 0);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[#1A1A2E]">Calendar</h2>

      {/* Month Navigation */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 hover:bg-[#F8FAFC] rounded-lg transition"
          >
            <ChevronLeft size={16} className="text-[#64748B]" />
          </button>
          <h3 className="text-sm font-semibold text-[#1A1A2E]">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1.5 hover:bg-[#F8FAFC] rounded-lg transition"
          >
            <ChevronRight size={16} className="text-[#64748B]" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-[#F1F5F9]">
          {DAY_NAMES.map(day => (
            <div key={day} className="py-2 text-center text-[10px] font-semibold text-[#94A3B8] uppercase">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const inMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, today);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const dayRoutes = getRoutesForDate(day);
            const hasRoutes = dayRoutes.length > 0;
            const completedCount = getCompletedCount(day);
            const totalStops = dayRoutes.reduce((sum, r) => sum + (r.route_stops?.length ?? 0), 0);

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(day)}
                className={`relative py-2 px-1 min-h-[52px] flex flex-col items-center gap-0.5 transition border-b border-r border-[#F8FAFC] ${
                  !inMonth ? 'opacity-30' : ''
                } ${isSelected ? 'bg-[#0066FF]/5' : 'hover:bg-[#F8FAFC]'}`}
              >
                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-[#0066FF] text-white' : isSelected ? 'text-[#0066FF] font-bold' : 'text-[#1A1A2E]'
                }`}>
                  {format(day, 'd')}
                </span>
                {hasRoutes && inMonth && (
                  <div className="flex items-center gap-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${completedCount >= totalStops && totalStops > 0 ? 'bg-[#10B981]' : 'bg-[#0066FF]'}`} />
                    {totalStops > 0 && (
                      <span className="text-[8px] text-[#94A3B8] font-medium">{totalStops}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Details */}
      <AnimatePresence mode="wait">
        {selectedDate && (
          <motion.div
            key={format(selectedDate, 'yyyy-MM-dd')}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#1A1A2E]">
                  {format(selectedDate, 'EEEE, MMM d')}
                </h3>
                {selectedCompleted > 0 && (
                  <span className="text-xs text-[#10B981] font-medium flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    {selectedCompleted} completed
                  </span>
                )}
              </div>

              {selectedRoutes.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-[#94A3B8]">No routes scheduled</p>
                </div>
              ) : (
                <div className="divide-y divide-[#F1F5F9]">
                  {selectedRoutes.map(route => {
                    const stops = [...(route.route_stops ?? [])].sort((a, b) => a.stop_order - b.stop_order);
                    const totalTime = stops.reduce((sum, s) => sum + s.estimated_duration_minutes, 0);

                    return (
                      <div key={route.id} className="p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-[#0066FF]/8 rounded-lg flex items-center justify-center">
                            <MapPin size={14} className="text-[#0066FF]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1A1A2E]">{route.name}</p>
                            <p className="text-xs text-[#94A3B8]">
                              {stops.length} stops
                              {totalTime > 0 && (
                                <> · <Clock size={10} className="inline" /> ~{Math.floor(totalTime / 60)}h {totalTime % 60}m</>
                              )}
                              {route.users?.name && <> · {route.users.name}</>}
                            </p>
                          </div>
                        </div>
                        {stops.length > 0 && (
                          <div className="ml-11 space-y-1">
                            {stops.map((stop, idx) => (
                              <div key={stop.id} className="flex items-center gap-2 text-xs">
                                <span className="w-4 h-4 rounded-full bg-[#F1F5F9] text-[#94A3B8] flex items-center justify-center text-[9px] font-bold shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="text-[#1A1A2E] truncate">{stop.customers?.name}</span>
                                <span className="text-[#CBD5E1] shrink-0">{stop.estimated_duration_minutes}m</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
