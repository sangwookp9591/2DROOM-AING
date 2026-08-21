'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ROOMS, roomById } from '@/lib/rooms';
import { isInteractiveTarget } from '@/lib/anim';
import type { SceneApi, LiveRect, PickInfo, AingRect } from './Scene';
import type { LiveArt } from '@/lib/frames';

// three와 R3F는 첫 페인트를 막지 않도록 나중에 실어 옵니다.
const World = dynamic(() => import('./World'), { ssr: false });
// 채팅창도 같습니다 — 물어볼 마음이 없는 방문자에게는 이 코드가 필요 없습니다.
const AingChat = dynamic(() => import('@/components/aing/AingChat'), { ssr: false });

export default function WorldShell({
  children,
  wall = [],
}: {
  children: React.ReactNode;
  /** 복도 벽에 걸 밖의 것들 — 영상과 저장소. 서버에서 받아 옵니다(app/page.tsx). */
  wall?: LiveArt[];
}) {
  const api = useRef<SceneApi | null>(null);
  const [nearId, setNearId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [atEnd, setAtEnd] = useState(false);
  // 채용 담당자는 먼저 내용을 훑고, 원할 때 3D 복도를 선택합니다.
  const [reading, setReading] = useState(true);
  const [live, setLive] = useState<LiveRect | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [pick, setPick] = useState<PickInfo | null>(null);
  const [aing, setAing] = useState<AingRect | null>(null);
  const [folded, setFolded] = useState(false);

  const near = nearId ? roomById(nearId) : null;
  const active = activeId ? roomById(activeId) : null;
  const leave = useCallback(() => {
    setActiveId(null);
    setZoomed(false);
    setPick(null);
    setAing(null);
  }, []);

  /** 복도 모드에서 지금 펼쳐진 한 곳. 방 > 복도 끝(콜로폰) > 표지 순. */
  const openId = activeId ?? (atEnd ? 'colophon' : 'cover');

  // 어느 절을 펼칠지는 데이터로 정합니다. CSS에 방 id를 박아 두면
  // 방이 하나 늘 때 그 절만 영영 안 열립니다.
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('.doc > [data-room]');
    sections.forEach((el) => {
      const open = !reading && el.dataset.room === openId;
      el.toggleAttribute('data-open', open);
      // 안 보이는 절은 보조기기에서도 빼 줍니다. 읽기 모드에서는 전부 되살립니다.
      if (reading) el.removeAttribute('aria-hidden');
      else el.setAttribute('aria-hidden', open ? 'false' : 'true');
    });
  }, [openId, reading, children]);

  /* 카드는 눌린 그때의 화면 좌표에 고정돼 있습니다. 복도에서 한 걸음이라도 걸으면
     액자는 지나갔는데 설명만 허공에 남으므로, 걸음이 시작되면 접습니다.
     걸음은 페이지 스크롤이 아니라 휠·터치·방향키입니다(useCorridorCamera). */
  useEffect(() => {
    if (!pick || activeId) return;
    const moves = ['wheel', 'keydown', 'touchmove'] as const;
    const off = () => setPick(null);
    moves.forEach((m) => window.addEventListener(m, off, { passive: true, once: true }));
    return () => moves.forEach((m) => window.removeEventListener(m, off));
  }, [pick, activeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 포커스된 버튼·링크 위의 Enter는 그 컨트롤의 것입니다. 겹쳐 쏘면 두 가지가 동시에 일어납니다.
      if (isInteractiveTarget(e)) return;
      if (e.key === 'Escape' && zoomed) { setZoomed(false); return; }
      if (e.key === 'Escape' && activeId) api.current?.exit();
      if (e.key === 'Enter' && nearId && !activeId) api.current?.enter(nearId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeId, nearId, zoomed]);

  return (
    <div className="shell" data-mode={reading ? 'read' : 'world'} data-fold={!reading && folded ? '' : undefined}>
      <div className="canvas" aria-hidden="true">
        <World
          api={api}
          activeId={activeId}
          wall={wall}
          paused={reading}
          onNear={setNearId}
          onEnd={setAtEnd}
          onArrive={setActiveId}
          onLeave={leave}
          onLiveRect={setLive}
          onThingPick={setPick}
          onAing={setAing}
        />
      </div>

      <button className="mode" onClick={() => setReading((v) => !v)}>
        {reading ? '3D 복도 둘러보기' : '한눈에 보기'}
      </button>

      {!reading && !active && (
        <nav className="route" aria-label="복도에 있는 사례 순서">
          <span>6개 사례</span>
          <ol>
            {ROOMS.map((room) => (
              <li key={room.id} data-current={near?.id === room.id || undefined}>
                <b>{room.n}</b>{room.name}
              </li>
            ))}
          </ol>
          <small>스크롤해 문에 다가가세요.</small>
        </nav>
      )}

      {!reading && near && !active && (
        <div className="prompt">
          <span className="prompt__n" style={{ background: near.accent }}>{near.n}</span>
          <span className="prompt__name">{near.name}</span>
          <button onClick={() => api.current?.enter(near.id)}>들어가기</button>
        </div>
      )}

      {!reading && active && (
        <button className="back" onClick={() => api.current?.exit()}>
          복도로 나가기
        </button>
      )}

      {/*
        방마다 하나 있는 살아 있는 화면. 3D 모니터 자리에 실제 페이지를 앉힙니다.
        그림이 아니라 진짜라서 눌러 보고 스크롤할 수 있습니다.
      */}
      {!reading && active && live && (
        <LiveScreen rect={live} zoomed={zoomed} onZoom={setZoomed} />
      )}

      {!reading && active && aing && (
        <img
          className="mascot"
          src={`/mascot/motion/${aing.motion}.webp`}
          alt={aing.alt}
          style={{ left: aing.left, top: aing.top, width: aing.width, height: aing.height }}
        />
      )}

      {/* 방 안의 사물에서도, 복도 벽의 액자에서도 같은 카드가 뜹니다. */}
      {!reading && pick && <PickCard info={pick} onClose={() => setPick(null)} />}

      {!reading && active && (
        <button className="fold" onClick={() => setFolded((v) => !v)} aria-expanded={!folded}>
          {folded ? '설명 펼치기' : '설명 접기'}
        </button>
      )}

      <div className="content">{children}</div>

      {!reading && !active && !near && !atEnd && (
        <p className="hint">스크롤하면 작업 사례를 차례로 봅니다. 가까워진 사례를 눌러 자세히 확인하세요.</p>
      )}

      {/* 복도에서든 읽기 모드에서든 물어볼 수 있어야 합니다. 답은 브라우저 안에서 만들어집니다. */}
      <AingChat />
    </div>
  );
}

/**
 * 사물을 눌렀을 때 그 자리 옆에 붙는 설명.
 * 화면 밖으로 나가지 않게 좌우를 잡아 줍니다.
 */
function PickCard({ info, onClose }: { info: PickInfo; onClose: () => void }) {
  const W = 300;
  const left = Math.max(12, Math.min(info.left + info.width / 2 - W / 2, window.innerWidth - W - 12));
  const below = info.top + info.height + 12;
  const top = below + 150 < window.innerHeight ? below : Math.max(12, info.top - 162);

  return (
    <div className="pick" style={{ left, top, width: W }} role="status">
      <h3>{info.title}</h3>
      <p>{info.body}</p>
      <button onClick={onClose} aria-label="설명 닫기">닫기</button>
    </div>
  );
}

/**
 * 모니터 안에 앉는 진짜 화면.
 * 그 페이지가 상정한 크기(vw x vh)로 렌더한 뒤 모니터 자리에 맞춰 줄입니다.
 * 자리 크기에 맞춰 늘리면 원래 설계한 배치가 무너집니다.
 */
function LiveScreen({
  rect, zoomed, onZoom,
}: {
  rect: LiveRect; zoomed: boolean; onZoom: (v: boolean) => void;
}) {
  // 확대하면 화면의 90%를 씁니다. 모니터 안 크기로는 글씨를 못 읽어서,
  // 만든 것을 보여 주는 화면이 정작 증거 노릇을 못 합니다.
  const box = zoomed
    ? { width: Math.round(window.innerWidth * 0.9), height: Math.round(window.innerHeight * 0.86) }
    : { width: rect.width, height: rect.height };
  const scale = Math.min(box.width / rect.vw, box.height / rect.vh);
  const offsetX = (box.width - rect.vw * scale) / 2;
  const offsetY = (box.height - rect.vh * scale) / 2;

  const place = zoomed
    ? { left: '50%', top: '50%', width: box.width, height: box.height, transform: 'translate(-50%, -50%)' }
    : { left: rect.left, top: rect.top, width: box.width, height: box.height };

  return (
    <>
      {zoomed && <button className="live__veil" aria-label="닫기" onClick={() => onZoom(false)} />}
      <div className="live" data-zoomed={zoomed || undefined} style={place}>
        <iframe
          src={rect.src}
          title={rect.label}
          loading="lazy"
          style={{
            width: rect.vw,
            height: rect.vh,
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          }}
        />
        <button className="live__zoom" onClick={() => onZoom(!zoomed)}>
          {zoomed ? '닫기' : '크게 보기'}
        </button>
      </div>
    </>
  );
}
