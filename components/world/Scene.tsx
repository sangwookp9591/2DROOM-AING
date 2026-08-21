'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CORRIDOR, ROOMS, roomById, roomCenter, type Room } from '@/lib/rooms';
import { damp } from '@/lib/anim';
import { ROOM_LAYERS, toDataUri } from '@/lib/props';
import { useCorridorCamera, type CorridorCam } from './useCorridorCamera';

const LENGTH = CORRIDOR.startZ - CORRIDOR.endZ;
const MID_Z = (CORRIDOR.startZ + CORRIDOR.endZ) / 2;
const HALF_W = CORRIDOR.width / 2;
/** 사물 층 한 겹의 실제 폭(유닛). 1120x400 SVG가 이 크기로 앉습니다. */
const LAYER_W = 7;

/**
 * 조명을 쓰지 않으므로 음영은 색값에 미리 칠해 둡니다. (세계 규칙 3)
 * 왼쪽 벽을 밝게, 오른쪽 벽을 어둡게 해서 조명 없이 방향감을 만듭니다.
 */
const PAPER = {
  floor: '#C6B598',
  ceiling: '#F0EBDE',
  wallLeft: '#E8E1CF',
  wallRight: '#D4CBB4',
  ink: '#2E2A6B',
  sketch: '#CFC8B6',
  jamb: '#9E9683',
  bg: '#F4F1EA',
};

export type SceneApi = {
  enter: (id: string) => void;
  exit: () => void;
};

type Props = {
  api: { current: SceneApi | null };
  activeId: string | null;
  onNear: (id: string | null) => void;
  onEnd: (atEnd: boolean) => void;
  onArrive: (id: string) => void;
  onLeave: () => void;
};

export default function Scene({ api, activeId, onNear, onEnd, onArrive, onLeave }: Props) {
  const cam = useRef<CorridorCam | null>(null);
  const busy = useRef(false);
  const activeRef = useRef<Room | null>(null);
  const near = useRef<string | null>(null);
  const atEnd = useRef(false);
  const [hovered, setHovered] = useState<string | null>(null);

  useCorridorCamera(cam);

  // 밖에서 이미 방에 들어간 상태로 다시 마운트될 수 있습니다 (읽기 모드 왕복 등).
  useEffect(() => {
    activeRef.current = activeId ? roomById(activeId) ?? null : null;
  }, [activeId]);

  useEffect(() => {
    api.current = {
      enter(id) {
        const room = roomById(id);
        if (!room || busy.current || !cam.current) return;
        busy.current = true;
        activeRef.current = room;
        near.current = null;
        onNear(null);
        cam.current.enter(room, () => {
          busy.current = false;
          onArrive(room.id);
        });
      },
      exit() {
        const room = activeRef.current;
        if (!room || busy.current || !cam.current) return;
        busy.current = true;
        onLeave();
        cam.current.exit(room, () => {
          busy.current = false;
          activeRef.current = null;
          // 문 앞에 다시 서므로 근접 판정을 풀어 줍니다.
          // 안 풀면 방금 나온 문 앞인데 들어가기 버튼이 안 뜹니다.
          near.current = null;
        });
      },
    };
    return () => {
      api.current = null;
    };
  }, [api, onArrive, onLeave, onNear]);

  // 문 앞에 서면 DOM 쪽에 알려 줍니다. 라벨과 버튼은 HTML이 맡습니다. (세계 규칙 2)
  const { camera } = useThree();
  useFrame(() => {
    if (busy.current || activeRef.current) return;

    let found: string | null = null;
    for (const r of ROOMS) {
      const dist = camera.position.z - r.z; // 문 앞이면 양수
      if (dist > -3 && dist < 10) {
        found = r.id;
        break;
      }
    }
    if (found !== near.current) {
      near.current = found;
      onNear(found);
    }

    // 복도 끝에 닿으면 콜로폰을 엽니다. 걸어서만 가도 연락처에 닿아야 합니다.
    const end = camera.position.z < CORRIDOR.walkEndZ + 5;
    if (end !== atEnd.current) {
      atEnd.current = end;
      onEnd(end);
    }
  });

  // 커서는 한 곳에서만 만집니다. 문마다 각자 body를 건드리면 교차 호버에서 어긋납니다.
  const locked = activeId !== null;
  useEffect(() => {
    document.body.style.cursor = hovered && !locked ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered, locked]);

  return (
    <>
      <color attach="background" args={[PAPER.bg]} />
      <fog attach="fog" args={[PAPER.bg, 14, 72]} />

      {/* 복도 — 평면 넷. 모델도 조명도 없습니다. */}
      <mesh position={[0, 0, MID_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CORRIDOR.width, LENGTH]} />
        <meshBasicMaterial color={PAPER.floor} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, CORRIDOR.height, MID_Z]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CORRIDOR.width, LENGTH]} />
        <meshBasicMaterial color={PAPER.ceiling} side={THREE.DoubleSide} />
      </mesh>
      {/* 방과 맞닿는 벽이라 양면입니다. 단면이면 방 쪽에서 뻥 뚫려 보입니다. */}
      <mesh position={[-HALF_W, CORRIDOR.height / 2, MID_Z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[LENGTH, CORRIDOR.height]} />
        <meshBasicMaterial color={PAPER.wallLeft} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[HALF_W, CORRIDOR.height / 2, MID_Z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[LENGTH, CORRIDOR.height]} />
        <meshBasicMaterial color={PAPER.wallRight} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, CORRIDOR.height / 2, CORRIDOR.endZ]}>
        <planeGeometry args={[CORRIDOR.width, CORRIDOR.height]} />
        <meshBasicMaterial color={PAPER.wallRight} />
      </mesh>

      {ROOMS.map((room) => (
        <Door
          key={room.id}
          room={room}
          locked={locked}
          hovered={hovered === room.id}
          onHover={(entering) =>
            setHovered((h) => (entering ? room.id : h === room.id ? null : h))
          }
          onPick={() => api.current?.enter(room.id)}
        />
      ))}

      {ROOMS.map((room) => (
        <RoomBox key={room.id} room={room} active={activeId === room.id} />
      ))}
    </>
  );
}

/**
 * 문. 기본은 회색 스케치이고, 가까이 대면 방 색으로 칠해집니다.
 * "색이 칠해지면 누를 수 있다"가 이 세계의 유일한 어포던스 규칙입니다.
 */
function Door({
  room,
  onPick,
  locked,
  hovered,
  onHover,
}: {
  room: Room;
  onPick: () => void;
  locked: boolean;
  hovered: boolean;
  onHover: (entering: boolean) => void;
}) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const sketch = useMemo(() => new THREE.Color(PAPER.sketch), []);
  const painted = useMemo(() => new THREE.Color(room.accent), [room.accent]);

  const dir = room.side === 'left' ? -1 : 1;
  const x = dir * (HALF_W - 0.02);
  const rotY = room.side === 'left' ? Math.PI / 2 : -Math.PI / 2;

  useFrame((_, dt) => {
    if (!mat.current) return;
    mat.current.color.lerp(hovered && !locked ? painted : sketch, damp(dt, 7));
  });

  return (
    <group position={[x, 0, room.z]} rotation={[0, rotY, 0]}>
      {/* 문틀 — 벽보다 안쪽으로 들어가 그림자를 만듭니다 */}
      <mesh position={[0, 1.16, -0.012]}>
        <planeGeometry args={[1.34, 2.44]} />
        <meshBasicMaterial color={PAPER.ink} />
      </mesh>
      <mesh position={[0, 1.15, -0.006]}>
        <planeGeometry args={[1.22, 2.32]} />
        <meshBasicMaterial color={PAPER.jamb} />
      </mesh>
      <mesh
        position={[0, 1.15, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(true);
        }}
        onPointerOut={() => onHover(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (!locked) onPick();
        }}
      >
        <planeGeometry args={[1.12, 2.22]} />
        <meshBasicMaterial ref={mat} color={PAPER.sketch} />
      </mesh>
      {/* 손잡이 */}
      <mesh position={[0.42, 1.08, 0.01]}>
        <circleGeometry args={[0.055, 16]} />
        <meshBasicMaterial color={PAPER.ink} />
      </mesh>
    </group>
  );
}

/** 방 안쪽. 지금은 빈 상자입니다 — 사물은 다음 단계에서 채웁니다. */
function RoomBox({ room, active }: { room: Room; active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [cx, , cz] = roomCenter(room);
  const floor = useMemo(() => new THREE.Color(room.accent).lerp(new THREE.Color('#9C8F72'), 0.66), [room.accent]);
  const wall = useMemo(() => new THREE.Color(room.accent).lerp(new THREE.Color('#F4F1EA'), 0.68), [room.accent]);
  const back = useMemo(() => new THREE.Color(room.accent).lerp(new THREE.Color('#8C8368'), 0.5), [room.accent]);

  // 카메라가 안 보는 방은 드로우콜에서 통째로 빠집니다.
  useFrame(() => {
    if (!group.current) return;
    const visible = active || Math.abs(camera.position.z - room.z) < 26;
    if (group.current.visible !== visible) group.current.visible = visible;
  });

  const { roomW: W, roomD: D, roomH: H } = CORRIDOR;
  const far = room.side === 'left' ? -W / 2 : W / 2;

  return (
    <group ref={group} position={[cx, 0, cz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshBasicMaterial color={floor} />
      </mesh>
      <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshBasicMaterial color={PAPER.ceiling} />
      </mesh>
      <mesh position={[0, H / 2, -D / 2]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial color={wall} />
      </mesh>
      <mesh position={[0, H / 2, D / 2]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial color={back} />
      </mesh>
      <mesh position={[far, H / 2, 0]} rotation={[0, room.side === 'left' ? Math.PI / 2 : -Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshBasicMaterial color={wall} />
      </mesh>

      {(ROOM_LAYERS[room.id] ?? []).map((layer, i) => (
        <PropLayer key={i} room={room} depth={layer.depth} lift={layer.lift ?? 0} svg={layer.svg} order={i} />
      ))}
    </group>
  );
}

/**
 * 오려 세운 종이 한 겹. 방 하나가 이런 층 셋으로 섭니다.
 *
 * depth는 카메라가 서는 자리(0)에서 안쪽 벽(1)까지의 비율입니다.
 * 방 중심 기준으로 잡으면 앞 층이 카메라 등 뒤로 넘어갑니다.
 */
function PropLayer({ room, depth, lift, svg, order }: { room: Room; depth: number; lift: number; svg: string; order: number }) {
  const dir = room.side === 'left' ? -1 : 1;
  // 카메라가 보는 깊이는 방의 x축(roomW)입니다. 화면을 채우는 폭은 z축(roomD).
  const { roomW: DEPTH, roomD: D, roomH: H, roomOffset } = CORRIDOR;

  const texture = useMemo(() => {
    const t = new THREE.TextureLoader().load(toDataUri(svg));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [svg]);

  useEffect(() => () => texture.dispose(), [texture]);

  // 카메라가 멈추는 로컬 x. enter()가 방 중심의 0.55 지점까지 날아옵니다.
  const camLocal = roomOffset * 0.55 - roomOffset;
  const dist = (DEPTH / 2 - camLocal) * depth;
  const x = dir * (camLocal + dist);

  // 층은 전부 같은 실척입니다. 거리에 따라 키우면 가까운 층의 물건이
  // 작아지고 공중에 뜬 것처럼 보여 층 사이의 크기 관계가 깨집니다.
  // 폭은 방 깊이에 맞춰 잡았습니다 — 이보다 넓으면 앞 층이 화면 밖으로 잘립니다.
  const w = LAYER_W;
  const h = LAYER_W * (400 / 1120);

  return (
    <mesh
      position={[x, h / 2 + lift, 0]}
      rotation={[0, dir === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}
      renderOrder={order}
    >
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.04} toneMapped={false} />
    </mesh>
  );
}
