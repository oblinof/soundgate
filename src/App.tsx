import React, { useState, useEffect } from 'react';
import { Cloud, Heart, MessageCircle, Repeat, Download, ExternalLink, CheckCircle, AlertCircle, Loader2, Copy, ArrowRight, Check, Settings } from 'lucide-react';

const encodeData = (data: any) => btoa(encodeURIComponent(JSON.stringify(data)));
const decodeData = (str: string) => JSON.parse(decodeURIComponent(atob(str)));

export default function App() {
  const [gateConfig, setGateConfig] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gateParam = params.get('gate');
    
    const hash = window.location.hash;
    let oauthState = null;
    let oauthToken = null;
    let hashParams = null;

    if (hash.includes('access_token')) {
      hashParams = new URLSearchParams(hash.substring(1));
      oauthToken = hashParams.get('access_token');
      oauthState = hashParams.get('state'); 
      
      if (oauthToken) {
        setToken(oauthToken);
      }
    }

    if (gateParam) {
      try {
        setGateConfig(decodeData(gateParam));
      } catch (e) {
        console.error("Invalid gate data in URL");
      }
    } else if (oauthState === 'gate_auth') {
       try {
        const stored = localStorage.getItem('pendingGateConfig');
        if (stored) {
          const parsed = JSON.parse(stored);
          setGateConfig(parsed);
          window.history.replaceState(null, '', `?gate=${encodeData(parsed)}`);
        }
      } catch (e) {
        console.error("Failed to restore gate data from local storage");
      }
    } else if (oauthState) {
       try {
        setGateConfig(decodeData(oauthState));
        window.history.replaceState(null, '', `?gate=${oauthState}`);
      } catch (e) {
        console.error("Invalid gate data in state");
      }
    } else if (hashParams && (hashParams.has('access_token') || hashParams.has('error'))) {
        window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  if (gateConfig) {
    if (oauthError) {
      return <ErrorDisplay error={oauthError} onRetry={() => { setOauthError(null); window.history.replaceState(null, '', window.location.pathname + window.location.search); window.location.reload(); }} />;
    }
    return <GateView config={gateConfig} token={token} setToken={setToken} />;
  }

  return <CreateGateView />;
}

function CreateGateView() {
  const [trackUrl, setTrackUrl] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsGenerating(true);
    
    try {
      const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(trackUrl)}`;
      const res = await fetch(oembedUrl);
      
      if (!res.ok) {
        throw new Error("Failed to fetch track info from SoundCloud. Please check if the URL is valid and public.");
      }
      
      const trackData = await res.json();
      
      // Extract track ID from the iframe HTML string
      // e.g. src="...api.soundcloud.com%2Ftracks%2F123456789&..."
      const htmlString = trackData.html || '';
      const match = htmlString.match(/api\.soundcloud\.com%2Ftracks%2F(\d+)/);
      const trackId = match ? match[1] : null;

      if (!trackId) {
        throw new Error("Could not extract track ID from this URL. Make sure it's a single track, not a playlist.");
      }

      // Title usually comes as "Track Title by Artist Name"
      let parsedTitle = trackData.title;
      let parsedArtist = trackData.author_name;
      if (parsedTitle && parsedArtist && parsedTitle.endsWith(` by ${parsedArtist}`)) {
         parsedTitle = parsedTitle.slice(0, -(parsedArtist.length + 4)); // remove " by Artist"
      }

      const config = {
        t: parsedTitle || 'Unknown Track',
        a: parsedArtist || 'Unknown Artist',
        url: trackUrl,
        id: trackId,
        art: trackData.thumbnail_url || '',
        dl: downloadUrl
      };
      
      const encoded = encodeData(config);
      const link = `${window.location.origin}/?gate=${encoded}`;
      setGeneratedLink(link);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 py-4 px-6 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xl font-black tracking-tight text-[#ff5500]">
          <Cloud className="w-6 h-6" fill="currentColor" />
          HYPEGATE
        </div>
        <div className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Artist Dashboard</div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto py-12 px-4 md:px-6">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 mb-4">Create your Download Gate</h1>
          <p className="text-lg text-zinc-500">Exchange free downloads for SoundCloud likes, comments, and reposts.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-zinc-200/50 border border-zinc-100 p-6 md:p-8">
          
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8 text-amber-800">
            <h3 className="font-bold flex items-center gap-2 text-base mb-2">
              <AlertCircle className="w-5 h-5" /> 
              Configuración Requerida de SoundCloud
            </h3>
            <p className="text-sm mb-3">
              Para que el login funcione y no de error (debido a que SoundCloud usa OAuth 2.0 PKCE), <strong>DEBES</strong>:
            </p>
            <ul className="list-disc pl-5 text-sm mb-3 space-y-1">
              <li>Agregar esta URL exacta en tu panel de desarrollador de SoundCloud en la sección <strong>Redirect URIs</strong>:</li>
            </ul>
            <div className="bg-amber-100 px-3 py-2 rounded-lg font-mono text-sm font-bold block select-all break-all border border-amber-200/50">
              {window.location.origin}/api/soundcloud/callback
            </div>
          </div>

          <form onSubmit={handleGenerate} className="space-y-6">
            
            {error && (
              <div className="bg-red-50 text-red-600 border border-red-100 rounded-xl p-4 text-sm font-medium flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700">SoundCloud Track URL</label>
              <input required value={trackUrl} onChange={e=>setTrackUrl(e.target.value)} type="url" placeholder="https://soundcloud.com/artist/track" className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-[#ff5500]/20 focus:border-[#ff5500] transition-all" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 flex items-center justify-between">
                <span>Secret Download URL</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 hidden sm:inline-block">Google Drive, Dropbox, etc.</span>
              </label>
              <input required value={downloadUrl} onChange={e=>setDownloadUrl(e.target.value)} type="url" placeholder="https://drive.google.com/..." className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-[#ff5500]/20 focus:border-[#ff5500] transition-all" />
            </div>

            <button disabled={isGenerating} type="submit" className="w-full bg-[#ff5500] hover:bg-[#ff4400] disabled:bg-zinc-400 text-white font-black uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Settings className="w-5 h-5" />} 
              {isGenerating ? 'Fetching Track Data...' : 'Generate Fan Gate'}
            </button>
          </form>

          {generatedLink && (
            <div className="mt-8 p-6 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="font-bold text-zinc-900 flex items-center gap-2 text-lg">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
                Gate Created Successfully!
              </h3>
              <p className="text-sm text-zinc-600 font-medium">Share this link with your fans. When they complete the steps, they will be redirected to your download link.</p>
              
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="w-full sm:flex-1 bg-white border border-zinc-200 rounded-lg px-4 py-3 text-sm text-zinc-600 font-mono truncate select-all">
                  {generatedLink}
                </div>
                <button onClick={copyLink} className="w-full sm:w-auto bg-zinc-900 hover:bg-black text-white px-6 py-3 rounded-lg font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shrink-0">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              
              <a href={generatedLink} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center w-full sm:w-auto gap-2 text-sm font-bold text-[#ff5500] hover:text-[#ff4400] mt-2 uppercase tracking-wide">
                Preview Gate <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function GateView({ config, token, setToken }: { config: any, token: string | null, setToken: (t: string) => void }) {
  const [liked, setLiked] = useState(false);
  const [commented, setCommented] = useState(false);
  const [reposted, setReposted] = useState(false);
  
  const [clickedRepost, setClickedRepost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isIframe = typeof window !== 'undefined' && window !== window.parent;

  const handleConnect = () => {
    // Save current config to localStorage so we don't have to pass huge state param
    localStorage.setItem('pendingGateConfig', JSON.stringify(config));
    
    // Redirect to our backend which handles the secure OAuth exchange
    const redirectUri = window.location.origin + '/api/soundcloud/callback';
    window.location.href = `/api/soundcloud/auth?state=gate_auth&redirect_uri=${encodeURIComponent(redirectUri)}`;
  };

  const verifyActions = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    
    try {
      // 1. Fetch User Profile
      const meRes = await fetch(`https://api.soundcloud.com/me?oauth_token=${token}`);
      if (!meRes.ok) throw new Error(meRes.status === 401 ? 'Session expired. Please reconnect.' : 'Failed to connect to SoundCloud API.');
      const meData = await meRes.json();
      const userId = meData.id;

      // 2. Verify Like
      try {
        const likeRes = await fetch(`https://api.soundcloud.com/me/favorites/${config.id}?oauth_token=${token}`);
        setLiked(likeRes.ok);
      } catch (e) { console.error('Like check failed', e); }

      // 3. Verify Comment
      try {
        const commentsRes = await fetch(`https://api.soundcloud.com/tracks/${config.id}/comments?oauth_token=${token}`);
        if (commentsRes.ok) {
          const comments = await commentsRes.json();
          setCommented(comments.some((c: any) => c.user_id === userId));
        }
      } catch (e) { console.error('Comment check failed', e); }

      // 4. Repost Check
      if (clickedRepost) {
        setReposted(true);
      } else {
        throw new Error('Please click the repost button to share the track first.');
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const allVerified = liked && commented && reposted;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans">
      {/* Blurred Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-30 scale-110 pointer-events-none"
        style={{ backgroundImage: `url(${config.art})` }}
      />
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-2xl overflow-hidden relative z-10 flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-700">
        {/* Cover Art Area */}
        <div className="w-full aspect-square relative bg-zinc-100">
          <img src={config.art} alt={config.t} className="w-full h-full object-cover" />
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
            <div className="bg-black/80 backdrop-blur text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5">
              <Cloud className="w-3 h-3 text-[#ff5500]" fill="currentColor" /> HYPEGATE
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-8 flex flex-col items-center text-center">
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight leading-none mb-2">{config.t}</h1>
          <p className="text-lg font-medium text-zinc-500 mb-8">{config.a}</p>

          {error && (
            <div className="w-full bg-red-50 text-red-600 border border-red-100 rounded-xl p-4 mb-6 text-sm font-medium flex items-start gap-2 text-left">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isIframe && !token && (
            <div className="w-full bg-amber-50 text-amber-700 border border-amber-200 rounded-xl p-4 mb-6 text-sm font-medium flex items-start gap-2 text-left">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                SoundCloud login requires this page to be in a full tab. 
                <a href={window.location.href} target="_blank" rel="noreferrer" className="block mt-1 underline font-bold">Open full screen &rarr;</a>
              </div>
            </div>
          )}

          <div className="w-full space-y-3">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Steps to download</div>
            
            {!token ? (
              <button
                onClick={handleConnect}
                disabled={isIframe}
                className="w-full group relative bg-[#ff5500] hover:bg-[#ff4400] disabled:bg-zinc-300 disabled:cursor-not-allowed text-white rounded-xl p-1 transition-all"
              >
                <div className="bg-white/10 w-full h-full rounded-lg px-4 py-4 flex items-center justify-center gap-3">
                  <Cloud className="w-6 h-6" fill="currentColor" />
                  <span className="font-bold text-lg tracking-wide">Connect SoundCloud</span>
                </div>
              </button>
            ) : (
              <div className="w-full space-y-3">
                <GateActionRow 
                  num="1" title="Like Track" completed={liked} 
                  onClick={() => window.open(config.url, '_blank')}
                  icon={<Heart className="w-5 h-5" />}
                />
                <GateActionRow 
                  num="2" title="Leave a Comment" completed={commented} 
                  onClick={() => window.open(config.url, '_blank')}
                  icon={<MessageCircle className="w-5 h-5" />}
                />
                <GateActionRow 
                  num="3" title="Repost Track" completed={reposted} 
                  onClick={() => { setClickedRepost(true); window.open(config.url, '_blank'); }}
                  icon={<Repeat className="w-5 h-5" />}
                />
                
                {!allVerified && (
                  <button
                    onClick={verifyActions}
                    disabled={loading}
                    className="w-full mt-4 bg-zinc-900 hover:bg-black text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors uppercase tracking-widest text-sm"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Actions'}
                  </button>
                )}
              </div>
            )}

            {/* Final Download Button */}
            {token && allVerified && (
              <button
                onClick={() => window.location.href = config.dl}
                className="w-full mt-6 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 rounded-xl p-1 transition-all animate-in zoom-in duration-300"
              >
                <div className="bg-white/20 w-full h-full rounded-lg px-4 py-5 flex items-center justify-center gap-3">
                  <Download className="w-6 h-6" />
                  <span className="font-black text-xl tracking-wide uppercase">Download Now</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-white/50 text-xs font-bold uppercase tracking-widest text-center w-full flex justify-center items-center gap-1 z-10">
        Powered by <Cloud className="w-4 h-4 mx-1" fill="currentColor"/> HYPEGATE
      </div>
    </div>
  );
}

function GateActionRow({ num, title, completed, onClick, icon }: any) {
  return (
    <div 
      onClick={completed ? undefined : onClick}
      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
        completed 
          ? 'border-emerald-500/20 bg-emerald-50 text-emerald-700 cursor-default' 
          : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 cursor-pointer text-zinc-700'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
          completed ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-500'
        }`}>
          {completed ? <Check className="w-4 h-4" /> : num}
        </div>
        <div className="font-bold flex items-center gap-2">
          {icon} {title}
        </div>
      </div>
      {!completed && (
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 bg-zinc-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
          GO <ExternalLink className="w-3 h-3" />
        </div>
      )}
    </div>
  );
}

function ErrorDisplay({ error, onRetry }: { error: string, onRetry: () => void }) {
  const isInvalidSecret = error && error.includes("invalid_client_secret");
  const isInvalidGrant = error && error.includes("invalid_grant");
  
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 md:p-8 font-sans">
      <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-black text-zinc-900 mb-2">
          {isInvalidSecret ? "Configuración Inválida" : isInvalidGrant ? "Sesión Expirada" : "Connection Failed"}
        </h2>
        {isInvalidSecret ? (
          <div className="text-zinc-600 mb-6 text-sm space-y-3 text-left bg-amber-50 p-4 rounded-xl border border-amber-200">
            <p className="font-bold text-amber-800">¡Tu SOUNDCLOUD_CLIENT_SECRET es incorrecto!</p>
            <p>Actualmente parece que has puesto tu <b>Client ID</b> en el campo del <b>Client Secret</b>.</p>
            <p>Para arreglar esto:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Ve al panel de desarrollador de SoundCloud.</li>
              <li>Busca la sección <b>Client Secret</b> (es diferente al Client ID).</li>
              <li>Cópialo y ve a <b>Settings</b> en esta app.</li>
              <li>Actualiza la variable de entorno <code>SOUNDCLOUD_CLIENT_SECRET</code>.</li>
            </ol>
          </div>
        ) : isInvalidGrant ? (
           <div className="text-zinc-600 mb-6 text-sm space-y-3 text-left bg-amber-50 p-4 rounded-xl border border-amber-200">
             <p className="font-bold text-amber-800">El código de autorización expiró o es inválido.</p>
             <p>Asegúrate de que estás abriendo la aplicación en una pestaña nueva (pantalla completa) y no dentro de la vista previa de AI Studio.</p>
             <p>Por favor, haz clic en "Try Again" para reintentar la conexión.</p>
           </div>
        ) : (
          <p className="text-zinc-600 mb-6">{error}</p>
        )}
        <button onClick={onRetry} className="w-full bg-zinc-900 hover:bg-black text-white font-bold py-4 rounded-xl transition-colors uppercase tracking-widest text-sm">
          Try Again
        </button>
      </div>
    </div>
  );
}