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
import { Plus, MapPin, GripVertical, Trash2, UserPlus, ChevronDown, ChevronUp, Clock, Loader2, Route } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_COLORS = ['bg-gray-100 text-gray-700', 'bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-yellow-100 text-yellow-700', 'bg-purple-100 text-purple-700', 'bg-pink-100 text-pink-700', 'bg-orange-100 text-orange-700'];

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
        toast.success(data.message || 'Route optimized');
        // Refetch routes after optimization
        window.location.reload();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Routes</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium hover:bg-blue-700 transition shadow-sm shadow-blue-600/20"
        >
          <Plus size={16} />
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

            return (
              <motion.div
                key={route.id}
                layout
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedRoute(isExpanded ? null : route.id)}
                  className="w-full px-4 py-4 flex items-center gap-3 text-left"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${DAY_COLORS[route.day_of_week]}`}>
                    {DAY_NAMES[route.day_of_week].slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{route.name}</p>
                    <p className="text-xs text-gray-500">
                      {stops.length} stops
                      {totalTime > 0 && <> · <Clock size={10} className="inline" /> ~{Math.round(totalTime / 60)}h {totalTime % 60}m</>}
                      {route.users?.name && <> · {route.users.name}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(route.id); }}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
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
                      <div className="border-t border-gray-50 px-4 py-3">
                        {stops.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-4">No stops assigned</p>
                        ) : (
                          <DndContext collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(route.id, e)}>
                            <SortableContext items={stops.map(s => s.id)} strategy={verticalListSortingStrategy}>
                              <div className="space-y-2">
                                {stops.map((stop, idx) => (
                                  <SortableStop
                                    key={stop.id}
                                    stop={stop}
                                    index={idx}
                                    onRemove={() => removeStop.mutate(stop.id)}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                        )}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => setAddStopRoute(route.id)}
                            className="flex-1 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2"
                          >
                            <UserPlus size={14} />
                            Add Customer
                          </button>
                          {stops.length >= 2 && (
                            <button
                              onClick={() => handleOptimizeRoute(route.id)}
                              disabled={optimizing === route.id}
                              className="py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-medium hover:from-emerald-600 hover:to-teal-600 transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm shadow-emerald-500/20"
                            >
                              {optimizing === route.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Route size={14} />
                              )}
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

      {/* Create Route Modal */}
      <RouteFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        orgId={orgId}
        technicians={technicians ?? []}
        onCreate={createRoute.mutateAsync}
        isSubmitting={createRoute.isPending}
      />

      {/* Add Stop Modal */}
      <Modal open={!!addStopRoute} onClose={() => setAddStopRoute(null)} title="Add Customer to Route" size="sm">
        <div className="space-y-4">
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          >
            <option value="">Select customer...</option>
            {customers?.map(c => (
              <option key={c.id} value={c.id}>{c.name} - {c.address}</option>
            ))}
          </select>
          <button
            onClick={handleAddStop}
            disabled={!selectedCustomer || addStop.isPending}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {addStop.isPending && <Loader2 size={16} className="animate-spin" />}
            Add to Route
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
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

// Sortable Stop Item
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
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 group"
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none">
        <GripVertical size={16} />
      </button>
      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{stop.customers?.name}</p>
        <p className="text-xs text-gray-500 truncate">{stop.customers?.address}</p>
      </div>
      <span className="text-xs text-gray-400">{stop.estimated_duration_minutes}m</span>
      <button
        onClick={onRemove}
        className="p-1.5 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// Route Form Modal
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

  return (
    <Modal open={open} onClose={onClose} title="New Route" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Route Name</label>
          <input {...register('name')} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="Monday AM Route" />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Day of Week</label>
          <select {...register('day_of_week', { valueAsNumber: true })} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
            {DAY_NAMES.map((day, i) => (
              <option key={i} value={i}>{day}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Technician</label>
          <select {...register('technician_id')} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition">
            <option value="">Unassigned</option>
            {technicians.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          Create Route
        </button>
      </form>
    </Modal>
  );
}
