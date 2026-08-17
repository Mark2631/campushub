'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  Building2,
  ShieldCheck,
  Bell,
  Lock,
  Eye,
  UserX,
  Smartphone,
  Globe,
  Sun,
  Download,
  Trash2,
  HelpCircle,
  Briefcase,
  CheckCircle2,
} from 'lucide-react';
import { Institution, SEEDED_INSTITUTIONS, setStoredInstitution } from '@/lib/institutions';

interface ManagePanelProps {
  currentInstitution?: Institution | null;
  onInstitutionChange?: (inst: Institution) => void;
  onOpenHelp?: () => void;
  userEmail?: string;
}

export default function ManagePanel({
  currentInstitution,
  onInstitutionChange,
  onOpenHelp,
  userEmail,
}: ManagePanelProps) {
  const [openGroup, setOpenGroup] = useState<string | null>('institution');
  const [selectedInst, setSelectedInst] = useState<Institution | null>(currentInstitution || SEEDED_INSTITUTIONS[0]);

  const toggleGroup = (id: string) => {
    setOpenGroup(openGroup === id ? null : id);
  };

  const handleSelectInstitution = (inst: Institution) => {
    setSelectedInst(inst);
    setStoredInstitution(inst);
    if (onInstitutionChange) onInstitutionChange(inst);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          Manage Account & Settings
        </h2>
        {onOpenHelp && (
          <button
            onClick={onOpenHelp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
          >
            <HelpCircle className="w-4 h-4" /> Help Center
          </button>
        )}
      </div>

      {/* Accordion Group 1: Institution & Campus */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => toggleGroup('institution')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Institution & School Scoping</h3>
              <p className="text-xs text-slate-400">Current: {selectedInst?.short_name || 'MUST'}</p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
              openGroup === 'institution' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openGroup === 'institution' && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
            <p className="text-xs text-slate-400 mb-2">
              Select your institution to filter marketplace listings, hostels, services, and campus feeds.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SEEDED_INSTITUTIONS.map((inst) => {
                const isComingSoon = inst.status === 'coming_soon';
                const isSelected = selectedInst?.id === inst.id;
                return (
                  <button
                    key={inst.id}
                    onClick={() => !isComingSoon && handleSelectInstitution(inst)}
                    disabled={isComingSoon}
                    className={`p-3 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500 text-white font-bold'
                        : isComingSoon
                          ? 'bg-slate-900/50 border-slate-800/50 text-slate-500 cursor-not-allowed opacity-60'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className={isComingSoon ? 'font-bold text-slate-500' : 'font-bold text-white'}>{inst.short_name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{inst.name}</div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    {isComingSoon && <span className="text-[9px] font-bold uppercase text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20 shrink-0">Coming soon</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Accordion Group 2: Verification & Business Profile */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => toggleGroup('verification')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Student Verification & Business Profile</h3>
              <p className="text-xs text-slate-400">Verification status & seller trust level</p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
              openGroup === 'verification' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openGroup === 'verification' && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-4">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white">Student ID Verification</span>
                <p className="text-[11px] text-slate-400">Get a green checkmark on your listings & profile</p>
              </div>
              <button className="px-3 py-1.5 bg-emerald-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-emerald-400">
                Request Badge
              </button>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white">Campus Business Registration</span>
                <p className="text-[11px] text-slate-400">For printing shops, electronics repairers, hostel agents</p>
              </div>
              <button className="px-3 py-1.5 bg-blue-500 text-white rounded-xl text-xs font-bold hover:bg-blue-400 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" /> Setup Business
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Accordion Group 3: Notifications & Preferences */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => toggleGroup('preferences')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Notification & Privacy Settings</h3>
              <p className="text-xs text-slate-400">Wishlist price drops, messages, listing alerts</p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
              openGroup === 'preferences' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openGroup === 'preferences' && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3 text-xs">
            <label className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-slate-300">Message & Chat Notifications</span>
              <input type="checkbox" defaultChecked className="accent-emerald-500 w-4 h-4" />
            </label>
            <label className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-slate-300">Wishlist Price Drop Alerts</span>
              <input type="checkbox" defaultChecked className="accent-emerald-500 w-4 h-4" />
            </label>
            <label className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-slate-300">Show Phone Number on Listings</span>
              <input type="checkbox" defaultChecked className="accent-emerald-500 w-4 h-4" />
            </label>
          </div>
        )}
      </div>

      {/* Accordion Group 4: Security & Danger Zone */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => toggleGroup('security')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Security, Data & Danger Zone</h3>
              <p className="text-xs text-slate-400">Password, sessions, export & deletion</p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
              openGroup === 'security' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openGroup === 'security' && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
            <button className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 hover:text-white text-left flex items-center justify-between">
              <span>Change Account Password</span>
              <Lock className="w-4 h-4 text-slate-500" />
            </button>
            <button className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 hover:text-white text-left flex items-center justify-between">
              <span>Export Account Data</span>
              <Download className="w-4 h-4 text-slate-500" />
            </button>
            <button className="w-full p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-semibold text-left flex items-center justify-between hover:bg-rose-500/20">
              <span>Delete Account Permanently</span>
              <Trash2 className="w-4 h-4 text-rose-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
