import { YoutubeTranscript } from 'youtube-transcript';
export default async function handler(req, res) {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Video ID required' });
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId);
    res.status(200).json({ transcript: items.map(i => i.text).join(' ') });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
}