# @mypie/ai-bridge

[Claude Code](https://claude.com/claude-code) headless(`claude -p`)로 한국어 글에 **"글 전체 피드백"**(typie의 AI 피드백과 같은 방향)을 주는 브리지. 단순 맞춤법 검사가 아니라, 글의 종류(창작/문예 vs 실무/일반)를 먼저 판단해 그에 맞는 관점으로 비평한다. 출력은 [typie](https://github.com/penxle/typie)의 `provide_feedback` 계약과 동일한 형태라 에디터 range 매핑에 그대로 얹힌다.

## 출력 형태

```json
[
  { "start": "각 고객사 별", "end": "각 고객사 별", "category": "맞춤법", "feedback": "'-별'은 접미사라 '각 고객사별'로 붙여 써야 한다." }
]
```

- `start` / `end`: 원문에서 그대로 복사한 부분 문자열. typie 에디터의 range 매핑에 그대로 쓰인다.
- `category`: **자유 문자열**(typie와 동일하게 고정 enum 아님). 모델이 글 종류에 맞춰 라벨을 고른다.
  - 창작/문예: `서사`/`인물`/`시점`/`묘사`/`대사`/`문체`/`구성`
  - 실무/일반: `구성`/`논리`/`흐름`/`명료성`/`문체`/`간결성`/`비문`/`맞춤법`
- `feedback`: 무엇이 왜 그런지 + 권장 개선안.
- `start`가 원문에 실제로 존재하지 않는 항목은 걸러진다.

## 사용

```bash
# stdin
echo "이 문장은 비문이 있을 수 있는데" | node bin/mypie-ai-bridge.mjs

# 파일
node bin/mypie-ai-bridge.mjs --file draft.txt

# HTTP 서버 (기본 127.0.0.1:4319)
node bin/mypie-ai-bridge.mjs serve --port 4319
curl -s localhost:4319/feedback -d '{"text":"각 고객사 별 통계"}'
```

라이브러리로:

```js
import { analyze } from '@mypie/ai-bridge';
const feedback = await analyze('각 고객사 별 통계');
```

## 요구사항 / 환경변수

- Claude Code CLI(`claude`)가 PATH에 있어야 한다.
- `MYPIE_CLAUDE_BIN`: claude 실행 파일 경로 override.
- `MYPIE_CLAUDE_MODEL` / `--model`: 모델 override.
- `PORT`: 서버 포트.
