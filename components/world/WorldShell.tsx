'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { roomById } from '@/lib/rooms';
import { isInteractiveTarget } from '@/lib/anim';
import type { SceneApi, LiveRect, PickInfo, AingRect } from './Scene';

// three와 R3F는 첫 페인트를 막지 않도록 나중에 실어 옵니다.
const World = dynamic(() => import('./World'), { ssr: false });

export default function WorldShell({ children }: { children: React.ReactNode }) {
  const api = useRef<SceneApi | null>(null);
  const [nearId, setNearId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [atEnd, setAtEnd] = useState(false);
  const [reading, setReading] = useState(false);
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
        {reading ? '복도로 돌아가기' : '전부 읽기'}
      </button>

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
          className="aing"
          src={`/mascot/motion/${aing.motion}.webp`}
          alt={aing.alt}
          style={{ left: aing.left, top: aing.top, width: aing.width, height: aing.height }}
        />
      )}

      {!reading && active && pick && <PickCard info={pick} onClose={() => setPick(null)} />}

      {!reading && active && (
        <button className="fold" onClick={() => setFolded((v) => !v)} aria-expanded={!folded}>
          {folded ? '설명 펼치기' : '설명 접기'}
        </button>
      )}

      <div className="content">{children}</div>

      {!reading && !active && !near && !atEnd && (
        <p className="hint">스크롤하면 복도를 걷습니다. 문에 색이 칠해지면 들어갈 수 있습니다.</p>
      )}
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
