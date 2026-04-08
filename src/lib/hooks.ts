'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase';
import toast from 'react-hot-toast';

type Customer = Database['public']['Tables']['customers']['Row'];
type Route = Database['public']['Tables']['routes']['Row'];
type RouteStop = Database['public']['Tables']['route_stops']['Row'];
type ServiceLog = Database['public']['Tables']['service_logs']['Row'];
type Discount = Database['public']['Tables']['discounts']['Row'];
type User = Database['public']['Tables']['users']['Row'];

const supabase = createClient();

// Auth
export function useUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('users').select('*, organizations(*)').eq('id', user.id).single();
      return data;
    },
  });
}

// Customers
export function useCustomers(orgId?: string) {
  return useQuery({
    queryKey: ['customers', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('*, pools(*)')
        .eq('organization_id', orgId)
        .order('name');
      if (error) throw error;
      return data as (Customer & { pools: Database['public']['Tables']['pools']['Row'][] })[];
    },
    enabled: !!orgId,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*, pools(*), service_logs(*, users:technician_id(name))')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

async function geocodeAddress(address: string, city: string, state: string, zip: string) {
  try {
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, city, state, zip }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.found ? { latitude: data.latitude, longitude: data.longitude } : null;
  } catch {
    return null;
  }
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database['public']['Tables']['customers']['Insert']) => {
      // Geocode the address for route optimization
      let coords = null;
      if (input.address && input.city && input.state) {
        coords = await geocodeAddress(input.address, input.city, input.state, input.zip || '');
      }
      const { data, error } = await supabase.from('customers').insert({
        ...input,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Database['public']['Tables']['customers']['Update'] & { id: string }) => {
      const { data, error } = await supabase.from('customers').update(input).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Routes
export function useRoutes(orgId?: string) {
  return useQuery({
    queryKey: ['routes', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('routes')
        .select('*, route_stops(*, customers(name, address)), users:technician_id(name)')
        .eq('organization_id', orgId)
        .order('day_of_week');
      if (error) throw error;
      return data as (Route & {
        route_stops: (RouteStop & { customers: Pick<Customer, 'name' | 'address'> })[];
        users: Pick<User, 'name'> | null;
      })[];
    },
    enabled: !!orgId,
  });
}

export function useCreateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database['public']['Tables']['routes']['Insert']) => {
      const { data, error } = await supabase.from('routes').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Route created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Database['public']['Tables']['routes']['Update'] & { id: string }) => {
      const { data, error } = await supabase.from('routes').update(input).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Route updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Route deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Route Stops
export function useUpdateStopOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stops: { id: string; stop_order: number }[]) => {
      const updates = stops.map(s =>
        supabase.from('route_stops').update({ stop_order: s.stop_order }).eq('id', s.id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddRouteStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database['public']['Tables']['route_stops']['Insert']) => {
      const { data, error } = await supabase.from('route_stops').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Stop added');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveRouteStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('route_stops').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Stop removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Service Logs
export function useServiceLogs(customerId?: string) {
  return useQuery({
    queryKey: ['service_logs', customerId],
    queryFn: async () => {
      let query = supabase
        .from('service_logs')
        .select('*, customers(name), users:technician_id(name)')
        .order('service_date', { ascending: false })
        .limit(50);
      if (customerId) query = query.eq('customer_id', customerId);
      const { data, error } = await query;
      if (error) throw error;
      return data as (ServiceLog & { customers: Pick<Customer, 'name'>; users: Pick<User, 'name'> | null })[];
    },
  });
}

export function useCreateServiceLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database['public']['Tables']['service_logs']['Insert']) => {
      const { data, error } = await supabase.from('service_logs').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service_logs'] });
      toast.success('Service log saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Discounts
export function useDiscounts(orgId?: string) {
  return useQuery({
    queryKey: ['discounts', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Discount[];
    },
    enabled: !!orgId,
  });
}

export function useCreateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database['public']['Tables']['discounts']['Insert']) => {
      const { data, error } = await supabase.from('discounts').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discounts'] });
      toast.success('Discount created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Database['public']['Tables']['discounts']['Update'] & { id: string }) => {
      const { data, error } = await supabase.from('discounts').update(input).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discounts'] });
      toast.success('Discount updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('discounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discounts'] });
      toast.success('Discount deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Pools
export function usePools(customerId?: string) {
  return useQuery({
    queryKey: ['pools', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from('pools')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at');
      if (error) throw error;
      return data as Database['public']['Tables']['pools']['Row'][];
    },
    enabled: !!customerId,
  });
}

export function useCreatePool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Database['public']['Tables']['pools']['Insert']) => {
      const { data, error } = await supabase.from('pools').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['pools', variables.customer_id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Pool added');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, customer_id, ...input }: Database['public']['Tables']['pools']['Update'] & { id: string; customer_id: string }) => {
      const { data, error } = await supabase.from('pools').update(input).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['pools', variables.customer_id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Pool updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, customer_id }: { id: string; customer_id: string }) => {
      const { error } = await supabase.from('pools').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['pools', variables.customer_id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Pool removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Completed Stops (localStorage-backed for today's progress)
export function useCompletedStops() {
  return useQuery({
    queryKey: ['completed-stops', new Date().toISOString().split('T')[0]],
    queryFn: () => {
      const key = `stop_completed_${new Date().toISOString().split('T')[0]}`;
      return JSON.parse(localStorage.getItem(key) || '{}') as Record<string, boolean>;
    },
  });
}

export function useToggleStopComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stopId, completed }: { stopId: string; completed: boolean }) => {
      const key = `stop_completed_${new Date().toISOString().split('T')[0]}`;
      const current = JSON.parse(localStorage.getItem(key) || '{}');
      if (completed) {
        current[stopId] = true;
      } else {
        delete current[stopId];
      }
      localStorage.setItem(key, JSON.stringify(current));
      return current;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['completed-stops'] });
    },
  });
}

// Technicians
export function useTechnicians(orgId?: string) {
  return useQuery({
    queryKey: ['technicians', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('organization_id', orgId)
        .order('name');
      if (error) throw error;
      return data as User[];
    },
    enabled: !!orgId,
  });
}

// Dashboard Stats
export function useDashboardStats(orgId?: string) {
  return useQuery({
    queryKey: ['dashboard-stats', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const today = new Date().toISOString().split('T')[0];
      const dayOfWeek = new Date().getDay();

      const [customers, routes, todayLogs, discounts] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact' }).eq('organization_id', orgId),
        supabase.from('routes').select('*, route_stops(*, customers(name, address))').eq('organization_id', orgId).eq('day_of_week', dayOfWeek),
        supabase.from('service_logs').select('id', { count: 'exact' }).eq('service_date', today),
        supabase.from('discounts').select('id', { count: 'exact' }).eq('organization_id', orgId).eq('active', true),
      ]);

      const todayRoute = routes.data?.[0];
      const totalStopsToday = todayRoute?.route_stops?.length ?? 0;

      return {
        totalCustomers: customers.count ?? 0,
        todayStops: totalStopsToday,
        completedToday: todayLogs.count ?? 0,
        activeDiscounts: discounts.count ?? 0,
        todayRoute: todayRoute ?? null,
      };
    },
    enabled: !!orgId,
  });
}
