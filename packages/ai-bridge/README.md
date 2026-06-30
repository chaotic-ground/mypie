# @mypie/ai-bridge

[Claude Code](https://claude.com/claude-code) headless(`claude -p`)로 한국어 글을 교정 검토해, [typie](https://github.com/penxle/typie)의 `provide_feedback` 계약과 동일한 형태의 피드백을 돌려주는 브리지.

## 출력 형태

```json
[
  { "start": "각 고객사 별", "end": "각 고객사 별", "category": "맞춤법", "feedback": "'-별'은 접미사라 '각 고객사별'로 붙여 써야 한다." }
]
```

- `start` / `end`: 원문에서 그대로 복사한 부분 문자열. typie 에디터의 range 매핑에 그대로 쓰인다.
- `category`: `비문` | `가독성` | `맞춤법` | `중복` | `번역투`.
- `feedback`: 문제 + 권장 수정안.
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
