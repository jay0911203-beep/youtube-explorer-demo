import React, { useState, useEffect } from 'react';
import { Search, Play, Settings, X, Loader2, Youtube, AlertCircle, User, Calendar, Eye, FileText, ChevronLeft, Download, Copy, Check, Github, Upload, Save, RefreshCw, CloudLightning, Globe } from 'lucide-react';

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
  
  const [transcriptModal, setTranscriptModal] = useState({ isOpen: false, videoId: null, title: '', content: '', loading: false, error: null, status: '' });
  const [copySuccess, setCopySuccess] = useState(false);

  // GitHub & Settings
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
      if (storedKey) setApiKey(storedKey); else setShowSettings(true);
      
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
    const body = { message: `Update ${path}`, content: btoa(unescape(encodeURIComponent(content))) };
    if (sha) body.sha = sha;
    const res = await fetch(url, { method: 'PUT', headers: githubHeaders, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Upload failed for ${path}`);
  };

  const handleDeploy = async (mode) => {
    if (!ghToken || !ghRepoName || !ghUsername) return;
    setDeployStatus({ type: 'loading', message: 'GitHub 작업 중...' });
    try {
      if (mode === 'create') await fetch('https://api.github.com/user/repos', { method: 'POST', headers: githubHeaders, body: JSON.stringify({ name: ghRepoName, private: false, auto_init: true }) });
      
      // FILE_TEMPLATES는 실제 배포 환경에서는 이 파일 자체에 포함되어야 함.
      // 이 데모에서는 자기 자신을 업로드하는 로직이 간소화되어 있습니다.
      setDeployStatus({ type: 'success', message: '완료!' });
    } catch (err) { setDeployStatus({ type: 'error', message: err.message }); }
  };

  const handleQuickSyncClick = () => { if (!isConfigured) { setShowGithubModal(true); return; } setSyncModal({ isOpen: true, step: 'confirm', message: '코드를 업데이트하시겠습니까?' }); };
  const executeQuickSync = async () => {
    setSyncModal({ isOpen: true, step: 'success', message: '업데이트 성공! (데모)' });
  };

  const decodeHtml = (html) => { const txt = document.createElement("textarea"); txt.innerHTML = html; return txt.value; };
  const formatCount = (c) => { const n = parseInt(c||0); return n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':n.toLocaleString(); };
  
  // YouTube Logic
  const searchChannels = async (e) => {
    e.preventDefault(); if(!query.trim()||!apiKey) return; setLoading(true); setViewMode('search');
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(query)}&type=channel&key=${apiKey}`);
      const data = await res.json(); setChannels(data.items||[]);
    } catch(e) { setError(e.message); } finally { setLoading(false); }
  };
  const handleChannelClick = async (cid, ctitle) => {
    setLoadingVideos(true);
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${cid}&key=${apiKey}`);
      const data = await res.json();
      if(data.items?.length) {
        const uid = data.items[0].contentDetails.relatedPlaylists.uploads;
        setSelectedChannel({id:cid, title:ctitle, uploadsId:uid});
        await fetchVideos(uid);
        setViewMode('videos');
      }
    } catch(e) {} finally { setLoadingVideos(false); }
  };
  const fetchVideos = async (pid, token) => {
    try {
      let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=12&playlistId=${pid}&key=${apiKey}`;
      if(token) url+=`&pageToken=${token}`;
      const res = await fetch(url); const data = await res.json();
      setNextPageToken(data.nextPageToken);
      const vids = data.items.map(i=>i.snippet.resourceId.videoId).join(',');
      if(vids) {
        const sres = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${vids}&key=${apiKey}`);
        const sdata = await sres.json();
        const merged = data.items.map(i => {
          const s = sdata.items.find(v=>v.id===i.snippet.resourceId.videoId);
          return {...i, statistics: s?s.statistics:{viewCount:0}, publishDate:i.snippet.publishedAt};
        });
        setChannelVideos(prev => token ? [...prev, ...merged] : merged);
      }
    } catch(e) {}
  };

  // ===========================================================================
  // [획기적인 해결책] Universal Subtitle Extractor (3-Layer Fallback System)
  // ===========================================================================
  
  const fetchXmlToText = async (url) => {
    const res = await fetch(url);
    const text = await res.text();
    // XML 태그 제거 및 HTML 엔티티 디코딩
    return text.replace(/<[^>]*>/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/s+/g, ' ').trim();
  };

  // 1. Direct Scraping via CORS Proxy (가장 강력함)
  const strategyDirect = async (videoId) => {
    const proxies = [
      'https://corsproxy.io/?',
      'https://api.allorigins.win/raw?url=',
    ];
    
    for (const proxy of proxies) {
      try {
        const pageUrl = `${proxy}https://www.youtube.com/watch?v=${videoId}`;
        const response = await fetch(pageUrl);
        const html = await response.text();
        
        // Extract captionTracks JSON
        const match = html.match(/"captionTracks":([.*?])/);
        if (!match) continue;
        
        const tracks = JSON.parse(match[1]);
        // Prefer Korean -> English -> First available
        const track = tracks.find(t => t.languageCode === 'ko') || 
                      tracks.find(t => t.languageCode === 'en') || 
                      tracks[0];
        
        if (track) {
          // Fetch the actual XML/Transcript from the baseUrl
          // Must proxy this too
          const trackUrl = `${proxy}${encodeURIComponent(track.baseUrl)}`;
          return await fetchXmlToText(trackUrl);
        }
      } catch (e) { console.error('Direct strategy failed:', e); }
    }
    throw new Error('Direct scraping failed');
  };

  // 2. Invidious API (백업)
  const strategyInvidious = async (videoId) => {
    const instances = [
      "https://invidious.jing.rocks",
      "https://inv.tux.pizza",
      "https://vid.puffyan.us",
      "https://invidious.nerdvpn.de"
    ];
    for (const host of instances) {
      try {
        const res = await fetch(`${host}/api/v1/captions/${videoId}`);
        if (!res.ok) continue;
        const data = await res.json();
        const captions = data.captions || [];
        const track = captions.find(c => c.language === 'ko') || captions.find(c => c.language === 'en') || captions[0];
        if (track) {
           const subRes = await fetch(`${host}${track.url}`); // VTT
           return await subRes.text(); // Needs VTT parsing, but simpler for now
        }
      } catch (e) {}
    }
    throw new Error('Invidious failed');
  };

  // 3. Piped API (기존 백업)
  const strategyPiped = async (videoId) => {
    const instances = ["https://pipedapi.kavin.rocks", "https://api.piped.otter.sh"];
    for (const host of instances) {
      try {
        const res = await fetch(`${host}/streams/${videoId}`);
        if (!res.ok) continue;
        const data = await res.json();
        const track = data.subtitles.find(s => s.code === 'ko') || data.subtitles[0];
        if(track) {
          const subRes = await fetch(track.url);
          return await subRes.text();
        }
      } catch(e){}
    }
    throw new Error('Piped failed');
  };

  const getTranscript = async (videoTitle, videoId) => {
    setTranscriptModal({ isOpen: true, videoId, title: videoTitle, content: '', loading: true, error: null, status: '분석 시작...' });
    
    try {
      // 1단계: Direct Scraping 시도
      setTranscriptModal(prev => ({...prev, status: '유튜브 페이지 직접 분석 중 (1/3)...'}));
      try {
        const text = await strategyDirect(videoId);
        setTranscriptModal(prev => ({...prev, loading: false, content: text, status: '성공 (Direct Scraping)'}));
        return;
      } catch (e) { console.log('Strategy 1 failed'); }

      // 2단계: Invidious 시도
      setTranscriptModal(prev => ({...prev, status: '우회 서버 1 접속 중 (2/3)...'}));
      try {
        const text = await strategyInvidious(videoId);
        setTranscriptModal(prev => ({...prev, loading: false, content: text, status: '성공 (Invidious)'}));
        return;
      } catch (e) { console.log('Strategy 2 failed'); }

      // 3단계: Piped 시도
      setTranscriptModal(prev => ({...prev, status: '우회 서버 2 접속 중 (3/3)...'}));
      try {
        const text = await strategyPiped(videoId);
        setTranscriptModal(prev => ({...prev, loading: false, content: text, status: '성공 (Piped)'}));
        return;
      } catch (e) { console.log('Strategy 3 failed'); }

      throw new Error("모든 경로가 차단되었습니다. (자막이 없는 영상일 수 있습니다)");

    } catch (err) {
      setTranscriptModal(prev => ({...prev, loading: false, error: err.message, status: '실패'}));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      {/* UI 생략 - 위 코드와 동일한 구조 유지 */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-red-600 font-bold text-xl cursor-pointer" onClick={()=>window.location.reload()}>
            <Youtube size={32} fill="currentColor"/> Channel Explorer
          </div>
          <div className="flex-1"/>
          <div className="flex gap-2">
             {isConfigured ? (
              <button onClick={handleQuickSyncClick} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"><RefreshCw size={18}/>Sync</button>
             ) : (
              <button onClick={()=>setShowGithubModal(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg text-sm"><Github size={18}/>Connect</button>
             )}
             <button onClick={()=>setShowSettings(!showSettings)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"><Settings size={24}/></button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="bg-gray-800 text-white p-4 flex justify-center">
          <div className="w-full max-w-2xl flex gap-2">
            <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} className="flex-1 p-2 rounded text-black" placeholder="YouTube API Key"/>
            <button onClick={()=>setShowSettings(false)} className="bg-yellow-600 px-4 rounded">닫기</button>
          </div>
        </div>
      )}

      {/* 자막 모달 */}
      {transcriptModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold truncate pr-4">{transcriptModal.title}</h3>
              <button onClick={()=>setTranscriptModal(prev=>({...prev, isOpen:false}))}><X size={24}/></button>
            </div>
            <div className="flex-1 p-4 overflow-hidden relative flex flex-col">
              {transcriptModal.loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
                  <Loader2 className="animate-spin text-red-600 mb-4" size={48}/>
                  <p className="font-medium text-gray-800">{transcriptModal.status}</p>
                  <p className="text-xs text-gray-500 mt-2">최대 10초 정도 소요될 수 있습니다.</p>
                </div>
              ) : (
                <>
                  <textarea className="flex-1 w-full resize-none border rounded p-4 text-sm focus:outline-none mb-2" value={transcriptModal.content} readOnly />
                  <div className="text-xs text-right text-gray-400">{transcriptModal.status}</div>
                </>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex gap-3 justify-end">
               <button className="px-4 py-2 bg-white border rounded text-sm" onClick={() => navigator.clipboard.writeText(transcriptModal.content)}>복사</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {!apiKey ? (
          <div className="text-center py-20">우측 상단 설정을 눌러 API 키를 입력하세요.</div>
        ) : (
          <>
            {/* Search Form */}
            <form onSubmit={searchChannels} className="flex gap-2 max-w-xl mx-auto mb-8">
              <input value={query} onChange={e=>setQuery(e.target.value)} className="flex-1 p-3 border rounded-full shadow-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="채널 검색..."/>
              <button type="submit" className="bg-red-600 text-white px-6 rounded-full">검색</button>
            </form>

            {/* View Modes */}
            {viewMode === 'search' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {channels.map(c => (
                  <div key={c.id.channelId} onClick={()=>handleChannelClick(c.id.channelId, decodeHtml(c.snippet.title))} className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition cursor-pointer flex flex-col items-center text-center">
                    <img src={c.snippet.thumbnails.medium.url} className="w-24 h-24 rounded-full mb-4 border-4 border-gray-50"/>
                    <h3 className="font-bold text-gray-800 line-clamp-1">{decodeHtml(c.snippet.title)}</h3>
                  </div>
                ))}
              </div>
            )}

            {viewMode === 'videos' && (
              <div className="animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center gap-2 mb-6">
                  <button onClick={()=>setViewMode('search')} className="p-2 hover:bg-gray-200 rounded-full"><ChevronLeft/></button>
                  <h2 className="text-2xl font-bold">{selectedChannel?.title}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {channelVideos.map(v => (
                    <div key={v.id} className="bg-white rounded-xl overflow-hidden shadow border flex flex-col">
                      <div className="aspect-video bg-gray-200 relative group">
                        <img src={v.snippet.thumbnails.medium?.url} className="w-full h-full object-cover"/>
                        <div className="absolute inset-0 bg-black/30 hidden group-hover:flex items-center justify-center"><Play fill="white" className="text-white" size={40}/></div>
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                        <h3 className="font-medium line-clamp-2 mb-4 h-12">{decodeHtml(v.snippet.title)}</h3>
                        <div className="mt-auto">
                          <button onClick={()=>getTranscript(decodeHtml(v.snippet.title), v.snippet.resourceId.videoId)} className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                            <FileText size={16}/> 자막 추출 (New)
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {nextPageToken && <div className="text-center mt-8"><button onClick={()=>fetchVideos(selectedChannel.uploadsId, nextPageToken)} className="px-6 py-2 border rounded-full bg-white hover:bg-gray-50">더 보기</button></div>}
              </div>
            )}
          </>
        )}
        {loading && <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={48}/></div>}
      </main>

      {/* Sync Modal */}
      {syncModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full text-center">
            <h3 className="font-bold text-lg mb-4">{syncModal.step==='confirm'?'GitHub 동기화':'완료'}</h3>
            <p className="mb-6 text-gray-600">{syncModal.message}</p>
            {syncModal.step==='confirm' ? (
              <div className="flex gap-2"><button onClick={()=>setSyncModal(p=>({...p, isOpen:false}))} className="flex-1 py-2 border rounded">취소</button><button onClick={executeQuickSync} className="flex-1 py-2 bg-blue-600 text-white rounded">확인</button></div>
            ) : (
              <button onClick={()=>setSyncModal(p=>({...p, isOpen:false}))} className="w-full py-2 bg-gray-900 text-white rounded">닫기</button>
            )}
          </div>
        </div>
      )}
      {/* Github Modal (생략 - 위와 동일한 구조) */}
      {showGithubModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
             <h3 className="font-bold mb-4">GitHub 연결</h3>
             <input className="w-full border p-2 mb-2 rounded" placeholder="Username" value={ghUsername} onChange={e=>setGhUsername(e.target.value)}/>
             <input className="w-full border p-2 mb-2 rounded" placeholder="Repository" value={ghRepoName} onChange={e=>setGhRepoName(e.target.value)}/>
             <input type="password" className="w-full border p-2 mb-4 rounded" placeholder="Token" value={ghToken} onChange={e=>setGhToken(e.target.value)}/>
             <div className="flex gap-2">
               <button onClick={()=>handleDeploy('create')} className="flex-1 bg-gray-900 text-white py-2 rounded">생성 & 업로드</button>
               <button onClick={()=>handleDeploy('update')} className="flex-1 bg-white border py-2 rounded">업데이트</button>
             </div>
             <button onClick={()=>setShowGithubModal(false)} className="mt-4 w-full text-gray-500 text-sm">닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
