# mypie

[typie](https://github.com/penxle/typie)의 에디터 프론트엔드를 재사용하되, **AI 검사(첨삭/피드백)를 [Claude Code](https://claude.com/claude-code) headless로 구동**하는 로컬 글쓰기 도구입니다.

에디터는 typie의 뷰 레이어(WASM 코어 + Svelte View)를 fork 없이 그대로 재사용하고, AI 검사는 Claude Code가 쓰는 대로 스트리밍으로 표시합니다. Tauri 기반 데스크톱 앱으로도 실행되며, 앱을 켜면 AI 브리지가 함께 뜹니다.

## typie와의 관계

mypie는 typie를 **fork 하지 않습니다.** upstream typie를 git submodule(`upstream/typie`)로 핀 고정해 참조하고, 그 위에 얇은 레이어만 더합니다. 오픈소스 생태계를 파편화하지 않고 확장하는 것이 목표입니다.

- upstream: `penxle/typie` (현재 `31a3d5e` 핀)
- typie 본체를 로컬에서 따로 쓰려면: `git clone https://github.com/penxle/typie ~/git/typie`

## 라이선스

typie가 **AGPL-3.0** 이므로, 그 파생/결합 저작물인 mypie도 **AGPL-3.0-or-later** 입니다. 네트워크로 제공할 경우 소스 공개 의무가 따릅니다. 원저작권은 penxle/typie 기여자에게 있으며, mypie는 그 위의 추가 저작물입니다.

## 구성

| 위치 | 설명 | 상태 |
|------|------|------|
| `packages/ai-bridge` | Claude Code headless 교정 브리지. typie `provide_feedback` 계약과 동일한 start/end/feedback/category 출력. 전체 한 번에(`/feedback`) + 스트리밍(`/feedback/stream`, NDJSON) | 동작 |
| `apps/editor-poc` | typie 에디터 뷰 레이어를 vite alias로 재사용하는 로컬 에디터. 백엔드 의존은 shim으로 대체하고, 검사는 ai-bridge에 결선 | 동작 |
| `apps/editor-poc/src-tauri` | Tauri v2 데스크톱 셸. 무테 창 + 커스텀 타이틀바, 세션 자동 복원, 실행 시 ai-bridge 동반 기동 | 동작 |
| `upstream/typie` | upstream typie submodule (참조 전용) | 핀 고정 |

자세한 설계와 단계별 계획은 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), 에디터 재사용 방식은 [`apps/editor-poc/README.md`](apps/editor-poc/README.md) 참고.

## 빠른 시작

### AI 브리지 (텍스트 교정)

```bash
# 클론 (submodule 포함)
git clone --recurse-submodules https://github.com/chaotic-ground/mypie
cd mypie/packages/ai-bridge

# 텍스트 교정 (Claude Code CLI가 PATH에 있어야 함)
echo "이 문장은 비문이 있을 수 있는데 한번 봐주세요" | node bin/mypie-ai-bridge.mjs

# 로컬 HTTP 서버 (기본 127.0.0.1:4319)
node bin/mypie-ai-bridge.mjs serve
# POST /feedback {"text":"..."}  또는  POST /feedback/stream (NDJSON)
```

### 에디터 (개발 서버)

submodule 셋업 + WASM/폰트 빌드 등 사전 준비는 [`apps/editor-poc/README.md`](apps/editor-poc/README.md) 참고.

```bash
cd apps/editor-poc
npm run dev          # http://localhost:5173
# 검사에는 ai-bridge가 떠 있어야 함:
node ../../packages/ai-bridge/bin/mypie-ai-bridge.mjs serve
```

### 데스크톱 앱 (Tauri)

```bash
cd apps/editor-poc
pnpm tauri build                   # 릴리즈 바이너리 빌드 (webkit2gtk-4.1 / GTK3 필요)
../../scripts/install-desktop.sh   # .desktop 런처 생성 (앱 실행 시 ai-bridge 동반 기동)
```
