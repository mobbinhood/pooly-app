'use client';

import { useState } from 'react';
import { useRoutes, useCreateRoute, useDeleteRoute, useUpdateStopOrder, useRemoveRouteStop, useAddRouteStop, useCustomers, useTechnicians, useCompletedStops, useToggleStopComplete } from '@/lib/hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { routeSchema, type RouteInput } from '@/lib/validations';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, MapPin, GripVertical, Trash2, UserPlus, ChevronDown, ChevronUp, Clock, Loader2, Route, AlertTriangle, Navigation, Car, Gauge, BarChart3, Fuel, Leaf, CheckCircle2, Circle, Copy, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcRouteDistance(stops: { customers: { latitude?: number | null; longitude?: number | null } }[]): number | null {
  const coords = stops
    .filter(s => s.customers?.latitude && s.customers?.longitude)
    .map(s => ({ lat: s.customers.latitude!, lng: s.customers.longitude! }));
  if (coords.length < 2) return null;
  let dist = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    dist += haversine(coords[i].lat, coords[i].lng, coords[i + 1].lat, coords[i + 1].lng);
  }
  return Math.round(dist * 10) / 10;
}

// Estimate drive time: ~25 mph average for local pool service routes + 5 min per stop for parking/arrival
function estimateDriveMinutes(distMiles: number, stopCount: number): number {
  return Math.round((distMiles / 25) * 60) + (stopCount * 5);
}

// Build Apple Maps multi-stop directions URL
function buildMapsUrl(stops: { customers: { address?: string; latitude?: number | null; longitude?: number | null } }[]): string | null {
  const coords = stops
    .filter(s => s.customers?.latitude && s.customers?.longitude)
    .map(s => ({ lat: s.customers.latitude!, lng: s.customers.longitude! }));
  if (coords.length < 2) return null;
  const waypoints = coords.map(c => `${c.lat},${c.lng}`);
  return `https://maps.apple.com/?daddr=${waypoints.join('&daddr=')}`;
}

// Build Google Maps multi-stop directions URL
function buildGoogleMapsUrl(stops: { customers: { address?: string; latitude?: number | null; longitude?: number | null } }[]): string | null {
  const coords = stops
    .filter(s => s.customers?.latitude && s.customers?.longitude)
    .map(s => ({ lat: s.customers.latitude!, lng: s.customers.longitude! }));
  if (coords.length < 2) return null;
  const origin = `${coords[0].lat},${coords[0].lng}`;
  const destination = `${coords[coords.length - 1].lat},${coords[coords.length - 1].lng}`;
  const waypts = coords.slice(1, -1).map(c => `${c.lat},${c.lng}`).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypts ? `&waypoints=${waypts}` : ''}`;
}

// Suggest rebalancing: find routes with too many/few stops
function getRebalanceSuggestions(routes: { id: string; name: string; day_of_week: number; route_stops?: { id: string }[] }[]): string[] {
  if (routes.length < 2) return [];
  const stopCounts = routes.map(r => ({ name: r.name, count: r.route_stops?.length ?? 0 }));
  const avg = stopCounts.reduce((s, r) => s + r.count, 0) / stopCounts.length;
  if (avg === 0) return [];
  const suggestions: string[] = [];
  const overloaded = stopCounts.filter(r => r.count > avg * 1.5 && r.count >= 3);
  const underloaded = stopCounts.filter(r => r.count < avg * 0.5 && r.count >= 1);
  for (const heavy of overloaded) {
    if (underloaded.length > 0) {
      suggestions.push(`Move stops from "${heavy.name}" (${heavy.count}) to "${underloaded[0].name}" (${underloaded[0].count}) for better balance`);
    } else {
      suggestions.push(`"${heavy.name}" has ${heavy.count} stops — consider splitting into two routes`);
    }
  }
  return suggestions;
}

// Route efficiency: ratio of straight-line distance to actual route distance (higher = more efficient)
function routeEfficiency(stops: { customers: { latitude?: number | null; longitude?: number | null } }[]): number | null {
  const coords = stops
    .filter(s => s.customers?.latitude && s.customers?.longitude)
    .map(s => ({ lat: s.customers.latitude!, lng: s.customers.longitude! }));
  if (coords.length < 3) return null;
  const routeDist = calcRouteDistance(stops);
  if (!routeDist || routeDist === 0) return null;
  // Sum of all pairwise min distances as baseline
  const straightLine = haversine(coords[0].lat, coords[0].lng, coords[coords.length - 1].lat, coords[coords.length - 1].lng);
  if (straightLine === 0) return 100;
  // Efficiency = how close to optimal (straight-line / actual * 100), capped at 100
  return Math.min(100, Math.round((straightLine / routeDist) * 100));
}

function efficiencyColor(score: number): string {
  if (score >= 70) return 'text-[#10B981]';
  if (score >= 40) return 'text-[#F59E0B]';
  return 'text-[#EF4444]';
}

function efficiencyLabel(score: number): string {
  if (score >= 70) return 'Efficient';
  if (score >= 40) return 'Fair';
  return 'Needs Optimization';
}

// Estimate fuel cost at ~$3.50/gal, 20 mpg for service truck
function estimateFuelCost(miles: number): number {
  return Math.round((miles / 20) * 3.5 * 100) / 100;
}

export function RoutesTab({ orgId }: { orgId: string }) {
  const { data: routes, isLoading } = useRoutes(orgId);
  const createRoute = useCreateRoute();
  const deleteRoute = useDeleteRoute();
  const updateStopOrder = useUpdateStopOrder();
  const removeStop = useRemoveRouteStop();
  const addStop = useAddRouteStop();
  const { data: customers } = useCustomers(orgId);
  const { data: technicians } = useTechnicians(orgId);
  const { data: completedStops } = useCompletedStops();
  const toggleComplete = useToggleStopComplete();

  const [showForm, setShowForm] = useState(false);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [addStopRoute, setAddStopRoute] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [optimizing, setOptimizing] = useState<string | null>(null);
  const [optimizeResults, setOptimizeResults] = useState<Record<string, {
    original_miles: number; total_miles: number; saved_miles: number; saved_pct: number;
    clusters: number; longest_leg: number; geocoded: number;
    co2_saved_lbs: number; fuel_saved_gallons: number; time_saved_minutes: number;
    cluster_details: { center_lat: number; center_lng: number; stop_count: number; radius_miles: number }[];
  }>>({});
  const queryClient = useQueryClient();

  const handleOptimizeRoute = async (routeId: string) => {
    setOptimizing(routeId);
    try {
      const res = await fetch('/api/routes/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_id: routeId }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.saved_miles > 0) {
          setOptimizeResults(prev => ({ ...prev, [routeId]: {
            original_miles: data.original_miles,
            total_miles: data.total_miles,
            saved_miles: data.saved_miles,
            saved_pct: data.saved_pct,
            clusters: data.clusters,
            longest_leg: data.longest_leg,
            geocoded: data.geocoded,
            co2_saved_lbs: data.co2_saved_lbs ?? 0,
            fuel_saved_gallons: data.fuel_saved_gallons ?? 0,
            time_saved_minutes: data.time_saved_minutes ?? 0,
            cluster_details: data.cluster_details ?? [],
          }}));
          toast.success(`Optimized — saved ${data.saved_miles} mi (${data.saved_pct}% shorter)`);
        } else {
          toast.success(data.message || 'Route already optimal');
        }
        if (data.geocoded > 0) toast.success(`${data.geocoded} address${data.geocoded > 1 ? 'es' : ''} geocoded`);
        await queryClient.invalidateQueries({ queryKey: ['routes'] });
      } else {
        toast.error(data.error || 'Failed to optimize');
      }
    } catch {
      toast.error('Failed to optimize route');
    } finally {
      setOptimizing(null);
    }
  };

  const handleDragEnd = (routeId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const route = routes?.find(r => r.id === routeId);
    if (!route) return;
    const stops = [...route.route_stops].sort((a, b) => a.stop_order - b.stop_order);
    const oldIndex = stops.findIndex(s => s.id === active.id);
    const newIndex = stops.findIndex(s => s.id === over.id);
    const reordered = [...stops];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    updateStopOrder.mutate(reordered.map((s, i) => ({ id: s.id, stop_order: i })));
  };

  const handleAddStop = async () => {
    if (!addStopRoute || !selectedCustomer) return;
    const route = routes?.find(r => r.id === addStopRoute);
    const maxOrder = Math.max(0, ...(route?.route_stops?.map(s => s.stop_order) ?? [0]));
    await addStop.mutateAsync({
      route_id: addStopRoute,
      customer_id: selectedCustomer,
      stop_order: maxOrder + 1,
      estimated_duration_minutes: 30,
    });
    setAddStopRoute(null);
    setSelectedCustomer('');
  };

  if (isLoading) return <ListSkeleton rows={5} />;

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#1A1A2E]">Routes</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[#0066FF] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-[#0052CC] transition"
        >
          <Plus size={14} />
          New Route
        </button>
      </div>

      {/* Route Summary */}
      {/* Today's Progress */}
      {routes && routes.length > 0 && (() => {
        const today = new Date().getDay();
        const todayRoutes = routes.filter(r => r.day_of_week === today);
        if (todayRoutes.length === 0) return null;
        const todayStops = todayRoutes.flatMap(r => r.route_stops ?? []);
        const doneCount = todayStops.filter(s => completedStops?.[s.id]).length;
        const totalToday = todayStops.length;
        const pct = totalToday > 0 ? Math.round((doneCount / totalToday) * 100) : 0;
        if (totalToday === 0) return null;
        return (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-[#0066FF]" />
                <h3 className="text-sm font-semibold text-[#1A1A2E]">Today&apos;s Progress</h3>
              </div>
              <span className={`text-sm font-bold ${pct === 100 ? 'text-[#10B981]' : 'text-[#0066FF]'}`}>
                {doneCount}/{totalToday}
              </span>
            </div>
            <div className="w-full h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-[#10B981]' : 'bg-[#0066FF]'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-[#94A3B8]">{todayRoutes.length} route{todayRoutes.length !== 1 ? 's' : ''} today</span>
              <span className="text-[10px] text-[#94A3B8]">{pct}% complete</span>
            </div>
          </div>
        );
      })()}

      {routes && routes.length > 0 && (() => {
        const totalStops = routes.reduce((sum, r) => sum + (r.route_stops?.length ?? 0), 0);
        const totalMiles = routes.reduce((sum, r) => {
          const dist = calcRouteDistance([...(r.route_stops ?? [])].sort((a, b) => a.stop_order - b.stop_order));
          return sum + (dist ?? 0);
        }, 0);
        const totalServiceMinutes = routes.reduce((sum, r) =>
          sum + (r.route_stops ?? []).reduce((s, stop) => s + stop.estimated_duration_minutes, 0), 0);
        const ungeocodedTotal = routes.reduce((sum, r) =>
          sum + (r.route_stops ?? []).filter(s => !s.customers?.latitude || !s.customers?.longitude).length, 0);
        const fuelCost = estimateFuelCost(totalMiles);
        // Workload balance: stops per day distribution
        const dayDistribution = Array(7).fill(0);
        routes.forEach(r => { dayDistribution[r.day_of_week] += r.route_stops?.length ?? 0; });
        const activeDays = dayDistribution.filter(d => d > 0);
        const avgPerDay = activeDays.length > 0 ? activeDays.reduce((s, d) => s + d, 0) / activeDays.length : 0;
        const maxDev = activeDays.length > 1 ? Math.max(...activeDays.map(d => Math.abs(d - avgPerDay))) : 0;
        const isBalanced = avgPerDay > 0 ? maxDev / avgPerDay < 0.4 : true;
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white rounded-xl p-3 border border-[#E2E8F0] text-center">
                <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Routes</p>
                <p className="text-lg font-bold text-[#1A1A2E] mt-0.5">{routes.length}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-[#E2E8F0] text-center">
                <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Stops</p>
                <p className="text-lg font-bold text-[#0066FF] mt-0.5">{totalStops}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-[#E2E8F0] text-center">
                <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Miles</p>
                <p className="text-lg font-bold text-[#1A1A2E] mt-0.5">{Math.round(totalMiles * 10) / 10}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-[#E2E8F0] text-center">
                <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Fuel Est</p>
                <p className="text-lg font-bold text-[#1A1A2E] mt-0.5">${fuelCost}</p>
              </div>
            </div>
            {/* Workload Balance */}
            {activeDays.length >= 2 && (
              <div className="bg-white rounded-xl p-3 border border-[#E2E8F0]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider flex items-center gap-1">
                    <BarChart3 size={10} /> Daily Workload
                  </p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isBalanced ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#F59E0B]/10 text-[#F59E0B]'}`}>
                    {isBalanced ? 'Balanced' : 'Uneven'}
                  </span>
                </div>
                <div className="flex items-end gap-1 h-8">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                    const count = dayDistribution[(i + 1) % 7]; // Monday=1
                    const maxCount = Math.max(...dayDistribution, 1);
                    const height = count > 0 ? Math.max(20, (count / maxCount) * 100) : 4;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className={`w-full rounded-sm transition-all ${count > 0 ? 'bg-[#0066FF]' : 'bg-[#F1F5F9]'}`}
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-[8px] text-[#94A3B8]">{day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {ungeocodedTotal > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">
                  {ungeocodedTotal} stop{ungeocodedTotal !== 1 ? 's' : ''} across routes missing coordinates — run optimize to auto-geocode
                </p>
              </div>
            )}
            {/* Rebalancing Suggestions */}
            {(() => {
              const suggestions = getRebalanceSuggestions(routes);
              if (suggestions.length === 0) return null;
              return (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <BarChart3 size={10} /> Rebalancing Suggestions
                  </p>
                  {suggestions.map((s, i) => (
                    <p key={i} className="text-xs text-blue-700 flex items-start gap-1.5">
                      <span className="w-1 h-1 bg-blue-400 rounded-full mt-1.5 shrink-0" />
                      {s}
                    </p>
                  ))}
                </div>
              );
            })()}
            {routes.length >= 2 && totalStops >= 4 && (
              <button
                onClick={async () => {
                  for (const route of routes) {
                    if ((route.route_stops?.length ?? 0) >= 2) {
                      await handleOptimizeRoute(route.id);
                    }
                  }
                }}
                disabled={!!optimizing}
                className="w-full py-2.5 bg-[#10B981] text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {optimizing ? <Loader2 size={14} className="animate-spin" /> : <Route size={14} />}
                Optimize All Routes
              </button>
            )}
            {/* Total optimization summary */}
            {Object.keys(optimizeResults).length > 0 && (() => {
              const results = Object.values(optimizeResults);
              const totalSavedMiles = results.reduce((s, r) => s + r.saved_miles, 0);
              const totalOriginal = results.reduce((s, r) => s + r.original_miles, 0);
              const totalOptimized = results.reduce((s, r) => s + r.total_miles, 0);
              const totalCo2Saved = Math.round(results.reduce((s, r) => s + r.co2_saved_lbs, 0) * 10) / 10;
              const totalFuelGalSaved = Math.round(results.reduce((s, r) => s + r.fuel_saved_gallons, 0) * 100) / 100;
              const totalTimeSavedMin = results.reduce((s, r) => s + r.time_saved_minutes, 0);
              const totalFuelCostSaved = Math.round((totalSavedMiles / 20) * 3.5 * 100) / 100;
              const monthlySavings = Math.round(totalFuelCostSaved * 4.3 * 100) / 100;
              if (totalSavedMiles <= 0) return null;
              return (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-emerald-800 mb-2 flex items-center gap-1">
                    <Route size={12} /> Fleet Optimization Summary
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="text-center">
                      <p className="text-lg font-bold text-emerald-800">{Math.round(totalSavedMiles * 10) / 10} mi</p>
                      <p className="text-[10px] text-emerald-600">Miles saved/week</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-emerald-800">~{totalTimeSavedMin} min</p>
                      <p className="text-[10px] text-emerald-600">Drive time saved/week</p>
                    </div>
                  </div>
                  {/* Environmental savings totals */}
                  <div className="grid grid-cols-3 gap-2 mb-3 pt-2 border-t border-emerald-200">
                    <div className="text-center">
                      <Leaf size={11} className="inline text-[#10B981] mb-0.5" />
                      <p className="text-sm font-bold text-emerald-800">{totalCo2Saved}</p>
                      <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">CO2 lbs</p>
                    </div>
                    <div className="text-center">
                      <Fuel size={11} className="inline text-[#10B981] mb-0.5" />
                      <p className="text-sm font-bold text-emerald-800">{totalFuelGalSaved}</p>
                      <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Gal saved</p>
                    </div>
                    <div className="text-center">
                      <Clock size={11} className="inline text-[#10B981] mb-0.5" />
                      <p className="text-sm font-bold text-emerald-800">{totalTimeSavedMin}</p>
                      <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Min saved</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-emerald-700 pt-2 border-t border-emerald-200">
                    <span>{Math.round(totalOriginal * 10) / 10} mi → {Math.round(totalOptimized * 10) / 10} mi ({Math.round((totalSavedMiles / totalOriginal) * 100)}% reduction)</span>
                    <span>${monthlySavings}/mo fuel savings</span>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Weekly Schedule Overview */}
      {routes && routes.length >= 2 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F1F5F9]">
            <h3 className="text-sm font-semibold text-[#1A1A2E] flex items-center gap-2">
              <CalendarDays size={14} className="text-[#0066FF]" />
              Weekly Schedule
            </h3>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-7 gap-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                const dayIndex = (i + 1) % 7;
                const dayRoutes = routes.filter(r => r.day_of_week === dayIndex);
                const stopCount = dayRoutes.reduce((s, r) => s + (r.route_stops?.length ?? 0), 0);
                const isToday = new Date().getDay() === dayIndex;
                return (
                  <div key={day} className={`text-center rounded-lg p-1.5 ${isToday ? 'bg-[#0066FF]/5 ring-1 ring-[#0066FF]/20' : ''}`}>
                    <p className={`text-[9px] font-medium ${isToday ? 'text-[#0066FF]' : 'text-[#94A3B8]'}`}>{day}</p>
                    <p className={`text-sm font-bold mt-0.5 ${stopCount > 0 ? 'text-[#1A1A2E]' : 'text-[#CBD5E1]'}`}>{stopCount}</p>
                    <div className="mt-1 space-y-0.5">
                      {dayRoutes.slice(0, 2).map(r => (
                        <p key={r.id} className="text-[7px] text-[#64748B] truncate leading-tight">{r.name}</p>
                      ))}
                      {dayRoutes.length > 2 && (
                        <p className="text-[7px] text-[#94A3B8]">+{dayRoutes.length - 2}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#F1F5F9]">
              <span className="text-[10px] text-[#94A3B8]">
                {routes.reduce((s, r) => s + (r.route_stops?.length ?? 0), 0)} stops/week
              </span>
              <span className="text-[10px] text-[#94A3B8]">
                {new Set(routes.map(r => r.day_of_week)).size} active days
              </span>
            </div>
          </div>
        </div>
      )}

      {!routes?.length ? (
        <EmptyState
          icon={MapPin}
          title="No routes yet"
          description="Create your first route to start organizing stops"
          action={{ label: 'Create Route', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-3">
          {routes.map((route) => {
            const isExpanded = expandedRoute === route.id;
            const stops = [...(route.route_stops ?? [])].sort((a, b) => a.stop_order - b.stop_order);
            const totalTime = stops.reduce((sum, s) => sum + s.estimated_duration_minutes, 0);
            const routeDist = calcRouteDistance(stops);
            const driveMinutes = routeDist != null ? estimateDriveMinutes(routeDist, stops.length) : null;
            const mapsUrl = buildMapsUrl(stops);
            const googleMapsUrl = buildGoogleMapsUrl(stops);
            const ungeocodedCount = stops.filter(s => !s.customers?.latitude || !s.customers?.longitude).length;
            const efficiency = routeEfficiency(stops);
            const routeFuel = routeDist != null ? estimateFuelCost(routeDist) : null;

            return (
              <motion.div
                key={route.id}
                layout
                className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedRoute(isExpanded ? null : route.id)}
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold bg-[#0066FF]/8 text-[#0066FF]">
                    {DAY_NAMES[route.day_of_week].slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[#1A1A2E] text-sm">{route.name}</p>
                      {efficiency != null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          efficiency >= 70 ? 'bg-[#10B981]/10 text-[#10B981]' :
                          efficiency >= 40 ? 'bg-[#F59E0B]/10 text-[#F59E0B]' :
                          'bg-[#EF4444]/10 text-[#EF4444]'
                        }`}>
                          <Gauge size={8} className="inline mr-0.5" />{efficiency}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#64748B]">
                      {stops.length} stops
                      {totalTime > 0 && <> · <Clock size={10} className="inline" /> ~{Math.round(totalTime / 60)}h {totalTime % 60}m</>}
                      {routeDist != null && <> · <Route size={10} className="inline" /> {routeDist} mi</>}
                      {driveMinutes != null && <> · <Car size={10} className="inline" /> ~{driveMinutes >= 60 ? `${Math.floor(driveMinutes / 60)}h ${driveMinutes % 60}m` : `${driveMinutes}m`} drive</>}
                      {routeFuel != null && <> · <Fuel size={10} className="inline" /> ${routeFuel}</>}
                      {route.users?.name && <> · {route.users.name}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const nextDay = (route.day_of_week + 1) % 7;
                        try {
                          const newRoute = await createRoute.mutateAsync({
                            organization_id: orgId,
                            name: `${route.name} (copy)`,
                            day_of_week: nextDay,
                            technician_id: (route as unknown as { technician_id: string | null }).technician_id || undefined,
                          });
                          if (newRoute && stops.length > 0) {
                            for (let idx = 0; idx < stops.length; idx++) {
                              await addStop.mutateAsync({
                                route_id: (newRoute as { id: string }).id,
                                customer_id: (stops[idx] as unknown as { customer_id: string }).customer_id,
                                stop_order: idx,
                                estimated_duration_minutes: stops[idx].estimated_duration_minutes,
                              });
                            }
                          }
                          toast.success('Route duplicated');
                        } catch { toast.error('Failed to duplicate'); }
                      }}
                      className="p-1.5 hover:bg-[#0066FF]/5 rounded-lg text-[#94A3B8] hover:text-[#0066FF] transition"
                      title="Duplicate route"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(route.id); }}
                      className="p-1.5 hover:bg-[#EF4444]/5 rounded-lg text-[#94A3B8] hover:text-[#EF4444] transition"
                    >
                      <Trash2 size={14} />
                    </button>
                    {isExpanded ? <ChevronUp size={14} className="text-[#94A3B8]" /> : <ChevronDown size={14} className="text-[#94A3B8]" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-[#F1F5F9] px-4 py-3">
                        {/* Optimization Result */}
                        {optimizeResults[route.id] && (() => {
                          const r = optimizeResults[route.id];
                          const clusterColors = ['#0066FF', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899', '#06B6D4', '#F97316'];
                          const zoneLabels = 'ABCDEFGHIJKLMNOP';
                          return (
                            <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                                  <Route size={12} /> Optimization Results
                                </p>
                                <button onClick={() => setOptimizeResults(prev => { const n = { ...prev }; delete n[route.id]; return n; })} className="text-[10px] text-emerald-600 hover:text-emerald-800">Dismiss</button>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                  <p className="text-[10px] text-emerald-600 uppercase">Before</p>
                                  <p className="text-sm font-bold text-emerald-800 line-through opacity-60">{r.original_miles} mi</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-emerald-600 uppercase">After</p>
                                  <p className="text-sm font-bold text-emerald-800">{r.total_miles} mi</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-emerald-600 uppercase">Saved</p>
                                  <p className="text-sm font-bold text-emerald-800">{r.saved_pct}%</p>
                                </div>
                              </div>
                              {/* Environmental savings */}
                              <div className="mt-2 pt-2 border-t border-emerald-200 grid grid-cols-3 gap-2 text-center">
                                <div>
                                  <Leaf size={10} className="inline text-[#10B981] mb-0.5" />
                                  <p className="text-sm font-bold text-emerald-800">{r.co2_saved_lbs}</p>
                                  <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">CO2 lbs</p>
                                </div>
                                <div>
                                  <Fuel size={10} className="inline text-[#10B981] mb-0.5" />
                                  <p className="text-sm font-bold text-emerald-800">{r.fuel_saved_gallons}</p>
                                  <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Gal saved</p>
                                </div>
                                <div>
                                  <Clock size={10} className="inline text-[#10B981] mb-0.5" />
                                  <p className="text-sm font-bold text-emerald-800">{r.time_saved_minutes}</p>
                                  <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide font-medium">Min saved</p>
                                </div>
                              </div>
                              <div className="mt-2 pt-2 border-t border-emerald-200 flex flex-wrap gap-3 text-[10px] text-emerald-700">
                                {r.longest_leg > 3 && <span>Longest leg: {r.longest_leg} mi</span>}
                              </div>
                              {/* Zone clusters */}
                              {r.cluster_details && r.cluster_details.length >= 2 && (
                                <div className="mt-2 pt-2 border-t border-emerald-200 flex flex-wrap gap-1.5">
                                  {r.cluster_details.map((cluster, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                                      style={{ backgroundColor: clusterColors[idx % clusterColors.length] }}
                                    >
                                      Zone {zoneLabels[idx]}: {cluster.stop_count} stop{cluster.stop_count !== 1 ? 's' : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {ungeocodedCount > 0 && (
                          <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                            <p className="text-xs text-amber-700">
                              {ungeocodedCount} stop{ungeocodedCount !== 1 ? 's' : ''} missing coordinates — optimization may be limited
                            </p>
                          </div>
                        )}
                        {stops.length === 0 ? (
                          <p className="text-sm text-[#94A3B8] text-center py-4">No stops assigned</p>
                        ) : (
                          <DndContext collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(route.id, e)}>
                            <SortableContext items={stops.map(s => s.id)} strategy={verticalListSortingStrategy}>
                              <div className="space-y-1">
                                {stops.map((stop, idx) => {
                                  // Calculate distance to next stop
                                  let legDist: number | null = null;
                                  if (idx < stops.length - 1) {
                                    const cur = stop.customers;
                                    const next = stops[idx + 1].customers;
                                    if (cur?.latitude && cur?.longitude && next?.latitude && next?.longitude) {
                                      legDist = Math.round(haversine(cur.latitude, cur.longitude, next.latitude, next.longitude) * 10) / 10;
                                    }
                                  }
                                  return (
                                    <div key={stop.id}>
                                      <SortableStop
                                        stop={stop}
                                        index={idx}
                                        onRemove={() => removeStop.mutate(stop.id)}
                                        isCompleted={!!completedStops?.[stop.id]}
                                        onToggleComplete={() => toggleComplete.mutate({ stopId: stop.id, completed: !completedStops?.[stop.id] })}
                                        isToday={route.day_of_week === new Date().getDay()}
                                      />
                                      {legDist != null && (
                                        <div className="flex items-center gap-2 pl-10 py-0.5">
                                          <div className="w-px h-3 bg-[#E2E8F0]" />
                                          <span className="text-[10px] text-[#94A3B8] tabular-nums">{legDist} mi</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </SortableContext>
                          </DndContext>
                        )}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => setAddStopRoute(route.id)}
                            className="flex-1 py-2.5 border-2 border-dashed border-[#E2E8F0] rounded-lg text-sm text-[#64748B] hover:border-[#0066FF]/40 hover:text-[#0066FF] transition flex items-center justify-center gap-2"
                          >
                            <UserPlus size={14} />
                            Add Customer
                          </button>
                          {mapsUrl && (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-2.5 px-3 bg-[#0066FF] text-white rounded-lg text-sm font-medium hover:bg-[#0052CC] transition flex items-center justify-center gap-1.5"
                              title="Open in Apple Maps"
                            >
                              <Navigation size={14} />
                            </a>
                          )}
                          {googleMapsUrl && (
                            <a
                              href={googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-2.5 px-3 bg-[#4285F4] text-white rounded-lg text-sm font-medium hover:bg-[#3367D6] transition flex items-center justify-center gap-1.5"
                              title="Open in Google Maps"
                            >
                              <MapPin size={14} />
                            </a>
                          )}
                          {stops.length >= 2 && (
                            <button
                              onClick={() => handleOptimizeRoute(route.id)}
                              disabled={optimizing === route.id}
                              className="py-2.5 px-4 bg-[#10B981] text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {optimizing === route.id ? <Loader2 size={14} className="animate-spin" /> : <Route size={14} />}
                              Optimize
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      <RouteFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        orgId={orgId}
        technicians={technicians ?? []}
        onCreate={createRoute.mutateAsync}
        isSubmitting={createRoute.isPending}
      />

      <Modal open={!!addStopRoute} onClose={() => setAddStopRoute(null)} title="Add Customer to Route" size="sm">
        <div className="space-y-4">
          {(() => {
            const currentRoute = routes?.find(r => r.id === addStopRoute);
            const existingIds = new Set(currentRoute?.route_stops?.map(s => (s as unknown as { customer_id: string }).customer_id) ?? []);
            const routeCenter = (() => {
              const coords = (currentRoute?.route_stops ?? [])
                .filter(s => s.customers?.latitude && s.customers?.longitude)
                .map(s => ({ lat: s.customers.latitude!, lng: s.customers.longitude! }));
              if (coords.length === 0) return null;
              return {
                lat: coords.reduce((s, c) => s + c.lat, 0) / coords.length,
                lng: coords.reduce((s, c) => s + c.lng, 0) / coords.length,
              };
            })();
            const available = customers
              ?.filter(c => !existingIds.has(c.id))
              .map(c => {
                const dist = routeCenter && c.latitude && c.longitude
                  ? haversine(routeCenter.lat, routeCenter.lng, c.latitude, c.longitude)
                  : null;
                return { ...c, dist };
              })
              .sort((a, b) => {
                if (a.dist != null && b.dist != null) return a.dist - b.dist;
                if (a.dist != null) return -1;
                if (b.dist != null) return 1;
                return a.name.localeCompare(b.name);
              }) ?? [];
            return (
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className={inputClass}
              >
                <option value="">Select customer{routeCenter ? ' (sorted by proximity)' : ''}...</option>
                {available.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.address}{c.dist != null ? ` (${Math.round(c.dist * 10) / 10} mi)` : ''}
                  </option>
                ))}
              </select>
            );
          })()}
          <button
            onClick={handleAddStop}
            disabled={!selectedCustomer || addStop.isPending}
            className="w-full py-2.5 bg-[#0066FF] text-white rounded-lg font-medium text-sm hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {addStop.isPending && <Loader2 size={14} className="animate-spin" />}
            Add to Route
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget ? deleteRoute.mutateAsync(deleteTarget) : Promise.resolve()}
        title="Delete Route"
        message="This will remove the route and all its stops. Continue?"
      />
    </div>
  );
}

function SortableStop({ stop, index, onRemove, isCompleted, onToggleComplete, isToday }: {
  stop: { id: string; customers: { name: string; address: string }; estimated_duration_minutes: number };
  index: number;
  onRemove: () => void;
  isCompleted: boolean;
  onToggleComplete: () => void;
  isToday: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 group ${isCompleted ? 'bg-[#10B981]/5' : 'bg-[#F8FAFC]'}`}>
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-[#CBD5E1] hover:text-[#94A3B8] touch-none">
        <GripVertical size={14} />
      </button>
      {isToday ? (
        <button
          onClick={onToggleComplete}
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition"
        >
          {isCompleted ? (
            <CheckCircle2 size={18} className="text-[#10B981]" />
          ) : (
            <Circle size={18} className="text-[#CBD5E1] hover:text-[#0066FF]" />
          )}
        </button>
      ) : (
        <div className="w-6 h-6 rounded-full bg-[#0066FF]/8 text-[#0066FF] flex items-center justify-center text-xs font-bold shrink-0">
          {index + 1}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isCompleted ? 'text-[#94A3B8] line-through' : 'text-[#1A1A2E]'}`}>{stop.customers?.name}</p>
        <p className="text-xs text-[#94A3B8] truncate">{stop.customers?.address}</p>
      </div>
      <span className="text-xs text-[#94A3B8] tabular-nums">{stop.estimated_duration_minutes}m</span>
      <button
        onClick={onRemove}
        className="p-1.5 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-[#EF4444]/5 rounded-lg text-[#94A3B8] hover:text-[#EF4444] transition"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function RouteFormModal({
  open, onClose, orgId, technicians, onCreate, isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  technicians: { id: string; name: string }[];
  onCreate: (input: { organization_id: string; name: string; day_of_week: number; technician_id?: string }) => Promise<unknown>;
  isSubmitting: boolean;
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<RouteInput>({
    resolver: zodResolver(routeSchema),
  });

  const onSubmit = async (data: RouteInput) => {
    await onCreate({ ...data, organization_id: orgId });
    reset();
    onClose();
  };

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  return (
    <Modal open={open} onClose={onClose} title="New Route" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Route Name</label>
          <input {...register('name')} className={inputClass} placeholder="Monday AM Route" />
          {errors.name && <p className="text-[#EF4444] text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Day of Week</label>
          <select {...register('day_of_week', { valueAsNumber: true })} className={inputClass}>
            {DAY_NAMES.map((day, i) => (
              <option key={i} value={i}>{day}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Technician</label>
          <select {...register('technician_id')} className={inputClass}>
            <option value="">Unassigned</option>
            {technicians.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 bg-[#0066FF] text-white rounded-lg font-medium text-sm hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          Create Route
        </button>
      </form>
    </Modal>
  );
}
