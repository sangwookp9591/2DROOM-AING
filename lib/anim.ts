/** 프레임레이트에 흔들리지 않는 감쇠. 0.1초 클램프는 프레임이 튈 때의 안전장치입니다. */
export const damp = (dt: number, k: number) => 1 - Math.exp(-k * Math.min(dt, 0.1));

/**
 * 모션을 줄여 달라는 요청. CSS 트랜지션만이 아니라 카메라 이동·시선 전환·진입 비행까지
 * 이 값을 봐야 합니다. 가벼운 페이드만 끄고 1인칭 돌리를 그대로 두면 아무 의미가 없습니다.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 버튼·링크 위에서 일어난 키 입력인지. 전역 키 핸들러가 포커스된 컨트롤을 가로채면 안 됩니다. */
export function isInteractiveTarget(e: Event): boolean {
  const t = e.target;
  return t instanceof HTMLElement && !!t.closest('button, a, input, textarea, select, [contenteditable]');
}

/** 글자를 받는 자리인지. '/'처럼 글자 하나로 도는 단축키만 이쪽을 봅니다 — 버튼과 링크는
    '/'를 먹지 않으므로 위 목록에서 그 둘을 뺀 것입니다. 두 가드를 나란히 두는 이유는,
    떨어뜨려 두었더니 한쪽만 select와 [contenteditable]을 챙기고 다른 쪽은 놓쳤기 때문입니다. */
export function isTypingTarget(e: Event): boolean {
  const t = e.target;
  return t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable]');
}
