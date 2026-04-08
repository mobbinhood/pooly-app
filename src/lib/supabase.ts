import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ChemicalAdded = {
  chemical: string;
  amount: number;
  unit: string;
};

export type EquipmentStatus = {
  pump?: 'good' | 'needs_attention' | 'not_working' | 'off';
  filter?: 'good' | 'needs_cleaning' | 'needs_attention' | 'not_working';
  cleaner?: 'good' | 'needs_attention' | 'not_working' | 'off';
  heater?: 'good' | 'needs_attention' | 'not_working' | 'off';
  salt_system?: 'good' | 'needs_attention' | 'not_working' | 'off';
};

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
          gate_code: string | null;
          access_notes: string | null;
          parking_info: string | null;
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
          gate_code?: string | null;
          access_notes?: string | null;
          parking_info?: string | null;
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
          gate_code?: string | null;
          access_notes?: string | null;
          parking_info?: string | null;
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
          has_pump: boolean;
          has_filter: boolean;
          filter_type: string | null;
          has_heater: boolean;
          heater_type: string | null;
          has_cleaner: boolean;
          cleaner_type: string | null;
          has_salt_system: boolean;
          salt_system_model: string | null;
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
          has_pump?: boolean;
          has_filter?: boolean;
          filter_type?: string | null;
          has_heater?: boolean;
          heater_type?: string | null;
          has_cleaner?: boolean;
          cleaner_type?: string | null;
          has_salt_system?: boolean;
          salt_system_model?: string | null;
        };
        Update: {
          type?: string;
          size_gallons?: number | null;
          surface_type?: string | null;
          equipment_notes?: string | null;
          photos?: string[];
          has_pump?: boolean;
          has_filter?: boolean;
          filter_type?: string | null;
          has_heater?: boolean;
          heater_type?: string | null;
          has_cleaner?: boolean;
          cleaner_type?: string | null;
          has_salt_system?: boolean;
          salt_system_model?: string | null;
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
          combined_chlorine: number | null;
          cya: number | null;
          calcium: number | null;
          tds: number | null;
          salt_level: number | null;
          water_temp: number | null;
          chemicals_added: ChemicalAdded[];
          equipment_status: EquipmentStatus;
          time_on_site_minutes: number | null;
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
          combined_chlorine?: number | null;
          cya?: number | null;
          calcium?: number | null;
          tds?: number | null;
          salt_level?: number | null;
          water_temp?: number | null;
          chemicals_added?: ChemicalAdded[];
          equipment_status?: EquipmentStatus;
          time_on_site_minutes?: number | null;
          notes?: string | null;
          photos?: string[];
        };
        Update: {
          chlorine_level?: number | null;
          ph_level?: number | null;
          alkalinity?: number | null;
          combined_chlorine?: number | null;
          cya?: number | null;
          calcium?: number | null;
          tds?: number | null;
          salt_level?: number | null;
          water_temp?: number | null;
          chemicals_added?: ChemicalAdded[];
          equipment_status?: EquipmentStatus;
          time_on_site_minutes?: number | null;
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
          code: string | null;
          expires_at: string | null;
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
          code?: string | null;
          expires_at?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          type?: 'percentage' | 'fixed' | 'free_months';
          value?: number;
          duration_months?: number;
          stripe_coupon_id?: string | null;
          active?: boolean;
          code?: string | null;
          expires_at?: string | null;
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
