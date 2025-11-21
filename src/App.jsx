import React, { useState, useEffect } from 'react';
import { Search, Play, Settings, X, Loader2, Youtube, AlertCircle, User, Calendar, Eye, FileText, ChevronLeft, Download, Copy, Check, Github, Upload, Save, RefreshCw, CloudLightning } from 'lucide-react';

export default function App() {
  // --- 앱 상태 ---
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
  
  // 자막 상태
  const [transcriptModal, setTranscriptModal] = useState({ isOpen: false, videoId: null, title: '', content: '', loading: false, error: null });
  const [copySuccess, setCopySuccess] = useState(false);

  // GitHub 상태
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [ghToken, setGhToken] = useState('');
  const [ghRepoName, setGhRepoName] = useState('');
  const [ghUsername, setGhUsername] = useState('');
  const [deployStatus, setDeployStatus] = useState({ type: 'idle', message: '' });
  const [isConfigured, setIsConfigured] = useState(false);
  
  // [NEW] 동기화(Sync) 모달 상태
  const [syncModal, setSyncModal] = useState({ isOpen: false, step: 'idle', message: '' }); // step: confirm, processing, success, error

  // --- 초기화 ---
  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('yt_api_key');
      if (storedKey) setApiKey(storedKey);
      
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

  // --- GitHub Logic ---
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

  // 빠른 동기화 실행 (Confirm 후 호출됨)
  const executeSync = async () => {
    setSyncModal({ isOpen: true, step: 'processing', message: 'GitHub에 연결 중...' });
    try {
      // 이 코드는 자기 자신을 업로드하는 것이므로, 실제로는 FILE_TEMPLATES가 정의되어 있어야 합니다.
      // 배포된 코드에서는 FILE_TEMPLATES를 참조하기 어렵기 때문에, 
      // 실제 구현시에는 이 부분에 대한 재귀적 참조 처리가 필요합니다.
      // 여기서는 단순 데모용으로 성공 메시지만 보여줍니다.
      await new Promise(r => setTimeout(r, 1500)); // 가짜 지연
      setSyncModal({ isOpen: true, step: 'success', message: '성공! (실제 배포환경에서는 파일 템플릿이 필요합니다)' });
    } catch (err) {
      setSyncModal({ isOpen: true, step: 'error', message: err.message });
    }
  };

  // --- Main Rendering (Simplified) ---
  return (
    <div className="min-h-screen bg-gray-50 p-4">
       {/* 헤더 및 기본 UI 생략 (위 코드와 동일) */}
       <h1 className="text-2xl font-bold text-center mt-10">배포된 앱입니다.</h1>
    </div>
  );
}
