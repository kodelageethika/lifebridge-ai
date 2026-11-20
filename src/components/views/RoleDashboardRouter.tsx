import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { OrganTag } from '../common/OrganTag.tsx';
import { AiInsightPanel } from '../common/AiInsightPanel.tsx';
import { apiRequest } from '../../services/api.ts';
import { OrganType } from '../../types/index.ts';
import {
  ArrowRight,
  Sparkles,
  UserPlus,
  ShieldCheck,
  Users,
  Sliders,
  CheckCircle2,
  X,
} from 'lucide-react';

interface AiRecipientSummaryResult {
  recipientId: string;
  recipientCode: string;
  summary: string;
  keyClinicalFactors: string[];
  readinessObservations: string[];
  disclaimer: string;
  model: string;
}

export const RoleDashboardRouter: React.FC = () => {
  const {
    currentUserRole,
    currentUserName,
    workflowCases,
    logisticsCases,
    dataQualityIssues,
    hospitals,
    recipients,
    organConfigs,
    adminUsers,
    setActiveView,
    setIsScenarioDrawerOpen,
    resolveDataQualityIssue,
    createDonor,
    createRecipient,
    loadAdminUsers,
    updateUserStatus,
    publishNewConfigVersion,
  } = useApp();

  const [showDonorModal, setShowDonorModal] = useState(false);
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [aiRecipientId, setAiRecipientId] = useState<string>('');
  const [aiRecLoading, setAiRecLoading] = useState(false);
  const [aiRecError, setAiRecError] = useState<string | null>(null);
  const [aiRecSummary, setAiRecSummary] = useState<AiRecipientSummaryResult | null>(null);

  // Donor form
  const [donorAge, setDonorAge] = useState('42');
  const [donorBlood, setDonorBlood] = useState<'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-'>('O+');
  const [donorHospitalId, setDonorHospitalId] = useState(() => hospitals[0]?.id || 'HOSP-HYD-01');
  const [donorType, setDonorType] = useState<'DECEASED' | 'LIVING'>('DECEASED');
  const [donorOrgans, setDonorOrgans] = useState<OrganType[]>(['kidney']);

  // Recipient form
  const [recAge, setRecAge] = useState('46');
  const [recBlood, setRecBlood] = useState<'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-'>('O+');
  const [recOrgan, setRecOrgan] = useState<OrganType>('kidney');
  const [recHospitalId, setRecHospitalId] = useState(() => hospitals[0]?.id || 'HOSP-HYD-01');
  const [recUrgency, setRecUrgency] = useState('84');
  const [recWaitlist, setRecWaitlist] = useState('210');

  // Config publish form
  const [cfgOrgan, setCfgOrgan] = useState<OrganType>('kidney');
  const [wCompat, setWCompat] = useState('0.35');
  const [wUrgency, setWUrgency] = useState('0.30');
  const [wWait, setWWait] = useState('0.20');
  const [wLog, setWLog] = useState('0.15');

  useEffect(() => {
    if (currentUserRole === 'admin') {
      loadAdminUsers();
    }
  }, [currentUserRole]);

  const casesNeedingReview = workflowCases.filter(
    c =>
      c.currentState === 'COORDINATOR_REVIEW' ||
      c.currentState === 'MEDICAL_REVIEW' ||
      c.currentState === 'NEEDS_VERIFICATION'
  );
  const activeTransports = logisticsCases.filter(l => l.status === 'IN_TRANSIT' || l.status === 'DELAYED');
  const urgentAlerts = workflowCases.filter(c => c.currentState === 'ESCALATED' || c.priorityLevel === 'CRITICAL');
  const pendingApprovals = workflowCases.filter(c => c.currentState === 'MEDICAL_REVIEW');
  const openQualityIssues = dataQualityIssues.filter(i => !i.isResolved);

  // Dynamically derived attention queue
  const attentionTasks: {
    id: string;
    title: string;
    description: string;
    targetView: 'approval' | 'logistics' | 'matching';
    actionText: string;
    priority: string;
    badgeClass: string;
    issueId?: string;
  }[] = [];

  pendingApprovals.forEach(c => {
    attentionTasks.push({
      id: `TASK-${c.id}`,
      title: `Surgeon Medical Authorization Required (${c.caseNumber})`,
      description: `${c.organType.toUpperCase()} candidate ${c.selectedRecipientCode || 'top ranked'} awaits attending surgeon sign-off.`,
      targetView: 'approval',
      actionText: 'Review Case',
      priority: 'High Priority',
      badgeClass: 'bg-[#F8E8E3] text-[#E98F83] border-[#E98F83]/30',
    });
  });

  logisticsCases
    .filter(l => l.status === 'DELAYED' || l.escalationAlerts.some(a => !a.isResolved))
    .forEach(l => {
      attentionTasks.push({
        id: `TASK-${l.id}`,
        title: `Cold-Ischemia Route Alert (${l.organType.toUpperCase()} ${l.organId})`,
        description: `${l.originHospital} -> ${l.destinationHospital} (${l.delayMinutes}m delay recorded). Review alternate candidates.`,
        targetView: 'logistics',
        actionText: 'Track Transport',
        priority: 'Critical Alert',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300',
      });
    });

  openQualityIssues.forEach(issue => {
    attentionTasks.push({
      id: `TASK-${issue.id}`,
      title: `Information Verification Flag (${issue.entityCode})`,
      description: issue.issueDescription,
      targetView: 'matching',
      actionText: 'Inspect Matching',
      priority: issue.severity === 'BLOCKING' ? 'Action Required' : 'Warning',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
      issueId: issue.id,
    });
  });

  const canManageRegistry =
    currentUserRole === 'coordinator' || currentUserRole === 'hospital' || currentUserRole === 'admin';

  const handleCreateDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (donorOrgans.length === 0) return;
    const ok = await createDonor({
      age: parseInt(donorAge, 10) || 40,
      gender: 'OTHER',
      bloodGroup: donorBlood,
      tissueHLA: 'A*02:01, B*44:02, DRB1*04:01',
      hospitalId: donorHospitalId || hospitals[0]?.id || 'HOSP-HYD-01',
      donationType: donorType,
      consentedOrgans: donorOrgans,
    });
    if (ok) setShowDonorModal(false);
  };

  const handleCreateRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await createRecipient({
      age: parseInt(recAge, 10) || 46,
      gender: 'OTHER',
      bloodGroup: recBlood,
      tissueHLA: 'A*02:01, B*44:02, DRB1*04:01',
      organType: recOrgan,
      hospitalId: recHospitalId || hospitals[0]?.id || 'HOSP-HYD-01',
      urgencyScore: Math.min(100, Math.max(1, parseInt(recUrgency, 10) || 80)),
      urgencyMetricName: recOrgan === 'liver' ? 'MELD-Na Proxy' : 'Clinical Acuity',
      waitlistDays: parseInt(recWaitlist, 10) || 180,
      distanceKm: 18,
      missingDataFlags: [],
    });
    if (ok) setShowRecipientModal(false);
  };

  const handlePublishWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    const compatibility = parseFloat(wCompat) || 0.35;
    const urgency = parseFloat(wUrgency) || 0.3;
    const waitingTime = parseFloat(wWait) || 0.2;
    const transportFeasibility = parseFloat(wLog) || 0.15;
    await publishNewConfigVersion(cfgOrgan, { compatibility, urgency, waitingTime, transportFeasibility });
    setShowConfigModal(false);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243B55] dark:text-white">
            Good morning, {currentUserName}
          </h1>
          <p className="text-sm text-[#788394] dark:text-[#94A3B8] mt-1">
            Here is what needs your attention today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canManageRegistry && (
            <>
              <button
                onClick={() => setShowDonorModal(true)}
                className="px-3.5 py-2 text-xs font-semibold bg-white dark:bg-[#152232] border border-[#EFE7DE] dark:border-[#273A52] text-[#243B55] dark:text-white hover:border-[#E98F83] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus size={13} className="text-[#E98F83]" />
                <span>Register Donor</span>
              </button>
              <button
                onClick={() => setShowRecipientModal(true)}
                className="px-3.5 py-2 text-xs font-semibold bg-white dark:bg-[#152232] border border-[#EFE7DE] dark:border-[#273A52] text-[#243B55] dark:text-white hover:border-[#E98F83] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus size={13} className="text-[#A9BBA8]" />
                <span>Add Recipient</span>
              </button>
            </>
          )}
          <button
            onClick={() => setIsScenarioDrawerOpen(true)}
            className="px-4 py-2 text-xs font-semibold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles size={14} />
            <span>Demo Scenarios (1-7)</span>
          </button>
        </div>
      </div>

      {/* Summary Indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <span className="text-xs text-[#788394] dark:text-[#94A3B8] block mb-1">Cases Requiring Review</span>
          <div className="text-3xl font-bold font-mono text-[#243B55] dark:text-white tabular-nums">
            {casesNeedingReview.length}
          </div>
          <span className="text-[11px] text-[#A9BBA8] font-medium block mt-1">
            Pending coordinator/doctor check
          </span>
        </div>

        <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <span className="text-xs text-[#788394] dark:text-[#94A3B8] block mb-1">Active Transports</span>
          <div className="text-3xl font-bold font-mono text-[#E98F83] tabular-nums">
            {activeTransports.length}
          </div>
          <span className="text-[11px] text-[#788394] block mt-1">Cold preservation live</span>
        </div>

        <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <span className="text-xs text-[#788394] dark:text-[#94A3B8] block mb-1">Urgent Alerts</span>
          <div className="text-3xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
            {urgentAlerts.length}
          </div>
          <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium block mt-1">
            Route delay / escalation
          </span>
        </div>

        <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <span className="text-xs text-[#788394] dark:text-[#94A3B8] block mb-1">Pending Approvals</span>
          <div className="text-3xl font-bold font-mono text-[#243B55] dark:text-white tabular-nums">
            {pendingApprovals.length}
          </div>
          <span className="text-[11px] text-[#788394] block mt-1">Surgeon sign-off ready</span>
        </div>
      </div>

      {/* Needs Your Attention (Live Derived) */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-[#243B55] dark:text-white">Needs your attention</h2>

        {attentionTasks.length === 0 ? (
          <div className="p-6 bg-white dark:bg-[#152232] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] text-xs text-[#788394] flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>All urgent reviews, transport alerts, and verification flags are currently resolved.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {attentionTasks.slice(0, 5).map(task => (
              <div
                key={task.id}
                className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#E98F83] transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${task.badgeClass}`}>
                      {task.priority}
                    </span>
                    <h3 className="text-sm font-bold text-[#243B55] dark:text-white">{task.title}</h3>
                  </div>
                  <p className="text-xs text-[#788394] dark:text-[#94A3B8] leading-relaxed max-w-2xl">
                    {task.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {task.issueId && canManageRegistry && (
                    <button
                      onClick={() => resolveDataQualityIssue(task.issueId!)}
                      className="px-3.5 py-2 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 cursor-pointer"
                    >
                      Verify & Resolve
                    </button>
                  )}
                  <button
                    onClick={() => setActiveView(task.targetView)}
                    className="px-4 py-2 text-xs font-semibold bg-[#F8F5EF] dark:bg-[#1E2E40] text-[#243B55] dark:text-white hover:bg-[#E98F83] hover:text-white rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{task.actionText}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Cases */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#243B55] dark:text-white">Active cases</h2>
          <button
            onClick={() => setActiveView('approval')}
            className="text-xs font-semibold text-[#E98F83] hover:underline cursor-pointer"
          >
            View all decisions →
          </button>
        </div>

        <div className="bg-white dark:bg-[#152232] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] overflow-hidden">
          <div className="divide-y divide-[#EFE7DE] dark:divide-[#273A52]">
            {workflowCases.map(c => {
              const getNextAction = (state: string) => {
                switch (state) {
                  case 'COORDINATOR_REVIEW':
                    return 'Verify recipient hospital & transit readiness';
                  case 'MEDICAL_REVIEW':
                    return 'Surgeon crossmatch evaluation & approval';
                  case 'AUTHORIZED_DECISION':
                    return 'Authorize dedicated transport corridor';
                  case 'TRANSPORT_APPROVED':
                    return 'Monitor real-time cold ischemia transit';
                  case 'TRANSPLANT_COMPLETED':
                    return 'Longitudinal post-transplant follow-up';
                  case 'ESCALATED':
                    return 'Review alternate candidate feasibility';
                  default:
                    return 'Case progression underway';
                }
              };

              return (
                <div
                  key={c.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F8F5EF]/50 dark:hover:bg-[#1A2636] transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <OrganTag organType={c.organType} size="md" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-[#243B55] dark:text-white">
                          {c.caseNumber}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            c.currentState === 'ESCALATED'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83]'
                          }`}
                        >
                          {c.currentState.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-xs text-[#788394] dark:text-[#94A3B8] block mt-0.5">
                        Next: {getNextAction(c.currentState)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() =>
                        setActiveView(
                          c.currentState === 'TRANSPORT_APPROVED' || c.currentState === 'ESCALATED'
                            ? 'logistics'
                            : 'approval'
                        )
                      }
                      className="px-3.5 py-1.5 text-xs font-semibold bg-[#F8F5EF] dark:bg-[#1E2E40] text-[#243B55] dark:text-white hover:bg-[#E98F83] hover:text-white rounded-xl transition-colors cursor-pointer"
                    >
                      Open Case
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI Recipient Clinical Summary (Clinical & Admin roles only) */}
      {recipients.length > 0 && (canManageRegistry || currentUserRole === 'medical') && (
        <AiInsightPanel
          title="AI Recipient Clinical Summary"
          subtitle="Select an anonymized recipient code to generate an advisory readiness summary."
          buttonLabel="Summarize Recipient"
          isLoading={aiRecLoading}
          error={aiRecError}
          onGenerate={async () => {
            const targetId = aiRecipientId || recipients[0]?.id;
            if (!targetId || aiRecLoading) return;
            setAiRecLoading(true);
            setAiRecError(null);
            try {
              const res = await apiRequest<AiRecipientSummaryResult>('/api/v1/ai/recipient-summary', {
                method: 'POST',
                body: { recipientId: targetId },
              });
              setAiRecSummary(res);
            } catch (err) {
              setAiRecError(err instanceof Error ? err.message : 'Unable to summarize recipient');
            } finally {
              setAiRecLoading(false);
            }
          }}
        >
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="font-semibold text-[#243B55] dark:text-white">Recipient:</label>
            <select
              value={aiRecipientId || recipients[0]?.id || ''}
              onChange={e => setAiRecipientId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
            >
              {recipients.map(r => (
                <option key={r.id} value={r.id}>
                  {r.anonymizedCode} ({r.organType.toUpperCase()} · {r.bloodGroup} · Urgency {r.urgencyScore})
                </option>
              ))}
            </select>
          </div>
          {aiRecSummary && (
            <div className="space-y-2.5 pt-2 border-t border-[#EFE7DE] dark:border-[#273A52] text-xs">
              <p className="text-[#243B55] dark:text-white leading-relaxed">{aiRecSummary.summary}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52]">
                  <span className="font-bold text-[#243B55] dark:text-white block mb-1">Key Clinical Factors</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-[#788394]">
                    {aiRecSummary.keyClinicalFactors.map((f, idx) => (
                      <li key={idx}>{f}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52]">
                  <span className="font-bold text-[#243B55] dark:text-white block mb-1">Readiness Observations</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-[#788394]">
                    {aiRecSummary.readinessObservations.map((f, idx) => (
                      <li key={idx}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="text-[10px] text-[#788394] flex justify-between">
                <span>{aiRecSummary.disclaimer}</span>
                <span className="font-mono">{aiRecSummary.model}</span>
              </div>
            </div>
          )}
        </AiInsightPanel>
      )}

      {/* Admin Governance Panel (Only rendered for admin role) */}
      {currentUserRole === 'admin' && (
        <section className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#E98F83]" />
              <h2 className="text-base font-bold text-[#243B55] dark:text-white">
                Platform Governance & User Directory
              </h2>
            </div>

            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3.5 py-1.5 text-xs font-semibold bg-[#243B55] hover:bg-[#1B2D42] text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders size={13} />
              <span>Publish Ruleset Weights</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-[#EFE7DE] dark:border-[#273A52] text-[#788394]">
                <tr>
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE7DE] dark:divide-[#273A52]">
                {adminUsers.map(u => (
                  <tr key={u.id}>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-[#243B55] dark:text-white">{u.displayName}</div>
                      <div className="text-[11px] text-[#788394]">{u.email}</div>
                    </td>
                    <td className="py-2.5 pr-3 uppercase font-mono text-[11px]">{u.role}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {u.role !== 'admin' && (
                        <button
                          onClick={() =>
                            updateUserStatus(u.id, u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')
                          }
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#F8F5EF] dark:bg-[#1E2E40] hover:bg-[#EFE7DE] text-[#243B55] dark:text-white cursor-pointer"
                        >
                          {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Register Donor Modal */}
      {showDonorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#152232] rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#243B55] dark:text-white">Register Clinical Donor</h3>
              <button onClick={() => setShowDonorModal(false)} className="p-1 text-[#788394] cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateDonor} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Age</label>
                  <input
                    type="number"
                    min={18}
                    max={90}
                    value={donorAge}
                    onChange={e => setDonorAge(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Blood Group</label>
                  <select
                    value={donorBlood}
                    onChange={e => setDonorBlood(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  >
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Hospital</label>
                  <select
                    value={donorHospitalId}
                    onChange={e => setDonorHospitalId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  >
                    {hospitals.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Donation Type</label>
                  <select
                    value={donorType}
                    onChange={e => setDonorType(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  >
                    <option value="DECEASED">Deceased</option>
                    <option value="LIVING">Living</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Consented Organs</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['kidney', 'liver', 'heart', 'lung', 'pancreas', 'intestine'] as OrganType[]).map(org => {
                    const checked = donorOrgans.includes(org);
                    return (
                      <button
                        type="button"
                        key={org}
                        onClick={() =>
                          setDonorOrgans(prev =>
                            prev.includes(org) ? prev.filter(o => o !== org) : [...prev, org]
                          )
                        }
                        className={`p-2 rounded-lg border capitalize cursor-pointer ${
                          checked
                            ? 'bg-[#F8E8E3] border-[#E98F83] text-[#E98F83] font-bold'
                            : 'bg-[#F8F5EF] dark:bg-[#0E1722] border-[#EFE7DE] dark:border-[#273A52] text-[#788394]'
                        }`}
                      >
                        {org}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowDonorModal(false)} className="px-3 py-1.5 text-[#788394] cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#E98F83] text-white font-bold rounded-xl cursor-pointer">
                  Save Donor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Recipient Modal */}
      {showRecipientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#152232] rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#243B55] dark:text-white">Add Waitlist Recipient</h3>
              <button onClick={() => setShowRecipientModal(false)} className="p-1 text-[#788394] cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateRecipient} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Organ Needed</label>
                  <select
                    value={recOrgan}
                    onChange={e => setRecOrgan(e.target.value as OrganType)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] capitalize"
                  >
                    {['kidney', 'liver', 'heart', 'lung', 'pancreas', 'intestine'].map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Blood Group</label>
                  <select
                    value={recBlood}
                    onChange={e => setRecBlood(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  >
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Age</label>
                  <input
                    type="number"
                    value={recAge}
                    onChange={e => setRecAge(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Urgency (1-100)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={recUrgency}
                    onChange={e => setRecUrgency(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Wait Days</label>
                  <input
                    type="number"
                    min={0}
                    value={recWaitlist}
                    onChange={e => setRecWaitlist(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Hospital</label>
                <select
                  value={recHospitalId}
                  onChange={e => setRecHospitalId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                >
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowRecipientModal(false)} className="px-3 py-1.5 text-[#788394] cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#E98F83] text-white font-bold rounded-xl cursor-pointer">
                  Add Recipient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish Organ Weights Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#152232] rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#243B55] dark:text-white">Publish Ruleset Configuration</h3>
              <button onClick={() => setShowConfigModal(false)} className="p-1 text-[#788394] cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handlePublishWeights} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Organ Ruleset</label>
                <select
                  value={cfgOrgan}
                  onChange={e => {
                    const org = e.target.value as OrganType;
                    setCfgOrgan(org);
                    const found = organConfigs.find(c => c.organType === org);
                    if (found) {
                      setWCompat(String(found.weights.compatibility));
                      setWUrgency(String(found.weights.urgency));
                      setWWait(String(found.weights.waitingTime));
                      setWLog(String(found.weights.transportFeasibility));
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] capitalize"
                >
                  {['kidney', 'liver', 'heart', 'lung', 'pancreas', 'intestine'].map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Compatibility Weight</label>
                  <input type="number" step="0.05" value={wCompat} onChange={e => setWCompat(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Urgency Weight</label>
                  <input type="number" step="0.05" value={wUrgency} onChange={e => setWUrgency(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Wait Time Weight</label>
                  <input type="number" step="0.05" value={wWait} onChange={e => setWWait(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Transport Weight</label>
                  <input type="number" step="0.05" value={wLog} onChange={e => setWLog(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]" />
                </div>
              </div>

              <p className="text-[11px] text-[#788394]">Note: Weights must sum to 1.00 (100%).</p>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowConfigModal(false)} className="px-3 py-1.5 text-[#788394] cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#243B55] text-white font-bold rounded-xl cursor-pointer">
                  Publish Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
