import React, { useState, useEffect } from 'react';
import { Search, Play, Settings, X, Loader2, Youtube, AlertCircle, User, Calendar, Eye, FileText, ChevronLeft, Download } from 'lucide-react';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState('search'); 
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channelVideos, setChannelVideos] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  // [배포앱] 초기 로드 시 저장된 키 불러오기
  useEffect(() => {
    const storedKey = localStorage.getItem('yt_api_key');
    if (storedKey) setApiKey(storedKey);
    else setShowSettings(true);
  }, []);

  // [배포앱] 키 저장 함수
  const saveApiKey = () => {
    localStorage.setItem('yt_api_key', apiKey);
    setShowSettings(false);
    setError(null);
  };

  const decodeHtml = (html) => {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  const formatCount = (count) => {
    if (!count) return '0';
    const num = parseInt(count, 10);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const searchChannels = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!apiKey) {
      setError("API 키가 필요합니다. 우측 상단 설정에서 키를 입력해주세요.");
      setShowSettings(true);
      return;
    }
    setLoading(true); setError(null); setViewMode('search'); setChannels([]);

    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(query)}&type=channel&key=${apiKey}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || '오류 발생');
      setChannels(data.items);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleChannelClick = async (channelId, channelTitle) => {
    setLoadingVideos(true); setError(null); setChannelVideos([]); setNextPageToken(null);
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`);
      const data = await res.json();
      if (!data.items?.length) throw new Error("채널 정보 없음");
      const uploadsId = data.items[0].contentDetails.relatedPlaylists.uploads;
      setSelectedChannel({ id: channelId, title: channelTitle, uploadsId });
      await fetchVideosFromPlaylist(uploadsId, null);
      setViewMode('videos');
    } catch (err) { setError(err.message); } finally { setLoadingVideos(false); }
  };

  const fetchVideosFromPlaylist = async (playlistId, pageToken) => {
    try {
      let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=12&playlistId=${playlistId}&key=${apiKey}`;
      if (pageToken) url += `&pageToken=${pageToken}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message);
      setNextPageToken(data.nextPageToken);
      const videoIds = data.items.map(item => item.snippet.resourceId.videoId).join(',');
      if (videoIds) {
        const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${apiKey}`);
        const statsData = await statsRes.json();
        const merged = data.items.map(item => {
          const stat = statsData.items.find(v => v.id === item.snippet.resourceId.videoId);
          return { ...item, statistics: stat ? stat.statistics : { viewCount: 0 }, publishDate: item.snippet.publishedAt };
        });
        setChannelVideos(prev => pageToken ? [...prev, ...merged] : merged);
      }
    } catch (err) { setError(err.message); }
  };

  const loadMoreVideos = async () => {
    if (selectedChannel && nextPageToken) {
      setLoadingVideos(true);
      await fetchVideosFromPlaylist(selectedChannel.uploadsId, nextPageToken);
      setLoadingVideos(false);
    }
  };

  const downloadTranscript = async (videoTitle, videoId) => {
    if (downloadingId) return;
    setDownloadingId(videoId);
    try {
      const response = await fetch(`/api/transcript?videoId=${videoId}`);
      if (!response.ok) throw new Error('자막을 가져올 수 없습니다 (자동 자막 없음/제한됨)');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      const blob = new Blob([data.transcript], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${videoTitle}_transcript.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) { alert(`다운로드 실패: ${err.message}`); }
    finally { setDownloadingId(null); }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-red-600 cursor-pointer" onClick={() => { setViewMode('search'); setQuery(''); setChannels([]); }}>
            <Youtube size={32} fill="currentColor" />
            <span className="text-xl font-bold text-gray-900 hidden sm:block">Channel Explorer</span>
          </div>
          <form onSubmit={searchChannels} className="flex-1 max-w-xl flex gap-2">
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="채널 검색..." className="w-full pl-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:border-red-500" />
            <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded-full hover:bg-red-700"><Search size={20} /></button>
          </form>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full relative">
            <Settings size={24} />
            {!apiKey && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>}
          </button>
        </div>
      </header>
      {showSettings && (
        <div className="bg-gray-800 text-white p-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-4">
            <span className="text-sm font-bold">YouTube API Key:</span>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="flex-1 p-2 rounded bg-gray-700 border border-gray-600 text-sm w-full" placeholder="AIzaSy..." />
            <button onClick={saveApiKey} className="bg-red-600 px-4 py-2 rounded text-sm hover:bg-red-700">저장</button>
            <button onClick={() => setShowSettings(false)}><X size={20}/></button>
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3 border border-red-100"><AlertCircle size={20} /><p className="text-sm font-medium">{error}</p></div>}
        {viewMode === 'search' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {channels.map(item => (
              <div key={item.id.channelId} onClick={() => handleChannelClick(item.id.channelId, decodeHtml(item.snippet.title))} className="bg-white p-6 rounded-xl shadow hover:shadow-md cursor-pointer border flex flex-col items-center text-center transition-transform hover:-translate-y-1">
                <img src={item.snippet.thumbnails.medium.url} className="w-24 h-24 rounded-full mb-4 ring-4 ring-gray-50" alt="" />
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{decodeHtml(item.snippet.title)}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-4">{item.snippet.description}</p>
                <span className="text-xs font-medium text-red-600 bg-red-50 px-3 py-1 rounded-full">채널 보기</span>
              </div>
            ))}
            {channels.length === 0 && !loading && <div className="col-span-full text-center py-20 text-gray-400"><User size={48} className="mx-auto mb-4 opacity-20"/><p>검색어를 입력하세요.</p></div>}
          </div>
        )}
        {viewMode === 'videos' && selectedChannel && (
          <div className="animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b">
              <button onClick={() => setViewMode('search')}><ChevronLeft size={24}/></button>
              <h2 className="text-2xl font-bold">{decodeHtml(selectedChannel.title)} <span className="text-sm font-normal text-gray-500">영상 목록</span></h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {channelVideos.map(video => (
                <div key={video.id} className="bg-white rounded-xl overflow-hidden shadow-sm border flex flex-col">
                  <a href={`https://www.youtube.com/watch?v=${video.snippet.resourceId.videoId}`} target="_blank" rel="noreferrer" className="relative aspect-video bg-gray-200 group">
                    <img src={video.snippet.thumbnails.medium?.url} className="w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Play fill="white" className="text-white" size={40} /></div>
                  </a>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-medium line-clamp-2 mb-3 h-12 leading-snug" title={decodeHtml(video.snippet.title)}>{decodeHtml(video.snippet.title)}</h3>
                    <div className="mt-auto space-y-3">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Eye size={12}/> {formatCount(video.statistics?.viewCount)}</span>
                        <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(video.publishDate).toLocaleDateString()}</span>
                      </div>
                      <button onClick={() => downloadTranscript(decodeHtml(video.snippet.title), video.snippet.resourceId.videoId)} disabled={downloadingId === video.snippet.resourceId.videoId} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded bg-gray-50 hover:bg-gray-100 border transition-colors">
                        {downloadingId === video.snippet.resourceId.videoId ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>} 자막 다운로드
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {nextPageToken && (
              <div className="text-center mt-8 pb-10">
                <button onClick={loadMoreVideos} disabled={loadingVideos} className="px-6 py-2 bg-white border rounded-full shadow-sm hover:bg-gray-50 flex items-center gap-2 mx-auto">
                  {loadingVideos && <Loader2 className="animate-spin" size={16}/>} 더 보기
                </button>
              </div>
            )}
          </div>
        )}
        {loading && <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={48}/></div>}
      </main>
    </div>
  );
}