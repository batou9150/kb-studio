import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKbNdjson, serializeKbNdjson, extractValueDate } from './storage';
import type { KbEntry } from './storage';

const entry = (id: string, description: string): KbEntry => ({
  id,
  structData: { title: `${id}.pdf`, description, value_date: '', category: '', folder: '' },
  content: { mimeType: 'application/pdf', uri: `gs://bucket/${id}.pdf` },
});

test('kb.ndjson round-trips descriptions containing newlines and backslashes', () => {
  const entries = [
    entry('a', 'line one\nline two'),
    entry('b', 'C:\\new\\folder'),
    entry('c', 'literal \\n sequence'),
  ];
  assert.deepEqual(parseKbNdjson(serializeKbNdjson(entries)), entries);
});

test('parseKbNdjson ignores blank lines and tolerates CRLF', () => {
  const content = `${JSON.stringify(entry('a', 'x'))}\r\n\n${JSON.stringify(entry('b', 'y'))}\n`;
  assert.deepEqual(parseKbNdjson(content).map(e => e.id), ['a', 'b']);
});

test('parseKbNdjson returns no entries for empty content', () => {
  assert.deepEqual(parseKbNdjson(''), []);
  assert.deepEqual(parseKbNdjson(serializeKbNdjson([])), []);
});

test('parseKbNdjson throws on a malformed line instead of returning partial data', () => {
  const content = `${JSON.stringify(entry('a', 'x'))}\n{"id": "broken`;
  assert.throws(() => parseKbNdjson(content), /line 2/);
});

test('extractValueDate recognizes common filename date formats', () => {
  assert.equal(extractValueDate('report_2024-03-15.pdf'), '2024-03-15');
  assert.equal(extractValueDate('cr 15.03.2024.docx'), '2024-03-15');
  assert.equal(extractValueDate('bilan-03-2024.pdf'), '2024-03-01');
  assert.equal(extractValueDate('plan_2024_7.pdf'), '2024-07-01');
  assert.equal(extractValueDate('budget 2023.xlsx'), '2023-01-01');
  assert.equal(extractValueDate('notes.txt'), '');
  assert.equal(extractValueDate('ref-120245.pdf'), '');
});
