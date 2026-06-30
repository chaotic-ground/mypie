# @mypie/editor-poc

typie의 Rust→WASM 에디터를 **직접 마운트**하는 PoC. 웹사이트의 Svelte 뷰 레이어, mearie/GraphQL, `@typie/ui`, `@typie/styled-system` 없이 `@typie/editor-ffi/browser`만 사용한다.

## 사전 준비

1. WASM 빌드 (한 번): submodule에서 editor-ffi를 빌드해 `pkg/browser/`를 채운다.
   ```bash
   ../../scripts/build-editor-ffi.sh
   ```
   vite alias가 이 산출물(`upstream/typie/crates/editor-ffi/pkg/browser/*`)을 참조한다.

2. (선택) 폰트: `public/poc-font.ttf.zst`에 **zstd로 압축한** 폰트를 둔다. typie 기본 family는 `Pretendard`이고 `add_font_base`는 zstd 압축 바이트를 받는다(원시 .ttf는 zstd magic 오류). 한글 글리프를 보려면 Pretendard 등 한글 폰트의 `.ttf.zst`가 필요하다. 없으면 에디터는 떠도 글자가 안 보인다.

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

- 확인됨: WASM 부팅, 한글+영문 입력이 모델에 반영(`prose_text()` 일치), 캐럿 위치 계산(`cursor()`), 폰트 무오류 로드, 외부 의존성 없음(`@typie/editor-ffi/browser`만). RAF 60fps 정상.
- 렌더러는 **CPU**다: `render_surface`가 CPU로 래스터해 canvas **2D 컨텍스트에 `putImageData`**(WebGL/WebGPU 아님 → headless 무관).
- **막힌 지점: 화면상 글자 렌더링.** 루프를 멈추고 `render_surface`를 직접 호출해도 2D canvas가 완전 투명(`render_page`가 Background조차 안 그림). 레이아웃은 존재(page_sizes/cursor)하므로, 웹사이트의 정상 CPU 렌더 경로와 우리 마운트의 렌더 파라미터(scale_factor/theme/뷰포트/visit_page 전제) 차이를 더 파야 한다. 그동안 보인 "흰 페이지"는 canvas의 CSS 배경이었다.
- `font_data_missing` 이벤트는 관측되지 않아 기본 폰트를 init에서 능동적으로 `add_font_base`로 공급한다(이벤트 핸들러도 둠).
