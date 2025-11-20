import { YoutubeTranscript } from 'youtube-transcript';

export default async function handler(req, res) {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  async function fetchWithLang(lang) {
    try {
      const config = lang ? { lang } : undefined;
      const items = await YoutubeTranscript.fetchTranscript(videoId, config);
      if (!items || items.length === 0) return null;
      return items.map(item => item.text).join('\n');
    } catch (e) {
      return null;
    }
  }

  try {
    let text = await fetchWithLang('ko');
    if (!text) text = await fetchWithLang('en');
    if (!text) text = await fetchWithLang();

    if (!text) throw new Error('자막을 찾을 수 없습니다.');

    res.status(200).json({ transcript: text });
  } catch (error) {
    console.error('Transcript error:', error);
    res.status(500).json({ 
      error: '이 영상은 자막(CC)을 제공하지 않거나, 자동 생성 자막을 가져올 수 없는 영상입니다.' 
    });
  }
}