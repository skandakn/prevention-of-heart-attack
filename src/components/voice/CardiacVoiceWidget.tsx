'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Pause,
  Play,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { filterAcousticEcho } from '@/core/utils/echo-filter';
import { extractCardiacFindings } from '@/core/extraction/deterministic-extractor';

interface SymptomState {
  value: any;
  status?: string;
  confidence?: number;
}

export function CardiacVoiceWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
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

  // Audio & Echo Cancellation References
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const isAudioPausedRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const lastAudioEndTimeRef = useRef<number>(0);
  const recentAssistantTextsRef = useRef<string[]>([
    'Hello, this is the BeatAhead Cardiac Care Helpline. I am here with you. Are you or someone near you experiencing chest discomfort, breathlessness, or unusual heart symptoms?',
    'BeatAhead Cardiac Care Helpline',
  ]);
  const isConnectedRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Duration timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isConnected) {
      timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [isConnected]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Stop currently playing audio immediately (ElevenLabs + speechSynthesis)
  const stopCurrentAudio = useCallback(() => {
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
    // Also cancel any browser speechSynthesis in progress
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    speechUtteranceRef.current = null;
    isPlayingRef.current = false;
    isAudioPausedRef.current = false;
    setIsSpeaking(false);
    setIsAudioPaused(false);
  }, []);


  // Safely pause speech recognition
  const safeAbortRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    setIsListening(false);
  }, []);

  // Safely resume speech recognition after audio ends
  const safeStartRecognition = useCallback(() => {
    if (!recognitionRef.current || !isConnectedRef.current || isPlayingRef.current) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // Ignore if already active
    }
  }, []);

  // Toggle audio pause / resume:
  //   PAUSE  → audio pauses, isPlayingRef goes false, mic starts (user can speak)
  //   RESUME → mic stops, isPlayingRef goes true, audio resumes
  const toggleAudioPause = useCallback(() => {
    const audio = currentAudioRef.current;
    if (audio) {
      // ElevenLabs base64 audio path
      if (isAudioPausedRef.current) {
        // RESUME — stop mic, mark playing, resume audio
        safeAbortRecognition();
        isPlayingRef.current = true;
        isAudioPausedRef.current = false;
        setIsAudioPaused(false);
        audio.play().catch(() => {});
      } else {
        // PAUSE — pause audio, free mic for user input
        isAudioPausedRef.current = true;
        isPlayingRef.current = false;
        setIsAudioPaused(true);
        audio.pause();
        setTimeout(() => safeStartRecognition(), 150);
      }
    } else if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Browser speechSynthesis fallback path
      if (isAudioPausedRef.current) {
        // RESUME
        safeAbortRecognition();
        isPlayingRef.current = true;
        isAudioPausedRef.current = false;
        setIsAudioPaused(false);
        window.speechSynthesis.resume();
      } else if (window.speechSynthesis.speaking) {
        // PAUSE
        isAudioPausedRef.current = true;
        isPlayingRef.current = false;
        setIsAudioPaused(true);
        window.speechSynthesis.pause();
        setTimeout(() => safeStartRecognition(), 150);
      }
    }
  }, [safeAbortRecognition, safeStartRecognition]);

  // Speak text via browser speechSynthesis (fallback when no ElevenLabs audio)
  const speakFallback = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    // Voices load asynchronously — wait for them if empty
    const assignVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Female'))
      ) || voices.find((v) => v.lang.startsWith('en'));
      if (preferred) utterance.voice = preferred;

      isPlayingRef.current = true;
      isAudioPausedRef.current = false;
      setIsSpeaking(true);
      setIsAudioPaused(false);
      safeAbortRecognition();
      speechUtteranceRef.current = utterance;

      utterance.onend = () => {
        speechUtteranceRef.current = null;
        isPlayingRef.current = false;
        isAudioPausedRef.current = false;
        setIsSpeaking(false);
        setIsAudioPaused(false);
        lastAudioEndTimeRef.current = Date.now();
        setTimeout(() => {
          if (!isPlayingRef.current && isConnectedRef.current) {
            safeStartRecognition();
          }
        }, 800);
      };
      utterance.onerror = () => {
        speechUtteranceRef.current = null;
        isPlayingRef.current = false;
        setIsSpeaking(false);
        setIsAudioPaused(false);
      };
      window.speechSynthesis.speak(utterance);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      assignVoiceAndSpeak();
    } else {
      // Voices not yet loaded — wait for the voiceschanged event
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        assignVoiceAndSpeak();
      };
      // Safety net: speak even if event never fires
      setTimeout(assignVoiceAndSpeak, 500);
    }
  }, [safeAbortRecognition, safeStartRecognition]);

  // Audio queue sequential playback with acoustic echo protection
  const playNextAudio = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      setIsAudioPaused(false);
      isAudioPausedRef.current = false;
      lastAudioEndTimeRef.current = Date.now();

      // Buffer 800ms after speaker audio stops before restarting speech recognition
      setTimeout(() => {
        if (!isPlayingRef.current && isConnectedRef.current) {
          safeStartRecognition();
        }
      }, 800);
      return;
    }

    isPlayingRef.current = true;
    isAudioPausedRef.current = false;
    setIsAudioPaused(false);
    setIsSpeaking(true);
    safeAbortRecognition(); // Abort microphone capture while speaker is playing!

    const base64Audio = audioQueueRef.current.shift()!;
    const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
    currentAudioRef.current = audio;

    // Guard: only chain to next track if not user-paused
    audio.onended = () => {
      if (isAudioPausedRef.current) return; // user paused — don't advance queue
      currentAudioRef.current = null;
      lastAudioEndTimeRef.current = Date.now();
      playNextAudio();
    };

    audio.onerror = (e) => {
      console.warn('Audio playback error:', e);
      currentAudioRef.current = null;
      lastAudioEndTimeRef.current = Date.now();
      isAudioPausedRef.current = false;
      playNextAudio();
    };

    audio.play().catch((err) => {
      console.warn('Autoplay prevented:', err);
      currentAudioRef.current = null;
      lastAudioEndTimeRef.current = Date.now();
      isAudioPausedRef.current = false;
      playNextAudio();
    });
  }, [safeAbortRecognition, safeStartRecognition]);

  const queueAudio = useCallback((base64Audio: string) => {
    audioQueueRef.current.push(base64Audio);
    // Don't trigger playback if already playing or if user has paused
    if (!isPlayingRef.current && !isAudioPausedRef.current) {
      playNextAudio();
    }
  }, [playNextAudio]);

  // Send turn to Voice Agent backend
  const sendPatientUtterance = useCallback(
    async (message: string, currentCallId = callId) => {
      if (!message || message.trim().length === 0) return;

      const trimmed = message.trim();

      // Acoustic echo validation
      const echoCheck = filterAcousticEcho(trimmed, recentAssistantTextsRef.current);
      if (echoCheck.isFullEcho) {
        console.log('[Widget Echo Filter] Dropped assistant speaker echo:', trimmed);
        return;
      }

      const cleanText = echoCheck.isPartialEcho ? echoCheck.cleanedText : trimmed;
      if (!cleanText || cleanText.length < 2) return;

      // Stop any lingering audio immediately upon user speaking
      stopCurrentAudio();

      // 0ms instant client-side deterministic symptom extraction
      const instant = extractCardiacFindings(cleanText, extractedData);
      if (Object.keys(instant).length > 0) {
        setExtractedData((prev) => ({ ...prev, ...instant }));
        const urg = instant.urgency_level?.value;
        if (urg === 'CRITICAL_EMERGENCY' || String(urg).toLowerCase().includes('critical')) {
          setUrgencyBadge('CRITICAL EMERGENCY');
        } else if (urg === 'HIGH_RISK_URGENT' || String(urg).toLowerCase().includes('high')) {
          setUrgencyBadge('HIGH RISK');
        }
      }

      setTranscripts((prev) => [
        ...prev,
        {
          speaker: 'patient',
          text: cleanText,
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
            message: cleanText,
          }),
        });

        const data = await res.json();
        setIsThinking(false);

        if (data.success) {
          setStatusMessage('Triage Line Connected • Active');

          // Track assistant text for future echo cancellation
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
          } else if (data.responseText) {
            // No ElevenLabs audio — fall back to browser speechSynthesis
            speakFallback(data.responseText);
          }

          if (data.structuredData) {
            setExtractedData((prev) => ({
              ...prev,
              ...data.structuredData,
            }));

            const urgency = data.structuredData.urgency_level?.value;
            if (urgency === 'CRITICAL_EMERGENCY' || String(urgency).toLowerCase().includes('critical')) {
              setUrgencyBadge('CRITICAL EMERGENCY');
            } else if (urgency === 'HIGH_RISK_URGENT' || String(urgency).toLowerCase().includes('high')) {
              setUrgencyBadge('HIGH RISK');
            }
          }
        }
      } catch (err: any) {
        setIsThinking(false);
        console.error('Turn processing error:', err);
        setStatusMessage('Error processing turn: ' + err.message);
      }
    },
    [callId, extractedData, queueAudio, speakFallback, stopCurrentAudio]
  );

  // Microphone capture setup
  const startMicrophoneCapture = useCallback(
    (activeCallId: string) => {
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
            if (!isPlayingRef.current) {
              setIsListening(true);
            }
          };

          recognition.onresult = (event: any) => {
            // Guard: strictly ignore if audio is playing or ended within 800ms
            if (isPlayingRef.current || Date.now() - lastAudioEndTimeRef.current < 800) {
              console.log('[Widget] Discarded speech during speaker audio playback');
              return;
            }

            const lastResult = event.results[event.results.length - 1];
            if (lastResult.isFinal) {
              const rawText = lastResult[0].transcript.trim();
              if (rawText.length > 0) {
                sendPatientUtterance(rawText, activeCallId);
              }
            }
          };

          recognition.onerror = (e: any) => {
            if (e.error !== 'no-speech' && e.error !== 'aborted') {
              console.warn('Speech recognition warning:', e.error);
            }
          };

          recognition.onend = () => {
            if (isConnectedRef.current && !isPlayingRef.current && Date.now() - lastAudioEndTimeRef.current >= 800) {
              setTimeout(() => {
                if (isConnectedRef.current && !isPlayingRef.current && Date.now() - lastAudioEndTimeRef.current >= 800) {
                  try {
                    recognition.start();
                  } catch {}
                }
              }, 400);
            }
          };

          // Only start microphone capture immediately if speaker audio is NOT playing
          if (!isPlayingRef.current && Date.now() - lastAudioEndTimeRef.current >= 800) {
            try {
              recognition.start();
            } catch {}
          }
          recognitionRef.current = recognition;
          return;
        } catch (e) {
          console.warn('Web Speech API fallback to MediaRecorder', e);
        }
      }

      // MediaRecorder fallback
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
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                audioChunksRef.current = [];
                try {
                  const formData = new FormData();
                  formData.append('file', audioBlob, 'audio.webm');
                  const res = await fetch('/api/voice/transcribe', {
                    method: 'POST',
                    body: formData,
                  });
                  const d = await res.json();
                  if (d.text && d.text.trim().length > 0) {
                    sendPatientUtterance(d.text.trim(), activeCallId);
                  }
                } catch {}
              }
            };

            recorder.start(2500);
          })
          .catch(() => {
            setStatusMessage('Microphone unavailable. Use text box below.');
          });
      }
    },
    [sendPatientUtterance]
  );

  const stopMicrophoneCapture = useCallback(() => {
    safeAbortRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      } catch {}
      mediaRecorderRef.current = null;
    }
    setIsListening(false);
  }, [safeAbortRecognition]);

  // Start call session
  const startCall = useCallback(async () => {
    try {
      stopCurrentAudio();
      const newCallId = `cardiac_browser_${Date.now()}`;
      setCallId(newCallId);
      setIsConnected(true);
      isConnectedRef.current = true;
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
        const greeting =
          data.responseText ||
          "Hello, this is the BeatAhead Cardiac Care Helpline. I'm here with you. Are you or someone near you experiencing chest discomfort, breathlessness, or unusual heart symptoms?";

        recentAssistantTextsRef.current.push(greeting);
        recentAssistantTextsRef.current.push(
          "Hello, this is the BeatAhead Cardiac Care Helpline. I'm here with you. Are you or someone near you experiencing chest discomfort, breathlessness, or unusual heart symptoms?"
        );
        recentAssistantTextsRef.current.push(
          "Hello, this is the Beta Head Cardiac Care Helpline. I'm here with you. Are you or someone near you experiencing chest discomfort, breathlessness, or unusual heart symptoms?"
        );

        setTranscripts([
          {
            speaker: 'assistant',
            text: greeting,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);

        if (data.audioBase64) {
          queueAudio(data.audioBase64);
        } else if (greeting) {
          // No ElevenLabs audio — fall back to browser speechSynthesis
          speakFallback(greeting);
        }

        startMicrophoneCapture(newCallId);
      }
    } catch (err: any) {
      console.error('Failed to start call:', err);
      setStatusMessage('Connection failed: ' + err.message);
    }
  }, [queueAudio, speakFallback, startMicrophoneCapture, stopCurrentAudio]);

  // End call session
  const endCall = useCallback(async () => {
    stopCurrentAudio();
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
    isConnectedRef.current = false;
    setIsListening(false);
    setIsSpeaking(false);
    setStatusMessage('Call finalized • Summary archived');
  }, [callId, stopCurrentAudio, stopMicrophoneCapture]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const msg = textInput.trim();
    setTextInput('');

    if (!isConnected) {
      startCall().then(() => {
        setTimeout(() => sendPatientUtterance(msg), 1000);
      });
    } else {
      sendPatientUtterance(msg);
    }
  };

  // Determine if any structured clinical findings exist
  const hasAnyFindings = Object.values(extractedData).some(
    (field) => field && field.value !== null && field.value !== undefined && field.value !== ''
  );

  // Hide on sign-in and sign-up pages — helpline is only available after login
  if (pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up')) {
    return null;
  }

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open 24/7 Beat Ahead Assistant"
            className="group relative flex items-center gap-3 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-5 py-3.5 text-white shadow-2xl shadow-red-600/40 transition-all duration-300 hover:scale-105 hover:shadow-red-600/60 focus:outline-none focus:ring-4 focus:ring-red-500/30"
          >
            <span className="absolute -inset-1 rounded-full bg-red-500/30 opacity-75 blur-sm animate-pulse group-hover:opacity-100" />
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <HeartPulse className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div className="relative text-left">
              <p className="text-sm font-extrabold tracking-tight">24/7 Beat Ahead Assistant</p>
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
                    <h2 className="text-sm font-bold text-white">24/7 Beat Ahead Assistant</h2>
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
                {/* Pause / Resume audio button — only visible while assistant is speaking */}
                {isSpeaking && (
                  <button
                    onClick={toggleAudioPause}
                    title={isAudioPaused ? 'Resume audio' : 'Pause audio'}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-amber-400 transition-colors"
                  >
                    {isAudioPaused
                      ? <Play className="h-4 w-4" />
                      : <Pause className="h-4 w-4" />}
                  </button>
                )}
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
          <div className="border-b border-slate-800 bg-slate-900/80 px-3.5 py-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1.5 font-semibold">
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-red-500 animate-pulse" /> Extracted Clinical Findings:
              </span>
              {extractedData.urgency_level?.value && (
                <span className="rounded bg-red-600/30 border border-red-500/40 px-2 py-0.5 text-[10px] font-extrabold text-red-300 tracking-wide uppercase">
                  {String(extractedData.urgency_level.value).replace(/_/g, ' ')}
                </span>
              )}
            </div>
            {hasAnyFindings ? (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {extractedData.primary_symptom?.value && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600/25 px-2.5 py-1 text-[11px] font-bold text-red-200 border border-red-500/40 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    Symptom: {String(extractedData.primary_symptom.value).replace(/_/g, ' ')}
                  </span>
                )}
                {extractedData.pain_severity_scale?.value && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-300 border border-amber-500/40 shadow-sm">
                    Pain: {extractedData.pain_severity_scale.value}/10
                  </span>
                )}
                {extractedData.symptom_onset_minutes?.value && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/20 px-2.5 py-1 text-[11px] font-semibold text-blue-300 border border-blue-500/40 shadow-sm">
                    <Clock className="h-3 w-3" /> Onset: {extractedData.symptom_onset_minutes.value}m
                  </span>
                )}
                {extractedData.patient_age?.value && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 border border-slate-700">
                    Age: {extractedData.patient_age.value}y
                  </span>
                )}
                {extractedData.prior_cardiac_history?.value && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-500/20 px-2.5 py-1 text-[11px] font-semibold text-purple-300 border border-purple-500/40">
                    History: {String(extractedData.prior_cardiac_history.value)}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 font-medium italic flex items-center gap-1.5 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400/80 animate-ping" />
                {isConnected
                  ? 'Listening for acute chest pain, pain scale (1-10), and duration...'
                  : 'Start call to begin clinical symptom extraction.'}
              </p>
            )}
          </div>

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
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                    msg.speaker === 'patient'
                      ? 'bg-red-600 text-white rounded-tr-none'
                      : 'bg-slate-800/95 border border-slate-700/60 text-slate-200 rounded-tl-none'
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
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold animate-pulse">
                    <Volume2 className="h-3.5 w-3.5" /> Speaking (ElevenLabs)
                  </span>
                ) : isListening ? (
                  <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                    <Mic className="h-3.5 w-3.5 animate-pulse" /> Listening (Microphone)
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
                  ? 'Speak or type symptoms (e.g. chest pain, arm radiating)...'
                  : 'Type symptoms or click Start Live Voice Call...'
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
