import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalize, parseItems, parseLine } from '../src/feedback.mjs';

test('parseItems: JSONL (one object per line)', () => {
  const jsonl = '{"start":"가","end":"나","feedback":"f","category":"비문"}\n{"start":"다","end":"다","feedback":"g","category":"맞춤법"}';
  assert.deepEqual(parseItems(jsonl), [
    { start: '가', end: '나', feedback: 'f', category: '비문' },
    { start: '다', end: '다', feedback: 'g', category: '맞춤법' },
  ]);
});

test('parseItems: skips prose/blank lines between objects', () => {
  const messy = '분석 결과:\n\n{"start":"가","end":"가","feedback":"f"}\n감사합니다.';
  assert.deepEqual(parseItems(messy), [{ start: '가', end: '가', feedback: 'f' }]);
});

test('parseItems: tolerates a fenced code block', () => {
  const fenced = '여기 결과입니다:\n```json\n{"start":"가","end":"가","feedback":"f"}\n```\n';
  assert.deepEqual(parseItems(fenced), [{ start: '가', end: '가', feedback: 'f' }]);
});

test('parseItems: tolerates a whole JSON array', () => {
  assert.deepEqual(parseItems('[{"start":"가","end":"가","feedback":"f"}]'), [
    { start: '가', end: '가', feedback: 'f' },
  ]);
});

test('parseItems: empty output -> no items', () => {
  assert.deepEqual(parseItems('   \n\n'), []);
});

test('parseLine: parses one object, rejects non-JSON', () => {
  assert.deepEqual(parseLine('{"start":"가","feedback":"f"}'), { start: '가', feedback: 'f' });
  assert.equal(parseLine('분석 중…'), null);
  assert.equal(parseLine('```json'), null);
  assert.equal(parseLine(''), null);
});

test('normalize: drops items whose start is not in the source text', () => {
  const text = '각 고객사 별 통계';
  const items = [
    { start: '각 고객사 별', end: '각 고객사 별', feedback: '붙여 써야 한다', category: '맞춤법' },
    { start: '존재하지 않는 구절', end: 'x', feedback: '환각', category: '비문' },
  ];
  const out = normalize(items, text);
  assert.equal(out.length, 1);
  assert.equal(out[0].start, '각 고객사 별');
});

test('normalize: maps quote -> start/end and falls back category', () => {
  const text = '하루 한 회 데일리 싱크업';
  const out = normalize([{ quote: '하루 한 회 데일리', feedback: '중복' }], text);
  assert.equal(out.length, 1);
  assert.equal(out[0].start, '하루 한 회 데일리');
  assert.equal(out[0].end, '하루 한 회 데일리');
  assert.equal(out[0].category, '기타'); // missing category -> default (free-form otherwise)
});

test('normalize: drops items with empty feedback', () => {
  const text = '문장';
  assert.equal(normalize([{ start: '문장', feedback: '' }], text).length, 0);
});
