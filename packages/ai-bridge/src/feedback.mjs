// Proofreading feedback via Claude Code headless (`claude -p`).
//
// Produces feedback items shaped like typie's `provide_feedback` tool
// (start / end / feedback / category) so the output can drive the same
// range-mapping the upstream editor already uses.
//
// Two entry points share one prompt: `analyze` returns the whole list at once;
// `analyzeStream` emits each item as the model writes it (typie-style progressive
// feedback) by parsing `--output-format stream-json` deltas as JSONL.

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

// Flags shared by both paths. Skip loading things this one-shot proofread never
// uses: all MCP servers (--strict-mcp-config with no --mcp-config) and
// project/local settings (skills, CLAUDE.md, plugins, hooks). Keep `user`
// sources so auth + model config still resolve. Trims Claude Code startup.
const BASE_ARGS = ['--strict-mcp-config', '--setting-sources', 'user'];

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

출력 형식 — 한 줄에 JSON 객체 하나씩(JSONL). 이것만 출력하라. 배열/대괄호·설명·머리말·코드펜스 금지. 한 줄이 완성되는 대로 바로 내보내라(항목 사이에서 멈추지 마라):
{"start":"...","end":"...","category":"...","feedback":"..."}
{"start":"...","end":"...","category":"...","feedback":"..."}

짚을 것이 없으면 아무것도 출력하지 마라(빈 출력).

<글>
${text}
</글>`;

// Claude Code's `--output-format json` wraps the model reply in an envelope
// whose `.result` is the assistant text; pull the raw text back out of it.
const unwrapEnvelope = (raw) => {
  try {
    const env = JSON.parse(raw);
    if (env && typeof env.result === 'string') {
      return env.result;
    }
  } catch {
    // not an envelope; treat stdout as the text itself
  }
  return raw;
};

// Parse the model output. Prompt asks for JSONL (one object per line); we also
// tolerate a stray code fence or a whole JSON array, just in case.
const parseItems = (payload) => {
  let text = payload;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    text = fenced[1];
  }
  text = text.trim();

  if (text.startsWith('[')) {
    try {
      const arr = JSON.parse(text.slice(0, text.lastIndexOf(']') + 1));
      if (Array.isArray(arr)) return arr;
    } catch {
      // fall through to line parsing
    }
  }

  const out = [];
  for (const line of text.split('\n')) {
    const obj = parseLine(line);
    if (obj) out.push(obj);
  }
  return out;
};

// One JSONL line -> object, or null if it isn't a JSON object.
const parseLine = (line) => {
  const t = line.trim();
  if (!t || t.startsWith('```')) return null;
  const open = t.indexOf('{');
  const close = t.lastIndexOf('}');
  if (open === -1 || close < open) return null;
  try {
    const obj = JSON.parse(t.slice(open, close + 1));
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
};

// One raw item -> normalized item, or null if it can't anchor to the text.
const normalizeOne = (it, text) => {
  const start = String(it.start ?? it.quote ?? '').trim();
  const end = String(it.end ?? it.start ?? it.quote ?? '').trim();
  // typie uses a free-form category label; keep whatever the model returns.
  const category = String(it.category ?? '').trim() || '기타';
  const feedback = String(it.feedback ?? '').trim();
  if (!start || !feedback || !text.includes(start)) return null;
  return { start, end, category, feedback };
};

const normalize = (items, text) => items.map((it) => normalizeOne(it, text)).filter(Boolean);

const resolveBin = (opts) => opts.claudeBin || process.env.MYPIE_CLAUDE_BIN || 'claude';
const withModel = (args, opts) => {
  const model = opts.model || process.env.MYPIE_CLAUDE_MODEL;
  if (model) args.push('--model', model);
  return args;
};

/**
 * Analyze `text` and return all proofreading feedback items at once.
 * @param {string} text
 * @param {{ model?: string, signal?: AbortSignal, claudeBin?: string }} [opts]
 * @returns {Promise<Array<{start:string,end:string,category:string,feedback:string}>>}
 */
export const analyze = (text, opts = {}) => {
  if (!text || !text.trim()) {
    return Promise.resolve([]);
  }

  const bin = resolveBin(opts);
  const args = withModel(['-p', '--output-format', 'json', ...BASE_ARGS], opts);

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
        resolve(normalize(parseItems(unwrapEnvelope(stdout)), text));
      } catch (err) {
        reject(err);
      }
    });

    child.stdin.write(buildPrompt(text));
    child.stdin.end();
  });
};

/**
 * Analyze `text`, emitting each feedback item as the model writes it.
 * Runs `claude -p --output-format stream-json --include-partial-messages` and
 * parses the streamed text as JSONL, so `onItem` fires per completed line.
 * @param {string} text
 * @param {{ onItem?: (item:object)=>void, onProgress?: (p:object)=>void }} [handlers]
 * @param {{ model?: string, signal?: AbortSignal, claudeBin?: string }} [opts]
 * @returns {Promise<number>} number of items emitted
 */
export const analyzeStream = (text, handlers = {}, opts = {}) => {
  if (!text || !text.trim()) {
    return Promise.resolve(0);
  }
  const { onItem, onProgress } = handlers;

  const bin = resolveBin(opts);
  const args = withModel(
    ['-p', '--output-format', 'stream-json', '--include-partial-messages', '--verbose', ...BASE_ARGS],
    opts,
  );

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { signal: opts.signal });
    let evbuf = ''; // buffers stream-json event lines (stdout is NDJSON of events)
    let txtbuf = ''; // buffers the model's own output text (JSONL we care about)
    let stderr = '';
    let sawText = false;
    let count = 0;
    const seen = new Set();

    // Drain complete JSONL lines out of the accumulated model text. Keeps the
    // trailing partial line unless `final`, when we flush everything.
    const drainText = (final) => {
      const parts = txtbuf.split('\n');
      txtbuf = final ? '' : parts.pop();
      for (const line of parts) {
        const obj = parseLine(line);
        if (!obj) continue;
        const item = normalizeOne(obj, text);
        if (!item) continue;
        const key = `${item.start} ${item.feedback}`;
        if (seen.has(key)) continue;
        seen.add(key);
        count += 1;
        onItem?.(item);
      }
    };

    child.stdout.on('data', (d) => {
      evbuf += d;
      let nl;
      while ((nl = evbuf.indexOf('\n')) >= 0) {
        const raw = evbuf.slice(0, nl);
        evbuf = evbuf.slice(nl + 1);
        const s = raw.trim();
        if (!s) continue;
        let ev;
        try {
          ev = JSON.parse(s);
        } catch {
          continue;
        }
        // Text deltas of the assistant's output block (ignore thinking_delta).
        if (
          ev.type === 'stream_event' &&
          ev.event?.type === 'content_block_delta' &&
          ev.event.delta?.type === 'text_delta'
        ) {
          if (!sawText) {
            sawText = true;
            onProgress?.({ phase: 'writing' });
          }
          txtbuf += ev.event.delta.text;
          drainText(false);
        } else if (ev.type === 'result' && typeof ev.result === 'string' && !sawText) {
          // Deltas were coalesced away; fall back to the final full text.
          txtbuf += ev.result;
          drainText(true);
        }
      }
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', (err) =>
      reject(new Error(`failed to launch '${bin}': ${err.message}`)),
    );
    child.on('close', (code) => {
      drainText(true);
      if (code !== 0 && count === 0) {
        reject(new Error(`claude exited ${code}: ${stderr.slice(0, 500)}`));
        return;
      }
      resolve(count);
    });

    child.stdin.write(buildPrompt(text));
    child.stdin.end();
  });
};

// Exported for unit tests (parsing/normalization are the drift-prone seams).
export { CATEGORIES, parseItems, parseLine, normalize, normalizeOne };
