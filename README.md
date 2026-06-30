# mypie

[typie](https://github.com/penxle/typie)의 에디터 프론트엔드를 재사용하되, **AI 검사(첨삭/피드백)를 [Claude Code](https://claude.com/claude-code) headless로 구동**하는 로컬 글쓰기 도구입니다.

지금은 로컬 서버로 동작하는 것을 목표로 하고, 추후 Tauri/Electron/Servo 기반 데스크톱 앱을 염두에 둡니다.

## typie와의 관계

mypie는 typie를 **fork 하지 않습니다.** upstream typie를 git submodule(`upstream/typie`)로 핀 고정해 참조하고, 그 위에 얇은 레이어만 더합니다. 오픈소스 생태계를 갈라치지 않고 확장하는 것이 목표입니다.

- upstream: `penxle/typie` (현재 `31a3d5e` 핀)
- typie 본체를 로컬에서 따로 쓰려면: `git clone https://github.com/penxle/typie ~/git/typie`

## 라이선스

typie가 **AGPL-3.0** 이므로, 그 파생/결합 저작물인 mypie도 **AGPL-3.0-or-later** 입니다. 네트워크로 제공할 경우 소스 공개 의무가 따릅니다. 원저작권은 penxle/typie 기여자에게 있으며, mypie는 그 위의 추가 저작물입니다.

## 구성

| 위치 | 설명 | 상태 |
|------|------|------|
| `packages/ai-bridge` | Claude Code headless 기반 교정 피드백 브리지 (typie `provide_feedback` 계약과 동일한 start/end/feedback/category 출력) | 동작 |
| `upstream/typie` | upstream typie submodule (참조 전용) | 핀 고정 |
| 프론트엔드 통합 | typie 에디터 + 로컬 stub 백엔드 결선 | 설계 단계 |

자세한 설계와 단계별 계획은 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) 참고.

## 빠른 시작 (ai-bridge)

```bash
# 클론 (submodule 포함)
git clone --recurse-submodules https://github.com/chaotic-ground/mypie
cd mypie/packages/ai-bridge

# 텍스트 교정 (Claude Code CLI가 PATH에 있어야 함)
echo "이 문장은 비문이 있을 수 있는데 한번 봐주세요" | node bin/mypie-ai-bridge.mjs

# 로컬 HTTP 서버
node bin/mypie-ai-bridge.mjs serve   # POST /feedback {"text":"..."}
```
