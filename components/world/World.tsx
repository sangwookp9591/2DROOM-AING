'use client';

import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { CORRIDOR } from '@/lib/rooms';
import Scene, { type SceneApi, type LiveRect, type PickInfo, type AingRect } from './Scene';

/** 저사양 기기에서 픽셀 밀도를 낮춥니다. 나머지 티어링은 실기기 측정 후에. */
function pickDpr(): [number, number] {
  if (typeof navigator === 'undefined') return [1, 2];
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const weak = (navigator.hardwareConcurrency ?? 8) <= 4;
  if (weak) return [0.8, 1];
  if (mobile) return [1, 1.5];
  return [1, 2];
}

type Props = {
  api: { current: SceneApi | null };
  activeId: string | null;
  paused: boolean;
  onNear: (id: string | null) => void;
  onEnd: (atEnd: boolean) => void;
  onArrive: (id: string) => void;
  onLeave: () => void;
  onLiveRect: (rect: LiveRect | null) => void;
  onThingPick: (info: PickInfo | null) => void;
  onAing: (rect: AingRect | null) => void;
};

export default function World({ paused, ...rest }: Props) {
  const dpr = useMemo(pickDpr, []);

  return (
    <Canvas
      // 카메라 초기값은 복도 상수에서 가져옵니다. 숫자를 두 곳에 적으면 어긋납니다.
      camera={{ position: [0, CORRIDOR.eye, CORRIDOR.startZ], fov: 60, near: 0.1, far: 150 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={dpr}
      // 읽기 모드에서도 언마운트하지 않습니다. GL 컨텍스트와 셰이더를 버렸다
      // 다시 만들면 눈에 띄게 멈추고, 복도 상태도 같이 날아갑니다.
      frameloop={paused ? 'never' : 'always'}
    >
      <Scene {...rest} />
    </Canvas>
  );
}
