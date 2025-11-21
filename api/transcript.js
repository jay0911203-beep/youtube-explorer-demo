import { YoutubeTranscript } from 'youtube-transcript';
export default async function handler(req, res) {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Video ID required' });
  const tryFetch = async (c) => { try { const i = await YoutubeTranscript.fetchTranscript(videoId, c); return (i && i.length) ? i : null; } catch (e) { return null; } };
  try {
    let items = await tryFetch();
    if (!items) items = await tryFetch({ lang: 'ko' });
    if (!items) items = await tryFetch({ lang: 'en' });
    if (!items) throw new Error('No transcript found');
    res.status(200).json({ transcript: items.map(i => i.text).join(' ') });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch transcript' }); }
}