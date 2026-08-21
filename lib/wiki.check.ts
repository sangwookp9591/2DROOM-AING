// node --experimental-strip-types lib/wiki.check.ts — 검색이 엉뚱한 조각을 1순위로 올리면 실패합니다.
import assert from 'node:assert/strict';
import { WIKI, STOP, retrieve } from './wiki.ts';
import { wikiAnswer, polish, sentences, trimDangling } from './answer.ts';

/* 통과한 검사 수는 세어서 냅니다. 손으로 더하던 식은 항이 열한 개까지 늘면서 틀렸습니다 —
   SHAPE 블록 안의 문장별 반복을 빼먹어 실제 125건을 120건이라고 적고 있었습니다.
   이 숫자는 하네스가 스스로에 대해 말하는 유일한 값이라, 틀리면 없느니만 못합니다. */
let CHECKS = 0;
// 메시지에 기본값을 두는 이유는 node:assert의 오버로드가 undefined를 안 받기 때문입니다.
const ok = (cond: unknown, msg = '검사 실패') => { CHECKS++; assert.ok(cond, msg); };
const eq = (a: unknown, b: unknown, msg = '값이 다릅니다') => { CHECKS++; assert.equal(a, b, msg); };
const match = (v: string, re: RegExp, msg = '패턴에 안 맞습니다') => { CHECKS++; assert.match(v, re, msg); };
const noMatch = (v: string, re: RegExp, msg = '있으면 안 되는 패턴입니다') => { CHECKS++; assert.doesNotMatch(v, re, msg); };

// 답이 하나로 정해지지 않는 질문이 있어서 기대값은 문자열이거나 후보 목록입니다.
const CASES: [string, string | string[]][] = [
  // 개요
  ['iron은 누구야?', 'who'],
  ['어떤 개발자인가요', 'who'],
  ['상욱씨 강점', 'who'],
  ['Codex는 상욱을 어떻게 평가해?', 'codex-review'],
  ['Claude가 본 기술적 특징', 'claude-review'],
  ['Claude가 지적한 리스크', 'claude-risk'],
  ['커밋 몇 개나 했어', 'repos'],
  ['저장소별 기여도', 'repos'],
  // 프론트
  ['프론트엔드 경험', 'front'],
  ['14개 언어', 'front'],
  ['vanilla-extract 왜 썼어', 'front'],
  ['결제는 어떻게 처리했어', 'payment'],
  ['결제 실패하면 어떻게 돼', 'payment'],
  ['E2E 테스트 플레이크', 'test'],
  ['플레이크를 어떻게 0으로 만들었나요', 'test'],
  // 어드민
  ['권한 시스템 어떻게 설계했나요', 'perm'],
  ['공통 인프라랑 팀 규약', 'infra'],
  ['FSD 전환', 'infra'],
  // 백엔드
  ['iron이 백엔드에서 한 일', 'back'],
  ['검색 성능 개선', 'search'],
  ['OpenSearch', 'search'],
  ['LLM 장애 대응', 'ai'],
  ['서킷브레이커 몇 군데', 'ai'],
  ['Outbox 패턴', 'coupon'],
  ['ArchUnit 어디에 썼어', 'coupon'],
  ['장바구니 복구', 'cart'],
  ['머천다이징 진열', 'merch'],
  ['멀티모듈 전환', 'modules'],
  ['자바 21 올렸어?', 'modules'],
  ['번역 어떻게 했어', 'i18n'],
  ['프로모션 발송', 'promotion'],
  ['물류 OCR', 'carry'],
  ['레디스 장애', 'ops'],
  ['배포는 어떻게 해', 'ops'],
  ['팀에 뭘 남겼어', 'team'],
  ['PR 자동 리뷰', 'team'],
  ['AI 어떻게 쓰나요', 'aiwork'],
  // 공유 기록. '팀' 계열 질문은 team과 sharing 어느 쪽이 1등이어도 맞습니다 —
  // 하나는 팀에 남긴 도구, 하나는 팀에 나눈 정보라 둘 다 답이 됩니다.
  ['팀에 뭘 공유했어', ['team', 'sharing']],
  ['지식 공유', ['sharing', 'team']],
  ['토큰 절약', 'sharing'],
  ['얼리어답터', 'sharing'],
  // 그 외
  ['일하는 방식', 'principles'],
  ['기술 스택', 'stack'],
  ['이 사이트 어떻게 만들었어', 'site'],
  ['캐릭터는 직접 만들었나요', 'aingkit'],
  ['아잉이 뭐예요', 'aingkit'],
  ['연락처', 'contact'],
  ['RAG 해봤어?', 'caution'],
  ['쿠폰 왜 새로 만들었어', 'coupon'],
  // 서술어("설계했어")가 주제어("쿠폰")를 이기면 안 된다
  ['쿠폰은 왜 새로 설계했어?', 'coupon'],
  ['권한은 어떻게 설계했어', 'perm'],
  ['결제 실패 설계', 'payment'],
  // 개요는 세부가 있으면 양보하되, 개요 자체를 물으면 개요가 나와야 한다
  ['백엔드에서 뭐 했어', 'back'],
  ['백엔드 경험 알려줘', 'back'],
  // 기술명을 한글로 물어도 걸려야 한다
  ['스프링부트 써봤어', 'back'],
  ['리액트 쓸 줄 알아', 'stack'],
];

for (const [q, want] of CASES) {
  const got = retrieve(q).map((w) => w.id);
  ok([want].flat().includes(got[0]), `"${q}" → ${got.join(',')} (기대: ${want})`);
}

// 세부 조각이 상위 3개 안에는 반드시 들어와야 합니다 — LLM이 받는 근거가 그 3개입니다.
for (const [q, want] of [['쿠폰 정합성', 'coupon'], ['재색인 느려', 'search'], ['권한 누락', 'perm']]) {
  ok(retrieve(q, 3).some((w) => w.id === want), `"${q}"의 근거에 ${want}가 없습니다`);
}

/* STOP에 넣은 말이 어느 조각의 태그에도 없어야 합니다.
   STOP은 질의만이 아니라 색인에도 걸리므로, 태그에 있는 말을 STOP에 넣으면 그 태그가
   통째로 사라집니다. 실제로 '방식'을 넣어 '일하는 방식 세 가지' 조각을 자기 태그로
   못 찾게 만든 적이 있는데, 그때도 아래 질의 케이스는 전부 통과했습니다.
   케이스를 늘리는 것으로는 이걸 못 잡습니다 — 겹침 자체를 금지해야 잡힙니다. */
const tagWords = new Set(
  WIKI.flatMap((w) => w.tags.toLowerCase().split(/[^a-z0-9가-힣]+/).filter((t) => t.length > 1))
);
for (const s of STOP) {
  ok(!tagWords.has(s), `STOP의 "${s}"가 어느 조각의 태그에 있습니다 — 그 태그는 검색되지 않습니다`);
}

/* 태그로 자기 조각을 부를 수 있어야 합니다. 위 겹침 검사가 STOP 쪽을 막는다면
   이쪽은 반대편 — 조각이 늘면서 다른 조각에 밀려 자기 태그로도 안 잡히는 경우를 봅니다. */
const SELF = [['일하는 방식', 'principles'], ['작업 방식', 'principles'],
  ['팀에 공유', 'team'], ['공유 기록', 'sharing'], ['최신 기술 트렌드', 'sharing'],
  ['이전 경력', 'career'], ['총 경력 몇 년', 'career'], ['예전 회사', 'career'],
  ['영상 다뤄봤어', 'media'], ['ffmpeg', 'media'], ['숏폼', 'media']];
for (const [q, want] of SELF) {
  const got = retrieve(q, 3).map((w) => w.id);
  ok(got.includes(want), `"${q}" → ${got.join(',') || '(없음)'} (근거에 ${want}가 없습니다)`);
}

/* 예전에는 '짜장면 맛집'이었는데 이력에 여기가게(숏폼 맛집 서비스)가 들어오면서
   '맛집'이 진짜로 있는 말이 됐습니다. 위키에 없는 낱말로만 물어야 하는 검사입니다. */
eq(retrieve('고양이 키우는 법').length, 0, '관련 없는 질문은 비어야 합니다');
match(wikiAnswer('고양이 키우는 법'), /안 적혀 있네요/);
match(wikiAnswer('iron 누구'), /박상욱/);

// 지어내면 안 되는 것들이 위키에 명시돼 있어야 합니다.
const caution = WIKI.find((w) => w.id === 'caution')!.text;
for (const must of ['RAG', 'pgvector', 'nicepay']) {
  ok(caution.includes(must), `사실 정확성 조각에 ${must} 언급이 없습니다`);
}

/* ── 답의 모양 ──────────────────────────────────────────────────
   위 검사들이 "무엇을 꺼냈는가"를 본다면 아래는 "어떻게 보이는가"를 봅니다.
   조각을 통째로 인용하던 시절에는 이 둘이 같았지만, 지금은 answer.ts가 사이에 있습니다. */
const flat = (s: string) => s.replace(/\s+/g, '');
const SHAPE = ['쿠폰 왜 새로 만들었어', '권한 시스템 어떻게 설계했나요', '기술 스택', '연락처', '검색 성능 개선'];
for (const q of SHAPE) {
  const a = wikiAnswer(q);
  const src = retrieve(q, 1)[0].text;
  noMatch(a, /[【】]/, `"${q}"의 답에 문서 제목표가 남아 있습니다`);
  noMatch(a, /^#{1,6}\s/m, `"${q}"의 답에 마크다운 제목이 있습니다`);
  // 조각을 통째로 옮기지 않았는지. 문장이 넷을 넘는 조각이면 실제로 줄어들어야 합니다
  // (연락처처럼 두 문장짜리 조각은 고를 것이 없으므로 그대로 나가는 게 맞습니다).
  const total = sentences(src).length;
  ok(total <= 4 || a.length < src.length,
    `"${q}"의 답이 원문(${total}문장)보다 짧지 않습니다 — 고르지 않고 통째로 옮겼습니다`);
  // 그리고 골라 온 문장은 원문에 그대로 있어야 합니다. 표현 층이 사실을 지어내면 안 됩니다.
  for (const sent of sentences(a.split('\n\n')[0])) {
    ok(flat(src).includes(flat(sent)), `"${q}"의 답에 원문에 없는 문장이 있습니다: ${sent}`);
  }
}

/* polish는 모델의 습관을 걷어냅니다. 스트리밍 도중에도 매 토큰마다 불리므로
   같은 글을 두 번 통과시켜도 결과가 변하지 않아야 합니다. */
const DIRTY: [string, RegExp][] = [
  ['<think>음, 쿠폰 얘기군.</think>쿠폰은 새 컨텍스트로 만들었습니다.', /^쿠폰은/],
  ['<think>아직 생각 중인데', /^$/],                                    // 안 닫힌 사고 블록 = 아직 할 말 없음
  ['### 요약\n권한은 훅 하나로 모았습니다.', /^권한은/],
  ['답변: 자료에 따르면 커밋은 1,512개입니다.', /^커밋은 1,512개입니다\.$/],
  ['같은 말입니다. 같은 말입니다.', /^같은 말입니다\.$/],
  ['## 배경\n\n\n\n스택은 Next.js입니다.', /^스택은/],
  // 인사로 운 떼기. 인사만 떼고 자기소개는 남깁니다 — 그게 "누구 이야기인지"를 쥐고 있습니다.
  ['안녕하세요. 저는 박상욱입니다. ZIVO의 리드입니다.', /^저는 박상욱입니다\./],
  ['안녕하세요! 커밋은 1,512개입니다.', /^커밋은/],
  ['저는 프론트엔드를 맡았습니다.', /^저는 프론트엔드를 맡았습니다\.$/],
];
for (const [dirty, want] of DIRTY) {
  const once = polish(dirty);
  match(once, want, `polish가 못 걷어냈습니다: ${dirty}`);
  eq(polish(once), once, `polish가 멱등이 아닙니다: ${dirty}`);
}
// 제목이라도 내용이 있으면 지우지 않고 굵은 줄로 낮춥니다.
eq(polish('### 쿠폰 도메인\n본문입니다.'), '**쿠폰 도메인**\n본문입니다.');

/* 울타리 안은 코드지 글이 아닙니다. 여기까지 다듬으면 `# 설치` 주석이 제목이 되고
   `---`가 지워지고 들여쓰기가 펴지는데, Markdown이 울타리 안을 그대로 그리므로
   그 손상이 그대로 화면에 나갑니다. */
const FENCED = '설명입니다.\n```bash\n# 설치\nnpm i\n---\n  }\n}\n```';
eq(polish(FENCED), FENCED, 'polish가 코드 블록 안을 건드렸습니다');
eq(polish(polish(FENCED)), FENCED);
// 울타리 밖의 목록은 중첩 들여쓰기를 잃지 않아야 합니다.
eq(polish('- 위\n  - 아래'), '- 위\n  - 아래');

/* 예산이 문장 한가운데서 끊은 답. 그대로 띄우면 모델이 말하다 만 것이 아니라
   화면이 답을 잘라먹은 것으로 보입니다 — 실제로 "…ArchUnit 강제로 세웠고,"가 나갔습니다. */
const CUT: [string, string][] = [
  ['앞 문장입니다. 뒤는 쉼표에서 끊겼고,', '앞 문장입니다.'],
  ['한 문장도 못 끝냈는데', ''],                                    // 남길 게 없으면 위키가 대신 답합니다
  ['Qwen3 0.6B를 씁니다. 그리고 여기서', 'Qwen3 0.6B를 씁니다.'],   // 0.6의 점은 문장 끝이 아닙니다
  ['- 첫 항목입니다.\n- 둘째 항목이 끊', '- 첫 항목입니다.'],
  ['  - 중첩 항목입니다. 그리고 끊', '  - 중첩 항목입니다.'],        // 들여쓰기는 중첩 단계라 지킵니다
  ['문단입니다.\n\n```js\nconst a = 1;', '문단입니다.'],           // 반쪽 코드 블록은 여는 줄부터 통째로
];
for (const [cut, want] of CUT) eq(trimDangling(cut), want, `잘린 답을 못 다듬었습니다: ${JSON.stringify(cut)}`);

/* 상한에 닿았어도 문장으로 끝났으면 한 글자도 건드리지 않습니다. 이쪽이 훨씬 흔하므로
   (모델은 대개 상한 전에 스스로 멈춥니다) 여기서 헛손질하면 멀쩡한 답이 짧아집니다. */
for (const done of [
  '끝난 답입니다.',
  '괄호로 닫힌 답입니다.)',
  '물어보셨나요?',
  '첫 줄입니다.\n\n- 항목 하나입니다.\n- 항목 둘입니다.',
  '설명입니다.\n```bash\nnpm i\n```',
]) eq(trimDangling(done), done, `끝난 답을 건드렸습니다: ${JSON.stringify(done)}`);

/* 마침표 없이 끝나는 마지막 목록 항목은 끊긴 것인지 원래 그런 것인지 구별할 수 없어서
   버립니다. 반 토막 항목("- 둘째 항목이 끊")이 화면에 남는 쪽이 더 나쁩니다 —
   방문자가 보는 증상이 바로 그것이기 때문입니다. 없어진 항목은 보이지 않습니다. */
eq(trimDangling('- 첫 항목입니다.\n- 마침표 없는 항목'), '- 첫 항목입니다.');

/* 2순위 조각을 권하는 줄. 낱말 한가운데서 겹쳤을 뿐인 조각은 권하지 않아야 합니다 —
   "개발자인가요"의 '자인'이 "디자인시스템"에 걸려 소개 질문에 공통 인프라를 권했습니다. */
// 권유 줄은 화제를 홑따옴표로 감쌉니다. 본문에도 "공통 인프라"라는 말이 나오므로
// 권유가 붙었는지는 그 따옴표로만 봅니다.
noMatch(wikiAnswer('iron은 어떤 개발자인가요?'), /‘공통 인프라와 팀 규약’/,
  '낱말 가운데서 겹친 조각을 권하고 있습니다');
match(wikiAnswer('팀에 뭘 공유했어'), /나눠 왔나/, '이어서 볼 조각을 권하지 못했습니다');

console.log(`wiki: ${WIKI.length} chunks, ${CHECKS} checks pass`);
