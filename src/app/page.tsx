'use client';

import { useState } from 'react';
import { Home, Users, MapPin, Settings, DollarSign, Calendar, Plus } from 'lucide-react';

type Tab = 'home' | 'customers' | 'routes' | 'discounts' | 'settings';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  
  const todayStops = [
    { id: 1, name: 'Johnson Residence', address: '123 Palm Ave', time: '9:00 AM', status: 'pending' },
    { id: 2, name: 'Smith Family Pool', address: '456 Oak St', time: '10:30 AM', status: 'pending' },
    { id: 3, name: 'Desert Oasis HOA', address: '789 Cactus Blvd', time: '12:00 PM', status: 'pending' },
    { id: 4, name: 'Martinez Home', address: '321 Sunset Dr', time: '2:00 PM', status: 'pending' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Pooly</h1>
          <div className="text-sm">
            <p className="font-medium">Welcome back!</p>
            <p className="text-blue-200">Tuesday, April 7</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 pb-24">
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Calendar size={16} />
                  <span>Today's Stops</span>
                </div>
                <p className="text-3xl font-bold text-gray-800 mt-1">4</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Users size={16} />
                  <span>Total Customers</span>
                </div>
                <p className="text-3xl font-bold text-gray-800 mt-1">24</p>
              </div>
            </div>

            {/* Today's Route */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-800">Today's Route</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {todayStops.map((stop, index) => (
                  <div key={stop.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition cursor-pointer">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{stop.name}</p>
                      <p className="text-sm text-gray-500">{stop.address}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-800">{stop.time}</p>
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                        {stop.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <button className="bg-blue-600 text-white rounded-xl p-4 flex items-center justify-center gap-2 font-medium shadow-sm hover:bg-blue-700 transition">
                <Plus size={20} />
                Add Customer
              </button>
              <button className="bg-green-600 text-white rounded-xl p-4 flex items-center justify-center gap-2 font-medium shadow-sm hover:bg-green-700 transition">
                <MapPin size={20} />
                Optimize Route
              </button>
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Customers</h2>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
                <Plus size={16} />
                Add New
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <input 
                type="text" 
                placeholder="Search customers..." 
                className="w-full p-4 border-b border-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="divide-y divide-gray-100">
                {['Johnson Residence', 'Smith Family Pool', 'Desert Oasis HOA', 'Martinez Home'].map((name, i) => (
                  <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-800">{name}</p>
                      <p className="text-sm text-gray-500">Monthly Service - $150/mo</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Active</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'routes' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Routes</h2>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
                <Plus size={16} />
                New Route
              </button>
            </div>
            <div className="space-y-3">
              {['Monday Route', 'Tuesday Route', 'Wednesday Route', 'Thursday Route', 'Friday Route'].map((route, i) => (
                <div key={i} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{route}</p>
                    <p className="text-sm text-gray-500">{4 + i} stops • ~{3 + i} hours</p>
                  </div>
                  <button className="text-blue-600 font-medium text-sm">Edit</button>
                </div>
              ))}
            </div>
            <button className="w-full bg-green-600 text-white rounded-xl p-4 flex items-center justify-center gap-2 font-medium shadow-sm hover:bg-green-700 transition">
              <MapPin size={20} />
              Optimize All Routes
            </button>
          </div>
        )}

        {activeTab === 'discounts' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Discounts</h2>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
                <Plus size={16} />
                Create Discount
              </button>
            </div>
            <div className="space-y-3">
              {[
                { name: 'First Month Free', desc: '100% off first month', uses: 12 },
                { name: '50% Off First Month', desc: '50% off first month', uses: 8 },
                { name: '3 Month Deal', desc: '50% off for 3 months', uses: 5 },
                { name: 'Referral Bonus', desc: '1 month free + 50% off 4 months', uses: 3 },
              ].map((discount, i) => (
                <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{discount.name}</p>
                      <p className="text-sm text-gray-500">{discount.desc}</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {discount.uses} uses
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Settings</h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {['Company Profile', 'Stripe Integration', 'Team Members', 'Notifications', 'Billing'].map((item, i) => (
                <div key={i} className="p-4 flex items-center justify-between border-b border-gray-100 last:border-0 hover:bg-gray-50 transition cursor-pointer">
                  <p className="font-medium text-gray-800">{item}</p>
                  <span className="text-gray-400">→</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 safe-area-inset-bottom">
        <div className="flex justify-around items-center">
          {[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'customers', icon: Users, label: 'Customers' },
            { id: 'routes', icon: MapPin, label: 'Routes' },
            { id: 'discounts', icon: DollarSign, label: 'Discounts' },
            { id: 'settings', icon: Settings, label: 'Settings' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition ${
                activeTab === tab.id 
                  ? 'text-blue-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <tab.icon size={24} />
              <span className="text-xs mt-1 font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
