/**
 * 복도 벽에 걸린 액자.
 *
 * 문과 문 사이가 28유닛씩 비어 있어서, 걷는 동안 볼 것이 벽 색깔밖에 없었습니다.
 * 액자는 문보다 여섯 유닛 앞, 맞은편 벽에 겁니다 — 문에 다가가는 동안 그 방의 예고를
 * 정면으로 보게 됩니다. 문과 같은 z에 걸면 정작 문 앞에 섰을 때 시야를 벗어납니다.
 * 좌우가 번갈아 나와 걷는 동안 리듬이 생깁니다.
 *
 * 그림은 방 사물과 같은 손그림 규칙을 씁니다(lib/props.ts) — 같은 잉크색, 같은 떨림 필터.
 */
import { INK, PAPER, WOOD } from './props.ts';

export type Frame = {
  id: string;
  side: 'left' | 'right';
  z: number;
  /** 벽에서의 중심 높이(유닛). 눈높이는 1.6입니다. */
  y: number;
  /** 가로 폭(유닛). 세로는 그림 비율이 정합니다. */
  w: number;
  /** 손으로 건 티. 라디안 — 0이면 자로 잰 듯해서 이 세계의 물건으로 안 읽힙니다. */
  tilt: number;
  svg: string;
  /** 세로/가로 비. art()가 계산해 넣습니다. */
  ratio: number;
  title: string;
  body: string;
};

/** 액자 한 장. 나무틀 → 흰 매트 → 그림 순으로 겹칩니다. */
const art = (w: number, h: number, inner: string, seed: number) => ({
  ratio: h / w,
  // width/height를 viewBox의 2배로 두면 좌표는 그대로 두고 래스터만 촘촘해집니다.
  svg:
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="0 0 ${w} ${h}">` +
    `<defs><filter id="fr${seed}"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="${seed}" result="n"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="n" scale="1.3" xChannelSelector="R" yChannelSelector="G"/></filter></defs>` +
    `<g filter="url(#fr${seed})" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round" fill="none">` +
    `<rect x="5" y="5" width="${w - 10}" height="${h - 10}" fill="${WOOD}" stroke-width="4"/>` +
    `<rect x="16" y="16" width="${w - 32}" height="${h - 32}" fill="${PAPER}" stroke-width="2.6"/>` +
    inner +
    `</g></svg>`,
});

/* ── 그림들 ─────────────────────────────────────────
   좌표는 200×158(가로) 또는 158×200(세로) 안입니다. 매트 안쪽은 16px 들어와 있습니다. */

/** 아잉 얼굴 한 장. 눈과 입만 갈아 끼우면 다른 표정이 됩니다 — 에셋 킷을 만든 방식 그대로입니다. */
const face = (eyes: string, mouth: string, extra = '') =>
  `<ellipse cx="100" cy="84" rx="40" ry="36" fill="#fff" stroke-width="3"/>` +
  `<path d="M70 58 68 32 92 48" fill="#fff" stroke-width="3"/>` +
  `<path d="M130 58 132 32 108 48" fill="#fff" stroke-width="3"/>` +
  `<path d="M66 72q34-24 68 0" stroke="#A8DDF0" stroke-width="7"/>` +
  eyes +
  `<path d="M97 98h6" stroke-width="3"/>` +
  mouth +
  `<ellipse cx="74" cy="98" rx="6" ry="4" fill="#F5C6D0" stroke="none"/>` +
  `<ellipse cx="126" cy="98" rx="6" ry="4" fill="#F5C6D0" stroke="none"/>` +
  `<path d="M54 88h13M54 96h13M133 88h13M133 96h13" stroke-width="2.2"/>` +
  extra;

const heart = (cx: number) =>
  `<path d="M${cx - 9} 86a4.6 4.6 0 0 1 9 -2 4.6 4.6 0 0 1 9 2c0 5.4-9 10.6-9 10.6s-9-5.2-9-10.6z" fill="#F5C6D0" stroke-width="2"/>`;

const EYES_SMILE = `<path d="M82 90q7-9 14 0" stroke-width="3"/><path d="M104 90q7-9 14 0" stroke-width="3"/>`;
const EYES_OPEN = `<circle cx="88" cy="88" r="6.5" fill="${INK}" stroke="none"/><circle cx="112" cy="88" r="6.5" fill="${INK}" stroke="none"/>`;
const EYES_SHUT = `<path d="M82 90h14M104 90h14" stroke-width="3"/>`;
const EYES_WINK = `<path d="M82 90q7-9 14 0" stroke-width="3"/><circle cx="112" cy="88" r="6.5" fill="${INK}" stroke="none"/>`;
const EYES_LOVE = heart(88) + heart(112);

const MOUTH_SMILE = `<path d="M92 104q8 9 16 0" stroke-width="3"/>`;
const MOUTH_OH = `<ellipse cx="100" cy="107" rx="7" ry="9" fill="#F5C6D0" stroke-width="2.6"/>`;
const MOUTH_TINY = `<path d="M95 105h10" stroke-width="3"/>`;
const MOUTH_WIDE = `<path d="M88 102q12 14 24 0z" fill="#F5C6D0" stroke-width="2.8"/>`;
const MOUTH_BENT = `<path d="M92 105q8-6 16 1" stroke-width="3"/>`;
const EYES_SIDE = `<path d="M82 90q7-9 14 0" stroke-width="3"/><circle cx="115" cy="86" r="6" fill="${INK}" stroke="none"/>`;
const EYES_STAR =
  `<path d="M88 80 90.4 86.4 96.8 88 90.4 89.6 88 96 85.6 89.6 79.2 88 85.6 86.4z" fill="${INK}" stroke="none"/>` +
  `<path d="M112 80 114.4 86.4 120.8 88 114.4 89.6 112 96 109.6 89.6 103.2 88 109.6 86.4z" fill="${INK}" stroke="none"/>`;

const HELLO = face(EYES_SMILE, MOUTH_SMILE);
const WOW = face(EYES_OPEN, MOUTH_OH);
const SLEEP = face(EYES_SHUT, MOUTH_TINY, `<path d="M146 42h15l-15 17h15" stroke-width="2.4"/><path d="M166 24h10l-10 12h10" stroke-width="2"/>`);
const WINK = face(EYES_WINK, MOUTH_SMILE);
const LOVE = face(EYES_LOVE, MOUTH_SMILE);
const PROUD = face(EYES_SMILE, MOUTH_WIDE);
const PONDER = face(EYES_SIDE, MOUTH_BENT, `<path d="M150 46q10-10 18 0" stroke-width="2.2"/><circle cx="160" cy="62" r="3" fill="${INK}" stroke="none"/>`);
const CHEER = face(EYES_STAR, MOUTH_WIDE);

/** 지금 걷고 있는 복도. 액자 안에 같은 복도가 또 있습니다. */
const RECUR =
  `<path d="M24 24 88 70 112 70 176 24z" fill="#F0EBDE" stroke="none"/>` +
  `<path d="M24 24 88 70 88 88 24 134z" fill="#E4DDCA" stroke="none"/>` +
  `<path d="M176 24 112 70 112 88 176 134z" fill="#D6CDB6" stroke="none"/>` +
  `<path d="M24 134 88 88 112 88 176 134z" fill="#C6B598" stroke="none"/>` +
  `<rect x="88" y="70" width="24" height="18" fill="#FDFCF8" stroke="none"/>` +
  `<path d="M24 24 88 70M176 24 112 70M24 134 88 88M176 134 112 88" stroke-width="2.2"/>` +
  `<rect x="88" y="70" width="24" height="18" stroke-width="2"/>` +
  `<path d="M50 46v66M64 56v46" stroke-width="2.4"/>` +
  `<path d="M150 46v66M136 56v46" stroke-width="2.4"/>`;

/** 앱 없이 시작 — 매장 QR. */
const QR =
  `<rect x="58" y="40" width="84" height="84" fill="#fff" stroke-width="3"/>` +
  `<rect x="66" y="48" width="22" height="22" fill="#A8DDF0" stroke-width="2.4"/>` +
  `<rect x="112" y="48" width="22" height="22" fill="#A8DDF0" stroke-width="2.4"/>` +
  `<rect x="66" y="94" width="22" height="22" fill="#A8DDF0" stroke-width="2.4"/>` +
  `<g fill="${INK}" stroke="none">` +
  `<rect x="96" y="52" width="8" height="8"/><rect x="96" y="66" width="8" height="8"/>` +
  `<rect x="110" y="80" width="8" height="8"/><rect x="96" y="94" width="8" height="8"/>` +
  `<rect x="124" y="94" width="8" height="8"/><rect x="110" y="108" width="8" height="8"/>` +
  `<rect x="124" y="108" width="8" height="8"/></g>`;

/** 운영자 권한 — 열쇠 하나로 전부 열리지 않게. */
const KEY =
  `<circle cx="72" cy="80" r="19" fill="#B8B0E8" stroke-width="3"/>` +
  `<circle cx="72" cy="80" r="7" fill="${PAPER}" stroke-width="2.4"/>` +
  `<path d="M91 80h52" stroke-width="4"/>` +
  `<path d="M127 80v17M139 80v14" stroke-width="4"/>`;

/** 장애 격리 — 한 칸이 꺼져도 옆 칸은 켜져 있습니다. */
const RACK =
  `<rect x="48" y="40" width="62" height="120" fill="#9DA6D8" stroke-width="3"/>` +
  `<path d="M56 64h46M56 88h46M56 112h46M56 136h46" stroke-width="2.4"/>` +
  `<g stroke="none"><circle cx="98" cy="52" r="3.6" fill="#fff"/><circle cx="98" cy="76" r="3.6" fill="#fff"/>` +
  `<circle cx="98" cy="100" r="3.6" fill="#B4645A"/><circle cx="98" cy="124" r="3.6" fill="#fff"/>` +
  `<circle cx="98" cy="148" r="3.6" fill="#fff"/></g>` +
  `<path d="M40 100h-14M118 100h14" stroke-width="2.2"/>`;

/** 그전에 만든 것 — 관제, 앱, 영상. */
const REEL =
  `<circle cx="100" cy="80" r="37" fill="#F5C6D0" stroke-width="3"/>` +
  `<circle cx="100" cy="80" r="9" fill="${PAPER}" stroke-width="2.4"/>` +
  `<circle cx="100" cy="56" r="8" fill="${PAPER}" stroke-width="2.2"/>` +
  `<circle cx="100" cy="104" r="8" fill="${PAPER}" stroke-width="2.2"/>` +
  `<circle cx="76" cy="80" r="8" fill="${PAPER}" stroke-width="2.2"/>` +
  `<circle cx="124" cy="80" r="8" fill="${PAPER}" stroke-width="2.2"/>` +
  `<path d="M137 92q14 10 26 2" stroke-width="2.4"/>`;

/** 직접 그린 것 — 붓과 팔레트. */
const BRUSH =
  `<path d="M52 100a30 22 0 1 0 52 -14 9 9 0 0 1 -12 -8 30 22 0 0 0 -40 22z" fill="#EFE3C8" stroke-width="3"/>` +
  `<g stroke="none"><circle cx="66" cy="96" r="5" fill="#F5C6D0"/><circle cx="80" cy="88" r="5" fill="#A8DDF0"/>` +
  `<circle cx="94" cy="98" r="5" fill="#B8B0E8"/></g>` +
  `<path d="M112 122 146 56" stroke-width="4"/>` +
  `<path d="M143 50 155 56 149 68 137 62z" fill="${INK}" stroke-width="2.2"/>`;

/** 팀에 나눈 것 — 한 줄이면 설치됩니다. */
const TERM =
  `<rect x="50" y="44" width="100" height="72" fill="#fff" stroke-width="3"/>` +
  `<path d="M50 62h100" stroke-width="2.4"/>` +
  `<g stroke="none" fill="#D9C4A9"><circle cx="60" cy="53" r="3.4"/><circle cx="71" cy="53" r="3.4"/><circle cx="82" cy="53" r="3.4"/></g>` +
  `<path d="M62 76 71 83 62 90" stroke-width="2.6"/>` +
  `<path d="M80 90h44" stroke-width="2.6"/>` +
  `<rect x="62" y="100" width="9" height="9" fill="${INK}" stroke="none"/>`;

/**
 * 걸린 자리. z는 문과 같은 값을 쓰고 side만 뒤집습니다 —
 * 문 앞에 서면 맞은편 벽에 그 방의 그림이 걸려 있습니다.
 */
export const FRAMES: Frame[] = [
  {
    id: 'hello', side: 'right', z: 1.5, y: 1.78, w: 1.4, tilt: -0.022,
    ...art(200, 158, HELLO, 11),
    title: '아잉',
    body: '이 복도를 안내하는 캐릭터입니다. 표정 16종과 동작 16종, 3D 모델까지 직접 만들었습니다.',
  },
  {
    id: 'recur', side: 'left', z: 1.5, y: 1.74, w: 1.36, tilt: 0.026,
    ...art(200, 158, RECUR, 12),
    title: '지금 걷는 복도',
    body: '문 여섯 개가 각각 하나의 작업 사례입니다. 문에 색이 칠해지면 들어갈 수 있습니다.',
  },
  {
    id: 'qr', side: 'right', z: -8, y: 1.8, w: 1.32, tilt: 0.018,
    ...art(200, 158, QR, 13),
    title: '앱 없이 시작',
    body: '매장 QR을 찍으면 주문과 결제까지 웹에서 이어집니다. 조금 더 가면 나오는 왼쪽 문이 그 이야기입니다.',
  },
  {
    id: 'key', side: 'left', z: -22, y: 1.76, w: 1.38, tilt: -0.02,
    ...art(200, 158, KEY, 14),
    title: '열쇠 하나로 다 열리지 않게',
    body: '누가 무엇을 볼 수 있는지 한 곳에서 정했습니다. 조금 더 가면 나오는 오른쪽 문이 그 이야기입니다.',
  },
  {
    id: 'rack', side: 'right', z: -36, y: 1.82, w: 1.06, tilt: 0.015,
    ...art(158, 200, RACK, 15),
    title: '한 칸이 꺼져도',
    body: '외부 서비스가 멈추면 그 기능만 끊고 나머지는 계속 씁니다. 조금 더 가면 나오는 왼쪽 문이 그 이야기입니다.',
  },
  {
    id: 'reel', side: 'left', z: -50, y: 1.76, w: 1.36, tilt: 0.024,
    ...art(200, 158, REEL, 16),
    title: '그전에 만든 것',
    body: '도로 관제, 맛집 영상 앱, 실시간 통역. 2019년부터의 일입니다. 조금 더 가면 나오는 오른쪽 문에 있습니다.',
  },
  {
    id: 'brush', side: 'right', z: -64, y: 1.78, w: 1.4, tilt: -0.017,
    ...art(200, 158, BRUSH, 17),
    title: '직접 그린 것',
    body: '캐릭터의 표정과 동작, 색표까지 손으로 정했습니다. 조금 더 가면 나오는 왼쪽 문이 그 작업입니다.',
  },
  {
    id: 'term', side: 'left', z: -78, y: 1.74, w: 1.36, tilt: 0.02,
    ...art(200, 158, TERM, 18),
    title: '한 줄로 설치',
    body: '팀의 약속을 네 가지 AI 개발 도구에 한 번에 넣습니다. 조금 더 가면 나오는 오른쪽 문이 그 이야기입니다.',
  },
  {
    id: 'wow', side: 'right', z: -16, y: 1.72, w: 0.86, tilt: 0.03,
    ...art(200, 158, WOW, 21),
    title: '이건 놀랐을 때',
    body: '어제 되던 것이 오늘 안 될 때의 얼굴입니다. 표정 16종 중 하나입니다.',
  },
  {
    id: 'wink', side: 'left', z: -30, y: 1.7, w: 0.86, tilt: -0.028,
    ...art(200, 158, WINK, 22),
    title: '이건 한 번에 통과했을 때',
    body: '눈과 입만 갈아 끼우면 다른 얼굴이 됩니다. 표정 16종이 그렇게 나왔습니다.',
  },
  {
    id: 'sleep', side: 'right', z: -44, y: 1.72, w: 0.86, tilt: 0.026,
    ...art(200, 158, SLEEP, 23),
    title: '이건 새벽 세 시',
    body: '원인을 찾고 나서야 자러 갑니다. 증상만 덮고 자면 다음 날 같은 자리에서 또 터집니다.',
  },
  {
    id: 'love', side: 'left', z: -58, y: 1.7, w: 0.86, tilt: -0.024,
    ...art(200, 158, LOVE, 24),
    title: '이건 마음에 들 때',
    body: '남이 만든 좋은 도구를 발견했을 때의 얼굴입니다. 그런 건 혼자 쓰지 않고 팀에 공유합니다.',
  },
  {
    id: 'proud', side: 'left', z: -64, y: 1.72, w: 0.86, tilt: 0.025,
    ...art(200, 158, PROUD, 26),
    title: '이건 다 끝냈을 때',
    body: '기능을 낸 날보다, 같은 실수가 다시 안 나게 만든 날에 이 얼굴이 됩니다.',
  },
  {
    id: 'ponder', side: 'right', z: -56, y: 1.72, w: 0.86, tilt: -0.026,
    ...art(200, 158, PONDER, 27),
    title: '이건 아직 모를 때',
    body: '원인을 모르는 채로 고치기 시작하면 대개 두 번 고치게 됩니다. 먼저 어디서 어긋났는지 찾습니다.',
  },
  {
    id: 'cheer', side: 'left', z: -86, y: 1.74, w: 0.86, tilt: 0.02,
    ...art(200, 158, CHEER, 28),
    title: '여기가 복도 끝',
    body: '끝까지 오셨습니다. 오른쪽에 연락처와 최근 영상, 최근 작업이 열려 있습니다.',
  },
  {
    id: 'wow2', side: 'right', z: -72, y: 1.74, w: 0.86, tilt: 0.022,
    ...art(200, 158, WOW, 25),
    title: '아직 놀라는 중',
    body: '복도 끝까지 가면 연락처가 열립니다. 걸어서만 가도 닿습니다.',
  },
];

/**
 * 유튜브 영상과 깃 저장소가 걸릴 자리.
 *
 * 그림이 밖에서 오므로(lib/feeds.ts) 여기서는 자리만 잡습니다. 정적 액자와 마주보게
 * 두어, 한쪽 벽에 그림이 걸리면 반대쪽에도 걸리도록 했습니다 — 복도 한쪽만 채우면
 * 걸으면서 고개를 한 방향으로만 돌리게 됩니다.
 */
export type LiveSpot = { side: 'left' | 'right'; z: number; y: number; w: number; tilt: number };

/** 영상 자리. 썸네일이 16:9라 액자가 가로로 넓습니다. */
export const VIDEO_SPOTS: LiveSpot[] = [
  { side: 'left', z: -8, y: 1.74, w: 1.34, tilt: -0.019 },
  { side: 'left', z: -18, y: 1.78, w: 1.34, tilt: 0.023 },
  { side: 'left', z: -36, y: 1.76, w: 1.34, tilt: -0.021 },
  { side: 'right', z: -48, y: 1.76, w: 1.34, tilt: 0.02 },
];

/** 저장소 자리. 글씨만 들어가므로 영상보다 납작합니다. */
export const REPO_SPOTS: LiveSpot[] = [
  { side: 'right', z: -22, y: 1.72, w: 1.16, tilt: 0.02 },
  { side: 'right', z: -32, y: 1.76, w: 1.16, tilt: -0.022 },
  { side: 'left', z: -46, y: 1.72, w: 1.16, tilt: 0.018 },
  { side: 'left', z: -74, y: 1.74, w: 1.16, tilt: -0.02 },
];

/**
 * 액자 안에 걸릴 밖의 것 하나. 영상이면 썸네일이, 저장소면 글씨만 들어갑니다.
 * 그림은 Scene이 캔버스로 그립니다 — SVG data URI는 웹폰트를 못 써서
 * 손글씨가 시스템 폰트로 주저앉기 때문입니다.
 */
export const MARK = {
  github:
    'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z',
  youtube:
    'M15.665 4.124a2.01 2.01 0 0 0-1.415-1.424C13.003 2.363 8 2.363 8 2.363s-5.003 0-6.25.337A2.01 2.01 0 0 0 .335 4.124C0 5.38 0 8 0 8s0 2.62.335 3.876a2.01 2.01 0 0 0 1.415 1.424C2.997 13.637 8 13.637 8 13.637s5.003 0 6.25-.337a2.01 2.01 0 0 0 1.415-1.424C16 10.62 16 8 16 8s0-2.62-.335-3.876zM6.364 10.379V5.621L10.545 8l-4.181 2.379z',
};

export type LiveArt = {
  id: string;
  kind: 'video' | 'repo';
  /** 누르면 열리는 곳 */
  url: string;
  title: string;
  /** 제목 아래 한 줄. "1개월 전" 또는 "TypeScript · 2026.08.20" */
  meta: string;
  /** 영상만 */
  thumb?: string;
  /** 저장소만. 없으면 그 줄은 비웁니다. */
  desc?: string;
};
