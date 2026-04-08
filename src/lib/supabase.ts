import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          stripe_account_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          stripe_account_id?: string | null;
        };
        Update: {
          name?: string;
          stripe_account_id?: string | null;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: 'admin' | 'technician';
          organization_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          role: 'admin' | 'technician';
          organization_id: string;
        };
        Update: {
          email?: string;
          name?: string;
          role?: 'admin' | 'technician';
        };
      };
      customers: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          address: string;
          city: string;
          state: string;
          zip: string;
          latitude: number | null;
          longitude: number | null;
          stripe_customer_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          address: string;
          city: string;
          state: string;
          zip: string;
          latitude?: number | null;
          longitude?: number | null;
          stripe_customer_id?: string | null;
        };
        Update: {
          name?: string;
          email?: string | null;
          phone?: string | null;
          address?: string;
          city?: string;
          state?: string;
          zip?: string;
          latitude?: number | null;
          longitude?: number | null;
          stripe_customer_id?: string | null;
        };
      };
      pools: {
        Row: {
          id: string;
          customer_id: string;
          type: string;
          size_gallons: number | null;
          surface_type: string | null;
          equipment_notes: string | null;
          photos: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          type: string;
          size_gallons?: number | null;
          surface_type?: string | null;
          equipment_notes?: string | null;
          photos?: string[];
        };
        Update: {
          type?: string;
          size_gallons?: number | null;
          surface_type?: string | null;
          equipment_notes?: string | null;
          photos?: string[];
        };
      };
      routes: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          technician_id: string | null;
          day_of_week: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          technician_id?: string | null;
          day_of_week: number;
        };
        Update: {
          name?: string;
          technician_id?: string | null;
          day_of_week?: number;
        };
      };
      route_stops: {
        Row: {
          id: string;
          route_id: string;
          customer_id: string;
          stop_order: number;
          estimated_duration_minutes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          route_id: string;
          customer_id: string;
          stop_order: number;
          estimated_duration_minutes?: number;
        };
        Update: {
          stop_order?: number;
          estimated_duration_minutes?: number;
        };
      };
      service_logs: {
        Row: {
          id: string;
          customer_id: string;
          technician_id: string;
          service_date: string;
          chlorine_level: number | null;
          ph_level: number | null;
          alkalinity: number | null;
          notes: string | null;
          photos: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          technician_id: string;
          service_date: string;
          chlorine_level?: number | null;
          ph_level?: number | null;
          alkalinity?: number | null;
          notes?: string | null;
          photos?: string[];
        };
        Update: {
          chlorine_level?: number | null;
          ph_level?: number | null;
          alkalinity?: number | null;
          notes?: string | null;
          photos?: string[];
        };
      };
      discounts: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          type: 'percentage' | 'fixed' | 'free_months';
          value: number;
          duration_months: number;
          stripe_coupon_id: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          type: 'percentage' | 'fixed' | 'free_months';
          value: number;
          duration_months: number;
          stripe_coupon_id?: string | null;
          active?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          type?: 'percentage' | 'fixed' | 'free_months';
          value?: number;
          duration_months?: number;
          stripe_coupon_id?: string | null;
          active?: boolean;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          customer_id: string;
          stripe_subscription_id: string;
          price_cents: number;
          discount_id: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          stripe_subscription_id: string;
          price_cents: number;
          discount_id?: string | null;
          status: string;
        };
        Update: {
          price_cents?: number;
          discount_id?: string | null;
          status?: string;
        };
      };
    };
  };
};
