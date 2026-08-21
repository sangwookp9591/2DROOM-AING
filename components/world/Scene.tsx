'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CORRIDOR, ROOMS, roomById, roomCenter, type Room } from '@/lib/rooms';
import { damp } from '@/lib/anim';
import gsap from 'gsap';
import { ROOM_LAYERS, ROOM_MASCOT, ROOM_THINGS, toDataUri, type Layer, type Thing } from '@/lib/props';
import {
  FRAMES, MARK, REPO_SPOTS, VIDEO_SPOTS,
  type Frame as FrameSpec, type LiveArt, type LiveSpot,
} from '@/lib/frames';
import { useCorridorCamera, type CorridorCam } from './useCorridorCamera';

const LENGTH = CORRIDOR.startZ - CORRIDOR.endZ;
const MID_Z = (CORRIDOR.startZ + CORRIDOR.endZ) / 2;
const HALF_W = CORRIDOR.width / 2;

/* 벽에 붙는 것들이 벽에서 얼마나 나와 있는가. 셋(문·액자·바깥 액자)이 모두 0.02를
   각자 적어 두는 바람에 정확히 같은 평면에 놓였습니다. 겹치지만 않으면 티가 안 나는데,
   'ponder' 액자(오른쪽 z=-56)가 'past' 문(오른쪽 z=-56)과 같은 자리라 깊이 버퍼가
   어느 쪽이 앞인지 정하지 못하고 프레임 테두리가 줄무늬로 깜빡였습니다.
   순서를 여기 한 번만 적습니다 — 액자는 언제나 문보다 앞입니다. */
const WALL = {
  door: 0.02,    // 문은 벽에 붙어 있습니다
  frame: 0.05,   // 액자는 그 앞에 겁니다. 문 위에 걸어도 다투지 않습니다
};
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
  // 캔버스로 그리는 액자가 쓰는 색. globals.css의 --card·--faint와 같은 값입니다.
  wood: '#D9C4A9',
  card: '#FBFAF6',
  faint: '#8A85B8',
};

export type SceneApi = {
  enter: (id: string) => void;
  exit: () => void;
};

/** 3D 모니터를 화면 좌표로 투영한 사각형. DOM이 여기에 iframe을 앉힙니다. */
export type LiveRect = {
  left: number; top: number; width: number; height: number;
  src: string; vw: number; vh: number; label: string;
};

/** 아잉의 화면 자리. DOM <img>가 여기에 앉습니다. */
export type AingRect = { left: number; top: number; width: number; height: number; motion: string; alt: string };

/** 눌린 사물의 화면 자리와 설명. DOM이 여기에 카드를 띄웁니다. */
export type PickInfo = {
  left: number; top: number; width: number; height: number;
  title: string; body: string;
};

type Props = {
  api: { current: SceneApi | null };
  activeId: string | null;
  /** 복도 벽에 걸 밖의 것들. 서버에서 받아 여기까지 내려옵니다(lib/feeds.ts). */
  wall: LiveArt[];
  onNear: (id: string | null) => void;
  onEnd: (atEnd: boolean) => void;
  onArrive: (id: string) => void;
  onLeave: () => void;
  onLiveRect: (rect: LiveRect | null) => void;
  onThingPick: (info: PickInfo | null) => void;
  onAing: (rect: AingRect | null) => void;
};

export default function Scene({ api, activeId, wall, onNear, onEnd, onArrive, onLeave, onLiveRect, onThingPick, onAing }: Props) {
  const cam = useRef<CorridorCam | null>(null);
  const busy = useRef(false);
  const activeRef = useRef<Room | null>(null);
  const near = useRef<string | null>(null);
  const atEnd = useRef(false);
  const [hovered, setHovered] = useState<string | null>(null);

  /* 받아 온 것을 미리 잡아 둔 자리에 순서대로 겁니다. 자리보다 많이 오면 남는 것은
     안 걸립니다 — 자리를 늘리는 것이 복도 배치를 다시 보는 일이라서입니다. */
  const hung = useMemo(() => {
    const used = { video: 0, repo: 0 };
    return wall.flatMap((art) => {
      const spots = art.kind === 'video' ? VIDEO_SPOTS : REPO_SPOTS;
      const spot = spots[used[art.kind]++];
      return spot ? [{ art, spot }] : [];
    });
  }, [wall]);

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
        onThingPick(null);
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
  }, [api, onArrive, onLeave, onNear, onThingPick]);

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

      {/* 문과 문 사이는 28유닛씩 비어 있습니다. 그 벽에 액자를 겁니다. */}
      {FRAMES.map((frame) => (
        <WallFrame key={frame.id} frame={frame} locked={locked} onPick={onThingPick} />
      ))}

      {/* 밖에서 온 것들. 자리는 미리 잡혀 있고 받아 온 개수만큼만 걸립니다. */}
      {hung.map(({ art, spot }) => (
        <LiveFrameMesh key={art.id} art={art} spot={spot} locked={locked} />
      ))}

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
        <RoomBox key={room.id} room={room} active={activeId === room.id} onLiveRect={onLiveRect} onThingPick={onThingPick} onAing={onAing} />
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
  const x = dir * (HALF_W - WALL.door);
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

/**
 * 복도 벽의 액자. 가까이 대면 조금 더 기울고, 누르면 무엇을 그린 것인지 말합니다.
 * 방에 들어가 있는 동안에는 잠급니다 — 방 안에서는 복도 벽이 배경일 뿐입니다.
 */
function WallFrame({
  frame, locked, onPick,
}: {
  frame: FrameSpec;
  locked: boolean;
  onPick: (info: PickInfo | null) => void;
}) {
  const texture = useSvgTexture(frame.svg);
  const mesh = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const { camera, size } = useThree();

  const dir = frame.side === 'left' ? -1 : 1;
  const h = frame.w * frame.ratio;

  useFrame((_, dt) => {
    if (!mesh.current) return;
    // 기울기만 만집니다. 벽에 걸린 것이 위치까지 움직이면 못이 빠진 것처럼 보입니다.
    const target = hover && !locked ? frame.tilt * 2.6 : frame.tilt;
    mesh.current.rotation.z += (target - mesh.current.rotation.z) * damp(dt, 8);
  });

  useEffect(() => {
    if (!hover || locked) return;
    document.body.style.cursor = 'pointer';
    return () => { document.body.style.cursor = ''; };
  }, [hover, locked]);

  // 눌린 액자의 화면 자리. DOM이 그 옆에 설명 카드를 세웁니다.
  const report = () => {
    const m = mesh.current;
    if (!m) return;
    const corner = (sx: number, sy: number) => {
      const p = new THREE.Vector3((sx * frame.w) / 2, (sy * h) / 2, 0);
      m.localToWorld(p);
      p.project(camera);
      return { x: (p.x * 0.5 + 0.5) * size.width, y: (-p.y * 0.5 + 0.5) * size.height };
    };
    const a = corner(-1, 1);
    const b = corner(1, -1);
    onPick({
      left: Math.min(a.x, b.x),
      top: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
      title: frame.title,
      body: frame.body,
    });
  };

  return (
    <mesh
      ref={mesh}
      position={[dir * (HALF_W - WALL.frame), frame.y, frame.z]}
      rotation={[0, dir === -1 ? Math.PI / 2 : -Math.PI / 2, frame.tilt]}
      onPointerOver={(e) => { if (!locked) { e.stopPropagation(); setHover(true); } }}
      onPointerOut={() => setHover(false)}
      onClick={(e) => { if (locked) return; e.stopPropagation(); report(); }}
    >
      <planeGeometry args={[frame.w, h]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.04} toneMapped={false} />
    </mesh>
  );
}

/* ── 밖에서 온 액자 ──────────────────────────────────────────────────
   유튜브 영상과 깃 저장소. 이 액자만 캔버스로 그립니다 — SVG data URI 안에서는
   웹폰트가 안 걸려서 손글씨가 시스템 고딕으로 주저앉기 때문입니다. */

const ART_W = 420;      // 캔버스 폭(px). 높이는 내용이 정합니다.
const ART_PAD = 21;     // 나무틀 두께. 얇으면 멀리서 흰 종이 한 장으로만 보입니다.
const ART_MAT = 17;     // 흰 매트 여백

/** 살짝 떨리는 사각형. 자로 잰 선은 이 세계의 물건으로 안 읽힙니다. */
function wobble(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) {
  const j = (n: number) => {
    const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return (v - Math.floor(v)) * 1.8 - 0.9;
  };
  ctx.beginPath();
  ctx.moveTo(x + j(0), y + j(1));
  ctx.lineTo(x + w + j(2), y + j(3));
  ctx.lineTo(x + w + j(4), y + h + j(5));
  ctx.lineTo(x + j(6), y + h + j(7));
  ctx.closePath();
}

/** 폭에 맞춰 줄을 나눕니다. 넘치면 마지막 줄을 줄이고 말줄임표를 답니다. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const lines: string[] = [];
  let line = '';
  let cut = false;
  for (const ch of text) {
    if (ctx.measureText(line + ch).width <= maxW) { line += ch; continue; }
    if (lines.length + 1 === maxLines) { cut = true; break; }
    lines.push(line);
    line = ch;
  }
  lines.push(line);
  if (cut) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

/* 캔버스가 오염되면 WebGL이 텍스처로 안 받습니다. i.ytimg.com은 CORS를 열어 두었습니다. */
const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지를 못 받았습니다: ${src}`));
    img.src = src;
  });

/** 액자 한 장을 그려 텍스처로 돌려줍니다. 높이는 내용이 정하므로 비율도 같이 냅니다. */
async function paintArt(art: LiveArt): Promise<{ texture: THREE.CanvasTexture; ratio: number }> {
  /* 웹폰트가 올라오기 전에 그리면 손글씨가 폴백으로 굳은 채 텍스처에 구워집니다.
     fonts.ready만으로는 아직 안 쓰인 얼굴을 기다려 주지 않아 직접 부릅니다. */
  await Promise.all([
    document.fonts.load('700 26px Gaegu'),
    document.fonts.load('400 19px "Nanum Pen Script"'),
  ]).catch(() => {});

  const inner = ART_W - 2 * (ART_PAD + ART_MAT);
  const left = ART_PAD + ART_MAT;

  // 재는 데만 쓰는 컨텍스트. 높이를 알아야 캔버스를 만들 수 있습니다.
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = '700 26px Gaegu, sans-serif';
  const titleLines = wrapLines(probe, art.title, inner, 2);
  probe.font = '400 16px Pretendard, sans-serif';
  const descLines = art.desc ? wrapLines(probe, art.desc, inner, 1) : [];

  const thumbH = art.kind === 'video' ? Math.round((inner * 9) / 16) : 0;
  const logoH = art.kind === 'repo' ? 30 : 0;
  const LINE = 34;          // Gaegu 26px이 실제로 차지하는 높이
  const bodyTop = ART_PAD + ART_MAT + (thumbH ? thumbH + 14 : 0) + (logoH ? logoH + 8 : 0);
  const height =
    bodyTop + titleLines.length * LINE + 8 + 26 +
    (descLines.length ? 4 + 22 : 0) + ART_MAT + ART_PAD;

  const dpr = 2;
  const cv = document.createElement('canvas');
  cv.width = ART_W * dpr;
  cv.height = height * dpr;
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.textBaseline = 'top';

  // 나무틀 → 흰 매트
  ctx.fillStyle = PAPER.wood;
  ctx.strokeStyle = PAPER.ink;
  ctx.lineWidth = 3.6;
  wobble(ctx, 4, 4, ART_W - 8, height - 8, 1);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PAPER.card;
  ctx.lineWidth = 2.6;
  wobble(ctx, ART_PAD, ART_PAD, ART_W - 2 * ART_PAD, height - 2 * ART_PAD, 2);
  ctx.fill();
  ctx.stroke();

  const top = ART_PAD + ART_MAT;

  if (art.thumb) {
    const img = await loadImage(art.thumb);
    ctx.save();
    wobble(ctx, left, top, inner, thumbH, 3);
    ctx.clip();
    const scale = Math.max(inner / img.width, thumbH / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, left + (inner - dw) / 2, top + (thumbH - dh) / 2, dw, dh);
    ctx.restore();
    ctx.strokeStyle = PAPER.ink;
    ctx.lineWidth = 2.2;
    wobble(ctx, left, top, inner, thumbH, 3);
    ctx.stroke();

    // 재생 단추. 이게 없으면 그냥 사진이 걸린 것으로 보입니다.
    const cx = left + inner / 2;
    const cy = top + thumbH / 2;
    ctx.fillStyle = 'rgba(206,54,44,0.92)';
    ctx.beginPath();
    ctx.roundRect(cx - 28, cy - 19, 56, 38, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 11);
    ctx.lineTo(cx + 13, cy);
    ctx.lineTo(cx - 8, cy + 11);
    ctx.closePath();
    ctx.fill();
  }

  if (art.kind === 'repo') {
    ctx.save();
    ctx.translate(left, top);
    ctx.scale(logoH / 16, logoH / 16);
    ctx.fillStyle = PAPER.ink;
    ctx.fill(new Path2D(MARK.github));
    ctx.restore();
  }

  let y = bodyTop;
  ctx.fillStyle = PAPER.ink;
  ctx.font = '700 26px Gaegu, sans-serif';
  titleLines.forEach((line, i) => ctx.fillText(line, left, y + i * LINE));
  y += titleLines.length * LINE + 8;

  ctx.fillStyle = PAPER.faint;
  ctx.font = '400 19px "Nanum Pen Script", sans-serif';
  ctx.fillText(art.meta, left, y);
  y += 26;

  if (descLines.length) {
    ctx.fillStyle = PAPER.jamb;
    ctx.font = '400 16px Pretendard, sans-serif';
    ctx.fillText(descLines[0], left, y + 4);
  }

  const texture = new THREE.CanvasTexture(cv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, ratio: height / ART_W };
}

/**
 * 밖에서 온 액자 한 장. 누르면 그 유튜브 영상이나 저장소로 갑니다 —
 * 설명 카드를 띄우지 않는 건 제목과 날짜가 이미 액자 안에 그려져 있어서입니다.
 */
function LiveFrameMesh({
  art, spot, locked,
}: {
  art: LiveArt;
  spot: LiveSpot;
  locked: boolean;
}) {
  const [drawn, setDrawn] = useState<{ texture: THREE.CanvasTexture; ratio: number } | null>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const dir = spot.side === 'left' ? -1 : 1;

  useEffect(() => {
    let dead = false;
    let made: THREE.CanvasTexture | null = null;
    paintArt(art)
      .then((result) => {
        made = result.texture;
        if (dead) { result.texture.dispose(); return; }
        setDrawn(result);
      })
      // 썸네일이 안 오거나 캔버스가 막히면 그 액자만 안 걸립니다. 벽은 그대로입니다.
      .catch((err) => console.warn('[액자] 못 그렸습니다:', art.id, err));
    return () => { dead = true; made?.dispose(); };
  }, [art]);

  useFrame((_, dt) => {
    if (!mesh.current) return;
    const target = hover && !locked ? spot.tilt * 2.6 : spot.tilt;
    mesh.current.rotation.z += (target - mesh.current.rotation.z) * damp(dt, 8);
  });

  useEffect(() => {
    if (!hover || locked) return;
    document.body.style.cursor = 'pointer';
    return () => { document.body.style.cursor = ''; };
  }, [hover, locked]);

  if (!drawn) return null;
  const h = spot.w * drawn.ratio;

  return (
    <mesh
      ref={mesh}
      position={[dir * (HALF_W - WALL.frame), spot.y, spot.z]}
      rotation={[0, dir === -1 ? Math.PI / 2 : -Math.PI / 2, spot.tilt]}
      onPointerOver={(e) => { if (!locked) { e.stopPropagation(); setHover(true); } }}
      onPointerOut={() => setHover(false)}
      onClick={(e) => {
        if (locked) return;
        e.stopPropagation();
        window.open(art.url, '_blank', 'noopener,noreferrer');
      }}
    >
      <planeGeometry args={[spot.w, h]} />
      <meshBasicMaterial map={drawn.texture} transparent alphaTest={0.04} toneMapped={false} />
    </mesh>
  );
}

/** 방 안쪽. 지금은 빈 상자입니다 — 사물은 다음 단계에서 채웁니다. */
function RoomBox({ room, active, onLiveRect, onThingPick, onAing }: { room: Room; active: boolean; onLiveRect: (r: LiveRect | null) => void; onThingPick: (i: PickInfo | null) => void; onAing: (r: AingRect | null) => void }) {
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
        <PropLayer key={i} room={room} layer={layer} order={i} active={active} onLiveRect={onLiveRect} />
      ))}

      {(ROOM_THINGS[room.id] ?? []).map((thing) => (
        <ThingMesh key={thing.id} room={room} thing={thing} active={active} onPick={onThingPick} />
      ))}

      {ROOM_MASCOT[room.id] && <AingAnchor room={room} active={active} onAing={onAing} />}

    </group>
  );
}

/**
 * 오려 세운 종이 한 겹. 방 하나가 이런 층 셋으로 섭니다.
 *
 * depth는 카메라가 서는 자리(0)에서 안쪽 벽(1)까지의 비율입니다.
 * 방 중심 기준으로 잡으면 앞 층이 카메라 등 뒤로 넘어갑니다.
 */
function PropLayer({
  room, layer, order, active, onLiveRect,
}: {
  room: Room; layer: Layer; order: number; active: boolean;
  onLiveRect: (r: LiveRect | null) => void;
}) {
  const { depth, svg, live } = layer;
  const lift = layer.lift ?? 0;
  const dir = room.side === 'left' ? -1 : 1;
  // 카메라가 보는 깊이는 방의 x축(roomW)입니다. 화면을 채우는 폭은 z축(roomD).
  const { roomW: DEPTH, roomOffset } = CORRIDOR;
  const mesh = useRef<THREE.Mesh>(null);
  const { camera, size } = useThree();
  const last = useRef<string>('');

  const texture = useSvgTexture(svg);

  // 카메라가 멈추는 로컬 x. enter()가 CORRIDOR.cameraStop 지점까지 날아옵니다.
  const camLocal = roomOffset * CORRIDOR.cameraStop - roomOffset;
  const dist = (DEPTH / 2 - camLocal) * depth;
  const x = dir * (camLocal + dist);

  // 층은 전부 같은 실척입니다. 거리에 따라 키우면 가까운 층의 물건이
  // 작아지고 공중에 뜬 것처럼 보여 층 사이의 크기 관계가 깨집니다.
  const w = LAYER_W;
  const h = LAYER_W * (400 / 1120);

  /**
   * 모니터 자리를 화면 좌표로 옮깁니다.
   * 방에 들어가면 카메라가 문을 정면으로 보고 멈추므로 평면이 정면이고,
   * 투영된 사각형은 축에 정렬됩니다 — 두 꼭짓점만 재면 충분합니다.
   */
  useFrame(() => {
    if (!live || !mesh.current) return;
    if (!active) {
      if (last.current) { last.current = ''; onLiveRect(null); }
      return;
    }
    const toScreen = (px: number, py: number) => {
      const v = new THREE.Vector3((px / 1120 - 0.5) * w, (0.5 - py / 400) * h, 0);
      mesh.current!.localToWorld(v);
      v.project(camera);
      return { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height };
    };
    const a = toScreen(live.x, live.y);
    const b = toScreen(live.x + live.w, live.y + live.h);
    const rect: LiveRect = {
      left: Math.min(a.x, b.x),
      top: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
      src: live.src, vw: live.vw, vh: live.vh, label: live.label,
    };
    // 소수점까지 매 프레임 흘리면 리렌더가 계속 납니다. 반 픽셀 넘게 움직였을 때만.
    const key = `${rect.left | 0}|${rect.top | 0}|${rect.width | 0}|${rect.height | 0}`;
    if (key !== last.current) { last.current = key; onLiveRect(rect); }
  });

  return (
    <mesh
      ref={mesh}
      position={[x, h / 2 + lift, 0]}
      rotation={[0, dir === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}
      renderOrder={order}
    >
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.04} toneMapped={false} />
    </mesh>
  );
}


/** 층 깊이 이름 → ROOM_LAYERS의 인덱스 */
const LAYER_INDEX = { back: 0, mid: 1, front: 2 } as const;

/** SVG 문자열 하나를 텍스처로. 층과 사물이 같은 방식을 씁니다. */
function useSvgTexture(svg: string) {
  const texture = useMemo(() => {
    const t = new THREE.TextureLoader().load(toDataUri(svg));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [svg]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/**
 * 눌러지는 사물 하나.
 *
 * 층 텍스처에 구워 두면 개별로 못 움직이므로 제 평면을 가집니다.
 * 회전이 제 중심에서 돌도록, 바깥 group이 층의 방향을 잡고
 * 안쪽 mesh만 제자리에서 움직입니다.
 */
function ThingMesh({
  room, thing, active, onPick,
}: {
  room: Room; thing: Thing; active: boolean; onPick: (i: PickInfo | null) => void;
}) {
  const dir = room.side === 'left' ? -1 : 1;
  const { roomW: DEPTH, roomOffset } = CORRIDOR;
  const inner = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const { camera, size } = useThree();

  const texture = useSvgTexture(thing.svg);

  const layer = ROOM_LAYERS[room.id][LAYER_INDEX[thing.layer]];
  const lift = layer.lift ?? 0;
  const camLocal = roomOffset * CORRIDOR.cameraStop - roomOffset;
  const layerX = dir * (camLocal + (DEPTH / 2 - camLocal) * layer.depth);

  // 층 평면의 크기 (7 x 2.5). 사물은 그 안의 제 자리만큼만 차지합니다.
  const LH = LAYER_W * (400 / 1120);
  const px = LAYER_W / 1120; // SVG 1픽셀당 월드 유닛
  const w = thing.box.w * px;
  const h = thing.box.h * px;
  const cx = thing.box.x + thing.box.w / 2;
  const cy = thing.box.y + thing.box.h / 2;
  const u = (cx / 1120 - 0.5) * LAYER_W;
  const v = (0.5 - cy / 400) * LH;

  const play = () => {
    const m = inner.current;
    if (!m) return;
    gsap.killTweensOf([m.rotation, m.position, m.scale]);
    m.rotation.z = 0; m.position.set(0, 0, 0); m.scale.set(1, 1, 1);
    const t = gsap.timeline();
    switch (thing.motion) {
      case 'flutter': // 종이가 펄럭임
        t.to(m.rotation, { z: 0.05, duration: 0.12, ease: 'sine.out' })
         .to(m.rotation, { z: -0.038, duration: 0.16, ease: 'sine.inOut' })
         .to(m.rotation, { z: 0.022, duration: 0.16, ease: 'sine.inOut' })
         .to(m.rotation, { z: 0, duration: 0.22, ease: 'sine.inOut' });
        break;
      case 'shake': // 상자가 덜컹
        t.to(m.position, { x: w * 0.035, duration: 0.05 })
         .to(m.position, { x: -w * 0.03, duration: 0.06 })
         .to(m.position, { x: w * 0.018, duration: 0.06 })
         .to(m.position, { x: 0, duration: 0.08 });
        break;
      case 'swing': // 매달린 것이 흔들림
        t.to(m.rotation, { z: -0.16, duration: 0.18, ease: 'sine.out' })
         .to(m.rotation, { z: 0.11, duration: 0.28, ease: 'sine.inOut' })
         .to(m.rotation, { z: -0.06, duration: 0.28, ease: 'sine.inOut' })
         .to(m.rotation, { z: 0, duration: 0.3, ease: 'sine.inOut' });
        break;
      case 'spin': // 릴·회전대가 돎
        t.to(m.rotation, { z: -Math.PI * 2, duration: 0.9, ease: 'power2.inOut' });
        break;
      case 'press': // 눌리고 되돌아옴
        t.to(m.scale, { x: 0.93, y: 0.9, duration: 0.09, ease: 'power2.in' })
         .to(m.position, { y: -h * 0.05, duration: 0.09, ease: 'power2.in' }, 0)
         .to(m.scale, { x: 1, y: 1, duration: 0.35, ease: 'elastic.out(1, 0.4)' })
         .to(m.position, { y: 0, duration: 0.35, ease: 'elastic.out(1, 0.4)' }, '<');
        break;
      case 'tilt': // 저울처럼 기울었다 돌아옴
        t.to(m.rotation, { z: 0.1, duration: 0.3, ease: 'power2.inOut' })
         .to(m.rotation, { z: -0.05, duration: 0.35, ease: 'power2.inOut' })
         .to(m.rotation, { z: 0, duration: 0.4, ease: 'power2.inOut' });
        break;
      case 'ripple': // 선을 타고 물결이 지나감
        t.to(m.position, { y: h * 0.06, duration: 0.14, ease: 'sine.inOut' })
         .to(m.position, { y: -h * 0.045, duration: 0.18, ease: 'sine.inOut' })
         .to(m.position, { y: h * 0.02, duration: 0.18, ease: 'sine.inOut' })
         .to(m.position, { y: 0, duration: 0.2, ease: 'sine.inOut' });
        break;
    }
  };

  // 방에 있을 때만, 눌린 사물의 자리를 DOM으로 넘깁니다.
  const report = () => {
    const m = inner.current;
    if (!m) return;
    const corner = (sx: number, sy: number) => {
      const p = new THREE.Vector3(sx * w / 2, sy * h / 2, 0);
      m.localToWorld(p);
      p.project(camera);
      return { x: (p.x * 0.5 + 0.5) * size.width, y: (-p.y * 0.5 + 0.5) * size.height };
    };
    const a = corner(-1, 1);
    const b = corner(1, -1);
    const c = thing.callout !== undefined ? room.callouts[thing.callout] : undefined;
    onPick({
      left: Math.min(a.x, b.x),
      top: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
      title: thing.title ?? c?.title ?? '',
      body: thing.body ?? c?.body ?? '',
    });
  };

  useEffect(() => {
    if (!active) setHover(false);
  }, [active]);

  useEffect(() => {
    if (!active || !hover) return;
    document.body.style.cursor = 'pointer';
    return () => { document.body.style.cursor = ''; };
  }, [active, hover]);

  return (
    <group position={[layerX + dir * 0.004, LH / 2 + lift + v, dir * u]} rotation={[0, dir === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}>
      <mesh
        ref={inner}
        onPointerOver={(e) => { if (active) { e.stopPropagation(); setHover(true); } }}
        onPointerOut={() => setHover(false)}
        onClick={(e) => { if (!active) return; e.stopPropagation(); play(); report(); }}
      >
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.04} toneMapped={false} />
      </mesh>
    </group>
  );
}


/**
 * 아잉이 설 자리만 3D에서 잡고, 실제 그림은 DOM <img>가 그립니다.
 * 알파가 이진이라 텍스처로 쓰면 가장자리가 깎이고, 애니메이션도 멈춥니다.
 */
function AingAnchor({ room, active, onAing }: { room: Room; active: boolean; onAing: (r: AingRect | null) => void }) {
  const spec = ROOM_MASCOT[room.id];
  const dir = room.side === 'left' ? -1 : 1;
  const { roomW: DEPTH, roomOffset } = CORRIDOR;
  const mesh = useRef<THREE.Mesh>(null);
  const { camera, size } = useThree();
  const last = useRef('');

  const layer = ROOM_LAYERS[room.id][LAYER_INDEX[spec.layer]];
  const lift = layer.lift ?? 0;
  const camLocal = roomOffset * CORRIDOR.cameraStop - roomOffset;
  const layerX = dir * (camLocal + (DEPTH / 2 - camLocal) * layer.depth);
  const LH = LAYER_W * (400 / 1120);
  const px = LAYER_W / 1120;
  const w = spec.box.w * px;
  const h = spec.box.h * px;
  const u = ((spec.box.x + spec.box.w / 2) / 1120 - 0.5) * LAYER_W;
  const v = (0.5 - (spec.box.y + spec.box.h / 2) / 400) * LH;

  useFrame(() => {
    if (!active || !mesh.current) {
      if (last.current) { last.current = ''; onAing(null); }
      return;
    }
    const corner = (sx: number, sy: number) => {
      const p = new THREE.Vector3(sx * w / 2, sy * h / 2, 0);
      mesh.current!.localToWorld(p);
      p.project(camera);
      return { x: (p.x * 0.5 + 0.5) * size.width, y: (-p.y * 0.5 + 0.5) * size.height };
    };
    const a = corner(-1, 1);
    const b = corner(1, -1);
    const rect: AingRect = {
      left: Math.min(a.x, b.x), top: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y),
      motion: spec.motion, alt: spec.alt,
    };
    const key = `${rect.left | 0}|${rect.top | 0}|${rect.width | 0}`;
    if (key !== last.current) { last.current = key; onAing(rect); }
  });

  return (
    <mesh
      ref={mesh}
      visible={false}
      position={[layerX + dir * 0.006, LH / 2 + lift + v, dir * u]}
      rotation={[0, dir === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}
    >
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}
