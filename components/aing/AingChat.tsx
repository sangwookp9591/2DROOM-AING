'use client';

/* 아잉에게 물어보는 창. 오른쪽 아래 마스코트를 누르면 그 자리에서 펼쳐집니다.

   답은 세 갈래로 나옵니다(brain.ts) — 이 컴퓨터의 Ollama, 브라우저 안의 소형 모델,
   그리고 둘 다 없을 때의 위키. 어느 쪽이든 근거는 같은 위키(lib/wiki.ts)이고
   질문은 밖으로 나가지 않습니다. */
import { useCallback, useEffect, useRef, useState } from 'react';
import useAingBrain from './brain';
import Markdown from './Markdown';
import { polish, suggest } from '@/lib/answer';
import { isTypingTarget } from '@/lib/anim';

type Brain = ReturnType<typeof useAingBrain>;

/** 로그 한 줄. pending은 답이 아직 흐르는 중이라는 표시입니다.
    tips는 이 답 아래에 붙는 다음 질문거리 — 답이 끝난 뒤에 한 번만 정합니다. */
type Turn = { role: 'you' | 'aing'; text: string; id: string; at: string; pending?: boolean; tips?: string[] };

const HELLO = '안녕하세요.\n프로젝트, 기술스택, 경력에 대해\n편하게 물어보세요.';

/* 첫 화면에 놓는 질문. NO_MATCH만 피하면 되는 게 아니라, 누른 그 화제가 나와야 합니다 —
   '앱 없이 주문하게 했나요?'는 장바구니 병합 규칙을, '어떤 걸로 개발해요?'는 프로필을
   물어 왔습니다. 답이 오기는 하니 눈에 안 띄었습니다. 아래 문구는 전부 wiki.check.ts의
   CHIPS가 1순위 조각까지 검사합니다 — 위키가 바뀌면 여기가 아니라 거기서 먼저 터집니다. */
const OPENERS = ['어떤 서비스를 만들었어요?', '프론트엔드는 어디까지 했어요?', '백엔드에서 뭘 했어요?'];

/** 답 아래에 권할 화제를 위키가 못 내줄 때 쓰는 예비 질문. */
const PROMPTS = [
  '어떤 서비스를 만들었어요?',
  '결제는 어떻게 처리했어요?',
  '권한 시스템은 어떻게 설계했어요?',
  '외부 서비스가 멈추면 어떻게 되나요?',
  '팀에 남긴 게 뭐예요?',
  '기술 스택이 뭐예요?',
];

/** 말풍선 옆에 붙는 시각. 서버에는 이 시각이 없으므로 창은 마운트 뒤에만 그립니다. */
const clock = () => new Date().toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });

/** 지금 무엇이 답하고 있는지. 모델을 받는 중일 때만 화면에 냅니다 —
    평소에 엔진 이름을 띄워 봐야 방문자가 할 수 있는 일이 없습니다. */
const engineNote = (brain: Brain) => {
  // 다 받은 뒤에도 세션을 짓는 동안은 loading입니다. 100%에 붙박여 있으면 멎은 것으로 보입니다.
  if (brain.status === 'loading' && brain.progress >= 1) return `${brain.model.label} 준비하는 중`;
  if (brain.status === 'loading') return `${brain.model.label} 내려받는 중 ${Math.round(brain.progress * 100)}%`;
  if (brain.status === 'error') return `${brain.model.label}를 못 띄웠습니다 · 위키로 답할게요`;
  return null;
};

export default function AingChat() {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);   // 고정해 두면 Esc로도 안 접힙니다
  const [q, setQ] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const brain = useAingBrain();

  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const launchRef = useRef<HTMLButtonElement>(null);

  /* 모델은 방문자가 물어볼 뜻을 보인 다음에 받습니다(brain.warm). 창을 여는 것과
     입력칸에 손을 대는 것이 그 신호입니다 — 복도만 걷다 나가는 사람은 아무것도 안 받습니다. */
  const warm = brain.warm;
  const grow = useCallback(() => { warm(); setOpen(true); }, [warm]);
  const shrink = useCallback(() => setOpen(false), []);

  /* 어디에서든 / 또는 Cmd+K로 부르고, Esc로 접습니다.
     복도 쪽 단축키(Enter로 방 진입)는 입력칸 위에서 스스로 비켜섭니다(lib/anim.isInteractiveTarget). */
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!open && !isTypingTarget(e) && (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey)))) {
        e.preventDefault();
        grow();
      } else if (open && e.key === 'Escape' && !pinned) {
        /* 이 Esc는 창을 접는 데 씁니다. 그냥 두면 같은 window에 걸린 복도 핸들러가
           (WorldShell) 같은 키로 방까지 나가서, 한 번 눌렀는데 두 가지가 일어납니다.
           캡처 단계에서 먼저 받아 여기서 끊습니다 — 복도 쪽은 버블이라 이 뒤에 옵니다. */
        e.stopPropagation();
        shrink();
      }
    };
    addEventListener('keydown', on, { capture: true });
    return () => removeEventListener('keydown', on, { capture: true });
  }, [open, pinned, grow, shrink]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  // 접을 때 포커스를 마스코트로 돌려놓습니다 — 안 그러면 사라진 요소에 포커스가 남습니다.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) launchRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  /* 토큰 하나마다 turns가 새 배열이 되므로, 여기서 매번 smooth 스크롤을 걸면
     애니메이션이 끝나기 전에 다시 시작돼 로그가 글을 따라가는 대신 떨립니다.
     답이 흐르는 동안에는 즉시 붙이고, 다 끝났을 때만 부드럽게 맞춥니다. */
  const streaming = turns[turns.length - 1]?.pending;
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: streaming ? 'auto' : 'smooth' });
  }, [turns, streaming, open]);

  /* 질문은 입력칸에서도 오고 추천 칩에서도 옵니다. 칩 쪽에 setQ→submit을 태우면
     한 렌더 늦게 읽혀 빈 질문이 나가므로, 문자열을 그대로 받습니다. */
  const ask = async (raw?: string) => {
    const text = (raw ?? q).trim();
    if (!text || busy) return;
    setQ('');
    setBusy(true);

    /* 다음 질문거리. 위키가 내주는 화제가 먼저입니다 — 실제로 답이 있는 화제라
       눌렀을 때 빈손이 되지 않습니다. 조각 하나만 물어 온 질문에는 내줄 화제가
       없으므로, 그때만 예시 질문 중 아직 안 물어본 것을 씁니다. */
    const asked = [...turns.filter((t) => t.role === 'you').map((t) => t.text), text];
    const nextTips = (qq: string) => {
      const found = suggest(qq, asked);
      return found.length ? found : PROMPTS.filter((p) => !asked.includes(p)).slice(0, 3);
    };

    const id = String(Date.now());
    const patch = (fn: (v: Turn) => Partial<Turn>) =>
      setTurns((t) => t.map((v) => (v.id === id ? { ...v, ...fn(v) } : v)));
    setTurns((t) => [
      ...t,
      { role: 'you', text, id: `${id}q`, at: clock() },
      { role: 'aing', text: '', id, at: '', pending: true },
    ]);

    try {
      const full = await brain.ask(text, (piece) => patch((v) => ({ text: v.text + piece })));
      // 반환값이 언제나 최종본입니다. 스트리밍 도중 엔진이 죽으면 brain이 위키 답을 돌려주는데,
      // 그때 이미 흘러온 반토막을 남겨두면 잘린 문장이 완성된 답처럼 보입니다.
      patch(() => ({ text: full, pending: false, at: clock(), tips: nextTips(text) }));
    } catch (err) {
      patch(() => ({ text: `답을 만들지 못했습니다: ${(err as Error).message}`, pending: false, at: clock(), tips: nextTips(text) }));
    } finally {
      setBusy(false);
    }
  };

  const chips = (list: string[]) => (
    <ul className="aing__tips">
      {list.map((tip) => (
        <li key={tip}>
          <button type="button" className="aing__tip" disabled={busy} onClick={() => void ask(tip)}>
            {tip}
          </button>
        </li>
      ))}
    </ul>
  );

  // 시각(clock)은 서버에 없지만, 이 컴포넌트는 WorldShell이 ssr:false로 싣습니다 —
  // 서버에서 그려지는 일이 없으므로 하이드레이션이 어긋날 자리도 없습니다.
  const note = engineNote(brain);

  return (
    <>
      {open && (
        <section className="aing" role="dialog" aria-label="아잉에게 물어보기">
          <header className="aing__head">
            <h2 className="aing__title">ai-ng에게 물어보기</h2>
            <button
              type="button"
              className={`aing__icon${pinned ? ' is-on' : ''}`}
              onClick={() => setPinned((v) => !v)}
              aria-pressed={pinned}
              aria-label={pinned ? '고정 풀기' : '창 고정하기'}
              title={pinned ? '고정 풀기' : '창 고정하기'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 3h6l-1 6 4 4H6l4-4-1-6Z" />
                <path d="M12 13v8" />
              </svg>
            </button>
            <button type="button" className="aing__icon" onClick={shrink} aria-label="창 접기" title="창 접기">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 13h12" /></svg>
            </button>
          </header>

          {/* 763MB를 받는 동안에는 그 사실이 보여야 합니다. 다 받으면 줄째로 사라집니다. */}
          {note && (
            <p className="aing__note">
              <span className="aing__bar" style={{ ['--p' as string]: brain.status === 'loading' ? brain.progress : 1 }} />
              {note}
              {brain.status === 'error' && (
                <button type="button" className="aing__retry" onClick={brain.retryModel}>다시 시도</button>
              )}
            </p>
          )}

          {/* aria-busy: 답이 흐르는 동안 스크린리더가 매 토큰마다 처음부터 다시 읽지 않고,
              끝난 뒤에 한 번 읽습니다. */}
          <div className="aing__log" ref={logRef} role="log" aria-live="polite" aria-busy={!!streaming}>
            <div className="aing__row">
              <img className="aing__face" src="/mascot/face.webp" alt="" width={30} height={30} />
              <div className="aing__side">
                <p className="aing__bubble aing__bubble--hello">{HELLO}</p>
              </div>
            </div>
            {turns.length === 0 && chips(OPENERS)}

            {turns.map((t, i) => {
              if (t.role === 'you') {
                return (
                  <div className="aing__row aing__row--you" key={t.id}>
                    <p className="aing__bubble aing__bubble--you">{t.text}</p>
                    <time className="aing__at">{t.at}</time>
                  </div>
                );
              }
              /* 흐르는 중에만 다듬습니다. 모델이 사고 과정이나 "### 요약"을 먼저 뱉는 순간
                 그게 그대로 화면에 흐르므로 실시간으로 걷어내야 하지만, 끝난 답은 brain이
                 이미 다듬어 저장한 것이라 다시 통과시켜도 같은 글자입니다. */
              const body = t.pending ? polish(t.text) : t.text;
              /* 추천은 마지막 답 아래에만 답니다. 모든 답마다 달면 로그가 칩 밭이 되고,
                 지난 답 밑의 칩은 이미 지나간 갈림길이라 누를 이유도 없습니다. */
              const tips = i === turns.length - 1 && !t.pending ? t.tips : undefined;
              return (
                <div key={t.id}>
                  <div className="aing__row">
                    <img
                      className="aing__face"
                      src={t.pending ? '/mascot/face-think.webp' : '/mascot/face.webp'}
                      alt=""
                      width={30}
                      height={30}
                    />
                    <div className="aing__side">
                      <div className="aing__bubble">
                        {body
                          ? <Markdown text={body} />
                          : <span className="aing__dots" aria-label="생각 중"><i /><i /><i /></span>}
                      </div>
                      {t.at && <time className="aing__at">{t.at}</time>}
                    </div>
                  </div>
                  {tips && tips.length > 0 && chips(tips)}
                </div>
              );
            })}
          </div>

          <form className="aing__form" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
            <input
              ref={inputRef}
              className="aing__input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={warm}
              placeholder="질문을 입력하세요"
              aria-label="질문"
            />
            <button type="submit" className="aing__send" disabled={!q.trim() || busy} aria-label="보내기">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 11.2 21 3l-8.2 18-2.3-7.5-7.5-2.3Z" />
                <path d="m10.5 13.5 5-5" />
              </svg>
            </button>
          </form>
        </section>
      )}

      <div className="aing-call" data-open={open || undefined}>
        <span className="aing-call__label" aria-hidden="true">
          ai-ng에게
          <br />
          물어보기
          <svg className="aing-call__arrow" viewBox="0 0 40 30" aria-hidden="true">
            <path d="M2 6c14-6 26-1 31 12" />
            <path d="m27 20 6 0 -1-7" />
          </svg>
        </span>
        <button
          type="button"
          className="aing-call__btn"
          ref={launchRef}
          onClick={() => (open ? shrink() : grow())}
          aria-expanded={open}
          aria-label={open ? '아잉 창 접기' : '아잉에게 물어보기'}
        >
          <img src={busy ? '/mascot/face-think.webp' : '/mascot/stand.webp'} alt="" width={52} height={52} />
        </button>
      </div>
    </>
  );
}
