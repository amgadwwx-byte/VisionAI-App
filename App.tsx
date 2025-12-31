
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
  const [customEditPrompt, setCustomEditPrompt] = useState('');
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  if (state.screen === 'splash') {
    return (
      <div className="h-screen w-full bg-[#020617] flex flex-col items-center justify-center text-white p-8">
        <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center text-4xl font-bold shadow-2xl shadow-blue-500/40 animate-pulse mb-8">V</div>
        <h1 className="text-4xl font-bold mb-4 tracking-tighter">VisionAI Studio</h1>
        <p className="text-slate-400 text-lg">حوّل أفكارك إلى تصاميم بالذكاء الاصطناعي</p>
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
          <button 
            onClick={() => setState(prev => ({ ...prev, screen: 'home' }))}
            className="w-full py-4 bg-white text-black rounded-2xl font-bold hover:bg-slate-100 transition-colors"
          >
            المتابعة كضيف
          </button>
        </div>
      </div>
    );
  }

  if (state.screen === 'home') {
    return (
      <div className="h-screen w-full bg-[#020617] text-white flex flex-col items-center overflow-y-auto" dir="rtl">
        <header className="w-full h-20 px-8 flex items-center justify-between border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl">V</div>
             <span className="text-xl font-bold">VisionAI Studio</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="bg-slate-800 px-4 py-2 rounded-full text-sm border border-white/5">
              🪙 رصيد: {state.credits}
            </div>
            <button 
              onClick={() => setState(prev => ({ ...prev, isPro: true }))}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2 rounded-full font-bold text-sm"
            >
              الترقية لـ PRO
            </button>
          </div>
        </header>

        <main className="max-w-5xl w-full px-6 py-12 space-y-12">
           <section className="text-center space-y-4">
             <h2 className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">من الخيال إلى الواقع</h2>
             <p className="text-slate-400 text-lg">استخدم قوة الذكاء الاصطناعي لتوليد تصاميم احترافية مذهلة.</p>
           </section>

           <section className="bg-slate-900/40 border border-white/5 p-8 rounded-[3rem] shadow-2xl space-y-8 backdrop-blur-sm">
             <div className="space-y-4">
               <label className="text-sm font-bold text-slate-300">أدخل وصفاً لفكرتك</label>
               <textarea 
                 value={config.prompt}
                 onChange={e => setConfig({...config, prompt: e.target.value})}
                 placeholder="مثلاً: شعار لشركة تكنولوجيا بأسلوب مستقبلي..."
                 className="w-full bg-slate-950/80 border border-slate-800 rounded-3xl p-6 text-xl focus:ring-4 focus:ring-blue-600/20 outline-none h-36 resize-none"
               />
             </div>

             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-500">نوع التصميم</label>
                 <select className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm outline-none" value={config.type} onChange={e => setConfig({...config, type: e.target.value as DesignType})}>
                   {DESIGN_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                 </select>
               </div>
               <div className="space-y-2 col-span-2">
                 <label className="text-xs font-bold text-slate-500">الأسلوب الفني</label>
                 <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                   {DESIGN_STYLES.map(s => (
                     <button key={s.id} onClick={() => setConfig({...config, style: s.id as DesignStyle})} className={`p-2 rounded-xl border text-xs transition-all ${config.style === s.id ? 'bg-blue-600 border-blue-400' : 'bg-slate-950 border-slate-800'}`}>
                       {s.label}
                     </button>
                   ))}
                 </div>
               </div>
               <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-500">المقاس</label>
                 <select className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm outline-none" value={config.aspectRatio} onChange={e => setConfig({...config, aspectRatio: e.target.value as any})}>
                   {ASPECT_RATIOS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                 </select>
               </div>
             </div>

             <div className="flex flex-col md:flex-row gap-4">
               <button 
                 onClick={handleGenerate}
                 disabled={state.isGenerating || !config.prompt}
                 className="flex-1 py-6 rounded-3xl font-black text-2xl bg-blue-600 hover:bg-blue-500 shadow-2xl shadow-blue-600/30 transition-all flex items-center justify-center gap-4"
               >
                 {state.isGenerating ? "جاري التوليد..." : "توليد التصميم ✨"}
               </button>
               <button onClick={() => fileInputRef.current?.click()} className="md:w-1/3 py-6 rounded-3xl font-bold text-xl bg-slate-800 hover:bg-slate-700 transition-all">رفع صورة</button>
               <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
             </div>
           </section>

           {state.results.length > 0 && (
             <section className="space-y-8">
               <h3 className="text-3xl font-bold">النتائج المقترحة</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {state.results.map((img, i) => (
                   <div key={i} className="group relative rounded-[2.5rem] overflow-hidden bg-slate-900 aspect-square">
                     <img src={img} alt="Result" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                     <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-10 gap-4">
                       <button onClick={() => startEditing(img)} className="w-full bg-white text-black py-4 rounded-2xl font-bold">تعديل واحتراف</button>
                       <button onClick={saveProject} className="w-full bg-slate-800 py-3 rounded-xl font-bold">حفظ</button>
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

  const selectedLayer = state.layers.find(l => l.id === state.selectedLayerId);

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden" dir="rtl">
      <aside className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto z-50`}>
        <div className="p-6 space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">المحرر الذكي</h1>
            <button onClick={() => setState(prev => ({ ...prev, screen: 'home' }))} className="p-2 hover:bg-slate-800 rounded-lg">✕</button>
          </div>

          {selectedLayer ? (
            <div className="space-y-6 animate-in slide-in-from-left-4">
              {selectedLayer.type === 'text' && (
                <div className="space-y-4">
                  <textarea className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm" value={selectedLayer.content} onChange={e => updateLayer(selectedLayer.id, { content: e.target.value })} />
                  <input type="color" className="w-full h-10 bg-slate-800 rounded-lg" value={selectedLayer.color} onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })} />
                </div>
              )}

              {selectedLayer.type === 'image' && (
                <div className="space-y-4">
                   <button onClick={handleRemoveBg} disabled={state.isGenerating} className="w-full py-4 bg-indigo-600 rounded-2xl text-xs font-bold">🧠 إزالة الخلفية</button>
                   <button onClick={handleUpscale} disabled={state.isGenerating} className="w-full py-4 bg-slate-800 rounded-2xl text-xs font-bold">✨ تحسين الجودة</button>
                   <div className="space-y-2 pt-4">
                     <label className="text-[10px] text-slate-500 font-bold">تعديل ذكي مخصص</label>
                     <textarea value={customEditPrompt} onChange={e => setCustomEditPrompt(e.target.value)} placeholder="مثلاً: غير اللون..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs h-24" />
                     <button onClick={handleCustomEdit} className="w-full py-3 bg-purple-600 rounded-xl text-xs font-bold">تطبيق</button>
                   </div>
                </div>
              )}

              <div className="space-y-6 pt-4 border-t border-slate-800">
                <div className="space-y-2">
                  <label className="text-xs text-slate-500">الحجم</label>
                  <input type="range" min="10" max="1000" className="w-full accent-blue-500" value={selectedLayer.width || selectedLayer.fontSize} onChange={e => updateLayer(selectedLayer.id, selectedLayer.type === 'image' ? { width: Number(e.target.value) } : { fontSize: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-500">الشفافية</label>
                  <input type="range" min="0" max="1" step="0.1" className="w-full accent-blue-500" value={selectedLayer.opacity} onChange={e => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) })} />
                </div>
              </div>
              <button onClick={() => setState(prev => ({ ...prev, layers: prev.layers.filter(l => l.id !== selectedLayer.id), selectedLayerId: null }))} className="w-full py-3 bg-red-600/10 text-red-500 rounded-xl text-xs font-bold">حذف العنصر</button>
            </div>
          ) : (
            <p className="p-8 text-center text-slate-500 text-xs">اضغط على عنصر لبدء التعديل</p>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-slate-800 rounded-lg">⚙️</button>
            <button onClick={addTextLayer} className="px-4 py-2 bg-slate-800 rounded-xl text-sm font-bold">➕ نص</button>
          </div>
          <button onClick={exportDesign} className="px-8 py-2 bg-blue-600 rounded-full text-sm font-black shadow-xl shadow-blue-600/30">تصدير</button>
        </header>

        <div className="flex-1 overflow-auto flex items-center justify-center p-20 bg-[#020617]" onMouseDown={() => setState(prev => ({ ...prev, selectedLayerId: null }))}>
          <div 
            ref={canvasRef}
            className="relative bg-[#0a0f1e] shadow-2xl overflow-hidden ring-1 ring-white/10"
            style={{
              width: config.aspectRatio === '1:1' ? '600px' : config.aspectRatio === '16:9' ? '800px' : '450px',
              height: config.aspectRatio === '1:1' ? '600px' : config.aspectRatio === '16:9' ? '450px' : '800px',
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
                 <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        .animate-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default App;
