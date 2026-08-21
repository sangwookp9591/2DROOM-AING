# itomdev.com 분석

**대상**: https://itomdev.com/ — Tomasz "ITom" Szmajda (폴란드) 개인 포트폴리오
**분석일**: 2026-08-20
**근거**: ① 배포된 번들 역분석 ② 저자 Codrops 기고문 ③ 공개 소스 (`github.com/ITomPoland/portfolio-itom`)

관련 자료
- 기고문: https://tympanus.net/codrops/2026/06/11/sketching-the-impossible-a-3d-portfolio-built-without-a-single-3d-model/
- 소스: https://github.com/ITomPoland/portfolio-itom

---

## 1. 결론 먼저 — 스택 검증

> 사용자가 들은 정보: "React 19 + React Three Fiber 9 + Three.js + GSAP + custom GLSL shader"

**전부 사실.** 번들에서 버전까지 확인됨.

| 항목 | 들은 정보 | 번들 실측 | package.json | 판정 |
|---|---|---|---|---|
| React | 19 | `19.2.3` | `^19.2.0` | ✅ |
| React Three Fiber | 9 | `@react-three/fiber` 확인 | `^9.4.2` | ✅ |
| Three.js | — | `REVISION = "182"` | `^0.182.0` | ✅ (r182) |
| GSAP | — | `version:"3.14.2"` | `^3.14.2` | ✅ |
| custom GLSL | — | `onBeforeCompile` 주입 셰이더 3종 | `src/components/canvas/shaders/` | ✅ |

**다만 그 설명은 절반만 말한 것이다.** 이 사이트의 정체성은 라이브러리 목록이 아니라 아래 두 가지다.

1. **3D 모델이 0개다.** `.glb` / `.gltf` / `.hdr` / `.exr` 파일이 단 하나도 없다. 씬 전체가 텍스처를 입힌 **평면(`planeGeometry`)** 으로만 만들어졌다.
2. **조명이 0개다.** 머티리얼 142개가 전부 `meshBasicMaterial`(무조명). 그림자·PBR 계산이 아예 없다.

번들 실측 (`Experience-*.js` 청크의 R3F JSX 엘리먼트 개수):

```
158  "mesh"              ← 씬의 모든 오브젝트
115  "planeGeometry"     ← 전부 평면. box/sphere 조차 없음
101  "group"
142  "meshBasicMaterial" ← 전부 무조명
  0  GLTFLoader / DRACOLoader / KTX2Loader
```

즉 **"손으로 그린 종이를 3D 공간에 세워 만든 디오라마"** 다. Blender를 못 다뤄서 우회한 결과가 그대로 비주얼 아이덴티티가 됐다고 저자가 직접 밝혔다.

---

## 2. 빌드/배포 방식

| 레이어 | 사용 기술 | 확인 근거 |
|---|---|---|
| 번들러 | **Vite 7** (Next.js 아님) | `<script type="module" crossorigin src="/assets/index-BWgbYKJh.js">`, `<div id="root">`, `vite.config.js` |
| 렌더링 | **순수 CSR SPA** | SSR/SSG 마커 없음. `#root` 하나에 전체 마운트 |
| 호스팅 | **Cloudflare Pages** | `server: cloudflare`, `cf-cache-status: DYNAMIC`, `functions/sanity-cdn` (Pages Function) |
| CMS | **Sanity** (headless) | `projectId: kv5wjjmj`, `dataset: production`, GROQ: `galleryProject`, `studioItem`, `awardCertificate` |
| 분석 | PostHog + Cloudflare Insights | `posthog-js`, `beacon.min.js` |
| 폰트 | Google Fonts (Caveat, Gloria Hallelujah, Inter) | `<link>` preconnect |

**번들 크기**
- `index-*.js` 약 **1.5 MB** (React + Three.js r182 + GSAP + drei 일부)
- `Experience-*.js` 약 **329 KB** — 3D 씬 전체를 **lazy chunk로 분리** (프리로더 뒤에 로드)
- `index-*.css` 약 27 KB
- `public/` 정적 에셋 약 **98 MB** (webp 369개, mp3 9개)

---

## 3. 실제 의존성 — 무엇을 쓰고 무엇을 안 썼나

`src/` 전체 import 실측:

```
53  react
44  three            ← three를 직접 상당히 많이 씀
38  @react-three/fiber
32  @react-three/drei
17  gsap
 2  posthog-js
 1  @sanity/client, @sanity/image-url
```

**drei는 딱 10개만 쓴다** (트리셰이킹으로 극히 일부만 번들에 포함):

```
20  useTexture        ← 텍스처 로딩 전부
17  Text              ← troika-three-text SDF 텍스트 (번들의 uTroika* 유니폼 정체)
 8  PositionalAudio   ← 3D 공간 오디오
 1  PerformanceMonitor, Html, Float, Edges, Preload, Plane, useCursor
```

**GSAP은 core + Observer 플러그인만.** ScrollTrigger는 설치조차 안 됨 (번들에 구현체 0). 캔버스 기반 사이트라 DOM 스크롤이 아예 없고, `Observer`로 wheel/touch/trackpad를 통합 수신해 카메라를 직접 움직인다.

**쓰지 않은 것 (참고할 때 오해 주의)**
- ❌ Next.js, React Router (설치돼 있으나 import 0)
- ❌ Lenis / 스무스 스크롤 라이브러리 (저자 표현: "Lenis heritage in scroll philosophy" = 철학만 참고)
- ❌ postprocessing / EffectComposer (설치돼 있으나 import 0)
- ❌ zustand — 상태관리는 **React Context 4개**로 처리 (`SceneContext`, `PerformanceContext`, `AchievementsContext`, `AudioManager`)
- ❌ KTX2 / Basis (시도했다가 되돌림 — 5절 참고)

**죽은 의존성** (package.json에 있으나 `src`에서 import 0): `react-router-dom`, `@react-three/postprocessing`, `r3f-perf`, `vara`, `@gsap/react`

---

## 4. 아키텍처

```
src/  (JSX/JS 64개 파일, 18,463줄)
├── App.jsx                       Canvas 설정 + Provider 조립 (242줄)
├── components/canvas/
│   ├── Experience.jsx            → lazy chunk 경계
│   ├── entrance/EntranceDoors.jsx        (1,020줄)
│   ├── corridor/                 무한 복도 (15개 파일)
│   │   ├── InfiniteCorridorManager.jsx   세그먼트 스폰/디스폰
│   │   ├── CorridorSegment.jsx           SEGMENT_LENGTH = 80
│   │   ├── DoorSection.jsx               (1,286줄) — 문 진입/이탈 시퀀스
│   │   └── RoomWarmup.jsx                셰이더 사전 컴파일
│   ├── rooms/                    4개 방 = 각각 독립 세계
│   │   ├── Gallery/GalleryRoom.jsx       (1,366줄) 무한 빨래줄
│   │   ├── About/InfiniteSkyManager.jsx  (1,435줄) 종이비행기 비행
│   │   ├── Studio/StudioRoom.jsx         (867줄) 떠다니는 모니터
│   │   └── Contact/                      해변 + 표류통
│   └── shaders/                  PaintReveal / Reveal / RevealBasic
├── hooks/useInfiniteCamera.js    (정확히 500줄)
├── context/                      Scene / Performance / Achievements / Audio
└── config/texturePreloadList.js  (339줄) 프리로드 목록 수동 관리
```

### 4-1. 무한 복도 = 청크 시스템

- 복도를 **길이 80 유닛 세그먼트**로 쪼개고, **현재 ± 1개만 마운트**한다 (`activeSegments`).
- 그 위에 `SegmentVisibilityWrapper`가 `useFrame`으로 매 프레임 가시성 판정 → 카메라 뒤 5유닛 넘어가면 `visible = false`로 드로우콜 0.
- 문 배치는 좌우 교차 4개: `z = -18(L), -32(R), -48(L), -62(R)`.

### 4-2. 카메라 (`useInfiniteCamera.js` — 500줄)

한 훅이 동시에 6가지를 한다:
1. GSAP `Observer`로 스크롤 이동 (wheel/touch/trackpad 통합)
2. 데스크톱 마우스 패럴랙스
3. 모바일 자이로 패럴랙스
4. **auto-glance** — 문에 접근하면 카메라가 스스로 그쪽으로 살짝 고개를 돌림
   (`START_DIST=15 → PEAK_DIST=8 → END_DIST=-2`, easeOutQuad)
5. 방향키/스페이스/PageUp·Down 키보드 내비 (접근성)
6. **override 모드** — 문 진입/이탈 시 GSAP에 카메라 통제권 위임

이탈 시 스냅 방지 트릭: "이상적인 glance 값으로 튀지 않고, 현재 실제 회전값에서 glance를 역산해 그 지점부터 부드럽게 수렴시킨다."

### 4-3. Canvas 설정

```jsx
camera={{ position: [0, 0.2, 28], fov: 60, near: 0.1, far: 150 }}
gl={{ antialias: settings.antialias, alpha: false,
      powerPreference: settings.powerPreference,
      localClippingEnabled: true,          // 방 격리용 클리핑 평면
      failIfMajorPerformanceCaveat: true }}
dpr={settings.dpr}
<color attach="background" args={['#fafafa']} />
<fog   attach="fog" args={['#fafafa', 15, 50]} />   // far=150 + fog 15~50 = 공격적 드로우 거리 제한
```

---

## 5. 커스텀 GLSL — 핵심 인터랙션

### `PaintRevealMaterial` — "호버하면 색이 칠해진다"

**기법: `ShaderMaterial`을 새로 쓰지 않고 `MeshBasicMaterial`을 `onBeforeCompile`로 패치**한다. three의 UV 매핑·컬러스페이스·투명도 파이프라인을 그대로 유지하면서 픽셀 선택 로직만 얹는 방식. (저자 본인이 이 선택을 명시적으로 설명)

모든 요소가 **텍스처 2장 페어**로 존재한다 — 스케치판 + 색칠판. 파일명 규칙이 그대로 드러남:
`GSAPduzybalon.webp` / `GSAPduzybalon_painted.webp` (총 94쌍)

**Fragment — 브러시 리빌** (`#include <map_fragment>` 치환):
```glsl
vec4 paintedColor = texture2D(mapPainted, vMapUv);
float rn = revealNoise(vMapUv * 15.0) * 0.15;   // value noise로 경계 흐트리기
float maskValue = (1.0 - vMapUv.y) + rn;        // 아래→위 와이프
float threshold = uProgress * 1.5;
if (maskValue < threshold) texColor = paintedColor;
```
`uProgress`는 호버 시 GSAP이 0→1로 트윈. 노이즈 때문에 깔끔한 와이프가 아니라 **종이에 물감이 번지는** 경계가 나온다.

> UX 의도: "색이 칠해지면 클릭 가능하다"는 시각적 어포던스. 별도 커서/툴팁 없이 인터랙션을 가르친다.

**앞/뒷면 다른 텍스처** — 3D 모델 없이 "종이 한 장"을 표현하는 핵심 트릭:
```glsl
vec2 backUv = vec2(vMapUv.x, 1.0 - vMapUv.y);        // 뒷면은 Y 뒤집기
vec4 backColor = texture2D(mapBack, backUv);
vec4 sampledDiffuseColor = gl_FrontFacing ? texColor : backColor;
diffuseColor *= sampledDiffuseColor;
diffuseColor.rgb *= 1.4;                              // 종이 텍스처 보정용 밝기 부스트
```

**Vertex — 종이 휘어짐 + 바람** (`#include <begin_vertex>` 치환):
```glsl
float bendAmount = pow(transformed.y, 2.0) * uBend;   // 포물선 컬링
transformed.z += bendAmount;
float totalWind = 0.02 + uWindStrength;               // 기본 + 호버 시 추가
float flutter = sin(uTime * 2.0 + transformed.y * 2.0) * totalWind * (1.0 + abs(uBend * 3.0));
transformed.z += flutter;
```

**월드 공간 페인트 스윕** (`#include <dithering_fragment>` 치환) — 진행에 따라 세계가 칠해지며 생겨남:
```glsl
vec3 localPos = vWorldPositionColor - uRoomOrigin;    // 세그먼트 상대좌표 (무한 복도 대응)
vec3 revealDir = normalize(vec3(-1.0, 0.0, 0.1));
float targetDist = mix(-5.0, 55.0, uPaintProgress);
float boundary = (targetDist - dot(localPos, revealDir))
               + revealNoise(localPos.yz * 2.0) * 2.0
               + revealNoise(localPos.yz * 8.0) * 0.5;
if (boundary < 0.0) discard;                          // 아직 안 칠해진 곳은 렌더 자체를 안 함
float glow = smoothstep(2.0, 0.0, boundary);
if (uPaintProgress < 0.999 && boundary < 2.0)
    gl_FragColor.rgb += vec3(glow * 0.4, glow * 0.5, glow * 0.7);   // "젖은 물감" 발광 엣지
```
(셰이더 안에 폴란드어 주석이 그대로 남아 있음: `// === KIERUNEK ZAMALOWYWANIA ===` = "칠하는 방향")

### GSAP ↔ GLSL 브릿지

가장 배울 만한 패턴. `useImperativeHandle`로 유니폼을 **getter/setter 프로퍼티로 노출**해서, GSAP이 평범한 JS 객체처럼 트윈할 수 있게 만든다:

```js
useImperativeHandle(ref, () => ({
  set bend(v) { matRef.current?.userData?.shader && (shader.uniforms.uBend.value = v) },
  get bend()  { return shader?.uniforms.uBend.value || 0 },
  // windStrength, uProgress 동일
}));
// → gsap.to(matRef.current, { bend: 1, duration: 0.6 })
```

---

## 6. 성능 전략 — 실제로 효과 본 것들

저자가 커뮤니티 피드백("예쁜데 슬라이드쇼처럼 돌아간다")을 받고 잡은 순서:

### ① 조명 전면 제거 — 가장 큰 승리
directional 2개 + ambient 1개가 실시간 그림자를 계산하고 있었다. **씬이 전부 평면인데 그림자가 시각적으로 아무 차이를 만들지 못했다.** 조명을 다 지우고 텍스처 색상값에 음영을 살짝 baked-in. 겉보기 변화 거의 없음, 성능은 극적 개선.

### ② `RoomWarmup` — 셰이더 사전 컴파일
three는 셰이더를 lazy 컴파일한다 → 문 열 때마다 첫 렌더에서 스터터. 해법: 프리로더 단계에서 **4개 방을 씬 아래 500유닛 지점에 전부 마운트**하고 GPU에 강제 컴파일시킨 뒤 언마운트.
```jsx
<group position={[0, -500, 0]}>
  <GalleryRoom showRoom isWarmup /> <StudioRoom showRoom isWarmup />
  <AboutRoom  showRoom isWarmup /> <ContactRoom showRoom isWarmup />
</group>
// gl.compileAsync(scene, camera, scene).catch(() => gl.compile(scene, camera))
```
저사양 기기에서는 WebGL 컨텍스트 손실 방지를 위해 **워밍업을 건너뛴다**.

### ③ 3단 디바이스 티어링 (`PerformanceContext.jsx`)

| | dpr | shadows | antialias | powerPreference | particles |
|---|---|---|---|---|---|
| HIGH | `[1, 2]` | true | true | high-performance | 100% |
| MEDIUM | `[1, 1.5]` | false | true | default | 60% |
| LOW | `[0.8, 1]` | false | false | low-power | 30% |

판정: `userAgent` 모바일 → MEDIUM / `hardwareConcurrency <= 4` → 강등 / `deviceMemory <= 4` → LOW.
그 위에 drei `PerformanceMonitor`가 실시간 FPS를 보고 `onDecline` 시 자동 강등 (`flipflops={3}`).

> 소스에 남은 주석: 작은 화면 휴리스틱은 **제거**했다 — 최신 폰 CSS 폭이 430px 미만이라 오탐(iPhone 15 Pro Max = 430px).

### ④ KTX2/Basis — 실패해서 되돌린 최적화
"WebGL 성능의 정석"이라 전부 변환했으나: 텍스처 정렬 깨짐, 색 시프트, 프리로더 2초 느려짐, **손그림 특유의 얇은 선과 미묘한 그라데이션 품질 저하**. WebP로 롤백. 이미 데스크톱 144FPS / 모바일 60FPS가 나오고 있었기 때문.

### 실측 결과 (저자 주장)
데스크톱(144Hz) 144FPS · 모바일 60FPS · 80유로짜리 씽크패드 15~30FPS

---

## 7. 에셋 파이프라인

- **텍스처 전부 AI 생성** (Google 이미지 생성) 후 압축·트리밍. 손으로 그린 게 아니다.
  저자: "수백 장을 같은 손그림 스타일로 뽑는 게 가장 힘들었다. 20장 뽑아서 튀지 않는 하나를 고르곤 했다."
- 포맷 **WebP 단일**. 배포 번들 참조 210개 / 레포 369개.
- **자체 최적화 스크립트 13개** (`scripts/`) — `sharp`, `jimp` 기반. `optimize_clouds.js`, `optimize_corridor_recursive.js`, `fix_quality.js` 등 방/카테고리별로 따로 돌린다.
- 프리로드 목록은 `config/texturePreloadList.js`에 **339줄 수동 관리**.

폴더 구성 (배포 번들 참조 기준):
```
studio 80 · about 74 · corridor 50 · gallery 44 · corridor/doors 38
entrance 26 · clouds 24 · doors 20 · contact 19
corridor/decorations 14 · corridor/avatar_anim 9   ← 1~9.webp 플립북 애니메이션
```

파일명이 전부 폴란드어라 구조가 그대로 읽힌다: `duzybalon`(큰 풍선) / `srednibalon`(중간) / `malybalon`(작은), `beczka`(통), `latarnia`(등대), `molo`(부두), `statek`(배), `faletopdown`(파도 탑다운)

---

## 8. 사운드 디자인

three.js `AudioListener` + drei `PositionalAudio` (8곳) = **3D 공간 오디오**. 방마다 고유 앰비언스:

| 공간 | 사운드 | 파일 |
|---|---|---|
| 복도 | 배경 음악 루프 | — |
| Gallery | 도시 소음 | `szummiasta.mp3` |
| Studio | 모니터 웅웅거림 | `szummonitorow.mp3` |
| About | 비행 중 바람 | `szumwiatru.mp3` |
| Contact | 파도 | `szummorza.mp3` |
| 문 | 호버 삐걱 / 열림 / 닫힘 3종 | `uchyleniedrzwi` / `otwarciedrzwi` / `zamknieciedrzwi` |

저자: "사운드가 3D 사이트를 '그래픽 있는 페이지'가 아니라 '장소'로 만든다."

---

## 9. UX 장치 — 비표준 인터페이스를 가르치는 방법

스크롤 없는 3D 공간은 "무엇을 해야 하는지 모른다"는 근본 문제가 있다. 해법 2개:

**① 색칠 어포던스** — 호버 시 색이 칠해지면 클릭 가능. 툴팁 없는 시각적 규칙.

**② 업적 시스템 = 튜토리얼** (Bruno Simon 포트폴리오 참고)
```js
const ACHIEVEMENTS = {
  corridor_enter:   { label: 'Click a door to enter',          title: 'Explorer' },
  corridor_explore: { label: 'Scroll to explore the corridor', title: 'Wanderer' },
  about_fly:        { label: 'Scroll to fly through my story', title: 'Sky Walker' },
  studio_interact:  { label: 'Drag to rotate and browse',      title: 'Director' },
  gallery_inspect:  { label: 'Click project to inspect',       title: 'Art Critic' },
  contact_choose:   { label: 'Find a contact method',          title: 'Sociable' },
};
```
방에 들어가면 조작 안내 툴팁이 뜨고, 그 동작을 하면 툴팁이 **완료 배지로 변신 + 차임**. 진행도는 localStorage, 해금마다 PostHog 이벤트 → 어느 방이 실제로 탐색되는지 측정.

---

## 10. SPA인데 SEO를 어떻게 했나 (별도로 배울 만한 부분)

CSR SPA + 캔버스 = 크롤러가 읽을 텍스트가 0. 해법: **빌드타임 커스텀 Vite 플러그인 `seo-plugin.js`**

1. 빌드 시 `@sanity/client`로 CMS 콘텐츠를 직접 가져온다
2. schema.org **JSON-LD 그래프**를 생성 (`Person` @id 노드를 중심으로 프로젝트·수상·FAQ 연결)
3. 시각적으로 숨긴 (`.sr-only-seo`, 1×1px) **FAQ `<article>` 블록**을 `index.html`에 주입

플러그인 주석에 의도가 명시돼 있다: *"AI search engines (Google AI Overviews, Perplexity, Gemini)가 콘텐츠를 이해하고 인용하는 데 쓰는 schema.org 엔티티를 생성한다."* — 전통 SEO가 아니라 **LLM 인용 대상이 되기 위한 SEO**.

`index.html`의 나머지 SEO 처리도 꼼꼼하다: canonical, OG(1200×630 webp), Twitter card, `theme-color`, `preload` + `fetchpriority="high"`로 `paper-texture.webp` 우선 로드, `noscript` 폴백.

---

## 11. 제작 과정 (저자 기술)

- **2025년 12월 시작 → 4개월 후 라이브.** 처음엔 "손그림 텍스처를 얹은 2D HTML 사이트" 구상이었으나 몇 주 만에 깊이가 필요하다고 판단, Three.js + R3F로 전환.
- **핵심 방법론 — "mechanics first"**:
  > "먼저 각본을 써라. 코드 한 줄 전에 영화를 상상하라. 사용자가 무엇을 보는가, 카메라는 어디로 가는가, 이야기는 무엇인가.
  > 그다음 단순한 도형으로 메커니즘을 만들어라. 사각형, 큐브. 텍스처도 셰이더도 없이 순수한 움직임과 흐름만.
  > **아무것도 아닌 것처럼 보일 때 느낌이 맞게 되도록 만들어라.** 세계를 입히는 건 그다음이다."
- 가장 어려웠던 부분: 방 진입/이탈 카메라 시퀀스 (`DoorSection.jsx` 1,286줄). 정렬 → lazy 로드 대기 → 문 열림 애니메이션 → 통과 비행 → 역순 이탈, 각 단계마다 버그. 톱니형(각진) 벽 때문에 회전 수학이 복잡.
- 되돌아보면 안 했을 것: **directional light 2개 + moon 셰이더** (며칠 디버깅, 시각적 이득 0), **KTX2 실험**.

**수상**: GSAP SOTD + 공식 쇼케이스 · FWA of the Day · CSSDA Special Kudos + Public Choice 3회 · Orpetron SOTD · CSS Winner SOTD · Awwwards Honorable Mention

---

## 12. 우리 포트폴리오에 가져올 것 / 버릴 것

### 가져올 만한 것

| 아이디어 | 왜 | 비용 |
|---|---|---|
| **3D 모델 없이 평면 + 텍스처** | Blender 없이 3D 사이트 성립. 성능도 압도적으로 유리 | 낮음 |
| **무조명 `meshBasicMaterial`** | 평면 씬에서 조명은 순손실. 음영은 텍스처에 baked-in | 매우 낮음 |
| **`onBeforeCompile` 패치 방식 셰이더** | three 파이프라인 유지 + 최소 GLSL. 처음부터 `ShaderMaterial` 쓰는 것보다 훨씬 안전 | 낮음 |
| **`useImperativeHandle`로 유니폼 노출 → GSAP 트윈** | 셰이더 애니메이션을 평범한 GSAP 코드로 작성 가능 | 매우 낮음 |
| **호버 색칠 = 클릭 가능 어포던스** | 비표준 UI를 툴팁 없이 가르침 | 중간 |
| **셰이더 사전 컴파일 워밍업** | 첫 진입 스터터 제거. R3F 쓰면 거의 필수 | 낮음 |
| **3단 디바이스 티어링 + `PerformanceMonitor` 자동 강등** | 저사양 기기 대응의 표준형 | 낮음 |
| **빌드타임 JSON-LD + 숨김 FAQ 주입** | CSR SPA의 SEO/LLM 인용 문제 해결. 3D 안 해도 유용 | 낮음 |
| **업적 = 튜토리얼** | 온보딩 + 참여도 측정 동시 해결 | 중간 |
| **"mechanics first"** | 텍스처 없이 사각형으로 먼저 느낌을 잡는다 | — |

### 참고만 하고 따라하지 말 것

- **98MB 정적 에셋 / 1.5MB JS 번들** — 개인 포트폴리오라 감수한 수치. Cloudflare CDN 전제.
- **1,286줄 / 1,435줄 단일 컴포넌트** — 저자도 "크기가 자랑스럽지 않다"고 인정. 엣지 케이스가 쌓인 결과.
- **텍스처 프리로드 목록 339줄 수동 관리** — 자동화 여지 큼.
- **죽은 의존성 5개** (`react-router-dom`, `@react-three/postprocessing`, `r3f-perf`, `vara`, `@gsap/react`).
- **KTX2** — 손그림 스타일에는 역효과. 사진/PBR 텍스처라면 결론이 다를 수 있음.
- **UX 자체** — 저자도 "표준 레이아웃보다 UX가 깔끔하지 않다는 걸 안다"고 인정. 채용/영업 전환이 목적이라면 트레이드오프를 의식적으로 선택해야 함.

---

## 부록: 확인 방법 (재현용)

```bash
# 스택 지문
curl -s https://itomdev.com/ | grep -oE '<script[^>]*src="[^"]+"'
curl -s https://itomdev.com/assets/index-BWgbYKJh.js > main.js
grep -oE 'f1="[0-9]+"' main.js              # three REVISION = 182
grep -oE 'version:"3\.[0-9.]+"' main.js     # gsap 3.14.2
grep -oE '"19\.[0-9]+\.[0-9]+"' main.js     # react 19.2.3

# 3D 모델 없음 / 무조명 증명
curl -s https://itomdev.com/assets/Experience-ofTVAJf3.js > exp.js
grep -oE '"(mesh|planeGeometry|group|meshBasicMaterial)"' exp.js | sort | uniq -c
grep -c 'GLTFLoader\|\.glb\|\.gltf' exp.js  # → 0

# 커스텀 셰이더 원문
grep -oE 'uniform sampler2D mapBack.{0,3000}' exp.js
```
