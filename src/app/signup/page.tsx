'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, type SignupInput } from '@/lib/validations';
import { createClient } from '@/lib/supabase/client';
import { Droplets, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupInput) => {
    setError('');
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { name: data.name },
      },
    });
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
  };

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  if (success) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl p-8 border border-[#E2E8F0] max-w-sm w-full text-center"
        >
          <div className="w-14 h-14 bg-[#10B981]/8 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-[#10B981]" />
          </div>
          <h2 className="text-xl font-bold text-[#1A1A2E] mb-2">Check your email</h2>
          <p className="text-[#64748B] text-sm mb-6">
            We&apos;ve sent you a confirmation link. Click it to activate your account.
          </p>
          <Link
            href="/login"
            className="inline-block py-2.5 px-6 bg-[#0066FF] text-white rounded-lg font-medium text-sm hover:bg-[#0052CC] transition"
          >
            Back to Login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#0066FF] rounded-xl mb-4">
            <Droplets className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Join Pooly</h1>
          <p className="text-[#64748B] text-sm mt-1">Start managing your pool routes</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-[#E2E8F0]">
          <h2 className="text-lg font-semibold text-[#1A1A2E] mb-5">Create your account</h2>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-[#EF4444]/5 border border-[#EF4444]/15 text-[#EF4444] rounded-lg p-3 mb-4 text-sm"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">Full Name</label>
              <input {...register('name')} type="text" className={inputClass} placeholder="John Smith" />
              {errors.name && <p className="text-[#EF4444] text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">Email</label>
              <input {...register('email')} type="email" className={inputClass} placeholder="you@company.com" />
              {errors.email && <p className="text-[#EF4444] text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className={`${inputClass} pr-10`}
                  placeholder="Minimum 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-[#EF4444] text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">Confirm Password</label>
              <input {...register('confirmPassword')} type="password" className={inputClass} placeholder="Repeat your password" />
              {errors.confirmPassword && <p className="text-[#EF4444] text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-[#0066FF] text-white rounded-lg font-medium text-sm hover:bg-[#0052CC] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-[#64748B] mt-6 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-[#0066FF] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
