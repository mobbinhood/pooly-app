import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const customerSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip: z.string().min(5, 'Valid ZIP required'),
});

export const serviceLogSchema = z.object({
  customer_id: z.string().min(1, 'Please select a customer').uuid('Please select a customer'),
  service_date: z.string(),
  chlorine_level: z.number().min(0).max(10).optional().or(z.nan().transform(() => undefined)),
  ph_level: z.number().min(0).max(14).optional().or(z.nan().transform(() => undefined)),
  alkalinity: z.number().min(0).max(300).optional().or(z.nan().transform(() => undefined)),
  notes: z.string().optional(),
});

export const discountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.enum(['percentage', 'fixed', 'free_months']),
  value: z.number().min(0, 'Value must be positive'),
  duration_months: z.number().min(1, 'Duration must be at least 1 month'),
});

export const routeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  day_of_week: z.number().min(0).max(6),
  technician_id: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type ServiceLogInput = z.infer<typeof serviceLogSchema>;
export type DiscountInput = z.infer<typeof discountSchema>;
export type RouteInput = z.infer<typeof routeSchema>;
