import WorldShell from '@/components/world/WorldShell';
import { ROOMS } from '@/lib/rooms';
import { ME, dotted, recentProjects, recentVideos } from '@/lib/feeds';

/* 로고는 파일이 아니라 path입니다. img로 두면 요청이 둘 늘고, 색을 currentColor로
   물려받지 못해 hover에서 글자만 움직입니다. 각각 GitHub(옥티콘)와 simple-icons의 형태입니다. */
const MARK = {
  github:
    'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z',
  youtube:
    'M15.665 4.124a2.01 2.01 0 0 0-1.415-1.424C13.003 2.363 8 2.363 8 2.363s-5.003 0-6.25.337A2.01 2.01 0 0 0 .335 4.124C0 5.38 0 8 0 8s0 2.62.335 3.876a2.01 2.01 0 0 0 1.415 1.424C2.997 13.637 8 13.637 8 13.637s5.003 0 6.25-.337a2.01 2.01 0 0 0 1.415-1.424C16 10.62 16 8 16 8s0-2.62-.335-3.876zM6.364 10.379V5.621L10.545 8l-4.181 2.379z',
};

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
  const [videos, projects] = await Promise.all([recentVideos(3), recentProjects(4)]);

  return (
    <WorldShell>
      <article className="doc">
        <header className="cover" data-room="cover">
          <p className="kicker">풀스택 개발자 · 박상욱 (iron)</p>
          <h1>
            사용자가 막히지 않는 서비스를 만들고,
            <br />
            팀의 반복 실수를 줄입니다.
          </h1>
          <p className="lead">
            외국인 환자가 앱을 설치하지 않아도 병원과 상품을 찾고 결제할 수 있는 웹부터,
            운영자가 매일 쓰는 관리 화면과 그 뒤의 서버까지 만들었습니다. 화면만 만들거나 서버만 고치는 데서 끝내지 않고,
            사용자가 막히는 순간과 팀이 같은 실수를 반복하는 자리까지 찾아서 고칩니다.
            최근에는 의료관광 서비스 ZIVO에서 9개월 동안 이 일을 맡았습니다.
          </p>
          <dl className="metrics">
            <div><dt>7년</dt><dd>공공 시스템부터 서비스까지 만든 기간</dd></div>
            <div><dt>웹 · 운영도구 · 서버</dt><dd>문제의 시작부터 끝까지 맡은 범위</dd></div>
            <div><dt>14개 언어</dt><dd>앱 설치 없이 이용하는 글로벌 웹</dd></div>
            <div><dt>5,240+</dt><dd>최근 9개월 동안 확인 가능한 변경 기록</dd></div>
          </dl>
        </header>

        {ROOMS.map((room) => (
          <section
            key={room.id}
            className="room"
            data-room={room.id}
            style={{ ['--accent' as string]: room.accent }}
            aria-labelledby={`room-${room.id}`}
          >
            <p className="kicker">사례 {room.n} · {room.kicker}</p>
            <h2 id={`room-${room.id}`}>
              <span className="badge">{room.n}</span>
              {room.name}
            </h2>
            <p className="lead">{room.lead}</p>

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
                <img src="/brands/ai-agents-character-lineup-branded.svg" alt="Claude, Codex, Gemini, Kimi, Grok의 실제 로고가 들어간 다섯 캐릭터" />
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
              <section className="feed">
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
                        {/* 제목이 바로 옆에 글자로 있으므로 썸네일은 장식입니다(alt=""). */}
                        <img
                          className="feed__thumb"
                          src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                          alt=""
                          width={320}
                          height={180}
                          loading="lazy"
                          decoding="async"
                        />
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
              <section className="feed">
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
