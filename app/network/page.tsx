'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import useUser from '@/hooks/useUser';
import { Rss, Heart, ShoppingBag, Users, Bell, Sparkles, UserPlus, Tag, ShieldCheck, Flame, Megaphone } from 'lucide-react';
import ListingCard from '@/components/ListingCard';
import Link from 'next/link';

export default function NetworkPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<'following' | 'wishlist' | 'orders' | 'campus'>('following');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <Header />

      <main className="max-w-4xl mx-auto px-4 pt-4">
        {/* Banner Title */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Your Student Operating System
            </span>
            <h1 className="text-2xl font-black text-white mt-1">Campus Network</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified Traders
            </span>
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-3 mb-6 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('following')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'following'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" /> Following & Friends
          </button>
          <button
            onClick={() => setActiveTab('wishlist')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'wishlist'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Heart className="w-4 h-4 text-rose-400" /> Saved Wishlist
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> Track Orders
          </button>
          <button
            onClick={() => setActiveTab('campus')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'campus'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Megaphone className="w-4 h-4 text-amber-400" /> Campus Hub
          </button>
        </div>

        {/* Tab Content Area */}
        {activeTab === 'following' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" /> Trusted Traders & Friends Activity
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Follow your favorite campus sellers, electronics repairers, and hostel listing agents to get notified instantly when they post.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
                    MT
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">MUST Tech Hub</h4>
                    <p className="text-xs text-slate-400">Laptops, Phones & Repair</p>
                  </div>
                  <button className="px-3 py-1.5 bg-emerald-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-emerald-400 transition-colors">
                    Follow
                  </button>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center font-bold">
                    MP
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">Meru Poly Printing</h4>
                    <p className="text-xs text-slate-400">Services & Stationery</p>
                  </div>
                  <button className="px-3 py-1.5 bg-emerald-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-emerald-400 transition-colors">
                    Follow
                  </button>
                </div>
              </div>
            </div>

            <div className="text-center py-12 bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl p-6">
              <UserPlus className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-300">No New Activity From Friends</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Explore the marketplace and follow trusted traders to populate your personalized feed.
              </p>
              <Link
                href="/"
                className="mt-4 inline-block py-2.5 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
              >
                Browse Marketplace
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'wishlist' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" /> Saved Items & Price Alerts
              </h3>
              <p className="text-xs text-slate-400">
                You will receive automatic alerts when items in your wishlist drop in price or are relisted by sellers.
              </p>
            </div>

            <div className="text-center py-12 bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl p-6">
              <Heart className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-300">Your Wishlist is Empty</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Tap the heart icon on any listing to save it here for price-drop notifications.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-400" /> Purchase & Business Order Tracking
              </h3>
              <p className="text-xs text-slate-400">
                Track your active campus business orders, printing services, hostel bookings, and purchases.
              </p>
            </div>

            <div className="text-center py-12 bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl p-6">
              <Tag className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-300">No Active Orders</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Order status and receipt details will appear here once you place orders with verified campus businesses.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'campus' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-400" /> Official Campus Announcements & Clubs
              </h3>
              <p className="text-xs text-slate-400">
                Stay updated with campus events, hostel availability, student notices, lost & found items, and student club activities across Meru tertiary institutions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
                    Lost & Found
                  </span>
                  <span className="text-[11px] text-slate-500">2 hours ago</span>
                </div>
                <h4 className="text-sm font-bold text-white mb-1">Found Student ID Card - Main Campus</h4>
                <p className="text-xs text-slate-400">
                  Student ID found near the main library. Contact support or check lost & found desk.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                    Hostel Availability
                  </span>
                  <span className="text-[11px] text-slate-500">Yesterday</span>
                </div>
                <h4 className="text-sm font-bold text-white mb-1">Nchiru Bedsitters & Rooms Update</h4>
                <p className="text-xs text-slate-400">
                  Newly built single rooms & bedsitters available near MUST Gate B. Water & Wi-Fi included.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
