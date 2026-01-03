import React, { useState, useEffect, useRef } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { editImage } from './services/geminiService';
import { GenerationState, ImageSource, User, VisionModel } from './types';
import { LiveVoiceChat } from './components/LiveVoiceChat';

const INITIAL_CREDITS = 5;
const PROMPT_LIMIT = 5;
const MAX_HISTORY = 8; // Reduced to prevent localStorage quota issues

const SAMPLE_PROMPTS = [
  { id: 1, title: "Navratri Pinterest Edit", text: "Generate a trendy Navratri edit with the uploaded person's face looking sharp and natural. Outfit: designer lehenga with pastel shades, minimal silver jewelry. Background: Maa Durga idol with subtle lighting. Add DSLR focus and soft glow." },
  { id: 2, title: "Luxurious Reclining Portrait", text: "Vibrant portrait of a woman reclining in a luxurious setting, looking away thoughtfully. Dark wavy hair, gold and silver traditional outfit, ornate maang tikka, deep red nails." },
  { id: 3, title: "Maharani Royal Portrait", text: "Regal vintage style portrait as a Maharani from royal Rajasthan. Richly embroidered heavy lehenga, ornate dupatta, choker, long rani haar, and a stack of colorful bangles." },
  { id: 4, title: "2000s Analog Love", text: "Vintage 2000s analog camera style. Sitting on a park bench at night with garden lights. Realistic faces, 2000s fashion, soft dim lights, cinematic grain." },
  { id: 5, title: "90s Cinematic Grain", text: "Retro 90s Pinterest-style cinematic, grainy. Girl in red saree, leaning back to guy, hair moving in wind. Dramatic shadows, nostalgic cinematic feel." },
  { id: 6, title: "80s Rose Saree Romance", text: "Mid-waist vintage 80s film photograph, playful laughter, bright smile. Pastel rose printed saree. Indoor setting with sunlight through lace curtains. Warm golden glow." },
  { id: 7, title: "Royal Rajasthan Style", text: "Regal vintage portrait, real features, Rajasthan Maharani era. Intricate embroidery, traditional jewelry, wavy curly hair, royal aesthetic." },
  { id: 8, title: "Pastel Rose Laughter", text: "A mid-waist vintage 80s film photograph of the woman, playful laughter. Pastel rose printed saree. Sunlight filters through lace curtains. Warm glow, film grain, soft focus." }
];

const DEV_MESSAGES = [
  "Developing film emulsion...",
  "Calibrating vintage lens...",
  "Scanning facial topology...",
  "Draping rose-printed textures...",
  "Filtering sunlight...",
  "Infusing 80s nostalgia...",
  "Finalizing color bath...",
  "Drying memory prints..."
];

const App: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<ImageSource | null>(null);
  const [tier, setTier] = useState<VisionModel>('standard');
  const [prompt, setPrompt] = useState<string>(SAMPLE_PROMPTS[7].text);
  const [showPromptDropdown, setShowPromptDropdown] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [promptUsageCount, setPromptUsageCount] = useState(0);
  
  const [pastPrompts, setPastPrompts] = useState<string[]>([]);
  const [futurePrompts, setFuturePrompts] = useState<string[]>([]);
  const lastSavedPrompt = useRef<string>(prompt);

  const [progress, setProgress] = useState(0);
  const [devMessage, setDevMessage] = useState(DEV_MESSAGES[0]);

  const [state, setState] = useState<GenerationState>({
    isGenerating: false,
    error: null,
    resultImage: null,
  });

  // Safe Persistence
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('vv_user_v5');
      const savedUsage = localStorage.getItem('vv_usage_v5');
      if (savedUser) setUser(JSON.parse(savedUser));
      if (savedUsage) setPromptUsageCount(parseInt(savedUsage, 10) || 0);
    } catch (e) {
      console.warn("Storage recovery failed:", e);
    }
  }, []);

  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem('vv_user_v5', JSON.stringify(user));
      } catch (e) {
        // If storage fails, trim history aggressively
        if (user.history.length > 2) {
          setUser(prev => prev ? { ...prev, history: prev.history.slice(0, 2) } : null);
        }
      }
    } else {
      localStorage.removeItem('vv_user_v5');
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('vv_usage_v5', promptUsageCount.toString());
  }, [promptUsageCount]);

  // Progress Logic
  useEffect(() => {
    let interval: number;
    if (state.isGenerating) {
      setProgress(0);
      interval = window.setInterval(() => {
        setProgress(p => {
          if (p >= 95) return 95;
          const next = p + Math.random() * 8;
          const msgIdx = Math.min(Math.floor((next / 100) * DEV_MESSAGES.length), DEV_MESSAGES.length - 1);
          setDevMessage(DEV_MESSAGES[msgIdx]);
          return next;
        });
      }, 700);
    }
    return () => clearInterval(interval);
  }, [state.isGenerating]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.includes('@')) return;
    setUser({ email: emailInput, credits: INITIAL_CREDITS, isLoggedIn: true, isPro: false, history: [] });
    setShowLoginModal(false);
  };

  const handleGenerate = async () => {
    if (!user) return setShowLoginModal(true);
    if (!user.isPro && user.credits <= 0) {
      setState(s => ({ ...s, error: "CREDIT_EXHAUSTED" }));
      return;
    }
    if (!sourceImage) return;

    if (tier === 'studio') {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) await window.aistudio.openSelectKey();
    }

    setState(s => ({ ...s, isGenerating: true, error: null }));
    
    try {
      const result = await editImage(sourceImage, prompt, tier);
      setProgress(100);
      
      setTimeout(() => {
        setState(s => ({ ...s, isGenerating: false, resultImage: result }));
        setUser(u => u ? {
          ...u,
          credits: u.isPro ? u.credits : u.credits - 1,
          history: [result, ...u.history].slice(0, MAX_HISTORY)
        } : null);
      }, 500);
    } catch (err: any) {
      setState(s => ({ ...s, isGenerating: false, error: err.message }));
    }
  };

  const undo = () => {
    if (pastPrompts.length === 0) return;
    const prev = pastPrompts[pastPrompts.length - 1];
    setFuturePrompts(f => [prompt, ...f]);
    setPrompt(prev);
    setPastPrompts(p => p.slice(0, -1));
  };

  const redo = () => {
    if (futurePrompts.length === 0) return;
    const next = futurePrompts[0];
    setPastPrompts(p => [...p, prompt]);
    setPrompt(next);
    setFuturePrompts(f => f.slice(1));
  };

  return (
    <div className="min-h-screen bg-[#faf7f5] text-stone-900 pb-20 selection:bg-rose-100 font-sans">
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-stone-200/50 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-200 rotate-3">
            <span className="text-white font-black text-2xl font-serif italic">V</span>
          </div>
          <h1 className="text-2xl font-black font-serif italic hidden sm:block">Vintage Vision</h1>
        </div>
        <div className="flex items-center space-x-6">
          {user ? (
            <div className="flex items-center space-x-4">
              <button onClick={() => setShowGallery(!showGallery)} className="text-sm font-bold text-stone-500 hover:text-rose-600 transition-colors">Archive</button>
              <div className="h-4 w-px bg-stone-200" />
              <div className="text-right">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{user.isPro ? 'Pro' : 'Free'}</p>
                <p className="text-sm font-black text-rose-600">{user.isPro ? '∞' : `${user.credits} Shots`}</p>
              </div>
              <button onClick={() => setUser(null)} className="text-stone-300 hover:text-stone-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg></button>
            </div>
          ) : (
            <button onClick={() => setShowLoginModal(true)} className="bg-rose-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">Sign In</button>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {showGallery && user && (
          <section className="mb-12 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-2xl font-serif italic font-black mb-6">Past Memories</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              {user.history.map((img, i) => (
                <div key={i} className="aspect-[4/5] rounded-2xl overflow-hidden shadow-lg border border-white cursor-pointer hover:scale-105 transition-transform" onClick={() => setState(s => ({ ...s, resultImage: img }))}>
                  <img src={img} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5 space-y-8">
            <ImageUploader onImageSelected={setSourceImage} currentImage={sourceImage?.base64 || null} />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-stone-400">Atmosphere</h3>
                <div className="flex space-x-2">
                  <button onClick={undo} disabled={pastPrompts.length === 0} className="p-1 disabled:opacity-30"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
                  <button onClick={redo} disabled={futurePrompts.length === 0} className="p-1 disabled:opacity-30"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></button>
                </div>
              </div>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                className="w-full h-40 p-6 bg-white rounded-[2rem] shadow-sm border-0 focus:ring-4 focus:ring-rose-500/5 transition-all text-stone-700 resize-none outline-none"
              />
              <div className="flex gap-2 flex-wrap">
                {SAMPLE_PROMPTS.slice(0, 4).map(p => (
                  <button key={p.id} onClick={() => setPrompt(p.text)} className="text-[10px] font-bold px-3 py-1 bg-stone-100 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-colors">{p.title}</button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={state.isGenerating || !sourceImage}
              className={`w-full py-5 rounded-[2rem] font-black text-xl shadow-xl transition-all flex items-center justify-center space-x-4 ${state.isGenerating || !sourceImage ? 'bg-stone-200 text-stone-400' : 'bg-stone-900 text-white hover:bg-black hover:scale-[1.02]'}`}
            >
              <span className="font-serif italic text-2xl">Capture the Memory</span>
            </button>
          </div>

          <div className="lg:col-span-7">
            <div className="relative aspect-[4/5] bg-white rounded-[3rem] shadow-2xl border border-stone-100 overflow-hidden">
              {state.isGenerating && (
                <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-12 text-center animate-in fade-in">
                  <div className="absolute top-0 left-0 w-full h-1 bg-rose-500 animate-scan" />
                  <p className="font-serif italic text-3xl mb-4 text-stone-900">{devMessage}</p>
                  <div className="w-full max-w-xs h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
              {state.resultImage ? (
                <img src={state.resultImage} className="w-full h-full object-cover animate-in zoom-in duration-700" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-200 p-12 text-center">
                  <svg className="w-20 h-20 mb-6 opacity-20" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.103 0-2 .897-2 2v14c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zM5 19V5h14l.002 14H5z"/><path d="m10 14-1-1-3 4h12l-5-7z"/></svg>
                  <p className="font-serif italic text-2xl text-stone-400">Ready for development.</p>
                </div>
              )}
            </div>
            {state.resultImage && !state.isGenerating && (
              <div className="mt-8 flex justify-center">
                <a href={state.resultImage} download="vintage-memory.png" className="bg-white px-8 py-4 rounded-full font-black text-sm shadow-xl flex items-center space-x-3 hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span>Save Print</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </main>

      <button onClick={() => setShowVoiceChat(true)} className="fixed bottom-8 right-8 w-16 h-16 bg-rose-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40">
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
      </button>

      {showVoiceChat && <LiveVoiceChat onClose={() => setShowVoiceChat(false)} />}

      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl text-center">
            <h3 className="text-3xl font-serif italic font-black mb-6">Start Your Story</h3>
            <form onSubmit={handleLogin} className="space-y-4">
              <input value={emailInput} onChange={e => setEmailInput(e.target.value)} type="email" placeholder="Email" className="w-full py-4 px-6 bg-stone-50 rounded-2xl border-0 focus:ring-2 focus:ring-rose-500/20 outline-none text-center" required />
              <button type="submit" className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black shadow-lg">Begin Journey</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
