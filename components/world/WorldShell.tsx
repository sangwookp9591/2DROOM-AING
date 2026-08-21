'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { roomById } from '@/lib/rooms';
import { isInteractiveTarget } from '@/lib/anim';
import type { SceneApi } from './Scene';

// three와 R3F는 첫 페인트를 막지 않도록 나중에 실어 옵니다.
const World = dynamic(() => import('./World'), { ssr: false });

export default function WorldShell({ children }: { children: React.ReactNode }) {
  const api = useRef<SceneApi | null>(null);
  const [nearId, setNearId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [atEnd, setAtEnd] = useState(false);
  const [reading, setReading] = useState(false);

  const near = nearId ? roomById(nearId) : null;
  const active = activeId ? roomById(activeId) : null;
  const leave = useCallback(() => setActiveId(null), []);

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
      if (e.key === 'Escape' && activeId) api.current?.exit();
      if (e.key === 'Enter' && nearId && !activeId) api.current?.enter(nearId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeId, nearId]);

  return (
    <div className="shell" data-mode={reading ? 'read' : 'world'}>
      <div className="canvas" aria-hidden="true">
        <World
          api={api}
          activeId={activeId}
          paused={reading}
          onNear={setNearId}
          onEnd={setAtEnd}
          onArrive={setActiveId}
          onLeave={leave}
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

      <div className="content">{children}</div>

      {!reading && !active && !near && !atEnd && (
        <p className="hint">스크롤하면 복도를 걷습니다. 문에 색이 칠해지면 들어갈 수 있습니다.</p>
      )}
    </div>
  );
}
