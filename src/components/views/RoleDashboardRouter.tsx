import React from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { OrganTag } from '../common/OrganTag.tsx';
import {
  Activity,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Truck,
  Sparkles
} from 'lucide-react';

export const RoleDashboardRouter: React.FC = () => {
  const {
    currentUserRole,
    currentUserName,
    workflowCases,
    logisticsCases,
    dataQualityIssues,
    setActiveView,
    setIsScenarioDrawerOpen,
  } = useApp();

  const casesNeedingReview = workflowCases.filter(
    c => c.currentState === 'COORDINATOR_REVIEW' || c.currentState === 'MEDICAL_REVIEW' || c.currentState === 'NEEDS_VERIFICATION'
  );
  const activeTransports = logisticsCases.filter(l => l.status === 'IN_TRANSIT' || l.status === 'DELAYED');
  const urgentAlerts = workflowCases.filter(c => c.currentState === 'ESCALATED' || c.priorityLevel === 'CRITICAL');
  const pendingApprovals = workflowCases.filter(c => c.currentState === 'MEDICAL_REVIEW');

  // Top 3 actionable tasks
  const attentionTasks = [
    {
      id: 'TASK-01',
      title: 'Surgeon Medical Authorization Required',
      description: 'Kidney Case LBA-CASE-9921 Rank #1 candidate crossmatch verified. Awaiting attending surgeon sign-off.',
      targetView: 'approval' as const,
      actionText: 'Review Case',
      priority: 'High Priority',
      badgeClass: 'bg-[#F8E8E3] text-[#E98F83] border-[#E98F83]/30',
    },
    {
      id: 'TASK-02',
      title: 'Cold-Ischemia Route Delay Warning',
      description: 'Heart Case LBA-CASE-9922 (5h preservation limit) encountering Jubilee Hills transit delay. Alternate candidate alerted.',
      targetView: 'logistics' as const,
      actionText: 'Track Transport',
      priority: 'Critical Alert',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300',
    },
    {
      id: 'TASK-03',
      title: 'Information Verification Flag',
      description: 'Candidate REC-KID-4021 held at Data-Quality Gate due to expired PRA crossmatch (114 days old).',
      targetView: 'matching' as const,
      actionText: 'Inspect Details',
      priority: 'Action Required',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      
      {/* 1. TOP HEADER: "Good morning, Dr. [Name]" */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243B55] dark:text-white">
            Good morning, {currentUserRole === 'medical' ? 'Dr. Priya Varma' : 'Coordinator Arishta'}
          </h1>
          <p className="text-sm text-[#788394] dark:text-[#94A3B8] mt-1">
            Here is what needs your attention today.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsScenarioDrawerOpen(true)}
            className="px-4 py-2 text-xs font-semibold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles size={14} />
            <span>Demo Scenarios (1-7)</span>
          </button>
        </div>
      </div>

      {/* 2. THREE OR FOUR IMPORTANT SUMMARY INDICATORS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <span className="text-xs text-[#788394] dark:text-[#94A3B8] block mb-1">
            Cases Requiring Review
          </span>
          <div className="text-3xl font-bold font-mono text-[#243B55] dark:text-white tabular-nums">
            {casesNeedingReview.length}
          </div>
          <span className="text-[11px] text-[#A9BBA8] font-medium block mt-1">
            Pending coordinator/doctor check
          </span>
        </div>

        <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <span className="text-xs text-[#788394] dark:text-[#94A3B8] block mb-1">
            Active Transports
          </span>
          <div className="text-3xl font-bold font-mono text-[#E98F83] tabular-nums">
            {activeTransports.length}
          </div>
          <span className="text-[11px] text-[#788394] block mt-1">
            Cold preservation live
          </span>
        </div>

        <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <span className="text-xs text-[#788394] dark:text-[#94A3B8] block mb-1">
            Urgent Alerts
          </span>
          <div className="text-3xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
            {urgentAlerts.length}
          </div>
          <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium block mt-1">
            Route delay / escalation
          </span>
        </div>

        <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <span className="text-xs text-[#788394] dark:text-[#94A3B8] block mb-1">
            Pending Approvals
          </span>
          <div className="text-3xl font-bold font-mono text-[#243B55] dark:text-white tabular-nums">
            {pendingApprovals.length}
          </div>
          <span className="text-[11px] text-[#788394] block mt-1">
            Surgeon sign-off ready
          </span>
        </div>
      </div>

      {/* 3. "NEEDS YOUR ATTENTION" (Top 3 Important Tasks) */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-[#243B55] dark:text-white">
          Needs your attention
        </h2>

        <div className="space-y-3">
          {attentionTasks.map(task => (
            <div
              key={task.id}
              className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#E98F83] transition-all"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${task.badgeClass}`}>
                    {task.priority}
                  </span>
                  <h3 className="text-sm font-bold text-[#243B55] dark:text-white">
                    {task.title}
                  </h3>
                </div>
                <p className="text-xs text-[#788394] dark:text-[#94A3B8] leading-relaxed max-w-2xl">
                  {task.description}
                </p>
              </div>

              <button
                onClick={() => setActiveView(task.targetView)}
                className="px-4 py-2 text-xs font-semibold bg-[#F8F5EF] dark:bg-[#1E2E40] text-[#243B55] dark:text-white hover:bg-[#E98F83] hover:text-white rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <span>{task.actionText}</span>
                <ArrowRight size={13} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 4. "ACTIVE CASES" (Compact rows with Case ID, Organ, Status, Next Action) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#243B55] dark:text-white">
            Active cases
          </h2>
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
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          c.currentState === 'ESCALATED'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83]'
                        }`}>
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
                      onClick={() => setActiveView(c.currentState === 'TRANSPORT_APPROVED' || c.currentState === 'ESCALATED' ? 'logistics' : 'approval')}
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
    </div>
  );
};
