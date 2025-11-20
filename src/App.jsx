import React, { useState, useEffect, useRef } from 'react';
import { Search, Play, Settings, X, Loader2, Youtube, AlertCircle, User, Calendar, Eye, FileText, ChevronLeft, Download, Copy, Check } from 'lucide-react';

export default function App() {
  const [apiKey, setApiKey] = useState('AIzaSyAvQGtMOXN2RYKDw4MD98jBxDAZTNTyLFs');
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
  
  // 자막 모달 상태
  const [transcriptModal, setTranscriptModal] = useState({ isOpen: false, videoId: null, title: '', content: '', loading: false, error: null });
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('yt_api_key');
      if (storedKey) setApiKey(storedKey);
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (apiKey) try { localStorage.setItem('yt_api_key', apiKey); } catch (e) {}
  }, [apiKey]);

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
    if (!apiKey) { setError("API 키 필요"); setShowSettings(true); return; }
    setLoading(true); setError(null); setViewMode('search'); setChannels([]);
    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(query)}&type=channel&key=${apiKey}`);
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
        const sRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${apiKey}`);
        const sData = await sRes.json();
        const merged = data.items.map(item => {
          const stat = sData.items.find(v => v.id === item.snippet.resourceId.videoId);
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

  // --- 자막 뷰어 로직 ---
  const openTranscriptModal = async (videoTitle, videoId) => {
    setTranscriptModal({ isOpen: true, videoId, title: videoTitle, content: '', loading: true, error: null });
    
    try {
      const response = await fetch(`/api/transcript?videoId=${videoId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '자막을 가져올 수 없습니다.');
      }
      
      setTranscriptModal(prev => ({ ...prev, content: data.transcript, loading: false }));
    } catch (err) {
      setTranscriptModal(prev => ({ 
        ...prev, 
        loading: false, 
        error: err.message,
        content: "[오류] 이 영상의 자막을 추출할 수 없습니다.\n\n원인: 자동 생성 자막이 없거나, 유튜브 정책으로 인해 접근이 제한된 영상입니다.\n\n(Gemini 등 다른 도구를 사용하여 텍스트를 추출한 뒤 여기에 붙여넣어 저장하실 수 있습니다.)" 
      }));
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcriptModal.content).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const saveAsTxt = () => {
    const blob = new Blob([transcriptModal.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${transcriptModal.title}_transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-red-600 cursor-pointer" onClick={() => { setViewMode('search'); setQuery(''); setChannels([]); }}>
            <Youtube size={32} fill="currentColor" />
            <span className="text-xl font-bold text-gray-900 hidden sm:block">Channel Explorer</span>
          </div>
          <form onSubmit={searchChannels} className="flex-1 max-w-xl flex gap-2">
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="채널 검색..." className="w-full pl-4 px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:border-red-500" />
            <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded-full hover:bg-red-700"><Search size={20} /></button>
          </form>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full relative">
            <Settings size={24} />{!apiKey && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>}
          </button>
        </div>
      </header>

      {/* 설정창 */}
      {showSettings && (
        <div className="bg-gray-800 text-white p-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-4">
            <span className="text-sm font-bold">YouTube API Key:</span>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="flex-1 p-2 rounded bg-gray-700 border border-gray-600 text-sm w-full" />
            <button onClick={() => setShowSettings(false)} className="bg-yellow-600 text-white px-4 py-2 rounded text-sm">닫기</button>
          </div>
        </div>
      )}

      {/* 자막 뷰어 모달 */}
      {transcriptModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg truncate pr-4">{transcriptModal.title}</h3>
              <button onClick={() => setTranscriptModal(prev => ({ ...prev, isOpen: false }))} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 p-4 overflow-hidden relative">
              {transcriptModal.loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
                  <Loader2 className="animate-spin text-red-600 mb-2" size={40} />
                  <p className="text-gray-500">자막을 불러오는 중입니다...</p>
                </div>
              ) : (
                <textarea 
                  className={`w-full h-full resize-none border rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm leading-relaxed ${transcriptModal.error ? 'text-red-600 bg-red-50' : 'text-gray-800'}`}
                  value={transcriptModal.content}
                  onChange={(e) => setTranscriptModal(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="자막 내용이 여기에 표시됩니다."
                />
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex gap-3 justify-end">
              <button 
                onClick={copyToClipboard}
                disabled={transcriptModal.loading || !transcriptModal.content}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
              >
                {copySuccess ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                {copySuccess ? '복사됨!' : '내용 복사'}
              </button>
              <button 
                onClick={saveAsTxt}
                disabled={transcriptModal.loading || !transcriptModal.content}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors text-sm font-medium"
              >
                <Download size={16} />
                TXT로 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3 border border-red-100"><AlertCircle size={20} /><p className="text-sm font-medium">{error}</p></div>}
        
        {viewMode === 'search' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {channels.map(item => (
              <div key={item.id.channelId} onClick={() => handleChannelClick(item.id.channelId, item.snippet.title)} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md cursor-pointer border border-gray-100 flex flex-col items-center text-center hover:-translate-y-1 transition-all">
                <img src={item.snippet.thumbnails.medium.url} className="w-24 h-24 rounded-full mb-4 ring-4 ring-gray-50" alt=""/>
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{item.snippet.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-4">{item.snippet.description}</p>
                <span className="text-xs font-medium text-red-600 bg-red-50 px-3 py-1 rounded-full">채널 보기</span>
              </div>
            ))}
            {channels.length === 0 && !loading && <div className="col-span-full text-center py-20 text-gray-400"><User size={48} className="mx-auto mb-4 opacity-20"/><p>검색어를 입력하세요.</p></div>}
          </div>
        )}

        {viewMode === 'videos' && selectedChannel && (
          <div className="animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-4 mb-8 pb-4 border-b">
              <button onClick={() => setViewMode('search')}><ChevronLeft size={24}/></button>
              <h2 className="text-2xl font-bold">{decodeHtml(selectedChannel.title)} <span className="text-sm font-normal text-gray-500">영상 목록</span></h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {channelVideos.map(video => (
                <div key={video.id} className="bg-white rounded-xl overflow-hidden shadow-sm border flex flex-col">
                  <a href={`https://www.youtube.com/watch?v=${video.snippet.resourceId.videoId}`} target="_blank" rel="noreferrer" className="relative aspect-video bg-gray-200 group">
                    <img src={video.snippet.thumbnails.medium?.url} className="w-full h-full object-cover" alt=""/>
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Play fill="white" className="text-white" size={40} /></div>
                  </a>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-medium line-clamp-2 mb-3 h-12 leading-snug">{video.snippet.title}</h3>
                    <div className="mt-auto space-y-3">
                      <div className="flex justify-between text-xs text-gray-500"><span className="flex items-center gap-1"><Eye size={12}/> {formatCount(video.statistics?.viewCount)}</span><span className="flex items-center gap-1"><Calendar size={12}/> {new Date(video.publishDate).toLocaleDateString()}</span></div>
                      <button onClick={() => openTranscriptModal(decodeHtml(video.snippet.title), video.snippet.resourceId.videoId)} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded bg-gray-50 hover:bg-gray-100 border transition-colors">
                        <FileText size={14} /> 자막 보기
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {nextPageToken && <div className="text-center mt-8"><button onClick={loadMoreVideos} disabled={loadingVideos} className="px-6 py-2 bg-white border rounded-full shadow-sm hover:bg-gray-50 flex items-center gap-2 mx-auto">{loadingVideos && <Loader2 className="animate-spin" size={16}/>} 더 보기</button></div>}
          </div>
        )}
        {loading && <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={48}/></div>}
      </main>
    </div>
  );
}