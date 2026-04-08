'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Check, User, MapPin, Droplets, Camera, CreditCard, Tag, Loader2, X, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

type Step = 'customer' | 'location' | 'route' | 'pool' | 'photos' | 'billing';

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('customer');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [routes, setRoutes] = useState<{ id: string; name: string; day_of_week: number }[]>([]);
  const [technicians, setTechnicians] = useState<{ id: string; name: string }[]>([]);
  const [discounts, setDiscounts] = useState<{ id: string; name: string; description: string | null; type: string; value: number }[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    customerName: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '',
    gateCode: '', accessNotes: '',
    routeId: '', timeWindow: '',
    poolType: 'inground', poolSize: '', surfaceType: '', equipmentNotes: '',
    monthlyPrice: '', discountId: '',
  });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: dbUser } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
      if (!dbUser?.organization_id) { router.push('/'); return; }
      setOrgId(dbUser.organization_id);

      const [routeRes, techRes, discountRes] = await Promise.all([
        supabase.from('routes').select('id, name, day_of_week').eq('organization_id', dbUser.organization_id).order('day_of_week'),
        supabase.from('users').select('id, name').eq('organization_id', dbUser.organization_id).order('name'),
        supabase.from('discounts').select('id, name, description, type, value').eq('organization_id', dbUser.organization_id).eq('active', true),
      ]);
      setRoutes(routeRes.data ?? []);
      setTechnicians(techRes.data ?? []);
      setDiscounts(discountRes.data ?? []);
    };
    init();
  }, [supabase, router]);

  const steps: { id: Step; label: string; icon: React.ElementType }[] = [
    { id: 'customer', label: 'Customer', icon: User },
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'route', label: 'Route', icon: MapPin },
    { id: 'pool', label: 'Pool', icon: Droplets },
    { id: 'photos', label: 'Photos', icon: Camera },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const handleNext = () => {
    if (currentStep === 'customer' && !formData.customerName.trim()) { toast.error('Customer name is required'); return; }
    if (currentStep === 'location' && (!formData.address.trim() || !formData.city.trim() || !formData.state.trim() || !formData.zip.trim())) { toast.error('Please fill in all address fields'); return; }
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) setCurrentStep(steps[nextIndex].id);
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) setCurrentStep(steps[prevIndex].id);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !orgId) return;
    setUploading(true);
    const newPhotos: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `onboarding-photos/${orgId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('pool-photos').upload(path, file);
      if (error) { toast.error(`Failed to upload ${file.name}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from('pool-photos').getPublicUrl(path);
      newPhotos.push(publicUrl);
    }
    setPhotos(prev => [...prev, ...newPhotos]);
    setUploading(false);
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!orgId) return;
    setSubmitting(true);
    try {
      let latitude = null;
      let longitude = null;
      try {
        const geoRes = await fetch('/api/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: formData.address, city: formData.city, state: formData.state, zip: formData.zip }),
        });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.found) { latitude = geoData.latitude; longitude = geoData.longitude; }
        }
      } catch { /* Geocoding optional */ }

      const { data: customer, error: custError } = await supabase
        .from('customers')
        .insert({
          organization_id: orgId, name: formData.customerName,
          email: formData.email || null, phone: formData.phone || null,
          address: formData.address, city: formData.city, state: formData.state, zip: formData.zip,
          latitude, longitude,
        })
        .select().single();
      if (custError) throw custError;

      if (formData.poolType) {
        const noteParts: string[] = [];
        if (formData.gateCode) noteParts.push(`Gate Code: ${formData.gateCode}`);
        if (formData.accessNotes) noteParts.push(`Access: ${formData.accessNotes}`);
        if (formData.timeWindow) noteParts.push(`Preferred Time: ${formData.timeWindow}`);
        if (formData.equipmentNotes) noteParts.push(formData.equipmentNotes);
        await supabase.from('pools').insert({
          customer_id: customer.id, type: formData.poolType,
          size_gallons: formData.poolSize ? parseInt(formData.poolSize) : null,
          surface_type: formData.surfaceType || null,
          equipment_notes: noteParts.join('\n') || null, photos,
        });
      }

      if (formData.routeId) {
        const { data: existingStops } = await supabase
          .from('route_stops').select('stop_order').eq('route_id', formData.routeId)
          .order('stop_order', { ascending: false }).limit(1);
        const maxOrder = existingStops?.[0]?.stop_order ?? -1;
        await supabase.from('route_stops').insert({
          route_id: formData.routeId, customer_id: customer.id,
          stop_order: maxOrder + 1, estimated_duration_minutes: 30,
        });
      }

      setSuccess(true);
      toast.success('Customer onboarded successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create customer');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-[#1A1A2E] text-sm placeholder-[#94A3B8] focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition";

  if (success) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm">
          <div className="w-16 h-16 bg-[#10B981]/8 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-[#10B981]" />
          </div>
          <h2 className="text-2xl font-bold text-[#1A1A2E] mb-2">Customer Added!</h2>
          <p className="text-[#64748B] text-sm mb-8">{formData.customerName} has been onboarded and added to your system.</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setSuccess(false); setCurrentStep('customer');
                setFormData({ customerName: '', email: '', phone: '', address: '', city: '', state: '', zip: '', gateCode: '', accessNotes: '', routeId: '', timeWindow: '', poolType: 'inground', poolSize: '', surfaceType: '', equipmentNotes: '', monthlyPrice: '', discountId: '' });
                setPhotos([]);
              }}
              className="flex-1 py-2.5 border border-[#E2E8F0] rounded-lg font-medium text-[#1A1A2E] hover:bg-[#F8FAFC] transition text-sm"
            >
              Add Another
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex-1 py-2.5 bg-[#0066FF] text-white rounded-lg font-medium hover:bg-[#0052CC] transition text-sm"
            >
              Go to Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] px-4 pt-4 pb-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-lg font-bold text-[#1A1A2E]">New Customer</h1>
            <p className="text-[#64748B] text-xs">Step {currentStepIndex + 1} of {steps.length}</p>
          </div>
          <button onClick={() => router.push('/')} className="p-2 hover:bg-[#F8FAFC] rounded-lg transition text-[#64748B]">
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  index < currentStepIndex ? 'bg-[#10B981] text-white'
                    : index === currentStepIndex ? 'bg-[#0066FF] text-white'
                    : 'bg-[#F1F5F9] text-[#94A3B8]'
                }`}>
                  {index < currentStepIndex ? <Check size={14} strokeWidth={3} /> : <step.icon size={14} />}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-5 sm:w-10 h-0.5 mx-1 rounded-full ${index < currentStepIndex ? 'bg-[#10B981]' : 'bg-[#E2E8F0]'}`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-sm font-medium text-[#1A1A2E]">{steps[currentStepIndex].label}</p>
        </div>
      </div>

      {/* Form */}
      <main className="max-w-2xl mx-auto p-4 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.15 }}
          >
            {currentStep === 'customer' && (
              <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-[#0066FF]/8 rounded-lg flex items-center justify-center">
                    <User size={16} className="text-[#0066FF]" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[#1A1A2E] text-sm">Customer Information</h2>
                    <p className="text-xs text-[#94A3B8]">Basic contact details</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">Full Name *</label>
                  <input type="text" placeholder="John Smith" value={formData.customerName} onChange={(e) => updateField('customerName', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">Email</label>
                  <input type="email" placeholder="john@email.com" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">Phone</label>
                  <input type="tel" placeholder="(555) 123-4567" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} className={inputClass} />
                </div>
              </div>
            )}

            {currentStep === 'location' && (
              <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-[#0066FF]/8 rounded-lg flex items-center justify-center">
                    <MapPin size={16} className="text-[#0066FF]" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[#1A1A2E] text-sm">Service Location</h2>
                    <p className="text-xs text-[#94A3B8]">Where the pool is located</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">Street Address *</label>
                  <input type="text" placeholder="123 Main St" value={formData.address} onChange={(e) => updateField('address', e.target.value)} className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#64748B] mb-1.5">City *</label>
                    <input type="text" placeholder="Phoenix" value={formData.city} onChange={(e) => updateField('city', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#64748B] mb-1.5">State *</label>
                    <input type="text" placeholder="AZ" value={formData.state} onChange={(e) => updateField('state', e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">ZIP Code *</label>
                  <input type="text" placeholder="85001" value={formData.zip} onChange={(e) => updateField('zip', e.target.value)} className={inputClass} />
                </div>
                <div className="pt-2 border-t border-[#F1F5F9]">
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">Gate Code</label>
                  <input type="text" placeholder="e.g. #1234" value={formData.gateCode} onChange={(e) => updateField('gateCode', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">Access Notes</label>
                  <textarea placeholder="e.g. Enter through side gate, dog in backyard on Mondays" value={formData.accessNotes} onChange={(e) => updateField('accessNotes', e.target.value)} rows={3} className={`${inputClass} resize-none`} />
                </div>
              </div>
            )}

            {currentStep === 'route' && (
              <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-[#10B981]/8 rounded-lg flex items-center justify-center">
                    <MapPin size={16} className="text-[#10B981]" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[#1A1A2E] text-sm">Route Assignment</h2>
                    <p className="text-xs text-[#94A3B8]">Assign to an existing route (optional)</p>
                  </div>
                </div>
                {routes.length > 0 ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className={`flex items-center p-3.5 border-2 rounded-lg cursor-pointer transition ${formData.routeId === '' ? 'border-[#0066FF] bg-[#0066FF]/5' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'}`}>
                        <input type="radio" name="route" value="" checked={formData.routeId === ''} onChange={() => updateField('routeId', '')} className="sr-only" />
                        <div>
                          <p className="font-medium text-[#1A1A2E] text-sm">No route assignment</p>
                          <p className="text-xs text-[#94A3B8]">Assign to a route later</p>
                        </div>
                      </label>
                      {routes.map((route) => (
                        <label key={route.id} className={`flex items-center p-3.5 border-2 rounded-lg cursor-pointer transition ${formData.routeId === route.id ? 'border-[#0066FF] bg-[#0066FF]/5' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'}`}>
                          <input type="radio" name="route" value={route.id} checked={formData.routeId === route.id} onChange={() => updateField('routeId', route.id)} className="sr-only" />
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-xs font-bold px-2 py-1 bg-[#F1F5F9] rounded-md text-[#64748B]">{DAY_NAMES[route.day_of_week]}</span>
                            <p className="font-medium text-[#1A1A2E] text-sm">{route.name}</p>
                          </div>
                          {formData.routeId === route.id && <Check size={16} className="text-[#0066FF]" />}
                        </label>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-[#F1F5F9]">
                      <label className="block text-xs font-medium text-[#64748B] mb-2">Preferred Time Window</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'morning', label: 'Morning', desc: '8am - 11am' },
                          { value: 'midday', label: 'Midday', desc: '11am - 2pm' },
                          { value: 'afternoon', label: 'Afternoon', desc: '2pm - 5pm' },
                        ].map(opt => (
                          <label key={opt.value} className={`p-3 border-2 rounded-lg text-center cursor-pointer transition ${formData.timeWindow === opt.value ? 'border-[#0066FF] bg-[#0066FF]/5' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'}`}>
                            <input type="radio" name="timeWindow" value={opt.value} checked={formData.timeWindow === opt.value} onChange={() => updateField('timeWindow', opt.value)} className="sr-only" />
                            <p className="text-sm font-medium text-[#1A1A2E]">{opt.label}</p>
                            <p className="text-[10px] text-[#94A3B8]">{opt.desc}</p>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-[#F8FAFC] rounded-lg">
                    <MapPin className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                    <p className="text-[#64748B] text-sm">No routes created yet</p>
                    <p className="text-[#94A3B8] text-xs">Create routes from the Routes tab first</p>
                  </div>
                )}
              </div>
            )}

            {currentStep === 'pool' && (
              <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-[#0066FF]/8 rounded-lg flex items-center justify-center">
                    <Droplets size={16} className="text-[#0066FF]" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[#1A1A2E] text-sm">Pool Information</h2>
                    <p className="text-xs text-[#94A3B8]">Details about the pool</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">Pool Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'inground', label: 'In-Ground' },
                      { value: 'above_ground', label: 'Above Ground' },
                      { value: 'spa', label: 'Spa / Hot Tub' },
                      { value: 'combo', label: 'Pool + Spa' },
                    ].map(opt => (
                      <label key={opt.value} className={`p-3 border-2 rounded-lg text-center text-sm font-medium cursor-pointer transition ${formData.poolType === opt.value ? 'border-[#0066FF] bg-[#0066FF]/5 text-[#0066FF]' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'}`}>
                        <input type="radio" name="poolType" value={opt.value} checked={formData.poolType === opt.value} onChange={() => updateField('poolType', opt.value)} className="sr-only" />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">Pool Size (gallons)</label>
                  <input type="number" placeholder="e.g. 15000" value={formData.poolSize} onChange={(e) => updateField('poolSize', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">Surface Type</label>
                  <select value={formData.surfaceType} onChange={(e) => updateField('surfaceType', e.target.value)} className={inputClass}>
                    <option value="">Select surface type</option>
                    <option value="plaster">Plaster</option>
                    <option value="pebble">Pebble Tec</option>
                    <option value="vinyl">Vinyl</option>
                    <option value="fiberglass">Fiberglass</option>
                    <option value="tile">Tile</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1.5">Equipment Notes</label>
                  <textarea placeholder="Pumps, filters, heater, etc." value={formData.equipmentNotes} onChange={(e) => updateField('equipmentNotes', e.target.value)} rows={3} className={`${inputClass} resize-none`} />
                </div>
              </div>
            )}

            {currentStep === 'photos' && (
              <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-[#0066FF]/8 rounded-lg flex items-center justify-center">
                    <Camera size={16} className="text-[#0066FF]" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[#1A1A2E] text-sm">Pool Photos</h2>
                    <p className="text-xs text-[#94A3B8]">Take photos for reference (optional)</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {photos.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-[#F1F5F9]">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
                        <X size={12} className="text-white" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square border-2 border-dashed border-[#E2E8F0] rounded-lg flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-[#0066FF]/40 hover:text-[#0066FF] transition text-[#94A3B8]">
                    {uploading ? <Loader2 size={20} className="animate-spin" /> : <><Camera size={20} /><span className="text-xs font-medium">Add Photo</span></>}
                    <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="sr-only" />
                  </label>
                </div>
                {photos.length === 0 && <p className="text-center text-sm text-[#94A3B8] py-4">Photos help technicians identify the property and equipment</p>}
              </div>
            )}

            {currentStep === 'billing' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-[#10B981]/8 rounded-lg flex items-center justify-center">
                      <CreditCard size={16} className="text-[#10B981]" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-[#1A1A2E] text-sm">Pricing</h2>
                      <p className="text-xs text-[#94A3B8]">Set the monthly service rate</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#64748B] mb-1.5">Monthly Price</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] font-medium text-sm">$</span>
                      <input type="number" placeholder="150" value={formData.monthlyPrice} onChange={(e) => updateField('monthlyPrice', e.target.value)} className={`${inputClass} pl-7`} />
                    </div>
                  </div>
                </div>

                {discounts.length > 0 && (
                  <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] space-y-3">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 bg-[#F59E0B]/8 rounded-lg flex items-center justify-center">
                        <Tag size={16} className="text-[#F59E0B]" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-[#1A1A2E] text-sm">Apply Discount</h2>
                        <p className="text-xs text-[#94A3B8]">Optional promotional discount</p>
                      </div>
                    </div>
                    <label className={`flex items-center p-3.5 border-2 rounded-lg cursor-pointer transition ${formData.discountId === '' ? 'border-[#0066FF] bg-[#0066FF]/5' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'}`}>
                      <input type="radio" name="discount" value="" checked={formData.discountId === ''} onChange={() => updateField('discountId', '')} className="sr-only" />
                      <p className="font-medium text-[#1A1A2E] text-sm">No Discount</p>
                    </label>
                    {discounts.map((discount) => (
                      <label key={discount.id} className={`flex items-center p-3.5 border-2 rounded-lg cursor-pointer transition ${formData.discountId === discount.id ? 'border-[#0066FF] bg-[#0066FF]/5' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'}`}>
                        <input type="radio" name="discount" value={discount.id} checked={formData.discountId === discount.id} onChange={() => updateField('discountId', discount.id)} className="sr-only" />
                        <div className="flex-1">
                          <p className="font-medium text-[#1A1A2E] text-sm">{discount.name}</p>
                          {discount.description && <p className="text-xs text-[#94A3B8]">{discount.description}</p>}
                        </div>
                        <span className="text-sm font-medium text-[#0066FF]">
                          {discount.type === 'percentage' ? `${discount.value}% off` : discount.type === 'fixed' ? `$${discount.value} off` : `${discount.value}mo free`}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Summary */}
                <div className="bg-white rounded-xl p-5 border border-[#E2E8F0]">
                  <h3 className="font-semibold text-[#1A1A2E] text-sm mb-3">Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-[#64748B]">Customer</span><span className="font-medium text-[#1A1A2E]">{formData.customerName || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-[#64748B]">Location</span><span className="font-medium text-[#1A1A2E] text-right max-w-[60%] truncate">{formData.address ? `${formData.address}, ${formData.city}` : '—'}</span></div>
                    <div className="flex justify-between"><span className="text-[#64748B]">Pool</span><span className="font-medium text-[#1A1A2E] capitalize">{formData.poolType.replace('_', ' ') || '—'}</span></div>
                    {formData.monthlyPrice && (
                      <div className="flex justify-between pt-2 border-t border-[#F1F5F9]">
                        <span className="font-medium text-[#1A1A2E]">Monthly Total</span>
                        <span className="font-bold text-[#0066FF]">${formData.monthlyPrice}/mo</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E2E8F0] px-4 py-3 safe-area-inset-bottom z-40">
        <div className="max-w-2xl mx-auto flex gap-3">
          {currentStepIndex > 0 && (
            <button onClick={handleBack} className="py-2.5 px-5 border border-[#E2E8F0] rounded-lg font-medium text-[#1A1A2E] text-sm flex items-center justify-center gap-2 hover:bg-[#F8FAFC] transition">
              <ArrowLeft size={16} />
              Back
            </button>
          )}
          {currentStepIndex < steps.length - 1 ? (
            <button onClick={handleNext} className="flex-1 py-2.5 px-4 bg-[#0066FF] text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#0052CC] transition">
              Next
              <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2.5 px-4 bg-[#10B981] text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-emerald-600 transition disabled:opacity-50">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {submitting ? 'Creating...' : 'Complete Signup'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
