import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { type DatabaseState } from '../types/index.ts';
import { PostgresPrismaRepository } from './postgresRepository.ts';

const OrganEnum = z.enum(['kidney', 'liver', 'heart', 'lung', 'pancreas', 'intestine']);
const RoleEnum = z.enum(['coordinator', 'medical', 'hospital', 'donor', 'recipient', 'admin']);

const JsonDatasetValidationSchema = z.object({
  users: z.array(
    z.object({
      id: z.string().min(1),
      email: z.string().email(),
      role: RoleEnum,
      status: z.enum(['ACTIVE', 'SUSPENDED']),
    }).passthrough()
  ),
  hospitals: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) }).passthrough()),
  organConfigs: z.array(z.object({ organType: OrganEnum, configVersion: z.string() }).passthrough()),
  donors: z.array(
    z.object({
      id: z.string().min(1),
      anonymizedCode: z.string().min(1),
      consents: z.array(z.object({ organType: OrganEnum, consented: z.boolean() }).passthrough()),
      isWithdrawn: z.boolean(),
    }).passthrough()
  ),
  recipients: z.array(
    z.object({
      id: z.string().min(1),
      anonymizedCode: z.string().min(1),
      organType: OrganEnum,
    }).passthrough()
  ),
  organs: z.array(z.object({ id: z.string().min(1), donorId: z.string().min(1) }).passthrough()),
  matchRuns: z.array(z.object({ id: z.string().min(1), organId: z.string().min(1) }).passthrough()),
  workflowCases: z.array(
    z.object({
      id: z.string().min(1),
      caseNumber: z.string().min(1),
      organId: z.string().min(1),
    }).passthrough()
  ),
  logisticsCases: z.array(z.object({ id: z.string().min(1), caseId: z.string().min(1) }).passthrough()),
  recoveryRecords: z.array(z.object({ id: z.string().min(1), recipientId: z.string().min(1) }).passthrough()),
  dataQualityIssues: z.array(z.object({ id: z.string().min(1) }).passthrough()),
  auditTrail: z.array(
    z.object({
      id: z.string().min(1),
      sequenceNumber: z.number().int().min(1),
      currentHash: z.string().min(1),
      hmacSignature: z.string().min(1),
    }).passthrough()
  ),
  notifications: z.array(z.object({ id: z.string().min(1) }).passthrough()),
  simulations: z.array(z.object({ id: z.string().min(1) }).passthrough()),
  medicalProfiles: z.array(z.object({ id: z.string().min(1) }).passthrough()).optional(),
  organOpportunities: z.array(z.object({ id: z.string().min(1) }).passthrough()).optional(),
  coordinationRecords: z.array(z.object({ id: z.string().min(1) }).passthrough()).optional(),
}).passthrough();

export interface MigrationReport {
  mode: 'dry-run' | 'live';
  sourceJsonPath: string;
  sourceFilePreserved: boolean;
  validationPassed: boolean;
  duplicateWarnings: string[];
  counts: {
    hospitals: number;
    organConfigs: number;
    users: number;
    sessions: number;
    donors: number;
    consents: number;
    recipients: number;
    organs: number;
    matchRuns: number;
    workflowCases: number;
    workflowTransitions: number;
    logisticsCases: number;
    custodyEvents: number;
    recoveryRecords: number;
    dataQualityIssues: number;
    auditEvents: number;
    notifications: number;
    simulations: number;
    medicalProfiles: number;
    organOpportunities: number;
    coordinationRecords: number;
  };
  auditSequenceVerifiedOrdered: boolean;
  timestamp: string;
}

function detectDuplicates<T>(items: T[], keyFn: (item: T) => string, label: string, warnings: string[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      warnings.push(`Duplicate ${label} detected: ${key}`);
    }
    seen.add(key);
  }
}

export async function runJsonToPostgresMigration(options: {
  jsonPath?: string;
  databaseUrl?: string;
  dryRun?: boolean;
  reportPath?: string;
}): Promise<MigrationReport> {
  const resolvedJsonPath = path.resolve(
    process.cwd(),
    options.jsonPath || process.env.DB_PATH || './server/data/lifebridge-db.json'
  );

  if (!fs.existsSync(resolvedJsonPath)) {
    throw new Error(`Source JSON database not found at ${resolvedJsonPath}`);
  }

  const rawContent = fs.readFileSync(resolvedJsonPath, 'utf8');
  const parsed = JSON.parse(rawContent) as DatabaseState;

  const validated = JsonDatasetValidationSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `JSON dataset failed schema validation: ${validated.error.issues[0]?.path.join('.')} - ${validated.error.issues[0]?.message}`
    );
  }

  const duplicateWarnings: string[] = [];
  detectDuplicates(parsed.users, u => u.id, 'user.id', duplicateWarnings);
  detectDuplicates(parsed.users, u => u.email.toLowerCase(), 'user.email', duplicateWarnings);
  detectDuplicates(parsed.donors, d => d.id, 'donor.id', duplicateWarnings);
  detectDuplicates(parsed.donors, d => d.anonymizedCode, 'donor.anonymizedCode', duplicateWarnings);
  detectDuplicates(parsed.recipients, r => r.id, 'recipient.id', duplicateWarnings);
  detectDuplicates(parsed.auditTrail, a => String(a.sequenceNumber), 'audit.sequenceNumber', duplicateWarnings);

  // Sort auditTrail strictly by sequenceNumber before migration
  const orderedAudit = [...parsed.auditTrail].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const auditSequenceVerifiedOrdered = orderedAudit.every((ev, idx) => ev.sequenceNumber === idx + 1);
  parsed.auditTrail = orderedAudit;

  const counts: MigrationReport['counts'] = {
    hospitals: parsed.hospitals.length,
    organConfigs: parsed.organConfigs.length,
    users: parsed.users.length,
    sessions: parsed.sessions?.length || 0,
    donors: parsed.donors.length,
    consents: parsed.donors.reduce((acc, d) => acc + d.consents.length, 0),
    recipients: parsed.recipients.length,
    organs: parsed.organs.length,
    matchRuns: parsed.matchRuns.length,
    workflowCases: parsed.workflowCases.length,
    workflowTransitions: parsed.workflowCases.reduce((acc, w) => acc + w.history.length, 0),
    logisticsCases: parsed.logisticsCases.length,
    custodyEvents: parsed.logisticsCases.reduce((acc, l) => acc + l.custodyHistory.length, 0),
    recoveryRecords: parsed.recoveryRecords.length,
    dataQualityIssues: parsed.dataQualityIssues.length,
    auditEvents: parsed.auditTrail.length,
    notifications: parsed.notifications.length,
    simulations: parsed.simulations.length,
    medicalProfiles: parsed.medicalProfiles?.length || 0,
    organOpportunities: parsed.organOpportunities?.length || 0,
    coordinationRecords: parsed.coordinationRecords?.length || 0,
  };

  if (!options.dryRun) {
    const dbUrl = (options.databaseUrl || process.env.DATABASE_URL || '').trim();
    if (!dbUrl || dbUrl.includes('USER:PASSWORD@HOST')) {
      throw new Error('Live migration requires a valid DATABASE_URL environment variable or --database-url flag.');
    }

    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    const repo = new PostgresPrismaRepository();
    try {
      await prisma.$transaction(async (tx) => {
        await repo.persistStateInTx(tx, parsed);
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  const report: MigrationReport = {
    mode: options.dryRun ? 'dry-run' : 'live',
    sourceJsonPath: resolvedJsonPath,
    sourceFilePreserved: fs.existsSync(resolvedJsonPath),
    validationPassed: true,
    duplicateWarnings,
    counts,
    auditSequenceVerifiedOrdered,
    timestamp: new Date().toISOString(),
  };

  if (options.reportPath) {
    const resolvedReportPath = path.resolve(process.cwd(), options.reportPath);
    fs.writeFileSync(resolvedReportPath, JSON.stringify(report, null, 2), 'utf8');
  }

  return report;
}

// CLI execution entrypoint: npx tsx server/src/db/migrateJsonToPostgres.ts [--dry-run]
const isMainModule =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1]?.includes('migrateJsonToPostgres');

if (isMainModule) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const jsonArg = args.find(a => a.startsWith('--json-path='))?.split('=')[1];
  const reportArg = args.find(a => a.startsWith('--report='))?.split('=')[1];

  runJsonToPostgresMigration({
    jsonPath: jsonArg,
    dryRun,
    reportPath: reportArg,
  })
    .then(report => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch(err => {
      console.error('[Migration Failed]', err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
