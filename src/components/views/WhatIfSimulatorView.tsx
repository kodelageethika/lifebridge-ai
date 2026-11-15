import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { OrganType } from '../../types/index.ts';
import { OrganTag } from '../common/OrganTag.tsx';
import {
  Scale,
  Sparkles,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
  CheckCircle2
} from 'lucide-react';

export const WhatIfSimulatorView: React.FC = () => {
  const { recipients, organConfigs } = useApp();

  const [selectedOrgan, setSelectedOrgan] = useState<OrganType>('kidney');
  const [showComparisonDetails, setShowComparisonDetails] = useState(false);

  const eligibleRecipients = recipients.filter(
    r => r.organType === selectedOrgan && r.medicalVerificationStatus === 'VERIFIED'
  );

  const [candAId, setCandAId] = useState<string>(() => eligibleRecipients[0]?.id || 'REC-K01');
  const [candBId, setCandBId] = useState<string>(() => eligibleRecipients[1]?.id || 'REC-K02');

  const candA = recipients.find(r => r.id === candAId) || eligibleRecipients[0];
  const candB = recipients.find(r => r.id === candBId) || eligibleRecipients[1];
  const config = organConfigs.find(c => c.organType === selectedOrgan) || organConfigs[0];

  const calcScore = (cand: typeof candA) => {
    if (!cand) return { total: 0, compat: 0, urgency: 0, wait: 0, logistics: 0 };
    const maxCompat = config.weights.compatibility * 100;
    const maxUrgency = config.weights.urgency * 100;
    const maxWait = config.weights.waitingTime * 100;
    const maxLog = config.weights.transportFeasibility * 100;

    const compat = cand.id === 'REC-K01' ? maxCompat * 0.95 : maxCompat * 0.70;
    const urgency = (cand.urgencyScore / 100) * maxUrgency;
    const wait = Math.min(1, cand.waitlistDays / 1200) * maxWait;
    const log = (1 - Math.min(1, cand.distanceKm / 100) * 0.5) * maxLog;

    return {
      total: Number((compat + urgency + wait + log).toFixed(1)),
      compat: Number(compat.toFixed(1)),
      urgency: Number(urgency.toFixed(1)),
      wait: Number(wait.toFixed(1)),
      logistics: Number(log.toFixed(1)),
    };
  };

  const scoreA = calcScore(candA);
  const scoreB = calcScore(candB);

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      
      {/* 1. CLEAN HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243B55] dark:text-white">
            Scenario Lab
          </h1>
          <p className="text-sm text-[#788394] dark:text-[#94A3B8] mt-1">
            Compare hypothetical allocation scenarios side-by-side.
          </p>
        </div>

        {/* Organ Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#788394]">Organ Context:</label>
          <select
            value={selectedOrgan}
            onChange={(e) => {
              const organ = e.target.value as OrganType;
              setSelectedOrgan(organ);
              const recs = recipients.filter(r => r.organType === organ);
              if (recs[0]) setCandAId(recs[0].id);
              if (recs[1]) setCandBId(recs[1].id);
            }}
            className="text-xs font-semibold bg-white dark:bg-[#152232] border border-[#EFE7DE] dark:border-[#273A52] rounded-xl px-3 py-1.5 text-[#243B55] dark:text-white capitalize"
          >
            <option value="kidney">Kidney</option>
            <option value="liver">Liver</option>
            <option value="heart">Heart</option>
          </select>
        </div>
      </div>

      {/* Prominent Hypothetical Notice */}
      <div className="p-4 rounded-2xl bg-[#F8E8E3] dark:bg-[#2C1C1A] border border-[#E98F83]/30 flex items-start gap-3 text-xs text-[#243B55] dark:text-[#F8E8E3]">
        <Info size={16} className="text-[#E98F83] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="font-bold">Hypothetical Demonstration: </span>
          These simulations are for clinical scenario analysis only. Results do not allocate organs or replace authorized surgical decisions.
        </p>
      </div>

      {/* 2. SIDE-BY-SIDE CANDIDATE COMPARISON */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Candidate A Card */}
        <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E98F83]">
              Candidate A
            </span>
            <span className="text-2xl font-bold font-mono text-[#243B55] dark:text-white">
              {scoreA.total} <span className="text-xs font-normal text-[#788394]">/100</span>
            </span>
          </div>

          <select
            value={candAId}
            onChange={(e) => setCandAId(e.target.value)}
            className="w-full text-xs font-semibold bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] rounded-xl p-3 text-[#243B55] dark:text-white focus:outline-none"
          >
            {eligibleRecipients.map(r => (
              <option key={r.id} value={r.id}>
                {r.anonymizedCode} ({r.hospitalName})
              </option>
            ))}
          </select>

          {candA && (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#EFE7DE] dark:border-[#273A52]">
                <span className="text-[#788394]">Waitlist Time:</span>
                <span className="font-semibold text-[#243B55] dark:text-white">{candA.waitlistDays} days</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#EFE7DE] dark:border-[#273A52]">
                <span className="text-[#788394]">Distance:</span>
                <span className="font-semibold text-[#243B55] dark:text-white">{candA.distanceKm} km</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#788394]">HLA Compatibility:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Optimal Match</span>
              </div>
            </div>
          )}
        </div>

        {/* Candidate B Card */}
        <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#788394]">
              Candidate B
            </span>
            <span className="text-2xl font-bold font-mono text-[#243B55] dark:text-white">
              {scoreB.total} <span className="text-xs font-normal text-[#788394]">/100</span>
            </span>
          </div>

          <select
            value={candBId}
            onChange={(e) => setCandBId(e.target.value)}
            className="w-full text-xs font-semibold bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] rounded-xl p-3 text-[#243B55] dark:text-white focus:outline-none"
          >
            {eligibleRecipients.map(r => (
              <option key={r.id} value={r.id}>
                {r.anonymizedCode} ({r.hospitalName})
              </option>
            ))}
          </select>

          {candB && (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#EFE7DE] dark:border-[#273A52]">
                <span className="text-[#788394]">Waitlist Time:</span>
                <span className="font-semibold text-[#243B55] dark:text-white">{candB.waitlistDays} days</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#EFE7DE] dark:border-[#273A52]">
                <span className="text-[#788394]">Distance:</span>
                <span className="font-semibold text-[#243B55] dark:text-white">{candB.distanceKm} km</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#788394]">HLA Compatibility:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Acceptable Match</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. SHOW COMPARISON DETAILS (Level 2 / 3 Progressive Disclosure) */}
      <div className="space-y-4">
        <button
          onClick={() => setShowComparisonDetails(prev => !prev)}
          className="w-full p-4 rounded-2xl bg-white dark:bg-[#152232] border border-[#EFE7DE] dark:border-[#273A52] flex items-center justify-between text-xs font-semibold text-[#243B55] dark:text-white hover:border-[#E98F83] transition-colors cursor-pointer"
        >
          <span>{showComparisonDetails ? 'Hide Detailed Scoring Factors' : 'Show Detailed Scoring Factors'}</span>
          {showComparisonDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showComparisonDetails && (
          <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-4 text-xs animate-in fade-in duration-150">
            <h3 className="font-bold text-[#243B55] dark:text-white">
              Factor Contribution Delta
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-[#F8F5EF] dark:bg-[#111A26] rounded-xl space-y-1">
                <span className="text-[#788394] block">HLA Match</span>
                <div className="font-mono font-bold text-sm text-[#243B55] dark:text-white">
                  {scoreA.compat} vs {scoreB.compat} pts
                </div>
              </div>

              <div className="p-3 bg-[#F8F5EF] dark:bg-[#111A26] rounded-xl space-y-1">
                <span className="text-[#788394] block">Waitlist Duration</span>
                <div className="font-mono font-bold text-sm text-[#243B55] dark:text-white">
                  {scoreA.wait} vs {scoreB.wait} pts
                </div>
              </div>

              <div className="p-3 bg-[#F8F5EF] dark:bg-[#111A26] rounded-xl space-y-1">
                <span className="text-[#788394] block">Clinical Urgency</span>
                <div className="font-mono font-bold text-sm text-[#243B55] dark:text-white">
                  {scoreA.urgency} vs {scoreB.urgency} pts
                </div>
              </div>

              <div className="p-3 bg-[#F8F5EF] dark:bg-[#111A26] rounded-xl space-y-1">
                <span className="text-[#788394] block">Logistics Corridor</span>
                <div className="font-mono font-bold text-sm text-[#243B55] dark:text-white">
                  {scoreA.logistics} vs {scoreB.logistics} pts
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
