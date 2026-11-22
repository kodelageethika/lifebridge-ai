import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { OrganTag } from '../common/OrganTag.tsx';
import { AiInsightPanel } from '../common/AiInsightPanel.tsx';
import { apiRequest } from '../../services/api.ts';
import { OrganType, PortalRecommendationItem } from '../../types/index.ts';
import {
  Heart,
  FileCheck,
  CheckCircle2,
  Edit3,
  Upload,
  Sparkles,
  ClipboardList,
  RefreshCw,
  AlertCircle,
  X,
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
    medicalProfiles,
    portalRecommendations,
    coordinationRecords,
    withdrawDonorConsent,
    reinstateDonorConsent,
    toggleOrganConsent,
    markNotificationRead,
    uploadMedicalProfilePdf,
    refreshPortalRecommendations,
    submitCoordinationRecord,
    withdrawCoordinationRecord,
    setActiveView,
    addToast,
  } = useApp();
  const { updateProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'registration' | 'recommendations' | 'applications' | 'consent' | 'documents' | 'notifications' | 'recovery'
  >('registration');
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

  // Step 3: PDF Upload state
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Step 6: Application submission modal state
  const [selectedOpportunity, setSelectedOpportunity] = useState<PortalRecommendationItem | null>(null);
  const [applicationNotes, setApplicationNotes] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);

  // Step 7: Withdraw coordination record modal state
  const [withdrawingRecordId, setWithdrawingRecordId] = useState<string | null>(null);
  const [recordWithdrawReason, setRecordWithdrawReason] = useState('');

  const myDonor = donors[0];
  const myRecipient = recipients[0];
  const myRecovery = recoveryRecords[0];
  const latestProfile = medicalProfiles[0];
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

  const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      addToast('error', 'Invalid File Type', 'Please upload a PDF (.pdf) medical profile document.');
      return;
    }

    setUploadingPdf(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read PDF file'));
        reader.readAsDataURL(file);
      });
      await uploadMedicalProfilePdf(file.name, base64);
    } catch (err) {
      addToast('error', 'Upload Failed', err instanceof Error ? err.message : 'Unable to read PDF file');
    } finally {
      setUploadingPdf(false);
      e.target.value = '';
    }
  };

  const handleConfirmSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpportunity) return;
    setSubmittingApp(true);
    const created = await submitCoordinationRecord(
      selectedOpportunity.opportunity.id,
      applicationNotes.trim() || 'Submitting compatibility profile for hospital coordination review.'
    );
    setSubmittingApp(false);
    if (created) {
      setSelectedOpportunity(null);
      setApplicationNotes('');
      setActiveTab('applications');
    }
  };

  const handleConfirmWithdrawRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawingRecordId || !recordWithdrawReason.trim()) return;
    const ok = await withdrawCoordinationRecord(withdrawingRecordId, recordWithdrawReason);
    if (ok) {
      setWithdrawingRecordId(null);
      setRecordWithdrawReason('');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-2">
      {/* Top Greeting Card */}
      <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#E98F83]">
            {isDonor ? 'Donor Case Coordination Portal' : 'Recipient Case Coordination Portal'}
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
              ? 'Upload your medical profile PDF, view compatible organ coordination matches, and manage case applications.'
              : 'Upload your medical profile PDF, view compatibility recommendations, and track your case coordination records.'}
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
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#F8F5EF] dark:bg-[#121D2A] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52]">
        <button
          onClick={() => setActiveTab('registration')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'registration'
              ? 'bg-white dark:bg-[#152232] text-[#243B55] dark:text-white shadow-xs font-bold'
              : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white'
          }`}
        >
          My Registration
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'documents'
              ? 'bg-white dark:bg-[#152232] text-[#243B55] dark:text-white shadow-xs font-bold'
              : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white'
          }`}
        >
          Medical Profile (PDF)
        </button>

        <button
          onClick={() => setActiveTab('recommendations')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'recommendations'
              ? 'bg-white dark:bg-[#152232] text-[#243B55] dark:text-white shadow-xs font-bold'
              : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white'
          }`}
        >
          Recommendations ({portalRecommendations.filter(r => r.isSuitable).length})
        </button>

        <button
          onClick={() => setActiveTab('applications')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'applications'
              ? 'bg-white dark:bg-[#152232] text-[#243B55] dark:text-white shadow-xs font-bold'
              : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white'
          }`}
        >
          My Applications ({coordinationRecords.length})
        </button>

        {isDonor ? (
          <button
            onClick={() => setActiveTab('consent')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
              activeTab === 'consent'
                ? 'bg-white dark:bg-[#152232] text-[#243B55] dark:text-white shadow-xs font-bold'
                : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white'
            }`}
          >
            Consent Preferences
          </button>
        ) : (
          <button
            onClick={() => setActiveTab('recovery')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
              activeTab === 'recovery'
                ? 'bg-white dark:bg-[#152232] text-[#243B55] dark:text-white shadow-xs font-bold'
                : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white'
            }`}
          >
            Recovery
          </button>
        )}

        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[#788394] block">Registered Hospital:</span>
                    <span className="font-semibold text-[#243B55] dark:text-white">{myDonor.hospitalName}</span>
                  </div>
                  <div>
                    <span className="text-[#788394] block">Blood Group:</span>
                    <span className="font-semibold text-[#243B55] dark:text-white">{myDonor.bloodGroup}</span>
                  </div>
                  <div>
                    <span className="text-[#788394] block">Tissue HLA:</span>
                    <span className="font-semibold font-mono text-[#243B55] dark:text-white">{myDonor.tissueHLA}</span>
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
                  <span className="text-[#788394] block">Blood Group / HLA:</span>
                  <span className="font-semibold text-[#243B55] dark:text-white">
                    {myRecipient.bloodGroup} · {myRecipient.tissueHLA}
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

          {/* Quick Next Steps Callout */}
          <div className="bg-white dark:bg-[#152232] p-5 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs space-y-0.5">
              <span className="font-bold text-[#243B55] dark:text-white block">
                Next Step: Upload Medical Profile & Check Organ Recommendations
              </span>
              <span className="text-[#788394]">
                Upload a PDF medical summary to auto-extract blood group, HLA typing, and score compatible opportunities.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('documents')}
                className="px-3.5 py-2 text-xs font-semibold bg-[#F8F5EF] dark:bg-[#1E2E40] text-[#243B55] dark:text-white rounded-xl hover:border-[#E98F83] cursor-pointer"
              >
                Upload PDF Profile
              </button>
              <button
                onClick={() => setActiveTab('recommendations')}
                className="px-3.5 py-2 text-xs font-bold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl cursor-pointer"
              >
                View Matches
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Step 3 - Medical Profile PDF Upload & Compatibility Extraction */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#243B55] dark:text-white">
                  Upload PDF Medical Profile
                </h2>
                <p className="text-xs text-[#788394] dark:text-[#94A3B8]">
                  Upload a text-based PDF clinical report. The system extracts text and identifies Blood Group, HLA typing, Organ type, and Urgency indicators automatically.
                </p>
              </div>
              <label className="px-4 py-2 text-xs font-bold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs">
                <Upload size={14} />
                <span>{uploadingPdf ? 'Extracting PDF...' : 'Select PDF File'}</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={uploadingPdf}
                  onChange={handlePdfFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {latestProfile ? (
              <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#243B55] dark:text-white">
                    <FileCheck size={15} className="text-emerald-600" />
                    <span>{latestProfile.fileName}</span>
                  </div>
                  <span className="text-[11px] text-[#788394]">
                    Uploaded {new Date(latestProfile.uploadedAt).toLocaleString()} ({Math.max(1, Math.round(latestProfile.fileSizeBytes / 1024))} KB)
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#788394] block mb-1.5">
                    Extracted Compatibility Attributes
                  </span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {latestProfile.compatibility.extractedKeywords.length > 0 ? (
                      latestProfile.compatibility.extractedKeywords.map((kw, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#152232] border border-[#EFE7DE] dark:border-[#273A52] font-semibold text-[#243B55] dark:text-white"
                        >
                          {kw}
                        </span>
                      ))
                    ) : (
                      <span className="text-[#788394]">Text extracted (no explicit structured tokens found).</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#788394] block mb-1">
                    Extracted PDF Text Preview
                  </span>
                  <pre className="p-3 rounded-xl bg-white dark:bg-[#0E1722] border border-[#EFE7DE] dark:border-[#273A52] text-[11px] text-[#546070] dark:text-[#CBD5E1] whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                    {latestProfile.extractedText}
                  </pre>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setActiveTab('recommendations')}
                    className="px-4 py-2 text-xs font-bold bg-[#243B55] hover:bg-[#1B2D42] text-white rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles size={13} />
                    <span>View Matching Opportunities</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-2xl border border-dashed border-[#EFE7DE] dark:border-[#273A52] text-center text-xs text-[#788394]">
                No PDF medical profile uploaded yet. Upload your medical summary PDF above to populate compatibility extraction.
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-4">
            <h2 className="text-base font-bold text-[#243B55] dark:text-white">Verified Registry Documents</h2>

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
        </div>
      )}

      {/* Tab 3: Steps 4-6 - Matching Score & View Recommendations & Select Suitable Organ */}
      {activeTab === 'recommendations' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#243B55] dark:text-white">
                Compatible Organ Donation Recommendations
              </h2>
              <p className="text-xs text-[#788394] dark:text-[#94A3B8]">
                Deterministic matching compares your medical profile against active organ donation programs at approved hospitals.
              </p>
            </div>
            <button
              onClick={refreshPortalRecommendations}
              className="px-3.5 py-2 text-xs font-semibold bg-[#F8F5EF] dark:bg-[#1E2E40] text-[#243B55] dark:text-white rounded-xl hover:border-[#E98F83] flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Recalculate Scores</span>
            </button>
          </div>

          {portalRecommendations.length === 0 ? (
            <div className="bg-white dark:bg-[#152232] p-8 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] text-center text-xs text-[#788394]">
              No open organ donation opportunities are currently listed by approved hospitals.
            </div>
          ) : (
            <div className="space-y-4">
              {portalRecommendations.map(item => {
                const { opportunity: opp, matchingScore, isSuitable, recommendationReason, factors } = item;
                const alreadyApplied = coordinationRecords.some(
                  r => r.opportunityId === opp.id && ['SUBMITTED', 'UNDER_HOSPITAL_REVIEW', 'APPROVED'].includes(r.status)
                );

                return (
                  <div
                    key={opp.id}
                    className={`bg-white dark:bg-[#152232] p-5 rounded-3xl border transition-all space-y-4 ${
                      isSuitable
                        ? 'border-emerald-200 dark:border-emerald-800/70'
                        : 'border-[#EFE7DE] dark:border-[#273A52] opacity-85'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <OrganTag organType={opp.organType} size="sm" />
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isSuitable
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            {isSuitable ? 'Compatible Match' : 'Compatibility Check Note'}
                          </span>
                          <span className="text-[11px] font-mono text-[#788394]">Blood: {opp.bloodGroup}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[#243B55] dark:text-white">{opp.title}</h3>
                        <p className="text-xs text-[#788394]">{opp.hospitalName}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] uppercase tracking-wider text-[#788394] block">
                          Match Score
                        </span>
                        <span className="text-2xl font-bold font-mono text-[#E98F83] tabular-nums">
                          {matchingScore}
                          <span className="text-xs text-[#788394] font-normal">/100</span>
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F8F5EF] dark:bg-[#111A26] text-xs text-[#243B55] dark:text-[#CBD5E1] space-y-1">
                      <div className="font-semibold">{recommendationReason}</div>
                      <div className="text-[11px] text-[#788394]">
                        <span className="font-semibold">HLA Profile:</span> {opp.tissueHLA} ·{' '}
                        <span className="font-semibold">Requirements:</span> {opp.clinicalRequirements}
                      </div>
                    </div>

                    {/* Factor Score Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                      {factors.map(f => (
                        <div
                          key={f.factorName}
                          className="p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] space-y-1"
                        >
                          <div className="flex justify-between font-semibold text-[#243B55] dark:text-white">
                            <span>{f.factorName}</span>
                            <span className="font-mono">
                              {f.score}/{f.maxScore}
                            </span>
                          </div>
                          <p className="text-[#788394]">{f.explanation}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {alreadyApplied ? (
                        <button
                          onClick={() => setActiveTab('applications')}
                          className="px-4 py-2 text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl cursor-pointer"
                        >
                          Already Submitted · Track Record
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedOpportunity(item);
                            setApplicationNotes(
                              `Requesting ${opp.organType} coordination at ${opp.hospitalName} (${matchingScore}/100 match score).`
                            );
                          }}
                          className="px-4 py-2 text-xs font-bold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl cursor-pointer shadow-xs"
                        >
                          Select Organ & Submit Case Record
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Step 7 - Track Application & Withdraw */}
      {activeTab === 'applications' && (
        <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#243B55] dark:text-white flex items-center gap-2">
                <ClipboardList size={17} className="text-[#E98F83]" />
                <span>My Case Coordination Records</span>
              </h2>
              <p className="text-xs text-[#788394]">
                Track hospital review progress or withdraw eligible submissions anytime prior to final approval.
              </p>
            </div>
          </div>

          {coordinationRecords.length === 0 ? (
            <div className="p-6 rounded-2xl border border-dashed border-[#EFE7DE] dark:border-[#273A52] text-center text-xs text-[#788394] space-y-2">
              <p>You have not submitted any Case Coordination Records yet.</p>
              <button
                onClick={() => setActiveTab('recommendations')}
                className="px-4 py-2 text-xs font-bold bg-[#E98F83] text-white rounded-xl cursor-pointer"
              >
                Explore Recommended Opportunities
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {coordinationRecords.map(rec => {
                const canWithdraw = rec.status === 'SUBMITTED' || rec.status === 'UNDER_HOSPITAL_REVIEW';
                return (
                  <div
                    key={rec.id}
                    className="p-4 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#111A26] space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <OrganTag organType={rec.organType} size="sm" />
                        <span className="font-bold font-mono text-[#243B55] dark:text-white">
                          {rec.recordNumber}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            rec.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : rec.status === 'REJECTED' || rec.status === 'WITHDRAWN'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {rec.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-[#E98F83]">
                        Score: {rec.compatibilityScore}/100
                      </span>
                    </div>

                    <div>
                      <div className="font-semibold text-[#243B55] dark:text-white">{rec.opportunityTitle}</div>
                      <div className="text-[#788394]">
                        {rec.hospitalName} · Submitted {new Date(rec.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="text-[11px] text-[#546070] dark:text-[#CBD5E1]">
                      <span className="font-semibold">Notes:</span> {rec.notes}
                    </div>

                    {rec.hospitalRemarks && (
                      <div className="p-2.5 rounded-xl bg-white dark:bg-[#152232] border border-[#EFE7DE] dark:border-[#273A52] text-[11px]">
                        <span className="font-bold text-[#243B55] dark:text-white">Hospital Remarks: </span>
                        <span className="text-[#788394]">{rec.hospitalRemarks}</span>
                      </div>
                    )}

                    {rec.withdrawnReason && (
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-700 dark:text-rose-300">
                        <span className="font-bold">Withdrawal Reason: </span>
                        {rec.withdrawnReason}
                      </div>
                    )}

                    {canWithdraw && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => setWithdrawingRecordId(rec.id)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 rounded-xl hover:bg-rose-100 cursor-pointer"
                        >
                          Withdraw Application
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Donor Consent Management */}
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

      {/* Submit Case Coordination Record Modal */}
      {selectedOpportunity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#152232] rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#243B55] dark:text-white">
                Submit Case Coordination Record
              </h3>
              <button onClick={() => setSelectedOpportunity(null)} className="p-1 text-[#788394] cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-[#F8F5EF] dark:bg-[#111A26] space-y-1">
              <div className="font-bold text-[#243B55] dark:text-white">
                {selectedOpportunity.opportunity.title}
              </div>
              <div className="text-[#788394]">
                {selectedOpportunity.opportunity.hospitalName} · Match Score:{' '}
                <span className="font-bold text-[#E98F83]">{selectedOpportunity.matchingScore}/100</span>
              </div>
            </div>
            {!selectedOpportunity.isSuitable && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{selectedOpportunity.recommendationReason}</span>
              </div>
            )}
            <form onSubmit={handleConfirmSubmission} className="space-y-3">
              <div>
                <label className="block font-semibold text-[#243B55] dark:text-white mb-1">
                  Clinical Notes / Submission Summary
                </label>
                <textarea
                  rows={3}
                  required
                  value={applicationNotes}
                  onChange={e => setApplicationNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOpportunity(null)}
                  className="px-3.5 py-2 text-[#788394] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingApp}
                  className="px-4 py-2 font-bold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl cursor-pointer"
                >
                  {submittingApp ? 'Submitting...' : 'Submit Case Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Coordination Record Modal */}
      {withdrawingRecordId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#152232] rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-[#243B55] dark:text-white">
              Withdraw Case Coordination Record
            </h3>
            <p className="text-[#788394]">
              Provide a brief reason for withdrawing this application. Withdrawn records remain in the audit log for traceability.
            </p>
            <form onSubmit={handleConfirmWithdrawRecord} className="space-y-3">
              <textarea
                rows={2}
                required
                minLength={4}
                value={recordWithdrawReason}
                onChange={e => setRecordWithdrawReason(e.target.value)}
                placeholder="e.g. Selecting a closer transplant hospital..."
                className="w-full p-3 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWithdrawingRecordId(null)}
                  className="px-3.5 py-1.5 text-[#788394] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer"
                >
                  Confirm Withdrawal
                </button>
              </div>
            </form>
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
