import { GoogleGenAI } from '@google/genai';
import { getKbMetadata, updateKbEntry, pathFromUri } from './storage';
import { Storage } from '@google-cloud/storage';
import type { KbEntry } from './storage';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-3.1-flash-lite-preview';

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME || 'kb-studio-bucket';
const bucket = storage.bucket(bucketName);

const ANALYSIS_PROMPT = `Analyze this document and return ONLY a JSON object with:
- "description": short description (1-2 sentences, in French)
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

async function downloadFileAsBuffer(entry: KbEntry): Promise<Buffer> {
  const filePath = pathFromUri(entry.content.uri);
  const [content] = await bucket.file(filePath).download();
  return content;
}

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

export async function analyzeFile(entry: KbEntry): Promise<{ description: string; value_date: string; category: string }> {
  const buffer = await downloadFileAsBuffer(entry);
  const base64Data = buffer.toString('base64');

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: entry.content.mimeType, data: base64Data } },
          { text: ANALYSIS_PROMPT },
        ],
      },
    ],
  });

  const text = response.text ?? '';
  return parseAnalysisResponse(text);
}

export async function startBatchAnalysis(): Promise<{ batchName: string; totalFiles: number }> {
  const entries = await getKbMetadata();
  if (entries.length === 0) {
    throw new Error('No files to analyze');
  }

  const inlineRequests = [];
  for (const entry of entries) {
    const buffer = await downloadFileAsBuffer(entry);
    const base64Data = buffer.toString('base64');

    inlineRequests.push({
      contents: [
        {
          role: 'user' as const,
          parts: [
            { inlineData: { mimeType: entry.content.mimeType, data: base64Data } },
            { text: ANALYSIS_PROMPT },
          ],
        },
      ],
      metadata: { id: entry.id },
    });
  }

  const batch = await ai.batches.create({
    model: MODEL,
    src: inlineRequests,
    config: {
      displayName: `kb-studio-analysis-${Date.now()}`,
    },
  });

  return {
    batchName: batch.name!,
    totalFiles: entries.length,
  };
}

export async function getBatchAnalysisStatus(batchName: string): Promise<{
  state: string;
  succeededCount?: number;
  failedCount?: number;
  totalCount?: number;
  results?: { id: string; description: string; value_date: string; category: string }[];
}> {
  const batch = await ai.batches.get({ name: batchName });
  const state = batch.state ?? 'JOB_STATE_UNSPECIFIED';

  if (state === 'JOB_STATE_SUCCEEDED') {
    const responses = batch.dest?.inlinedResponses ?? [];
    const results: { id: string; description: string; value_date: string; category: string }[] = [];

    for (const resp of responses) {
      try {
        const text = resp.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const parsed = parseAnalysisResponse(text);
        const id = resp.metadata?.id;
        if (!id) continue;
        await updateKbEntry(id, parsed);
        results.push({ id, ...parsed });
      } catch (err) {
        console.error(`Failed to parse batch response for id ${resp.metadata?.id}:`, err);
      }
    }

    return { state: 'succeeded', results };
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
