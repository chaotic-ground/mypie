// Proofreading feedback via Claude Code headless (`claude -p`).
//
// Produces feedback items shaped like typie's `provide_feedback` tool
// (start / end / feedback / category) so the output can drive the same
// range-mapping the upstream editor already uses.

import { spawn } from 'node:child_process';

const CATEGORIES = ['비문', '가독성', '맞춤법', '중복', '번역투'];

const buildPrompt = (text) => `너는 한국어 글쓰기 교정 검토자다. 아래 <글>을 읽고 비문이나 가독성이 떨어지는 부분을 찾아라.

검토 관점:
- 비문: 주어-술어 불호응, 미완결 문장, 호응 오류, 시제/조사 오용.
- 가독성: 한 문장에 절이 너무 많음, 모호한 지시어, 어색한 어순, 불필요한 피동/이중부정.
- 맞춤법: 명백한 맞춤법/띄어쓰기 오류.
- 중복: 같은 뜻이 겹치는 표현.
- 번역투: 어색한 번역체.

규칙:
- 자신 있게 고칠 수 있는 곳만 지적한다. 과잉 지적 금지.
- 각 지적의 start/end는 <글>에서 그대로 복사한 부분 문자열이어야 한다. 지어내지 마라.
- start = 문제 구간이 시작하는 짧고 고유한 원문 조각, end = 그 구간이 끝나는 짧고 고유한 원문 조각. 구간이 짧으면 start와 end가 같아도 된다.
- category 는 다음 중 하나: ${CATEGORIES.join(', ')}.
- feedback 은 무엇이 왜 문제인지 + 권장 수정안을 한 문장으로.

출력 형식 (이것만 출력. 설명/머리말/코드펜스 금지):
[{"start":"...","end":"...","category":"...","feedback":"..."}]

지적할 것이 없으면 빈 배열 [] 만 출력하라.

<글>
${text}
</글>`;

// Claude Code's `--output-format json` wraps the model reply in an envelope
// whose `.result` is the assistant text; pull the JSON array back out of it.
const extractArray = (raw) => {
  let payload = raw;
  try {
    const env = JSON.parse(raw);
    if (env && typeof env.result === 'string') {
      payload = env.result;
    }
  } catch {
    // not an envelope; treat stdout as the text itself
  }

  const fenced = payload.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    payload = fenced[1];
  }

  const start = payload.indexOf('[');
  const end = payload.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`no JSON array found in model output: ${payload.slice(0, 200)}`);
  }
  return JSON.parse(payload.slice(start, end + 1));
};

const normalize = (items, text) =>
  items
    .map((it) => ({
      start: String(it.start ?? it.quote ?? '').trim(),
      end: String(it.end ?? it.start ?? it.quote ?? '').trim(),
      category: CATEGORIES.includes(it.category) ? it.category : '가독성',
      feedback: String(it.feedback ?? '').trim(),
    }))
    .filter((it) => it.start && it.feedback && text.includes(it.start));

/**
 * Analyze `text` and return proofreading feedback items.
 * @param {string} text
 * @param {{ model?: string, signal?: AbortSignal, claudeBin?: string }} [opts]
 * @returns {Promise<Array<{start:string,end:string,category:string,feedback:string}>>}
 */
export const analyze = (text, opts = {}) => {
  if (!text || !text.trim()) {
    return Promise.resolve([]);
  }

  const bin = opts.claudeBin || process.env.MYPIE_CLAUDE_BIN || 'claude';
  const args = ['-p', '--output-format', 'json'];
  const model = opts.model || process.env.MYPIE_CLAUDE_MODEL;
  if (model) {
    args.push('--model', model);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { signal: opts.signal });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', (err) =>
      reject(new Error(`failed to launch '${bin}': ${err.message}`)),
    );
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude exited ${code}: ${stderr.slice(0, 500)}`));
        return;
      }
      try {
        resolve(normalize(extractArray(stdout), text));
      } catch (err) {
        reject(err);
      }
    });

    child.stdin.write(buildPrompt(text));
    child.stdin.end();
  });
};

// Exported for unit tests (parsing/normalization are the drift-prone seams).
export { CATEGORIES, extractArray, normalize };
