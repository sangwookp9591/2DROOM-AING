import WorldShell from '@/components/world/WorldShell';
import { ROOMS } from '@/lib/rooms';

/**
 * 본문은 전부 서버에서 렌더합니다. 3D는 공간과 카메라만 맡고,
 * 읽는 글은 언제나 HTML로 존재합니다. (세계 규칙 2)
 */
export default function Page() {
  return (
    <WorldShell>
      <article className="doc">
        <header className="cover" data-room="cover">
          <p className="kicker">풀스택 개발자 · iron</p>
          <h1>
            안녕하세요,
            <br />
            박상욱입니다.
          </h1>
          <p className="lead">
            해외 환자와 병원을 잇는 의료관광 플랫폼 ZIVO에서 아홉 달 동안 일했습니다. 손님이 보는 화면부터 그 뒤의
            서버까지 만들었고, 장애가 난 뒤에 수습하기보다 막힐 자리를 먼저 찾아 지우는 편입니다.
          </p>
          <dl className="metrics">
            <div><dt>5,240+</dt><dd>9개월간의 커밋</dd></div>
            <div><dt>3개 전 영역</dt><dd>웹 · 어드민 · 백엔드 리드</dd></div>
            <div><dt>98%</dt><dd>글로벌 웹 단독 구축</dd></div>
            <div><dt>440건</dt><dd>안정적으로 머지된 PR</dd></div>
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
            <p className="kicker">방 {room.n} · {room.kicker}</p>
            <h2 id={`room-${room.id}`}>
              <span className="badge">{room.n}</span>
              {room.name}
            </h2>
            <p className="lead">{room.lead}</p>

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
          <p className="lead">어떤 문제를 고민하고 계신가요? 함께 이야기 나누고 싶습니다.</p>
          <ul>
            <li><a href="mailto:sangwookp9591@gmail.com">sangwookp9591@gmail.com</a></li>
            <li><a href="https://github.com/sangwookp9591">GitHub @sangwookp9591</a></li>
            <li><a href="https://www.youtube.com/@ai-ng-tech">YouTube @ai-ng-tech</a></li>
          </ul>
          <p className="sign">박상욱 (iron) · ZIVO Medical Tourism Platform · 2025.10 – 2026.07</p>
        </footer>
      </article>
    </WorldShell>
  );
}
