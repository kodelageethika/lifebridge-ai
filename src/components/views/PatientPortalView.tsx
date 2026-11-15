import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { OrganTag } from '../common/OrganTag.tsx';
import { OrganType } from '../../types/index.ts';
import {
  Heart,
  Activity,
  FileCheck,
  CheckCircle2,
  Download,
  AlertTriangle,
  RotateCcw,
  Bell,
  User,
  ShieldCheck,
  Calendar,
  Building2,
  Lock
} from 'lucide-react';

export const PatientPortalView: React.FC = () => {
  const {
    currentUserRole,
    currentUserName,
    donors,
    recipients,
    withdrawDonorConsent,
    reinstateDonorConsent,
    setActiveView,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'registration' | 'consent' | 'documents' | 'notifications' | 'recovery'>('registration');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');

  // Active donor / recipient records
  const myDonor = donors[0]; // e.g. DNR-HYD-4892 or newly pledged donor
  const myRecipient = recipients[0]; // e.g. REC-KID-8211

  const isDonor = currentUserRole === 'donor';

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawReason.trim()) return;
    withdrawDonorConsent(myDonor.id, withdrawReason);
    setShowWithdrawModal(false);
    setWithdrawReason('');
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-2">
      
      {/* Top Greeting Card */}
      <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#E98F83]">
            {isDonor ? 'Donor Portal' : 'Recipient Portal'}
          </span>
          <h1 className="text-2xl font-bold text-[#243B55] dark:text-white mt-0.5">
            {isDonor ? 'Welcome, Ramesh Family' : 'Welcome, K. Sunder'}
          </h1>
          <p className="text-xs text-[#788394] dark:text-[#94A3B8] mt-1">
            {isDonor
              ? 'Review your organ donation pledge, active consents, and donor card.'
              : 'Track your confidential waitlist registration and hospital coordination.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveView('landing');
            }}
            className="px-3.5 py-2 text-xs font-semibold bg-[#F8F5EF] dark:bg-[#1E2E40] text-[#243B55] dark:text-white hover:bg-[#F2ECE2] rounded-xl transition-colors cursor-pointer"
          >
            Public Website
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#F8F5EF] dark:bg-[#121D2A] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52]">
        <button
          onClick={() => setActiveTab('registration')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'registration'
              ? 'bg-white dark:bg-[#152232] text-[#243B55] dark:text-white shadow-xs font-bold'
              : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white'
          }`}
        >
          My Registration
        </button>

        {isDonor ? (
          <button
            onClick={() => setActiveTab('consent')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
              activeTab === 'consent'
                ? 'bg-white dark:bg-[#152232] text-[#243B55] dark:text-white shadow-xs font-bold'
                : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white'
            }`}
          >
            My Consent Preferences
          </button>
        ) : (
          <button
            onClick={() => setActiveTab('recovery')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
              activeTab === 'recovery'
                ? 'bg-white dark:bg-[#152232] text-[#243B55] dark:text-white shadow-xs font-bold'
                : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white'
            }`}
          >
            Recovery & Follow-Up
          </button>
        )}

        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'documents'
              ? 'bg-white dark:bg-[#152232] text-[#243B55] dark:text-white shadow-xs font-bold'
              : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white'
          }`}
        >
          My Documents
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'notifications'
              ? 'bg-white dark:bg-[#152232] text-[#243B55] dark:text-white shadow-xs font-bold'
              : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white'
          }`}
        >
          Notifications
        </button>
      </div>

      {/* Tab 1: Registration Overview */}
      {activeTab === 'registration' && (
        <div className="space-y-6">
          {isDonor ? (
            <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-[#EFE7DE] dark:border-[#273A52]">
                <div>
                  <span className="text-xs text-[#788394] block">Donor Identifier</span>
                  <span className="text-base font-bold font-mono text-[#243B55] dark:text-white">
                    {myDonor.anonymizedCode}
                  </span>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  myDonor.isWithdrawn
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {myDonor.isWithdrawn ? 'Consent Withdrawn' : 'Active Registry'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-[#788394] block">Registered Hospital:</span>
                  <span className="font-semibold text-[#243B55] dark:text-white">{myDonor.hospitalName}</span>
                </div>
                <div>
                  <span className="text-[#788394] block">Blood Group:</span>
                  <span className="font-semibold text-[#243B55] dark:text-white">{myDonor.bloodGroup}</span>
                </div>
                <div>
                  <span className="text-[#788394] block">Donation Type:</span>
                  <span className="font-semibold text-[#243B55] dark:text-white">{myDonor.donationType}</span>
                </div>
              </div>

              {/* Digital Donor Card Preview */}
              <div className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-[#F8E8E3] to-[#F8F5EF] dark:from-[#1E2E40] dark:to-[#152232] border border-[#EFE7DE] dark:border-[#273A52] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart size={18} className="text-[#E98F83] fill-current" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#243B55] dark:text-white">
                      Official Organ Donor Card
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#788394]">
                    THOTA Registry #LBA-DNR-4892
                  </span>
                </div>

                <div className="text-xs text-[#243B55] dark:text-white font-medium">
                  This card certifies that <span className="font-bold">Ramesh Family</span> has pledged to donate organs for transplantation to help individuals in need.
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {myDonor.consents.map(c => (
                    <OrganTag key={c.organType} organType={c.organType} size="sm" />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-[#EFE7DE] dark:border-[#273A52]">
                <div>
                  <span className="text-xs text-[#788394] block">Candidate ID</span>
                  <span className="text-base font-bold font-mono text-[#243B55] dark:text-white">
                    {myRecipient.anonymizedCode}
                  </span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {myRecipient.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[#788394] block">Organ Required:</span>
                  <span className="font-semibold text-[#243B55] dark:text-white capitalize">{myRecipient.organType}</span>
                </div>
                <div>
                  <span className="text-[#788394] block">Waitlist Duration:</span>
                  <span className="font-semibold text-[#243B55] dark:text-white">{myRecipient.waitlistDays} days</span>
                </div>
                <div>
                  <span className="text-[#788394] block">Registered Hospital:</span>
                  <span className="font-semibold text-[#243B55] dark:text-white">{myRecipient.hospitalName}</span>
                </div>
                <div>
                  <span className="text-[#788394] block">Medical Verification:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{myRecipient.medicalVerificationStatus}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] text-xs text-[#788394] dark:text-[#94A3B8] leading-relaxed">
                <span className="font-bold text-[#243B55] dark:text-white">Confidentiality Protected: </span>
                In accordance with medical privacy standards, exact ranking numbers and other candidates' medical records are kept confidential. Your hospital transplant team will contact you directly as soon as an organ is authorized by attending surgeons.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Donor Consent Management (Part 2.A) */}
      {activeTab === 'consent' && isDonor && (
        <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#243B55] dark:text-white">
                My Organ Donation Preferences
              </h2>
              <p className="text-xs text-[#788394] dark:text-[#94A3B8]">
                You have full control over which organs you wish to donate. Consent is never permanent.
              </p>
            </div>

            {!myDonor.isWithdrawn ? (
              <button
                onClick={() => setShowWithdrawModal(true)}
                className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 rounded-xl hover:bg-rose-100 transition-colors cursor-pointer"
              >
                Revoke Consent
              </button>
            ) : (
              <button
                onClick={() => reinstateDonorConsent(myDonor.id)}
                className="px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                Reinstate Consent
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {myDonor.consents.map(c => (
              <div
                key={c.organType}
                className="p-4 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#111A26] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <OrganTag organType={c.organType} size="sm" />
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Consented
                  </span>
                </div>
                <div className="text-[11px] text-[#788394] space-y-0.5 pt-1">
                  <div>Status: {c.verificationStatus}</div>
                  <div>Verified: {new Date(c.timestamp).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Recovery Tracker (for recipients) */}
      {activeTab === 'recovery' && !isDonor && (
        <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFE7DE] dark:border-[#273A52]">
            <h2 className="text-base font-bold text-[#243B55] dark:text-white">
              My Post-Transplant Recovery
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Optimal Recovery
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] space-y-1">
              <span className="text-[#788394]">Medication Adherence</span>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">98%</div>
              <span className="text-[10px] text-[#788394]">Immunosuppressive protocol active</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] space-y-1">
              <span className="text-[#788394]">Next Hospital Appointment</span>
              <div className="text-sm font-bold text-[#243B55] dark:text-white">November 15, 2026</div>
              <span className="text-[10px] text-[#788394]">OPD Room 4, Apollo Health City</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] space-y-1">
              <span className="text-[#788394]">Graft Status</span>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Normal Function</div>
              <span className="text-[10px] text-[#788394]">Serum Creatinine: 1.08 mg/dL</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Documents */}
      {activeTab === 'documents' && (
        <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-4">
          <h2 className="text-base font-bold text-[#243B55] dark:text-white">
            Verified Medical Documents
          </h2>

          <div className="space-y-2 text-xs">
            <div className="p-3.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#111A26] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileCheck size={16} className="text-[#E98F83]" />
                <div>
                  <span className="font-semibold text-[#243B55] dark:text-white block">
                    {isDonor ? 'Statutory Consent Declaration (Form 8)' : 'Waitlist Medical Clearance'}
                  </span>
                  <span className="text-[11px] text-[#788394]">Verified by hospital liaison officer</span>
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={13} />
                Verified
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Notifications */}
      {activeTab === 'notifications' && (
        <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-4">
          <h2 className="text-base font-bold text-[#243B55] dark:text-white">
            Registry Updates & Notifications
          </h2>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] space-y-0.5">
              <span className="font-semibold text-[#243B55] dark:text-white block">
                Profile Registration Confirmed
              </span>
              <p className="text-[#788394]">
                Your record has been successfully cataloged under the state organ registry.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Revocation Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#152232] rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#243B55] dark:text-white">
              Revoke Organ Donor Consent
            </h3>
            <p className="text-xs text-[#788394] leading-relaxed">
              You have the full legal right to withdraw your consent at any time. Your decision will immediately take effect across all hospital networks.
            </p>

            <form onSubmit={handleWithdraw} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#243B55] dark:text-white mb-1">
                  Reason for Withdrawal:
                </label>
                <textarea
                  rows={2}
                  required
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder="e.g. Personal family decision..."
                  className="w-full text-xs p-3 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-3.5 py-1.5 text-xs text-[#788394] hover:text-[#243B55] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer"
                >
                  Confirm Revocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
