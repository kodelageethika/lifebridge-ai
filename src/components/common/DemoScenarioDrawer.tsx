import React from 'react';
import { useApp } from '../../context/AppContext.tsx';
import {
  X,
  Zap,
  CheckCircle2,
  AlertTriangle,
  FileWarning,
  Flame,
  ShieldAlert,
  Sliders,
  Play
} from 'lucide-react';

export const DemoScenarioDrawer: React.FC = () => {
  const { isScenarioDrawerOpen, setIsScenarioDrawerOpen, runScenario } = useApp();

  if (!isScenarioDrawerOpen) return null;

  const scenarios = [
    {
      id: 1,
      title: '1. End-to-End Organ Allocation Journey',
      organ: 'Kidney (ORG-K704)',
      role: 'Transplant Coordinator',
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
      description: 'Run complete workflow: Organ registration -> Data-Quality Gate -> Deterministic Explainable AI ranking -> Coordinator check -> Surgeon review -> Live transport tracking.',
      actionLabel: 'Launch Scenario 1',
    },
    {
      id: 2,
      title: '2. Surgeon Clinical Override with Mandatory Rationale',
      organ: 'Kidney (CASE-2026-001)',
      role: 'Transplant Surgeon / Medical',
      icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
      description: 'Switch to Surgeon role. Evaluate Rank 1 vs Rank 2. Execute clinical override with required 15+ character justification and verify automatic audit logging.',
      actionLabel: 'Launch Scenario 2',
    },
    {
      id: 3,
      title: '3. Data-Quality Gate: Missing Data Flagging',
      organ: 'Kidney (REC-KID-4021)',
      role: 'Transplant Coordinator',
      icon: FileWarning,
      color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
      description: 'Inspect candidate with expired PRA antibody test (114 days old). Verify that the system FLAGS and BLOCKS the candidate rather than silently scoring missing data as zero.',
      actionLabel: 'Launch Scenario 3',
    },
    {
      id: 4,
      title: '4. Heart Tight Window & Traffic Delay Escalation',
      organ: 'Heart (ORG-H109, 5-hr window)',
      role: 'Transplant Coordinator',
      icon: Flame,
      color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800',
      description: 'Short 5h cold ischemia window combined with route flood delay triggers Level 2 Warning. Escalates to alternate candidate review (Zero silent replacements).',
      actionLabel: 'Launch Scenario 4',
    },
    {
      id: 5,
      title: '5. Organ-Specific Consent Revocation',
      organ: 'Donor DNR-NIM-9912',
      role: 'Donor / Family Rep',
      icon: ShieldAlert,
      color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800',
      description: 'Demonstrate legal consent withdrawal by donor representative. Shows instant exclusion of all organs from active matching queues.',
      actionLabel: 'Launch Scenario 5',
    },
    {
      id: 6,
      title: '6. Cryptographic Audit Trail Tamper Detection',
      organ: 'Immutable SHA-256 Chain',
      role: 'Platform Administrator',
      icon: Sliders,
      color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
      description: 'Simulate an attacker directly tampering with an audit record in the database. Run the verification engine and witness cryptographic proof isolating the exact broken link!',
      actionLabel: 'Launch Scenario 6',
    },
    {
      id: 7,
      title: '7. Counterfactual What-If Simulator',
      organ: 'Candidate A vs Candidate B',
      role: 'Clinical Decision Support',
      icon: Zap,
      color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
      description: 'Analyze hypothetical candidate trade-offs side-by-side with transparent factor contribution deltas, prominently stamped "Hypothetical Decision Support".',
      actionLabel: 'Launch Scenario 7',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#243B55]/30 backdrop-blur-xs transition-opacity"
        onClick={() => setIsScenarioDrawerOpen(false)}
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#121E2C] border-l border-[#EFE7DE] dark:border-[#203247] shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EFE7DE] dark:border-[#203247] flex items-center justify-between bg-[#FDFBF7] dark:bg-[#152232]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#E98F83] text-white flex items-center justify-center shadow-xs">
              <Zap size={18} className="fill-current text-white/90" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#243B55] dark:text-white">
                Interactive Demonstration Scenarios
              </h2>
              <p className="text-xs text-[#788394] dark:text-[#A0AEC0]">
                Pre-scripted clinical & verification workflows
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsScenarioDrawerOpen(false)}
            className="p-1.5 rounded-lg text-[#788394] dark:text-[#A0AEC0] hover:bg-[#F8E8E3] dark:hover:bg-[#1C2C3E] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-white dark:bg-[#121E2C]">
          {scenarios.map(sc => (
            <div
              key={sc.id}
              className="p-4 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#FDFBF7] dark:bg-[#152232] hover:border-[#E98F83] dark:hover:border-[#E98F83] transition-all shadow-xs flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-[#243B55] dark:text-white flex items-center gap-1.5">
                    <sc.icon size={15} className="text-[#E98F83]" />
                    {sc.title}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${sc.color}`}>
                    {sc.organ}
                  </span>
                </div>
                <p className="text-xs text-[#546070] dark:text-[#CBD5E1] leading-relaxed">
                  {sc.description}
                </p>
                <div className="mt-2 text-[11px] text-[#788394] dark:text-[#94A3B8] flex items-center gap-1">
                  <span className="font-medium text-[#E98F83]">Target Role:</span> {sc.role}
                </div>
              </div>

              <button
                onClick={() => runScenario(sc.id)}
                className="w-full py-2 px-3 text-xs font-semibold bg-[#E98F83] hover:bg-[#D97D71] text-white rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.99]"
              >
                <Play size={13} className="fill-current" />
                <span>{sc.actionLabel}</span>
              </button>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-[#EFE7DE] dark:border-[#203247] bg-[#FAF6F0] dark:bg-[#0E1722] text-[11px] text-[#788394] dark:text-[#94A3B8]">
          Each scenario automatically switches the persona, navigates to the target module, and sets up realistic clinical test state.
        </div>
      </div>
    </div>
  );
};
