/** 밖에서 가져올 때 필요한 이름들. 페이지의 링크도 같은 값을 봅니다. */
export const ME = {
  githubLogin: 'sangwookp9591',
  github: 'https://github.com/sangwookp9591',
  youtube: 'https://www.youtube.com/@ai-ng-tech',
  youtubeHandle: '@ai-ng-tech',
  /* RSS 피드는 핸들이 아니라 채널 ID만 받습니다(/feeds/videos.xml?channel_id=…).
     @핸들로는 404가 나므로 채널 페이지에서 한 번 꺼내 여기 적어 둡니다. */
  youtubeChannelId: 'UCuzvnXas0mUqueHOqtoOPeQ',
};

/* 이 사이트의 글은 전부 저장소 안의 상수입니다. 이 파일 둘만 예외로 밖에서 옵니다 —
   "최근 프로젝트"와 "최근 영상"은 손으로 적는 순간 배포 다음 날부터 최근이 아니게 됩니다.

   Next 16의 fetch는 기본이 캐시 안 함입니다. revalidate를 안 붙이면 홈이 통째로 요청마다
   렌더되는 동적 경로로 내려앉습니다 — 이 사이트의 전제(정적 프리렌더)가 조용히 깨집니다.
   6시간이면 영상 올리고 반나절 안에 붙고, GitHub 비인증 한도(IP당 시간당 60회)와도
   부딪히지 않습니다. */
const REVALIDATE = 21600;

/* 바깥이 죽었다고 배포까지 막지는 않습니다. 대신 빈 목록으로 조용히 넘어가지 말고
   빌드 로그에 남깁니다 — 화면에서는 "영상이 없는 것"과 구분되지 않기 때문입니다. */
function fell(what: string, err: unknown): [] {
  console.warn(`[feeds] ${what} 가져오기 실패 — 그 목록은 이번 빌드에서 비어 나갑니다:`, err);
  return [];
}

async function grab(url: string, headers?: Record<string, string>) {
  const res = await fetch(url, { headers, next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} ← ${url}`);
  return res;
}

/* 유튜브는 헤더 없는 요청에 피드나 목록 대신 동의 화면을 돌려주기도 합니다 — 로컬에서는
   되다가 배포에서만 비는 이유가 이것이었습니다. 제 채널의 공개 페이지를 가져오는 요청이라
   신원을 감추는 게 아니라 브라우저가 보내는 것과 같은 것을 보낼 뿐입니다. */
const BROWSERISH = {
  accept: 'text/html,application/atom+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'ko,en;q=0.9',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
};

/** 영상 하나. when은 화면에 그대로 나갑니다 — 피드로 오면 2026.07.15, 채널 페이지로 오면 "1개월 전". */
type Video = { id: string; title: string; when: string; /** 피드로 왔을 때만 있는 ISO 날짜 */ iso?: string };
type Project = { name: string; url: string; lang: string | null; pushed: string; desc: string };

/** 2026-08-13 → 2026.08.13. 사이트의 다른 날짜와 같은 표기입니다. */
export const dotted = (iso: string) => iso.replace(/-/g, '.');

/* &amp;가 마지막이어야 합니다 — 먼저 풀면 "&amp;lt;"가 "<"까지 두 번 풀립니다. */
const unxml = (s: string) => s
  .replace(/&(?:#39|apos);/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const tag = (chunk: string, name: string) =>
  chunk.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? '';

/* 제목 끝에 줄줄이 붙는 해시태그는 유튜브 검색용이지 사람이 읽는 문장이 아닙니다.
   좁은 카드에서는 그것만 두 줄을 먹으므로 꼬리만 떼고, 떼서 남는 게 없으면 원문을 둡니다. */
const detag = (title: string) => title.replace(/(?:\s*#[^\s#]+)+\s*$/u, '').trim() || title;

/** 채널 RSS. 키도 인증도 한도도 없고 절대 날짜가 옵니다 — 되기만 하면 이쪽이 낫습니다. */
async function fromFeed(limit: number): Promise<Video[]> {
  const res = await grab(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${ME.youtubeChannelId}`,
    BROWSERISH,
  );
  const xml = await res.text();
  const videos = xml.split('<entry>').slice(1, limit + 1)
    .map((e) => {
      const iso = tag(e, 'published').slice(0, 10);
      return { id: tag(e, 'yt:videoId'), title: detag(unxml(tag(e, 'title'))), when: dotted(iso), iso };
    })
    .filter((v) => v.id && v.title);
  /* 200을 받고도 0개면 성공이 아닙니다. 빈 배열로 돌려보내면 화면에서 "아직 영상이 없는
     채널"과 구분되지 않고, 로그에도 아무것도 안 남아 다음 사람이 처음부터 다시 찾습니다. */
  if (!videos.length) {
    throw new Error(`응답은 ${res.status}인데 <entry>가 0개입니다 (${xml.length}B)`);
  }
  return videos;
}

/* ytInitialData 안에서 영상 한 칸이 담기는 모양. 유튜브 내부 구조라 언제든 바뀝니다. */
type Lockup = {
  contentId?: string;
  metadata?: {
    lockupMetadataViewModel?: {
      title?: { content?: string };
      metadata?: {
        contentMetadataViewModel?: {
          metadataRows?: { metadataParts?: { text?: { content?: string } }[] }[];
        };
      };
    };
  };
};

/* 2026-08 현재 /feeds/videos.xml이 이 채널에서 404를 냅니다(채널 ID는 채널 페이지가 알려주는
   그 값이 맞습니다). 그래서 채널 페이지에 박혀 오는 초기 데이터에서 직접 읽습니다.
   구조가 바뀌면 여기서 0개가 나오고, 부르는 쪽의 fell()이 빌드 로그에 남깁니다. */
async function fromChannelPage(limit: number): Promise<Video[]> {
  const res = await grab(`https://www.youtube.com/${ME.youtubeHandle}/videos`, BROWSERISH);
  const html = await res.text();
  const raw = html.match(/var ytInitialData = (\{.*?\});<\/script>/s)?.[1];
  if (!raw) throw new Error('채널 페이지에서 ytInitialData를 못 찾았습니다');

  const out: Video[] = [];
  const walk = (node: unknown) => {
    if (out.length >= limit || !node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'lockupViewModel') {
        const lock = value as Lockup;
        const meta = lock.metadata?.lockupMetadataViewModel;
        const title = meta?.title?.content;
        // 마지막 조각이 시각입니다 ("조회수 4회 • 1개월 전").
        const parts = meta?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts ?? [];
        const when = parts[parts.length - 1]?.text?.content ?? '';
        if (lock.contentId && title) out.push({ id: lock.contentId, title: detag(title), when });
        continue;
      }
      walk(value);
    }
  };
  walk(JSON.parse(raw));

  if (!out.length) throw new Error('채널 페이지에서 영상을 0개 읽었습니다 — 구조가 바뀐 것 같습니다');
  return out;
}

/** 최신 영상. 피드가 되면 피드로, 안 되면 채널 페이지에서 읽습니다. */
export async function recentVideos(limit = 4): Promise<Video[]> {
  try {
    return await fromFeed(limit);
  } catch (err) {
    console.warn('[feeds] YouTube 피드가 안 돼서 채널 페이지로 갑니다:', (err as Error).message);
  }
  try {
    return await fromChannelPage(limit);
  } catch (err) {
    return fell('YouTube', err);
  }
}

type Repo = {
  name: string; html_url: string; description: string | null;
  language: string | null; pushed_at: string; fork: boolean; archived: boolean;
};

/** 최근에 손댄 순. 포크와 보관된 것은 "지금 하는 일"이 아니라 뺍니다. */
export async function recentProjects(limit = 4): Promise<Project[]> {
  try {
    const repos: Repo[] = await (await grab(
      `https://api.github.com/users/${ME.githubLogin}/repos?sort=pushed&per_page=20`,
      // GitHub은 User-Agent 없는 요청을 403으로 돌려보냅니다.
      { accept: 'application/vnd.github+json', 'user-agent': ME.githubLogin },
    )).json();
    const list = repos
      .filter((r) => !r.fork && !r.archived)
      .slice(0, limit)
      .map((r) => ({
        name: r.name,
        url: r.html_url,
        lang: r.language,
        pushed: r.pushed_at.slice(0, 10),
        desc: r.description ?? '',
      }));
    // 위와 같은 이유입니다 — 받아 왔는데 0개인 것은 성공이 아니라 조용한 실패입니다.
    if (!list.length) throw new Error(`저장소 ${repos.length}개를 받았는데 걸 것이 0개입니다`);
    return list;
  } catch (err) {
    return fell('GitHub 저장소', err);
  }
}
