import { YoutubeTranscript } from 'youtube-transcript';

export default async function handler(req, res) {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Video ID required' });

  const tryFetch = async (config) => {
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId, config);
      if (!items || items.length === 0) return null;
      return items;
    } catch (e) { return null; }
  };

  try {
    // 1. 기본값 시도 (가장 성공률 높음)
    let items = await tryFetch();
    
    // 2. 한국어 시도
    if (!items) items = await tryFetch({ lang: 'ko' });

    // 3. 영어 시도
    if (!items) items = await tryFetch({ lang: 'en' });

    if (!items) throw new Error('자막을 찾을 수 없습니다.');

    const text = items.map(i => i.text).join(' ');
    res.status(200).json({ transcript: text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '자막을 불러올 수 없습니다.' });
  }
}