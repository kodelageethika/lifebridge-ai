-- LifeBridge AI Initial PostgreSQL Schema Migration (0001_init)
-- Matches prisma/schema.prisma

CREATE TYPE "UserRole" AS ENUM ('coordinator', 'medical', 'hospital', 'donor', 'recipient', 'admin');
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "OrganType" AS ENUM ('kidney', 'liver', 'heart', 'lung', 'pancreas', 'intestine');
CREATE TYPE "WorkflowState" AS ENUM (
  'ORGAN_REGISTERED',
  'MATCHING_COMPLETED',
  'COORDINATOR_REVIEW',
  'MEDICAL_REVIEW',
  'AUTHORIZED_DECISION',
  'TRANSPORT_APPROVED',
  'TRANSPLANT_COMPLETED',
  'REJECTED',
  'WITHDRAWN',
  'CANCELLED',
  'ESCALATED',
  'NEEDS_VERIFICATION'
);

CREATE TABLE "Hospital" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "tier" TEXT NOT NULL,
  CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HospitalCapability" (
  "id" TEXT NOT NULL,
  "hospitalId" TEXT NOT NULL,
  "organType" "OrganType" NOT NULL,
  "isCapable" BOOLEAN NOT NULL,
  "isReady" BOOLEAN NOT NULL,
  "activeSurgicalTeam" TEXT NOT NULL,
  "icuBedAvailable" BOOLEAN NOT NULL,
  "lastVerifiedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HospitalCapability_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HospitalCapability_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HospitalCapability_hospitalId_organType_key" ON "HospitalCapability"("hospitalId", "organType");

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "licenseOrBadgeId" TEXT,
  "hospitalId" TEXT,
  "linkedDonorId" TEXT,
  "linkedRecipientId" TEXT,
  "firebaseUid" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastLoginAt" TIMESTAMP(3),
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_linkedDonorId_key" ON "User"("linkedDonorId");
CREATE UNIQUE INDEX "User_linkedRecipientId_key" ON "User"("linkedRecipientId");
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");

CREATE TABLE "Donor" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "anonymizedCode" TEXT NOT NULL,
  "age" INTEGER NOT NULL,
  "gender" TEXT NOT NULL,
  "bloodGroup" TEXT NOT NULL,
  "tissueHLA" TEXT NOT NULL,
  "hospitalId" TEXT NOT NULL,
  "hospitalName" TEXT,
  "donationType" TEXT NOT NULL,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isWithdrawn" BOOLEAN NOT NULL DEFAULT false,
  "withdrawalReason" TEXT,
  "withdrawalTimestamp" TIMESTAMP(3),
  "documentsVerified" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Donor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Donor_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Donor_anonymizedCode_key" ON "Donor"("anonymizedCode");
CREATE INDEX "Donor_hospitalId_isWithdrawn_idx" ON "Donor"("hospitalId", "isWithdrawn");

CREATE TABLE "DonorOrganConsent" (
  "id" TEXT NOT NULL,
  "donorId" TEXT NOT NULL,
  "organType" "OrganType" NOT NULL,
  "consented" BOOLEAN NOT NULL,
  "version" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedBy" TEXT,
  "verificationStatus" TEXT NOT NULL,
  CONSTRAINT "DonorOrganConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DonorOrganConsent_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DonorOrganConsent_donorId_organType_key" ON "DonorOrganConsent"("donorId", "organType");

CREATE TABLE "Recipient" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "anonymizedCode" TEXT NOT NULL,
  "age" INTEGER NOT NULL,
  "gender" TEXT NOT NULL,
  "bloodGroup" TEXT NOT NULL,
  "tissueHLA" TEXT NOT NULL,
  "organType" "OrganType" NOT NULL,
  "hospitalId" TEXT NOT NULL,
  "hospitalName" TEXT,
  "urgencyScore" DOUBLE PRECISION NOT NULL,
  "urgencyMetricName" TEXT NOT NULL,
  "waitlistDays" INTEGER NOT NULL,
  "distanceKm" DOUBLE PRECISION NOT NULL,
  "medicalVerificationStatus" TEXT NOT NULL,
  "missingDataFlags" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isPediatric" BOOLEAN DEFAULT false,
  CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Recipient_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Recipient_anonymizedCode_key" ON "Recipient"("anonymizedCode");
CREATE INDEX "Recipient_organType_status_idx" ON "Recipient"("organType", "status");
CREATE INDEX "Recipient_hospitalId_idx" ON "Recipient"("hospitalId");

CREATE TABLE "OrganRecord" (
  "id" TEXT NOT NULL,
  "donorId" TEXT NOT NULL,
  "donorCode" TEXT,
  "organType" "OrganType" NOT NULL,
  "retrievalTimestamp" TIMESTAMP(3) NOT NULL,
  "preservationWindowHours" DOUBLE PRECISION NOT NULL,
  "bloodGroup" TEXT NOT NULL,
  "tissueHLA" TEXT NOT NULL,
  "hospitalId" TEXT NOT NULL,
  "hospitalName" TEXT,
  "donationType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "coldIschemiaStart" TIMESTAMP(3) NOT NULL,
  "conditionNotes" TEXT NOT NULL,
  CONSTRAINT "OrganRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganRecord_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrganRecord_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "OrganRecord_organType_status_idx" ON "OrganRecord"("organType", "status");

CREATE TABLE "OrganConfig" (
  "id" TEXT NOT NULL,
  "organType" "OrganType" NOT NULL,
  "configVersion" TEXT NOT NULL,
  "rulesetVersion" TEXT NOT NULL,
  "configHash" TEXT NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'synthetic_demo',
  "preservationWindowHours" DOUBLE PRECISION NOT NULL,
  "warningThresholdHours" DOUBLE PRECISION NOT NULL,
  "weights" JSONB NOT NULL,
  "requiresHumanApproval" BOOLEAN NOT NULL DEFAULT true,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedBy" TEXT NOT NULL,
  CONSTRAINT "OrganConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganConfig_organType_key" ON "OrganConfig"("organType");

CREATE TABLE "MatchRun" (
  "id" TEXT NOT NULL,
  "organId" TEXT NOT NULL,
  "organType" "OrganType" NOT NULL,
  "donorCode" TEXT NOT NULL,
  "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "configVersion" TEXT NOT NULL,
  "rulesetVersion" TEXT NOT NULL,
  "configHash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "candidates" JSONB NOT NULL,
  "excludedCandidates" JSONB NOT NULL,
  "dataQualityChecked" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "MatchRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MatchRun_organId_fkey" FOREIGN KEY ("organId") REFERENCES "OrganRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MatchRun_organId_executedAt_idx" ON "MatchRun"("organId", "executedAt");

CREATE TABLE "WorkflowCase" (
  "id" TEXT NOT NULL,
  "caseNumber" TEXT NOT NULL,
  "organId" TEXT NOT NULL,
  "organType" "OrganType" NOT NULL,
  "donorCode" TEXT NOT NULL,
  "selectedRecipientId" TEXT,
  "selectedRecipientCode" TEXT,
  "currentState" "WorkflowState" NOT NULL,
  "matchRunId" TEXT NOT NULL,
  "coordinatorReviewer" TEXT,
  "medicalReviewer" TEXT,
  "approvalDecision" JSONB,
  "priorityLevel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkflowCase_organId_fkey" FOREIGN KEY ("organId") REFERENCES "OrganRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkflowCase_caseNumber_key" ON "WorkflowCase"("caseNumber");
CREATE INDEX "WorkflowCase_currentState_organType_idx" ON "WorkflowCase"("currentState", "organType");

CREATE TABLE "WorkflowTransition" (
  "id" TEXT NOT NULL,
  "workflowCaseId" TEXT NOT NULL,
  "fromState" "WorkflowState" NOT NULL,
  "toState" "WorkflowState" NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "actorRole" "UserRole" NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT NOT NULL,
  "supportingDocId" TEXT,
  CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkflowTransition_workflowCaseId_fkey" FOREIGN KEY ("workflowCaseId") REFERENCES "WorkflowCase"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkflowTransition_workflowCaseId_timestamp_idx" ON "WorkflowTransition"("workflowCaseId", "timestamp");

CREATE TABLE "LogisticsCase" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "organId" TEXT NOT NULL,
  "organType" "OrganType" NOT NULL,
  "originHospital" TEXT NOT NULL,
  "destinationHospital" TEXT NOT NULL,
  "distanceKm" DOUBLE PRECISION NOT NULL,
  "retrievalTime" TIMESTAMP(3) NOT NULL,
  "preservationExpiry" TIMESTAMP(3) NOT NULL,
  "preservationWindowHours" DOUBLE PRECISION NOT NULL,
  "estimatedArrival" TIMESTAMP(3) NOT NULL,
  "currentCustodian" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "delayMinutes" INTEGER NOT NULL DEFAULT 0,
  "logisticsEvents" JSONB NOT NULL,
  "escalationAlerts" JSONB NOT NULL,
  CONSTRAINT "LogisticsCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LogisticsCase_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "WorkflowCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LogisticsCase_caseId_key" ON "LogisticsCase"("caseId");
CREATE INDEX "LogisticsCase_status_organType_idx" ON "LogisticsCase"("status", "organType");

CREATE TABLE "CustodyEvent" (
  "id" TEXT NOT NULL,
  "logisticsCaseId" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stageName" TEXT NOT NULL,
  "custodianName" TEXT NOT NULL,
  "custodianRole" TEXT NOT NULL,
  "organization" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "tempCelsius" DOUBLE PRECISION NOT NULL,
  "conditionAssessment" TEXT NOT NULL,
  "signatureHash" TEXT NOT NULL,
  "notes" TEXT NOT NULL,
  CONSTRAINT "CustodyEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustodyEvent_logisticsCaseId_fkey" FOREIGN KEY ("logisticsCaseId") REFERENCES "LogisticsCase"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CustodyEvent_logisticsCaseId_timestamp_idx" ON "CustodyEvent"("logisticsCaseId", "timestamp");

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorRole" "UserRole" NOT NULL,
  "actorName" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "previousHash" TEXT NOT NULL,
  "currentHash" TEXT NOT NULL,
  "hmacSignature" TEXT NOT NULL,
  "payloadSummary" TEXT NOT NULL,
  "isTampered" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuditEvent_sequenceNumber_key" ON "AuditEvent"("sequenceNumber");
CREATE INDEX "AuditEvent_eventType_actorRole_idx" ON "AuditEvent"("eventType", "actorRole");
CREATE INDEX "AuditEvent_timestamp_idx" ON "AuditEvent"("timestamp");

CREATE TABLE "RecoveryRecord" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "recipientId" TEXT NOT NULL,
  "recipientCode" TEXT NOT NULL,
  "organType" "OrganType" NOT NULL,
  "transplantDate" TEXT NOT NULL,
  "postOpDays" INTEGER NOT NULL,
  "graftStatus" TEXT NOT NULL,
  "medicationAdherencePercent" DOUBLE PRECISION NOT NULL,
  "lastFollowUpDate" TEXT NOT NULL,
  "nextScheduledDate" TEXT NOT NULL,
  "isFollowUpMissed" BOOLEAN NOT NULL DEFAULT false,
  "labs" JSONB NOT NULL,
  "clinicianNotes" TEXT NOT NULL,
  CONSTRAINT "RecoveryRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecoveryRecord_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "RecoveryRecord_recipientId_idx" ON "RecoveryRecord"("recipientId");

CREATE TABLE "DataQualityIssue" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityCode" TEXT NOT NULL,
  "organType" "OrganType",
  "severity" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "issueDescription" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isResolved" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "DataQualityIssue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DataQualityIssue_isResolved_severity_idx" ON "DataQualityIssue"("isResolved", "severity");

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "targetRole" "UserRole",
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "relatedEntityId" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveryChannel" TEXT NOT NULL DEFAULT 'IN_APP',
  "emailStatus" TEXT,
  "dedupKey" TEXT,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Notification_dedupKey_key" ON "Notification"("dedupKey");
CREATE INDEX "Notification_userId_targetRole_isRead_idx" ON "Notification"("userId", "targetRole", "isRead");

CREATE TABLE "SimulationRecord" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "organType" "OrganType" NOT NULL,
  "candidateAId" TEXT NOT NULL,
  "candidateACode" TEXT NOT NULL,
  "candidateBId" TEXT NOT NULL,
  "candidateBCode" TEXT NOT NULL,
  "weightsUsed" JSONB NOT NULL,
  "scoreA" JSONB NOT NULL,
  "scoreB" JSONB NOT NULL,
  "recommendedSide" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SimulationRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SimulationRecord_organType_createdAt_idx" ON "SimulationRecord"("organType", "createdAt");
