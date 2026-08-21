/**
 * 방 안의 사물. 아트보드에서 그린 것을 그대로 평면으로 옮깁니다.
 *
 * 한 방은 깊이가 다른 층 셋으로 섭니다 — 오려 붙인 종이 디오라마 그대로입니다.
 *   back  벽에 붙은 것 (창 · 선반 · 게시판 · 빨랫줄)
 *   mid   가구 (책상 · 작업대 · 두꺼비집)
 *   front 앞쪽 소품 (상자 · 화분 · 궤짝 · 삼각대)
 *
 * 좌표계: 방은 폭 14(z축) × 높이 5. 픽셀은 유닛당 80px이라 1120 × 400.
 * 바닥선은 y=400입니다. 사물은 그 위에 앉습니다.
 */

const W = 1120;
const H = 400;

/** 손그림 떨림. 옮겨 그린 티가 나야 이 세계의 물건으로 읽힙니다. */
const wrap = (inner: string, seed: number) =>
  // width/height를 viewBox의 2배로 두면 좌표는 그대로 두고 래스터만 촘촘해집니다.
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}" viewBox="0 0 ${W} ${H}">` +
  `<defs><filter id="w"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="${seed}" result="n"/>` +
  `<feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G"/></filter></defs>` +
  `<g filter="url(#w)" stroke="#2E2A6B" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;

/** 눌렀을 때의 고유 동작. 사물의 성질에 맞는 것만 씁니다. */
export type Motion = 'flutter' | 'shake' | 'swing' | 'spin' | 'press' | 'tilt' | 'ripple';

/**
 * 눌러지는 사물 하나.
 * 층 텍스처에 구워 두면 개별로 못 움직여서, 제 평면을 따로 가집니다.
 * box는 층과 같은 좌표계(1120x400)라 그림 코드를 그대로 옮겨 쓸 수 있습니다.
 */
export type Thing = {
  id: string;
  layer: 'back' | 'mid' | 'front';
  box: { x: number; y: number; w: number; h: number };
  svg: string;
  motion: Motion;
  /** 눌렀을 때 뜨는 설명은 방의 콜아웃에서 가져옵니다 (정본은 lib/rooms.ts) */
  callout?: number;
  title?: string;
  body?: string;
};

/** 사물 하나만 담은 조각. viewBox를 그 자리로 잘라 좌표를 그대로 씁니다. */
const piece = (b: { x: number; y: number; w: number; h: number }, inner: string, seed: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${b.w * 2}" height="${b.h * 2}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}">` +
  `<defs><filter id="p${seed}"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="${seed}" result="n"/>` +
  `<feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G"/></filter></defs>` +
  `<g filter="url(#p${seed})" stroke="#2E2A6B" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;

export type Layer = {
  /** 0 = 복도 쪽(앞), 1 = 방 안쪽 벽 */
  depth: number;
  /** 바닥에서 띄우는 높이(유닛). 벽에 붙는 것은 올려야 가구 뒤로 숨지 않습니다. */
  lift?: number;
  svg: string;
  /**
   * 이 층에 실제로 동작하는 화면이 얹히는 자리.
   * SVG 좌표(1120x400)로 적으면 3D에서 그 위치를 화면 좌표로 투영해 iframe을 앉힙니다.
   * SVG에 그려 둔 화면 그림은 iframe이 뜨기 전까지 보이는 자리표시입니다.
   */
  live?: {
    x: number; y: number; w: number; h: number;
    /** public/ 아래 경로 */
    src: string;
    /** 그 페이지가 상정하는 화면 크기. 이 크기로 렌더한 뒤 자리에 맞춰 줄입니다. */
    vw: number; vh: number;
    /** 무엇이 뜨는지 한 줄 — 보조기기와 로딩 중 표시에 씁니다 */
    label: string;
  };
};

const INK = '#2E2A6B';
const PAPER = '#FBFAF6';
const WOOD = '#D9C4A9';
const WOOD_D = '#B89273';
const SHADOW = 'rgba(46,42,107,0.16)';

/** 종이를 오린 티 — 흰 테두리 + 짙은 그림자 */
const cut = (x: number, y: number, w: number, h: number, fill: string, sw = 3) =>
  `<rect x="${x + 5}" y="${y + 6}" width="${w}" height="${h}" fill="${SHADOW}" stroke="none"/>` +
  `<rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" fill="#FFFFFF" stroke="none"/>` +
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke-width="${sw}"/>`;

const plain = (x: number, y: number, w: number, h: number, fill: string, sw = 2.4) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke-width="${sw}"/>`;

/** 다리 달린 상판 — 책상과 테이블이 바닥에 접지되게 */
const table = (x: number, w: number, top: number, legH: number) =>
  cut(x, top, w, 26, WOOD) +
  plain(x + 34, top + 26, 20, legH, WOOD_D) +
  plain(x + w - 54, top + 26, 20, legH, WOOD_D);

/** 그리드로 세는 물건 — 창틀 · 이름표 · 두꺼비집 · 상자 */
function grid(
  x: number, y: number, cols: number, rows: number,
  cw: number, ch: number, gx: number, gy: number,
  fill: string | ((i: number) => string), sw = 2,
) {
  let out = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const f = typeof fill === 'function' ? fill(i) : fill;
      out += `<rect x="${x + c * (cw + gx)}" y="${y + r * (ch + gy)}" width="${cw}" height="${ch}" fill="${f}" stroke-width="${sw}"/>`;
    }
  }
  return out;
}

/** 화분 — 여러 방에 반복해서 놓입니다 */
const plant = (x: number, base: number, s = 1) =>
  `<g transform="translate(${x},${base}) scale(${s})">` +
  `<path d="M -14 0 h 28 l -4 26 h -20 Z" fill="#C98F6B" stroke-width="2.4"/>` +
  `<path d="M 0 0 v -26 M -10 -20 q 10 -26 10 -34 M 10 -20 q -10 -26 -10 -34" fill="none" stroke-width="2.4"/>` +
  `<path d="M -20 -40 q 20 -16 20 -6 q 0 10 -20 6 Z" fill="#9EC9A4" stroke-width="2.4"/>` +
  `<path d="M 20 -48 q -20 -16 -20 -4 q 0 10 20 4 Z" fill="#9EC9A4" stroke-width="2.4"/>` +
  `<path d="M 0 -62 q 5 -20 10 -9 q 2 9 -10 9 Z" fill="#9EC9A4" stroke-width="2.4"/></g>`;

/** 컵 */
const mug = (x: number, base: number) =>
  `<g transform="translate(${x},${base})">` +
  `<path d="M -20 0 q 5 -26 20 -26 q 15 0 20 26 Z" fill="#F5C6D0" stroke-width="2.4"/>` +
  `<path d="M 18 -18 q 14 -3 12 7 q -2 9 -12 7" fill="none" stroke-width="2.4"/></g>`;

/** 모니터. 화면 안은 손그림이 아닙니다 — 진짜 UI가 켜져 있다는 표시. */
const monitor = (x: number, y: number, w: number, h: number, screen: string) =>
  cut(x, y, w, h, '#F7F8FA') +
  `<g stroke="none">${screen}</g>` +
  plain(x + w / 2 - 7, y + h, 14, 18, '#CFC8B6') +
  plain(x + w / 2 - 26, y + h + 18, 52, 8, '#CFC8B6');

const ZIVO = {
  blue: '#1A5DF7',
  pale: '#E9EDFF',
  ink: '#1E2128',
  gray: '#E3E6EC',
  mid: '#6A7280',
};

/** ZIVO 실제 화면을 축소한 것 — 방마다 하나만 켜집니다 */
const liveScreen = (x: number, y: number, w: number, h: number) =>
  `<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="18" fill="${ZIVO.blue}" opacity="0.14"/>` +
  `<rect x="${x + 8}" y="${y + 34}" width="${w - 16}" height="34" fill="#FFFFFF"/>` +
  `<rect x="${x + 16}" y="${y + 42}" width="30" height="18" rx="3" fill="${ZIVO.pale}"/>` +
  `<rect x="${x + 54}" y="${y + 44}" width="${w * 0.42}" height="8" rx="4" fill="${ZIVO.ink}"/>` +
  `<rect x="${x + 54}" y="${y + 56}" width="${w * 0.28}" height="7" rx="3" fill="${ZIVO.mid}"/>` +
  `<rect x="${x + 8}" y="${y + 76}" width="${w - 16}" height="24" fill="${ZIVO.blue}"/>` +
  `<rect x="${x + w / 2 - 26}" y="${y + 84}" width="52" height="8" rx="4" fill="#FFFFFF"/>`;

const deadScreen = (x: number, y: number, w: number, h: number) =>
  `<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="16" fill="#B4BAC5" opacity="0.5"/>` +
  `<rect x="${x + 8}" y="${y + 32}" width="${w - 16}" height="22" fill="${ZIVO.gray}"/>` +
  `<rect x="${x + 8}" y="${y + 60}" width="${w - 16}" height="22" fill="${ZIVO.gray}"/>`;

export const toDataUri = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export { wrap, cut, plain, table, grid, plant, mug, monitor, liveScreen, deadScreen, INK, PAPER, WOOD, WOOD_D, ZIVO, W, H };

// ─────────────────────────────────────────────────────────────
// 방 1 · 웹 작업실 — 창틀 열넷 · QR 스티커 · 라벨 상자 · 벽 넘는 케이블
// ─────────────────────────────────────────────────────────────
// 창틀 열넷: 세어 보면 열넷입니다. 간판에 "14개 언어"라고 적지 않습니다.
const WEB_WINDOW =
  cut(86, 60, 378, 170, '#CFE7F3') +
  grid(96, 70, 7, 2, 46, 72, 8, 10, '#DDEEF7', 1.8) +
  `<path d="M 86 60 L 464 230" stroke="#FFFFFF" stroke-width="18" opacity="0.38" fill="none"/>`;

// 벽의 QR 스티커 — 실제로 찍히는 것
const WEB_QR =
  cut(520, 108, 84, 84, PAPER) +
  grid(534, 122, 4, 4, 12, 12, 5, 5, (i) => ([0, 1, 2, 4, 6, 7, 8, 11, 12, 14, 15].includes(i) ? INK : PAPER), 0);

// 선반과 라벨 상자
const WEB_SHELF =
  cut(648, 78, 402, 176, '#E7DDC7') +
  `<path d="M 648 148 H 1050 M 648 214 H 1050" stroke-width="3" fill="none"/>` +
  plain(666, 100, 44, 48, '#A8DDF0') +
  plain(720, 112, 34, 36, '#F5C6D0') +
  plain(764, 96, 56, 52, '#EFE3C8') +
  plain(838, 108, 40, 40, '#B8B0E8') +
  plain(898, 100, 48, 48, '#D9C4A9') +
  plain(666, 168, 62, 46, '#CFE7F3') +
  `<path d="M 666 182 h 62" stroke-width="1.6" opacity="0.5" fill="none"/>` +
  plain(740, 164, 44, 50, '#EFE3C8');

// 벽을 넘어가는 케이블 — 옆방 백엔드로
const WEB_CABLE =
  `<path d="M 946 214 q 60 22 84 -18 q 26 -44 90 -30" fill="none" stroke-width="3.4" opacity="0.9"/>`;

const WEB_BACK = '';

const WEB_MID =
  table(180, 760, 296, 78) +
  monitor(210, 155, 190, 115, deadScreen(210, 155, 190, 115)) +
  monitor(432, 130, 246, 140, liveScreen(432, 130, 246, 140)) +
  monitor(714, 155, 190, 115, deadScreen(714, 155, 190, 115)) +
  cut(470, 302, 190, 18, '#EDE7DA') +
  `<path d="M 470 311 h 190" stroke-width="1.4" opacity="0.5" fill="none"/>`;

const WEB_MUG = mug(760, 296);

const WEB_FRONT =
  cut(236, 296, 158, 104, WOOD) +
  `<path d="M 236 334 h 158 M 315 296 v 104" stroke-width="2" opacity="0.5" fill="none"/>` +
  plant(878, 400, 1.25) +
  `<path d="M 420 400 q 40 -22 88 -6 q 44 16 84 -8" fill="none" stroke-width="3" opacity="0.75"/>`;

// ─────────────────────────────────────────────────────────────
// 방 2 · 운영 데스크 — 열쇠 보드 · 이름표 열다섯 · 종이 한 장짜리 게시판
// ─────────────────────────────────────────────────────────────
const key = (x: number, y: number, r: number, fill: string) =>
  `<g><circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke-width="2.4"/>` +
  `<rect x="${x - r * 0.34}" y="${y + r}" width="${r * 0.68}" height="${r * 1.9}" fill="${fill}" stroke-width="2.4"/>` +
  `<rect x="${x + r * 0.34}" y="${y + r * 1.7}" width="${r * 0.7}" height="${r * 0.42}" fill="${fill}" stroke-width="2.4"/></g>`;

const ADMIN_KEYS =
  // 열쇠 보드 — 큰 것 하나(파트너)와 작은 것 다섯(관리자·스태프)
  cut(76, 62, 300, 200, '#E7DDC7') +
  `<path d="M 76 168 H 376" stroke-width="2.4" stroke-dasharray="8 8" opacity="0.7" fill="none"/>` +
  key(132, 106, 20, WOOD) +
  key(212, 100, 11, '#B8B0E8') +
  key(258, 100, 11, '#B8B0E8') +
  key(304, 100, 11, '#B8B0E8') +
  key(235, 196, 11, '#B8B0E8') +
  key(281, 196, 11, '#B8B0E8');
const ADMIN_TAGS =
  // 이름표 열다섯 칸
  cut(414, 70, 300, 132, '#F0EDFB') +
  grid(428, 84, 5, 3, 50, 30, 6, 6, PAPER, 1.6);
const ADMIN_BOARD =
  // 게시판 — 종이는 한 장, 나머지는 저기를 보라는 화살표
  cut(756, 62, 292, 200, '#E2DACA') +
  cut(848, 92, 108, 118, PAPER) +
  `<path d="M 862 118 h 80 M 862 138 h 80 M 862 158 h 58 M 862 178 h 70" stroke-width="1.8" opacity="0.45" fill="none"/>` +
  `<circle cx="902" cy="86" r="6" fill="#B4645A" stroke-width="2"/>` +
  plain(774, 106, 46, 32, '#F7E9A8') +
  plain(774, 168, 46, 32, '#F7E9A8') +
  plain(984, 106, 46, 32, '#F7E9A8') +
  plain(984, 168, 46, 32, '#F7E9A8') +
  `<g fill="none" stroke-width="2.4">` +
  `<path d="M 822 122 h 20 l -6 -6 m 6 6 l -6 6"/><path d="M 822 184 h 20 l -6 -6 m 6 6 l -6 6"/>` +
  `<path d="M 982 122 h -20 l 6 -6 m -6 6 l 6 6"/><path d="M 982 184 h -20 l 6 -6 m -6 6 l 6 6"/></g>`;
const ADMIN_BACK = '';

const ADMIN_MID =
  // 의자 열다섯 — 책상 뒤로 등받이만 보입니다
  grid(64, 246, 15, 1, 34, 50, 34, 0, '#C6AF91', 2.2) +
  table(56, 1010, 302, 76) +
  monitor(420, 158, 250, 118, liveScreen(420, 158, 250, 118)) +
  mug(902, 302);

// 종 하나 — 두 번 울리던 알림을 하나로 묶었습니다
const ADMIN_BELL =
  `<g transform="translate(806,302)"><path d="M -26 0 q 0 -44 26 -44 q 26 0 26 44 Z" fill="#EFE3C8" stroke-width="2.6"/>` +
  `<path d="M -34 0 h 68" stroke-width="3"/><circle cx="0" cy="-48" r="6" fill="#B4645A" stroke-width="2"/></g>`;

const ADMIN_FRONT =
  cut(258, 316, 132, 84, PAPER) +
  `<path d="M 258 340 h 132 M 258 362 h 132" stroke-width="1.8" opacity="0.4" fill="none"/>` +
  plant(892, 400, 1.1);

// ─────────────────────────────────────────────────────────────
// 방 3 · 백엔드 구역 — 두꺼비집 마흔셋 · 칸막이 갈린 선반 · 콘센트 세 구
// ─────────────────────────────────────────────────────────────
const BACK_BREAKER =
  // 두꺼비집 마흔셋: 위 42(7×6) + 아래 하나. 그 하나가 내려가 있고 우회선이 돕니다.
  cut(70, 54, 306, 268, '#E2DACA') +
  `<path d="M 70 272 H 376" stroke-width="2.4" stroke-dasharray="6 7" opacity="0.6" fill="none"/>` +
  grid(88, 68, 7, 6, 26, 28, 12, 5, PAPER, 1.8) +
  grid(93, 72, 7, 6, 16, 10, 22, 23, '#9DA6D8', 0) +
  plain(88, 284, 26, 28, PAPER, 1.8) +
  plain(93, 300, 16, 10, '#B4645A', 0) +
  `<path d="M 101 300 q 62 -8 62 -54 q 0 -30 36 -30" fill="none" stroke="#B4645A" stroke-width="3.4" stroke-dasharray="9 6"/>`;
const BACK_SHELF =
  // 칸막이가 진짜로 갈린 선반 — 다섯 칸
  cut(602, 58, 386, 248, '#E7DDC7') +
  `<path d="M 679 58 V 306 M 756 58 V 306 M 833 58 V 306 M 910 58 V 306" stroke-width="5"/>` +
  plain(616, 96, 46, 56, '#9DA6D8') +
  plain(693, 116, 46, 46, '#A8DDF0') +
  plain(770, 102, 46, 52, '#B8B0E8') +
  plain(847, 122, 46, 40, '#EFE3C8') +
  plain(924, 92, 46, 58, WOOD) +
  `<path d="M 616 208 h 46 M 693 208 h 46 M 770 208 h 46 M 847 208 h 46 M 924 208 h 46" stroke-width="1.8" opacity="0.45" fill="none"/>`;
const BACK_SOCKET =
  // 콘센트 세 구 — 하나가 뽑혀도 옆으로 이어집니다
  cut(422, 214, 132, 66, '#EDE7DA') +
  `<g fill="${PAPER}" stroke-width="2"><circle cx="452" cy="236" r="7"/><circle cx="452" cy="258" r="7"/>` +
  `<circle cx="488" cy="236" r="7"/><circle cx="488" cy="258" r="7"/><circle cx="524" cy="236" r="7"/><circle cx="524" cy="258" r="7"/></g>` +
  `<path d="M 452 224 v -22 q 0 -16 20 -16 h 54" fill="none" stroke-width="3"/>` +
  `<path d="M 488 224 v -30 q 0 -18 22 -18 h 40" fill="none" stroke-width="3"/>` +
  `<path d="M 524 272 q 34 20 34 46" fill="none" stroke="#B4645A" stroke-width="3.2" stroke-dasharray="8 6"/>` +
  plain(544, 318, 32, 24, '#B8B0E8', 2.2);
const BACK_BACK = '';

const BACK_MID =
  // 벽을 타고 들어와 나가는 배관
  `<path d="M 0 34 H 250 Q 278 34 278 62 V 132 Q 278 160 306 160 H 1120" fill="none" stroke-width="17"/>` +
  `<path d="M 0 34 H 250 Q 278 34 278 62 V 132 Q 278 160 306 160 H 1120" fill="none" stroke="#C6AF91" stroke-width="10"/>` +
  plain(186, 22, 20, 24, WOOD_D) +
  plain(560, 148, 20, 24, WOOD_D) +
  table(360, 420, 300, 78) +
  monitor(420, 176, 232, 110, liveScreen(420, 176, 232, 110));

const BACK_OUTBOX =
  // 부칠 봉투 상자 — 도장 찍힌 것만 건너갑니다
  cut(214, 300, 232, 100, WOOD_D) +
  `<path d="M 330 300 V 400" stroke-width="3"/>` +
  `<g fill="${PAPER}" stroke-width="2.2"><rect x="228" y="238" width="80" height="56"/><path d="M 228 238 l 40 27 l 40 -27" fill="none"/>` +
  `<rect x="242" y="226" width="80" height="56"/><path d="M 242 226 l 40 27 l 40 -27" fill="none"/></g>` +
  `<g fill="#F5C6D0" stroke-width="2.2"><rect x="346" y="234" width="80" height="56"/><path d="M 346 234 l 40 27 l 40 -27" fill="none"/>` +
  `<circle cx="386" cy="254" r="13" fill="#B4645A" opacity="0.85"/></g>`;
const BACK_CRATE =
  // 낱개 대신 궤짝
  cut(700, 322, 200, 78, WOOD) +
  `<path d="M 700 348 h 200 M 700 376 h 200" stroke-width="2" opacity="0.55" fill="none"/>` +
  plain(722, 288, 40, 34, '#A8DDF0') +
  plain(772, 278, 40, 44, '#B8B0E8') +
  plain(822, 292, 40, 30, '#EFE3C8');
const BACK_FRONT = '';

// ─────────────────────────────────────────────────────────────
// 방 4 · 지난 작업실 — 필름 릴 · 여섯 칸 스트립 · 가위표 친 파형 · 기울어진 저울
// ─────────────────────────────────────────────────────────────
const reel = (x: number, y: number, r: number) =>
  `<g><circle cx="${x}" cy="${y}" r="${r}" fill="${WOOD}" stroke-width="2.6"/>` +
  `<circle cx="${x}" cy="${y}" r="${r * 0.28}" fill="#EDE7DA" stroke-width="2.2"/>` +
  `<path d="M ${x} ${y - r} v ${r * 0.34} M ${x} ${y + r} v ${-r * 0.34} M ${x - r} ${y} h ${r * 0.34} M ${x + r} ${y} h ${-r * 0.34}"` +
  ` fill="none" stroke-width="1.8" opacity="0.55"/></g>`;

const PAST_REELS =
  cut(70, 62, 300, 172, '#E7DDC7') +
  `<path d="M 70 190 H 370" stroke-width="3"/>` +
  reel(132, 148, 42) + reel(228, 148, 42) + reel(312, 154, 34);
const PAST_STRIP =
  // 릴에 감긴 여섯 칸 — 촬영·자르기·올리기·변환·뿌리기·재생
  `<path d="M 346 148 Q 380 118 416 118" fill="none" stroke-width="2.6"/>` +
  cut(410, 96, 292, 56, '#E2DACA') +
  grid(422, 108, 6, 1, 38, 34, 8, 0, PAPER, 1.8) +
  grid(428, 114, 6, 1, 26, 22, 20, 0, '#F5C6D0', 0);
const PAST_WAVE =
  // 가위표 친 구간 — 늦게 도착한 음성만 골라 버렸습니다
  cut(748, 70, 300, 148, PAPER) +
  `<path d="M 764 158 l 18 -30 l 15 44 l 18 -60 l 15 52 l 18 -24 l 15 34 l 18 -44 l 15 40 l 18 -16 l 15 24 l 18 -34 l 15 30 l 18 -12 l 15 18"` +
  ` fill="none" stroke-width="2.6"/>` +
  `<rect x="948" y="94" width="66" height="86" fill="#F5C6D0" opacity="0.4" stroke="#B4645A" stroke-width="2.4" stroke-dasharray="6 5"/>` +
  `<path d="M 960 110 l 42 50 M 1002 110 l -42 50" stroke="#B4645A" stroke-width="4" fill="none"/>`;

// 관제 화면 여섯 — 공공·기업 시스템 시절. 릴을 빌려 쓰지 않고 제 사물을 가집니다.
const PAST_CONTROL = (() => {
  // 화면마다 다른 것이 떠 있습니다 — 도로, 막대, 점 격자, 카메라, 파형, 표
  const screens = [
    `<path d="M 8 30 q 18 -14 36 0 q 18 14 36 0" fill="none" stroke="#7FBFDC" stroke-width="2.4"/>` +
      `<path d="M 8 40 h 72" stroke="#B4645A" stroke-width="2" stroke-dasharray="5 4" fill="none"/>`,
    `<g fill="#9DA6D8" stroke="none"><rect x="10" y="34" width="9" height="18"/><rect x="24" y="24" width="9" height="28"/>` +
      `<rect x="38" y="30" width="9" height="22"/><rect x="52" y="16" width="9" height="36"/><rect x="66" y="28" width="9" height="24"/></g>`,
    `<g fill="#B4645A" stroke="none" opacity="0.8"><circle cx="18" cy="22" r="3"/><circle cx="36" cy="34" r="3"/>` +
      `<circle cx="54" cy="20" r="3"/><circle cx="70" cy="40" r="3"/><circle cx="28" cy="46" r="3"/><circle cx="60" cy="48" r="3"/></g>` +
      `<path d="M 8 14 h 76 M 8 32 h 76 M 8 50 h 76" stroke="#B5AECB" stroke-width="1" fill="none"/>`,
    `<rect x="12" y="14" width="68" height="44" fill="#2E2A6B" opacity="0.18" stroke="none"/>` +
      `<circle cx="46" cy="34" r="11" fill="none" stroke="#2E2A6B" stroke-width="2"/>` +
      `<path d="M 46 23 v 22 M 35 34 h 22" stroke="#2E2A6B" stroke-width="1.4" fill="none"/>`,
    `<path d="M 8 36 l 10 -14 l 8 24 l 10 -30 l 9 26 l 10 -12 l 9 18 l 10 -20 l 10 14" fill="none" stroke="#7FBFDC" stroke-width="2.2"/>`,
    `<g fill="#B5AECB" stroke="none"><rect x="10" y="16" width="70" height="6"/><rect x="10" y="28" width="52" height="6"/>` +
      `<rect x="10" y="40" width="64" height="6"/><rect x="10" y="52" width="40" height="6"/></g>`,
  ];
  let out = cut(700, 238, 366, 150, '#E2DACA');
  for (let i = 0; i < 6; i++) {
    const x = 714 + (i % 3) * 118;
    const y = 252 + Math.floor(i / 3) * 70;
    out += plain(x, y, 100, 60, '#F7F8FA', 2) +
      `<g transform="translate(${x + 20},${y}) scale(1)">${screens[i]}</g>`;
  }
  out += `<path d="M 700 318 H 1066" stroke-width="2" opacity="0.4" fill="none"/>`;
  return out;
})();

const PAST_BACK = '';

const PAST_MID =
  // 천 덮인 편집기 — 모서리만 들려 화면이 보입니다
  `<path d="M 300 176 H 640 V 322 Q 600 344 556 322 Q 512 300 468 322 Q 424 344 380 322 Q 340 302 300 322 Z"` +
  ` fill="#E2DACA" stroke-width="3"/>` +
  `<path d="M 546 176 L 640 176 L 640 282 Q 596 266 546 282 Z" fill="#DFD3BE" stroke-width="2.6"/>` +
  `<rect x="562" y="194" width="66" height="64" fill="#1E2128" opacity="0.84" stroke="none"/>` +
  `<rect x="570" y="202" width="50" height="9" fill="#A8DDF0" stroke="none"/>` +
  `<rect x="570" y="218" width="38" height="7" fill="#6A7280" stroke="none"/>` +
  `<rect x="570" y="232" width="46" height="7" fill="#6A7280" stroke="none"/>` +
  table(286, 380, 322, 78);

const PAST_SCALE =
  // 기울어진 저울 — 필름 한 통 vs 픽셀 스물여섯 장
  `<g fill="none" stroke-width="3">` +
  `<path d="M 856 400 V 268"/><path d="M 818 400 L 856 282 L 896 400" stroke-width="2.6"/>` +
  `<path d="M 762 292 L 952 264" stroke-width="3.2"/><path d="M 766 294 V 330 M 948 266 V 300"/>` +
  `<circle cx="856" cy="274" r="6" fill="#EDE7DA"/></g>` +
  `<path d="M 730 330 Q 766 362 802 330 Z" fill="${WOOD}" stroke-width="2.6"/>` +
  `<path d="M 912 300 Q 948 332 984 300 Z" fill="#EFE3C8" stroke-width="2.6"/>` +
  `<g stroke-width="2.4"><circle cx="766" cy="312" r="22" fill="${WOOD_D}"/><circle cx="766" cy="312" r="8" fill="#EDE7DA"/></g>` +
  `<g fill="${PAPER}" stroke-width="1.8"><rect x="928" y="278" width="40" height="10"/><rect x="934" y="266" width="40" height="10"/><rect x="924" y="254" width="40" height="10"/></g>`;
const PAST_TRIPOD =
  // 접어 세운 삼각대
  `<g fill="none" stroke-width="3.2"><path d="M 238 400 L 272 210 L 308 400 M 256 210 L 288 400"/>` +
  `<path d="M 256 300 h 32" stroke-width="2.6"/></g>` +
  plain(256, 194, 26, 18, '#C6AF91', 2.4);
const PAST_FRONT = '';

// ─────────────────────────────────────────────────────────────
// 방 5 · 아잉 공방 — 빨랫줄 열여섯 · 사×사 시트 · 물감 다섯 칸 · 회전대 · 체
// ─────────────────────────────────────────────────────────────
const AING = ['#A8DDF0', '#B8B0E8', '#F5C6D0', '#EFE3C8'];

const clothesline = () => {
  let out = `<path d="M 30 74 Q 560 122 1090 74" fill="none" stroke-width="2.8"/>`;
  for (let i = 0; i < 16; i++) {
    const x = 48 + i * 66;
    const t = (x + 22 - 30) / 1060;
    const y = (1 - t) ** 2 * 74 + 2 * t * (1 - t) * 122 + t ** 2 * 74;
    out +=
      `<rect x="${x + 16}" y="${(y - 7).toFixed(0)}" width="11" height="18" fill="#C6AF91" stroke-width="1.6"/>` +
      `<rect x="${x}" y="${(y + 8).toFixed(0)}" width="44" height="56" fill="${AING[i % 4]}" stroke-width="2"/>` +
      `<circle cx="${x + 22}" cy="${(y + 34).toFixed(0)}" r="11" fill="${PAPER}" stroke-width="1.6"/>`;
  }
  return out;
};

const WORK_LINE =
  clothesline();
const WORK_SHEET =
  // 작업대에 펼친 사×사 — 256픽셀 칸으로 짠 시트
  cut(232, 176, 268, 190, '#E7DDC7') +
  grid(248, 192, 4, 4, 58, 40, 4, 4, PAPER, 1.6) +
  grid(266, 200, 4, 4, 22, 22, 40, 22, (i) => AING[i % 4], 0);
const WORK_SIEVE =
  // 걸어 둔 체 — 임계값 대신 면적으로 거릅니다
  `<g stroke-width="3"><circle cx="112" cy="252" r="58" fill="#EDE7DA"/><circle cx="112" cy="252" r="45" fill="${PAPER}"/>` +
  `<path d="M 82 214 v 76 M 112 206 v 92 M 142 214 v 76 M 74 222 h 76 M 67 252 h 90 M 74 282 h 76"` +
  ` stroke-width="1.5" opacity="0.6" fill="none"/><path d="M 165 222 l 32 -22" stroke-width="4" fill="none"/></g>` +
  `<g fill="#B4645A" stroke="none" opacity="0.7"><circle cx="96" cy="330" r="4"/><circle cx="122" cy="346" r="3"/><circle cx="142" cy="326" r="3.4"/></g>`;
const WORK_BACK = '';

const WORK_MID =
  table(210, 620, 302, 76) +
  monitor(280, 168, 216, 108, liveScreen(280, 168, 216, 108));

// 회전대 — GLB 두 벌 중 가벼운 쪽이 205kB. 바닥에 서는 물건이라 여기 둡니다.
const WORK_TURN =
  `<g stroke-width="3"><ellipse cx="940" cy="330" rx="92" ry="26" fill="${WOOD_D}"/>` +
  `<path d="M 848 330 v 18 a 92 26 0 0 0 184 0 v -18" fill="#A67C52"/>` +
  `<path d="M 902 330 q -16 -44 8 -70 q 28 -30 56 -6 q 26 24 8 76" fill="#A8DDF0"/>` +
  `<circle cx="922" cy="282" r="6" fill="${INK}" stroke="none"/><circle cx="952" cy="282" r="6" fill="${INK}" stroke="none"/>` +
  `<path d="M 928 300 q 10 8 20 0" fill="none" stroke-width="2.6"/>` +
  `<path d="M 840 296 a 108 108 0 0 1 30 -44" stroke-width="2.4" stroke-dasharray="8 6" fill="none"/>` +
  `<path d="M 870 252 l -16 3 l 7 -15" stroke-width="2.4" fill="none"/></g>`;

// 물감 다섯 칸 — 아잉의 색은 이 다섯뿐입니다
const WORK_PAINTS =
  cut(560, 262, 268, 40, '#EDE7DA') +
  `<g stroke-width="2.4"><circle cx="588" cy="282" r="16" fill="#A8DDF0"/><circle cx="638" cy="282" r="16" fill="#B8B0E8"/>` +
  `<circle cx="688" cy="282" r="16" fill="#F4F1EA"/><circle cx="738" cy="282" r="16" fill="#2E2A6B"/>` +
  `<circle cx="788" cy="282" r="16" fill="#F5C6D0"/></g>`;

const WORK_FRONT =
  // 핑퐁으로 닫은 루프 — 첫 프레임 복귀 대신 왔다 갔다
  `<g transform="rotate(-22 292 340)">${plain(268, 292, 48, 62, '#F5C6D0', 3)}${plain(284, 352, 15, 40, WOOD_D, 3)}</g>` +
  `<g transform="rotate(20 362 340)">${plain(338, 292, 48, 62, '#A8DDF0', 3)}${plain(354, 352, 15, 40, WOOD_D, 3)}</g>` +
  `<g fill="none" stroke-width="2.4"><path d="M 408 336 q 22 -18 44 0" stroke-dasharray="6 5"/>` +
  `<path d="M 452 336 l -10 -7 m 10 7 l -10 7"/><path d="M 408 336 l 10 -7 m -10 7 l 10 7"/></g>` +
  plant(864, 400, 1.1);

// ─────────────────────────────────────────────────────────────
// 방 6 · 공유 책상 — 회람판 아홉 · 상자 열 칸 · 유인물 더미 · 도장
// ─────────────────────────────────────────────────────────────
let SHARE_CLIP = '';
const SHARE_BACK = (() => {
  let checks = '';
  for (let i = 0; i < 9; i++) {
    const y = 108 + i * 22;
    checks +=
      `<path d="M 92 ${y} h 12" stroke-width="1.8" fill="none"/>` +
      `<path d="M 114 ${y} l 7 8 l 13 -17" fill="none" stroke="#B4645A" stroke-width="2.6"/>` +
      `<path d="M 146 ${y} h 108" stroke-width="1.6" opacity="0.4" fill="none"/>`;
  }
  SHARE_CLIP =
    cut(70, 70, 208, 230, PAPER) +
    plain(142, 54, 64, 26, '#C6AF91', 2.6) +
    checks;
  return '';
})();

// 상자 열 칸 — 저장소마다 다른 규칙이 담깁니다
const SHARE_BOXES =
    cut(684, 60, 320, 190, '#E7DDC7') +
    `<path d="M 684 148 H 1004 M 684 226 H 1004" stroke-width="3"/>` +
    grid(700, 78, 5, 1, 46, 54, 12, 0, (i) => AING[i % 4], 2.2) +
    grid(700, 166, 5, 1, 46, 54, 12, 0, (i) => AING[(i + 2) % 4], 2.2) +
    `<path d="M 700 96 h 46 M 758 96 h 46 M 816 96 h 46 M 874 96 h 46 M 932 96 h 46" stroke-width="1.6" opacity="0.5" fill="none"/>` +
    `<path d="M 700 184 h 46 M 758 184 h 46 M 816 184 h 46 M 874 184 h 46 M 932 184 h 46" stroke-width="1.6" opacity="0.5" fill="none"/>`;

let SHARE_STACK = '';
let SHARE_SIGN = '';
let SHARE_STAMP = '';
const SHARE_MID = (() => {
  let stack = '';
  for (let i = 0; i < 9; i++) {
    stack += plain(214 + i * 5, 246 + i * 7, 176, 12, PAPER, 1.8);
  }
  SHARE_STACK = stack;
  SHARE_SIGN =
    plain(444, 220, 92, 62, '#F7E9A8', 2.6) +
    `<path d="M 458 302 L 490 290 L 522 302 Z" fill="${WOOD_D}" stroke-width="2.4"/>` +
    `<path d="M 490 238 v 28 M 476 258 l 14 14 l 14 -14" fill="none" stroke-width="3"/>`;
  SHARE_STAMP =
    `<g stroke-width="2.6"><rect x="572" y="258" width="22" height="30" rx="6" fill="${WOOD_D}"/>` +
    `<rect x="558" y="288" width="50" height="16" rx="3" fill="#B4645A"/></g>`;
  return (
    table(120, 880, 302, 78) +
    // 터미널 — npx 한 줄
    cut(660, 178, 244, 124, '#1E2128') +
    `<g stroke="none"><rect x="674" y="192" width="88" height="10" rx="5" fill="#5EC08A"/>` +
    `<rect x="674" y="212" width="164" height="9" rx="4" fill="#E3E6EC"/>` +
    `<rect x="674" y="230" width="130" height="9" rx="4" fill="#A8DDF0"/>` +
    `<rect x="674" y="248" width="152" height="9" rx="4" fill="#E3E6EC"/>` +
    `<rect x="674" y="266" width="106" height="9" rx="4" fill="#E3E6EC"/>` +
    `<rect x="674" y="284" width="13" height="12" fill="#5EC08A"/></g>` +
    plain(950, 306, 44, 46, '#C6AF91', 2.4) +
    mug(1000, 302)
  );
})();

const SHARE_FRONT =
  cut(268, 316, 122, 84, WOOD) +
  `<path d="M 268 344 h 122" stroke-width="2" opacity="0.5" fill="none"/>` +
  plant(870, 400, 1.05);

// ─────────────────────────────────────────────────────────────

export const ROOM_LAYERS: Record<string, Layer[]> = {
  web: [
    { depth: 0.97, lift: 0.72, svg: wrap(WEB_BACK, 11) },
    {
      depth: 0.62,
      svg: wrap(WEB_MID, 12),
      // 손님이 쓰는 앱 화면. 세로 화면이라 모니터 안에서 위아래로 꽉 차게 들어갑니다.
      live: { x: 432, y: 130, w: 246, h: 140, src: '/zivo/app/index.html', vw: 390, vh: 844, label: '손님이 쓰는 앱 첫 화면' },
    },
    { depth: 0.45, svg: wrap(WEB_FRONT, 13) },
  ],
  admin: [
    { depth: 0.97, lift: 0.72, svg: wrap(ADMIN_BACK, 21) },
    {
      depth: 0.62,
      svg: wrap(ADMIN_MID, 22),
      live: { x: 420, y: 158, w: 250, h: 118, src: '/zivo/admin/index.html', vw: 1440, vh: 900, label: '운영자가 쓰는 관리 화면' },
    },
    { depth: 0.45, svg: wrap(ADMIN_FRONT, 23) },
  ],
  backend: [
    { depth: 0.97, lift: 0.72, svg: wrap(BACK_BACK, 31) },
    { depth: 0.62, svg: wrap(BACK_MID, 32) },
    { depth: 0.45, svg: wrap(BACK_FRONT, 33) },
  ],
  past: [
    { depth: 0.97, lift: 0.72, svg: wrap(PAST_BACK, 41) },
    { depth: 0.62, svg: wrap(PAST_MID, 42) },
    { depth: 0.45, svg: wrap(PAST_FRONT, 43) },
  ],
  workshop: [
    { depth: 0.97, lift: 0.72, svg: wrap(WORK_BACK, 51) },
    { depth: 0.62, svg: wrap(WORK_MID, 52) },
    { depth: 0.45, svg: wrap(WORK_FRONT, 53) },
  ],
  shared: [
    { depth: 0.97, lift: 0.72, svg: wrap(SHARE_BACK, 61) },
    { depth: 0.62, svg: wrap(SHARE_MID, 62) },
    { depth: 0.45, svg: wrap(SHARE_FRONT, 63) },
  ],
};


// ─────────────────────────────────────────────────────────────
// 아잉 — 방마다 서 있는 안내 캐릭터
// ─────────────────────────────────────────────────────────────

/**
 * 자리를 사물과 같은 SVG 좌표(1120x400)로 잡습니다.
 * 월드 유닛으로 잡으면 층 깊이에 따라 배율이 달라져 그림과 어긋납니다.
 *
 * 알파가 완전 이진(중간값 0)이라 3D 텍스처로 쓰면 가장자리가 깎입니다.
 * DOM <img>로 띄우면 브라우저가 부드럽게 그리고, 애니메이션 WebP도 그대로 움직입니다.
 */
export type Mascot = {
  /** public/mascot/motion 아래 파일 이름 (58프레임 애니메이션) */
  motion: string;
  layer: 'back' | 'mid' | 'front';
  box: { x: number; y: number; w: number; h: number };
  /** 무엇을 하고 있는지 — 보조기기와 대체 텍스트 */
  alt: string;
};

const M = (motion: string, x: number, alt: string): Mascot => ({
  motion,
  layer: 'front',
  // 발이 바닥(y=400)에 닿는 150px 정사각. 원본이 256x256이라 정사각이 맞습니다.
  box: { x, y: 250, w: 150, h: 150 },
  alt,
});

export const ROOM_MASCOT: Record<string, Mascot> = {
  web: M('type', 62, '책상 옆에서 타자를 치는 아잉'),
  admin: M('think', 62, '열쇠 보드 앞에서 생각하는 아잉'),
  // 두꺼비집이 화면 왼쪽(SVG x 70~376)이라 그 앞에 세웁니다
  backend: M('think', 66, '두꺼비집 앞에서 생각하는 아잉'),
  past: M('idle', 60, '지난 장비 곁에 선 아잉'),
  workshop: M('celebrate', 660, '자기가 만들어진 자리에서 기뻐하는 아잉'),
  shared: M('wave', 62, '가져가라고 손짓하는 아잉'),
};

// ─────────────────────────────────────────────────────────────
// 눌러지는 사물 — 방마다 다섯 개 안팎, 저마다 다른 동작
// ─────────────────────────────────────────────────────────────

const T = (
  id: string,
  layer: 'back' | 'mid' | 'front',
  box: [number, number, number, number],
  svg: string,
  motion: Motion,
  callout: number,
  seed: number,
): Thing => ({
  id,
  layer,
  box: { x: box[0], y: box[1], w: box[2], h: box[3] },
  svg: piece({ x: box[0], y: box[1], w: box[2], h: box[3] }, svg, seed),
  motion,
  callout,
});

export const ROOM_THINGS: Record<string, Thing[]> = {
  web: [
    T('window', 'back', [76, 50, 399, 192], WEB_WINDOW, 'flutter', 0, 101),
    T('qr', 'back', [510, 98, 105, 106], WEB_QR, 'press', 1, 102),
    T('shelf', 'back', [638, 68, 423, 198], WEB_SHELF, 'shake', 2, 103),
    T('cable', 'back', [940, 157, 180, 71], WEB_CABLE, 'ripple', 3, 104),
    T('mug', 'mid', [734, 264, 62, 38], WEB_MUG, 'tilt', 4, 105),
  ],
  admin: [
    T('keys', 'back', [66, 52, 321, 222], ADMIN_KEYS, 'swing', 0, 201),
    T('tags', 'back', [404, 60, 321, 154], ADMIN_TAGS, 'flutter', 1, 202),
    T('board', 'back', [746, 52, 313, 222], ADMIN_BOARD, 'flutter', 2, 203),
    T('bell', 'mid', [766, 242, 80, 66], ADMIN_BELL, 'shake', 3, 204),
  ],
  backend: [
    T('breaker', 'back', [60, 44, 327, 290], BACK_BREAKER, 'press', 0, 301),
    T('outbox', 'front', [204, 220, 253, 180], BACK_OUTBOX, 'shake', 1, 302),
    T('shelf', 'back', [592, 48, 407, 270], BACK_SHELF, 'shake', 2, 303),
    T('socket', 'back', [412, 170, 170, 178], BACK_SOCKET, 'ripple', 3, 304),
    T('crate', 'front', [690, 272, 221, 128], BACK_CRATE, 'shake', 4, 305),
  ],
  past: [
    T('reels', 'back', [60, 52, 321, 194], PAST_REELS, 'spin', 0, 401),
    T('strip', 'back', [340, 86, 373, 78], PAST_STRIP, 'flutter', 2, 402),
    T('wave', 'back', [738, 60, 321, 170], PAST_WAVE, 'ripple', 3, 403),
    T('tripod', 'front', [232, 188, 82, 212], PAST_TRIPOD, 'swing', 4, 404),
    T('control', 'back', [690, 228, 387, 172], PAST_CONTROL, 'ripple', 1, 406),
    T('scale', 'front', [724, 248, 266, 152], PAST_SCALE, 'tilt', 5, 405),
  ],
  workshop: [
    T('line', 'back', [24, 64, 1072, 104], WORK_LINE, 'flutter', 0, 501),
    T('sheet', 'back', [222, 166, 289, 212], WORK_SHEET, 'flutter', 1, 502),
    T('paints', 'mid', [550, 252, 289, 62], WORK_PAINTS, 'tilt', 2, 503),
    T('turn', 'mid', [834, 234, 204, 146], WORK_TURN, 'spin', 3, 504),
    T('sieve', 'back', [48, 188, 155, 167], WORK_SIEVE, 'spin', 4, 505),
  ],
  shared: [
    T('stack', 'mid', [208, 240, 228, 80], SHARE_STACK, 'flutter', 0, 601),
    T('boxes', 'back', [674, 50, 341, 212], SHARE_BOXES, 'shake', 1, 602),
    T('stamp', 'mid', [552, 252, 62, 58], SHARE_STAMP, 'press', 2, 603),
    T('clip', 'back', [60, 48, 229, 264], SHARE_CLIP, 'flutter', 3, 604),
    T('sign', 'mid', [438, 214, 104, 94], SHARE_SIGN, 'swing', 4, 605),
  ],
};
