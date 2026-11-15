import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { OrganTag } from '../common/OrganTag.tsx';
import {
  FileCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RotateCcw,
  UserCheck,
  FileText
} from 'lucide-react';

export const ConsentCenterView: React.FC = () => {
  const {
    donors,
    withdrawDonorConsent,
    reinstateDonorConsent,
    currentUserRole,
    currentUserName,
  } = useApp();

  const [selectedDonorId, setSelectedDonorId] = useState<string>(() => {
    return donors[0]?.id || 'DONOR-001';
  });

  const [withdrawalReason, setWithdrawalReason] = useState<string>('');
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);

  const activeDonor = donors.find(d => d.id === selectedDonorId) || donors[0];

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawalReason || withdrawalReason.trim().length < 8) return;
    withdrawDonorConsent(activeDonor.id, withdrawalReason);
    setShowWithdrawModal(false);
    setWithdrawalReason('');
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-[#243B55] dark:text-white">
              Organ Consent & Verification Center
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F8E8E3] text-[#243B55] border border-[#EFE7DE] dark:bg-[#203247] dark:text-white">
              Statutory Controls
            </span>
          </div>
          <p className="text-xs text-[#788394] dark:text-[#94A3B8]">
            Organ-specific consent directives, next-of-kin verification records, and instant revocation safeguards.
          </p>
        </div>

        {/* Donor Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#788394] dark:text-[#94A3B8]">Active Donor Record:</label>
          <select
            value={activeDonor.id}
            onChange={(e) => setSelectedDonorId(e.target.value)}
            className="text-xs font-semibold bg-[#FAF6F0] dark:bg-[#0E1722] border border-[#EFE7DE] dark:border-[#203247] rounded-xl px-3 py-1.5 text-[#243B55] dark:text-white outline-none"
          >
            {donors.map(d => (
              <option key={d.id} value={d.id}>
                {d.anonymizedCode} ({d.isWithdrawn ? 'REVOKED' : 'ACTIVE'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Withdrawal Warning Card (if already withdrawn) */}
      {activeDonor.isWithdrawn ? (
        <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={20} className="text-rose-600 dark:text-rose-400" />
              <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                Consent Formally Withdrawn & Excluded from Allocation
              </h3>
            </div>
            <button
              onClick={() => reinstateDonorConsent(activeDonor.id)}
              className="px-3 py-1 text-xs font-bold bg-white dark:bg-[#1A2636] border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-100 cursor-pointer"
            >
              Re-verify & Reinstate Consent
            </button>
          </div>
          <p className="text-xs text-rose-800 dark:text-rose-300">
            <span className="font-semibold">Legal Reason on Record: </span>
            {activeDonor.withdrawalReason || 'Revocation registered before organ allocation.'}
          </p>
          <div className="text-[11px] text-[#788394] dark:text-[#94A3B8] italic">
            Non-negotiable rule: Any matching run attempted while consent is withdrawn will immediately block and reject this donor's organs.
          </div>
        </div>
      ) : null}

      {/* Donor Profile & Organ Consents Grid */}
      <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#EFE7DE] dark:border-[#203247]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-[#243B55] dark:text-white">
                {activeDonor.anonymizedCode}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                {activeDonor.donationType}
              </span>
            </div>
            <span className="text-xs text-[#788394] dark:text-[#94A3B8]">
              Registered at {activeDonor.hospitalName} · Age {activeDonor.age} · Blood: {activeDonor.bloodGroup}
            </span>
          </div>

          {!activeDonor.isWithdrawn && (
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl hover:bg-rose-100 transition-colors cursor-pointer"
            >
              Exercise Legal Right to Revoke Consent
            </button>
          )}
        </div>

        {/* Per-Organ Consent Matrix */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#788394] dark:text-[#94A3B8] mb-3">
            Organ-Specific Consent Directives (Statutory Standard)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {activeDonor.consents.map(c => (
              <div
                key={c.organType}
                className="p-4 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#FDFBF7] dark:bg-[#121D2A] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <OrganTag organType={c.organType} size="sm" />
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    {c.verificationStatus}
                  </span>
                </div>

                <div className="text-[11px] text-[#546070] dark:text-[#94A3B8] space-y-0.5 pt-1">
                  <div>Version: <span className="font-mono">v{c.version}</span></div>
                  <div>Verified by: <span className="font-medium text-[#243B55] dark:text-white">{c.verifiedBy}</span></div>
                  <div>Timestamp: <span className="font-mono">{new Date(c.timestamp).toLocaleDateString()}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legal & Privacy Statement */}
        <div className="p-4 rounded-xl bg-[#FAF6F0] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#203247] text-xs text-[#546070] dark:text-[#CBD5E1] space-y-1.5 leading-relaxed">
          <div className="font-bold text-[#E98F83] dark:text-[#E98F83] flex items-center gap-1.5">
            <Lock size={14} />
            <span>Consent Privacy & Regulatory Compliance</span>
          </div>
          <p>
            Donor consent is strictly organ-specific and revocable at any stage prior to surgical retrieval. Patient privacy is safeguarded by cryptographic anonymization, and no clinical record is shared with unauthorized facilities.
          </p>
        </div>
      </div>

      {/* Revocation Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#152232] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <ShieldAlert size={20} />
              <h3 className="text-sm font-bold text-[#243B55] dark:text-white">
                Revoke Donor Consent Directive
              </h3>
            </div>

            <p className="text-xs text-[#546070] dark:text-[#94A3B8]">
              Revoking consent will immediately exclude all organs registered for <span className="font-semibold text-[#243B55] dark:text-white">{activeDonor.anonymizedCode}</span> from active matching and allocation.
            </p>

            <form onSubmit={handleWithdrawSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#243B55] dark:text-white mb-1">
                  Reason for Revocation (Required for Audit Trail):
                </label>
                <textarea
                  rows={3}
                  required
                  value={withdrawalReason}
                  onChange={(e) => setWithdrawalReason(e.target.value)}
                  placeholder="e.g. Next-of-kin legal revocation signed before brain-death committee sign-off..."
                  className="w-full text-xs p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#FAF6F0] dark:bg-[#0E1722] text-[#243B55] dark:text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-3 py-1.5 text-xs text-[#788394] hover:text-[#243B55] dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors cursor-pointer"
                >
                  Confirm Legal Revocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
