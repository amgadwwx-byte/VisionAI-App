
import React, { useState, useEffect, useRef } from 'react';
import { 
  DesignType, 
  DesignStyle, 
  DesignConfig, 
  Layer, 
  AppState,
  ScreenState
} from './types';
import { 
  DESIGN_TYPES, 
  DESIGN_STYLES, 
  ASPECT_RATIOS,
  FONT_FAMILIES
} from './constants';
import { 
  generateDesign, 
  removeBackground, 
  upscaleImage, 
  removeTextAndWatermarks,
  customImageEdit 
} from './services/geminiService';
import LayerItem from './components/LayerItem';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    screen: 'splash',
    isGenerating: false,
    results: [],
    layers: [],
    selectedLayerId: null,
    isPro: false,
    credits: 10,
    savedProjects: [],
  });

  const [config, setConfig] = useState<DesignConfig>({
    prompt: '',
    type: DesignType.LOGO,
    style: DesignStyle.MODERN,
    aspectRatio: '1:1',
    colorPalette: '#3b82f6',
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [customEditPrompt, setCustomEditPrompt] = useState('');
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-hide sidebar on mobile resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (state.screen === 'splash') {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, screen: 'login' }));
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [state.screen]);

  const handleGenerate = async () => {
    if (!config.prompt) return;
    if (state.credits <= 0 && !state.isPro) {
      alert("نفد الرصيد! يرجى الترقية إلى النسخة الاحترافية.");
      return;
    }
    
    setState(prev => ({ ...prev, isGenerating: true }));
    try {
      const images = await generateDesign(config);
      setState(prev => ({
        ...prev,
        isGenerating: false,
        results: images,
      }));
      // Auto scroll to results on mobile
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 500);
    } catch (error) {
      alert("حدث خطأ أثناء التوليد. يرجى المحاولة مرة أخرى.");
      setState(prev => ({ ...prev, isGenerating: false }));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        startEditing(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const startEditing = (img: string) => {
    const newLayer: Layer = {
      id: `img-${Date.now()}`,
      type: 'image',
      content: img,
      x: 50,
      y: 50,
      rotation: 0,
      opacity: 1,
      isLocked: false,
      width: window.innerWidth < 768 ? 250 : 400
    };
    setState(prev => ({
      ...prev,
      screen: 'editor',
      layers: [newLayer],
      selectedLayerId: newLayer.id,
      credits: prev.isPro ? prev.credits : prev.credits - 1
    }));
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const saveProject = () => {
    const mainImg = state.layers.find(l => l.type === 'image')?.content || '';
    const newProject = {
      id: Date.now().toString(),
      name: config.prompt.substring(0, 20) || 'مشروع جديد',
      thumbnail: mainImg,
      date: new Date().toLocaleDateString('ar-EG')
    };
    setState(prev => ({
      ...prev,
      savedProjects: [newProject, ...prev.savedProjects]
    }));
    alert("تم حفظ المشروع بنجاح!");
  };

  const handleShare = async () => {
    const lastLayer = state.layers.find(l => l.type === 'image');
    if (!lastLayer) return;

    if (navigator.share) {
      try {
        const blob = await fetch(lastLayer.content).then(r => r.blob());
        const file = new File([blob], "VisionAI-Design.png", { type: 'image/png' });
        await navigator.share({
          files: [file],
          title: 'تصميم VisionAI',
          text: 'انظر ماذا صممت بواسطة VisionAI Studio!',
        });
      } catch (err) {
        console.error("Share failed", err);
      }
    } else {
      exportDesign();
    }
  };

  const updateLayer = (id: string, updates: Partial<Layer>) => {
    setState(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === id ? { ...l, ...updates } : l)
    }));
  };

  const addTextLayer = () => {
    const newLayer: Layer = {
      id: `txt-${Date.now()}`,
      type: 'text',
      content: 'نص جديد',
      x: 50,
      y: 50,
      rotation: 0,
      fontSize: 32,
      color: '#ffffff',
      fontFamily: 'IBM Plex Sans Arabic',
      opacity: 1,
      isLocked: false,
      effect: 'none'
    };
    setState(prev => ({
      ...prev,
      layers: [...prev.layers, newLayer],
      selectedLayerId: newLayer.id
    }));
    if (window.innerWidth < 768) setIsSidebarOpen(true);
  };

  const handleCustomEdit = async () => {
    if (!customEditPrompt) return;
    const selectedLayer = state.layers.find(l => l.id === state.selectedLayerId);
    if (!selectedLayer || selectedLayer.type !== 'image') return;

    setState(prev => ({ ...prev, isGenerating: true }));
    try {
      const newUrl = await customImageEdit(selectedLayer.content, customEditPrompt);
      updateLayer(selectedLayer.id, { content: newUrl });
      setCustomEditPrompt(''); 
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    } catch (error) {
      alert("عذراً، لم نتمكن من تنفيذ هذا التعديل.");
    } finally {
      setState(prev => ({ ...prev, isGenerating: false }));
    }
  };

  const exportDesign = () => {
    const link = document.createElement('a');
    const lastLayer = state.layers.find(l => l.type === 'image');
    link.href = lastLayer?.content || '';
    link.download = `VisionAI-${Date.now()}.png`;
    link.click();
  };

  // --- Utility Functions for Logic ---
  const handleRemoveBg = async () => {
    const selectedLayer = state.layers.find(l => l.id === state.selectedLayerId);
    if (!selectedLayer || selectedLayer.type !== 'image') return;
    setState(prev => ({ ...prev, isGenerating: true }));
    try {
      const newUrl = await removeBackground(selectedLayer.content);
      updateLayer(selectedLayer.id, { content: newUrl });
    } finally {
      setState(prev => ({ ...prev, isGenerating: false }));
    }
  };

  const handleUpscale = async () => {
    const selectedLayer = state.layers.find(l => l.id === state.selectedLayerId);
    if (!selectedLayer || selectedLayer.type !== 'image') return;
    setState(prev => ({ ...prev, isGenerating: true }));
    try {
      const newUrl = await upscaleImage(selectedLayer.content, config.prompt);
      updateLayer(selectedLayer.id, { content: newUrl });
    } finally {
      setState(prev => ({ ...prev, isGenerating: false }));
    }
  };

  // --- RENDERING ---

  if (state.screen === 'splash') {
    return (
      <div className="h-screen w-full bg-[#020617] flex flex-col items-center justify-center text-white p-8">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-2xl shadow-blue-500/40 animate-pulse mb-6">V</div>
        <h1 className="text-3xl font-bold mb-2 tracking-tighter">VisionAI Studio</h1>
        <p className="text-slate-500 text-sm">الإبداع بلا حدود</p>
      </div>
    );
  }

  if (state.screen === 'login') {
    return (
      <div className="min-h-screen w-full bg-[#020617] flex items-center justify-center p-4 text-white" dir="rtl">
        <div className="w-full max-w-sm bg-slate-900/50 border border-white/10 p-8 rounded-3xl shadow-2xl space-y-6 backdrop-blur-xl">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center text-xl font-bold mx-auto mb-2">V</div>
            <h2 className="text-2xl font-bold">تسجيل الدخول</h2>
            <p className="text-slate-400 text-sm">ابدأ رحلة الإبداع اليوم</p>
          </div>
          <div className="space-y-3">
            <button onClick={() => setState(prev => ({ ...prev, screen: 'home' }))} className="w-full py-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-100 transition-all active:scale-95 text-sm">
               المتابعة كضيف
            </button>
            <button onClick={() => setState(prev => ({ ...prev, screen: 'home' }))} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-all active:scale-95 text-sm">
               تسجيل الدخول
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.screen === 'home') {
    return (
      <div className="min-h-screen w-full bg-[#020617] text-white flex flex-col items-center overflow-x-hidden" dir="rtl">
        <header className="w-full h-16 md:h-20 px-4 md:px-8 flex items-center justify-between border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">V</div>
             <span className="text-lg font-bold hidden sm:inline">VisionAI</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="bg-slate-800 px-3 py-1.5 rounded-full text-[10px] sm:text-xs border border-white/5">🪙 {state.credits}</div>
            <button onClick={() => setState(prev => ({ ...prev, isPro: true }))} className="bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-1.5 rounded-full font-bold text-[10px] sm:text-xs">PRO</button>
          </div>
        </header>

        <main className="w-full max-w-4xl px-4 py-8 space-y-8 pb-20">
           <section className="text-center space-y-2">
             <h2 className="text-3xl sm:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">صمم خيالك</h2>
             <p className="text-slate-400 text-sm">توليد تصاميم احترافية بضغطة زر</p>
           </section>

           <section className="bg-slate-900/40 border border-white/5 p-5 sm:p-8 rounded-3xl space-y-6">
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500">وصف فكرتك</label>
               <textarea 
                 value={config.prompt}
                 onChange={e => setConfig({...config, prompt: e.target.value})}
                 placeholder="مثلاً: شعار لشركة تكنولوجيا..."
                 className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-base focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
               />
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500">النوع</label>
                   <div className="grid grid-cols-2 gap-2">
                     {DESIGN_TYPES.slice(0, 4).map(t => (
                       <button key={t.id} onClick={() => setConfig({...config, type: t.id as DesignType})} className={`p-3 rounded-xl border text-xs transition-all ${config.type === t.id ? 'bg-blue-600 border-blue-400' : 'bg-slate-950 border-slate-800'}`}>{t.label}</button>
                     ))}
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500">المقاس</label>
                   <div className="grid grid-cols-2 gap-2">
                     {ASPECT_RATIOS.map(r => (
                       <button key={r.id} onClick={() => setConfig({...config, aspectRatio: r.id as any})} className={`p-3 rounded-xl border text-xs transition-all ${config.aspectRatio === r.id ? 'bg-purple-600 border-purple-400' : 'bg-slate-950 border-slate-800'}`}>{r.label}</button>
                     ))}
                   </div>
                </div>
             </div>

             <button onClick={handleGenerate} disabled={state.isGenerating || !config.prompt} className={`w-full py-5 rounded-2xl font-black text-lg transition-all active:scale-95 ${state.isGenerating ? 'bg-slate-800' : 'bg-blue-600 shadow-xl shadow-blue-600/20'}`}>
               {state.isGenerating ? "جاري التوليد..." : "توليد التصميم ✨"}
             </button>
             
             <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 rounded-2xl font-bold bg-slate-800 text-sm border border-white/5 transition-all">
                📂 رفع صورة للتعديل
             </button>
             <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
           </section>

           {state.results.length > 0 && (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {state.results.map((img, i) => (
                 <div key={i} className="rounded-2xl overflow-hidden bg-slate-900 border border-white/10 group relative">
                    <img src={img} className="w-full aspect-square object-cover" />
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-4">
                       <button onClick={() => startEditing(img)} className="w-full bg-white text-black py-3 rounded-xl font-bold">تعديل الآن</button>
                    </div>
                 </div>
               ))}
             </div>
           )}
        </main>
      </div>
    );
  }

  // --- EDITOR SCREEN ---
  const selectedLayer = state.layers.find(l => l.id === state.selectedLayerId);

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden relative" dir="rtl">
      {/* Drawer Overlay for Mobile */}
      {isSidebarOpen && window.innerWidth < 768 && (
        <div className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Sidebar / Drawer */}
      <aside className={`fixed md:relative top-0 right-0 h-full ${isSidebarOpen ? 'w-[85vw] md:w-80 translate-x-0' : 'w-0 translate-x-full md:w-0'} transition-all duration-300 bg-slate-900 border-l border-slate-800 flex flex-col z-[70] shadow-2xl overflow-y-auto custom-scrollbar`}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-blue-400">أدوات التحكم</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-500">✕</button>
          </div>

          {selectedLayer ? (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              {selectedLayer.type === 'text' && (
                <div className="space-y-4">
                  <textarea className="w-full bg-slate-800 rounded-xl p-3 text-sm outline-none border border-slate-700 h-20" value={selectedLayer.content} onChange={e => updateLayer(selectedLayer.id, { content: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="color" className="w-full h-10 rounded-lg bg-slate-800" value={selectedLayer.color} onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })} />
                    <select className="bg-slate-800 rounded-lg text-xs" value={selectedLayer.fontFamily} onChange={e => updateLayer(selectedLayer.id, { fontFamily: e.target.value })}>
                       {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {selectedLayer.type === 'image' && (
                <div className="space-y-2">
                   <button onClick={handleRemoveBg} className="w-full py-3 bg-indigo-600 rounded-xl text-xs font-bold">إزالة الخلفية</button>
                   <button onClick={handleUpscale} className="w-full py-3 bg-slate-800 rounded-xl text-xs font-bold border border-white/5">تحسين الجودة</button>
                   
                   <div className="pt-4 space-y-3">
                      <label className="text-[10px] text-slate-500 font-bold uppercase">تعديل ذكي مخصص</label>
                      <textarea 
                        value={customEditPrompt}
                        onChange={e => setCustomEditPrompt(e.target.value)}
                        placeholder="مثلاً: اجعل الخلفية ممطرة..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs min-h-[80px]"
                      />
                      <button onClick={handleCustomEdit} className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-xs font-bold">تنفيذ</button>
                   </div>
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">الحجم</label>
                  <input type="range" min="10" max="800" className="w-full accent-blue-500" value={selectedLayer.width || selectedLayer.fontSize} onChange={e => updateLayer(selectedLayer.id, selectedLayer.type === 'image' ? { width: Number(e.target.value) } : { fontSize: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">الشفافية</label>
                  <input type="range" min="0" max="1" step="0.1" className="w-full accent-blue-500" value={selectedLayer.opacity} onChange={e => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) })} />
                </div>
              </div>
              <button onClick={() => setState(prev => ({ ...prev, layers: prev.layers.filter(l => l.id !== selectedLayer.id), selectedLayerId: null }))} className="w-full py-3 text-red-500 bg-red-500/10 rounded-xl text-xs font-bold">حذف العنصر</button>
            </div>
          ) : (
            <p className="text-center text-slate-500 text-xs py-10">اختر عنصراً للتعديل</p>
          )}
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden h-full">
        <header className="h-14 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-4 z-20">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-slate-800 rounded-lg">⚙️</button>
            <button onClick={addTextLayer} className="p-2 bg-slate-800 rounded-lg">➕ T</button>
            <button onClick={() => setState(prev => ({ ...prev, screen: 'home' }))} className="p-2 bg-slate-800 rounded-lg">🏠</button>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={handleShare} className="px-4 py-2 bg-blue-600 rounded-full text-xs font-bold">مشاركة</button>
          </div>
        </header>

        <div className="flex-1 bg-slate-950 flex items-center justify-center p-4 md:p-10 overflow-auto touch-none">
          <div 
            ref={canvasRef}
            className="relative bg-[#0a0f1e] shadow-2xl overflow-hidden shrink-0 border border-white/5"
            style={{
              width: window.innerWidth < 768 ? '300px' : config.aspectRatio === '1:1' ? '600px' : '800px',
              height: window.innerWidth < 768 ? (config.aspectRatio === '9:16' ? '533px' : '300px') : config.aspectRatio === '1:1' ? '600px' : '450px',
              maxWidth: '90vw',
              maxHeight: '70vh'
            }}
          >
            {state.layers.map(layer => (
              <LayerItem 
                key={layer.id} 
                layer={layer} 
                isSelected={state.selectedLayerId === layer.id}
                onSelect={id => setState(prev => ({ ...prev, selectedLayerId: id }))}
                onUpdate={updateLayer}
              />
            ))}
            
            {state.isGenerating && (
              <div className="absolute inset-0 z-[100] bg-black/60 flex flex-col items-center justify-center gap-4 text-center p-6">
                 <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                 <p className="text-sm font-bold">الذكاء الاصطناعي يعمل...</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        .animate-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        /* Disable text selection and bounce for mobile UI feel */
        * { -webkit-user-select: none; touch-action: manipulation; }
        input, textarea { -webkit-user-select: text; touch-action: auto; }
      `}</style>
    </div>
  );
};

export default App;
