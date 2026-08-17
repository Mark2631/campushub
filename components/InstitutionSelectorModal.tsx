'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Check, Sparkles } from 'lucide-react';
import { fetchInstitutions, setStoredInstitution, Institution, SEEDED_INSTITUTIONS } from '@/lib/institutions';
import { updateProfile } from '@/lib/profiles';

interface InstitutionSelectorModalProps {
  isOpen: boolean;
  onSelect: (inst: Institution) => void;
  userId?: string;
  allowClose?: boolean;
}

export default function InstitutionSelectorModal({
  isOpen,
  onSelect,
  userId,
  allowClose = false,
}: InstitutionSelectorModalProps) {
  const [institutions, setInstitutions] = useState<Institution[]>(SEEDED_INSTITUTIONS);
  const [selected, setSelected] = useState<Institution | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchInstitutions().then((data) => setInstitutions(data));
  }, []);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      setStoredInstitution(selected);
      if (userId) {
        await updateProfile(userId, {
          institution_id: selected.id,
          campus: selected.short_name,
        } as any);
      }
      onSelect(selected);
    } catch (err) {
      console.error('Failed to save institution selection:', err);
      onSelect(selected);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-emerald-600/20 via-teal-600/10 to-transparent border-b border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Welcome to Meru Campus Hub
              </span>
              <h2 className="text-xl font-bold text-white">Select Your Institution</h2>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            CampusTrader connects tertiary students across Meru County. Choose your school to see local listings, hostels, and services.
          </p>
        </div>

        {/* Institution List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          {institutions.map((inst) => {
            const isSelected = selected?.id === inst.id;
            return (
              <button
                key={inst.id}
                onClick={() => setSelected(inst)}
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-lg shadow-emerald-500/10 scale-[1.01]'
                    : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-white">{inst.short_name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                      {inst.county}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{inst.name}</p>
                </div>

                <div
                  className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                      : 'border-slate-600 bg-slate-800'
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between gap-4">
          {allowClose ? (
            <button
              onClick={() => onSelect(selected || institutions[0])}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          ) : (
            <span className="text-xs text-slate-500">Selection required to proceed</span>
          )}

          <button
            onClick={handleConfirm}
            disabled={!selected || isSubmitting}
            className="flex-1 max-w-[200px] ml-auto py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
