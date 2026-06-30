# @mypie/editor-poc

typie의 Rust→WASM 에디터를 **직접 마운트**하는 PoC. 웹사이트의 Svelte 뷰 레이어, mearie/GraphQL, `@typie/ui`, `@typie/styled-system` 없이 `@typie/editor-ffi/browser`만 사용한다.

## 사전 준비

1. WASM 빌드 (한 번): submodule에서 editor-ffi를 빌드해 `pkg/browser/`를 채운다.
   ```bash
   ../../scripts/build-editor-ffi.sh
   ```
   vite alias가 이 산출물(`upstream/typie/crates/editor-ffi/pkg/browser/*`)을 참조한다.

2. 폰트 가공: submodule의 Pretendard를 typie의 base+chunks 포맷으로 가공한다(`public/pretendard/` 생성).
   ```bash
   node ../../scripts/build-font.mjs
   ```
   (`build-editor-ffi.sh`가 wasm-server 빌드까지 마쳐야 `build_font`를 쓸 수 있다.) 이 산출물이 없으면 에디터는 떠도 글자가 placeholder로 폴백해 안 보인다.

## 실행

```bash
npm install
npm run dev            # http://localhost:5173
```

검사 기능을 쓰려면 ai-bridge도 띄운다:
```bash
node ../../packages/ai-bridge/bin/mypie-ai-bridge.mjs serve   # :4319
```

## 마운트 요약 (`src/editor-mount.ts`)

- `createInstance(wasm)` → `EditorHost.create(icu바이트)` → `create_editor_from_doc(빈 문단 문서)`.
- `page_sizes()`마다 `<canvas>` 생성 + `attach_surface`, RAF 루프에서 `tick()`/`render_surface`.
- 입력: 숨김 textarea. 타이핑/IME는 `text_input` `replace_selection`으로 enqueue(웹사이트 ime-input-adapter와 동일). 클릭(`selection set_at`)으로 캐럿을 잡는다.
- 검사: `prose_text()` → ai-bridge → 텍스트 앵커를 prose offset으로(`indexOf`) → `prose_to_selection` → `tracked_range`(group `ai-feedback`, 빨간 물결 밑줄).

## 검증 상태 / 한계

전 과정 동작(headless Chrome 검증): WASM 부팅 → 한글+영문 타이핑 렌더(Pretendard) → 검사 버튼 → ai-bridge → "각 고객사 별"에 빨간 물결 밑줄 + 사이드바 카드. 외부 의존성은 `@typie/editor-ffi/browser`뿐.

핵심 함정(둘 다 해결):
- 렌더러는 **CPU**(2D `putImageData`, WebGL 아님 → headless 무관). 흰 페이지는 canvas CSS 배경이었음.
- **폰트**: typie는 glyf를 base+chunk로 분리하는 서브셋 구조라 전체 .ttf를 그냥 넣으면 placeholder(글리프 없음)로 폴백. `scripts/build-font.mjs`(wasm-server `build_font`)로 정식 base+chunks 생성 후 `set_fonts`+`add_font_base`+`add_font_chunk`.
- **기본 font_family**: 스타일 없는 텍스트는 family NAME으로 resolve하므로 `EMPTY_DOC` root에 `font_family=Pretendard`를 줘야 글리프가 나옴.
