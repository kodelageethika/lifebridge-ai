import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { OrganType, MatchCandidate } from '../../types/index.ts';
import { OrganTag } from '../common/OrganTag.tsx';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Scale,
  Clock,
  MapPin,
  ChevronRight,
  Activity,
  Droplet,
  Heart,
  Wind,
  Shield,
  Eye,
  Info
} from 'lucide-react';

export const ExplainableMatchingView: React.FC = () => {
  const {
    organs,
    organConfigs,
    matchRuns,
    runDeterministicMatch,
    setActiveView,
    selectedOrganFilter,
    setSelectedOrganFilter,
  } = useApp();

  const [selectedOrganId, setSelectedOrganId] = useState<string>(() => {
    return organs[0]?.id || 'ORG-K704';
  });

  // Level 2 / 3 Progressive Disclosure: Selected candidate for detailed explanation drawer
  const [selectedCandidate, setSelectedCandidate] = useState<MatchCandidate | null>(null);

  const activeOrgan = organs.find(o => o.id === selectedOrganId) || organs[0];
  const activeConfig = organConfigs.find(c => c.organType === activeOrgan.organType) || organConfigs[0];
  const activeMatchRun = matchRuns.find(m => m.organId === activeOrgan.id) || matchRuns[0];

  const organButtons: { type: OrganType; label: string; icon: React.ElementType }[] = [
    { type: 'kidney', label: 'Kidney', icon: Activity },
    { type: 'liver', label: 'Liver', icon: Droplet },
    { type: 'heart', label: 'Heart', icon: Heart },
    { type: 'lung', label: 'Lung', icon: Wind },
    { type: 'pancreas', label: 'Pancreas', icon: Shield },
    { type: 'intestine', label: 'Intestine', icon: Eye },
  ];

  const handleOrganSelect = (type: OrganType) => {
    setSelectedOrganFilter(type);
    const organ = organs.find(o => o.organType === type);
    if (organ) {
      setSelectedOrganId(organ.id);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      
      {/* 1. CLEAN HEADER (Simplified Language per Part 4 & 7) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243B55] dark:text-white">
            Organ Matching
          </h1>
          <p className="text-sm text-[#788394] dark:text-[#94A3B8] mt-1">
            Review potential matches for each organ.
          </p>
        </div>

        <button
          onClick={() => runDeterministicMatch(activeOrgan.id)}
          className="px-4 py-2 text-xs font-semibold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl transition-all shadow-xs flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
        >
          <Sparkles size={14} />
          <span>Refresh Potential Matches</span>
        </button>
      </div>

      {/* 2. VISUAL ORGAN SELECTION BUTTONS */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
        {organButtons.map(item => {
          const isSelected = activeOrgan.organType === item.type;
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              onClick={() => handleOrganSelect(item.type)}
              className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                isSelected
                  ? 'bg-white dark:bg-[#1E2E40] border-[#E98F83] text-[#E98F83] shadow-sm ring-1 ring-[#E98F83]/30 font-bold'
                  : 'bg-white dark:bg-[#152232] border-[#EFE7DE] dark:border-[#273A52] text-[#788394] hover:text-[#243B55] dark:hover:text-white hover:border-[#E98F83]/50'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isSelected ? 'bg-[#F8E8E3] text-[#E98F83]' : 'bg-[#F8F5EF] dark:bg-[#0E1722] text-[#788394]'
              }`}>
                <Icon size={16} />
              </div>
              <span className="text-xs">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. COMPACT ORGAN SUMMARY */}
      <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <OrganTag organType={activeOrgan.organType} size="md" />
          <div>
            <span className="font-bold text-[#243B55] dark:text-white text-sm">
              Organ Ref: {activeOrgan.id}
            </span>
            <span className="text-[#788394] dark:text-[#94A3B8] block">
              Donor {activeOrgan.donorCode} · Blood {activeOrgan.bloodGroup} · {activeOrgan.donationType}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-[#788394] dark:text-[#94A3B8]">
          <div>
            <span className="block text-[11px]">Location</span>
            <span className="font-semibold text-[#243B55] dark:text-white">{activeOrgan.hospitalName}</span>
          </div>
          <div>
            <span className="block text-[11px]">Preservation Window</span>
            <span className="font-semibold text-[#243B55] dark:text-white">{activeOrgan.preservationWindowHours}h (illustrative)</span>
          </div>
        </div>
      </div>

      {/* 4. CANDIDATES REQUIRING REVIEW (LEVEL 1: Clean, Scannable Cards) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#243B55] dark:text-white">
            Candidates requiring review
          </h2>
          <span className="text-xs text-[#788394] dark:text-[#94A3B8]">
            {activeMatchRun.candidates.length} recommended candidate{activeMatchRun.candidates.length !== 1 ? 's' : ''}
          </span>
        </div>

        {activeMatchRun.candidates.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-[#152232] rounded-2xl border border-dashed border-[#EFE7DE] dark:border-[#273A52] text-xs text-[#788394]">
            No eligible candidates waiting for this organ type under active clinical rules.
          </div>
        ) : (
          <div className="space-y-3">
            {activeMatchRun.candidates.map((cand) => (
              <div
                key={cand.recipientId}
                className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] hover:border-[#E98F83] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
              >
                {/* Level 1 Summary */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83]">
                      Rank #{cand.rank}
                    </span>
                    <h3 className="text-sm font-bold text-[#243B55] dark:text-white">
                      {cand.recipientCode}
                    </h3>
                    <span className="text-xs text-[#788394]">
                      · Blood {cand.bloodGroup} · Age {cand.age}
                    </span>
                  </div>

                  <p className="text-xs text-[#788394] dark:text-[#94A3B8]">
                    {cand.hospitalName} · {cand.distanceKm} km transit corridor · {cand.waitlistDays} days on waitlist
                  </p>

                  <div className="text-[11px] text-[#A9BBA8] font-medium flex items-center gap-1.5 pt-0.5">
                    <CheckCircle2 size={13} className="text-[#A9BBA8]" />
                    <span>Compatible pairing · High clinical recommendation score ({cand.finalScore}/100)</span>
                  </div>
                </div>

                {/* Level 1 Action */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedCandidate(cand)}
                    className="px-4 py-2 text-xs font-semibold bg-[#F8F5EF] dark:bg-[#1E2E40] text-[#243B55] dark:text-white hover:bg-[#E98F83] hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>View Details</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EXCLUDED CANDIDATES (Clean Accordion per Part 4) */}
      {activeMatchRun.excludedCandidates.length > 0 && (
        <div className="bg-[#F8F5EF]/60 dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#788394] dark:text-[#94A3B8]">
              Excluded from this run ({activeMatchRun.excludedCandidates.length})
            </h3>
            <span className="text-[11px] text-[#788394]">
              Held for missing documents or blood group incompatibility
            </span>
          </div>

          <div className="space-y-2">
            {activeMatchRun.excludedCandidates.map(ex => (
              <div
                key={ex.recipientId}
                className="p-3 bg-white dark:bg-[#111A26] rounded-xl border border-[#EFE7DE] dark:border-[#273A52] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-[#243B55] dark:text-white mr-2">
                    {ex.recipientCode}
                  </span>
                  <span className="text-[#788394]">
                    {ex.exclusionReason}
                  </span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 shrink-0 self-start sm:self-auto">
                  Verification Required
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LEVEL 2 & 3: PROGRESSIVE DISCLOSURE EXPANDABLE DETAIL DRAWER */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="relative w-full max-w-xl bg-white dark:bg-[#152232] border-l border-[#EFE7DE] dark:border-[#273A52] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#EFE7DE] dark:border-[#273A52] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E98F83]">
                  Level 2 & 3 Clinical Details
                </span>
                <h3 className="text-lg font-bold text-[#243B55] dark:text-white">
                  Matching Explanation: {selectedCandidate.recipientCode}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="p-2 rounded-xl text-[#788394] hover:bg-[#F8F5EF] dark:hover:bg-[#1E2E40] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Synthetic Notice */}
              <div className="p-3 bg-[#F8E8E3] dark:bg-[#2C1C1A] rounded-xl text-xs text-[#E98F83] font-medium flex items-center gap-2">
                <Info size={15} className="shrink-0" />
                <span>Illustrative demonstration configuration. Not an official clinical rule.</span>
              </div>

              {/* Overall Score */}
              <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#788394] block">Composite Recommendation Score</span>
                  <span className="text-2xl font-bold font-mono text-[#243B55] dark:text-white">
                    {selectedCandidate.finalScore} / 100
                  </span>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#E98F83] text-white">
                  Rank #{selectedCandidate.rank}
                </span>
              </div>

              {/* Individual Factor Contributions (Level 3) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#243B55] dark:text-white">
                  Factor Contributions
                </h4>
                <div className="space-y-2.5 text-xs">
                  {selectedCandidate.factors.map(f => (
                    <div key={f.factorName} className="p-3 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-[#243B55] dark:text-white">{f.factorName}</span>
                        <span className="font-mono font-bold">{f.score.toFixed(1)} / {f.maxScore} pts</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#F8F5EF] dark:bg-[#1E2E40] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#E98F83] rounded-full"
                          style={{ width: `${(f.score / f.maxScore) * 100}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-[#788394] leading-relaxed pt-0.5">
                        {f.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Initial Eligibility Checks */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#243B55] dark:text-white">
                  Initial Eligibility Checks
                </h4>
                <div className="space-y-2 text-xs">
                  {selectedCandidate.eligibilityChecks.map(check => (
                    <div key={check.ruleName} className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52]">
                      <span className="font-medium text-[#243B55] dark:text-white">{check.ruleName}</span>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Passed
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Configuration & Ruleset Version (Level 3) */}
              <div className="p-3.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF]/50 dark:bg-[#111A26] text-[11px] text-[#788394] space-y-1 font-mono">
                <div>Ruleset: {activeConfig.rulesetVersion} (v{activeConfig.configVersion})</div>
                <div className="truncate">Config Hash: {activeConfig.configHash}</div>
              </div>
            </div>

            {/* Drawer Actions */}
            <div className="p-4 border-t border-[#EFE7DE] dark:border-[#273A52] flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setSelectedCandidate(null);
                  setActiveView('simulator');
                }}
                className="px-3.5 py-2 text-xs font-semibold text-[#788394] hover:text-[#243B55] dark:hover:text-white transition-colors cursor-pointer"
              >
                Compare in Scenario Lab
              </button>

              <button
                onClick={() => {
                  setSelectedCandidate(null);
                  setActiveView('approval');
                }}
                className="px-5 py-2.5 text-xs font-semibold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Proceed to Review & Decision</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
