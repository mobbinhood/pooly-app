'use client';

import { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, User, MapPin, Droplets, Camera, CreditCard, Tag } from 'lucide-react';

type Step = 'customer' | 'location' | 'route' | 'pool' | 'photos' | 'billing';

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<Step>('customer');
  const [formData, setFormData] = useState({
    // Customer Info
    customerName: '',
    email: '',
    phone: '',
    // Service Location
    address: '',
    city: '',
    state: '',
    zip: '',
    // Route Assignment
    routeId: '',
    technicianId: '',
    serviceDay: '',
    // Pool Info
    poolType: '',
    poolSize: '',
    surfaceType: '',
    equipmentNotes: '',
    // Billing
    monthlyPrice: '',
    discountId: '',
    cardToken: '',
  });

  const steps: { id: Step; label: string; icon: React.ElementType }[] = [
    { id: 'customer', label: 'Customer', icon: User },
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'route', label: 'Route', icon: MapPin },
    { id: 'pool', label: 'Pool Info', icon: Droplets },
    { id: 'photos', label: 'Photos', icon: Camera },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleSubmit = async () => {
    // Submit to API
    console.log('Submitting:', formData);
    alert('Customer added successfully!');
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-lg">
        <h1 className="text-xl font-bold">New Customer Signup</h1>
        <p className="text-blue-200 text-sm">Quick onboarding flow</p>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index < currentStepIndex 
                  ? 'bg-green-500 text-white' 
                  : index === currentStepIndex 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-500'
              }`}>
                {index < currentStepIndex ? <Check size={16} /> : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 h-1 mx-1 ${index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm font-medium text-gray-600">
          {steps[currentStepIndex].label}
        </p>
      </div>

      {/* Form Content */}
      <main className="p-4 pb-32">
        {currentStep === 'customer' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <User size={20} className="text-blue-600" />
                Customer Information
              </h2>
              <input
                type="text"
                placeholder="Full Name *"
                value={formData.customerName}
                onChange={(e) => updateField('customerName', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="tel"
                placeholder="Phone Number *"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {currentStep === 'location' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <MapPin size={20} className="text-blue-600" />
                Service Location
              </h2>
              <input
                type="text"
                placeholder="Street Address *"
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="City *"
                  value={formData.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="State *"
                  value={formData.state}
                  onChange={(e) => updateField('state', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <input
                type="text"
                placeholder="ZIP Code *"
                value={formData.zip}
                onChange={(e) => updateField('zip', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {currentStep === 'route' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <MapPin size={20} className="text-blue-600" />
                Route Assignment
              </h2>
              <select
                value={formData.serviceDay}
                onChange={(e) => updateField('serviceDay', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Service Day *</option>
                <option value="monday">Monday</option>
                <option value="tuesday">Tuesday</option>
                <option value="wednesday">Wednesday</option>
                <option value="thursday">Thursday</option>
                <option value="friday">Friday</option>
              </select>
              <select
                value={formData.technicianId}
                onChange={(e) => updateField('technicianId', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Assign Technician *</option>
                <option value="tech1">Mike Johnson</option>
                <option value="tech2">Sarah Williams</option>
                <option value="tech3">Carlos Rodriguez</option>
              </select>
            </div>
          </div>
        )}

        {currentStep === 'pool' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Droplets size={20} className="text-blue-600" />
                Pool Information
              </h2>
              <select
                value={formData.poolType}
                onChange={(e) => updateField('poolType', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Pool Type *</option>
                <option value="inground">In-Ground</option>
                <option value="above">Above Ground</option>
                <option value="spa">Spa/Hot Tub</option>
                <option value="combo">Pool + Spa Combo</option>
              </select>
              <input
                type="text"
                placeholder="Pool Size (gallons)"
                value={formData.poolSize}
                onChange={(e) => updateField('poolSize', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={formData.surfaceType}
                onChange={(e) => updateField('surfaceType', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Surface Type</option>
                <option value="plaster">Plaster</option>
                <option value="pebble">Pebble Tec</option>
                <option value="vinyl">Vinyl</option>
                <option value="fiberglass">Fiberglass</option>
                <option value="tile">Tile</option>
              </select>
              <textarea
                placeholder="Equipment Notes (pumps, filters, etc.)"
                value={formData.equipmentNotes}
                onChange={(e) => updateField('equipmentNotes', e.target.value)}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {currentStep === 'photos' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Camera size={20} className="text-blue-600" />
                Pool Photos
              </h2>
              <p className="text-sm text-gray-500">Take photos of the pool, equipment, and access points for reference.</p>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <button
                    key={i}
                    className="aspect-square border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-500 hover:text-blue-500 transition"
                  >
                    <Camera size={32} />
                    <span className="text-sm">Add Photo</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 'billing' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <CreditCard size={20} className="text-blue-600" />
                Pricing & Payment
              </h2>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  placeholder="Monthly Price *"
                  value={formData.monthlyPrice}
                  onChange={(e) => updateField('monthlyPrice', e.target.value)}
                  className="w-full p-3 pl-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Tag size={20} className="text-green-600" />
                Apply Discount
              </h3>
              {[
                { id: 'none', name: 'No Discount', desc: '' },
                { id: 'first_free', name: 'First Month Free', desc: '100% off first month' },
                { id: 'half_first', name: '50% Off First Month', desc: '50% off first month' },
                { id: 'half_three', name: '50% Off 3 Months', desc: '50% off for 3 months' },
                { id: 'combo', name: '1 Free + 50% Off 4mo', desc: 'Equal to 3 free months!' },
              ].map((discount) => (
                <label
                  key={discount.id}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${
                    formData.discountId === discount.id 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="discount"
                    value={discount.id}
                    checked={formData.discountId === discount.id}
                    onChange={(e) => updateField('discountId', e.target.value)}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-medium text-gray-800">{discount.name}</p>
                    {discount.desc && <p className="text-sm text-gray-500">{discount.desc}</p>}
                  </div>
                </label>
              ))}
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
              <h3 className="font-semibold text-gray-800">Payment Method</h3>
              <input
                type="text"
                placeholder="Card Number"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="MM/YY"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="CVC"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 safe-area-inset-bottom">
        <div className="flex gap-3">
          {currentStepIndex > 0 && (
            <button
              onClick={handleBack}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-xl font-medium text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 transition"
            >
              <ArrowLeft size={20} />
              Back
            </button>
          )}
          {currentStepIndex < steps.length - 1 ? (
            <button
              onClick={handleNext}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition"
            >
              Next
              <ArrowRight size={20} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-green-700 transition"
            >
              <Check size={20} />
              Complete Signup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
