/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Shield, Lock, ChevronLeft, Eye, Radio } from 'lucide-react';

interface IntroductionViewProps {
  onEnter: () => void;
}

export default function IntroductionView({ onEnter }: IntroductionViewProps) {
  return (
    <div className="min-h-screen bg-[#040c08] text-gray-100 font-sans relative overflow-hidden flex flex-col justify-between" id="intro-view-container">
      
      {/* Visual Ambient Background Enhancements */}
      <div className="absolute inset-0 pointer-events-none" id="ambient-overlay">
        {/* Tactical Grid Overlay */}
        <div className="absolute inset-0 tactical-grid opacity-20" />
        {/* Pulsing light spots */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-950/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-950/20 rounded-full blur-[100px]" />
        <div className="absolute top-10 left-10 w-72 h-72 bg-emerald-950/20 rounded-full blur-[90px]" />
      </div>

      {/* Top Security Clearance Badge */}
      <div className="p-6 flex justify-between items-center relative z-10" id="intro-top-badge">
        <div className="flex items-center gap-2 border border-[#2d6a4f]/30 px-3 py-1 bg-[#091510]/80 rounded text-xs text-emerald-400 font-mono tracking-wider">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>SECURITY ACCESS: RESTRICTED</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-gray-500 font-mono">
          <span>PORT: 3000</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* Main Core Content Card */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 relative z-10" id="intro-main-panel">
        
        {/* Logo and Tactical Radar Container */}
        <div className="relative mb-8 group" id="logo-radar-container">
          {/* Outer rotating pulse rings */}
          <div className="absolute inset-0 -m-8 rounded-full border border-dashed border-[#2d6a4f]/30 animate-[spin_40s_linear_infinite]" />
          <div className="absolute inset-0 -m-4 rounded-full border border-emerald-500/10 animate-radar-pulse" />
          
          {/* Logo element with gorgeous shadow */}
          <div className="relative w-44 h-44 md:w-52 md:h-52 bg-[#06140d] rounded-full p-2 border border-[#2d6a4f]/40 flex items-center justify-center shadow-2xl transition duration-500 group-hover:border-[#52b788]/60">
            <img 
              src="https://i.ibb.co/d48GJcwn/unnamed.png" 
              alt="شعار جهاز الردع" 
              className="w-full h-full object-contain pointer-events-none drop-shadow-[0_0_15px_rgba(45,106,79,0.4)]"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Written Info Stack */}
        <div className="text-center max-w-2xl space-y-4" id="intro-text-info-stack">
          
          {/* Title 1: Administration of Security Forces & Combat Units */}
          <h1 className="text-xl md:text-3xl font-extrabold tracking-wide text-white drop-shadow-md">
            إدارة الفرق الأمنية والوحدات القتالية
          </h1>

          {/* Subtitle 2: Reconnaissance and Jamming Unit */}
          <div className="flex items-center justify-center gap-2">
            <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-emerald-500" />
            <h2 className="text-base md:text-lg font-bold text-emerald-400 tracking-wide">
              وحدة الاستطلاع والتشويش - القاطع الأول
            </h2>
            <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-emerald-500" />
          </div>

          {/* Subtitle 3: Course Title */}
          <div className="py-2 px-6 bg-[#0c2217] border border-[#2d6a4f]/50 rounded-lg inline-block shadow-inner">
            <h3 className="text-lg md:text-xl font-black text-amber-300 font-sans tracking-wide">
              دورة في أساسيات الإستطلاع الجوي
            </h3>
          </div>

          <p className="text-xs md:text-sm text-gray-400 max-w-lg mx-auto leading-relaxed mt-2">
            دورة تدريبية تفاعلية مخصصة لتدريب عناصر وحدة الإستطلاع والتشويش
          </p>
        </div>

        {/* Enter Button Panel */}
        <div className="mt-10" id="intro-enter-action">
          <button
            onClick={onEnter}
            className="group relative px-10 py-4 bg-gradient-to-r from-emerald-800 to-emerald-600 hover:from-emerald-700 hover:to-emerald-500 text-white font-extrabold text-base md:text-lg rounded-lg border border-emerald-400/40 hover:border-emerald-300 transition-all duration-300 shadow-[0_0_20px_rgba(45,106,79,0.3)] hover:shadow-[0_0_30px_rgba(82,183,136,0.5)] cursor-pointer flex items-center gap-3 active:scale-95"
            id="btn-enter-system"
          >
            <Lock className="w-5 h-5 text-emerald-300 group-hover:rotate-12 transition-all duration-300" />
            <span className="tracking-widest">الدخـول إلـى الدورة التدريبية</span>
            <ChevronLeft className="w-5 h-5 text-white/80 group-hover:-translate-x-1 transition-transform" />
          </button>
        </div>

      </div>

      {/* Footer / System status */}
      <div className="p-6 border-t border-[#2d6a4f]/20 bg-[#06120b] flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-gray-500 relative z-10" id="intro-footer">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-emerald-500" />
            منظومة التدريب: <strong className="text-gray-400 font-semibold">نشطة</strong>
          </span>
          <span className="hidden md:inline">|</span>
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-amber-500" />
            المسار: <strong className="text-gray-400 font-semibold">سري للغاية ويُمنع النشر</strong>
          </span>
        </div>
        <div className="font-mono text-center md:text-right">
          <div>© جهاز الردع لمكافحة الإرهاب والجريمة المنظمة - 2026</div>
          <div className="text-[10px] text-gray-500 mt-1 font-sans">اعداد وتنفيد N126</div>
        </div>
      </div>

    </div>
  );
}
