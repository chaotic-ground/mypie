import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractArray, normalize } from '../src/feedback.mjs';

test('extractArray: claude json envelope', () => {
  const envelope = JSON.stringify({
    type: 'result',
    result: '[{"start":"가","end":"나","feedback":"f","category":"비문"}]',
  });
  assert.deepEqual(extractArray(envelope), [
    { start: '가', end: '나', feedback: 'f', category: '비문' },
  ]);
});

test('extractArray: fenced code block inside result', () => {
  const envelope = JSON.stringify({
    result: '여기 결과입니다:\n```json\n[{"start":"가","end":"가","feedback":"f"}]\n```\n',
  });
  assert.deepEqual(extractArray(envelope), [{ start: '가', end: '가', feedback: 'f' }]);
});

test('extractArray: raw array (no envelope)', () => {
  assert.deepEqual(extractArray('[{"start":"가","end":"가","feedback":"f"}]'), [
    { start: '가', end: '가', feedback: 'f' },
  ]);
});

test('extractArray: throws when no array present', () => {
  assert.throws(() => extractArray('미안하지만 배열이 없어요'));
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
