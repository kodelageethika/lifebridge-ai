import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { OrganType } from '../../types/index.ts';
import { apiRequest } from '../../services/api.ts';
import { AiInsightPanel } from '../common/AiInsightPanel.tsx';
import {
  Users,
  Download,
  AlertCircle,
  Shield,
  MapPin,
} from 'lucide-react';

interface AiFairnessInsightsResult {
  organType: string;
  overallAssessment: string;
  equityHighlights: string[];
  suppressedCohortNote: string;
  recommendedMonitoringActions: string[];
  disclaimer: string;
  model: string;
}

export const FairnessMetricsView: React.FC = () => {
  const { fairnessMetrics } = useApp();
  const [selectedOrgan, setSelectedOrgan] = useState<OrganType>('kidney');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<AiFairnessInsightsResult | null>(null);

  const activeMetric =
    fairnessMetrics.find(f => f.organType === selectedOrgan) || fairnessMetrics[0];

  if (!activeMetric) {
    return (
      <div className="p-8 text-center bg-white dark:bg-[#152232] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] text-xs text-[#788394]">
        Fairness cohort statistics loading...
      </div>
    );
  }

  const handleExportCsv = () => {
    let csv = `LifeBridge AI Fairness & Demographic Parity Audit Report\nOrgan Type: ${activeMetric.organType.toUpperCase()}\n\n`;
    csv += `Subgroup,Candidate Count,Allocation Share (%),Avg Waitlist (Days)\n`;
    activeMetric.subgroups.forEach(sg => {
      csv += `"${sg.groupName}",${sg.isSuppressed ? '[SUPPRESSED < 20]' : sg.candidateCount},${sg.allocationPercent}%,${sg.avgWaitlistDays}\n`;
    });
    csv += `\nRegional Equity\nRegion,Registrations Share (%),Allocations Share (%)\n`;
    activeMetric.regionalParity.forEach(rp => {
      csv += `"${rp.regionName}",${rp.shareOfRegistrations}%,${rp.shareOfAllocations}%\n`;
    });

    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `lifebridge_fairness_audit_${activeMetric.organType}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-[#243B55] dark:text-white">
              Fairness & Demographic Parity Monitoring
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F8E8E3] text-[#243B55] border border-[#EFE7DE] dark:bg-[#203247] dark:text-white">
              Demographic Equity
            </span>
          </div>
          <p className="text-xs text-[#788394] dark:text-[#94A3B8]">
            Subgroup equity analysis, small-sample privacy suppression, and regional parity tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedOrgan}
            onChange={e => setSelectedOrgan(e.target.value as OrganType)}
            className="text-xs font-semibold bg-[#FAF6F0] dark:bg-[#0E1722] border border-[#EFE7DE] dark:border-[#203247] rounded-xl px-3 py-1.5 text-[#243B55] dark:text-white capitalize outline-none"
          >
            {(['kidney', 'liver', 'heart', 'lung', 'pancreas', 'intestine'] as OrganType[]).map(o => (
              <option key={o} value={o}>
                {o} Audit
              </option>
            ))}
          </select>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-1.5 text-xs font-semibold bg-[#E98F83] hover:bg-[#D97D71] text-white rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.99]"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Methodology */}
      <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1.5 leading-relaxed">
        <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
          <AlertCircle size={15} />
          <span>Methodology & Non-Discrimination Guardrails:</span>
        </div>
        <p>
          Protected demographic attributes (gender, caste, religion, wealth, or geographic status) are NEVER included as ranking factors, bonuses, or penalties. Subgroups with sample sizes below 20 are systematically suppressed to prevent re-identification risks.
        </p>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#152232] p-4 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <span className="text-xs text-[#788394] dark:text-[#94A3B8] block mb-1">Evaluated Cohort</span>
          <div className="text-2xl font-black font-mono text-[#243B55] dark:text-white tabular-nums">
            {activeMetric.totalEvaluated}
          </div>
          <span className="text-[10px] text-[#788394]">Registered Candidates</span>
        </div>

        <div className="bg-white dark:bg-[#152232] p-4 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <span className="text-xs text-[#788394] dark:text-[#94A3B8] block mb-1">Transplants Completed</span>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
            {activeMetric.totalTransplanted}
          </div>
          <span className="text-[10px] text-[#788394]">Human-authorized</span>
        </div>

        <div className="bg-white dark:bg-[#152232] p-4 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <span className="text-xs text-[#788394] dark:text-[#94A3B8] block mb-1">Average Waitlist Time</span>
          <div className="text-2xl font-black font-mono text-[#E98F83] dark:text-[#FF8A8A] tabular-nums">
            {activeMetric.avgWaitlistDays}d
          </div>
          <span className="text-[10px] text-[#788394]">Mean registered duration</span>
        </div>

        <div className="bg-white dark:bg-[#152232] p-4 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <span className="text-xs text-[#788394] dark:text-[#94A3B8] block mb-1">Offer Acceptance Rate</span>
          <div className="text-2xl font-black font-mono text-[#243B55] dark:text-white tabular-nums">
            {activeMetric.acceptanceRate}%
          </div>
          <span className="text-[10px] text-[#788394]">Clinical team acceptance</span>
        </div>
      </div>

      {/* Demographic Subgroup Parity Table */}
      <div className="bg-white dark:bg-[#152232] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#EFE7DE] dark:border-[#203247] flex items-center justify-between bg-[#FAF6F0] dark:bg-[#152232]">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#E98F83]" />
            <h3 className="text-sm font-bold text-[#243B55] dark:text-white">
              Demographic Subgroup Allocation Share & Waitlist Parity
            </h3>
          </div>
          <span className="text-xs text-[#788394] dark:text-[#94A3B8] flex items-center gap-1">
            <Shield size={13} className="text-emerald-500" />
            <span>Privacy Suppression Active (n &lt; 20)</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FAF6F0] dark:bg-[#111A26] border-b border-[#EFE7DE] dark:border-[#203247] text-[#788394] dark:text-[#94A3B8]">
              <tr>
                <th className="py-3 px-4 font-semibold">Subgroup Identifier</th>
                <th className="py-3 px-4 font-semibold text-right">Cohort Size</th>
                <th className="py-3 px-4 font-semibold text-right">Allocation Share</th>
                <th className="py-3 px-4 font-semibold text-right">Avg Wait Duration</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE7DE] dark:divide-[#203247]">
              {activeMetric.subgroups.map((sg, idx) => (
                <tr key={idx} className="hover:bg-[#FDFBF7] dark:hover:bg-[#1A2636] transition-colors">
                  <td className="py-3 px-4 font-semibold text-[#243B55] dark:text-white">{sg.groupName}</td>
                  <td className="py-3 px-4 font-mono text-right tabular-nums">
                    {sg.isSuppressed ? (
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded">
                        Suppressed (n &lt; 20)
                      </span>
                    ) : (
                      sg.candidateCount
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-right tabular-nums text-[#E98F83] dark:text-[#FF8A8A]">
                    {sg.allocationPercent}%
                  </td>
                  <td className="py-3 px-4 font-mono text-right tabular-nums">{sg.avgWaitlistDays} days</td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                      Normal Parity
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regional Parity */}
      <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-[#243B55] dark:text-white flex items-center gap-2">
          <MapPin size={16} className="text-[#E98F83]" />
          <span>Regional Parity (Registrations vs. Allocations)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {activeMetric.regionalParity.map((rp, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-[#FDFBF7] dark:bg-[#111A26] rounded-xl border border-[#EFE7DE] dark:border-[#203247] space-y-2"
            >
              <span className="font-bold text-[#243B55] dark:text-white block">{rp.regionName}</span>
              <div className="flex justify-between text-[#788394] dark:text-[#94A3B8]">
                <span>Share of Waitlist:</span>
                <span className="font-mono font-semibold text-[#243B55] dark:text-white">
                  {rp.shareOfRegistrations}%
                </span>
              </div>
              <div className="flex justify-between text-[#788394] dark:text-[#94A3B8]">
                <span>Share of Allocations:</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {rp.shareOfAllocations}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#FAF6F0] dark:bg-[#1E2E40] rounded-full overflow-hidden">
                <div className="h-full bg-[#E98F83] rounded-full" style={{ width: `${rp.shareOfAllocations}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Gemini AI Equity Insights (Respecting Privacy Suppression) */}
      <AiInsightPanel
        title="Gemini AI Fairness & Equity Insights"
        subtitle="Non-authoritative narrative interpretation respecting n < 20 privacy suppression."
        buttonLabel="Generate Equity Insights"
        isLoading={aiLoading}
        error={aiError}
        onGenerate={async () => {
          if (aiLoading) return;
          setAiLoading(true);
          setAiError(null);
          try {
            const res = await apiRequest<AiFairnessInsightsResult>('/api/v1/ai/fairness-insights', {
              method: 'POST',
              body: { organType: selectedOrgan },
            });
            setAiInsights(res);
          } catch (err) {
            setAiError(err instanceof Error ? err.message : 'Unable to generate fairness insights');
          } finally {
            setAiLoading(false);
          }
        }}
      >
        {aiInsights && aiInsights.organType === selectedOrgan && (
          <div className="space-y-3 pt-2 border-t border-[#EFE7DE] dark:border-[#273A52] text-xs">
            <p className="text-[#243B55] dark:text-white leading-relaxed">{aiInsights.overallAssessment}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#FDFBF7] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#203247] space-y-1">
                <span className="font-bold text-[#243B55] dark:text-white block">Equity Highlights</span>
                <ul className="list-disc pl-4 space-y-1 text-[#788394]">
                  {aiInsights.equityHighlights.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="p-3 rounded-xl bg-[#FDFBF7] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#203247] space-y-1">
                <span className="font-bold text-[#243B55] dark:text-white block">Monitoring Actions</span>
                <ul className="list-disc pl-4 space-y-1 text-[#788394]">
                  {aiInsights.recommendedMonitoringActions.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/50">
              {aiInsights.suppressedCohortNote}
            </p>
            <div className="text-[10px] text-[#788394] flex justify-between">
              <span>{aiInsights.disclaimer}</span>
              <span className="font-mono">{aiInsights.model}</span>
            </div>
          </div>
        )}
      </AiInsightPanel>
    </div>
  );
};
