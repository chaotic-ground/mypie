# @mypie/editor-poc

typie의 **실제 Svelte 에디터 뷰 레이어를 재사용**하는 PoC. 손으로 다시 만들지 않는다 — `upstream/typie`의 `editor-ffi/components/{View,Page,Input}.svelte` + `editor.svelte.ts` 래퍼를 vite alias로 그대로 렌더한다. 포커스/IME/선택/스크롤/렌더가 typie 웹사이트와 동일하게 동작하고, AI 검사 하이라이트도 래퍼의 `addAiFeedback`(파란 데코레이션)를 그대로 쓴다.

typie 소스는 복사하지 않는다. vite `resolve.alias`로 `$lib`→submodule, `@typie/ui|lib|styled-system`→submodule 패키지를 가리키고, 백엔드 의존(`$mearie` GraphQL, `$app/*`, `$env`)은 `src/shims/`의 얇은 stub으로 대체한다(로컬 빈 문서).

AI 검사는 스트리밍(`/feedback/stream`)으로 항목이 완성되는 대로 밑줄/카드가 뜨고, 세션(문서 + 제목/부제)은 localStorage로 자동 저장돼 껐다 켜면 그대로 복원된다. 같은 앱을 Tauri 데스크톱 앱(`src-tauri/`)으로도 띄우는데, 무테 창 + 커스텀 타이틀바이고 앱을 켜면 ai-bridge가 함께 기동한다.

## 사전 준비

```bash
# 1) submodule: pnpm install + styled-system codegen + .svelte-kit tsconfig stub
../../scripts/setup-submodule.sh
# 2) WASM (browser + server pkg)
../../scripts/build-editor-ffi.sh
# 3) 폰트(Pretendard base+chunks) → public/pretendard/
node ../../scripts/build-font.mjs
# 4) editor-poc 자체 deps
npm install
```

## 실행

```bash
npm run dev          # http://localhost:5173
# 검사 기능엔 ai-bridge 필요:
node ../../packages/ai-bridge/bin/mypie-ai-bridge.mjs serve   # :4319
```

데스크톱 앱(Tauri):

```bash
pnpm tauri build                   # 릴리즈 빌드 (webkit2gtk-4.1 / GTK3 필요)
../../scripts/install-desktop.sh   # .desktop 런처 생성
```

dev 서버(`tauri dev` 포함)에선 ai-bridge를 위처럼 따로 띄우고, 릴리즈 빌드에선 앱이 ai-bridge를 리소스로 동반 기동한다(종료 시 함께 kill).

## 구조

- `vite.config.ts` — alias(`$lib`, `@typie/*`→submodule; `$mearie`/`$app/*`/`$env`→shim) + unplugin-icons(lucide+typie 컬렉션) + `resolve.dedupe:['svelte']`(필수) + `server.fs.allow`(submodule 포함).
- `src/shims/` — `mearie.ts`(graphql identity tag, createFragment→로컬 빈 문서 `{id, editorFontFamilies:[]}`, createClient/mutation 등 inert), `app-{navigation,state,environment}.ts`, `env-dynamic-public.ts`, `fonts-local.ts`(Pretendard 등록).
- `src/App.svelte` — `setupThemeContext()`+`setupEditorContext()` → `Editor.createFromDoc(빈 문단, root font_family=Pretendard)` → `ctx.editor` 설정 → `<View document$key={{}} active/>` 렌더. 검사는 `editor.proseText()`→ai-bridge 스트림(`/feedback/stream`)→`proseToSelection`+`addAiFeedback`를 도착하는 대로. 상단 `<header>`는 무테 창용 커스텀 타이틀바(`data-tauri-drag-region` + Tauri window API 최소화/닫기).
- `src/session.ts` — localStorage 세션(문서 + 제목/부제) 저장/복원. `App.svelte`가 편집 중 자동 저장하고 부팅 시 복원한다(브라우저 dev와 Tauri webview 모두 재시작 후 유지).
- `src-tauri/` — Tauri v2 셸. `src/main.rs`가 ai-bridge를 리소스로 spawn하고 앱 종료 시 kill, `tauri.conf.json`은 `decorations:false` + ai-bridge 리소스 번들.

## 동작 확인 (headless Chrome)

부팅 → 클릭 시 typie 숨김 textarea 포커스(원본 focusin 위임) → 한글/영문 타이핑 렌더(Pretendard) → 검사 → "각 고객사 별"에 파란 하이라이트 + 사이드바 카드. 전부 typie 원본 로직.

알려진 거친 부분(PoC): 페이지 컨테이너 레이아웃이 website만큼 다듬어지지 않음(중앙 정렬/페이지 박스 없음). 에디터 기능 자체는 동일.
