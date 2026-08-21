import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '박상욱 (iron) — 복도를 걷는 포트폴리오',
  description:
    '기술 이름을 간판으로 걸지 않고 장소와 사물로 말하는 포트폴리오. 복도를 걷다 문을 열면 웹·어드민·백엔드·지난 작업·공방·공유 여섯 개의 작업 공간이 나옵니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/*
          next/font는 이 한글 서체들의 korean 서브셋을 모릅니다 (latin만 노출).
          그걸로 받으면 한글이 폴백으로 떨어져 손글씨 인상이 통째로 사라집니다.
          그래서 link로 두되, CSS @import는 피합니다 — @import는 globals.css를
          받아 파싱한 뒤에야 시작돼 폰트 요청이 두 홉 뒤로 밀립니다.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gaegu:wght@700&family=Gowun+Dodum&family=Nanum+Pen+Script&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
