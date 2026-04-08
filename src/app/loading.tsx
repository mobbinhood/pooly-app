import { Droplets } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin">
        <Droplets className="w-10 h-10 text-blue-600" />
      </div>
    </div>
  );
}
