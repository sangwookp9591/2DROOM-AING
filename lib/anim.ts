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
