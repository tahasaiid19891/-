/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { COURSE_DATA } from './data';
import { CourseViewType } from './types';
import IntroductionView from './components/IntroductionView';
import InteractiveMap from './components/InteractiveMap';
import ThreeDViewer from './components/ThreeDViewer';

export default function App() {
  const [viewState, setViewState] = useState<CourseViewType>('home');
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  const currentChapter = COURSE_DATA[currentChapterIndex];

  const handleNextChapter = () => {
    if (currentChapterIndex < COURSE_DATA.length - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1);
      // Keep sidebar closed on transition as per request
      setIsSidebarOpen(false);
    }
  };

  const handleChapterSelect = (index: number) => {
    setCurrentChapterIndex(index);
    setIsSidebarOpen(false); // Automatically hide the sidebar when item is clicked
  };

  const handleExitToHome = () => {
    setViewState('home');
  };

  if (viewState === 'home') {
    return <IntroductionView onEnter={() => setViewState('course')} />;
  }

  return (
    <div className="min-h-screen bg-[#040a06] text-gray-100 font-sans flex flex-col justify-between select-none" dir="rtl" id="app-workspace-root">
      
      {/* Header Bar */}
      <header className="bg-[#08170f] border-b border-[#2d6a4f]/30 p-4 sticky top-0 z-[1001] flex items-center justify-between" id="app-header-bar">
        <div className="flex items-center gap-3">
          <img 
            src="https://i.ibb.co/d48GJcwn/unnamed.png" 
            alt="شعار جهاز الردع" 
            className="w-10 h-10 object-contain"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="text-sm md:text-base font-extrabold tracking-wide text-white">
              إدارة الفرق الأمنية والوحدات القتالية
            </h1>
            <p className="text-[10px] md:text-xs text-emerald-400 font-medium">
              وحدة الاستطلاع والتشويش - دورة أساسيات الاستطلاع الجوي
            </p>
          </div>
        </div>

        {/* Sidebar Toggle & Exit Buttons */}
        <div className="flex items-center gap-3" id="header-actions">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="px-4 py-1.5 rounded bg-[#1b4332] hover:bg-[#2d6a4f] text-emerald-100 border border-[#2d6a4f]/50 text-xs font-bold transition duration-300"
            id="btn-toggle-sidebar"
          >
            {isSidebarOpen ? 'إخفاء الفهرس' : 'إظهار الفهرس'}
          </button>
          
          <button
            onClick={handleExitToHome}
            className="px-3 py-1.5 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-800/40 text-xs font-bold transition duration-300"
            id="btn-exit-to-intro"
          >
            خروج للرئيسية
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 flex relative" id="workspace-layout">
        
        {/* Main Content Area */}
        <main className={`flex-1 p-4 md:p-8 overflow-y-auto transition-all duration-300 ${isSidebarOpen ? 'md:pl-80' : ''}`} id="main-content-scroll">
          <div className="max-w-4xl mx-auto" id="lesson-content-container">
            
            {/* Render Map Section if current index is map */}
            {currentChapter.id === 'interactive_map' ? (
              <div className="h-[600px]" id="map-wrapper">
                <InteractiveMap />
              </div>
            ) : currentChapter.id === 'sim_3d' ? (
              <div className="h-[650px]" id="three-wrapper">
                <ThreeDViewer />
              </div>
            ) : (
              /* Render Standard Lesson/Chapter content */
              <article className="space-y-6" id="lesson-article">
                
                {/* Lesson Header */}
                <header className="border-b border-[#2d6a4f]/30 pb-4" id="lesson-article-header">
                  <span className="text-[10px] md:text-xs font-bold tracking-widest text-[#52b788] uppercase block mb-1">
                    الدرس الحالي - وحدة التدريب
                  </span>
                  <h2 className="text-xl md:text-3xl font-black text-white">
                    {currentChapter.title}
                  </h2>
                  {currentChapter.intro && (
                    <p className="text-xs md:text-sm text-gray-400 mt-2 italic leading-relaxed">
                      {currentChapter.intro}
                    </p>
                  )}
                </header>

                {/* Lesson Body Content */}
                <div className="space-y-8 text-gray-200" id="lesson-sections-list">
                  {currentChapter.sections.map((section, sIdx) => (
                    <section key={sIdx} className="space-y-4 bg-[#08140e]/60 p-4 md:p-6 rounded-lg border border-[#2d6a4f]/15 shadow-sm" id={`section-${sIdx}`}>
                      
                      {/* Section Title */}
                      <h3 className="text-lg md:text-xl font-bold text-amber-300 border-r-4 border-amber-500 pr-3 py-1">
                        {section.title}
                      </h3>

                      {/* Paragraph Text */}
                      {section.content && (
                        <p className="text-xs md:text-sm leading-relaxed text-gray-300">
                          {section.content}
                        </p>
                      )}

                      {/* Main Section Image */}
                      {section.image && (
                        <div className="my-4 max-w-lg mx-auto rounded-lg overflow-hidden border border-[#2d6a4f]/40 shadow-lg bg-[#040c08]" id={`section-img-wrapper-${sIdx}`}>
                          <img 
                            src={section.image} 
                            alt={section.title} 
                            className="w-full h-auto object-cover max-h-[350px] mx-auto"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      {/* Bullet list points */}
                      {section.bulletPoints && section.bulletPoints.length > 0 && (
                        <ul className="space-y-3.5" id={`bullet-list-${sIdx}`}>
                          {section.bulletPoints.map((point, pIdx) => {
                            const parts = point.split(':');
                            if (parts.length > 1) {
                              return (
                                <li key={pIdx} className="text-xs md:text-sm leading-relaxed text-gray-300 border-b border-[#2d6a4f]/5 pb-2 last:border-0">
                                  <strong className="text-white font-bold block mb-1">{parts[0]}:</strong>
                                  <span className="text-gray-300 block pr-2 whitespace-pre-wrap">{parts.slice(1).join(':')}</span>
                                </li>
                              );
                            }
                            return (
                              <li key={pIdx} className="text-xs md:text-sm leading-relaxed text-gray-300 list-disc list-inside pr-2 whitespace-pre-wrap">
                                {point}
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {/* Subsections with specific images inside (like DJI parts) */}
                      {section.subsections && section.subsections.length > 0 && (
                        <div className="space-y-6 mt-4" id={`subsections-${sIdx}`}>
                          {section.subsections.map((sub, subIdx) => (
                            <div key={subIdx} className="bg-[#050c08]/80 p-4 rounded border border-[#2d6a4f]/20 shadow-inner space-y-4" id={`subsection-block-${sIdx}-${subIdx}`}>
                              <h4 className="text-base font-extrabold text-[#52b788]">
                                {sub.subtitle}
                              </h4>
                              
                              {sub.image && (
                                <div className="max-w-xs mx-auto rounded overflow-hidden border border-[#2d6a4f]/30 bg-black/40" id={`sub-img-wrapper-${sIdx}-${subIdx}`}>
                                  <img 
                                    src={sub.image} 
                                    alt={sub.subtitle} 
                                    className="w-full h-auto max-h-[220px] object-contain mx-auto"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}

                              <div className="space-y-2 text-xs md:text-sm text-gray-300 leading-relaxed pr-1">
                                {sub.paragraphs.map((p, pK) => (
                                  <p key={pK}>{p}</p>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                    </section>
                  ))}
                </div>

                {/* Bottom Navigation Panel / Next Button */}
                <footer className="pt-6 border-t border-[#2d6a4f]/30 flex justify-between items-center" id="lesson-footer">
                  <div className="text-xs text-gray-500">
                    الترتيب: {currentChapterIndex + 1} من {COURSE_DATA.length}
                  </div>
                  
                  {currentChapterIndex < COURSE_DATA.length - 1 ? (
                    <button
                      onClick={handleNextChapter}
                      className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-black rounded-md border border-emerald-500/40 transition duration-300 shadow-md flex items-center gap-2 active:scale-95"
                      id="btn-next-chapter"
                    >
                      <span>الانتقال للعنوان التالي</span>
                      <span>&larr;</span>
                    </button>
                  ) : (
                    <div className="text-xs font-extrabold text-amber-400 bg-amber-950/40 border border-amber-800/40 px-4 py-2 rounded">
                      تهانينا، تم الاطلاع على كامل المنهج التدريبي المعتمد بنجاح.
                    </div>
                  )}
                </footer>

              </article>
            )}

          </div>
        </main>

        {/* Collapsible Sidebar (Right Side) */}
        <aside 
          className={`fixed top-[73px] bottom-0 right-0 w-80 bg-[#06110a] border-l border-[#2d6a4f]/30 z-[1000] shadow-2xl flex flex-col justify-between transition-transform duration-300 ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          id="app-sidebar-panel"
        >
          {/* Index Header */}
          <div className="p-4 bg-[#08180f] border-b border-[#2d6a4f]/30 flex justify-between items-center" id="sidebar-header">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#52b788]">
                منهج وفهرس الدورة
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">اختر الدرس لعرضه مباشرة</p>
            </div>
            
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="text-xs text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 px-2 py-1 rounded transition bg-black/20"
              id="btn-close-sidebar"
            >
              إغلاق
            </button>
          </div>

          {/* Index Body (Buttons list with NO ICONS, as per explicit instruction!) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1" id="sidebar-chapters-list">
            {COURSE_DATA.map((ch, idx) => {
              const isActive = currentChapterIndex === idx;
              return (
                <button
                  key={ch.id}
                  onClick={() => handleChapterSelect(idx)}
                  className={`w-full text-right p-3 rounded text-xs font-bold transition duration-200 flex flex-col gap-1 border ${
                    isActive 
                      ? 'bg-[#1b4332] text-[#52b788] border-[#52b788]/40 shadow-inner' 
                      : 'text-gray-300 border-transparent hover:bg-[#0d2216] hover:text-white'
                  }`}
                  id={`sidebar-item-${ch.id}`}
                >
                  <span className="text-[10px] opacity-60 font-mono">القسم {idx + 1}</span>
                  <span className="text-sm tracking-wide">{ch.title}</span>
                </button>
              );
            })}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 bg-[#050e09] border-t border-[#2d6a4f]/20 text-[10px] text-gray-500 text-center font-mono" id="sidebar-footer">
            <span>سرية تامة - تداول محدود للوحدة</span>
          </div>
        </aside>

      </div>

    </div>
  );
}
