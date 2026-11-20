import { readDb } from '../db/database.ts';
import { type FairnessMetric, type OrganType } from '../types/index.ts';

const PRIVACY_SUPPRESSION_THRESHOLD = 20;

// Synthetic regional epidemiological registry cohort baseline combined dynamically with live persisted DB records
const BASELINE_SYNTHETIC_STATS: Record<
  OrganType,
  {
    baseEvaluated: number;
    baseTransplanted: number;
    baseWaitlistSum: number;
    baseAcceptanceRate: number;
    ageBuckets: { label: string; count: number; share: number; avgWait: number }[];
    regions: { name: string; regShare: number; allocShare: number }[];
  }
> = {
  kidney: {
    baseEvaluated: 1415,
    baseTransplanted: 184,
    baseWaitlistSum: 1415 * 785,
    baseAcceptanceRate: 88.4,
    ageBuckets: [
      { label: 'Age 18-35', count: 340, share: 24.2, avgWait: 710 },
      { label: 'Age 36-50', count: 610, share: 43.5, avgWait: 780 },
      { label: 'Age 51-65', count: 420, share: 29.8, avgWait: 840 },
      { label: 'Age >65 (Small Cohort)', count: 14, share: 2.5, avgWait: 910 },
    ],
    regions: [
      { name: 'Zone 1 (Hyderabad Central & North)', regShare: 46.2, allocShare: 47.1 },
      { name: 'Zone 2 (Secunderabad & East)', regShare: 28.5, allocShare: 27.8 },
      { name: 'Zone 3 (Cyberabad & West)', regShare: 25.3, allocShare: 25.1 },
    ],
  },
  liver: {
    baseEvaluated: 488,
    baseTransplanted: 92,
    baseWaitlistSum: 488 * 245,
    baseAcceptanceRate: 91.2,
    ageBuckets: [
      { label: 'MELD > 30 (Urgent)', count: 85, share: 54.3, avgWait: 62 },
      { label: 'MELD 21-30', count: 195, share: 32.6, avgWait: 210 },
      { label: 'MELD 15-20', count: 190, share: 13.1, avgWait: 410 },
      { label: 'Pediatric Liver (<12 yrs)', count: 8, share: 0.0, avgWait: 140 },
    ],
    regions: [
      { name: 'Zone 1', regShare: 52.0, allocShare: 51.5 },
      { name: 'Zone 2', regShare: 26.0, allocShare: 27.0 },
      { name: 'Zone 3', regShare: 22.0, allocShare: 21.5 },
    ],
  },
  heart: {
    baseEvaluated: 210,
    baseTransplanted: 48,
    baseWaitlistSum: 210 * 96,
    baseAcceptanceRate: 94.1,
    ageBuckets: [
      { label: 'Status 1A (Critical)', count: 72, share: 62.5, avgWait: 38 },
      { label: 'Status 1B (Urgent)', count: 96, share: 29.2, avgWait: 112 },
      { label: 'Pediatric Cardiac (<18)', count: 11, share: 8.3, avgWait: 74 },
    ],
    regions: [
      { name: 'Zone 1 (Tertiary Centers)', regShare: 58.0, allocShare: 57.2 },
      { name: 'Zone 2', regShare: 24.0, allocShare: 24.5 },
      { name: 'Zone 3', regShare: 18.0, allocShare: 18.3 },
    ],
  },
  lung: {
    baseEvaluated: 95,
    baseTransplanted: 19,
    baseWaitlistSum: 95 * 190,
    baseAcceptanceRate: 84.0,
    ageBuckets: [
      { label: 'LAS > 50', count: 38, share: 58.0, avgWait: 145 },
      { label: 'LAS <= 50', count: 49, share: 42.0, avgWait: 230 },
      { label: 'Rare Cystic Cohort', count: 8, share: 0.0, avgWait: 180 },
    ],
    regions: [
      { name: 'Zone 1', regShare: 60.0, allocShare: 59.0 },
      { name: 'Zone 2 & 3 Combined', regShare: 40.0, allocShare: 41.0 },
    ],
  },
  pancreas: {
    baseEvaluated: 64,
    baseTransplanted: 14,
    baseWaitlistSum: 64 * 410,
    baseAcceptanceRate: 86.5,
    ageBuckets: [
      { label: 'Age 18-45', count: 44, share: 71.4, avgWait: 390 },
      { label: 'Age >45', count: 16, share: 28.6, avgWait: 450 },
    ],
    regions: [
      { name: 'Zone 1', regShare: 50.0, allocShare: 51.0 },
      { name: 'Zone 2', regShare: 50.0, allocShare: 49.0 },
    ],
  },
  intestine: {
    baseEvaluated: 28,
    baseTransplanted: 6,
    baseWaitlistSum: 28 * 175,
    baseAcceptanceRate: 82.0,
    ageBuckets: [
      { label: 'Adult Multivisceral', count: 21, share: 83.3, avgWait: 182 },
      { label: 'Pediatric Intestine', count: 7, share: 16.7, avgWait: 150 },
    ],
    regions: [
      { name: 'Zone 1 Tertiary Referral', regShare: 100.0, allocShare: 100.0 },
    ],
  },
};

export async function computeFairnessMetrics(organFilter?: OrganType): Promise<FairnessMetric[]> {
  const db = await readDb();
  const organTypes: OrganType[] = organFilter
    ? [organFilter]
    : ['kidney', 'liver', 'heart', 'lung', 'pancreas', 'intestine'];

  return organTypes.map(organType => {
    const base = BASELINE_SYNTHETIC_STATS[organType];
    const dbRecipients = db.recipients.filter(r => r.organType === organType);
    const dbAuthorizedOrCompleted = db.workflowCases.filter(
      w =>
        w.organType === organType &&
        ['AUTHORIZED_DECISION', 'TRANSPORT_APPROVED', 'TRANSPLANT_COMPLETED'].includes(
          w.currentState
        )
    );

    const totalEvaluated = base.baseEvaluated + dbRecipients.length;
    const totalTransplanted = base.baseTransplanted + dbAuthorizedOrCompleted.length;
    const waitlistSum =
      base.baseWaitlistSum + dbRecipients.reduce((acc, r) => acc + r.waitlistDays, 0);
    const avgWaitlistDays = Math.round(waitlistSum / Math.max(1, totalEvaluated));

    const femaleCount = dbRecipients.filter(r => r.gender === 'F').length + Math.round(base.baseEvaluated * 0.4);
    const maleCount = dbRecipients.filter(r => r.gender === 'M').length + Math.round(base.baseEvaluated * 0.6);

    const subgroups = [
      ...base.ageBuckets.map(b => ({
        groupName: b.label,
        candidateCount: b.count,
        allocationPercent: b.share,
        avgWaitlistDays: b.avgWait,
        isSuppressed: b.count < PRIVACY_SUPPRESSION_THRESHOLD,
      })),
      ...(organType === 'kidney' || organType === 'liver'
        ? [
            {
              groupName: 'Female Candidates',
              candidateCount: femaleCount,
              allocationPercent: Number(((femaleCount / (femaleCount + maleCount)) * 100).toFixed(1)),
              avgWaitlistDays: avgWaitlistDays + 7,
              isSuppressed: femaleCount < PRIVACY_SUPPRESSION_THRESHOLD,
            },
            {
              groupName: 'Male Candidates',
              candidateCount: maleCount,
              allocationPercent: Number(((maleCount / (femaleCount + maleCount)) * 100).toFixed(1)),
              avgWaitlistDays: Math.max(1, avgWaitlistDays - 5),
              isSuppressed: maleCount < PRIVACY_SUPPRESSION_THRESHOLD,
            },
          ]
        : []),
    ];

    return {
      organType,
      totalEvaluated,
      totalTransplanted,
      avgWaitlistDays,
      acceptanceRate: base.baseAcceptanceRate,
      subgroups,
      regionalParity: base.regions.map(r => ({
        regionName: r.name,
        shareOfRegistrations: r.regShare,
        shareOfAllocations: r.allocShare,
      })),
    };
  });
}
