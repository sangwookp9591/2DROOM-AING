/* 채팅 말풍선 안의 마크다운. 라이브러리를 붙이지 않는 이유는 여기서 필요한 문법이
   문단·목록·강조·코드·링크가 전부이고, 그걸 위해 파서 하나를 통째로 들이면 이 페이지가
   지키는 초기 번들 예산이 답 하나 예쁘게 그리자고 무너지기 때문입니다.

   HTML 문자열을 만들지 않고 React 엘리먼트로 바로 짓습니다 — dangerouslySetInnerHTML이
   없으면 모델이 무엇을 뱉든 태그로 살아날 길이 없습니다.

   스트리밍 중에는 언제나 문장이 끊긴 상태로 들어옵니다. 닫히지 않은 울타리나 짝이 안 맞는
   `**`를 만나도 그냥 글자로 흘려보내고, 다음 토큰에서 저절로 맞춰지게 둡니다. */
import { Fragment, memo, type ReactNode } from 'react';
import { FENCE } from '@/lib/answer';

const UL = /^\s*[-*]\s+/;
const OL = /^\s*\d+[.)]\s+/;

/** 문단이 아니라 블록이 시작되는 줄인가. 여는 쪽과 닫는 쪽에서 두 번 따로 물으면,
    블록 종류를 하나 더할 때 한쪽만 고치고 끝내게 됩니다. */
const isBlock = (l: string) => UL.test(l) || OL.test(l) || FENCE.test(l);

/* 굵게 · 기울임 · 코드 · 링크 · 맨 URL · 메일 주소. 순서가 곧 우선순위라 `**`가 `*`보다 앞입니다.
   `_기울임_`은 일부러 뺐습니다 — 이력에 나오는 파일명(E2E_테스트_설계_방법론.md)이 통째로 기웁니다.

   주소 뒤의 문장부호는 주소가 아닙니다. 위키의 연락처 조각은 "연락처는 iron@example.com."
   처럼 마침표로 끝나는데, 그 마침표까지 물면 받는 사람이 없는 메일 창이 열립니다.
   그래서 URL은 부호로 끝나지 못하게 하고, 메일은 마지막 마디에 점을 허용하지 않습니다. */
const INLINE =
  /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[([^\]\n]+)\]\(([^)\s]+)\)|https?:\/\/[^\s<)]*[^\s<).,;:!?]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;

// 모델이 만들어 낸 주소를 그대로 믿지 않습니다. 이 두 스킴이 아니면 링크가 아니라 글자입니다.
const SAFE = /^(https?:|mailto:)/i;

function link(href: string, label: string, key: number): ReactNode {
  if (!SAFE.test(href)) return <span key={key}>{label}</span>;
  const external = !href.toLowerCase().startsWith('mailto:');
  return (
    <a key={key} href={href} {...(external && { target: '_blank', rel: 'noreferrer noopener' })}>
      {label}
    </a>
  );
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE)) {
    const tok = m[0];
    const at = m.index;
    if (at > last) out.push(text.slice(last, at));
    last = at + tok.length;

    if (tok.startsWith('**')) out.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('*')) out.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    else if (tok.startsWith('`')) out.push(<code key={key++}>{tok.slice(1, -1)}</code>);
    // 링크는 INLINE이 이미 라벨과 주소를 따로 잡아 뒀습니다. 여기서 다시 쪼개면
    // 같은 문법이 두 벌이 되고, 둘이 어긋나는 날 non-null 단언이 터집니다.
    else if (tok.startsWith('[')) out.push(link(m[3], m[2], key++));
    // 어느 갈래로 잡혔는지로 가릅니다. @가 들어 있는지로 가르면 경로에 @가 붙은 주소가
    // (https://github.com/@iron) mailto로 넘어가 죽은 링크가 됩니다.
    else if (/^https?:/i.test(tok)) out.push(link(tok, tok, key++));
    else out.push(link(`mailto:${tok}`, tok, key++));
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** 목록 한 줄. indent는 중첩 단계라 마커와 함께 지우면 안 됩니다. */
type Row = { indent: number; ordered: boolean; text: string };

/** rows[at]부터 같은 깊이가 이어지는 동안을 목록 하나로 묶습니다. 더 깊은 줄은 바로 앞
    항목의 자식 목록으로 들어가고, 깊이가 다시 얕아지면 그 자리에서 멈춰 남은 위치를
    돌려줍니다 — 부르는 쪽이 그다음을 이어서 담습니다. */
function listAt(rows: Row[], at: number, key: number): [ReactNode, number] {
  const { indent, ordered } = rows[at];
  const items: ReactNode[] = [];
  let i = at;
  while (i < rows.length && rows[i].indent >= indent) {
    // 같은 깊이인데 마커가 바뀌었으면 여기부터는 다른 목록입니다.
    if (rows[i].indent === indent && rows[i].ordered !== ordered) break;
    const { text } = rows[i++];
    let child: ReactNode = null;
    if (i < rows.length && rows[i].indent > indent) [child, i] = listAt(rows, i, 0);
    items.push(<li key={items.length}>{inline(text)}{child}</li>);
  }
  const List = ordered ? 'ol' : 'ul';
  return [<List className="aing__list" key={key}>{items}</List>, i];
}

/* memo: 답이 흐르는 동안 로그는 토큰마다 다시 그려집니다. 이미 끝난 말풍선까지 매번
   다시 파싱하고 React가 그 엘리먼트를 다시 맞춰 볼 이유가 없습니다 — 같은 문자열이면
   지나갑니다. 그 사이 메인 스레드는 파티클 장을 60fps로 돌리고 있습니다. */
function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }

    if (FENCE.test(lines[i])) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      i++;   // 닫는 울타리. 스트리밍 도중이면 아직 없을 수도 있는데, 그때는 여기서 끝입니다.
      nodes.push(<pre className="aing__pre" key={key++}><code>{body.join('\n')}</code></pre>);
      continue;
    }

    if (UL.test(lines[i]) || OL.test(lines[i])) {   // FENCE는 바로 위에서 걸렀습니다
      /* 마커만 떼고 들여쓰기는 남깁니다. 마커와 함께 지우던 시절에는 '- 위 / ␣␣- 아래'가
         같은 층의 형제 둘로 그려졌습니다 — answer.ts가 polish와 trimDangling 두 곳에서
         이 들여쓰기를 굳이 지켜 보내는 이유가 화면 직전에 사라진 셈이었습니다. */
      const rows: Row[] = [];
      while (i < lines.length && (UL.test(lines[i]) || OL.test(lines[i]))) {
        const line = lines[i++];
        const ordered = OL.test(line);
        rows.push({
          indent: /^\s*/.exec(line)![0].length,
          ordered,
          text: line.replace(ordered ? OL : UL, ''),
        });
      }
      // 얕아졌다 다시 시작하는 목록이 있으면 그만큼 나눠 담습니다. 남기면 그 줄들이 사라집니다.
      for (let at = 0; at < rows.length;) {
        const [node, next] = listAt(rows, at, key++);
        nodes.push(node);
        at = next;
      }
      continue;
    }

    // 문단: 빈 줄이나 다음 블록이 시작될 때까지. 문단 안의 줄바꿈은 줄바꿈으로 둡니다.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlock(lines[i])) para.push(lines[i++]);
    nodes.push(
      <p key={key++}>
        {para.map((t, n) => <Fragment key={n}>{n > 0 && <br />}{inline(t)}</Fragment>)}
      </p>,
    );
  }

  return <>{nodes}</>;
}

export default memo(Markdown);
