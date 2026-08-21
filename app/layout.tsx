import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '박상욱 (iron) — 문제를 끝까지 해결하는 풀스택 개발자',
  description:
    '사용자가 막히는 지점과 팀의 반복 실수를 찾아 웹, 운영도구, 백엔드까지 해결해 온 박상욱의 포트폴리오입니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 제목·본문 폰트는 CSS 파일로, 손글씨 폰트는 Google Fonts로 불러옵니다. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gaegu:wght@700&family=Nanum+Pen+Script&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/subsets/Paperlogy-dynamic-subset.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
