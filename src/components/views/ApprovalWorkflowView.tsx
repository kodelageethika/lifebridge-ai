import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { WorkflowState, UserRole } from '../../types/index.ts';
import { OrganTag } from '../common/OrganTag.tsx';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  UserCheck,
  FileText,
  XCircle,
  ArrowRight,
  Info
} from 'lucide-react';

export const ApprovalWorkflowView: React.FC = () => {
  const {
    workflowCases,
    recipients,
    submitApprovalDecision,
    transitionWorkflowState,
    currentUserRole,
    setCurrentUserRole,
    currentUserName,
    setActiveView,
  } = useApp();

  // Tab filter: Waiting for review, Medical pending, Approved, Rejected/Escalated
  const [filterTab, setFilterTab] = useState<'all' | 'coordinator' | 'medical' | 'approved' | 'escalated'>('all');

  const [selectedCaseId, setSelectedCaseId] = useState<string>(() => {
    return workflowCases[0]?.id || 'CASE-2026-001';
  });

  const activeCase = workflowCases.find(c => c.id === selectedCaseId) || workflowCases[0];

  // Decision form state
  const [decisionType, setDecisionType] = useState<'STANDARD_APPROVAL' | 'CLINICAL_OVERRIDE' | 'REJECTION'>('STANDARD_APPROVAL');
  const [overrideRecipientId, setOverrideRecipientId] = useState<string>(() => {
    return recipients.find(r => r.organType === activeCase?.organType && r.id !== activeCase?.selectedRecipientId)?.id || '';
  });
  const [decisionReason, setDecisionReason] = useState<string>('');

  const filteredCases = workflowCases.filter(c => {
    if (filterTab === 'coordinator') return c.currentState === 'COORDINATOR_REVIEW' || c.currentState === 'ORGAN_REGISTERED';
    if (filterTab === 'medical') return c.currentState === 'MEDICAL_REVIEW';
    if (filterTab === 'approved') return c.currentState === 'AUTHORIZED_DECISION' || c.currentState === 'TRANSPORT_APPROVED' || c.currentState === 'TRANSPLANT_COMPLETED';
    if (filterTab === 'escalated') return c.currentState === 'ESCALATED' || c.currentState === 'REJECTED' || c.currentState === 'NEEDS_VERIFICATION';
    return true;
  });

  const handleDecisionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetRecipient = decisionType === 'CLINICAL_OVERRIDE' ? overrideRecipientId : (activeCase.selectedRecipientId || '');
    submitApprovalDecision(activeCase.id, decisionType, targetRecipient, decisionReason);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      
      {/* 1. CLEAN HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243B55] dark:text-white">
            Reviews & Decisions
          </h1>
          <p className="text-sm text-[#788394] dark:text-[#94A3B8] mt-1">
            Human-in-the-loop authorization, clinical reviews, and override governance.
          </p>
        </div>

        {/* Separation of Duties Guidance Badge */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#788394]">Active Reviewer:</span>
          <span className="font-semibold text-[#243B55] dark:text-white bg-white dark:bg-[#152232] px-3 py-1.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52]">
            {currentUserRole === 'medical' ? 'Transplant Surgeon' : 'Transplant Coordinator'}
          </span>
          {currentUserRole !== 'medical' && (
            <button
              onClick={() => setCurrentUserRole('medical')}
              className="text-xs font-semibold text-[#E98F83] hover:underline cursor-pointer"
            >
              (Switch to Surgeon)
            </button>
          )}
        </div>
      </div>

      {/* 2. CASE CATEGORY TABS (Part 4 Screen 3) */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-[#F8F5EF] dark:bg-[#121D2A] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] text-xs">
        {[
          { id: 'all', label: 'All Cases', count: workflowCases.length },
          { id: 'coordinator', label: 'Waiting for Review', count: workflowCases.filter(c => c.currentState === 'COORDINATOR_REVIEW').length },
          { id: 'medical', label: 'Medical Reviews Pending', count: workflowCases.filter(c => c.currentState === 'MEDICAL_REVIEW').length },
          { id: 'approved', label: 'Approved Cases', count: workflowCases.filter(c => c.currentState === 'AUTHORIZED_DECISION' || c.currentState === 'TRANSPORT_APPROVED').length },
          { id: 'escalated', label: 'Escalated / Action Required', count: workflowCases.filter(c => c.currentState === 'ESCALATED').length },
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

      {/* 3. TWO-COLUMN SPLIT: Case Queue on Left, Case Detail & Decision on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Case List */}
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
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      c.currentState === 'ESCALATED'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83]'
                    }`}>
                      {c.currentState.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="text-xs font-bold font-mono text-[#243B55] dark:text-white">
                    {c.caseNumber}
                  </div>

                  <div className="text-[11px] text-[#788394]">
                    Candidate: <span className="font-semibold text-[#243B55] dark:text-white">{c.selectedRecipientCode || 'Unassigned'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Focused Case Details & Decision Panel */}
        <div className="lg:col-span-2 space-y-5">
          {activeCase && (
            <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs space-y-6">
              
              {/* 1. Case Summary */}
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

              {/* 2. Previous Review Notes & 3. AI Recommendation Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] space-y-1">
                  <span className="font-bold text-[#243B55] dark:text-white block">
                    AI Recommendation Summary
                  </span>
                  <p className="text-[#788394] leading-relaxed">
                    Recommended Candidate: <span className="font-semibold text-[#243B55] dark:text-white">{activeCase.selectedRecipientCode}</span>. Complete blood group compatibility and verified clinical urgency.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] space-y-1">
                  <span className="font-bold text-[#243B55] dark:text-white block">
                    Coordinator Review
                  </span>
                  <p className="text-[#788394] leading-relaxed">
                    {activeCase.coordinatorReviewer || 'Coordinator verified surgical team standby, hospital bed reservation, and transit viability.'}
                  </p>
                </div>
              </div>

              {/* 4. Required Medical Information Checklist */}
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
                    <span>Crossmatch Negative</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Surgical Team Ready</span>
                  </div>
                </div>
              </div>

              {/* 5. Decision Options & Form */}
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
                      value={overrideRecipientId}
                      onChange={(e) => setOverrideRecipientId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-[#152232] text-[#243B55] dark:text-white"
                    >
                      {recipients
                        .filter(r => r.organType === activeCase.organType && r.status === 'ACTIVE')
                        .map(r => (
                          <option key={r.id} value={r.id}>
                            {r.anonymizedCode} ({r.hospitalName} · Waitlist: {r.waitlistDays}d)
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* 6. Mandatory Reason for Override or Rejection */}
                <div>
                  <label className="block text-xs font-semibold text-[#243B55] dark:text-white mb-1">
                    Clinical Justification {decisionType !== 'STANDARD_APPROVAL' && <span className="text-rose-600">* (Min 15 chars)</span>}:
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    placeholder={
                      decisionType === 'CLINICAL_OVERRIDE'
                        ? 'State medical contraindication for Rank #1 candidate or clinical priority...'
                        : 'Confirmed crossmatch negative, patient stable, OR slot confirmed...'
                    }
                    className="w-full text-xs p-3 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#E98F83]"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="text-[11px] text-[#788394]">
                    Authorized by: <span className="font-semibold text-[#243B55] dark:text-white">{currentUserName}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={currentUserRole !== 'medical'}
                    className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                      currentUserRole === 'medical'
                        ? 'bg-[#E98F83] hover:bg-[#D87B6F] text-white'
                        : 'bg-slate-200 text-slate-400 dark:bg-slate-800 cursor-not-allowed'
                    }`}
                  >
                    <UserCheck size={14} />
                    <span>Authorize & Sign Decision</span>
                  </button>
                </div>
              </form>

              {/* 7. Approval History */}
              <div className="pt-4 border-t border-[#EFE7DE] dark:border-[#273A52] space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#788394] dark:text-[#94A3B8] block">
                  Decision History
                </span>
                <div className="space-y-1.5 text-xs">
                  {activeCase.history.map(h => (
                    <div key={h.id} className="p-2.5 rounded-xl bg-[#F8F5EF] dark:bg-[#111A26] flex items-center justify-between text-[#788394]">
                      <div>
                        <span className="font-bold text-[#243B55] dark:text-white mr-2">
                          {h.toState.replace(/_/g, ' ')}
                        </span>
                        <span>{h.reason}</span>
                      </div>
                      <span className="font-mono text-[10px] shrink-0">{new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
