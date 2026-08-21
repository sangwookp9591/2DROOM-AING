/* 답을 만드는 쪽. 세 갈래가 있고 위에서부터 되는 것을 씁니다.

   1) ollama — 이 컴퓨터에서 Ollama가 돌고 있으면 그쪽에 물어봅니다 (내려받을 게 없음)
   2) local  — 브라우저 안에서 WebGPU로 소형 모델을 돌립니다 (물어볼 뜻을 보일 때, 최초 1회 763MB)
   3) wiki   — 모델이 없거나 WebGPU가 없으면 위키에서 질문에 걸린 구간만 골라 답합니다

   어느 쪽이든 근거는 같은 위키이고, 질문은 밖으로 나가지 않습니다. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { retrieve } from '@/lib/wiki';
import { compose, polish, trimDangling, NO_MATCH } from '@/lib/answer';
import { DEFAULT_MODEL, byId } from './models';
import type { WorkerRequest, WorkerResponse } from './llm.worker';

type Engine = 'wiki' | 'ollama' | 'local';
type Status = 'idle' | 'loading' | 'ready' | 'error';

/** 답을 기다리는 질문 하나. 워커 메시지가 오면 여기로 흘러갑니다. */
type PendingAsk = {
  token(text: string): void;
  // capped: 예산이 끊었다는 표시. 그때만 마지막 반 문장을 뗍니다.
  done(capped: boolean): void;
  fail(message: string): void;
};

// 모델이 죽어도(WebGPU OOM, 탭 스로틀링, 디바이스 로스트) 워커는 아무 메시지도 안 보냅니다.
// 그대로 두면 busy가 안 풀려 입력창이 새로고침 전까지 잠깁니다.
const ASK_TIMEOUT_MS = 120_000;

const OLLAMA = 'http://localhost:11434';

/* 답의 말투를 정하는 곳. 순서가 중요합니다 — 자료가 먼저, 시킬 일이 마지막입니다.

   인칭은 지시로 못 잡습니다. "본인이 아니므로 3인칭으로"를 못 박아도 Gemma 3 1B는
   "안녕하세요. 저는 박상욱입니다."로 시작했습니다. 1B가 지키지 못할 규칙을 프롬프트에
   쌓으면 지킬 수 있는 규칙(분량·라벨 금지·숫자)까지 같이 흐려집니다. 그래서 인칭은
   놓아두고, 인사와 자기소개는 answer.polish가 결정적으로 떼어 냅니다.

   예전에는 "말투 — 아는 사람에게 설명하듯 편하고 담백하게." 같은 줄을 자료 위에 다섯 줄
   깔았습니다. 0.6B는 그걸 지시가 아니라 이어 쓸 글로 읽었습니다. "상욱은요?"에 돌아온 답이
   통째로 "아는 사람에게 설명하듯 편하고 담백하게 말합니다." 한 줄이었습니다 — 규칙을
   문장으로 완성해 놓고 끝낸 것입니다.

   그래서 규칙은 한 문단으로 줄이고 질문 바로 앞에 둡니다. 작은 모델은 마지막에 읽은 것을
   따르고, 대시로 라벨을 단 줄은 지시보다 본문처럼 보입니다. 남은 습관은 answer.polish가 걷어냅니다. */
const SYSTEM = (ctx: string) => `<자료>
${ctx}
</자료>

너는 개발자 박상욱(iron, 아이언, 상욱)의 이력을 소개하는 안내자다. 인사말이나 자기소개로 시작하지 말고 곧바로 답부터 말한다.
위 <자료>에 적힌 내용만 근거로 질문에 한국어로 답한다. 아는 사람에게 설명하듯 2~4문장으로 짧게 말한다. 제목, "핵심 역량" 같은 라벨, 목록은 쓰지 않고 문장으로만 말한다.
숫자는 자료에 있는 그대로만 쓰고, 자료에 없는 것은 지어내지 말고 "그건 위키에 없습니다"라고 답한다.`;

/** Ollama가 이 컴퓨터에서 돌고 있는지.
    https로 배포된 사이트에서는 어차피 mixed content로 막히고, 시도 자체가 콘솔에
    빨간 줄을 남기므로(네트워크 오류는 catch해도 로그가 남습니다) 로컬에서만 두드립니다. */
async function findOllama() {
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return null;
  try {
    const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(900) });
    if (!r.ok) return null;
    const { models = [] } = (await r.json()) as { models?: { name: string }[] };
    const names = models.map((m) => m.name);
    // gemma가 있으면 gemma로 — 이 페이지가 오래 약속해 온 모델이기 때문입니다.
    return names.find((n) => n.startsWith('gemma')) ?? names[0] ?? null;
  } catch {
    return null;
  }
}

async function askOllama(
  model: string,
  system: string,
  question: string,
  onToken: (piece: string) => void,
  signal: AbortSignal,
) {
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: true,
      options: { temperature: 0.2, num_predict: 320 },
      messages: [{ role: 'system', content: system }, { role: 'user', content: question }],
    }),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status}`);
  const reader = r.body!.getReader();
  const dec = new TextDecoder();
  let buf = '', out = '';
  let capped = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    // NDJSON — 줄 하나가 곧 토큰 한 덩어리입니다. 마지막 조각은 다음 청크에 이어 붙입니다.
    const lines = buf.split('\n');
    buf = lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      const ev = JSON.parse(line) as { message?: { content?: string }; done_reason?: string };
      const piece = ev.message?.content;
      if (piece) { out += piece; onToken(piece); }
      // 마지막 줄에만 실려 옵니다. 'length'는 num_predict가 끊었다는 뜻입니다.
      if (ev.done_reason === 'length') capped = true;
    }
  }
  return { text: out, capped };
}

/** 이 방문자에게 763MB를 받자고 해도 되는가. */
function mayDownload() {
  // 세션은 파일을 다 받은 뒤에야 만들어집니다. 가드가 없으면 실행할 수도 없는 모델을
  // 끝까지 받고 나서 죽습니다.
  if (!navigator.gpu) return false;
  // 아끼겠다고 말한 방문자에게는 묻지 않고 아낍니다. 데이터 세이버, 느린 회선,
  // 그리고 CSS 쪽의 같은 뜻(prefers-reduced-data) 셋 다 봅니다.
  const net = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (net?.saveData) return false;
  if (net?.effectiveType && /^(slow-2g|2g|3g)$/.test(net.effectiveType)) return false;
  if (matchMedia('(prefers-reduced-data: reduce)').matches) return false;
  return true;
}

export default function useOracleBrain() {
  const [engine, setEngine] = useState<Engine>('wiki');   // wiki | ollama | local
  const [status, setStatus] = useState<Status>('idle');   // idle | loading | ready | error
  const [progress, setProgress] = useState(0);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const ollamaRef = useRef<string | null>(null);
  const probe = useRef<Promise<void> | null>(null);   // Ollama 탐지가 끝났는지
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<string, PendingAsk>());

  const spawn = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.type === 'progress') setProgress(data.ratio);
      else if (data.type === 'status') {
        // 실패 이유는 여기에만 실려 옵니다. 안 남기면 헤더의 "못 올렸습니다" 말고는
        // 왜 못 올렸는지 알 방법이 없습니다(온디바이스라 서버 로그도 없습니다).
        if (data.status === 'error') console.error('[아잉] 모델', data.message);
        setStatus(data.status);
        if (data.model) setModel(byId(data.model));
        if (data.status === 'ready') { setEngine('local'); setProgress(1); }
      } else if (data.type === 'token') pending.current.get(data.id)?.token(data.text);
      else if (data.type === 'done') { pending.current.get(data.id)?.done(data.capped); pending.current.delete(data.id); }
      // load가 실패하면 id 없는 error가 옵니다 — 그땐 get(undefined)이 빈손으로 돌아오고
      // 아래 onerror가 대신 깨웁니다. 타입만 좁히고 흐름은 그대로 둡니다.
      else if (data.type === 'error') { pending.current.get(data.id!)?.fail(data.message); pending.current.delete(data.id!); }
    };
    // 워커가 아예 안 뜨면(모듈 워커 미지원, 청크 404) onmessage는 영영 안 옵니다.
    // 잡아두지 않으면 헤더가 '내려받는 중 0%'에 붙박입니다. 그리고 답을 기다리던 질문들도
    // 여기서 같이 깨워야 합니다 — 안 그러면 입력창이 잠긴 채 남습니다.
    w.onerror = (e) => {
      console.error('[아잉] 워커', e.message || e);
      setStatus('error');
      for (const [id, p] of pending.current) { p.fail('워커가 죽었습니다'); pending.current.delete(id); }
    };
    workerRef.current = w;
    return w;
  }, []);

  const enableModel = useCallback((id: string) => {
    const spec = byId(id);
    setModel(spec);
    setStatus('loading');
    setProgress(0);
    spawn().postMessage({ type: 'load', model: spec.id } satisfies WorkerRequest);
  }, [spawn]);

  /* Ollama가 이 컴퓨터에 있으면 내려받을 것이 없습니다. 탐지는 비동기라서 마운트 시점에
     ollamaRef를 읽으면 언제나 비어 있고, 그대로 두면 Ollama가 도는 컴퓨터에서도
     방문자가 수백 MB를 다시 받습니다 — 그러고는 쓰지도 않습니다. */
  useEffect(() => {
    let dead = false;
    probe.current = findOllama().then((m) => {
      if (dead || !m) return;
      ollamaRef.current = m;
      setEngine('ollama');
      setStatus('ready');
    }).catch((err) => console.warn('[아잉] 엔진 탐지 실패:', err));
    return () => { dead = true; };
  }, []);

  /* 방문자가 물어볼 뜻을 보였을 때 받기 시작합니다.

     예전에는 진입 즉시 받았습니다. 버튼을 하나 없앤다고 기다림이 줄지 않는다는 이유였는데,
     그건 창을 여는 사람 기준의 계산이었습니다. 대다수 방문자는 이력서만 읽고 나가고,
     그 사람들에게 763MB는 통째로 낭비입니다 — 모바일 데이터라면 낭비가 아니라 피해입니다.
     지금은 창을 열거나 입력칸에 손을 댈 때 시작합니다. 그 사이의 질문은 위키가 바로
     답하므로(brain.ask의 폴백) 기다리는 시간이 생기지도 않습니다. */
  const warm = useCallback(() => {
    // 탐지가 끝나기를 기다렸다가 정합니다(최대 900ms). 안 기다리면 Ollama가 도는
    // 컴퓨터에서 바로 창을 연 사람이 763MB를 받아 놓고 쓰지도 않습니다.
    void (probe.current ?? Promise.resolve()).then(() => {
      if (ollamaRef.current || workerRef.current || !mayDownload()) return;
      enableModel(DEFAULT_MODEL.id);
    });
  }, [enableModel]);

  // 실패했으면 워커를 버리고 다시 시도할 수 있게 합니다 — 안 그러면 localStorage를
  // 직접 지우는 것 말고는 되살릴 방법이 없습니다.
  const retryModel = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    pending.current.clear();
    enableModel(model.id);
  }, [enableModel, model]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  /** 질문 하나. onToken이 오면 스트리밍, 반환값은 언제나 최종본입니다. */
  const ask = useCallback(async (question: string, onToken: (piece: string) => void = () => {}) => {
    const hits = retrieve(question, 3);
    if (!hits.length) return NO_MATCH;   // 위키와 무관한 질문은 모델을 깨울 것도 없습니다
    /* 모델에게는 1순위 조각만 넘깁니다. 셋을 다 넘겼더니 0.6B가 셋을 섞었습니다 —
       "어떤 기술 스택을 쓰나요"에 스택 조각(Next.js·Spring Boot…)을 제대로 1순위로
       찾아 놓고, 답에는 2·3순위에서 끌어온 "어드민 워크스페이스", "Redis 격리"를
       늘어놨습니다. 세 조각이면 한국어 1,000토큰이 넘어가고, 그 길이에서 이 크기의
       모델은 무엇이 질문에 걸린 조각인지를 잃습니다. 검색은 그대로 셋을 뽑습니다 —
       위키 폴백(compose)이 2순위를 '이어서 볼 이야기'로 쓰기 때문입니다.

       제목은 넘기지 않습니다. `[종합 프로필]`을 머리에 달아 줬더니 Gemma가 그걸 본문의
       사실로 읽고 "상욱은 종합 프로필의 리드 개발자입니다"라고 답했습니다. 조각이 하나뿐이라
       제목이 구분해 줄 것도 없습니다. */
    const ctx = hits[0].text;
    /* 모델이 없거나 답하지 못했을 때의 답. 조각을 통째로 인용하지 않고 질문에 걸린 문장만
       골라 엮습니다 — 이 경로로 답을 받는 방문자가 오히려 더 많기 때문입니다(WebGPU 없는 브라우저). */
    const fromWiki = () => compose(question, hits);
    /* 이미 답의 꼴인 조각은 모델을 거치지 않습니다. 나열을 문장으로 바꿔 봐야 좋아지지
       않고, 0.6B는 목록의 앞 몇 개만 옮기고 나머지를 버립니다 — "어떤 스택 쓰나요"에
       Spring Boot도 Java도 빠진 답이 나갔습니다. */
    if (hits[0].verbatim) return fromWiki();
    /* 모델은 제목·라벨·되풀이를 습관처럼 답니다. 화면에 닿기 전에 여기서 한 번 걷어냅니다.
       예산이 끊은 답은 그 위에 마지막 반 문장까지 뗍니다 — 스트리밍 중에는 못 하는 일입니다.
       매 토큰마다 하면 방금 도착한 문장이 계속 지워졌다 나타납니다. */
    const say = (out: string, capped = false) => {
      const clean = polish(out);
      return (capped ? trimDangling(clean) : clean) || fromWiki();
    };

    try {
      if (ollamaRef.current) {
        // 로컬 모델이 멎으면(런너 세그폴트 등) 읽기가 영영 안 끝나서 입력창이 잠깁니다.
        const out = await askOllama(ollamaRef.current, SYSTEM(ctx), question, onToken,
          AbortSignal.timeout(60_000));
        return say(out.text, out.capped);
      }
      if (workerRef.current && status === 'ready') {
        const id = String(Date.now());
        let out = '';
        return await new Promise<string>((resolve, reject) => {
          /* 워커가 죽으면(WebGPU OOM, 탭 스로틀링, 디바이스 로스트) done도 error도 안 옵니다.
             타임아웃이 없으면 이 프라미스가 영영 안 풀리고, Oracle의 finally가 못 돌아
             busy가 true로 굳어 입력창이 새로고침 전까지 잠깁니다. Ollama 쪽에는 이미
             같은 이유로 60초 타임아웃이 걸려 있는데, 정작 방문자에게 나가는 건 이쪽입니다. */
          const timer = setTimeout(() => {
            pending.current.delete(id);
            reject(new Error('모델이 시간 안에 답하지 못했습니다'));
          }, ASK_TIMEOUT_MS);
          const settle = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
            clearTimeout(timer); pending.current.delete(id); fn(...args);
          };
          pending.current.set(id, {
            token: (t) => { out += t; onToken(t); },
            done: settle((capped: boolean) => resolve(say(out, capped))),
            fail: settle((m: string) => reject(new Error(m))),
          });
          workerRef.current!.postMessage({ type: 'ask', id, system: SYSTEM(ctx), question } satisfies WorkerRequest);
        });
      }
    } catch (e) {
      console.warn('[아잉] 모델이 답하지 못해 위키로 넘어갑니다:', (e as Error).message);
    }
    return fromWiki();
  }, [status]);

  return {
    engine,
    status,
    progress,
    model,
    warm,
    retryModel,
    ask,
  };
}
