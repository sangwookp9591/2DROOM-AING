import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['three'],
  // transformers.js는 서버 전용 onnxruntime-node 바이너리를 함께 싣습니다.
  // 모델은 브라우저 워커에서만 도므로 서버 번들에서 통째로 뺍니다.
  serverExternalPackages: ['@huggingface/transformers'],
};

export default config;
