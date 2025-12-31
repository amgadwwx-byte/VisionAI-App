
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [customEditPrompt, setCustomEditPrompt] = useState('');
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Splash Screen Timer
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
      width: 400
    };
    setState(prev => ({
      ...prev,
      screen: 'editor',
      layers: [newLayer],
      selectedLayerId: newLayer.id,
      credits: prev.isPro ? prev.credits : prev.credits - 1
    }));
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
    alert("تم حفظ المشروع في مكتبتك بنجاح!");
  };

  const addTextLayer = () => {
    const newLayer: Layer = {
      id: `txt-${Date.now()}`,
      type: 'text',
      content: 'اكتب نصك هنا',
      x: 50,
      y: 50,
      rotation: 0,
      fontSize: 48,
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
  };

  const updateLayer = (id: string, updates: Partial<Layer>) => {
    setState(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === id ? { ...l, ...updates } : l)
    }));
  };

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

  const handleRemoveTextRequest = () => {
    setShowLegalModal(true);
  };

  const executeRemoveText = async () => {
    if (!hasConsented) return;
    setShowLegalModal(false);
    
    const selectedLayer = state.layers.find(l => l.id === state.selectedLayerId);
    if (!selectedLayer || selectedLayer.type !== 'image') return;

    setState(prev => ({ ...prev, isGenerating: true }));
    try {
      const newUrl = await removeTextAndWatermarks(selectedLayer.content);
      updateLayer(selectedLayer.id, { content: newUrl });
    } finally {
      setState(prev => ({ ...prev, isGenerating: false }));
    }
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
    } catch (error) {
      alert("عذراً، لم نتمكن من تنفيذ هذا التعديل. يرجى محاولة وصف آخر.");
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

  // --- Screens ---

  if (state.screen === 'splash') {
    return (
      <div className="h-screen w-full bg-[#020617] flex flex-col items-center justify-center text-white p-8">
        <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center text-4xl font-bold shadow-2xl shadow-blue-500/40 animate-pulse mb-8">V</div>
        <h1 className="text-4xl font-bold mb-4 tracking-tighter">VisionAI Studio</h1>
        <p className="text-slate-400 text-lg animate-bounce">حوّل أفكارك إلى تصاميم بالذكاء الاصطناعي</p>
      </div>
    );
  }

  if (state.screen === 'login') {
    return (
      <div className="h-screen w-full bg-[#020617] flex items-center justify-center p-6 text-white" dir="rtl">
        <div className="max-w-md w-full bg-slate-900/50 border border-white/10 p-10 rounded-[2.5rem] shadow-2xl space-y-8 backdrop-blur-xl">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-4">V</div>
            <h2 className="text-3xl font-bold">تسجيل الدخول</h2>
            <p className="text-slate-400">ابدأ رحلة الإبداع اليوم</p>
          </div>
          
          <div className="space-y-4">
            <button 
              onClick={() => setState(prev => ({ ...prev, screen: 'home' }))}
              className="w-full py-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-100 transition-colors"
            >
              <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-6 h-6" alt="Google" />
              الدخول عبر Google
            </button>
            <button 
              onClick={() => setState(prev => ({ ...prev, screen: 'home' }))}
              className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-colors"
            >
              الدخول بالبريد الإلكتروني
            </button>
            <button 
              onClick={() => setState(prev => ({ ...prev, screen: 'home' }))}
              className="w-full text-sm text-slate-500 hover:text-blue-400 transition-colors"
            >
              المتابعة كضيف
            </button>
          </div>

          <p className="text-[10px] text-center text-slate-600 leading-relaxed">
            بتسجيل الدخول، أنت توافق على شروط الخدمة وسياسة الخصوصية.
            <br />VisionAI Studio يحترم حقوق النشر.
          </p>
        </div>
      </div>
    );
  }

  if (state.screen === 'home') {
    return (
      <div className="h-screen w-full bg-[#020617] text-white flex flex-col items-center justify-start overflow-y-auto" dir="rtl">
        {/* Header */}
        <header className="w-full h-20 px-8 flex items-center justify-between border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl">V</div>
             <span className="text-xl font-bold">VisionAI Studio</span>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setState(prev => ({ ...prev, screen: 'profile' }))}
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              مشاريعي
            </button>
            <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-full text-sm border border-white/5">
              <span className="text-amber-400">🪙</span>
              <span>رصيد: {state.isPro ? '∞' : state.credits}</span>
            </div>
            {!state.isPro && (
              <button 
                onClick={() => setState(prev => ({ ...prev, isPro: true }))}
                className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2 rounded-full font-bold text-sm shadow-lg hover:scale-105 transition-transform"
              >
                الترقية لـ PRO
              </button>
            )}
          </div>
        </header>

        <main className="max-w-5xl w-full px-6 py-12 space-y-12">
           <section className="text-center space-y-4">
             <h2 className="text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500">من الخيال إلى الواقع</h2>
             <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">استخدم قوة الذكاء الاصطناعي لتوليد تصاميم احترافية، شعارات، ومنشورات تواصل اجتماعي مذهلة.</p>
           </section>

           <section className="bg-slate-900/40 border border-white/5 p-8 rounded-[3rem] shadow-2xl space-y-10 backdrop-blur-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] pointer-events-none"></div>
             
             <div className="space-y-4 relative z-10">
               <div className="flex items-center justify-between">
                 <label className="text-sm font-bold text-slate-300">أدخل وصفاً لفكرتك</label>
                 <span className="text-[10px] text-slate-500 uppercase tracking-widest">AI Core v2.5</span>
               </div>
               <textarea 
                 value={config.prompt}
                 onChange={e => setConfig({...config, prompt: e.target.value})}
                 placeholder="مثلاً: شعار لشركة تكنولوجيا بأسلوب تقني مستقبلي مع ألوان متدرجة..."
                 className="w-full bg-slate-950/80 border border-slate-800 rounded-3xl p-6 text-xl focus:ring-4 focus:ring-blue-600/20 focus:border-blue-500 transition-all outline-none h-36 resize-none shadow-inner"
               />
             </div>

             <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
               <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-500">نوع التصميم</label>
                 <div className="grid grid-cols-1 gap-2">
                   {DESIGN_TYPES.map(t => (
                     <button 
                       key={t.id}
                       onClick={() => setConfig({...config, type: t.id as DesignType})}
                       className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-sm ${config.type === t.id ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-600/20' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                     >
                       <span className="text-lg">{t.icon}</span>
                       <span className="font-medium">{t.label}</span>
                     </button>
                   ))}
                 </div>
               </div>

               <div className="space-y-2 col-span-2">
                 <label className="text-xs font-bold text-slate-500">الأسلوب الفني</label>
                 <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                   {DESIGN_STYLES.map(s => (
                     <button 
                       key={s.id}
                       onClick={() => setConfig({...config, style: s.id as DesignStyle})}
                       className={`p-3 rounded-2xl border transition-all text-sm font-medium ${config.style === s.id ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-600/20' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                     >
                       {s.label}
                     </button>
                   ))}
                 </div>
               </div>

               <div className="space-y-6">
                 <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500">المقاس</label>
                   <select 
                     className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-sm outline-none"
                     value={config.aspectRatio}
                     onChange={e => setConfig({...config, aspectRatio: e.target.value as any})}
                   >
                     {ASPECT_RATIOS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                   </select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500">باليت الألوان</label>
                   <input 
                     type="color" 
                     className="w-full h-12 bg-slate-950 rounded-2xl border border-slate-800 p-1 cursor-pointer"
                     value={config.colorPalette}
                     onChange={e => setConfig({...config, colorPalette: e.target.value})}
                   />
                 </div>
               </div>
             </div>

             <div className="flex flex-col md:flex-row gap-4 relative z-10">
               <button 
                 onClick={handleGenerate}
                 disabled={state.isGenerating || !config.prompt}
                 className={`flex-1 py-6 rounded-3xl font-black text-2xl flex items-center justify-center gap-4 transition-all ${state.isGenerating ? 'bg-slate-800 cursor-not-allowed text-slate-500' : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:scale-[1.02] shadow-2xl shadow-blue-600/30 active:scale-95'}`}
               >
                 {state.isGenerating ? (
                   <>
                     <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                     <span>VisionAI يعالج فكرتك...</span>
                   </>
                 ) : (
                   <>
                     <span className="text-2xl">✨</span>
                     <span>توليد التصميم الذكي</span>
                   </>
                 )}
               </button>
               
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="md:w-1/3 py-6 rounded-3xl font-bold text-xl bg-slate-800 hover:bg-slate-700 border border-white/5 flex items-center justify-center gap-3 transition-all active:scale-95"
               >
                 <span>📂</span>
                 <span>رفع صورة للتعديل</span>
               </button>
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 onChange={handleImageUpload} 
                 accept="image/*" 
                 className="hidden" 
               />
             </div>
           </section>

           {state.results.length > 0 && (
             <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center justify-between">
                 <h3 className="text-3xl font-bold">النتائج المقترحة</h3>
                 <button onClick={() => setState(prev => ({ ...prev, results: [] }))} className="text-xs text-slate-500 hover:text-white">مسح النتائج</button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {state.results.map((img, i) => (
                   <div key={i} className="group relative rounded-[2.5rem] overflow-hidden bg-slate-900 aspect-square ring-1 ring-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                     <img src={img} alt="Result" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-end p-10 gap-4">
                       <button 
                         onClick={() => startEditing(img)}
                         className="w-full bg-white text-black py-4 rounded-2xl font-bold hover:bg-blue-100 transition-colors shadow-xl"
                       >
                         تعديل واحتراف
                       </button>
                       <div className="flex gap-2 w-full">
                         <a href={img} download={`VisionAI-Export-${i}.png`} className="flex-1 bg-slate-800/80 backdrop-blur text-center py-3 rounded-xl text-sm font-bold border border-white/10">تحميل</a>
                         <button onClick={saveProject} className="flex-1 bg-slate-800/80 backdrop-blur py-3 rounded-xl text-sm font-bold border border-white/10">حفظ</button>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </section>
           )}
        </main>
      </div>
    );
  }

  if (state.screen === 'profile') {
    return (
      <div className="h-screen w-full bg-[#020617] text-white overflow-y-auto" dir="rtl">
        <header className="h-20 px-8 flex items-center border-b border-white/10 sticky top-0 bg-[#020617] z-50">
          <button onClick={() => setState(prev => ({ ...prev, screen: 'home' }))} className="p-2 hover:bg-slate-800 rounded-lg ml-4">🏠</button>
          <h2 className="text-xl font-bold">مكتبة مشاريعي</h2>
        </header>
        <main className="max-w-6xl mx-auto p-12 space-y-12">
          {state.savedProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {state.savedProjects.map(proj => (
                <div key={proj.id} className="bg-slate-900 rounded-[2rem] overflow-hidden border border-white/5 hover:border-blue-500/50 transition-colors group">
                  <div className="aspect-video relative overflow-hidden">
                    <img src={proj.thumbnail} className="w-full h-full object-cover" alt={proj.name} />
                  </div>
                  <div className="p-6 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold">{proj.name}</h4>
                      <p className="text-xs text-slate-500">{proj.date}</p>
                    </div>
                    <button onClick={() => startEditing(proj.thumbnail)} className="p-2 bg-blue-600 rounded-lg">✏️</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-24 space-y-4">
              <div className="text-6xl opacity-20">📁</div>
              <h3 className="text-2xl font-bold text-slate-500">لا توجد مشاريع محفوظة بعد</h3>
              <button onClick={() => setState(prev => ({ ...prev, screen: 'home' }))} className="px-6 py-2 bg-slate-800 rounded-full text-sm">ابدأ تصميمك الأول</button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // --- Editor Screen ---
  const selectedLayer = state.layers.find(l => l.id === state.selectedLayerId);

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden" dir="rtl">
      <aside className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto z-50 shadow-2xl`}>
        <div className="p-6 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">V</div>
              <h1 className="text-lg font-bold">المحرر الذكي</h1>
            </div>
            <button onClick={() => setState(prev => ({ ...prev, screen: 'home' }))} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500">✕</button>
          </div>

          {selectedLayer ? (
            <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
              <h3 className="text-sm font-bold text-blue-400 border-b border-blue-500/20 pb-2">تعديل العنصر المختار</h3>
              
              {selectedLayer.type === 'text' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">محتوى النص</label>
                    <textarea 
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={selectedLayer.content}
                      onChange={e => updateLayer(selectedLayer.id, { content: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">الخط العربي</label>
                      <select 
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs"
                        value={selectedLayer.fontFamily}
                        onChange={e => updateLayer(selectedLayer.id, { fontFamily: e.target.value })}
                      >
                        {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">اللون</label>
                      <input type="color" className="w-full h-10 bg-slate-800 rounded-lg border-none" value={selectedLayer.color} onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">المؤثرات البصرية</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['none', 'neon', 'glow', 'shadow', 'gradient'].map(fx => (
                        <button key={fx} onClick={() => updateLayer(selectedLayer.id, { effect: fx as any })} className={`px-2 py-2 rounded-xl text-[10px] font-bold border transition-all ${selectedLayer.effect === fx ? 'bg-blue-600 border-blue-400' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>{fx.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedLayer.type === 'image' && (
                <div className="space-y-4">
                   <button onClick={handleRemoveBg} disabled={state.isGenerating} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20">
                     🧠 إزالة الخلفية
                   </button>
                   <button onClick={handleRemoveTextRequest} disabled={state.isGenerating} className="w-full py-4 bg-purple-600 hover:bg-purple-500 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20">
                     🪄 إزالة الكتابة والعناصر
                   </button>
                   <button onClick={handleUpscale} disabled={state.isGenerating} className="w-full py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-xs font-bold flex items-center justify-center gap-2">
                     ✨ تحسين الجودة (Upscale)
                   </button>

                   {/* Custom AI Instruction Field */}
                   <div className="mt-8 pt-8 border-t border-slate-800 space-y-4">
                     <div className="flex items-center justify-between">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">تعديل سحري مخصص</label>
                       <span className="text-[10px] bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30">AI Power</span>
                     </div>
                     
                     <div className="relative group">
                       <textarea 
                         value={customEditPrompt}
                         onChange={e => setCustomEditPrompt(e.target.value)}
                         placeholder="اكتب هنا التعديل الذي تريده على الصورة... (مثلاً: غير لون السيارة، أضف شجراً، غير الإضاءة)"
                         className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-500 transition-all min-h-[120px] resize-none shadow-inner group-hover:border-slate-700"
                       />
                       <div className="absolute bottom-3 left-3 flex gap-1">
                          <span className="text-[10px] text-slate-600">VisionAI v2.5</span>
                       </div>
                     </div>

                     <button 
                       onClick={handleCustomEdit}
                       disabled={state.isGenerating || !customEditPrompt.trim()}
                       className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all ${state.isGenerating || !customEditPrompt.trim() ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50' : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 shadow-xl shadow-purple-600/20 hover:scale-[1.02] active:scale-95 text-white'}`}
                     >
                       {state.isGenerating ? (
                         <>
                           <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                           <span>جاري التعديل...</span>
                         </>
                       ) : (
                         <>
                           <span className="text-lg">✨</span>
                           <span>تطبيق التعديل المخصص</span>
                         </>
                       )}
                     </button>
                     
                     <p className="text-[9px] text-slate-500 text-center leading-relaxed">
                       صف التغييرات المطلوبة بدقة للحصول على أفضل النتائج.
                     </p>
                   </div>
                </div>
              )}

              <div className="space-y-6 pt-4 border-t border-slate-800">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                    <span>الحجم</span>
                    <span>{selectedLayer.width || selectedLayer.fontSize}px</span>
                  </div>
                  <input type="range" min="10" max="1200" className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" value={selectedLayer.width || selectedLayer.fontSize} onChange={e => updateLayer(selectedLayer.id, selectedLayer.type === 'image' ? { width: Number(e.target.value) } : { fontSize: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                    <span>الشفافية</span>
                    <span>{Math.round(selectedLayer.opacity * 100)}%</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05" className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" value={selectedLayer.opacity} onChange={e => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                    <span>التدوير</span>
                    <span>{selectedLayer.rotation}°</span>
                  </div>
                  <input type="range" min="0" max="360" className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" value={selectedLayer.rotation} onChange={e => updateLayer(selectedLayer.id, { rotation: Number(e.target.value) })} />
                </div>
              </div>
              
              <button onClick={() => setState(prev => ({ ...prev, layers: prev.layers.filter(l => l.id !== selectedLayer.id), selectedLayerId: null }))} className="w-full py-3 bg-red-600/10 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold hover:bg-red-600/20 transition-all">حذف العنصر</button>
            </div>
          ) : (
            <div className="p-8 text-center space-y-4">
              <div className="text-4xl opacity-10">🪄</div>
              <p className="text-slate-500 text-xs leading-relaxed">
                اضغط على أي عنصر في مساحة العمل لبدء التعديل الاحترافي
              </p>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
              {isSidebarOpen ? '◀️' : '▶️'}
            </button>
            <div className="h-6 w-[1px] bg-slate-800 mx-2"></div>
            <button onClick={addTextLayer} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold border border-white/5 transition-all active:scale-95">
              <span>➕</span> إضافة نص
            </button>
            <button onClick={saveProject} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold border border-white/5 transition-all active:scale-95">
              <span>💾</span> حفظ المشروع
            </button>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={exportDesign} className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full text-sm font-black shadow-xl shadow-blue-600/30 hover:shadow-blue-500/50 transition-all active:scale-95">
               تصدير التصميم (High-Res)
             </button>
          </div>
        </header>

        <div 
          className="flex-1 overflow-auto flex items-center justify-center p-20 bg-[#020617] pattern-dots"
          onMouseDown={() => setState(prev => ({ ...prev, selectedLayerId: null }))}
        >
          <div 
            ref={canvasRef}
            className="relative bg-[#0a0f1e] shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden ring-1 ring-white/10"
            style={{
              width: config.aspectRatio === '1:1' ? '600px' : config.aspectRatio === '16:9' ? '800px' : config.aspectRatio === '9:16' ? '450px' : '600px',
              height: config.aspectRatio === '1:1' ? '600px' : config.aspectRatio === '16:9' ? '450px' : config.aspectRatio === '9:16' ? '800px' : '450px',
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
              <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center">
                 <div className="bg-slate-900/80 p-10 rounded-[2.5rem] border border-white/10 flex flex-col items-center gap-6 shadow-2xl">
                    <div className="w-16 h-16 border-4 border-blue-600/20 border-t-blue-500 rounded-full animate-spin"></div>
                    <div className="text-center space-y-2">
                       <h4 className="text-lg font-bold">جاري المعالجة...</h4>
                       <p className="text-xs text-slate-500">يقوم VisionAI بتحليل طلبك بدقة</p>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Legal Modal for Text Removal */}
        {showLegalModal && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-lg flex items-center justify-center p-6 animate-in fade-in duration-300">
             <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 shadow-2xl space-y-8">
                <div className="text-center space-y-3">
                   <div className="text-4xl">🛡️</div>
                   <h3 className="text-2xl font-bold">إقرار قانوني</h3>
                   <p className="text-slate-400 text-sm leading-relaxed">
                     بموجب استخدام ميزة "إزالة الكتابة والعناصر"، يجب عليك الموافقة على الشروط التالية:
                   </p>
                </div>

                <div className="space-y-4 bg-slate-950/50 p-6 rounded-2xl border border-white/5">
                   <label className="flex items-start gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="mt-1 w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500" 
                        checked={hasConsented}
                        onChange={e => setHasConsented(e.target.checked)}
                      />
                      <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
                        أقرّ أنني أملك حقوق هذه الصورة أو أن لدي إذنًا قانونيًا بتعديلها، وأتحمل المسؤولية القانونية الكاملة عن هذا الإجراء.
                      </span>
                   </label>
                </div>

                <div className="flex flex-col gap-3">
                   <button 
                     onClick={executeRemoveText}
                     disabled={!hasConsented}
                     className={`w-full py-4 rounded-2xl font-bold transition-all ${hasConsented ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                   >
                     موافقة ومتابعة
                   </button>
                   <button 
                     onClick={() => { setShowLegalModal(false); setHasConsented(false); }}
                     className="w-full py-4 text-sm text-slate-500 hover:text-white transition-colors"
                   >
                     إلغاء
                   </button>
                </div>

                <p className="text-[10px] text-center text-slate-600 leading-tight">
                  VisionAI Studio لا يشجع على انتهاك حقوق النشر ويقوم بتسجيل عمليات التعديل لضمان الاستخدام المسؤول.
                </p>
             </div>
          </div>
        )}

        <footer className="h-12 border-t border-slate-800 bg-slate-900 flex items-center justify-between px-8 text-[10px] text-slate-500 font-medium">
           <div className="flex items-center gap-6">
             <div className="flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50"></span>
               <span>VisionAI Professional v1.2</span>
             </div>
             <span className="h-3 w-[1px] bg-slate-800"></span>
             <span>Canvas: {config.aspectRatio}</span>
             <span className="h-3 w-[1px] bg-slate-800"></span>
             <span>Layers: {state.layers.length}</span>
           </div>
           <div className="flex items-center gap-2">
             <span>Powered by Gemini 2.5 Flash GenAI</span>
             <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center text-[8px] font-bold text-white">V</div>
           </div>
        </footer>
      </main>

      <style>{`
        .pattern-dots {
          background-image: radial-gradient(#1e293b 1px, transparent 1px);
          background-size: 32px 32px;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #020617;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-in { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default App;
