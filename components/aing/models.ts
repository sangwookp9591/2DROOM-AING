/* 브라우저에서 돌릴 모델. 워커와 UI가 같은 표를 보므로 용량 표기가 실제와 어긋날 수 없습니다.
   sizeMB는 HF 저장소의 실제 q4f16 파일 크기입니다(측정값, 어림값 아님).

   ── 기본이 왜 Gemma 3 1B인가 ─────────────────────────────────────────
   한동안 Qwen3 0.6B였습니다. "주어진 문단을 두어 문장으로 줄이는 일에 파라미터가 더
   필요하지 않다"는 계산이었는데, 실제 답이 그 계산을 뒤집었습니다 — 주어를 빠뜨리고
   ("Next.js 16와 React 19을 사용하고"), 목록의 앞 몇 개만 옮기고, 한자를 섞었습니다
   ("모두集成했습니다"). 한국어 생성에서 0.6B는 요약이 아니라 문장 만들기부터 버거웠습니다.

   그래서 Qwen3 1.7B로 올려 봤더니 브라우저에서 아예 안 올라옵니다 —
   "Can't create a session. ERROR_CODE: 6, std::bad_alloc". onnxruntime-web의 WASM 힙은
   32비트라, 1.4GB 가중치에 실행 작업공간까지 얹으면 세션 생성에서 죽습니다. 방문자 입장에서는
   1.4GB를 다 받고 나서 실패하는 것이라 0.6B보다 나쁩니다.

   Gemma 3 1B은 그 사이입니다. 763MB로 1.7B의 절반이라 세션이 뜨고, 파라미터는 0.6B의
   1.7배입니다. 코드 경로도 그대로입니다 — 텍스트 전용 causal-LM이고, 챗 템플릿이 system을
   첫 user 턴에 접어 넣어 주므로 brain.ts의 SYSTEM()을 고칠 것이 없습니다.
   (Gemma 4 E2B는 후보가 아닙니다: 멀티모달이라 AutoProcessor 경로가 따로 필요하고,
   ONNX q4f16이 디코더 1,520MB + 임베딩 1,591MB = 3.1GB입니다. qat-mobile q2f16도 2.3GB.) */
import type { DataType } from '@huggingface/transformers';

export type ModelSpec = {
  id: string;
  label: string;
  sizeMB: number;
  dtype: DataType;
  noThinking?: boolean;
  /** 샘플링. 계열마다 모델 카드가 지정하는 값이 달라서 워커에 박아 두지 않고 여기 둡니다.
      온도만 카드보다 낮춥니다 — 여기서 모델이 하는 일은 글짓기가 아니라 주어진 문단을
      두어 문장으로 줄이는 것이고, 온도가 높으면 자료에 없는 말이 섞여 나옵니다. */
  sampling: { temperature: number; top_p: number; top_k: number };
};

export const MODELS: ModelSpec[] = [
  {
    id: 'onnx-community/gemma-3-1b-it-ONNX',
    label: 'Gemma 3 1B',
    sizeMB: 763,
    dtype: 'q4f16',
    // Gemma 3 모델 카드 기준(top_k 64 · top_p 0.95). 사고 과정 모드가 없어 noThinking은 없습니다.
    sampling: { temperature: 0.4, top_p: 0.95, top_k: 64 },
  },
  {
    id: 'onnx-community/Qwen3-0.6B-ONNX',
    label: 'Qwen3 0.6B',
    sizeMB: 570,
    dtype: 'q4f16',
    // Qwen3는 기본으로 사고 과정을 뱉습니다. 이력 문답에는 필요 없고 첫 글자까지가 훨씬 빨라집니다.
    noThinking: true,
    // Qwen3 모델 카드의 non-thinking 값(top_p 0.8 · top_k 20). greedy는 카드가 말립니다.
    sampling: { temperature: 0.35, top_p: 0.8, top_k: 20 },
  },
  {
    id: 'onnx-community/Qwen3-1.7B-ONNX',
    label: 'Qwen3 1.7B',
    sizeMB: 1426,
    dtype: 'q4f16',
    noThinking: true,
    sampling: { temperature: 0.35, top_p: 0.8, top_k: 20 },
  },
];

/* 표의 첫 줄이 기본입니다. 나머지 둘은 지워도 되지만 남겨 둡니다 — 0.6B는 느린 회선에서
   되돌릴 자리이고, 1.7B는 "왜 더 큰 걸 안 쓰나"에 대한 답이 코드에 남아 있어야 해서입니다. */
export const DEFAULT_MODEL = MODELS[0];

/** 모르는 id는 기본 모델로 눕힙니다. 고르는 UI가 없으므로 여기 오는 id는 언제나
    이 표 안의 것이거나, 워커가 load 없이 받은 undefined입니다. */
export const byId = (id?: string): ModelSpec => MODELS.find((m) => m.id === id) ?? DEFAULT_MODEL;
