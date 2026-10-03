import { GoogleGenAI, createPartFromUri } from '@google/genai';
import type { GenerateContentConfig } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';
import { googleClientOptions } from '../credentials';
import { badRequest } from '../errors';
import { getKbMetadata, bulkUpdateKbEntries } from './storage';
import type { KbEntry } from './storage';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const BATCH_PREFIX = 'kb-studio-analysis-';

const AUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/generative-language',
];

const auth = new GoogleAuth({ ...googleClientOptions, scopes: AUTH_SCOPES });

const CATEGORIES = [
  'faq', 'how_to', 'manual', 'troubleshooting', 'meeting_minutes', 'policy', 'sop', 'form', 'report',
  'release_notes', 'presentation', 'memo', 'contract', 'whitepaper', 'marketing_asset', 'other',
];

const ANALYSIS_CONFIG: GenerateContentConfig = {
  responseMimeType: 'application/json',
  responseJsonSchema: {
    type: 'object',
    properties: {
      description: { type: 'string' },
      value_date: { type: 'string', description: 'YYYY-MM-DD, or empty string if no date found' },
      category: { type: 'string', enum: CATEGORIES },
    },
    required: ['description', 'value_date', 'category'],
  },
};

const DUPLICATES_CONFIG: GenerateContentConfig = {
  responseMimeType: 'application/json',
  responseJsonSchema: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' } },
        reason: { type: 'string' },
      },
      required: ['ids', 'reason'],
    },
  },
};

const languageName = (lang: string) => (lang.startsWith('en') ? 'English' : 'French');

/** Batch display names embed the bucket so history and results stay scoped to it. */
const batchDisplayName = (bucketName: string) => `${BATCH_PREFIX}${bucketName}-${Date.now()}`;

export const batchBelongsToBucket = (displayName: string, bucketName: string) => {
  if (!displayName.startsWith(BATCH_PREFIX)) return false;
  if (/^\d+$/.test(displayName.slice(BATCH_PREFIX.length))) return true; // legacy name without bucket
  const prefix = `${BATCH_PREFIX}${bucketName}-`;
  return displayName.startsWith(prefix) && /^\d+$/.test(displayName.slice(prefix.length));
};

/** Batches whose results were already written to kb.ndjson by this instance. */
const appliedBatches = new Set<string>();

const analysisPrompt = (lang: string) => `Analyze this document and return ONLY a JSON object with:
- "description": short description (1-2 sentences, in ${languageName(lang)})
- "value_date": most relevant date found in the document (YYYY-MM-DD format) or "" if none found
- "category": one of the following values:

  faq - FAQ / Questions fréquentes
  how_to - Guide pratique / How-to
  manual - Manuel / Documentation technique
  troubleshooting - Dépannage / Troubleshooting
  meeting_minutes - Compte-rendu de réunion
  policy - Politique / Règlement
  sop - Procédure opérationnelle (SOP)
  form - Formulaire
  report - Rapport
  release_notes - Notes de version
  presentation - Présentation
  memo - Note de service / Mémo
  contract - Contrat / Accord
  whitepaper - Livre blanc
  marketing_asset - Support marketing
  other - Autre

Return ONLY valid JSON, no markdown, no explanation.`;

function parseAnalysisResponse(text: string): { description: string; value_date: string; category: string } {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    description: parsed.description || '',
    value_date: parsed.value_date || '',
    category: parsed.category || 'other',
  };
}

export async function analyzeFile(entry: KbEntry, lang: string = 'fr'): Promise<{ description: string; value_date: string; category: string }> {
  const registered = await ai.files.registerFiles({ auth, uris: [entry.content.uri] });
  const fileUri = registered.files?.[0]?.uri ?? entry.content.uri;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          createPartFromUri(fileUri, entry.content.mimeType),
          { text: analysisPrompt(lang) },
        ],
      },
    ],
    config: ANALYSIS_CONFIG,
  });

  const text = response.text ?? '';
  return parseAnalysisResponse(text);
}

export async function startBatchAnalysis(bucketName: string, lang: string = 'fr'): Promise<{ batchName: string; totalFiles: number }> {
  const entries = await getKbMetadata(bucketName);
  if (entries.length === 0) {
    throw new Error('No files to analyze');
  }

  // Register files in batches of 100 (API limit)
  const REGISTER_BATCH_SIZE = 100;
  const uris = entries.map((e) => e.content.uri);
  const registeredFiles: { uri?: string }[] = [];
  for (let i = 0; i < uris.length; i += REGISTER_BATCH_SIZE) {
    const chunk = uris.slice(i, i + REGISTER_BATCH_SIZE);
    const registered = await ai.files.registerFiles({ auth: auth, uris: chunk });
    registeredFiles.push(...(registered.files ?? []));
  }

  const requests = entries.map((entry, i) => ({
    contents: [
      {
        role: 'user' as const,
        parts: [
          createPartFromUri(registeredFiles[i]?.uri ?? entry.content.uri, entry.content.mimeType),
          { text: analysisPrompt(lang) },
        ],
      },
    ],
    config: ANALYSIS_CONFIG,
    metadata: { id: entry.id },
  }));

  const batch = await ai.batches.create({
    model: MODEL,
    src: requests,
    config: {
      displayName: batchDisplayName(bucketName),
    },
  });

  return {
    batchName: batch.name!,
    totalFiles: entries.length,
  };
}

export async function listBatches(bucketName: string): Promise<{
  name: string;
  state: string;
  displayName: string;
  createTime: string;
  endTime: string;
}[]> {
  const stateMap: Record<string, string> = {
    JOB_STATE_SUCCEEDED: 'succeeded',
    JOB_STATE_FAILED: 'failed',
    JOB_STATE_CANCELLED: 'cancelled',
    JOB_STATE_RUNNING: 'running',
    JOB_STATE_PENDING: 'running',
  };

  const result: { name: string; state: string; displayName: string; createTime: string; endTime: string }[] = [];
  const pager = await ai.batches.list({ config: { pageSize: 100 } });
  for await (const batch of pager) {
    const dn = batch.displayName ?? '';
    if (!batchBelongsToBucket(dn, bucketName)) continue;
    result.push({
      name: batch.name!,
      state: stateMap[batch.state ?? ''] ?? 'unknown',
      displayName: dn,
      createTime: (batch as any).createTime ?? '',
      endTime: (batch as any).endTime ?? '',
    });
  }
  return result;
}

function extractResponseError(resp: any): string | null {
  // Check for API-level error on the response item
  if (resp.error) {
    const e = resp.error;
    return e.message || (typeof e === 'string' ? e : JSON.stringify(e));
  }

  const candidate = resp.response?.candidates?.[0];
  if (!candidate) return 'No candidate in response';

  // Check finishReason for non-success stops
  const reason = candidate.finishReason;
  if (reason && reason !== 'FINISH_REASON_STOP' && reason !== 'STOP') {
    const labels: Record<string, string> = {
      FINISH_REASON_SAFETY: 'Blocked: safety filter',
      FINISH_REASON_RECITATION: 'Blocked: unauthorized citation',
      FINISH_REASON_MAX_TOKENS: 'Stopped: max tokens reached',
      FINISH_REASON_BLOCKLIST: 'Blocked: blocked terms',
      FINISH_REASON_PROHIBITED_CONTENT: 'Blocked: prohibited content',
      FINISH_REASON_SPII: 'Blocked: sensitive personal info',
    };
    return labels[reason] || `Stopped: ${reason}`;
  }

  const text = candidate.content?.parts?.[0]?.text ?? '';
  if (!text.trim()) return 'Empty response from model';

  return null; // No error
}

type AnalysisResult = { id: string; description: string; value_date: string; category: string };

function collectBatchResults(responses: any[]): { results: AnalysisResult[]; failed: { id: string; error: string }[] } {
  const results: AnalysisResult[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const resp of responses) {
    const id = resp.metadata?.id;
    if (!id) continue;

    const errorMsg = extractResponseError(resp);
    if (errorMsg) {
      failed.push({ id, error: errorMsg });
      continue;
    }

    try {
      const text = resp.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      results.push({ id, ...parseAnalysisResponse(text) });
    } catch (err: any) {
      failed.push({ id, error: `Parse error: ${err.message || String(err)}` });
    }
  }

  return { results, failed };
}

export async function getBatchAnalysisDetails(batchName: string): Promise<{
  results: AnalysisResult[];
  failed: { id: string; error: string }[];
}> {
  const batch = await ai.batches.get({ name: batchName });
  return collectBatchResults(batch.dest?.inlinedResponses ?? []);
}

export async function detectDuplicates(entries: KbEntry[], lang: string = 'fr'): Promise<{ ids: string[]; reason: string }[]> {
  const jsonlLines = entries.map(e => JSON.stringify({
    id: e.id,
    name: e.structData.title,
    description: e.structData.description,
    value_date: e.structData.value_date,
  }));
  const jsonlContent = jsonlLines.join('\n');

  const prompt = `You are a document deduplication assistant. Below is a list of files in JSONL format (one JSON object per line with fields: id, name, description, value_date).

value_date is the most relevant date associated with the document (e.g. the date the document refers to, not the upload date). It can be empty if no date was found.

Identify groups of files that are likely duplicates or near-duplicates based on similar filenames or similar descriptions. Only flag pairs with high confidence.

Return ONLY a JSON array of duplicate groups. Each group is an object with:
- "ids": array of file ids that are duplicates of each other
- "reason": short explanation of why they are duplicates (in ${languageName(lang)})

If no duplicates are found, return an empty array: []

Return ONLY valid JSON, no markdown, no explanation.

<files>
${jsonlContent}
</files>`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: DUPLICATES_CONFIG,
  });

  const text = response.text ?? '';
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

export async function getBatchAnalysisStatus(bucketName: string, batchName: string): Promise<{
  state: string;
  succeededCount?: number;
  failedCount?: number;
  totalCount?: number;
  results?: AnalysisResult[];
  failed?: { id: string; error: string }[];
}> {
  const batch = await ai.batches.get({ name: batchName });
  const state = batch.state ?? 'JOB_STATE_UNSPECIFIED';

  if (state === 'JOB_STATE_SUCCEEDED') {
    const { results, failed } = collectBatchResults(batch.dest?.inlinedResponses ?? []);
    for (const f of failed) console.error(`Batch response error for id ${f.id}:`, f.error);

    // Write results once: re-polling a finished batch must not overwrite later manual edits
    if (results.length > 0 && !appliedBatches.has(batchName)) {
      if (!batchBelongsToBucket(batch.displayName ?? '', bucketName)) {
        throw badRequest(`Batch ${batchName} was not started for bucket ${bucketName}`);
      }
      await bulkUpdateKbEntries(bucketName, new Map(results.map(({ id, ...upd }) => [id, upd])));
      appliedBatches.add(batchName);
    }

    return { state: 'succeeded', results, failed };
  }

  if (state === 'JOB_STATE_FAILED' || state === 'JOB_STATE_CANCELLED') {
    return { state: state === 'JOB_STATE_FAILED' ? 'failed' : 'cancelled' };
  }

  // Still running
  const stats = batch.completionStats;
  return {
    state: 'running',
    succeededCount: parseInt(stats?.successfulCount ?? '0', 10),
    failedCount: parseInt(stats?.failedCount ?? '0', 10),
    totalCount: parseInt(stats?.successfulCount ?? '0', 10) + parseInt(stats?.failedCount ?? '0', 10) + parseInt(stats?.incompleteCount ?? '0', 10),
  };
}
