import React, { useState, useEffect } from 'react';
import { Search, Play, Settings, X, Loader2, Youtube, AlertCircle, User, Calendar, Eye, FileText, ChevronLeft, Download, Copy, Check, Github, Upload, Save, RefreshCw, CloudLightning } from 'lucide-react';

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
  
  const [transcriptModal, setTranscriptModal] = useState({ isOpen: false, videoId: null, title: '', content: '', loading: false, error: null });
  const [copySuccess, setCopySuccess] = useState(false);

  // GitHub 및 설정 초기화
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [ghToken, setGhToken] = useState('');
  const [ghRepoName, setGhRepoName] = useState('');
  const [ghUsername, setGhUsername] = useState('');
  const [deployStatus, setDeployStatus] = useState({ type: 'idle', message: '' });
  const [isConfigured, setIsConfigured] = useState(false);
  const [syncModal, setSyncModal] = useState({ isOpen: false, step: 'idle', message: '' });

  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('yt_api_key');
      if (storedKey) setApiKey(storedKey);
      else setShowSettings(true);
      
      const storedGhToken = localStorage.getItem('gh_pat');
      const storedGhUser = localStorage.getItem('gh_username');
      const storedGhRepo = localStorage.getItem('gh_repo_name');
      if (storedGhToken) setGhToken(storedGhToken);
      if (storedGhUser) setGhUsername(storedGhUser);
      if (storedGhRepo) setGhRepoName(storedGhRepo);
      if (storedGhToken && storedGhUser && storedGhRepo) setIsConfigured(true);
    } catch (e) {}
  }, []);

  useEffect(() => { if (apiKey) try { localStorage.setItem('yt_api_key', apiKey); } catch (e) {} }, [apiKey]);
  useEffect(() => { 
    if (ghToken) localStorage.setItem('gh_pat', ghToken);
    if (ghUsername) localStorage.setItem('gh_username', ghUsername);
    if (ghRepoName) localStorage.setItem('gh_repo_name', ghRepoName);
    if (ghToken && ghUsername && ghRepoName) setIsConfigured(true);
  }, [ghToken, ghUsername, ghRepoName]);

  const githubHeaders = { 'Authorization': `token ${ghToken}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' };
  const uploadFileToGithub = async (path, content, owner, repo) => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    let sha = null;
    try { const checkRes = await fetch(url, { headers: githubHeaders }); if (checkRes.ok) { const data = await checkRes.json(); sha = data.sha; } } catch (e) {}
    const body = { message: `Update ${path} from Web`, content: btoa(unescape(encodeURIComponent(content))) };
    if (sha) body.sha = sha;
    const res = await fetch(url, { method: 'PUT', headers: githubHeaders, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Failed to upload ${path}`);
  };

  const decodeHtml = (html) => { const txt = document.createElement("textarea"); txt.innerHTML = html; return txt.value; };
  const formatCount = (count) => { const num = parseInt(count||0, 10); return num >= 1000000 ? (num/1000000).toFixed(1)+'M' : num >= 1000 ? (num/1000).toFixed(1)+'K' : num.toLocaleString(); };
  const formatDate = (iso) => new Date(iso).toLocaleDateString('ko-KR', {year:'numeric', month:'long', day:'numeric'});

  const searchChannels = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!apiKey) { setError("API 키 필요"); setShowSettings(true); return; }
    setLoading(true); setError(null); setViewMode('search'); setChannels([]);
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(query)}&type=channel&key=${apiKey}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message);
      setChannels(data.items);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleChannelClick = async (channelId, channelTitle) => {
    setLoadingVideos(true); setError(null); setChannelVideos([]); setNextPageToken(null);
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`);
      const data = await res.json();
      if (!data.items?.length) throw new Error("정보 없음");
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

  // =====================================================
  // [핵심] 500 에러 해결을 위한 멀티 인스턴스 우회 로직
  // =====================================================
  const PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",       // 메인
    "https://api.piped.otter.sh",         // 백업 1
    "https://piped-api.garudalinux.org",  // 백업 2
    "https://api.piped.privacy.com.de",   // 백업 3
    "https://pipedapi.tokhmi.xyz"         // 백업 4
  ];

  const fetchPipedTranscript = async (videoId) => {
    let lastError = null;
    
    // 여러 서버를 순차적으로 시도
    for (const instance of PIPED_INSTANCES) {
      try {
        // 1. 해당 서버에서 비디오 정보(자막 목록) 조회
        const res = await fetch(`${instance}/streams/${videoId}`);
        if (!res.ok) continue; // 실패시 다음 서버로
        
        const data = await res.json();
        const subtitles = data.subtitles || [];
        if (subtitles.length === 0) continue; // 자막 없으면 다음 서버 확인
        
        // 2. 자막 트랙 선택 (한글 > 영어 > 자동생성)
        let track = subtitles.find(s => s.code === 'ko' && !s.autoGenerated) ||
                    subtitles.find(s => s.code === 'en' && !s.autoGenerated) ||
                    subtitles.find(s => s.code === 'ko') ||
                    subtitles[0];
        
        // 3. 실제 자막 텍스트 요청
        const subRes = await fetch(track.url);
        if (!subRes.ok) continue;
        
        const text = await subRes.text();
        // VTT 포맷 정리
        const cleanText = text.split('\n')
          .filter(l => !l.includes('-->') && l.trim().length > 0 && !l.startsWith('WEBVTT'))
          .join(' ');
          
        return cleanText; // 성공 시 반환
      } catch (err) {
        lastError = err;
        console.warn(`Failed with ${instance}`, err);
        continue;
      }
    }
    throw lastError || new Error("모든 우회 서버가 응답하지 않습니다.");
  };

  const openTranscriptModal = async (videoTitle, videoId) => {
    setTranscriptModal({ isOpen: true, videoId, title: videoTitle, content: '', loading: true, error: null });
    try {
      // 1. Vercel API 시도 (500 에러 자주 발생하므로 실패 시 무시하고 넘어감)
      try {
        const response = await fetch(`/api/transcript?videoId=${videoId}`);
        if (response.ok) {
           const data = await response.json();
           if (data.transcript) {
             setTranscriptModal(prev => ({ ...prev, content: data.transcript, loading: false }));
             return;
           }
        }
      } catch(e) { console.log("Backend failed, switching to fallback..."); }

      // 2. Piped 멀티 인스턴스 우회 시도
      const text = await fetchPipedTranscript(videoId);
      setTranscriptModal(prev => ({ ...prev, content: text, loading: false }));

    } catch (err) {
      setTranscriptModal(prev => ({ ...prev, loading: false, error: err.message, content: "자막을 가져올 수 없습니다. (서버 차단 또는 자막 없음)" }));
    }
  };

  const copyToClipboard = () => { navigator.clipboard.writeText(transcriptModal.content).then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }); };
  const saveAsTxt = () => { const blob = new Blob([transcriptModal.content], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${transcriptModal.title}_transcript.txt`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-red-600 cursor-pointer shrink-0" onClick={() => { setViewMode('search'); setQuery(''); }}>
            <Youtube size={32} fill="currentColor" />
            <span className="text-xl font-bold hidden sm:block">Channel Explorer</span>
          </div>
          <form onSubmit={searchChannels} className="flex-1 max-w-xl flex gap-2">
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="채널 검색..." className="w-full pl-4 px-4 py-2 rounded-full border border-gray-300 focus:border-red-500 focus:outline-none" />
            <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded-full hover:bg-red-700"><Search size={20} /></button>
          </form>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full relative">
              <Settings size={24} />{!apiKey && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>}
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="bg-gray-800 text-white p-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-4">
            <span className="text-sm font-bold">YouTube API Key:</span>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="flex-1 p-2 rounded bg-gray-700 border border-gray-600 text-sm w-full" />
            <button onClick={() => setShowSettings(false)} className="bg-yellow-600 text-white px-4 py-2 rounded text-sm">닫기</button>
          </div>
        </div>
      )}

      {transcriptModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold truncate pr-4">{transcriptModal.title}</h3><button onClick={() => setTranscriptModal(prev => ({...prev, isOpen: false}))}><X size={24}/></button></div>
            <div className="flex-1 p-4 overflow-hidden relative">
              {transcriptModal.loading ? <div className="absolute inset-0 flex items-center justify-center bg-white flex-col"><Loader2 className="animate-spin text-red-600 mb-2" size={40}/><p className="text-sm text-gray-500">우회 서버 접속 중...</p></div> : <textarea className="w-full h-full resize-none border rounded p-4 text-sm focus:outline-none" value={transcriptModal.content} readOnly />}
            </div>
            <div className="p-4 border-t bg-gray-50 flex gap-3 justify-end"><button onClick={copyToClipboard} className="px-4 py-2 bg-white border rounded text-sm">복사</button><button onClick={saveAsTxt} className="px-4 py-2 bg-gray-900 text-white rounded text-sm">저장</button></div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3 border border-red-100"><AlertCircle size={20} /><p className="text-sm font-medium">{error}</p></div>}
        {viewMode === 'search' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {channels.map(item => (
              <div key={item.id.channelId} onClick={() => handleChannelClick(item.id.channelId, decodeHtml(item.snippet.title))} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md cursor-pointer border border-gray-100 flex flex-col items-center text-center hover:-translate-y-1 transition-all">
                <img src={item.snippet.thumbnails.medium.url} className="w-24 h-24 rounded-full mb-4 ring-4 ring-gray-50" alt=""/>
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{decodeHtml(item.snippet.title)}</h3>
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
              <h2 className="text-2xl font-bold">{decodeHtml(selectedChannel.title)}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {channelVideos.map(video => (
                <div key={video.id} className="bg-white rounded-xl overflow-hidden shadow-sm border flex flex-col">
                  <div className="relative aspect-video bg-gray-200"><img src={video.snippet.thumbnails.medium?.url} className="w-full h-full object-cover" alt=""/></div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-medium line-clamp-2 mb-3 h-12 leading-snug">{decodeHtml(video.snippet.title)}</h3>
                    <div className="mt-auto space-y-3">
                      <div className="flex justify-between text-xs text-gray-500"><span><Eye size={12} className="inline mr-1"/>{formatCount(video.statistics?.viewCount)}</span><span><Calendar size={12} className="inline mr-1"/>{formatDate(video.publishDate)}</span></div>
                      <button onClick={() => openTranscriptModal(decodeHtml(video.snippet.title), video.snippet.resourceId.videoId)} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded bg-gray-50 hover:bg-gray-100 border transition-colors"><FileText size={14} /> 자막 보기</button>
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
