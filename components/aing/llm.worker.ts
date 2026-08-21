/* 언어 모델을 브라우저 안에서 돌립니다. 서버로 아무것도 보내지 않습니다.
   메인 스레드에서 돌리면 생성 한 번에 UI가 통째로 멈추므로 워커에 가둡니다.

   기본은 Gemma 3 1B q4f16 (약 763MB). 두 번째 방문부터는 브라우저 캐시에서 바로 올라옵니다.
   모델 목록과 용량은 models.js 한 곳에 있습니다. */
import { AutoTokenizer, AutoModelForCausalLM, TextStreamer } from '@huggingface/transformers';
import type { PreTrainedModel, PreTrainedTokenizer, ProgressInfo, Tensor } from '@huggingface/transformers';
import { DEFAULT_MODEL, byId } from './models';

/* 메인 스레드(brain.ts)와 주고받는 계약. 양쪽이 이 한 곳을 봅니다.
   load에는 id가 없습니다 — 그래서 실패 보고의 id도 비어 있을 수 있습니다(아래 catch). */
export type WorkerRequest =
  | { type: 'load'; model: string; id?: undefined }
  | { type: 'ask'; id: string; system: string; question: string };

export type WorkerResponse =
  | { type: 'progress'; ratio: number; mb: number }
  | { type: 'status'; status: 'loading' | 'ready' | 'error'; model?: string; message?: string }
  | { type: 'token'; id: string; text: string }
  // capped: 예산(max_new_tokens)이 끊었다는 표시. 받는 쪽이 마지막 반 문장을 떼는 근거입니다.
  | { type: 'done'; id: string; capped: boolean }
  | { type: 'error'; id?: string; message: string };

// 전역 postMessage는 lib.dom의 Window 오버로드로 잡혀 payload를 들여다보지 않습니다.
// 계약을 한 번 통과시켜 워커가 보내는 모양을 고정합니다.
const post = (msg: WorkerResponse) => postMessage(msg);

/* 답 하나에 쓸 토큰 상한. 여기서 멎으면 문장 한가운데서 끊기므로 done에 그 사실을 실어 보냅니다.
   상한 자체를 늘리는 건 답이 아닙니다 — 길어질 뿐 끊기는 자리만 뒤로 밀립니다. */
const MAX_NEW_TOKENS = 320;

let tokenizer: PreTrainedTokenizer | null = null;
let model: PreTrainedModel | null = null;
let spec = DEFAULT_MODEL;
let loading: Promise<void> | null = null;

// 파일별 진행률을 합산합니다 — 파일 하나가 끝날 때마다 0%로 되돌아가면 진행 중인지 알 수 없습니다.
const files = new Map<string, { loaded: number; total: number }>();
const reportProgress = () => {
  let loaded = 0, total = 0;
  for (const f of files.values()) { loaded += f.loaded; total += f.total; }
  /* 분모는 지금까지 본 파일이 아니라 모델 전체 크기입니다. 설정·토크나이저 같은 작은 파일이
     먼저 끝나면 합계가 잠깐 100%가 되고, 그다음 1.4GB 가중치가 등록되는 순간 44%로
     되돌아갑니다 — 다 받은 줄 알고 물어보려던 사람에게는 진행바가 고장 난 것으로 보입니다.
     models.ts의 sizeMB가 실측값이라 처음부터 맞는 분모를 쓸 수 있습니다. */
  total = Math.max(total, spec.sizeMB * 1e6);
  if (total > 0) post({ type: 'progress', ratio: Math.min(1, loaded / total), mb: Math.round(loaded / 1e6) });
};

function load(id: string) {
  if (loading) return loading;
  spec = byId(id);
  files.clear();
  loading = (async () => {
    post({ type: 'status', status: 'loading', model: spec.id });
    tokenizer = await AutoTokenizer.from_pretrained(spec.id);
    model = await AutoModelForCausalLM.from_pretrained(spec.id, {
      dtype: spec.dtype,
      device: 'webgpu',
      progress_callback: (info: ProgressInfo) => {
        if (info.status === 'progress' && info.total) {
          files.set(info.file, { loaded: info.loaded ?? 0, total: info.total });
          reportProgress();
        }
      },
    });
    post({ type: 'status', status: 'ready', model: spec.id });
  })().catch((err: unknown) => {
    loading = null;
    post({ type: 'status', status: 'error', message: String((err as Error)?.message || err) });
    throw err;
  });
  return loading;
}

async function ask({ id, system, question }: Extract<WorkerRequest, { type: 'ask' }>) {
  // load 없이 ask가 오면 byId(undefined)가 기본 모델을 집어, 방문자가 허락하지도 않은
  // 모델을 받고 spec(=enable_thinking)도 그 세션과 어긋납니다. 조용히 고르지 않습니다.
  if (!loading) throw new Error('모델이 아직 올라오지 않았습니다');
  await loading;
  // enable_thinking은 템플릿으로 그대로 넘어가는 값인데 d.ts의 옵션 목록에는 없습니다.
  // 리터럴로 바로 넘기면 초과 속성으로 막히므로 변수를 거칩니다(넘기는 값은 그대로).
  const chatOptions = { tokenize: false as const, add_generation_prompt: true, enable_thinking: !spec.noThinking };
  const text = tokenizer!.apply_chat_template(
    [
      { role: 'system', content: system },
      { role: 'user', content: question },
    ],
    chatOptions
  );
  const inputs = await tokenizer!(text, { add_special_tokens: false });

  const streamer = new TextStreamer(tokenizer!, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (piece: string) => post({ type: 'token', id, text: piece }),
  });

  /* greedy(do_sample:false)로 두면 안 됩니다 — Qwen3 모델 카드가 명시적으로 말리는 설정이고,
     실제로 0.6B가 <자료>를 통째로 베껴 상한까지 흘리다 문장 한가운데서 끊겼습니다.
     구체적인 값은 계열마다 다르므로 models.ts의 표에서 가져옵니다. */
  const seq = await model!.generate({
    ...inputs,
    max_new_tokens: MAX_NEW_TOKENS,
    do_sample: true,
    ...spec.sampling,
    streamer,
  }) as Tensor;
  // 돌아오는 건 프롬프트까지 담은 한 줄이라, 길이 차가 곧 새로 만든 토큰 수입니다.
  const made = seq.dims[1] - inputs.input_ids.dims[1];
  post({ type: 'done', id, capped: made >= MAX_NEW_TOKENS });
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === 'load') await load(msg.model);
    else if (msg.type === 'ask') await ask(msg);
  } catch (err) {
    post({ type: 'error', id: msg.id, message: String((err as Error)?.message || err) });
  }
};
