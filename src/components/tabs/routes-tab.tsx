'use client';

import { useState } from 'react';
import { useRoutes, useCreateRoute, useDeleteRoute, useUpdateStopOrder, useRemoveRouteStop, useAddRouteStop, useCustomers, useTechnicians } from '@/lib/hooks';
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
import { Plus, MapPin, GripVertical, Trash2, UserPlus, ChevronDown, ChevronUp, Clock, Loader2, Route, AlertTriangle } from 'lucide-react';
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

export function RoutesTab({ orgId }: { orgId: string }) {
  const { data: routes, isLoading } = useRoutes(orgId);
  const createRoute = useCreateRoute();
  const deleteRoute = useDeleteRoute();
  const updateStopOrder = useUpdateStopOrder();
  const removeStop = useRemoveRouteStop();
  const addStop = useAddRouteStop();
  const { data: customers } = useCustomers(orgId);
  const { data: technicians } = useTechnicians(orgId);

  const [showForm, setShowForm] = useState(false);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [addStopRoute, setAddStopRoute] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [optimizing, setOptimizing] = useState<string | null>(null);
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
        let msg = data.saved_miles > 0
          ? `Optimized — saved ${data.saved_miles} mi (${data.total_miles} mi total)`
          : data.message || 'Route optimized';
        if (data.geocoded > 0) msg += ` · ${data.geocoded} address${data.geocoded > 1 ? 'es' : ''} geocoded`;
        toast.success(msg);
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
            const ungeocodedCount = stops.filter(s => !s.customers?.latitude || !s.customers?.longitude).length;

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
                    <p className="font-medium text-[#1A1A2E] text-sm">{route.name}</p>
                    <p className="text-xs text-[#64748B]">
                      {stops.length} stops
                      {totalTime > 0 && <> · <Clock size={10} className="inline" /> ~{Math.round(totalTime / 60)}h {totalTime % 60}m</>}
                      {routeDist != null && <> · <Route size={10} className="inline" /> {routeDist} mi{stops.length > 1 && <> ({(routeDist / (stops.length - 1)).toFixed(1)} mi/leg)</>}</>}
                      {route.users?.name && <> · {route.users.name}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
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
                                      <SortableStop stop={stop} index={idx} onRemove={() => removeStop.mutate(stop.id)} />
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
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className={inputClass}
          >
            <option value="">Select customer...</option>
            {customers?.map(c => (
              <option key={c.id} value={c.id}>{c.name} - {c.address}</option>
            ))}
          </select>
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

function SortableStop({ stop, index, onRemove }: {
  stop: { id: string; customers: { name: string; address: string }; estimated_duration_minutes: number };
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-[#F8FAFC] rounded-lg px-3 py-2.5 group">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-[#CBD5E1] hover:text-[#94A3B8] touch-none">
        <GripVertical size={14} />
      </button>
      <div className="w-6 h-6 rounded-full bg-[#0066FF]/8 text-[#0066FF] flex items-center justify-center text-xs font-bold shrink-0">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1A1A2E] truncate">{stop.customers?.name}</p>
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
