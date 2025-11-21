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

  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('yt_api_key');
      if (storedKey) setApiKey(storedKey); else setShowSettings(true);
    } catch (e) {}
  }, []);

  useEffect(() => { if(apiKey) try{localStorage.setItem('yt_api_key', apiKey)}catch(e){} }, [apiKey]);

  const decodeHtml = (html) => { const txt = document.createElement("textarea"); txt.innerHTML = html; return txt.value; };
  
  const searchChannels = async (e) => {
    e.preventDefault(); if(!query.trim()) return; setLoading(true); setViewMode('search');
    try {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(query)}&type=channel&key=${apiKey}`);
      const d = await r.json(); setChannels(d.items||[]);
    } catch(e){} finally { setLoading(false); }
  };

  const handleChannelClick = async (cid, ctitle) => {
    setLoadingVideos(true);
    try {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${cid}&key=${apiKey}`);
      const d = await r.json();
      if(d.items?.length) {
        const uid = d.items[0].contentDetails.relatedPlaylists.uploads;
        setSelectedChannel({id:cid, title:ctitle, uploadsId:uid});
        await fetchVideos(uid); setViewMode('videos');
      }
    } catch(e){} finally { setLoadingVideos(false); }
  };

  const fetchVideos = async (pid, token) => {
    try {
      let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=12&playlistId=${pid}&key=${apiKey}`;
      if(token) url+=`&pageToken=${token}`;
      const r = await fetch(url); const d = await r.json(); setNextPageToken(d.nextPageToken);
      const vids = d.items.map(i=>i.snippet.resourceId.videoId).join(',');
      if(vids) {
        const sr = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${vids}&key=${apiKey}`);
        const sd = await sr.json();
        setChannelVideos(p => token ? [...p, ...d.items.map(i=>({...i, statistics:sd.items.find(v=>v.id===i.snippet.resourceId.videoId)?.statistics||{viewCount:0}, publishDate:i.snippet.publishedAt}))] : d.items.map(i=>({...i, statistics:sd.items.find(v=>v.id===i.snippet.resourceId.videoId)?.statistics||{viewCount:0}, publishDate:i.snippet.publishedAt})));
      }
    } catch(e){}
  };

  // --- Smart Parser Logic (Deployed) ---
  const parseXmlTranscript = (xml) => {
    return xml.replace(/<text start="([\d.]+)" dur="([\d.]+)".*?>/g, ' ')
      .replace(/<\/text>/g, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ').trim();
  };

  const strategySmartParse = async (videoId) => {
    const PROXY_URL = 'https://corsproxy.io/?';
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(`${PROXY_URL}${encodeURIComponent(videoUrl)}`);
    const html = await response.text();
    const playerResponseMatch = html.match(/var ytInitialPlayerResponse = ({.*?});/s);
    if (!playerResponseMatch) throw new Error("플레이어 데이터 없음");
    const playerResponse = JSON.parse(playerResponseMatch[1]);
    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captions || captions.length === 0) throw new Error("자막 데이터 없음");
    const track = captions.find(t => t.languageCode === 'ko') || captions.find(t => t.languageCode === 'en') || captions[0];
    const trackResponse = await fetch(`${PROXY_URL}${encodeURIComponent(track.baseUrl)}`);
    return parseXmlTranscript(await trackResponse.text());
  };

  const getTranscript = async (title, videoId) => {
    setTranscriptModal({ isOpen: true, videoId, title, content: '', loading: true, error: null, status: '분석 시작...' });
    try {
      setTranscriptModal(p => ({...p, status: '🚀 Smart Parser 가동...'}));
      const text = await strategySmartParse(videoId);
      setTranscriptModal(p => ({...p, loading: false, content: text, status: '✅ 추출 성공'}));
    } catch (e) {
      setTranscriptModal(p => ({...p, loading: false, error: e.message, status: '❌ 실패'}));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <header className="bg-white shadow-sm sticky top-0 z-20 h-16 flex items-center px-4 gap-4">
        <div className="flex items-center gap-2 text-red-600 font-bold text-lg cursor-pointer" onClick={()=>window.location.reload()}><Youtube fill="currentColor"/> Explorer</div>
        <div className="flex-1"/>
        <button onClick={()=>setShowSettings(!showSettings)} className="p-2 hover:bg-gray-100 rounded-full"><Settings size={24}/></button>
      </header>
      {showSettings && <div className="bg-gray-800 p-4 text-white flex justify-center"><div className="flex gap-2 w-full max-w-2xl"><input className="text-black flex-1 p-2 rounded" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="YouTube API Key"/><button onClick={()=>setShowSettings(false)} className="bg-yellow-600 px-4 rounded">닫기</button></div></div>}
      
      {transcriptModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold truncate pr-4">{transcriptModal.title}</h3><button onClick={()=>setTranscriptModal(p=>({...p, isOpen:false}))}><X/></button></div>
            <div className="flex-1 p-4 overflow-hidden relative flex flex-col">
              {transcriptModal.loading ? <div className="absolute inset-0 flex flex-col items-center justify-center bg-white text-center"><Loader2 className="animate-spin text-red-600 mb-4" size={48}/><p className="font-medium text-gray-800">{transcriptModal.status}</p></div> : <><textarea className="flex-1 w-full resize-none border rounded p-4 text-sm focus:outline-none mb-2 bg-gray-50" value={transcriptModal.content} readOnly /><div className="text-xs text-right text-gray-400">{transcriptModal.status}</div></>}
            </div>
            <div className="p-4 border-t flex justify-end gap-2"><button className="px-4 py-2 bg-white border rounded text-sm flex items-center gap-2" onClick={() => navigator.clipboard.writeText(transcriptModal.content)}><Copy size={14}/> 복사</button></div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {!apiKey && <div className="text-center py-10 text-gray-500">API 키를 입력하세요.</div>}
        {apiKey && (
          <>
            <form onSubmit={searchChannels} className="flex gap-2 max-w-xl mx-auto mb-8"><input value={query} onChange={e=>setQuery(e.target.value)} className="flex-1 p-3 border rounded-full shadow-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="채널 검색..."/><button className="bg-red-600 text-white px-6 rounded-full font-medium">검색</button></form>
            {viewMode==='search' && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">{channels.map(c => (<div key={c.id.channelId} onClick={()=>handleChannelClick(c.id.channelId, c.snippet.title)} className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition cursor-pointer flex flex-col items-center text-center"><img src={c.snippet.thumbnails.medium.url} className="w-20 h-20 rounded-full mb-3 border-2 border-gray-100"/><h3 className="font-bold text-gray-800 line-clamp-1">{c.snippet.title}</h3></div>))}</div>}
            {viewMode==='videos' && <div className="animate-in fade-in slide-in-from-right-4"><div className="flex items-center gap-2 mb-6"><button onClick={()=>setViewMode('search')} className="p-2 hover:bg-gray-200 rounded-full"><ChevronLeft/></button><h2 className="text-2xl font-bold">{selectedChannel?.title}</h2></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">{channelVideos.map(v => (<div key={v.id} className="bg-white rounded-xl overflow-hidden shadow border flex flex-col group"><div className="aspect-video relative bg-gray-200"><img src={v.snippet.thumbnails.medium?.url} className="w-full h-full object-cover"/><div className="absolute inset-0 bg-black/20 hidden group-hover:flex items-center justify-center"><Play fill="white" className="text-white" size={40}/></div></div><div className="p-3 flex-1 flex flex-col"><h3 className="font-medium line-clamp-2 mb-3 h-10 text-sm">{v.snippet.title}</h3><div className="mt-auto pt-2 border-t border-dashed"><button onClick={()=>getTranscript(v.snippet.title, v.snippet.resourceId.videoId)} className="w-full py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center justify-center gap-2 font-bold text-xs transition-colors"><FileText size={14}/> 자막 추출 (Pro)</button></div></div></div>))}</div>{nextPageToken && <div className="text-center mt-8"><button onClick={()=>fetchVideos(selectedChannel.uploadsId, nextPageToken)} className="px-6 py-2 border rounded-full bg-white hover:bg-gray-50 text-sm font-medium">더 보기</button></div>}</div>}
          </>
        )}
        {(loading || loadingVideos) && <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={40}/></div>}
      </main>
    </div>
  );
}
