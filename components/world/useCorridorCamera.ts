'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { Observer } from 'gsap/Observer';
import { CORRIDOR, ROOMS, roomCenter, type Room } from '@/lib/rooms';
import { damp, isInteractiveTarget, prefersReducedMotion } from '@/lib/anim';

gsap.registerPlugin(Observer);

/**
 * 감각 보정 손잡이. 실기기에서 만져 가며 맞추는 값들이라 상수로 빼 둡니다.
 * 휠 한 칸, 손가락 한 번, 트랙패드 관성이 기기마다 다릅니다.
 */
const FEEL = {
  /** 입력 1픽셀당 전진 유닛 */
  speed: 0.022,
  /** 위치 추적 감쇠 (클수록 빠르게 붙음) */
  damp: 4.2,
  /** 방향키·스페이스 한 번에 가는 거리 */
  keyStep: 7,
  /** 마우스 패럴랙스 최대 각 */
  parallax: 0.06,
};

/** 문에 다가갈 때 카메라가 저절로 고개를 도는 구간 */
const GLANCE = { start: 16, peak: 7, end: -2, amount: 0.44 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type CorridorCam = {
  /**
   * 문을 지나 방 안으로 날아 들어갑니다.
   * 완료 콜백은 인자로 받습니다 — 반환된 타임라인에 eventCallback을 걸면
   * vars의 onComplete를 덮어써서 제어권 반환이 통째로 날아갑니다.
   */
  enter: (room: Room, onDone?: () => void) => void;
  /** 복도로 되돌아옵니다. 놓는 지점을 목표로 삼아 이어 받습니다. */
  exit: (room: Room, onDone?: () => void) => void;
};

export function useCorridorCamera(api: { current: CorridorCam | null }) {
  const { camera } = useThree();

  const targetZ = useRef<number>(CORRIDOR.startZ);
  const glance = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  /** GSAP이 카메라를 몰고 있는 동안에는 스크롤 카메라가 손을 뗍니다. */
  const overridden = useRef(false);
  /** 언마운트 시 죽여야 할 진행 중 비행 */
  const flight = useRef<gsap.core.Timeline | null>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = prefersReducedMotion();
    camera.position.set(0, CORRIDOR.eye, CORRIDOR.startZ);
    camera.rotation.set(0, 0, 0);
  }, [camera]);

  useEffect(() => {
    const push = (delta: number) => {
      if (overridden.current) return;
      targetZ.current = clamp(targetZ.current - delta * FEEL.speed, CORRIDOR.walkEndZ, CORRIDOR.startZ);
    };

    const ob = Observer.create({
      target: window,
      type: 'wheel,touch,pointer',
      wheelSpeed: 1,
      tolerance: 4,
      // preventDefault를 켜면 GSAP이 콜백 전에 무조건 취소해서
      // 방 본문 패널의 네이티브 스크롤까지 죽습니다. 페이지 스크롤은 CSS로 막습니다.
      preventDefault: false,
      onChangeY: (self) => {
        // 방 본문 위에서 굴린 휠은 글을 읽는 동작이지 걷는 동작이 아닙니다.
        const t = self.event?.target;
        if (t instanceof HTMLElement && t.closest('.doc')) return;
        push(self.deltaY);
      },
    });

    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    // 키보드는 접근성 몫입니다. 마우스가 없어도 복도를 끝까지 갈 수 있어야 합니다.
    const onKey = (e: KeyboardEvent) => {
      if (overridden.current) return;
      // 포커스된 버튼 위에서의 스페이스는 그 버튼의 것입니다. 가로채면 조작이 막힙니다.
      if (isInteractiveTarget(e)) return;
      const step =
        e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' ? FEEL.keyStep
        : e.key === 'ArrowUp' || e.key === 'PageUp' ? -FEEL.keyStep
        : 0;
      if (!step) return;
      e.preventDefault();
      targetZ.current = clamp(targetZ.current - step, CORRIDOR.walkEndZ, CORRIDOR.startZ);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      ob.kill();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useFrame((_, dt) => {
    if (overridden.current) return;

    const k = damp(dt, FEEL.damp);
    camera.position.z += (targetZ.current - camera.position.z) * k;

    // 모션을 줄여 달라면 걸음만 남기고 고개 돌리기와 패럴랙스는 끕니다.
    if (reduced.current) {
      camera.rotation.set(0, 0, 0);
      return;
    }

    let want = 0;
    for (const room of ROOMS) {
      const dist = camera.position.z - room.z;
      let s = 0;
      if (dist > GLANCE.peak && dist < GLANCE.start) {
        s = (GLANCE.start - dist) / (GLANCE.start - GLANCE.peak);
      } else if (dist <= GLANCE.peak && dist > GLANCE.end) {
        s = (dist - GLANCE.end) / (GLANCE.peak - GLANCE.end);
      }
      if (s <= 0) continue;
      const eased = s * (2 - s); // easeOutQuad
      want += eased * (room.side === 'left' ? 1 : -1);
    }
    glance.current += (clamp(want, -1, 1) - glance.current) * k;

    camera.rotation.y = glance.current * GLANCE.amount - pointer.current.x * FEEL.parallax;
    camera.rotation.x = -pointer.current.y * FEEL.parallax * 0.5;
  });

  useEffect(() => {
    /** 모션 축소 요청이면 비행을 사실상 컷으로 바꿉니다. */
    const s = () => (reduced.current ? 0.01 : 1);

    api.current = {
      enter(room, onDone) {
        overridden.current = true;
        flight.current?.kill();
        const [rx, , rz] = roomCenter(room);
        const wallX = (room.side === 'left' ? -1 : 1) * (CORRIDOR.width / 2);
        const faceY = room.side === 'left' ? Math.PI / 2 : -Math.PI / 2;
        const d = s();

        flight.current = gsap
          .timeline({ defaults: { ease: 'power2.inOut' }, onComplete: onDone })
          // 1. 문 앞에 선다
          .to(camera.position, { x: wallX * 0.2, z: room.z, duration: 0.75 * d }, 0)
          .to(camera.rotation, { y: faceY, x: 0, duration: 0.75 * d }, 0)
          // 2. 문을 통과해 방 안으로
          .to(camera.position, { x: rx * CORRIDOR.cameraStop, z: rz, duration: 0.95 * d, ease: 'power2.out' }, 0.7 * d);
      },

      exit(room, onDone) {
        flight.current?.kill();
        const [, , rz] = roomCenter(room);
        const d = s();

        flight.current = gsap
          .timeline({
            defaults: { ease: 'power2.inOut' },
            onComplete: () => {
              // 스크롤 카메라가 튀지 않도록, 놓는 지점을 목표로 삼아 이어 받습니다.
              targetZ.current = camera.position.z;
              glance.current = reduced.current ? 0 : camera.rotation.y / GLANCE.amount;
              overridden.current = false;
              onDone?.();
            },
          })
          .to(camera.position, { x: (room.side === 'left' ? -1 : 1) * (CORRIDOR.width / 2) * 0.2, z: rz, duration: 0.8 * d }, 0)
          .to(camera.position, { x: 0, z: room.z + 4, duration: 0.8 * d }, 0.7 * d)
          .to(camera.rotation, { y: 0, x: 0, duration: 0.8 * d }, 0.7 * d);
      },
    };

    return () => {
      // 진행 중인 비행을 안 죽이면 사라진 카메라를 계속 굴리다가
      // 언마운트된 화면 상태로 onComplete를 쏩니다.
      flight.current?.kill();
      flight.current = null;
      overridden.current = false;
      api.current = null;
    };
  }, [camera, api]);
}
