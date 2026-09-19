'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  Sparkles,
  X,
  Send,
  ShieldAlert,
  Clock,
  Radio,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface SymptomState {
  value: any;
  status: string;
  confidence?: number;
}

export function CardiacVoiceWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [callId, setCallId] = useState<string>('');
  const [callDuration, setCallDuration] = useState(0);
  const [textInput, setTextInput] = useState('');
  const [transcripts, setTranscripts] = useState<
    { speaker: 'patient' | 'assistant' | 'system'; text: string; time: string }[]
  >([]);
  const [extractedData, setExtractedData] = useState<Record<string, SymptomState>>({});
  const [statusMessage, setStatusMessage] = useState('24/7 AI Cardiac Emergency Triage');
  const [urgencyBadge, setUrgencyBadge] = useState<string | null>(null);

  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Call duration counter
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isConnected) {
      timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [isConnected]);

  // Scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Format MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Play audio queue safely
  const playNextAudio = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);
    const base64Audio = audioQueueRef.current.shift()!;
    const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);

    audio.onended = () => {
      playNextAudio();
    };
    audio.onerror = () => {
      playNextAudio();
    };

    audio.play().catch((e) => {
      console.warn('Playback error:', e);
      playNextAudio();
    });
  };

  const queueAudio = (base64Audio: string) => {
    audioQueueRef.current.push(base64Audio);
    if (!isPlayingRef.current) {
      playNextAudio();
    }
  };

  // Initialize call session
  const startCall = async () => {
    try {
      const newCallId = `cardiac_browser_${Date.now()}`;
      setCallId(newCallId);
      setIsConnected(true);
      setStatusMessage('Connecting to Cardiac Care Specialist...');

      const res = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          callId: newCallId,
          callerId: 'Patient (Browser Session)',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage('Triage Line Connected • Listening');
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

        startMicrophoneCapture(newCallId);
      }
    } catch (err: any) {
      console.error('Failed to start call:', err);
      setStatusMessage('Connection failed: ' + err.message);
    }
  };

  // End call session
  const endCall = async () => {
    stopMicrophoneCapture();
    if (callId) {
      try {
        await fetch('/api/voice/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'end', callId }),
        });
      } catch (err) {
        console.error('Error ending call:', err);
      }
    }
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setStatusMessage('Call finalized • Summary archived');
  };

  // Microphone capture via Web Speech API or MediaRecorder
  const startMicrophoneCapture = (activeCallId: string) => {
    if (typeof window === 'undefined') return;

    // Use Web Speech API if supported for ultra-responsive local speech transcription
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          const lastResult = event.results[event.results.length - 1];
          if (lastResult.isFinal) {
            const transcriptText = lastResult[0].transcript.trim();
            if (transcriptText.length > 0 && !isPlayingRef.current) {
              sendPatientUtterance(transcriptText, activeCallId);
            }
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition warning:', e.error);
        };

        recognition.onend = () => {
          if (isConnected && !isPlayingRef.current) {
            try {
              recognition.start();
            } catch {}
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
        return;
      } catch (e) {
        console.warn('Web Speech API fallback to MediaRecorder', e);
      }
    }

    // Fallback: MediaRecorder sending audio chunks to Groq Whisper
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          mediaRecorderRef.current = recorder;
          setIsListening(true);

          recorder.ondataavailable = async (e) => {
            if (e.data.size > 0) {
              audioChunksRef.current.push(e.data);
            }
          };

          recorder.onstop = async () => {
            if (audioChunksRef.current.length > 0) {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              audioChunksRef.current = [];
              await transcribeAndSend(audioBlob, activeCallId);
            }
          };

          recorder.start(3000); // 3s slices
        })
        .catch((err) => {
          console.warn('Microphone permission denied or unavailable:', err);
          setStatusMessage('Microphone unavailable. Use text chat below.');
        });
    }
  };

  const stopMicrophoneCapture = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      } catch {}
      mediaRecorderRef.current = null;
    }
    setIsListening(false);
  };

  const transcribeAndSend = async (blob: Blob, activeCallId: string) => {
    try {
      const formData = new FormData();
      formData.append('file', blob, 'audio.webm');
      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.text && data.text.trim().length > 0) {
        sendPatientUtterance(data.text.trim(), activeCallId);
      }
    } catch (e) {
      console.error('Transcription error:', e);
    }
  };

  // Send turn to Voice Agent backend
  const sendPatientUtterance = async (message: string, currentCallId = callId) => {
    if (!message || message.trim().length === 0) return;

    setTranscripts((prev) => [
      ...prev,
      {
        speaker: 'patient',
        text: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setIsThinking(true);
    setStatusMessage('Analyzing cardiac indicators & protocol...');

    try {
      const res = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'utterance',
          callId: currentCallId,
          message,
        }),
      });

      const data = await res.json();
      setIsThinking(false);

      if (data.success) {
        setStatusMessage('Triage Line Connected • Active');
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

          // Update urgency badge if red flag
          const urgency = data.structuredData.urgency_level?.value;
          if (urgency === 'CRITICAL_EMERGENCY') {
            setUrgencyBadge('CRITICAL EMERGENCY');
          } else if (urgency === 'HIGH_RISK_URGENT') {
            setUrgencyBadge('HIGH RISK');
          }
        }
      }
    } catch (err: any) {
      setIsThinking(false);
      console.error('Turn processing error:', err);
      setStatusMessage('Error processing turn: ' + err.message);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const msg = textInput.trim();
    setTextInput('');
    if (!isConnected) {
      startCall().then(() => {
        setTimeout(() => sendPatientUtterance(msg), 1200);
      });
    } else {
      sendPatientUtterance(msg);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open AI Cardiac Helpline"
            className="group relative flex items-center gap-3 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-5 py-3.5 text-white shadow-2xl shadow-red-600/40 transition-all duration-300 hover:scale-105 hover:shadow-red-600/60 focus:outline-none focus:ring-4 focus:ring-red-500/30"
          >
            {/* Animated Pulse Ring */}
            <span className="absolute -inset-1 rounded-full bg-red-500/30 opacity-75 blur-sm animate-pulse group-hover:opacity-100" />
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <HeartPulse className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div className="relative text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-red-100">
                24/7 AI Triage
              </p>
              <p className="text-sm font-extrabold tracking-tight">Cardiac Helpline</p>
            </div>
            <div className="relative ml-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
          </button>
        </div>
      )}

      {/* Floating Modal / Widget Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[620px] w-[420px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-red-500/30 bg-slate-950/95 text-slate-100 shadow-2xl shadow-red-950/50 backdrop-blur-xl transition-all">
          {/* Header */}
          <div className="relative border-b border-slate-800 bg-gradient-to-r from-slate-900 via-red-950/40 to-slate-900 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600/20 border border-red-500/30 text-red-400">
                  <HeartPulse className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white">BeatAhead Helpline</h2>
                    {isConnected && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                        {formatTime(callDuration)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">Groq Whisper • Gemini • ElevenLabs</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Link
                  href="/helpline"
                  title="Open Full Screen Helpline"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Urgency Alert Bar if triggered */}
            {urgencyBadge && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-600/20 border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 animate-pulse">
                <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
                <span>TRIAGE ALERT: {urgencyBadge} — EMS Protocol Active</span>
              </div>
            )}
          </div>

          {/* Extracted Symptom Ticker */}
          {Object.keys(extractedData).length > 0 && (
            <div className="border-b border-slate-800 bg-slate-900/60 px-3 py-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span className="font-semibold flex items-center gap-1 text-slate-300">
                  <Activity className="h-3 w-3 text-red-400" /> Extracted Clinical Findings:
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {extractedData.pain_severity_scale?.value && (
                  <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-medium text-rose-300 border border-rose-500/30">
                    Pain: {extractedData.pain_severity_scale.value}/10
                  </span>
                )}
                {extractedData.primary_symptom?.value && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/30">
                    {String(extractedData.primary_symptom.value).replace(/_/g, ' ')}
                  </span>
                )}
                {extractedData.symptom_onset_minutes?.value && (
                  <span className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300 border border-blue-500/30">
                    <Clock className="h-2.5 w-2.5" /> Onset: {extractedData.symptom_onset_minutes.value}m
                  </span>
                )}
                {extractedData.urgency_level?.value && (
                  <span className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/30">
                    {String(extractedData.urgency_level.value).replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Transcript Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {transcripts.length === 0 && !isConnected && (
              <div className="flex h-full flex-col items-center justify-center text-center px-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/10 border border-red-500/20 text-red-400 mb-3 shadow-inner">
                  <PhoneCall className="h-8 w-8 animate-pulse" />
                </div>
                <h3 className="text-sm font-semibold text-white">Emergency Cardiac AI Helpline</h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-[260px]">
                  Immediate vocal triage for acute chest discomfort, radiating pain, breathlessness, or elevated Ischemic Stress Index (ISI).
                </p>
                <div className="mt-4 flex flex-col gap-2 w-full max-w-[240px]">
                  <button
                    onClick={startCall}
                    className="flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 py-2.5 px-4 text-xs font-bold text-white shadow-lg shadow-red-600/30 transition-all hover:scale-102"
                  >
                    <PhoneCall className="h-4 w-4" /> Start Live Voice Call
                  </button>
                  <Link
                    href="/helpline"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 py-2 px-3 text-[11px] font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Telephone Dialer & Full Screen →
                  </Link>
                </div>
              </div>
            )}

            {transcripts.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${
                  msg.speaker === 'patient' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1 px-1">
                  <span>{msg.speaker === 'patient' ? 'You' : 'BeatAhead Triage AI'}</span>
                  <span>•</span>
                  <span>{msg.time}</span>
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.speaker === 'patient'
                      ? 'bg-red-600 text-white rounded-tr-none'
                      : 'bg-slate-800/90 border border-slate-700/60 text-slate-200 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-3 py-2 w-fit">
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
                <span>Evaluating cardiac protocols...</span>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Waveform / Voice Activity Bar */}
          {isConnected && (
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/80 px-4 py-2 text-xs">
              <div className="flex items-center gap-2">
                {isSpeaking ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <Volume2 className="h-3.5 w-3.5 animate-bounce" /> Speaking (ElevenLabs)
                  </span>
                ) : isListening ? (
                  <span className="flex items-center gap-1 text-amber-400 font-medium">
                    <Mic className="h-3.5 w-3.5 animate-pulse" /> Listening (Groq Whisper)
                  </span>
                ) : (
                  <span className="text-slate-400 flex items-center gap-1">
                    <Radio className="h-3 w-3" /> Standby
                  </span>
                )}
              </div>
              <button
                onClick={endCall}
                className="flex items-center gap-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 px-2.5 py-1 text-[11px] font-bold text-red-300 transition-colors"
              >
                <PhoneOff className="h-3 w-3" /> End Call
              </button>
            </div>
          )}

          {/* Text Input / Send Footer */}
          <form
            onSubmit={handleTextSubmit}
            className="border-t border-slate-800 bg-slate-950 p-3 flex items-center gap-2"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                isConnected
                  ? 'Speak or type your symptoms...'
                  : 'Type symptoms or click Start Call...'
              }
              className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <button
              type="submit"
              disabled={!textInput.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 transition-all"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
