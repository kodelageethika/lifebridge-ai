import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { OrganTag } from '../common/OrganTag.tsx';
import { AiInsightPanel } from '../common/AiInsightPanel.tsx';
import { apiRequest } from '../../services/api.ts';
import { OrganType } from '../../types/index.ts';
import {
  Heart,
  FileCheck,
  CheckCircle2,
  Edit3,
} from 'lucide-react';

const ALL_ORGANS: OrganType[] = ['kidney', 'liver', 'heart', 'lung', 'pancreas', 'intestine'];

export const PatientPortalView: React.FC = () => {
  const {
    currentUserRole,
    currentUserName,
    donors,
    recipients,
    recoveryRecords,
    notifications,
    withdrawDonorConsent,
    reinstateDonorConsent,
    toggleOrganConsent,
    markNotificationRead,
    setActiveView,
    addToast,
  } = useApp();
  const { updateProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'registration' | 'consent' | 'documents' | 'notifications' | 'recovery'>('registration');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(currentUserName);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<{
    summary: string;
    keyClinicalFactors: string[];
    readinessObservations: string[];
    disclaimer: string;
  } | null>(null);

  const myDonor = donors[0];
  const myRecipient = recipients[0];
  const myRecovery = recoveryRecords[0];
  const isDonor = currentUserRole === 'donor';

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myDonor || !withdrawReason.trim()) return;
    await withdrawDonorConsent(myDonor.id, withdrawReason);
    setShowWithdrawModal(false);
    setWithdrawReason('');
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftName.trim()) return;
    try {
      await updateProfile(draftName.trim());
      setEditingName(false);
      addToast('success', 'Profile Updated', 'Display name saved to your account.');
    } catch (err) {
      addToast('error', 'Update Failed', err instanceof Error ? err.message : 'Unable to save profile');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-2">
      {/* Top Greeting Card */}
      <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#E98F83]">
            {isDonor ? 'Donor Portal' : 'Recipient Portal'}
          </span>

          {editingName ? (
            <form onSubmit={handleSaveName} className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                className="text-sm font-bold px-3 py-1.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
              />
              <button type="submit" className="px-3 py-1.5 text-xs font-bold bg-[#E98F83] text-white rounded-xl cursor-pointer">
                Save
              </button>
              <button type="button" onClick={() => setEditingName(false)} className="px-2 py-1 text-xs text-[#788394] cursor-pointer">
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2 mt-0.5">
              <h1 className="text-2xl font-bold text-[#243B55] dark:text-white">
                Welcome, {currentUserName}
              </h1>
              <button
                onClick={() => {
                  setDraftName(currentUserName);
                  setEditingName(true);
                }}
                title="Edit Display Name"
                className="p-1 text-[#788394] hover:text-[#E98F83] cursor-pointer"
              >
                <Edit3 size={14} />
              </button>
            </div>
          )}

          <p className="text-xs text-[#788394] dark:text-[#94A3B8] mt-1">
            {isDonor
              ? 'Review your organ donation pledge, active consents, and donor card.'
              : 'Track your confidential waitlist registration and hospital coordination.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('landing')}
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
          Notifications ({notifications.length})
        </button>
      </div>

      {/* Tab 1: Registration Overview */}
      {activeTab === 'registration' && (
        <div className="space-y-6">
          {isDonor ? (
            myDonor ? (
              <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-[#EFE7DE] dark:border-[#273A52]">
                  <div>
                    <span className="text-xs text-[#788394] block">Donor Identifier</span>
                    <span className="text-base font-bold font-mono text-[#243B55] dark:text-white">
                      {myDonor.anonymizedCode}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      myDonor.isWithdrawn
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
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

                {/* Digital Donor Card */}
                <div className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-[#F8E8E3] to-[#F8F5EF] dark:from-[#1E2E40] dark:to-[#152232] border border-[#EFE7DE] dark:border-[#273A52] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart size={18} className="text-[#E98F83] fill-current" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[#243B55] dark:text-white">
                        Official Organ Donor Card
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#788394]">
                      Registry #{myDonor.anonymizedCode}
                    </span>
                  </div>

                  <div className="text-xs text-[#243B55] dark:text-white font-medium">
                    This card certifies that <span className="font-bold">{currentUserName}</span> has registered organ donation preferences for transplantation support.
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {myDonor.consents
                      .filter(c => c.consented)
                      .map(c => (
                        <OrganTag key={c.organType} organType={c.organType} size="sm" />
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] text-xs text-[#788394]">
                No donor card linked yet. Register a pledge from the public landing page to create your record.
              </div>
            )
          ) : myRecipient ? (
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
                  <span className="font-semibold text-[#243B55] dark:text-white capitalize">
                    {myRecipient.organType}
                  </span>
                </div>
                <div>
                  <span className="text-[#788394] block">Waitlist Duration:</span>
                  <span className="font-semibold text-[#243B55] dark:text-white">
                    {myRecipient.waitlistDays} days
                  </span>
                </div>
                <div>
                  <span className="text-[#788394] block">Registered Hospital:</span>
                  <span className="font-semibold text-[#243B55] dark:text-white">
                    {myRecipient.hospitalName}
                  </span>
                </div>
                <div>
                  <span className="text-[#788394] block">Medical Verification:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {myRecipient.medicalVerificationStatus}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] text-xs text-[#788394] dark:text-[#94A3B8] leading-relaxed">
                <span className="font-bold text-[#243B55] dark:text-white">Confidentiality Protected: </span>
                In accordance with medical privacy standards, exact ranking numbers and other candidates&apos; medical records are kept confidential.
              </div>

              <AiInsightPanel
                title="AI Waitlist Profile Summary"
                subtitle="Plain-language advisory summary of your verified registration status."
                buttonLabel="Summarize My Profile"
                isLoading={aiLoading}
                error={aiError}
                onGenerate={async () => {
                  if (aiLoading) return;
                  setAiLoading(true);
                  setAiError(null);
                  try {
                    const res = await apiRequest<{
                      summary: string;
                      keyClinicalFactors: string[];
                      readinessObservations: string[];
                      disclaimer: string;
                    }>('/api/v1/ai/recipient-summary', {
                      method: 'POST',
                      body: { recipientId: myRecipient.id },
                    });
                    setAiSummary(res);
                  } catch (err) {
                    setAiError(err instanceof Error ? err.message : 'Unable to generate summary');
                  } finally {
                    setAiLoading(false);
                  }
                }}
              >
                {aiSummary && (
                  <div className="space-y-2 pt-2 border-t border-[#EFE7DE] dark:border-[#273A52] text-xs">
                    <p className="text-[#243B55] dark:text-white leading-relaxed">{aiSummary.summary}</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-[#788394]">
                      {aiSummary.readinessObservations.map((obs, i) => (
                        <li key={i}>{obs}</li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-[#788394]">{aiSummary.disclaimer}</p>
                  </div>
                )}
              </AiInsightPanel>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] text-xs text-[#788394]">
              No recipient waitlist profile linked yet.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Donor Consent Management */}
      {activeTab === 'consent' && isDonor && myDonor && (
        <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#243B55] dark:text-white">
                My Organ Donation Preferences
              </h2>
              <p className="text-xs text-[#788394] dark:text-[#94A3B8]">
                Toggle individual organ consents or revoke full consent anytime. Changes persist on server immediately.
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
            {ALL_ORGANS.map(org => {
              const entry = myDonor.consents.find(c => c.organType === org);
              const isConsented = Boolean(entry?.consented);
              return (
                <div
                  key={org}
                  className="p-4 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#111A26] space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <OrganTag organType={org} size="sm" />
                    <button
                      disabled={myDonor.isWithdrawn}
                      onClick={() => toggleOrganConsent(myDonor.id, org, !isConsented)}
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg cursor-pointer disabled:opacity-50 ${
                        isConsented
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {isConsented ? 'Consented' : 'Opted Out'}
                    </button>
                  </div>
                  <div className="text-[11px] text-[#788394]">
                    {entry ? `Updated ${new Date(entry.timestamp).toLocaleDateString()}` : 'Not pledged yet'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Recovery Tracker */}
      {activeTab === 'recovery' && !isDonor && (
        <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-5">
          {myRecovery ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-[#EFE7DE] dark:border-[#273A52]">
                <h2 className="text-base font-bold text-[#243B55] dark:text-white">
                  My Post-Transplant Recovery ({myRecovery.recipientCode})
                </h2>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {myRecovery.graftStatus}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] space-y-1">
                  <span className="text-[#788394]">Medication Adherence</span>
                  <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {myRecovery.medicationAdherencePercent}%
                  </div>
                  <span className="text-[10px] text-[#788394]">Immunosuppressive protocol active</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] space-y-1">
                  <span className="text-[#788394]">Next Hospital Appointment</span>
                  <div className="text-sm font-bold text-[#243B55] dark:text-white">
                    {myRecovery.nextScheduledDate}
                  </div>
                  <span className="text-[10px] text-[#788394]">Follow-up Slot</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] space-y-1">
                  <span className="text-[#788394]">Latest Clinician Note</span>
                  <div className="text-xs font-medium text-[#243B55] dark:text-white line-clamp-3">
                    {myRecovery.clinicianNotes}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-[#788394]">
              Post-transplant recovery milestones appear here after transplant completion.
            </p>
          )}
        </div>
      )}

      {/* Tab: Documents */}
      {activeTab === 'documents' && (
        <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-4">
          <h2 className="text-base font-bold text-[#243B55] dark:text-white">Verified Medical Documents</h2>

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
          <h2 className="text-base font-bold text-[#243B55] dark:text-white">Registry Updates & Notifications</h2>

          <div className="space-y-2.5 text-xs">
            {notifications.length === 0 ? (
              <p className="text-[#788394]">No notifications recorded for your account yet.</p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.isRead) markNotificationRead(n.id);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer space-y-0.5 ${
                    n.isRead
                      ? 'bg-[#F8F5EF] dark:bg-[#111A26] border-[#EFE7DE] dark:border-[#273A52]'
                      : 'bg-[#F8E8E3]/50 dark:bg-[#2C1C1A]/50 border-[#E98F83]/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#243B55] dark:text-white">{n.title}</span>
                    <span className="text-[10px] text-[#788394]">
                      {n.isRead ? 'Read' : 'Unread · Click to acknowledge'}
                    </span>
                  </div>
                  <p className="text-[#788394]">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Revocation Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#152232] rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#243B55] dark:text-white">Revoke Organ Donor Consent</h3>
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
                  onChange={e => setWithdrawReason(e.target.value)}
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
