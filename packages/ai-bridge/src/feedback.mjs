// Proofreading feedback via Claude Code headless (`claude -p`).
//
// Produces feedback items shaped like typie's `provide_feedback` tool
// (start / end / feedback / category) so the output can drive the same
// range-mapping the upstream editor already uses.

import { spawn } from 'node:child_process';

// typie's AI feedback is holistic "글 전체에 대한 피드백" with a free-form
// `category` label (the model picks it, no fixed enum). We mirror that: judge the
// writing type first, then give feedback with categories from the matching set.
const CATEGORY_HINTS = {
  // 실무/일반 산문 (보고서·문서·설명문)
  practical: ['구성', '논리', '흐름', '명료성', '문체', '간결성', '비문', '맞춤법'],
  // 창작/문예 (소설·수필 등 서사가 있는 글)
  creative: ['서사', '인물', '시점', '묘사', '대사', '문체', '구성'],
};
const CATEGORIES = [...new Set([...CATEGORY_HINTS.practical, ...CATEGORY_HINTS.creative])];

const buildPrompt = (text) => `너는 글 전체를 읽고 피드백을 주는 한국어 글쓰기 코치다. 맞춤법 검사기가 아니라 "글에 대한 피드백"을 준다. 아래 <글>을 끝까지 읽고 다음을 수행하라.

1) 글의 종류를 먼저 판단한다.
   - 창작/문예: 소설·수필 등 서사·화자가 있는 글.
   - 실무/일반: 보고서·문서·설명문 등.

2) 그 종류에 맞는 관점으로, 글 전체 맥락을 고려해 더 좋아질 지점을 인라인으로 짚는다.
   - 창작/문예 관점: 서사·전개, 인물, 시점(POV)·시제 일관성, 묘사, 대사, 문체·톤, 구성. (명백한 비문/맞춤법만 예외적으로)
   - 실무/일반 관점: 구성·논리, 흐름·연결, 명료성(모호/중의), 문체·톤, 간결성(군더더기/중복), 비문, 맞춤법.

규칙:
- 자신 있게 개선을 제안할 수 있는 곳만. 과잉 지적 금지.
- 각 항목의 start/end는 <글>에서 그대로 복사한 부분 문자열이어야 한다(지어내지 마라). 짧고 고유하게. 구간이 짧으면 start와 end가 같아도 된다.
- category: 위 관점 중 글 종류에 맞는 세트에서 고른 한 단어 라벨(자유롭게). 창작이면 ${CATEGORY_HINTS.creative.join('/')}, 실무면 ${CATEGORY_HINTS.practical.join('/')} 등.
- feedback: 무엇이 왜 그런지 + 권장 개선안을 한 문장으로.

출력 형식 (이것만 출력. 설명/머리말/코드펜스 금지):
[{"start":"...","end":"...","category":"...","feedback":"..."}]

짚을 것이 없으면 빈 배열 [] 만 출력하라.

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
      // typie uses a free-form category label; keep whatever the model returns.
      category: String(it.category ?? '').trim() || '기타',
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
