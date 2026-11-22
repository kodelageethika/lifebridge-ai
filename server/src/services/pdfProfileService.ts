import zlib from 'zlib';
import { mutateDb, readDb } from '../db/database.ts';
import { ValidationError, ForbiddenError } from '../middleware/errorHandler.ts';
import {
  type ExtractedCompatibilityProfile,
  type MedicalProfileRecord,
  type OrganType,
  type PublicUserAccount,
} from '../types/index.ts';
import { appendAuditEventToDb } from './auditService.ts';
import { enqueueNotification } from './notificationService.ts';

const VALID_BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const;
type ValidBloodGroup = (typeof VALID_BLOOD_GROUPS)[number];

const ORGAN_SYNONYMS: Record<string, OrganType> = {
  kidney: 'kidney',
  renal: 'kidney',
  liver: 'liver',
  hepatic: 'liver',
  heart: 'heart',
  cardiac: 'heart',
  lung: 'lung',
  pulmonary: 'lung',
  pancreas: 'pancreas',
  pancreatic: 'pancreas',
  intestine: 'intestine',
  intestinal: 'intestine',
};

function decodePdfLiteralString(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) break;
    i++;
    if (next === 'n') out += '\n';
    else if (next === 'r') out += '\r';
    else if (next === 't') out += '\t';
    else if (next === 'b') out += '\b';
    else if (next === 'f') out += '\f';
    else if (next === '(' || next === ')' || next === '\\') out += next;
    else if (/[0-7]/.test(next)) {
      const octMatch = raw.slice(i).match(/^[0-7]{1,3}/);
      if (octMatch) {
        out += String.fromCharCode(parseInt(octMatch[0], 8));
        i += octMatch[0].length - 1;
      }
    } else if (next === '\r' && raw[i + 1] === '\n') {
      i++;
    } else if (next === '\n' || next === '\r') {
      // line continuation escape
    } else {
      out += next;
    }
  }
  return out;
}

function decodePdfHexString(hexRaw: string): string {
  const clean = hexRaw.replace(/[^0-9a-fA-F]/g, '');
  const padded = clean.length % 2 === 1 ? `${clean}0` : clean;
  if (!padded) return '';
  const bytes = Buffer.from(padded, 'hex');
  // UTF-16BE BOM check
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let text = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      text += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return text;
  }
  return bytes.toString('latin1');
}

function extractTextOperatorsFromStream(content: string): string[] {
  const chunks: string[] = [];

  // Extract string literals inside (...) followed by Tj, ', " or inside [...] TJ arrays
  const btBlocks = content.match(/BT[\s\S]*?ET/g) || [content];
  for (const block of btBlocks) {
    // Match TJ arrays first or scan sequentially for literal/hex strings inside text operators
    let i = 0;
    const len = block.length;
    while (i < len) {
      if (block[i] === '(') {
        let depth = 1;
        let j = i + 1;
        while (j < len && depth > 0) {
          if (block[j] === '\\') {
            j += 2;
            continue;
          }
          if (block[j] === '(') depth++;
          else if (block[j] === ')') depth--;
          j++;
        }
        const literal = block.slice(i + 1, j - 1);
        const tail = block.slice(j, j + 16);
        if (/^\s*(?:Tj|'|")/.test(tail) || block.slice(Math.max(0, i - 120), j + 60).includes('TJ')) {
          const decoded = decodePdfLiteralString(literal);
          if (decoded.trim()) chunks.push(decoded);
        }
        i = j;
        continue;
      }

      if (block[i] === '<' && block[i + 1] !== '<') {
        const endIdx = block.indexOf('>', i + 1);
        if (endIdx !== -1) {
          const hex = block.slice(i + 1, endIdx);
          const tail = block.slice(endIdx + 1, endIdx + 16);
          if (/^\s*(?:Tj|'|")/.test(tail) || block.slice(Math.max(0, i - 120), endIdx + 60).includes('TJ')) {
            const decoded = decodePdfHexString(hex);
            if (decoded.trim()) chunks.push(decoded);
          }
          i = endIdx + 1;
          continue;
        }
      }
      i++;
    }
  }

  return chunks;
}

export function extractTextFromPdfBuffer(pdfBuffer: Buffer): string {
  if (!pdfBuffer || pdfBuffer.length < 8) {
    throw new ValidationError('Uploaded file is empty or too small to be a PDF document.');
  }

  const headerSlice = pdfBuffer.subarray(0, 16).toString('latin1');
  if (!headerSlice.includes('%PDF-')) {
    throw new ValidationError('Invalid PDF document: missing %PDF- signature header.');
  }

  const rawPdf = pdfBuffer.toString('latin1');
  const extractedSegments: string[] = [];

  // Scan all stream ... endstream sections
  const streamRegex = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\n?endstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(rawPdf)) !== null) {
    const dict = match[1];
    const streamStr = match[2];
    let decodedStream = streamStr;

    if (/\/FlateDecode\b/.test(dict)) {
      const compressed = Buffer.from(streamStr, 'latin1');
      try {
        decodedStream = zlib.inflateSync(compressed).toString('latin1');
      } catch {
        try {
          decodedStream = zlib.inflateRawSync(compressed).toString('latin1');
        } catch {
          // Non-standard or corrupted compressed stream; skip safely
          continue;
        }
      }
    } else if (/\/Crypt\b|\/ASCII85Decode\b|\/LZWDecode\b/.test(dict)) {
      continue;
    }

    const ops = extractTextOperatorsFromStream(decodedStream);
    if (ops.length > 0) {
      extractedSegments.push(ops.join(' '));
    }
  }

  // Fallback for minimalist PDFs without dict-stream framing
  if (extractedSegments.length === 0) {
    const directOps = extractTextOperatorsFromStream(rawPdf);
    if (directOps.length > 0) {
      extractedSegments.push(directOps.join(' '));
    }
  }

  const normalized = extractedSegments
    .join('\n')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized || normalized.length < 4) {
    throw new ValidationError(
      'Unable to extract readable text from the PDF. Please upload a text-searchable PDF medical profile (not an encrypted or image-only scan).'
    );
  }

  return normalized;
}

export function parseCompatibilityFromText(extractedText: string): ExtractedCompatibilityProfile {
  const keywords: string[] = [];

  // Blood Group
  let bloodGroup: ValidBloodGroup | undefined;
  const bgMatch = extractedText.match(
    /(?:blood\s*(?:group|type)|abo(?:\s*group)?)\s*[:\-]?\s*(AB[+-]|A[+-]|B[+-]|O[+-])(?:\b|(?=\s|$|,|;|\)))/i
  );
  if (bgMatch?.[1]) {
    const candidate = bgMatch[1].toUpperCase() as ValidBloodGroup;
    if (VALID_BLOOD_GROUPS.includes(candidate)) {
      bloodGroup = candidate;
      keywords.push(`Blood Group: ${bloodGroup}`);
    }
  }

  // Tissue HLA
  let tissueHLA: string | undefined;
  const hlaMatch = extractedText.match(
    /(?:hla(?:\s*typing|\s*profile|\s*alleles)?|tissue\s*(?:type|hla)|histocompatibility)\s*[:\-]?\s*([A-Za-z0-9*,:\s/-]{3,90}?)(?=\s+(?:Organ|Age|Urgency|MELD|EPTS|LAS|Condition|Diagnosis|Blood|Notes|Status)\b|\n|\r|$)/i
  );
  if (hlaMatch?.[1]) {
    const cleaned = hlaMatch[1].trim().replace(/[.;]+$/, '');
    if (cleaned.length >= 3) {
      tissueHLA = cleaned;
      keywords.push(`HLA: ${tissueHLA}`);
    }
  }

  // Organ Type
  let organType: OrganType | undefined;
  const explicitOrganMatch = extractedText.match(
    /(?:organ(?:\s*(?:type|needed|required|donated|preference))?|target\s*organ)\s*[:\-]?\s*(kidney|renal|liver|hepatic|heart|cardiac|lung|pulmonary|pancreas|pancreatic|intestine|intestinal)\b/i
  );
  const organToken = explicitOrganMatch?.[1]?.toLowerCase()
    || extractedText.match(/\b(kidney|renal|liver|hepatic|heart|cardiac|lung|pulmonary|pancreas|intestine)\b/i)?.[1]?.toLowerCase();

  if (organToken && ORGAN_SYNONYMS[organToken]) {
    organType = ORGAN_SYNONYMS[organToken];
    keywords.push(`Organ: ${organType}`);
  }

  // Age
  let age: number | undefined;
  const ageMatch = extractedText.match(/(?:patient\s*age|donor\s*age|age)\s*[:\-]?\s*(\d{1,3})\b/i);
  if (ageMatch?.[1]) {
    const parsed = parseInt(ageMatch[1], 10);
    if (parsed >= 18 && parsed <= 100) {
      age = parsed;
      keywords.push(`Age: ${age}`);
    }
  }

  // Urgency Score
  let urgencyScore: number | undefined;
  const urgencyMatch = extractedText.match(
    /(?:urgency(?:\s*score|\s*index)?|meld(?:\s*score)?|epts(?:\s*score)?|las(?:\s*score)?)\s*[:\-]?\s*(\d{1,3})\b/i
  );
  if (urgencyMatch?.[1]) {
    const parsed = parseInt(urgencyMatch[1], 10);
    if (parsed >= 1 && parsed <= 100) {
      urgencyScore = parsed;
      keywords.push(`Urgency Score: ${urgencyScore}`);
    }
  }

  // Clinical / Condition Notes
  let conditionNotes: string | undefined;
  const condMatch = extractedText.match(
    /(?:diagnosis|condition(?:\s*notes)?|clinical\s*(?:notes|summary)|indication)\s*[:\-]?\s*([^\n\r]{4,240})/i
  );
  if (condMatch?.[1]) {
    conditionNotes = condMatch[1].trim();
    keywords.push('Clinical Notes Extracted');
  }

  return {
    bloodGroup,
    tissueHLA,
    organType,
    age,
    urgencyScore,
    conditionNotes,
    extractedKeywords: keywords,
  };
}

export async function uploadAndProcessMedicalProfilePdf(
  input: { fileName: string; pdfBase64: string },
  actor: PublicUserAccount
): Promise<MedicalProfileRecord> {
  if (actor.role !== 'donor' && actor.role !== 'recipient') {
    throw new ForbiddenError('Only registered donors and recipients can upload personal PDF medical profiles.');
  }

  const base64Body = input.pdfBase64.replace(/^data:application\/pdf;base64,/i, '').trim();
  if (!base64Body) {
    throw new ValidationError('PDF file payload is empty.');
  }

  const pdfBuffer = Buffer.from(base64Body, 'base64');
  if (pdfBuffer.length > 5 * 1024 * 1024) {
    throw new ValidationError('PDF medical profile exceeds maximum allowed size of 5 MB.');
  }

  const extractedText = extractTextFromPdfBuffer(pdfBuffer);
  const compatibility = parseCompatibilityFromText(extractedText);

  return mutateDb((db) => {
    const nowIso = new Date().toISOString();
    let linkedEntityId: string | undefined;

    if (actor.role === 'donor') {
      const donor = db.donors.find(d => d.id === actor.linkedDonorId || d.ownerUserId === actor.id);
      if (donor) {
        linkedEntityId = donor.id;
        if (compatibility.bloodGroup) donor.bloodGroup = compatibility.bloodGroup;
        if (compatibility.tissueHLA) donor.tissueHLA = compatibility.tissueHLA;
        if (compatibility.age) donor.age = compatibility.age;
        if (compatibility.organType) {
          const existingConsent = donor.consents.find(c => c.organType === compatibility.organType);
          if (!existingConsent) {
            donor.consents.push({
              organType: compatibility.organType,
              consented: true,
              version: '1.0.0',
              timestamp: nowIso,
              verifiedBy: 'Extracted from Uploaded Medical Profile PDF',
              verificationStatus: 'VERIFIED',
            });
          }
        }
        donor.documentsVerified = true;
      }
    } else {
      const recipient = db.recipients.find(r => r.id === actor.linkedRecipientId || r.ownerUserId === actor.id);
      if (recipient) {
        linkedEntityId = recipient.id;
        if (compatibility.bloodGroup) recipient.bloodGroup = compatibility.bloodGroup;
        if (compatibility.tissueHLA) recipient.tissueHLA = compatibility.tissueHLA;
        if (compatibility.organType) recipient.organType = compatibility.organType;
        if (compatibility.age) recipient.age = compatibility.age;
        if (compatibility.urgencyScore) recipient.urgencyScore = compatibility.urgencyScore;
      }
    }

    const record: MedicalProfileRecord = {
      id: `MEDPDF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      userId: actor.id,
      ownerRole: actor.role as 'donor' | 'recipient',
      linkedEntityId,
      fileName: input.fileName,
      fileSizeBytes: pdfBuffer.length,
      uploadedAt: nowIso,
      extractedText,
      compatibility,
    };

    db.medicalProfiles.unshift(record);

    appendAuditEventToDb(db, {
      eventType: 'MEDICAL_PROFILE_PDF_EXTRACTED',
      actorRole: actor.role,
      actorName: actor.displayName,
      entityType: 'MEDICAL_PROFILE',
      entityId: record.id,
      payloadSummary: `PDF medical profile "${input.fileName}" parsed (${compatibility.extractedKeywords.join(', ') || 'text extracted'}) for ${actor.role} ${actor.id}.`,
    });

    enqueueNotification(db, {
      userId: actor.id,
      targetRole: actor.role,
      category: 'CONSENT',
      title: 'Medical Profile PDF Processed',
      message: `Extracted compatibility details from ${input.fileName} and updated your matching profile.`,
      relatedEntityId: record.id,
    });

    return record;
  });
}

export async function listMedicalProfilesForActor(
  actor: PublicUserAccount
): Promise<MedicalProfileRecord[]> {
  const db = await readDb();
  if (actor.role === 'donor' || actor.role === 'recipient') {
    return db.medicalProfiles.filter(m => m.userId === actor.id);
  }
  return db.medicalProfiles;
}
