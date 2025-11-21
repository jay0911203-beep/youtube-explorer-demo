
import { YoutubeTranscript } from 'youtube-transcript';

export default async function handler(req, res) {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  try {
    // 1. 한국어 자막 시도
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: 'ko'
    });
    
    // 텍스트만 추출하여 합침
    const text = transcript.map(item => item.text).join(' ');
    res.status(200).json({ success: true, transcript: text, lang: 'ko' });

  } catch (error) {
    console.log("Korean failed, trying English...");
    // 2. 한국어 실패 시 영어 시도
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'en'
      });
      const text = transcript.map(item => item.text).join(' ');
      res.status(200).json({ success: true, transcript: text, lang: 'en' });
    } catch (err) {
      // 3. 모두 실패 (자동 생성 자막이라도 시도)
      try {
         const transcript = await YoutubeTranscript.fetchTranscript(videoId);
         const text = transcript.map(item => item.text).join(' ');
         res.status(200).json({ success: true, transcript: text, lang: 'auto' });
      } catch (finalErr) {
         res.status(500).json({ 
           success: false, 
           error: '모든 언어의 자막을 불러올 수 없습니다.' 
         });
      }
    }
  }
}