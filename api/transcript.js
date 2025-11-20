import { YoutubeTranscript } from 'youtube-transcript';

export default async function handler(req, res) {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Video ID required' });

  // 자막 가져오기 시도 헬퍼 함수
  const tryFetch = async (config) => {
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId, config);
      return items;
    } catch (e) { return null; }
  };

  try {
    // 1. 한국어 시도
    let items = await tryFetch({ lang: 'ko' });
    
    // 2. 영어 시도 (자동자막이 보통 영어로 잡힘)
    if (!items) items = await tryFetch({ lang: 'en' });

    // 3. 기본값 시도 (설정 없음)
    if (!items) items = await tryFetch();

    // 4. 일본어 시도 (옵션)
    if (!items) items = await tryFetch({ lang: 'ja' });

    if (!items) {
      throw new Error('모든 언어 설정으로 시도했으나 자막을 찾을 수 없습니다.');
    }

    const text = items.map(i => i.text).join(' ');
    res.status(200).json({ transcript: text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '자막 다운로드 실패 (자동 자막 미지원 또는 IP 차단)' });
  }
}