'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  PhoneCall,
  Activity,
  HeartPulse,
  ShieldAlert,
  Clock,
  User,
  Search,
  Filter,
  RefreshCw,
  FileText,
  Calendar,
  PhoneForwarded,
  CheckCircle,
  XCircle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

interface CallItem {
  id?: string;
  callId?: string;
  callerId: string;
  mode: 'phone' | 'browser';
  status: 'initiating' | 'active' | 'completed' | 'failed' | 'transferred' | 'cancelled';
  startTime?: number;
  startedAt?: number;
  endTime?: number;
  endedAt?: number;
  duration?: number;
  transcriptCount?: number;
  transcript?: { speaker: string; text: string; timestamp: number }[];
  transcripts?: { speaker: string; text: string; timestamp: number }[];
  structuredData?: Record<string, any>;
  extractedData?: Record<string, any>;
  summary?: {
    reasonForCall?: string;
    keyInformationProvided?: string[];
    actionsTaken?: string[];
    recommendations?: string[];
    rawSummaryText?: string;
  };
}

interface CallStats {
  totalCalls: number;
  activeCalls: number;
  completedCalls: number;
  failedCalls: number;
  avgDurationSeconds: number;
  modeDistribution: { phone: number; browser: number };
  criticalEmergencyAlerts: number;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<CallItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<string>('all');

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/calls');
      const data = await res.json();
      if (data.calls) {
        setCalls(data.calls);
        setStats(data.stats);
        if (data.calls.length > 0) {
          setSelectedCall((prev) => prev || data.calls[0]);
        }
      }
    } catch (e) {
      console.error('Error fetching calls:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const formatDuration = (secs?: number) => {
    if (!secs) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const filteredCalls = calls.filter((c) => {
    const id = c.callId || c.id || '';
    const matchesSearch =
      id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.callerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.summary?.reasonForCall || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMode = filterMode === 'all' || c.mode === filterMode;
    return matchesSearch && matchesMode;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Header */}
      <div className="mx-auto max-w-7xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600/20 border border-red-500/30 text-red-500">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                Cardiac Helpline Records & Triage Logs
              </h1>
              <p className="text-xs md:text-sm text-slate-400">
                Auditable call logs, AI clinical summaries, and non-blocking extracted biomarkers
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCalls}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <Link
            href="/helpline"
            className="flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/30 transition-all"
          >
            <PhoneCall className="h-4 w-4" /> Open Helpline
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-md">
          <p className="text-xs font-semibold uppercase text-slate-400">Total Consultations</p>
          <p className="mt-1 text-2xl font-black text-white">{stats?.totalCalls || calls.length}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Phone & Browser Helpline</p>
        </div>

        <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 shadow-md">
          <p className="text-xs font-semibold uppercase text-red-400">Critical Red Flags</p>
          <p className="mt-1 text-2xl font-black text-red-400">
            {stats?.criticalEmergencyAlerts || 0}
          </p>
          <p className="text-[11px] text-red-300/70 mt-0.5">EMS Alert Dispatches</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-md">
          <p className="text-xs font-semibold uppercase text-slate-400">Average Duration</p>
          <p className="mt-1 text-2xl font-black text-slate-200">
            {formatDuration(stats?.avgDurationSeconds || 0)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Per Triage Interaction</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-md">
          <p className="text-xs font-semibold uppercase text-slate-400">Telephony Channel</p>
          <p className="mt-1 text-2xl font-black text-slate-200">
            {stats?.modeDistribution?.phone || 0}{' '}
            <span className="text-xs font-normal text-slate-400">Phone</span> /{' '}
            {stats?.modeDistribution?.browser || calls.length}{' '}
            <span className="text-xs font-normal text-slate-400">Browser</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Exotel PSTN Gateway</p>
        </div>
      </div>

      {/* Main Grid: Calls List + Detail View */}
      <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calls List */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          {/* Filter / Search Bar */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search call ID or caller..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
              />
            </div>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 focus:border-red-500 focus:outline-none"
            >
              <option value="all">All Modes</option>
              <option value="browser">Browser</option>
              <option value="phone">Phone</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[600px] divide-y divide-slate-800/60">
            {filteredCalls.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No call records found. Start a call from the Helpline to create records.
              </div>
            ) : (
              filteredCalls.map((call) => {
                const callKey = call.callId || call.id || Math.random().toString();
                const isSelected = (selectedCall?.callId || selectedCall?.id) === callKey;
                const urgency = (call.structuredData || call.extractedData)?.urgency_level?.value;
                const displayTime = call.startedAt || call.startTime || Date.now();

                return (
                  <button
                    key={callKey}
                    onClick={() => setSelectedCall(call)}
                    className={`w-full text-left p-4 transition-all flex items-start justify-between gap-3 ${
                      isSelected ? 'bg-red-950/20 border-l-4 border-l-red-500' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-white">{call.callerId}</span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase font-mono text-slate-400">
                          {call.mode}
                        </span>
                        {urgency === 'CRITICAL_EMERGENCY' && (
                          <span className="rounded bg-red-600/30 px-1.5 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/40">
                            RED FLAG
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1">
                        {call.summary?.reasonForCall || 'General cardiac evaluation call'}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatDuration(call.duration)}
                        </span>
                        <span>{new Date(displayTime).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-600 shrink-0 mt-1" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Call Detail Inspection Panel */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl p-6">
          {selectedCall ? (
            <div className="space-y-6">
              {/* Top Banner */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">
                      Call Session: {selectedCall.callId || selectedCall.id}
                    </h2>
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                      {selectedCall.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Caller: <strong>{selectedCall.callerId}</strong> • Started:{' '}
                    {new Date(selectedCall.startedAt || selectedCall.startTime || Date.now()).toLocaleString()} • Duration:{' '}
                    {formatDuration(selectedCall.duration)}
                  </p>
                </div>
              </div>

              {/* Extracted Structured Biomarkers */}
              {(() => {
                const sData = selectedCall.structuredData || selectedCall.extractedData;
                if (!sData || Object.keys(sData).length === 0) return null;
                return (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-red-500" /> Extracted Clinical Schema
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(sData).map(([key, data]: [string, any]) => (
                        <div
                          key={key}
                          className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                        >
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p className="mt-1 text-xs font-bold text-white">
                            {typeof data?.value === 'boolean'
                              ? data.value ? 'Yes' : 'No'
                              : String(data?.value || 'Not reported')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* AI Clinical Summary */}
              {selectedCall.summary && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" /> AI Executive Summary
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    {selectedCall.summary.rawSummaryText || selectedCall.summary.reasonForCall}
                  </p>

                  {selectedCall.summary.actionsTaken && selectedCall.summary.actionsTaken.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] font-semibold text-slate-400">Actions Taken:</p>
                      <ul className="mt-1 list-disc list-inside text-xs text-slate-300 space-y-1">
                        {selectedCall.summary.actionsTaken.map((action, i) => (
                          <li key={i}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Transcript Viewer */}
              {(() => {
                const tr = selectedCall.transcript || selectedCall.transcripts;
                if (!tr || tr.length === 0) return null;
                return (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" /> Verbatim Call Transcript
                    </h3>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 max-h-[300px] overflow-y-auto space-y-3">
                      {tr.map((t, idx) => (
                        <div
                          key={idx}
                          className={`text-xs ${
                            t.speaker === 'patient' || t.speaker === 'caller'
                              ? 'text-slate-200'
                              : 'text-red-300'
                          }`}
                        >
                          <span className="font-bold text-slate-400 uppercase text-[10px] mr-2">
                            [{t.speaker}]:
                          </span>
                          {t.text}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-center p-12 text-slate-500 text-xs">
              Select a call record on the left to view detailed transcripts and clinical triage analysis.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
