'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  AlertTriangle,
  HeartPulse,
  Activity,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Radio,
  Share2,
  Send,
  FileText,
  UserCheck,
  Stethoscope,
  Sparkles,
  PhoneForwarded,
} from 'lucide-react';
import Link from 'next/link';

import { filterAcousticEcho } from '@/core/utils/echo-filter';

export default function HelplinePage() {
  const [activeTab, setActiveTab] = useState<'voice' | 'phone'>('voice');
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [callId, setCallId] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [transcripts, setTranscripts] = useState<
    { speaker: 'patient' | 'assistant' | 'system'; text: string; time: string }[]
  >([]);
  const [extractedData, setExtractedData] = useState<Record<string, any>>({});
  const [inputMessage, setInputMessage] = useState('');

  // Exotel Phone Call state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCallStatus, setPhoneCallStatus] = useState<string | null>(null);
  const [phoneCallId, setPhoneCallId] = useState<string | null>(null);
  const [isDialing, setIsDialing] = useState(false);

  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastAudioEndTimeRef = useRef<number>(0);
  const recentAssistantTextsRef = useRef<string[]>([
    'Hello, this is the BeatAhead Cardiac Care Helpline. I am here with you.',
  ]);
  const isConnectedRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const stopCurrentAudio = () => {
    audioQueueRef.current = [];
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.onended = null;
        currentAudioRef.current.onerror = null;
      } catch {}
      currentAudioRef.current = null;
    }
    isPlayingRef.current = false;
    setIsSpeaking(false);
  };

  const safeAbortRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    setIsListening(false);
  };

  const safeStartRecognition = () => {
    if (!recognitionRef.current || !isConnectedRef.current || isPlayingRef.current) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {}
  };

  const playNextAudio = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      lastAudioEndTimeRef.current = Date.now();
      setTimeout(() => {
        if (!isPlayingRef.current && isConnectedRef.current) {
          safeStartRecognition();
        }
      }, 600);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);
    safeAbortRecognition();

    const base64Audio = audioQueueRef.current.shift()!;
    const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
    currentAudioRef.current = audio;

    audio.onended = () => {
      currentAudioRef.current = null;
      lastAudioEndTimeRef.current = Date.now();
      playNextAudio();
    };
    audio.onerror = () => {
      currentAudioRef.current = null;
      lastAudioEndTimeRef.current = Date.now();
      playNextAudio();
    };
    audio.play().catch(() => {
      currentAudioRef.current = null;
      lastAudioEndTimeRef.current = Date.now();
      playNextAudio();
    });
  };

  const queueAudio = (base64: string) => {
    audioQueueRef.current.push(base64);
    if (!isPlayingRef.current) {
      playNextAudio();
    }
  };

  // Start voice session
  const startSession = async () => {
    try {
      const newCallId = `browser_helpline_${Date.now()}`;
      setCallId(newCallId);
      setIsConnected(true);

      const res = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          callId: newCallId,
          callerId: 'Patient (Emergency Triage)',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTranscripts([
          {
            speaker: 'assistant',
            text:
              data.responseText ||
              "Hello, this is the BeatAhead Cardiac Care Helpline. I'm here with you. Are you or someone near you experiencing chest discomfort, breathlessness, or unusual heart symptoms?",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);

        if (data.audioBase64) {
          queueAudio(data.audioBase64);
        }

        startSpeechRecognition(newCallId);
      }
    } catch (e: any) {
      console.error('Failed to start helpline session:', e);
    }
  };

  const endSession = async () => {
    stopCurrentAudio();
    stopSpeechRecognition();
    if (callId) {
      try {
        await fetch('/api/voice/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'end', callId }),
        });
      } catch (e) {}
    }
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
  };

  const startSpeechRecognition = (activeCallId: string) => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          if (!isPlayingRef.current) setIsListening(true);
        };
        recognition.onresult = (e: any) => {
          if (isPlayingRef.current || Date.now() - lastAudioEndTimeRef.current < 600) {
            return;
          }
          const last = e.results[e.results.length - 1];
          if (last.isFinal) {
            const text = last[0].transcript.trim();
            if (text) {
              handleSendUtterance(text, activeCallId);
            }
          }
        };
        recognition.onend = () => {
          if (isConnectedRef.current && !isPlayingRef.current) {
            setTimeout(() => {
              if (isConnectedRef.current && !isPlayingRef.current) {
                try {
                  recognition.start();
                } catch {}
              }
            }, 400);
          }
        };

        try {
          recognition.start();
        } catch {}
        recognitionRef.current = recognition;
        return;
      } catch (err) {}
    }

    // Fallback MediaRecorder
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          mediaRecorderRef.current = recorder;
          setIsListening(true);

          recorder.ondataavailable = async (e) => {
            if (e.data.size > 0 && !isPlayingRef.current) {
              audioChunksRef.current.push(e.data);
            }
          };

          recorder.onstop = async () => {
            if (audioChunksRef.current.length > 0 && !isPlayingRef.current) {
              const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              audioChunksRef.current = [];
              const formData = new FormData();
              formData.append('file', blob, 'audio.webm');
              try {
                const res = await fetch('/api/voice/transcribe', {
                  method: 'POST',
                  body: formData,
                });
                const d = await res.json();
                if (d.text) {
                  handleSendUtterance(d.text.trim(), activeCallId);
                }
              } catch {}
            }
          };

          recorder.start(3000);
        })
        .catch(() => {});
    }
  };

  const stopSpeechRecognition = () => {
    safeAbortRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      } catch {}
      mediaRecorderRef.current = null;
    }
    setIsListening(false);
  };

  const handleSendUtterance = async (text: string, currentCallId = callId) => {
    if (!text.trim()) return;
    const clean = text.trim();

    // Check acoustic echo
    const echoCheck = filterAcousticEcho(clean, recentAssistantTextsRef.current);
    if (echoCheck.isFullEcho) {
      console.log('[Helpline Echo Filter] Discarded assistant echo:', clean);
      return;
    }

    const textToSend = echoCheck.isPartialEcho ? echoCheck.cleanedText : clean;
    if (!textToSend || textToSend.length < 2) return;

    stopCurrentAudio();

    setTranscripts((prev) => [
      ...prev,
      {
        speaker: 'patient',
        text: textToSend,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setIsThinking(true);

    try {
      const res = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'utterance',
          callId: currentCallId,
          message: textToSend,
        }),
      });

      const data = await res.json();
      setIsThinking(false);

      if (data.success) {
        if (data.responseText) {
          recentAssistantTextsRef.current.push(data.responseText);
        }

        setTranscripts((prev) => [
          ...prev,
          {
            speaker: 'assistant',
            text: data.responseText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);

        if (data.audioBase64) {
          queueAudio(data.audioBase64);
        }

        if (data.structuredData) {
          setExtractedData(data.structuredData);
        }
      }
    } catch (err) {
      setIsThinking(false);
    }
  };

  // Exotel Outbound Phone Call trigger
  const handleDialExotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    setIsDialing(true);
    setPhoneCallStatus('Initiating call via Exotel PSTN gateway...');

    try {
      const res = await fetch('/api/exotel/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phoneNumber.trim() }),
      });

      const data = await res.json();
      setIsDialing(false);

      if (data.success) {
        setPhoneCallId(data.callId);
        setPhoneCallStatus(`Call successfully queued! Exotel Call SID: ${data.callId}. Your phone should ring shortly.`);
      } else {
        setPhoneCallStatus(`Error: ${data.error || 'Failed to initiate phone call'}`);
      }
    } catch (err: any) {
      setIsDialing(false);
      setPhoneCallStatus(`Connection error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Header */}
      <div className="mx-auto max-w-6xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600/20 border border-red-500/30 text-red-500 shadow-lg shadow-red-950/40">
              <HeartPulse className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                  BeatAhead 24/7 AI Cardiac Care Helpline
                </h1>
                <span className="rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 text-xs font-bold text-red-400">
                  CRITICAL CARE
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-400">
                Low-Latency Voice Triage • Exotel Telephony • Groq Whisper • Gemini LLM • ElevenLabs TTS
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/calls"
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
          >
            <FileText className="h-4 w-4 text-slate-400" /> View Call Records & Logs
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-all shadow-sm"
          >
            ← Back to ISI Monitor
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Terminal */}
        <div className="lg:col-span-2 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-xl">
          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/50 p-2 gap-2">
            <button
              onClick={() => setActiveTab('voice')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'voice'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Mic className="h-4 w-4" /> Live Browser Voice Triage
            </button>
            <button
              onClick={() => setActiveTab('phone')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'phone'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <PhoneCall className="h-4 w-4" /> Real Phone Call (Exotel Gateway)
            </button>
          </div>

          {activeTab === 'voice' ? (
            <div className="flex flex-col h-[520px]">
              {/* Call Controls Bar */}
              <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-5 py-3">
                <div className="flex items-center gap-3">
                  {isConnected ? (
                    <span className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      LIVE CALL: {formatTime(callDuration)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-xs font-medium text-slate-400">
                      <Radio className="h-3.5 w-3.5" /> Standby • Ready to connect
                    </span>
                  )}
                </div>

                <div>
                  {!isConnected ? (
                    <button
                      onClick={startSession}
                      className="flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/30 transition-all hover:scale-102"
                    >
                      <PhoneCall className="h-4 w-4" /> Start Voice Call
                    </button>
                  ) : (
                    <button
                      onClick={endSession}
                      className="flex items-center gap-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 px-4 py-1.5 text-xs font-bold text-red-400 transition-all"
                    >
                      <PhoneOff className="h-4 w-4" /> End Call
                    </button>
                  )}
                </div>
              </div>

              {/* Transcript Display */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {transcripts.length === 0 && !isConnected && (
                  <div className="flex h-full flex-col items-center justify-center text-center px-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/20 text-red-500 mb-4">
                      <HeartPulse className="h-8 w-8 animate-pulse" />
                    </div>
                    <h3 className="text-base font-bold text-white">Direct Vocal Cardiac Triage</h3>
                    <p className="mt-1 text-xs text-slate-400 max-w-sm leading-relaxed">
                      Click <strong>Start Voice Call</strong> to speak naturally into your microphone. Our clinical AI will listen to your symptoms, calculate urgency, and deliver immediate first-aid instructions.
                    </p>
                  </div>
                )}

                {transcripts.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${
                      msg.speaker === 'patient' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <span className="text-[10px] text-slate-500 mb-1 px-1">
                      {msg.speaker === 'patient' ? 'You' : 'BeatAhead Triage AI'} • {msg.time}
                    </span>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                        msg.speaker === 'patient'
                          ? 'bg-red-600 text-white rounded-tr-none'
                          : 'bg-slate-800/90 border border-slate-700/60 text-slate-100 rounded-tl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                {isThinking && (
                  <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 w-fit">
                    <Sparkles className="h-3.5 w-3.5 animate-spin" />
                    <span>Analyzing clinical guidelines & executing cardiac tools...</span>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>

              {/* Status Bar */}
              {isConnected && (
                <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/60 px-5 py-2.5 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    {isSpeaking ? (
                      <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <Volume2 className="h-4 w-4 animate-bounce" /> Audio Responding (ElevenLabs TTS)
                      </span>
                    ) : isListening ? (
                      <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                        <Mic className="h-4 w-4 animate-pulse" /> Microphone Active (Listening)
                      </span>
                    ) : (
                      <span>Ready</span>
                    )}
                  </div>
                </div>
              )}

              {/* Text Input Fallback */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!inputMessage.trim()) return;
                  const text = inputMessage.trim();
                  setInputMessage('');
                  if (!isConnected) {
                    startSession().then(() => {
                      setTimeout(() => handleSendUtterance(text), 1200);
                    });
                  } else {
                    handleSendUtterance(text);
                  }
                }}
                className="border-t border-slate-800 bg-slate-950 p-3 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={
                    isConnected
                      ? 'Speak into mic or type symptoms here...'
                      : 'Type symptoms or click Start Voice Call above...'
                  }
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 transition-all"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          ) : (
            /* Exotel Phone Call Tab */
            <div className="p-8 flex flex-col justify-center min-h-[520px]">
              <div className="max-w-md mx-auto w-full">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/20 text-red-500 mb-4">
                  <PhoneForwarded className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-bold text-white">Dial Direct Phone Helpline via Exotel</h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed mb-6">
                  Initiate a real cellular/telephone call to any mobile number. BeatAhead will connect via the Exotel telephony network and start an interactive voice consultation.
                </p>

                <form onSubmit={handleDialExotel} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Destination Phone Number (E.164 with Country Code)
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+919876543210"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Format example: <code>+919876543210</code> (India) or <code>+14155552671</code> (US)
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isDialing || !phoneNumber.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 py-3 px-4 text-xs font-bold text-white shadow-lg shadow-red-600/30 disabled:opacity-50 transition-all"
                  >
                    <PhoneCall className="h-4 w-4" />
                    {isDialing ? 'Initiating Exotel Dispatch...' : 'Dial Phone Call via Exotel'}
                  </button>
                </form>

                {phoneCallStatus && (
                  <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-relaxed text-slate-300">
                    <p className="font-semibold text-white mb-1 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Telephony Status:
                    </p>
                    <p>{phoneCallStatus}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Extracted Findings & Protocols */}
        <div className="space-y-6">
          {/* Live Extracted Clinical Findings */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-5 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-red-500" /> Live Extracted Biomarkers
            </h3>

            {Object.keys(extractedData).length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Spoken symptoms will appear here in real-time as extracted by Gemini.
              </p>
            ) : (
              <div className="space-y-3">
                {extractedData.urgency_level?.value && (
                  <div className="flex items-center justify-between rounded-xl bg-slate-950/80 border border-slate-800 p-3">
                    <span className="text-xs text-slate-400">Urgency Level</span>
                    <span className="rounded-lg bg-red-600/20 border border-red-500/40 px-2.5 py-1 text-xs font-bold text-red-400">
                      {String(extractedData.urgency_level.value).replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
                {extractedData.pain_severity_scale?.value && (
                  <div className="flex items-center justify-between rounded-xl bg-slate-950/80 border border-slate-800 p-3">
                    <span className="text-xs text-slate-400">Pain Severity Scale</span>
                    <span className="text-xs font-bold text-rose-400">
                      {extractedData.pain_severity_scale.value} / 10
                    </span>
                  </div>
                )}
                {extractedData.primary_symptom?.value && (
                  <div className="flex items-center justify-between rounded-xl bg-slate-950/80 border border-slate-800 p-3">
                    <span className="text-xs text-slate-400">Primary Symptom</span>
                    <span className="text-xs font-semibold text-amber-300">
                      {String(extractedData.primary_symptom.value).replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
                {extractedData.symptom_onset_minutes?.value && (
                  <div className="flex items-center justify-between rounded-xl bg-slate-950/80 border border-slate-800 p-3">
                    <span className="text-xs text-slate-400">Onset Duration</span>
                    <span className="text-xs font-semibold text-blue-300">
                      {extractedData.symptom_onset_minutes.value} minutes
                    </span>
                  </div>
                )}
                {extractedData.prior_cardiac_history?.value && (
                  <div className="flex items-center justify-between rounded-xl bg-slate-950/80 border border-slate-800 p-3">
                    <span className="text-xs text-slate-400">Prior History</span>
                    <span className="text-xs font-semibold text-slate-200">
                      {String(extractedData.prior_cardiac_history.value)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* First Aid Protocol Guide */}
          <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-950/30 to-slate-900/60 backdrop-blur-md p-5 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-500" /> Immediate Cardiac Protocol
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white mt-0.5">
                  1
                </span>
                <span>
                  <strong>Rest Upright:</strong> Sit upright with knees bent (Fowler position) to relieve pressure on the left ventricle.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white mt-0.5">
                  2
                </span>
                <span>
                  <strong>Aspirin 325 mg:</strong> Chew one adult 325 mg non-enteric aspirin immediately unless allergic or active bleeding is present.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white mt-0.5">
                  3
                </span>
                <span>
                  <strong>Unlock Door:</strong> Unlock front door so emergency responders can enter without delay.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white mt-0.5">
                  4
                </span>
                <span>
                  <strong>Do NOT Drive:</strong> Never attempt to drive yourself to the emergency department.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
