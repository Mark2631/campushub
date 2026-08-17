'use client';

import React, { useState } from 'react';
import {
  HelpCircle,
  X,
  PhoneCall,
  MessageSquare,
  Mail,
  Bug,
  Lightbulb,
  ShieldCheck,
  ChevronDown,
  BookOpen,
  ShoppingBag,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpCenterModal({ isOpen, onClose }: HelpCenterModalProps) {
  const [openFaq, setOpenFaq] = useState<string | null>('posting');

  if (!isOpen) return null;

  const faqs = [
    {
      id: 'posting',
      title: 'How to post a item, hostel or service?',
      icon: BookOpen,
      content:
        'Tap the "+ Sell" tab in the bottom navigation. Choose your category (Marketplace, Housing, Services, Jobs, Events), upload clear photos, set an honest price, and specify your institution campus location.',
    },
    {
      id: 'buying',
      title: 'Safety tips for buying from campus traders',
      icon: ShieldCheck,
      content:
        'Always meet in public, well-lit campus areas (such as Student Centre, Gate A/B, or Main Library). Inspect electronic items before paying. Never send deposits before seeing the item.',
    },
    {
      id: 'verification',
      title: 'How to get Student & Seller Verification Badges',
      icon: Sparkles,
      content:
        'Navigate to Profile -> Manage -> Student Verification. Upload your student ID or admission letter to earn the verified green checkmark badge.',
    },
    {
      id: 'institutions',
      title: 'How to switch or filter by school/institution',
      icon: ShoppingBag,
      content:
        'Go to Profile -> Manage -> Institution. You can filter listings between your school (e.g. MUST, Meru Poly, Mukiria TTI, Mitunguu TTI, Karumo TTI, MKU, KeMU) or view All Institutions.',
    },
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-emerald-600/20 via-teal-600/10 to-transparent border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">CampusTrader Help Center</h2>
              <p className="text-xs text-slate-400">Guides, FAQs & 24/7 Student Support</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Quick Contact Bar */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5" /> Immediate Assistance
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="https://wa.me/254745706087"
                target="_blank"
                rel="noreferrer"
                className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-500/25 transition-all"
              >
                <MessageSquare className="w-4 h-4" /> WhatsApp Support (0745706087)
              </a>
              <a
                href="tel:0745706087"
                className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-700 transition-all"
              >
                <PhoneCall className="w-4 h-4 text-emerald-400" /> Call 0745706087
              </a>
            </div>
          </div>

          {/* FAQs Accordion */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" /> Frequently Asked Questions & Guides
            </h3>
            <div className="space-y-2">
              {faqs.map((faq) => {
                const isOpen = openFaq === faq.id;
                const Icon = faq.icon;
                return (
                  <div key={faq.id} className="bg-slate-950/50 border border-slate-800/80 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : faq.id)}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-xs font-bold text-white">{faq.title}</span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="p-4 pt-0 text-xs text-slate-400 border-t border-slate-800/40 bg-slate-950/20">
                        {faq.content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Feedback & Bug Reporting */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <a
              href="https://wa.me/254745706087?text=I%20want%20to%20report%20a%20bug%20on%20CampusTrader"
              target="_blank"
              rel="noreferrer"
              className="p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <Bug className="w-4 h-4 text-amber-400" /> Report Bug
            </a>
            <a
              href="https://wa.me/254745706087?text=I%20have%20a%20feature%20suggestion%20for%20CampusTrader"
              target="_blank"
              rel="noreferrer"
              className="p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <Lightbulb className="w-4 h-4 text-emerald-400" /> Suggest Feature
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
