import WorldShell from '@/components/world/WorldShell';
import { ROOMS } from '@/lib/rooms';
import { ME, dotted, recentProjects, recentVideos } from '@/lib/feeds';
// 로고는 파일이 아니라 path입니다. img로 두면 요청이 늘고 색을 currentColor로 못 물려받습니다.
import { MARK, type LiveArt } from '@/lib/frames';

const CORE_CASES = [
  {
    id: 'web',
    label: '환자용 웹',
    title: '앱 설치 없이 검색부터 결제까지',
    problem: '외국인 환자에게 앱 설치는 첫 번째 이탈 지점이었습니다.',
    result: '14개 언어 · 9개월 운영 · 웹 0→1 단독 구축',
  },
  {
    id: 'admin',
    label: '운영자 화면',
    title: '15명이 같은 권한과 화면을 사용하도록',
    problem: '협업 인원이 늘면서 권한 누락과 공통 UI 파편화가 생겼습니다.',
    result: '15명 협업 · 권한·공통 UI 기준 일원화',
  },
  {
    id: 'backend',
    label: '백엔드',
    title: '외부 장애와 중복 지급이 번지지 않도록',
    problem: '느린 외부 요청과 재시도가 전체 장애와 쿠폰 중복으로 이어질 수 있었습니다.',
    result: '외부 연동 43곳 격리 · 쿠폰 검증 101건',
  },
] as const;

const CASE_BRIEFS: Record<string, { problem: string; role: string; result: string }> = {
  web: {
    problem: '외국인 환자가 서비스를 쓰기 전에 앱 설치 단계에서 이탈했습니다.',
    role: 'Next.js 웹을 0에서 시작해 검색·QR 주문·결제까지 혼자 구축했습니다.',
    result: '앱 설치 단계를 없애고 14개 언어로 9개월 동안 운영했습니다.',
  },
  admin: {
    problem: '15명이 함께 만들면서 권한 확인이 빠지고 공통 화면이 서로 달라졌습니다.',
    role: '공통 UI, 권한 훅, 전역 오류 처리의 기준을 만들고 적용을 이끌었습니다.',
    result: '화면과 서버가 같은 권한 기준을 사용하도록 한 곳에서 관리했습니다.',
  },
  backend: {
    problem: '외부 번역·AI 지연과 재시도가 전체 장애나 쿠폰 중복 지급으로 번질 수 있었습니다.',
    role: '검색·AI·쿠폰 도메인을 주도하고 실패·재시도 경계를 먼저 설계했습니다.',
    result: '외부 연동 43곳을 격리하고 쿠폰 중복·유실을 101건의 검증으로 확인했습니다.',
  },
};

const CLAUDE_STRENGTHS = [
  {
    title: '문제를 증상이 아니라 원인 층위에서 잡는 편',
    body: 'Valkey 메모리 이슈를 다뤘던 방식이 대표적입니다. “메모리 터질 것 같다 → 인스턴스 키우자”로 안 가고, 700만 키 중 73%가 TTL 없다는 걸 실측하고, volatile-lru 정책과 TTL 부재의 조합이 왜 치명적인지까지 내려간 다음, Onda 동기화 배치 / Google Places 캐시 / 재고 날짜 키라는 세 개의 발생원으로 쪼갰죠. 그리고 거기서 멈추지 않고 코드베이스 전체 수정용 핸드오프 프롬프트까지 만들었습니다. 진단 → 근본원인 → 재발방지 → 실행 가능한 산출물, 이 사이클을 습관적으로 도는 사람으로 보입니다.',
  },
  {
    title: '설계를 지금이 아니라 2년 뒤에 맞춰 두는 성향',
    body: '다국어 테이블을 14개 로케일 기준으로 잡고, zivo_language / zivo_country를 별도 축으로 뺀 것, Generic FK 폴리모픽으로 엔티티 확장 여지를 남긴 것, 커서 페이지네이션을 복합 커서로 설계한 것 — 전부 “당장 한국어만 되면 되는데”를 거부한 선택들입니다. 아시아 시장 확장이라는 사업 방향과 스키마 설계가 어긋나지 않게 붙어 있어요. 이건 개발자보다는 테크리드의 사고 패턴입니다.',
  },
  {
    title: '범위가 넓은데 깊이가 얕지 않음',
    body: 'Spring Boot/Kotlin 백엔드부터 React 19 + FSD 마이그레이션, Flutter 강제 업데이트, ECS Fargate/RDS Multi-AZ 인프라, OpenSearch, 심지어 네이버 플레이스 카테고리 분류 체계(Adjacency List + Closure Table + ES 조합)까지. 보통 이 정도로 넓으면 한 겹씩 얕은데, 각 영역에서 트레이드오프를 얘기하는 수준으로 들어갑니다.',
  },
  {
    title: '검증되지 않은 것을 싫어함',
    body: '“추론/상상 말고 검색 기반으로, Context7 공식 문서 기준으로”라는 원칙을 저한테까지 요구하시는 것부터가 성향을 드러냅니다. LLM한테 그럴듯한 답 듣고 넘어가는 걸 리스크로 인식한다는 뜻이고, TDD·PRD·TASK.md 기반 워크플로우도 같은 뿌리로 보입니다. 검증 가능한 상태를 만들어 놓고 움직이는 사람.',
  },
] as const;

const CLAUDE_RISKS = [
  {
    title: '선제 설계의 비용',
    body: 'Generic FK 폴리모픽이나 Closure Table 같은 선택은 확장성을 사지만 쿼리 복잡도·인덱싱 난이도·팀원 진입장벽을 지불합니다. 팀을 이끄시는 입장이면, 본인 머릿속에선 자연스러운 설계가 주니어에겐 유지보수 불가 영역이 될 수 있어요. 여기서 갈리는 건 설계 실력이 아니라 문서화와 위임의 밀도입니다.',
  },
  {
    title: '직접 다 파고드는 성향의 한계',
    body: '인프라 장애, 프론트 마이그레이션, Flutter 배포 이슈까지 본인이 잡는 패턴이 반복되면 병목이 본인이 됩니다. 아직은 감당되는 규모겠지만, ZIVO가 커지면 “내가 제일 빨리 잡는다”가 조직 차원에선 가장 비싼 선택이 되는 순간이 옵니다.',
  },
  {
    title: '완결성 욕구와 출시 속도',
    body: 'a부터 z까지 이상 없는지 보는 성향은 장애를 줄이지만, 의료관광 플랫폼처럼 시장 검증이 중요한 도메인에선 가끔 “70%로 내보내고 배우기”가 정답일 때가 있습니다.',
  },
] as const;

function Mark({ of }: { of: keyof typeof MARK }) {
  return (
    <svg className="feed__logo" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={MARK[of]} />
    </svg>
  );
}

/**
 * 본문은 전부 서버에서 렌더합니다. 3D는 공간과 카메라만 맡고,
 * 읽는 글은 언제나 HTML로 존재합니다. (세계 규칙 2)
 *
 * 복도 끝의 두 목록만 저장소 밖(YouTube·GitHub)에서 옵니다. 손으로 적으면
 * 배포 다음 날부터 최근이 아니게 되기 때문입니다. 나란히 부르는 이유는 순서가
 * 없어서입니다 — 이어 붙이면 느린 쪽 뒤에 빠른 쪽이 줄을 섭니다.
 */
export default async function Page() {
  const [videos, projects] = await Promise.all([recentVideos(4), recentProjects(4)]);

  /* 같은 것이 복도 벽에도 걸립니다. 3D는 자리만 알고 있고 무엇이 걸릴지는 여기서 정합니다 —
     Scene은 클라이언트 컴포넌트라 스스로 밖에서 받아 올 수 없습니다. */
  const wall: LiveArt[] = [
    ...videos.map((v) => ({
      id: `video-${v.id}`,
      kind: 'video' as const,
      url: `https://www.youtube.com/watch?v=${v.id}`,
      title: v.title,
      meta: v.when,
      thumb: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
    })),
    ...projects.map((p) => ({
      id: `repo-${p.name}`,
      kind: 'repo' as const,
      url: p.url,
      title: p.name,
      meta: [p.lang, dotted(p.pushed)].filter(Boolean).join(' · '),
      desc: p.desc && p.desc !== p.name ? p.desc : undefined,
    })),
  ];

  return (
    <WorldShell wall={wall}>
      <article className="doc">
        <header className="cover" data-room="cover">
          <p className="kicker">7년차 풀스택 개발자 · 박상욱 (iron)</p>
          <h1>
            14개 언어 의료관광 웹과,
            <br />
            운영 화면·서버를 만들었습니다.
          </h1>
          <p className="lead">
            의료관광 서비스 ZIVO에서 환자가 쓰는 웹, 운영자가 매일 쓰는 관리 화면,
            그 뒤의 Spring Boot 서버를 한 흐름으로 맡았습니다. 결제 이탈과 외부 장애처럼
            정상 화면 밖에서 생기는 문제를 찾고, 같은 실수가 반복되지 않게 고칩니다.
          </p>
          <div className="cover__actions">
            <a className="action action--primary" href="#core-cases">핵심 사례 3개 보기</a>
            <a className="action" href="mailto:sangwookp9591@gmail.com">메일 보내기</a>
          </div>
          <dl className="metrics">
            <div><dt>7년</dt><dd>공공 시스템부터 서비스까지 만든 기간</dd></div>
            <div><dt>14개 언어</dt><dd>앱 설치 없이 이용하는 글로벌 웹</dd></div>
            <div><dt>15명</dt><dd>같은 권한과 공통 화면으로 협업한 규모</dd></div>
            <div><dt>3개 영역</dt><dd>환자용 웹·운영 화면·서버를 맡은 범위</dd></div>
          </dl>
        </header>

        <section className="overview" id="core-cases" aria-labelledby="core-cases-title">
          <p className="kicker">먼저 볼 세 가지</p>
          <h2 id="core-cases-title">최근 9개월, 한 제품의 세 경계를 연결했습니다.</h2>
          <p className="lead">
            기술 목록 대신 사용자가 겪은 문제, 제가 맡은 범위, 확인된 결과 순서로 정리했습니다.
            각 사례를 누르면 해결 과정과 실제 운영 범위를 바로 볼 수 있습니다.
          </p>
          <ol className="overview__grid">
            {CORE_CASES.map((item, index) => (
              <li key={item.id}>
                <a href={`#case-${item.id}`}>
                  <span className="overview__number">0{index + 1}</span>
                  <span className="overview__label">{item.label}</span>
                  <strong>{item.title}</strong>
                  <span>{item.problem}</span>
                  <em>{item.result}</em>
                </a>
              </li>
            ))}
          </ol>
          <p className="overview__aside">이전 경력, 캐릭터 제작, 팀 도구 공유는 핵심 사례 뒤에 별도로 정리했습니다.</p>
        </section>

        {ROOMS.map((room) => (
          <section
            key={room.id}
            className="room"
            data-room={room.id}
            data-track={room.n <= 3 ? 'core' : 'more'}
            id={`case-${room.id}`}
            style={{ ['--accent' as string]: room.accent }}
            aria-labelledby={`room-${room.id}`}
          >
            <p className="kicker">{room.n <= 3 ? '핵심 사례' : '추가 경력과 만들기'} {room.n} · {room.kicker}</p>
            <h2 id={`room-${room.id}`}>
              <span className="badge">{room.n}</span>
              {room.name}
            </h2>
            <p className="lead">{room.lead}</p>

            {CASE_BRIEFS[room.id] && (
              <dl className="case-brief">
                <div><dt>문제</dt><dd>{CASE_BRIEFS[room.id].problem}</dd></div>
                <div><dt>내 역할</dt><dd>{CASE_BRIEFS[room.id].role}</dd></div>
                <div><dt>확인된 결과</dt><dd>{CASE_BRIEFS[room.id].result}</dd></div>
              </dl>
            )}

            {room.id === 'web' && (
              <a className="case-live" href="/zivo/app/" target="_blank" rel="noreferrer">실제 환자용 화면 열기 ↗</a>
            )}
            {room.id === 'admin' && (
              <a className="case-live" href="/zivo/admin/" target="_blank" rel="noreferrer">실제 운영자 화면 열기 ↗</a>
            )}

            {room.id === 'shared' && (
              <figure className="ai-cast">
                <div className="ai-brands" aria-label="AI 도구 브랜드 로고">
                  <span><img src="/brands/ai/claude.svg" alt="Claude 로고" />Claude</span>
                  <span><img src="/brands/ai/codex.png" alt="OpenAI Codex 로고" />Codex</span>
                  <span><img src="/brands/ai/gemini.svg" alt="Gemini 로고" />Gemini</span>
                  <span><img src="/brands/ai/kimi.svg" alt="Kimi 로고" />Kimi</span>
                  <span><img src="/brands/ai/grok.ico" alt="Grok 로고" />Grok</span>
                </div>
                <div className="tool-brands" aria-label="팀에 공유한 개발 환경과 서비스 로고">
                  <span><img src="/brands/cmux.png" alt="cmux 로고" />cmux 터미널</span>
                  <span><img src="/brands/aside.ico" alt="Aside 로고" />Aside</span>
                  <span><img src="/brands/orca.svg" alt="Orca 로고" />Orca</span>
                  <span><img src="/brands/buzz-preview.png" alt="Buzz 서비스 이미지" />Buzz</span>
                </div>
                {/* 예전에는 이 PNG 위에 브랜드 로고를 배지로 얹은 SVG를 걸었습니다. <img>로 부른 SVG는
                    secure static mode라 안의 <image href>를 하나도 못 받아서 흰 원 다섯 개만 나왔습니다.
                    로고는 바로 위 .ai-brands 줄이 이미 이름과 함께 보여 주므로 배지 없이 그림만 겁니다. */}
                <img
                  src="/brands/ai-agents-character-lineup.webp"
                  alt="Claude, Codex, Gemini, Kimi, Grok을 맡은 다섯 캐릭터"
                  width={1080}
                  height={464}
                />
                <figcaption>
                  <span>Claude · 차분하게 정리하는 조언자</span>
                  <span>Codex · 정확하게 만드는 작업자</span>
                  <span>Gemini · 여러 정보를 연결하는 탐험가</span>
                  <span>Kimi · 긴 문서를 읽고 메모하는 기록자</span>
                  <span>Grok · 빠르게 원인을 찾는 디버거</span>
                </figcaption>
              </figure>
            )}

            <ol className="callouts">
              {room.callouts.map((c, i) => (
                <li key={i} className={c.live ? 'is-live' : undefined}>
                  <span className="n">{i + 1}</span>
                  <div>
                    <h3>{c.title}</h3>
                    <p>{c.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <ul className="facts">
              {room.facts.map((f, i) => (
                <li key={i}>
                  <strong>{f.title}</strong>
                  <span>{f.body}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="reviews" id="ai-reviews" aria-labelledby="ai-reviews-title">
          <header className="reviews__head">
            <p className="kicker">AI 협업 기록에서 반복해서 보인 작업 패턴</p>
            <h2 id="ai-reviews-title">Codex와 Claude는 이렇게 평가했습니다.</h2>
            <p className="lead">칭찬만 고르지 않았습니다. 강점이 커질 때 생길 수 있는 비용과 조직적 위험도 함께 공개합니다.</p>
          </header>

          <figure className="codex-review">
            <figcaption className="review-brand">
              <img src="/brands/ai/codex.png" alt="" />
              <span><b>Codex</b>의 평가</span>
            </figcaption>
            <blockquote>
              <p>“주어진 티켓만 구현하는 개발자는 아니다.</p>
              <p>모호한 문제를 받으면 경계를 넓혀가며 원인을 찾고,<br />결국 운영 가능한 형태까지 만들어 놓는 개발자다.”</p>
            </blockquote>
            <div className="codex-review__note">
              <p>가장 어울리지 않는 표현은 의외로 “풀스택 개발자”일 수 있습니다. 틀린 표현은 아니지만 너무 흔해서 특징이 사라집니다.</p>
              <strong>“프론트도 하고 백엔드도 한다”가 아니라<br />“문제가 어디로 넘어가든 따라간다.”</strong>
              <p>그것이 Codex가 본 박상욱의 가장 뚜렷한 특징입니다.</p>
            </div>
          </figure>

          <article className="claude-review">
            <header className="claude-review__head">
              <div className="review-brand">
                <img src="/brands/ai/claude.svg" alt="" />
                <span><b>Claude</b>의 평가</span>
              </div>
              <h3>기술적으로 보이는 네 가지 특징</h3>
            </header>

            <ol className="review-strengths">
              {CLAUDE_STRENGTHS.map((item, index) => (
                <li key={item.title}>
                  <span>0{index + 1}</span>
                  <div><strong>{item.title}</strong><p>{item.body}</p></div>
                </li>
              ))}
            </ol>

            <aside className="review-risks" aria-labelledby="review-risks-title">
              <p className="review-risks__eyebrow">칭찬만 하면 쓸모가 없으니</p>
              <h3 id="review-risks-title">잠재적 리스크로 보이는 부분</h3>
              <ul>
                {CLAUDE_RISKS.map((item) => (
                  <li key={item.title}><strong>{item.title}</strong><p>{item.body}</p></li>
                ))}
              </ul>
            </aside>
          </article>
        </section>

        <footer className="colophon" data-room="colophon">
          <p className="lead">서비스에서 반복되는 실수나 사용자가 자주 막히는 지점이 있다면 이야기해 주세요. 문제를 함께 정리해 보겠습니다.</p>

          <ul>
            <li><a href="mailto:sangwookp9591@gmail.com">sangwookp9591@gmail.com</a></li>
            <li><a href="https://github.com/sangwookp9591">GitHub @sangwookp9591</a></li>
            <li><a href="https://www.youtube.com/@ai-ng-tech">YouTube @ai-ng-tech</a></li>
          </ul>

          {/* 바깥이 죽어 목록이 비어도 위 연락처는 남습니다. */}
          <div className="feeds">
            {videos.length > 0 && (
              <section className="feed feed--videos">
                <h3 className="feed__head">
                  <a className="feed__brand" href={ME.youtube} target="_blank" rel="me noreferrer">
                    <Mark of="youtube" />
                    최근 영상
                    <span className="feed__at">{ME.youtubeHandle}</span>
                  </a>
                </h3>
                <ul className="feed__list">
                  {videos.map((v) => (
                    <li key={v.id}>
                      <a
                        className="feed__item feed__item--vid"
                        href={`https://www.youtube.com/watch?v=${v.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {/* 제목이 바로 아래 글자로 있으므로 썸네일은 장식입니다(alt="").
                            감싸는 span은 재생 단추를 그 중앙에 얹기 위한 자리입니다. */}
                        <span className="feed__shot">
                          <img
                            className="feed__thumb"
                            src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                            alt=""
                            width={320}
                            height={180}
                            loading="lazy"
                            decoding="async"
                          />
                        </span>
                        <span className="feed__text">
                          <span className="feed__name">{v.title}</span>
                          {/* 피드로 온 것만 ISO 날짜가 있습니다. 채널 페이지로 오면 "1개월 전"입니다. */}
                          {v.iso
                            ? <time className="feed__meta" dateTime={v.iso}>{v.when}</time>
                            : <span className="feed__meta">{v.when}</span>}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {projects.length > 0 && (
              <section className="feed feed--repos">
                <h3 className="feed__head">
                  <a className="feed__brand" href={ME.github} target="_blank" rel="me noreferrer">
                    <Mark of="github" />
                    최근 작업
                    <span className="feed__at">@{ME.githubLogin}</span>
                  </a>
                </h3>
                <ul className="feed__list">
                  {projects.map((p) => (
                    <li key={p.name}>
                      <a className="feed__item" href={p.url} target="_blank" rel="noreferrer">
                        <span className="feed__name">{p.name}</span>
                        <span className="feed__meta">
                          {[p.lang, dotted(p.pushed)].filter(Boolean).join(' · ')}
                        </span>
                        {/* 설명이 저장소 이름과 같으면 한 줄을 더 쓸 이유가 없습니다. */}
                        {p.desc && p.desc !== p.name && <span className="feed__desc">{p.desc}</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <p className="sign">박상욱 (iron) · 풀스택 개발자 · 2019 – 2026</p>
        </footer>
      </article>
    </WorldShell>
  );
}
