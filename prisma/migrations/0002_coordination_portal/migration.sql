-- LifeBridge AI Incremental PostgreSQL Migration (0002_coordination_portal)
-- Synchronizes Hospital accreditation metadata, MedicalProfile, OrganOpportunity, and CaseCoordinationRecord with prisma/schema.prisma

ALTER TABLE "Hospital"
  ADD COLUMN IF NOT EXISTS "registrationStatus" TEXT NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS "licenseNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "registeredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewRemarks" TEXT;

CREATE TABLE IF NOT EXISTS "MedicalProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "ownerRole" TEXT NOT NULL,
  "linkedEntityId" TEXT,
  "fileName" TEXT NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "extractedText" TEXT NOT NULL,
  "compatibility" JSONB NOT NULL,
  CONSTRAINT "MedicalProfile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MedicalProfile_userId_uploadedAt_idx" ON "MedicalProfile"("userId", "uploadedAt");

CREATE TABLE IF NOT EXISTS "OrganOpportunity" (
  "id" TEXT NOT NULL,
  "hospitalId" TEXT NOT NULL,
  "hospitalName" TEXT NOT NULL,
  "organType" "OrganType" NOT NULL,
  "title" TEXT NOT NULL,
  "bloodGroup" TEXT NOT NULL,
  "tissueHLA" TEXT NOT NULL,
  "preservationWindowHours" DOUBLE PRECISION NOT NULL,
  "minUrgencyScore" DOUBLE PRECISION,
  "clinicalRequirements" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "postedByUserId" TEXT NOT NULL,
  "postedByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganOpportunity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganOpportunity_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OrganOpportunity_status_organType_idx" ON "OrganOpportunity"("status", "organType");
CREATE INDEX IF NOT EXISTS "OrganOpportunity_hospitalId_idx" ON "OrganOpportunity"("hospitalId");

CREATE TABLE IF NOT EXISTS "CaseCoordinationRecord" (
  "id" TEXT NOT NULL,
  "recordNumber" TEXT NOT NULL,
  "applicantUserId" TEXT NOT NULL,
  "applicantRole" TEXT NOT NULL,
  "applicantName" TEXT NOT NULL,
  "applicantCode" TEXT,
  "medicalProfileId" TEXT,
  "opportunityId" TEXT NOT NULL,
  "opportunityTitle" TEXT NOT NULL,
  "organType" "OrganType" NOT NULL,
  "hospitalId" TEXT NOT NULL,
  "hospitalName" TEXT NOT NULL,
  "compatibilityScore" DOUBLE PRECISION NOT NULL,
  "compatibilitySummary" TEXT NOT NULL,
  "notes" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "hospitalRemarks" TEXT,
  "withdrawnReason" TEXT,
  "reviewedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "history" JSONB NOT NULL,
  CONSTRAINT "CaseCoordinationRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CaseCoordinationRecord_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "OrganOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CaseCoordinationRecord_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CaseCoordinationRecord_recordNumber_key" ON "CaseCoordinationRecord"("recordNumber");
CREATE INDEX IF NOT EXISTS "CaseCoordinationRecord_applicantUserId_status_idx" ON "CaseCoordinationRecord"("applicantUserId", "status");
CREATE INDEX IF NOT EXISTS "CaseCoordinationRecord_hospitalId_status_idx" ON "CaseCoordinationRecord"("hospitalId", "status");
