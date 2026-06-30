// Drift guard: mypie's ai-bridge mirrors typie's `provide_feedback` contract
// (start / end / feedback / category) and relies on its text-range mapping.
// If a submodule bump changes that contract upstream, these tests fail so the
// Dependabot submodule PR goes red instead of silently breaking integration.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const llmPath = resolve(here, '../upstream/typie/apps/api/src/graphql/resolvers/llm.ts');

test('upstream typie submodule is checked out', () => {
  assert.ok(
    existsSync(llmPath),
    `missing ${llmPath}. Run: git submodule update --init --recursive`,
  );
});

test('upstream still exposes the provide_feedback tool', () => {
  const src = readFileSync(llmPath, 'utf8');
  assert.match(src, /name:\s*'provide_feedback'/, 'provide_feedback tool was renamed or removed');
});

test('provide_feedback still carries start/end/feedback/category params', () => {
  const src = readFileSync(llmPath, 'utf8');
  for (const key of ['start', 'end', 'feedback', 'category']) {
    assert.match(
      src,
      new RegExp(`${key}:\\s*\\{\\s*type:\\s*'string'`),
      `provide_feedback param '${key}' changed shape`,
    );
  }
  assert.match(
    src,
    /required:\s*\[\s*'start',\s*'end',\s*'feedback'\s*\]/,
    'provide_feedback required fields changed',
  );
});

test('upstream still maps feedback start/end onto a document range', () => {
  const src = readFileSync(llmPath, 'utf8');
  assert.match(src, /mapRange\(/, 'mapRange() removed; start/end are no longer text anchors');
});
