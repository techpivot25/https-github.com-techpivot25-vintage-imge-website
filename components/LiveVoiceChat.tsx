
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

interface LiveVoiceChatProps {
  onClose: () => void;
}

export const LiveVoiceChat: React.FC<LiveVoiceChatProps> = ({ onClose }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Helper: Base64 decoding for PCM
  function decodeBase64(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Helper: Decode raw PCM to AudioBuffer
  async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  // Helper: Encode Float32 to Base64 PCM
  function encodeBase64(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  const startSession = async () => {
    setIsConnecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            
            const source = audioContextRef.current!.createMediaStreamSource(streamRef.current!);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const base64Pcm = encodeBase64(new Uint8Array(int16.buffer));
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  media: { data: base64Pcm, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              const ctx = outputAudioContextRef.current!;
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx, 24000, 1);
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            // Simple transcription extraction if enabled
            if (message.serverContent?.outputTranscription) {
              setTranscription(prev => [...prev, message.serverContent!.outputTranscription!.text].slice(-5));
            }
          },
          onerror: (e) => console.error('Live API Error:', e),
          onclose: () => stopSession(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are the spirit of a vintage photo archive. You help users remember and transform their modern photos into 80s cinematic memories. Be nostalgic, poetic, and slightly mysterious. Your name is Zephyr.',
          outputAudioTranscription: {},
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Failed to start Live session:', err);
      setIsConnecting(false);
    }
  };

  const stopSession = () => {
    setIsActive(false);
    setIsConnecting(false);
    if (sessionRef.current) {
      // Note: session.close is assumed as standard cleanup
      try { sessionRef.current.close(); } catch(e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
  };

  useEffect(() => {
    return () => stopSession();
  }, []);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-stone-900/60 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[3rem] p-12 shadow-2xl relative overflow-hidden border border-stone-100">
        {/* Vintage Aesthetic Decoration */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-rose-100/50 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-rose-200/30 rounded-full blur-3xl" />
        
        <button 
          onClick={onClose} 
          className="absolute top-8 right-8 text-stone-300 hover:text-stone-900 transition-colors z-10"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="relative z-10 text-center">
          <div className="mb-8">
            <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-700 ${isActive ? 'bg-rose-600 shadow-[0_0_50px_rgba(225,29,72,0.4)] scale-110' : 'bg-stone-100 shadow-inner'}`}>
              <div className={`w-12 h-12 flex items-center justify-center text-white ${isActive ? 'animate-pulse' : 'text-stone-400'}`}>
                <svg fill="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              </div>
            </div>
            {isActive && (
              <div className="mt-4 flex justify-center space-x-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            )}
          </div>

          <h3 className="text-4xl font-serif italic font-black text-stone-900 mb-4">
            {isActive ? 'Whispering to Zephyr' : isConnecting ? 'Opening the Vault...' : 'The Archive Spirit'}
          </h3>
          
          <p className="text-stone-500 font-medium mb-12 max-w-xs mx-auto leading-relaxed">
            {isActive 
              ? 'Zephyr is listening. Talk about your favorite memories or ask how to capture a perfect 80s frame.' 
              : 'Connect with our real-time voice assistant to guide your cinematic journey.'}
          </p>

          <div className="h-24 mb-10 overflow-hidden flex flex-col justify-end">
             {transcription.map((text, i) => (
               <p key={i} className="text-sm font-serif italic text-rose-800/60 opacity-0 animate-in fade-in slide-in-from-bottom-2 duration-500">{text}</p>
             ))}
          </div>

          {!isActive && !isConnecting ? (
            <button
              onClick={startSession}
              className="w-full py-5 bg-stone-900 text-white rounded-[2rem] font-black text-xl shadow-xl hover:bg-black transition-all transform active:scale-95"
            >
              Begin Conversation
            </button>
          ) : (
            <button
              onClick={stopSession}
              className="w-full py-5 border-2 border-rose-100 text-rose-600 rounded-[2rem] font-black text-xl transition-all hover:bg-rose-50"
            >
              Silence the Echoes
            </button>
          )}
          
          <p className="mt-8 text-[10px] font-black uppercase tracking-widest text-stone-300">
            Powered by Gemini 2.5 Live API
          </p>
        </div>
      </div>
    </div>
  );
};
