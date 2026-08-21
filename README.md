# 2DROOM-AING

복도를 걸으며 방에 들어가는 포트폴리오.

기술 이름을 간판으로 걸지 않고 장소와 사물로 말합니다.
창틀을 세어 보면 열넷이고, 두꺼비집은 마흔셋입니다.

## 실행

```bash
pnpm install
pnpm dev
```

## 구조

| 경로 | 내용 |
|---|---|
| `app/` | Next.js App Router. 본문은 전부 서버에서 렌더합니다 |
| `components/world/` | 복도·카메라·방 (React Three Fiber) |
| `lib/rooms.ts` | 방의 정본. 3D 배치와 HTML 본문이 같은 데이터를 씁니다 |
| `lib/props.ts` | 방 안 사물. SVG를 데이터 URI 텍스처로 평면에 입힙니다 |
| `design/` | 설계 아트보드 (`.dc.html`) |
| `docs/` | 설계 결정과 그 근거 기록 |
| `mascot/` | 아잉 캐릭터 킷 — 표정 16 · 액션 16 · 모션 6 · GLB 2 |

## 세계 규칙

1. **걸음이 곧 스크롤** — 휠·터치·드래그를 하나로 받아 카메라를 민다
2. **글자는 3D에 넣지 않는다** — 3D는 공간과 카메라만. 읽는 글은 HTML로 남는다
3. **모델도 조명도 쓰지 않는다** — 모든 사물은 손으로 그린 평면. 그늘은 색에 미리 칠한다

자세한 설계 기록은 [`docs/portfolio-world-design.md`](docs/portfolio-world-design.md)에 있습니다.
