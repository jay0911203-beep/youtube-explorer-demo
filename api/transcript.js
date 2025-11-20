import { YoutubeTranscript } from 'youtube-transcript';

export default async function handler(req, res) {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Video ID is required' });

  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
    const formattedText = transcriptItems.map(item => item.text).join('\n');
    res.status(200).json({ transcript: formattedText });
  } catch (error) {
    res.status(500).json({ error: '자막을 가져오는데 실패했습니다.' });
  }
}