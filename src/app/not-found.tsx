import { Droplets, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Droplets className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-4xl font-bold text-gray-900 mb-2">404</h2>
        <p className="text-gray-500 text-sm mb-6">
          This page doesn&apos;t exist. Maybe the pool is in another backyard?
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
