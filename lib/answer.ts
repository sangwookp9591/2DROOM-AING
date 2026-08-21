/* 위키에서 꺼낸 원문과 모델이 뱉은 문자열을, 채팅에 그대로 나가도 되는 말로 바꿉니다.

   원문을 그대로 띄우면 답이 아니라 문서가 나갑니다 — 【제목】 아래에 여덟 문장이 통째로
   붙고, 그중 절반은 방문자가 묻지 않은 이야기입니다. 모델 쪽은 반대 방향으로 어긋납니다.
   작은 모델일수록 "### 요약", "자료에 따르면", 같은 문장 반복 같은 습관이 붙고,
   사고 과정 태그가 새기도 합니다.

   그래서 어느 경로로 온 답이든 화면에 닿기 전에 여기를 지납니다. 이 파일은 사실을
   만들거나 고치지 않습니다 — 무엇을 보여줄지 고르고, 어떻게 읽힐지만 정합니다. */
// 확장자를 붙이는 이유는 wiki.check.ts가 이 파일을 번들러 없이 node로 직접 돌리기 때문입니다.
import { retrieve, terms, wordHeads, type Chunk } from './wiki.ts';

/** 위키와 상관없는 질문. 없다고 말하되, 무엇을 물으면 되는지까지 알려 줍니다. */
export const NO_MATCH =
  '그건 여기 안 적혀 있네요. 대신 이력이나 저장소별 기여도, 쓰는 도구, 일하는 방식 쪽은 답할 수 있어요.';

/* ── 원문에서 답 만들기 ─────────────────────────────────────────── */

/** 문장 단위로 자릅니다. 줄바꿈은 원문의 편집 흔적일 뿐이라 먼저 지웁니다.
    마침표 뒤에 공백이 올 때만 자르므로 `0.6B`나 `방법론.md)`는 안 쪼개집니다.
    검증 하네스가 답을 문장으로 세는 데도 같은 규칙을 씁니다 — 다른 규칙으로 세면
    "몇 문장이 나갔는가"를 실제와 다르게 재게 됩니다. */
export const sentences = (text: string) =>
  text.replace(/\s*\n\s*/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

// 앞 문장을 받아야 말이 되는 시작들. 이런 문장이 답의 첫 줄로 나가면 방문자는
// 없는 앞 문장을 찾게 됩니다.
const NEEDS_LEAD = /^(그래서|그리고|그러나|그런데|그러자|그 결과|대신|다만|또한|또|반대로|덕분에|이렇게|여기서|거기서)/;

/* 조각 전체를 묻는 질문. 검색어 매칭으로는 이런 질문에 답할 수 없습니다 — 조각의 첫
   문장은 주제어를 되풀이하지 않기 때문입니다("쿠폰은 돈과 직결됩니다"에는 '설계'도
   '이유'도 없습니다). 대신 이 위키의 조각이 문제 → 결정 → 결과 순으로 쓰여 있다는 사실을
   씁니다. 왜와 누구의 답은 언제나 첫머리에 있습니다. */
const FROM_TOP = /(왜|이유|배경|어째서|어쩌다|누구|누군|어떤 ?사람|어떤 ?개발자|소개)/;

const WINDOW = 3;    // 답 한 편에 넣을 문장 수 상한
// 글자 수 상한. 말풍선 하나가 화면을 덮지 않을 만큼이고, 그 말풍선의 실제 크기는
// app/globals.css의 .aing__turn이 정합니다 — 판을 크게 고치면 이 값도 같이 보세요.
const BUDGET = 340;
// 점수가 0인 문장을 창에 끼워 넣을 때 무는 값. 이게 없으면 창은 언제나 최대 길이로 자랍니다.
const PADDING = -0.12;
// 이보다 짧으면 답이 아니라 운을 뗀 것으로 봅니다.
const FLOOR = 120;
// 이보다 길면 다음 이야기를 권하지 않습니다 — 이미 할 말을 다 했습니다.
const ENOUGH = 260;

/** 질문과 가장 가까운 '이어지는 몇 문장'을 원문 그대로 잘라 옵니다.

    점수가 높은 문장만 흩어 모으면 인용문 두 개를 나란히 세운 꼴이 됩니다. 실제로
    "쿠폰을 왜 새로 설계했나"에 zonky embedded-postgres 문장이 붙었습니다 — 그 문장에
    '쿠폰'과 '도메인'이 가장 많이 들어 있다는 이유만으로요. 위키 조각은 문제 → 결정 → 결과
    순으로 쓰여 있으니, 붙어 있는 구간을 통째로 떠 와야 "그래서"가 무엇을 받는지가 남습니다. */
function choose(query: string, text: string) {
  const all = sentences(text);
  if (!all.length) return [];

  // 글자 예산 안에서 앞에서부터 몇 문장까지 담을 수 있는지.
  const fromTop = () => {
    let chars = 0;
    let len = 0;
    while (len < WINDOW && len < all.length && (len === 0 || chars + all[len].length <= BUDGET)) {
      chars += all[len].length;
      len++;
    }
    return all.slice(0, len);
  };
  if (FROM_TOP.test(query)) return fromTop();

  const q = terms(query);
  const score = all.map((s, i) => {
    const t = terms(s);
    let hit = 0;
    for (const g of q) if (t.has(g)) hit++;
    // 긴 문장은 그냥 더 많이 걸리므로 길이로 완만하게 누릅니다.
    // 그리고 앞쪽에 가산점을 줍니다 — 조각의 첫머리는 대개 그 조각이 무엇에 대한
    // 글인지를 말하는 자리라, 점수가 비슷하면 앞이 이겨야 답이 자기소개부터 시작합니다.
    const raw = hit / Math.pow(Math.max(t.size, 1), 0.35);
    return raw > 0 ? raw * (1 + 0.4 / (1 + i)) : 0;
  });

  let best = { at: 0, len: 0, sum: 0 };
  for (let at = 0; at < all.length; at++) {
    let chars = 0;
    let sum = 0;
    for (let len = 1; len <= WINDOW && at + len <= all.length; len++) {
      const s = all[at + len - 1];
      chars += s.length;
      if (len > 1 && chars > BUDGET) break;
      sum += score[at + len - 1] || PADDING;
      if (sum > best.sum) best = { at, len, sum };
    }
  }
  // 질문이 태그로만 걸린 경우(제목에는 있는데 본문에는 그 말이 없는 경우)입니다.
  // 그때도 조각의 첫머리가 곧 그 조각의 요약이라 앞에서부터 씁니다.
  if (!best.len) return fromTop();

  // 접속사로 시작하는 문장이 첫 줄이 되면 앞이 잘린 것처럼 읽힙니다. 한 문장 앞에서 뜹니다.
  if (best.at > 0 && NEEDS_LEAD.test(all[best.at])) { best.at--; best.len++; }

  /* 한 문장만 걸리는 경우가 있습니다 — 뒤 문장들이 주제어를 되풀이하지 않을 때입니다.
     "팀에 뭘 공유했어"에 "팀에 남긴 것은 코드만이 아닙니다."만 나가면 그건 답이 아니라
     운을 뗀 것입니다. 너무 짧으면 뒤로 한 문장씩 더 데려옵니다. */
  const picked = all.slice(best.at, best.at + best.len);
  while (picked.join(' ').length < FLOOR && best.at + picked.length < all.length && picked.length < WINDOW) {
    picked.push(all[best.at + picked.length]);
  }
  return picked;
}

/** 제목에서 화제만 남깁니다.
    'BACK — 호텔 검색·재색인 파이프라인 (OpenSearch)' → '호텔 검색·재색인 파이프라인'
    'SYSTEM — 운영 경계: Redis 격리 · 메트릭 · 배포 계약' → '운영 경계' */
const topicOf = (title: string) =>
  title.split('—').pop()!.split(':')[0].replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

/** 받침을 보고 '로'와 '으로'를 고릅니다. 화제 이름이 매번 바뀌는 자리라
    한쪽으로 고정해 두면 "검증로 이어집니다"가 나갑니다. */
function ro(word: string) {
  const last = word.codePointAt(word.length - 1) ?? 0;
  if (last < 0xac00 || last > 0xd7a3) return '로';        // 한글이 아니면 그냥 '로'
  const jong = (last - 0xac00) % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';        // 받침 없음 또는 ㄹ
}

// 다음 이야기로 넘기는 말. 답마다 같은 문장이 붙으면 그때부터는 읽지 않는 줄이 되므로
// 조각별로 갈라 둡니다. 무작위가 아니라 id로 정하는 건, 같은 주제에는 늘 같은 말이
// 붙어야 두 번 물어본 사람이 어색해하지 않기 때문입니다.
const NUDGES = [
  (t: string) => `옆에 ‘${t}’ 이야기도 있어요. 궁금하면 이어서 물어보세요.`,
  (t: string) => `이 다음은 보통 ‘${t}’${ro(t)} 이어집니다. 그쪽도 물어봐 주세요.`,
  (t: string) => `‘${t}’도 같이 보면 그림이 맞춰집니다.`,
];
/** 질문이 이 조각의 제목·태그를 실제로 건드렸는지. 2순위 조각은 그냥 남은 것 중
    제일 나은 것일 뿐이라, 이 확인 없이 권하면 엉뚱한 데로 안내합니다.

    겹치기만 하면 통과시켰더니 못 막았습니다. terms()는 2-gram을 함께 내는데, 그 조각이
    낱말 한가운데서 겹치는 일이 잦기 때문입니다 — "개발**자인**가요"의 '자인'이
    "디**자인**시스템"에 걸려서, 소개를 물은 사람에게 공통 인프라 조각을 권했습니다.
    그래서 양쪽 모두에서 **낱말의 머리**여야 합니다. 한국어는 조사가 뒤에 붙고 합성어는
    앞을 나눠 가지므로("공유했어" / "공유기록"), 머리를 공유하면 같은 말이고 가운데서
    겹치면 대개 우연입니다. */
function related(chunk: Chunk, query: string) {
  const asked = wordHeads(query);
  const has = wordHeads(`${chunk.title} ${chunk.tags}`);
  for (const g of terms(query)) {
    if (!asked.some((w) => w.startsWith(g))) continue;
    if (has.some((w) => w.startsWith(g))) return true;
  }
  return false;
}

const nudgeFor = (chunk: Chunk) => {
  let h = 0;
  for (const ch of chunk.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return NUDGES[h % NUDGES.length](topicOf(chunk.title));
};

/** 검색 결과를 답 한 편으로 엮습니다. 핵심 한 문장 → 필요한 근거 → 다음 이야기. */
export function compose(query: string, hits: Chunk[]): string {
  if (!hits.length) return NO_MATCH;

  const picked = choose(query, hits[0].text);
  if (!picked.length) return NO_MATCH;

  // 첫 문장만 떼어 문단을 나눕니다. 한 덩어리로 붙여 두면 여섯 줄짜리 벽이 되고,
  // 방문자는 첫 줄에서 답을 얻었는지 아닌지를 판단하지 못합니다.
  const out = [picked[0]];
  if (picked.length > 1) out.push(picked.slice(1).join(' '));

  /* 다음 이야기를 권하는 건 두 조건이 다 맞을 때만입니다. 매번 같은 자리에 같은 꼴의 줄이
     붙으면 그건 답이 아니라 서식으로 읽히고, 질문과 무관한 조각을 권하면 안 권하느니만
     못합니다("어떤 사람이야"의 2순위는 그냥 남은 조각 중 하나일 뿐입니다). */
  const said = out.join(' ').length;
  if (hits[1] && said < ENOUGH && related(hits[1], query)) out.push(nudgeFor(hits[1]));
  return out.join('\n\n');
}

/** 답 아래에 붙일 다음 질문거리. 검색이 이 질문에 대해 2·3순위로 올린 조각의 화제를 씁니다.

    예시 문장을 손으로 적어 두지 않는 이유는, 그 목록이 위키보다 먼저 낡기 때문입니다.
    조각을 하나 더하거나 제목을 고치면 추천이 저절로 따라오고, 무엇보다 여기서 나온
    화제는 실제로 답이 있는 화제입니다 — 눌렀는데 "위키에 없네요"가 나오지 않습니다. */
const CHIP = 20;   // 칩 하나에 들어가는 글자 수. 넘치면 판이 좁을 때 두 줄로 접힙니다.

export function suggest(query: string, asked: string[] = [], n = 3): string[] {
  const key = (t: string) => t.replace(/\s+/g, '');
  const seen = new Set(asked.map(key));
  const out: string[] = [];
  // 1순위는 방금 답한 조각이라 건너뜁니다. 여유분을 더 뽑는 건 이미 물어본 화제를 걸러내서입니다.
  for (const c of retrieve(query, n + 3).slice(1)) {
    /* 칩 한 줄에 들어가야 합니다. 먼저 제목의 화제를 그대로 써 보고, 길 때만 앞의 한 조각으로
       줄입니다('에이전트 스킬 CLI · PR 자동 리뷰 · 정보 공유' → '에이전트 스킬 CLI').
       처음부터 자르면 'Carry·Trade·OCR'이 'Carry'가 되어 무슨 말인지 알 수 없게 됩니다. */
    let topic = topicOf(c.title);
    if (topic.length > CHIP) topic = topic.split(/[·,]/)[0].trim();
    if (!topic || topic.length > CHIP || seen.has(key(topic))) continue;
    seen.add(key(topic));
    out.push(topic);
    if (out.length === n) break;
  }
  return out;
}

/** 모델이 없을 때의 답. 근거는 모델이 받는 것과 같은 위키입니다. */
export function wikiAnswer(query: string): string {
  return compose(query, retrieve(query, 2));
}

/* ── 모델이 뱉은 것 다듬기 ──────────────────────────────────────── */

// 내용이 없는 제목들. 세 줄짜리 답 위에 "요약"이 붙으면 답이 문서로 보입니다.
const EMPTY_HEAD = /^(요약|정리|결론|답변|답|응답|설명|개요|배경|참고|추가 ?설명|핵심)$/;

/** 코드 울타리. polish는 이 안을 건드리지 않고 Markdown은 이 안을 그대로 그립니다 —
    두 쪽이 같은 것을 울타리로 봐야 하므로 정의는 여기 하나뿐입니다. */
export const FENCE = /^\s*```/;

/** 한 줄 안에서 똑같은 문장이 두 번 이상 나오면 첫 번만 남깁니다.
    작은 모델이 문장을 그대로 되풀이하며 토큰을 채우는 걸 잡습니다. */
function dedupe(line: string) {
  const seen = new Set<string>();
  const kept = sentences(line).filter((s) => {
    const key = s.replace(/\s+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // 문장을 다시 이을 때 줄 앞의 들여쓰기는 돌려놓습니다. sentences()가 양끝을 다듬으므로
  // 안 그러면 목록의 중첩 단계가 조용히 펴집니다.
  return kept.length ? line.match(/^\s*/)![0] + kept.join(' ') : line;
}

/** 모델 출력을 채팅 말투의 마크다운으로 정리합니다.
    스트리밍 중간에도 매 토큰마다 불리므로, 아직 안 끝난 문장을 잘라내는 일은 하지 않습니다. */
export function polish(raw: string): string {
  let t = (raw ?? '').replace(/\r\n/g, '\n');

  // 사고 과정은 답이 아닙니다. 닫힌 블록을 먼저 걷어내고, 아직 안 닫힌 블록(=스트리밍
  // 도중)은 뒤를 통째로 감춥니다 — 안 그러면 생각하는 동안 속엣말이 화면에 흐릅니다.
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '');
  t = t.replace(/<think>[\s\S]*$/i, '');
  t = t.replace(/<\/think>/gi, '');

  // 말을 시작하기 전에 붙는 군더더기. 사람은 "답변:"이라고 말하고 답하지 않습니다.
  t = t.replace(/^\s*(?:답변|답|응답|정답|assistant|answer|안내자|ai)\s*[:：]\s*/i, '');
  /* 인사로 운을 떼는 습관. 프롬프트로는 안 잡힙니다 — "인사말로 시작하지 않는다"를 못 박아도
     Gemma 3 1B는 "안녕하세요."로 시작합니다. 답의 분량이 2~4문장인데 그중 하나가 인사면
     아깝습니다.

     뒤따르는 자기소개("저는 박상욱입니다")는 남깁니다. 같이 떼 봤더니 답이 "의료관광 플랫폼
     ZIVO의 풀스택 리드 개발자입니다."로 시작해서, 누구 이야기인지가 문장에서 사라졌습니다. */
  t = t.replace(/^\s*(?:안녕하세요|안녕하십니까|반갑습니다)[.,!]?\s*/, '');
  t = t.replace(/(?:^|(?<=[.!?]\s))(?:위 |제공된 |주어진 |해당 )?자료에 (?:따르면|의하면|나와 ?있는 대로)[,:]?\s*/g, '');

  const out: string[] = [];
  let fenced = false;
  for (const line of t.split('\n')) {
    /* 울타리 안은 글이 아니라 코드입니다. 아래 규칙을 그대로 먹이면 `# 설치` 주석이
       굵은 제목이 되고, `---`가 수평선으로 지워지고, 들여쓰기가 펴집니다.
       Markdown.tsx는 울타리 안을 있는 그대로 그리므로 그 손상이 그대로 화면에 나갑니다. */
    if (FENCE.test(line)) { fenced = !fenced; out.push(line.trimEnd()); continue; }
    if (fenced) { out.push(line); continue; }

    let l = line.trimEnd();
    if (!l) {
      // 빈 줄은 하나까지만. 지워진 제목이 남긴 구멍도 여기서 메워집니다.
      if (!out.length || !out[out.length - 1]) continue;
      out.push('');
      continue;
    }
    if (/^\s*(?:-{3,}|={3,}|\*{3,})\s*$/.test(l)) continue;             // 문단을 가르는 수평선
    const head = l.match(/^\s{0,3}#{1,6}\s*(.+?)\s*#*\s*$/);
    if (head) {
      const label = head[1].replace(/[*_`]/g, '').trim();
      if (EMPTY_HEAD.test(label)) continue;
      l = `**${label}**`;                                               // 남길 제목은 굵은 한 줄로만
    }
    l = l.replace(/^(\s*)[•‧∙]\s+/, '$1- ');                            // 불릿 기호 통일
    l = dedupe(l);
    if (l.trim() === out[out.length - 1]?.trim()) continue;             // 바로 앞 줄의 되풀이
    out.push(l);
  }

  return out.join('\n').trim();
}

/** 토큰 예산이 다해 문장 한가운데서 멎은 답을, 마지막 온전한 문장까지만 남깁니다.

    예산에서 끊긴 답은 "…ArchUnit 강제로 세웠고," 처럼 쉼표로 끝납니다. 방문자에게는
    모델이 말하다 만 것이 아니라 화면이 답을 잘라먹은 것으로 보입니다.

    끊겼다는 사실을 아는 쪽에서만 부릅니다(워커의 capped, Ollama의 done_reason). 스스로
    멈춘 답이나 흐르는 도중에 부르면, 멀쩡하게 끝난 마지막 문장을 지웁니다. */
export function trimDangling(text: string): string {
  const lines = text.split('\n');

  /* 열린 채 끊긴 코드 울타리는 여는 줄부터 통째로 버립니다. 반쪽 코드는 복사해 봐야
     못 쓰고, Markdown은 닫히지 않은 울타리도 그대로 그리므로 안 지우면 화면에 남습니다. */
  let open = -1;
  lines.forEach((l, i) => { if (FENCE.test(l)) open = open < 0 ? i : -1; });
  if (open >= 0) lines.length = open;

  const dropBlanks = () => { while (lines.length && !lines[lines.length - 1].trim()) lines.pop(); };
  dropBlanks();

  // 이미 문장으로 끝났거나 울타리를 닫았으면, 예산이 다했더라도 손댈 것이 없습니다.
  const last = lines[lines.length - 1];
  if (last && !FENCE.test(last) && !/[.!?…][)"'”’\]]*$/.test(last.trimEnd())) {
    lines.pop();
    // 줄 앞 들여쓰기는 목록의 중첩 단계라 돌려놓습니다. 남는 문장이 없으면 줄째로 사라집니다.
    const kept = sentences(last).slice(0, -1);
    if (kept.length) lines.push(last.match(/^\s*/)![0] + kept.join(' '));
    dropBlanks();
  }

  // trim()이 아닙니다 — 첫 줄이 중첩 목록이면 그 들여쓰기가 곧 단계라 지워선 안 됩니다.
  while (lines.length && !lines[0].trim()) lines.shift();
  return lines.join('\n').trimEnd();
}
