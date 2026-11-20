import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { OrganTag } from '../common/OrganTag.tsx';
import { AiInsightPanel } from '../common/AiInsightPanel.tsx';
import { apiRequest } from '../../services/api.ts';
import {
  CheckCircle2,
  UserCheck,
  ArrowRight,
} from 'lucide-react';

interface AiClinicalSummaryResult {
  caseId: string;
  caseNumber: string;
  reviewBadge: string;
  caseBrief: string;
  safeguardChecklistSummary: string[];
  recommendedHumanActions: string[];
  disclaimer: string;
  model: string;
}

export const ApprovalWorkflowView: React.FC = () => {
  const {
    workflowCases,
    recipients,
    submitApprovalDecision,
    transitionWorkflowState,
    currentUserRole,
    currentUserName,
  } = useApp();
  const { openAuthModal } = useAuth();

  const [filterTab, setFilterTab] = useState<'all' | 'coordinator' | 'medical' | 'approved' | 'escalated'>('all');
  const [selectedCaseId, setSelectedCaseId] = useState<string>(() => workflowCases[0]?.id || 'CASE-2026-001');

  const activeCase = workflowCases.find(c => c.id === selectedCaseId) || workflowCases[0];

  const [decisionType, setDecisionType] = useState<'STANDARD_APPROVAL' | 'CLINICAL_OVERRIDE' | 'REJECTION'>('STANDARD_APPROVAL');
  const [overrideRecipientId, setOverrideRecipientId] = useState<string>('');
  const [decisionReason, setDecisionReason] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<AiClinicalSummaryResult | null>(null);

  const availableOverrideRecipients = recipients.filter(
    r => r.organType === activeCase?.organType && r.status === 'ACTIVE' && r.id !== activeCase?.selectedRecipientId
  );
  const resolvedOverrideId =
    overrideRecipientId && availableOverrideRecipients.some(r => r.id === overrideRecipientId)
      ? overrideRecipientId
      : availableOverrideRecipients[0]?.id || '';

  const filteredCases = workflowCases.filter(c => {
    if (filterTab === 'coordinator') return c.currentState === 'COORDINATOR_REVIEW' || c.currentState === 'ORGAN_REGISTERED';
    if (filterTab === 'medical') return c.currentState === 'MEDICAL_REVIEW';
    if (filterTab === 'approved') return c.currentState === 'AUTHORIZED_DECISION' || c.currentState === 'TRANSPORT_APPROVED' || c.currentState === 'TRANSPLANT_COMPLETED';
    if (filterTab === 'escalated') return c.currentState === 'ESCALATED' || c.currentState === 'REJECTED' || c.currentState === 'NEEDS_VERIFICATION';
    return true;
  });

  const canSurgeonSign = currentUserRole === 'medical' || currentUserRole === 'admin';
  const canCoordinatorTransition =
    currentUserRole === 'coordinator' || currentUserRole === 'hospital' || currentUserRole === 'admin';

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase) return;
    const targetRecipient =
      decisionType === 'CLINICAL_OVERRIDE'
        ? resolvedOverrideId
        : activeCase.selectedRecipientId || recipients.find(r => r.organType === activeCase.organType)?.id || '';
    const ok = await submitApprovalDecision(activeCase.id, decisionType, targetRecipient, decisionReason);
    if (ok) {
      setDecisionReason('');
    }
  };

  if (!activeCase) {
    return (
      <div className="max-w-5xl mx-auto py-8 text-center bg-white dark:bg-[#152232] p-8 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52]">
        <p className="text-sm font-semibold text-[#243B55] dark:text-white">No workflow cases available yet.</p>
        <p className="text-xs text-[#788394] mt-1">Run deterministic matching on a retrieved organ to create a case.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243B55] dark:text-white">
            Reviews & Decisions
          </h1>
          <p className="text-sm text-[#788394] dark:text-[#94A3B8] mt-1">
            Human-in-the-loop authorization, clinical reviews, and override governance.
          </p>
        </div>

        {/* Separation of Duties Badge */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#788394]">Active Reviewer:</span>
          <span className="font-semibold text-[#243B55] dark:text-white bg-white dark:bg-[#152232] px-3 py-1.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52]">
            {currentUserName} ({currentUserRole})
          </span>
          {!canSurgeonSign && (
            <button
              onClick={() => openAuthModal('signin')}
              className="text-xs font-semibold text-[#E98F83] hover:underline cursor-pointer"
            >
              (Sign in as Surgeon)
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-[#F8F5EF] dark:bg-[#121D2A] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] text-xs">
        {[
          { id: 'all', label: 'All Cases', count: workflowCases.length },
          { id: 'coordinator', label: 'Waiting for Review', count: workflowCases.filter(c => c.currentState === 'COORDINATOR_REVIEW' || c.currentState === 'ORGAN_REGISTERED').length },
          { id: 'medical', label: 'Medical Reviews Pending', count: workflowCases.filter(c => c.currentState === 'MEDICAL_REVIEW').length },
          { id: 'approved', label: 'Approved Cases', count: workflowCases.filter(c => c.currentState === 'AUTHORIZED_DECISION' || c.currentState === 'TRANSPORT_APPROVED' || c.currentState === 'TRANSPLANT_COMPLETED').length },
          { id: 'escalated', label: 'Escalated / Action Required', count: workflowCases.filter(c => c.currentState === 'ESCALATED' || c.currentState === 'REJECTED' || c.currentState === 'NEEDS_VERIFICATION').length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterTab === tab.id
                ? 'bg-white dark:bg-[#152232] text-[#243B55] dark:text-white shadow-xs font-bold'
                : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white'
            }`}
          >
            <span>{tab.label}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#EFE7DE] dark:bg-[#203247]">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Queue */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#788394] dark:text-[#94A3B8] block">
            Select Case to Review
          </span>

          <div className="space-y-2">
            {filteredCases.map(c => {
              const isSelected = activeCase?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCaseId(c.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-white dark:bg-[#1E2E40] border-[#E98F83] shadow-xs ring-1 ring-[#E98F83]/30'
                      : 'bg-white dark:bg-[#152232] border-[#EFE7DE] dark:border-[#273A52] hover:border-[#E98F83]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <OrganTag organType={c.organType} size="sm" />
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        c.currentState === 'ESCALATED' || c.currentState === 'REJECTED'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83]'
                      }`}
                    >
                      {c.currentState.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="text-xs font-bold font-mono text-[#243B55] dark:text-white">
                    {c.caseNumber}
                  </div>

                  <div className="text-[11px] text-[#788394]">
                    Candidate:{' '}
                    <span className="font-semibold text-[#243B55] dark:text-white">
                      {c.selectedRecipientCode || 'Unassigned'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Detail & Actions */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs space-y-6">
            {/* Case Summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EFE7DE] dark:border-[#273A52]">
              <div>
                <div className="flex items-center gap-2">
                  <OrganTag organType={activeCase.organType} size="md" />
                  <h3 className="text-lg font-bold font-mono text-[#243B55] dark:text-white">
                    {activeCase.caseNumber}
                  </h3>
                </div>
                <span className="text-xs text-[#788394] block mt-0.5">
                  Organ ID: {activeCase.organId} · Donor: {activeCase.donorCode}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-[#788394] block">Stage</span>
                <span className="text-xs font-bold text-[#E98F83]">
                  {activeCase.currentState.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Workflow Coordination Actions */}
            {canCoordinatorTransition && (
              <div className="flex flex-wrap items-center gap-2.5 p-3.5 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52]">
                <span className="text-xs font-bold text-[#243B55] dark:text-white mr-auto">
                  Coordinator Progression:
                </span>
                {activeCase.currentState === 'COORDINATOR_REVIEW' && (
                  <button
                    type="button"
                    onClick={() =>
                      transitionWorkflowState(
                        activeCase.id,
                        'MEDICAL_REVIEW',
                        'Coordinator verified hospital readiness & recipient availability'
                      )
                    }
                    className="px-3.5 py-1.5 text-xs font-semibold bg-[#243B55] hover:bg-[#1B2D42] text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Forward to Medical Review</span>
                    <ArrowRight size={13} />
                  </button>
                )}
                {activeCase.currentState === 'AUTHORIZED_DECISION' && (
                  <button
                    type="button"
                    onClick={() =>
                      transitionWorkflowState(
                        activeCase.id,
                        'TRANSPORT_APPROVED',
                        'Corridor cleared & transport team dispatched'
                      )
                    }
                    className="px-3.5 py-1.5 text-xs font-semibold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Approve Transport Corridor</span>
                    <ArrowRight size={13} />
                  </button>
                )}
                {activeCase.currentState === 'TRANSPORT_APPROVED' && (
                  <button
                    type="button"
                    onClick={() =>
                      transitionWorkflowState(
                        activeCase.id,
                        'TRANSPLANT_COMPLETED',
                        'Receiving surgical suite confirmed organ handover & completion'
                      )
                    }
                    className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Mark Transplant Completed</span>
                    <CheckCircle2 size={13} />
                  </button>
                )}
                {!['COORDINATOR_REVIEW', 'AUTHORIZED_DECISION', 'TRANSPORT_APPROVED'].includes(activeCase.currentState) && (
                  <span className="text-[11px] text-[#788394]">
                    Current stage: {activeCase.currentState.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            )}

            {/* AI Recommendation & Coordinator Review */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] space-y-1">
                <span className="font-bold text-[#243B55] dark:text-white block">
                  AI Recommendation Summary
                </span>
                <p className="text-[#788394] leading-relaxed">
                  Recommended Candidate:{' '}
                  <span className="font-semibold text-[#243B55] dark:text-white">
                    {activeCase.selectedRecipientCode || 'Pending Selection'}
                  </span>
                  . Verified blood group compatibility and clinical urgency score.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] space-y-1">
                <span className="font-bold text-[#243B55] dark:text-white block">
                  Coordinator Verification
                </span>
                <p className="text-[#788394] leading-relaxed">
                  {activeCase.coordinatorReviewer
                    ? `Reviewed by ${activeCase.coordinatorReviewer}. Surgical team standby & transit readiness verified.`
                    : 'Surgical team standby, ICU bed reservation, and transit corridor verified.'}
                </p>
              </div>
            </div>

            {/* Gemini AI Clinical Summary Draft */}
            <AiInsightPanel
              title="Clinical Documentation Draft (Gemini AI)"
              subtitle="Draft handover summary from persisted case safeguards and workflow history."
              buttonLabel="Draft Clinical Summary"
              advisoryBadge="Requires Qualified Medical Review"
              isLoading={aiLoading}
              error={aiError}
              onGenerate={async () => {
                if (aiLoading) return;
                setAiLoading(true);
                setAiError(null);
                try {
                  const res = await apiRequest<AiClinicalSummaryResult>('/api/v1/ai/clinical-summary', {
                    method: 'POST',
                    body: { caseId: activeCase.id },
                  });
                  setAiSummary(res);
                } catch (err) {
                  setAiError(err instanceof Error ? err.message : 'Unable to draft clinical summary');
                } finally {
                  setAiLoading(false);
                }
              }}
            >
              {aiSummary && aiSummary.caseId === activeCase.id && (
                <div className="space-y-2.5 pt-2 border-t border-[#EFE7DE] dark:border-[#273A52] text-xs">
                  <p className="text-[#243B55] dark:text-white leading-relaxed">{aiSummary.caseBrief}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52]">
                      <span className="font-bold text-[#243B55] dark:text-white block mb-1">Safeguard Summary</span>
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-[#788394]">
                        {aiSummary.safeguardChecklistSummary.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52]">
                      <span className="font-bold text-[#243B55] dark:text-white block mb-1">Human Next Actions</span>
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-[#788394]">
                        {aiSummary.recommendedHumanActions.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#788394] flex justify-between">
                    <span>{aiSummary.disclaimer}</span>
                    <span className="font-mono">{aiSummary.model}</span>
                  </div>
                </div>
              )}
            </AiInsightPanel>

            {/* Required Clinical Safeguards */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#243B55] dark:text-white block">
                Required Clinical Safeguards
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>ABO Compatible</span>
                </div>
                <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>Crossmatch Verified</span>
                </div>
                <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>Surgical Team Ready</span>
                </div>
              </div>
            </div>

            {/* Surgeon Decision Form */}
            <form onSubmit={handleDecisionSubmit} className="space-y-4 pt-2 border-t border-[#EFE7DE] dark:border-[#273A52]">
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="decisionType"
                    checked={decisionType === 'STANDARD_APPROVAL'}
                    onChange={() => setDecisionType('STANDARD_APPROVAL')}
                    className="text-[#E98F83] focus:ring-[#E98F83]"
                  />
                  <span>Standard Approval</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="decisionType"
                    checked={decisionType === 'CLINICAL_OVERRIDE'}
                    onChange={() => setDecisionType('CLINICAL_OVERRIDE')}
                    className="text-[#E98F83] focus:ring-[#E98F83]"
                  />
                  <span className="text-[#E98F83]">Clinical Override</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="decisionType"
                    checked={decisionType === 'REJECTION'}
                    onChange={() => setDecisionType('REJECTION')}
                    className="text-[#E98F83] focus:ring-[#E98F83]"
                  />
                  <span className="text-rose-600">Reject Allocation</span>
                </label>
              </div>

              {decisionType === 'CLINICAL_OVERRIDE' && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-300 dark:border-amber-800 space-y-2 text-xs">
                  <span className="font-bold text-amber-900 dark:text-amber-200 block">
                    Select Alternate Candidate for Override:
                  </span>
                  <select
                    value={resolvedOverrideId}
                    onChange={e => setOverrideRecipientId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-[#152232] text-[#243B55] dark:text-white"
                  >
                    {availableOverrideRecipients.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.anonymizedCode} ({r.hospitalName} · Waitlist: {r.waitlistDays}d)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#243B55] dark:text-white mb-1">
                  Clinical Justification{' '}
                  {decisionType !== 'STANDARD_APPROVAL' && <span className="text-rose-600">* (Min 15 chars)</span>}:
                </label>
                <textarea
                  rows={2}
                  required
                  value={decisionReason}
                  onChange={e => setDecisionReason(e.target.value)}
                  placeholder={
                    decisionType === 'CLINICAL_OVERRIDE'
                      ? 'State medical contraindication for Rank #1 candidate or urgent clinical priority...'
                      : 'Confirmed crossmatch negative, patient stable, OR slot confirmed...'
                  }
                  className="w-full text-xs p-3 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#E98F83]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="text-[11px] text-[#788394]">
                  Authorized by:{' '}
                  <span className="font-semibold text-[#243B55] dark:text-white">{currentUserName}</span>
                </div>

                <button
                  type="submit"
                  disabled={!canSurgeonSign}
                  className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 ${
                    canSurgeonSign
                      ? 'bg-[#E98F83] hover:bg-[#D87B6F] text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 dark:bg-slate-800 cursor-not-allowed'
                  }`}
                >
                  <UserCheck size={14} />
                  <span>{canSurgeonSign ? 'Authorize & Sign Decision' : 'Surgeon Role Required'}</span>
                </button>
              </div>
            </form>

            {/* Approval History */}
            <div className="pt-4 border-t border-[#EFE7DE] dark:border-[#273A52] space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#788394] dark:text-[#94A3B8] block">
                Decision History
              </span>
              <div className="space-y-1.5 text-xs">
                {activeCase.history.map(h => (
                  <div
                    key={h.id}
                    className="p-2.5 rounded-xl bg-[#F8F5EF] dark:bg-[#111A26] flex items-center justify-between gap-2 text-[#788394]"
                  >
                    <div>
                      <span className="font-bold text-[#243B55] dark:text-white mr-2">
                        {h.toState.replace(/_/g, ' ')}
                      </span>
                      <span>{h.reason}</span>
                    </div>
                    <span className="font-mono text-[10px] shrink-0">
                      {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
