import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { OrganType, MatchCandidate } from '../../types/index.ts';
import { apiRequest } from '../../services/api.ts';
import { OrganTag } from '../common/OrganTag.tsx';
import { AiInsightPanel } from '../common/AiInsightPanel.tsx';
import {
  Sparkles,
  CheckCircle2,
  X,
  ArrowRight,
  ChevronRight,
  Activity,
  Droplet,
  Heart,
  Wind,
  Shield,
  Eye,
  Info,
  ShieldCheck,
} from 'lucide-react';

interface AiMatchExplanationResult {
  organId: string;
  matchRunId: string;
  executiveSummary: string;
  factorBreakdownNarrative: string[];
  exclusionOverview: string;
  clinicalReviewReminders: string[];
  disclaimer: string;
  model: string;
}

export const ExplainableMatchingView: React.FC = () => {
  const {
    organs,
    organConfigs,
    matchRuns,
    dataQualityIssues,
    currentUserRole,
    runDeterministicMatch,
    resolveDataQualityIssue,
    setActiveView,
    setSelectedOrganFilter,
  } = useApp();

  const [selectedOrganId, setSelectedOrganId] = useState<string>(() => organs[0]?.id || 'ORG-K704');
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [selectedCandidate, setSelectedCandidate] = useState<MatchCandidate | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<AiMatchExplanationResult | null>(null);

  const activeOrgan = organs.find(o => o.id === selectedOrganId) || organs[0];
  const activeConfig =
    organConfigs.find(c => c.organType === activeOrgan?.organType) || organConfigs[0];
  const organRuns = matchRuns.filter(m => m.organId === activeOrgan?.id);
  const activeMatchRun =
    organRuns.find(m => m.id === selectedRunId) ||
    organRuns[0] ||
    matchRuns.find(m => m.organType === activeOrgan?.organType) ||
    matchRuns[0];

  const organButtons: { type: OrganType; label: string; icon: React.ElementType }[] = [
    { type: 'kidney', label: 'Kidney', icon: Activity },
    { type: 'liver', label: 'Liver', icon: Droplet },
    { type: 'heart', label: 'Heart', icon: Heart },
    { type: 'lung', label: 'Lung', icon: Wind },
    { type: 'pancreas', label: 'Pancreas', icon: Shield },
    { type: 'intestine', label: 'Intestine', icon: Eye },
  ];

  const canResolveQuality =
    currentUserRole === 'coordinator' || currentUserRole === 'hospital' || currentUserRole === 'admin';

  const handleOrganSelect = (type: OrganType) => {
    setSelectedOrganFilter(type);
    const organ = organs.find(o => o.organType === type);
    if (organ) {
      setSelectedOrganId(organ.id);
      setSelectedRunId('');
    }
  };

  if (!activeOrgan) {
    return (
      <div className="max-w-5xl mx-auto py-8 text-center bg-white dark:bg-[#152232] p-8 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52]">
        <p className="text-sm font-semibold text-[#243B55] dark:text-white">No organs currently available in active registry.</p>
      </div>
    );
  }

  const handleExplainMatch = async () => {
    if (!activeOrgan || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await apiRequest<AiMatchExplanationResult>('/api/v1/ai/matching-explanation', {
        method: 'POST',
        body: {
          organId: activeOrgan.id,
          ...(activeMatchRun ? { matchRunId: activeMatchRun.id } : {}),
        },
      });
      setAiExplanation(res);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to generate AI matching explanation');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      {/* Header */}
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

      {/* Organ Selection Buttons */}
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
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isSelected ? 'bg-[#F8E8E3] text-[#E98F83]' : 'bg-[#F8F5EF] dark:bg-[#0E1722] text-[#788394]'
                }`}
              >
                <Icon size={16} />
              </div>
              <span className="text-xs">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Organ Summary */}
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

        <div className="flex flex-wrap items-center gap-6 text-[#788394] dark:text-[#94A3B8]">
          {organRuns.length > 1 && (
            <div>
              <label className="block text-[11px]">Run History</label>
              <select
                value={activeMatchRun?.id || ''}
                onChange={e => setSelectedRunId(e.target.value)}
                className="font-semibold text-[#243B55] dark:text-white bg-[#F8F5EF] dark:bg-[#0E1722] px-2 py-1 rounded-lg border border-[#EFE7DE] dark:border-[#273A52]"
              >
                {organRuns.map(run => (
                  <option key={run.id} value={run.id}>
                    {run.id} ({new Date(run.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </option>
                ))}
              </select>
            </div>
          )}
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

      {/* Gemini AI Match Explanation Panel */}
      {activeMatchRun && (
        <AiInsightPanel
          title="Gemini AI Match Explanation"
          subtitle="Plain-language explanation of deterministic factor weights and exclusions."
          buttonLabel="Explain Match with Gemini AI"
          isLoading={aiLoading}
          error={aiError}
          onGenerate={handleExplainMatch}
        >
          {aiExplanation && aiExplanation.organId === activeOrgan.id && (
            <div className="space-y-3 pt-2 border-t border-[#EFE7DE] dark:border-[#273A52] text-xs">
              <p className="text-[#243B55] dark:text-white leading-relaxed">{aiExplanation.executiveSummary}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] space-y-1.5">
                  <span className="font-bold text-[#243B55] dark:text-white block">Factor Breakdown Narrative</span>
                  <ul className="list-disc pl-4 space-y-1 text-[#788394] dark:text-[#94A3B8]">
                    {aiExplanation.factorBreakdownNarrative.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 rounded-xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] space-y-1.5">
                  <span className="font-bold text-[#243B55] dark:text-white block">Clinical Review Reminders</span>
                  <ul className="list-disc pl-4 space-y-1 text-[#788394] dark:text-[#94A3B8]">
                    {aiExplanation.clinicalReviewReminders.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="text-[11px] text-[#788394] italic">{aiExplanation.exclusionOverview}</p>
              <div className="text-[10px] text-[#788394] flex justify-between">
                <span>{aiExplanation.disclaimer}</span>
                <span className="font-mono">{aiExplanation.model}</span>
              </div>
            </div>
          )}
        </AiInsightPanel>
      )}

      {/* Candidates Requiring Review */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#243B55] dark:text-white">
            Candidates requiring review
          </h2>
          <span className="text-xs text-[#788394] dark:text-[#94A3B8]">
            {activeMatchRun?.candidates.length || 0} recommended candidate{(activeMatchRun?.candidates.length || 0) !== 1 ? 's' : ''}
          </span>
        </div>

        {!activeMatchRun || activeMatchRun.candidates.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-[#152232] rounded-2xl border border-dashed border-[#EFE7DE] dark:border-[#273A52] text-xs text-[#788394]">
            No match run persisted yet or no eligible candidates found under active clinical rules. Click "Refresh Potential Matches" above.
          </div>
        ) : (
          <div className="space-y-3">
            {activeMatchRun.candidates.map(cand => (
              <div
                key={cand.recipientId}
                className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] hover:border-[#E98F83] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
              >
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

      {/* Excluded Candidates */}
      {activeMatchRun && activeMatchRun.excludedCandidates.length > 0 && (
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
            {activeMatchRun.excludedCandidates.map(ex => {
              const matchingIssue = dataQualityIssues.find(
                i => !i.isResolved && i.entityId === ex.recipientId
              );
              return (
                <div
                  key={ex.recipientId}
                  className="p-3 bg-white dark:bg-[#111A26] rounded-xl border border-[#EFE7DE] dark:border-[#273A52] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-bold text-[#243B55] dark:text-white mr-2">
                      {ex.recipientCode}
                    </span>
                    <span className="text-[#788394]">{ex.exclusionReason}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    {matchingIssue && canResolveQuality ? (
                      <button
                        onClick={() => resolveDataQualityIssue(matchingIssue.id)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-[#E98F83] hover:bg-[#D87B6F] text-white flex items-center gap-1 cursor-pointer"
                      >
                        <ShieldCheck size={11} />
                        <span>Verify & Resolve Hold</span>
                      </button>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                        Excluded
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="relative w-full max-w-xl bg-white dark:bg-[#152232] border-l border-[#EFE7DE] dark:border-[#273A52] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
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

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div className="p-3 bg-[#F8E8E3] dark:bg-[#2C1C1A] rounded-xl text-xs text-[#E98F83] font-medium flex items-center gap-2">
                <Info size={15} className="shrink-0" />
                <span>Illustrative demonstration configuration. Not an official clinical rule.</span>
              </div>

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

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#243B55] dark:text-white">
                  Factor Contributions
                </h4>
                <div className="space-y-2.5 text-xs">
                  {selectedCandidate.factors.map(f => (
                    <div key={f.factorName} className="p-3 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-[#243B55] dark:text-white">{f.factorName}</span>
                        <span className="font-mono font-bold">
                          {f.score.toFixed(1)} / {f.maxScore} pts
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#F8F5EF] dark:bg-[#1E2E40] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#E98F83] rounded-full"
                          style={{ width: `${Math.min(100, (f.score / (f.maxScore || 1)) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-[#788394] leading-relaxed pt-0.5">{f.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#243B55] dark:text-white">
                  Initial Eligibility Checks
                </h4>
                <div className="space-y-2 text-xs">
                  {selectedCandidate.eligibilityChecks.map(check => (
                    <div
                      key={check.ruleName}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52]"
                    >
                      <span className="font-medium text-[#243B55] dark:text-white">{check.ruleName}</span>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Passed
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {activeConfig && (
                <div className="p-3.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF]/50 dark:bg-[#111A26] text-[11px] text-[#788394] space-y-1 font-mono">
                  <div>
                    Ruleset: {activeConfig.rulesetVersion} (v{activeConfig.configVersion})
                  </div>
                  <div className="truncate">Config Hash: {activeConfig.configHash}</div>
                </div>
              )}
            </div>

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
