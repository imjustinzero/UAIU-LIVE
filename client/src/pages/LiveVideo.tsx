import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useLocation } from "wouter";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Video, VideoOff, Mic, MicOff, Users, Clock, Gem, LogOut, Home, Loader2, SkipForward, PhoneOff, Send, MessageSquare, WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthModal } from "@/components/AuthModal";
import { getSessionId, getUserData, setUserData, clearAllSession } from "@/lib/sessionHelper";

interface User {
  id: string;
  email: string;
  name: string;
  credits: number;
}

interface MatchData {
  sessionId: string;
  roomUrl: string;
  token: string;
}

interface ChatMessage {
  id: string;
  from: 'me' | 'partner';
  message: string;
  timestamp: number;
}

type PageState = 'loading' | 'logged_out' | 'camera_prompt' | 'ready' | 'matching' | 'connected';

export default function LiveVideo() {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pageState, setPageStateRaw] = useState<PageState>('loading');
  const [socketStatus, setSocketStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [sessionTime, setSessionTime] = useState(0);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [currentRoom, setCurrentRoom] = useState<MatchData | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const callObjectRef = useRef<DailyCall | null>(null);
  const joiningSessionIdRef = useRef<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cleanupInProgressRef = useRef<Promise<void> | null>(null);
  const socketRetryRef = useRef<number>(0);
  const pageStateRef = useRef<PageState>('loading');
  const isLoggingOutRef = useRef(false);

  const setPageState = useCallback((s: PageState) => {
    pageStateRef.current = s;
    setPageStateRaw(s);
  }, []);

  const { toast } = useToast();

  useEffect(() => {
    const savedUser = getUserData();
    const sessionId = getSessionId();

    if (savedUser && sessionId) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch { /* ignore */ }

      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${sessionId}` },
      })
        .then(res => {
          if (!res.ok) {
            clearAllSession();
            setUser(null);
            setPageState('logged_out');
            return null;
          }
          return res.json();
        })
        .then(freshUser => {
          if (freshUser) {
            setUser(freshUser);
            setUserData(JSON.stringify(freshUser));
          }
        })
        .catch(() => {});
    } else {
      setPageState('logged_out');
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setCameraReady(true);
      console.log('[LiveVideo] Camera/mic ready');
      return true;
    } catch (err: any) {
      console.error('[LiveVideo] getUserMedia error:', err);
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera/mic access denied. Please allow access in your browser settings.'
        : err?.name === 'NotFoundError'
          ? 'No camera or microphone found on this device.'
          : 'Could not access camera/microphone.';
      setCameraError(msg);
      setCameraReady(false);
      return false;
    }
  }, []);

  useEffect(() => {
    if (user && pageState !== 'connected' && pageState !== 'matching') {
      setPageState('camera_prompt');
      startCamera().then((ok) => {
        if (ok) setPageState('ready');
      });
    }
  }, [user?.id]);

  const connectSocket = useCallback(() => {
    if (!user) return;
    const sessionId = getSessionId();
    if (!sessionId) return;

    if (socketRef.current?.connected) {
      setSocketStatus('connected');
      setConnectionError(null);
      return;
    }

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }

    setSocketStatus('connecting');
    setConnectionError(null);

    const socketUrl = window.location.origin;
    const newSocket = io(socketUrl, {
      auth: { sessionId },
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000,
      forceNew: true,
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('[LiveVideo] Socket connected:', newSocket.id);
      setSocketStatus('connected');
      setConnectionError(null);
      socketRetryRef.current = 0;
      newSocket.emit('liveMatch:resume');
    });

    newSocket.on('connect_error', (err) => {
      console.error('[LiveVideo] Socket connect_error:', err.message);
      setSocketStatus('disconnected');
      socketRetryRef.current += 1;
      if (socketRetryRef.current >= 3) {
        setConnectionError('Unable to connect to server. Check your internet connection.');
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[LiveVideo] Socket disconnected:', reason);
      setSocketStatus('disconnected');
      if (reason === 'io server disconnect') {
        setConnectionError('Server disconnected you. Please refresh.');
      }
    });

    newSocket.on('creditsUpdated', (newCredits: number) => {
      setUser(prev => prev ? { ...prev, credits: newCredits } : null);
    });

    newSocket.on('liveMatch:found', async (data: MatchData) => {
      console.log('[LiveVideo] Match found! Room:', data.roomUrl, 'Session:', data.sessionId);

      if (joiningSessionIdRef.current === data.sessionId) {
        console.log('[LiveVideo] Duplicate liveMatch:found ignored');
        return;
      }
      joiningSessionIdRef.current = data.sessionId;
      setCurrentRoom(data);
      setPageState('connected');

      try {
        await joinDailyRoom(data);
      } catch (err) {
        console.error('[LiveVideo] Failed to join room:', err);
        toast({
          title: "Video Connection Failed",
          description: "Could not connect to video room. Try again.",
          variant: "destructive"
        });
        if (newSocket.connected) {
          newSocket.emit('liveMatch:leave');
        }
        await cleanupCall();
      }
    });

    newSocket.on('liveMatch:partnerDisconnected', async () => {
      toast({ title: "Partner Left", description: "Your partner disconnected.", variant: "destructive" });
      await cleanupCall();
    });

    newSocket.on('liveMatch:ended', async (payload?: { reasonCode?: string; message?: string }) => {
      console.log('[LiveVideo] liveMatch:ended:', payload);
      const msg = payload?.message || 'Session ended.';
      toast({ title: "Session Ended", description: msg });
      await cleanupCall();
    });

    newSocket.on('liveMatch:chat', (data: { from: string; message: string }) => {
      setChatMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        from: 'partner',
        message: data.message,
        timestamp: Date.now(),
      }]);
    });

    newSocket.on('error', (data: { message: string }) => {
      console.error('[LiveVideo] Server error:', data.message);
      toast({ title: "Error", description: data.message, variant: "destructive" });
      if (pageStateRef.current === 'matching') {
        setPageState('ready');
      }
    });

    return () => {
      newSocket.removeAllListeners();
      newSocket.disconnect();
    };
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      const cleanup = connectSocket();
      return () => {
        cleanup?.();
        socketRef.current = null;
      };
    }
  }, [user?.id]);

  useEffect(() => {
    return () => {
      const sock = socketRef.current;
      const state = pageStateRef.current;
      if (sock && (state === 'matching' || state === 'connected')) {
        sock.emit('liveMatch:leave');
      }
    };
  }, []);

  const hardResetDaily = async () => {
    if (cleanupInProgressRef.current) {
      await cleanupInProgressRef.current;
      return;
    }
    const call = callObjectRef.current;
    if (!call) return;

    const doCleanup = async () => {
      try {
        await call.leave();
        call.destroy();
      } catch {
        try { call.destroy(); } catch {}
      } finally {
        callObjectRef.current = null;
        cleanupInProgressRef.current = null;
      }
    };

    cleanupInProgressRef.current = doCleanup();
    await cleanupInProgressRef.current;
  };

  const joinDailyRoom = async (data: MatchData) => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    await hardResetDaily();

    const callObject = DailyIframe.createCallObject({
      audioSource: true,
      videoSource: true,
    });
    callObjectRef.current = callObject;

    callObject.on('track-started', (event) => {
      if (!event || !event.track) return;
      const { track, participant } = event;

      if (participant?.local) {
        if (track.kind === 'video' && localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([track]);
        }
      } else {
        if (track.kind === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = new MediaStream([track]);
        }
        if (track.kind === 'audio') {
          const audio = document.createElement('audio');
          audio.srcObject = new MediaStream([track]);
          audio.autoplay = true;
          audio.id = `daily-remote-audio-${participant?.session_id || 'unknown'}`;
          document.body.appendChild(audio);
        }
      }
    });

    callObject.on('track-stopped', (event) => {
      if (!event || !event.track) return;
      const { track, participant } = event;

      if (participant?.local) {
        if (track.kind === 'video' && localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
      } else {
        if (track.kind === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        if (track.kind === 'audio' && participant) {
          const el = document.getElementById(`daily-remote-audio-${participant.session_id}`);
          if (el) el.remove();
        }
      }
    });

    callObject.on('participant-left', (event) => {
      console.log('[Daily] Participant left');
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      if (event?.participant) {
        const el = document.getElementById(`daily-remote-audio-${event.participant.session_id}`);
        if (el) el.remove();
      }
    });

    callObject.on('error', async (event) => {
      console.error('[Daily] Call error:', event);
      toast({ title: "Video Error", description: "Video connection error occurred.", variant: "destructive" });
      socketRef.current?.emit('liveMatch:leave');
      await cleanupCall();
    });

    console.log('[Daily] Joining room:', data.roomUrl);

    const joinPromise = callObject.join({ url: data.roomUrl, token: data.token });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('join_timeout')), 20000)
    );

    await Promise.race([joinPromise, timeoutPromise]);
    console.log('[Daily] Joined room successfully');
  };

  const cleanupCall = useCallback(async () => {
    await hardResetDaily();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    document.querySelectorAll('audio[id^="daily-remote-audio-"]').forEach(el => el.remove());

    setCurrentRoom(null);
    joiningSessionIdRef.current = null;
    setVideoEnabled(true);
    setAudioEnabled(true);
    setChatMessages([]);
    setChatInput('');

    if (!isLoggingOutRef.current) {
      setPageState('ready');
      startCamera();
    }
  }, []);

  useEffect(() => {
    return () => {
      const call = callObjectRef.current;
      if (call) {
        call.leave().catch(() => {}).finally(() => {
          try { call.destroy(); } catch {}
        });
        callObjectRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      document.querySelectorAll('audio[id^="daily-remote-audio-"]').forEach(el => el.remove());
    };
  }, []);

  useEffect(() => {
    if (pageState === 'connected') {
      setSessionTime(0);
      sessionTimerRef.current = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    } else {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
      setSessionTime(0);
    }

    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [pageState]);

  const handleStart = () => {
    const sock = socketRef.current;

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!sock || !sock.connected) {
      setConnectionError('Not connected to server. Retrying...');
      connectSocket();
      return;
    }

    if (user.credits < 1) {
      toast({ title: "Not Enough Credits", description: "You need 1 credit to start.", variant: "destructive" });
      return;
    }

    setPageState('matching');
    sock.emit('liveMatch:join');
    console.log('[LiveVideo] Emitted liveMatch:join');
  };

  const handleNext = async () => {
    const sock = socketRef.current;
    if (sock && currentRoom) {
      sock.emit('liveMatch:next');
    }
    await cleanupCall();
    setTimeout(() => {
      handleStart();
    }, 500);
  };

  const handleDisconnect = async () => {
    const sock = socketRef.current;
    if (sock && pageState === 'connected') {
      sock.emit('liveMatch:leave');
    }
    await cleanupCall();
  };

  const handleCancel = () => {
    const sock = socketRef.current;
    if (sock) sock.emit('liveMatch:leave');
    setPageState('ready');
  };

  const sendChatMessage = () => {
    const sock = socketRef.current;
    if (!sock || pageState !== 'connected' || !chatInput.trim()) return;

    const message = chatInput.trim().substring(0, 500);
    sock.emit('liveMatch:chat', { message });
    setChatMessages(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      from: 'me',
      message,
      timestamp: Date.now(),
    }]);
    setChatInput('');
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const toggleVideo = async () => {
    if (!callObjectRef.current) return;
    try {
      callObjectRef.current.setLocalVideo(!videoEnabled);
      setVideoEnabled(!videoEnabled);
    } catch (err) {
      console.error('[Daily] Toggle video error:', err);
    }
  };

  const toggleAudio = async () => {
    if (!callObjectRef.current) return;
    try {
      callObjectRef.current.setLocalAudio(!audioEnabled);
      setAudioEnabled(!audioEnabled);
    } catch (err) {
      console.error('[Daily] Toggle audio error:', err);
    }
  };

  const handleLogout = async () => {
    isLoggingOutRef.current = true;
    clearAllSession();
    setUser(null);
    await cleanupCall();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    setPageState('logged_out');
    isLoggingOutRef.current = false;
  };

  const handleRetryConnection = () => {
    socketRetryRef.current = 0;
    setConnectionError(null);
    connectSocket();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (pageState === 'logged_out' || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
        <header className="border-b border-emerald-500/20 bg-slate-900/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/')} data-testid="button-home">
                  <Home className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold text-emerald-400" data-testid="text-page-title">UAIU Live</h1>
              </div>
              <Button onClick={() => setShowAuthModal(true)} data-testid="button-login">
                Login / Sign Up
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-16">
          <div className="max-w-lg mx-auto text-center space-y-8">
            <Users className="h-20 w-20 mx-auto text-emerald-400" />
            <h2 className="text-3xl font-bold text-white">Random Video Chat</h2>
            <p className="text-lg text-slate-300">
              Connect with random people via live video, audio, and text chat. Just like Omegle — but better.
            </p>
            <p className="text-sm text-slate-400">1 credit per session. No time limits.</p>
            <Button size="lg" onClick={() => setShowAuthModal(true)} className="gap-2 text-lg px-8 py-6" data-testid="button-get-started">
              <Video className="h-6 w-6" />
              Start Chatting
            </Button>
          </div>
        </main>

        <AuthModal
          open={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={(authUser: User) => {
            setUser(authUser);
            setShowAuthModal(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      <header className="border-b border-emerald-500/20 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} data-testid="button-home">
                <Home className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold text-emerald-400" data-testid="text-page-title">UAIU Live</h1>
              {socketStatus === 'connected' && (
                <div className="h-2 w-2 rounded-full bg-green-500" title="Connected" data-testid="indicator-connected" />
              )}
              {socketStatus === 'connecting' && (
                <span data-testid="indicator-connecting"><Loader2 className="h-4 w-4 animate-spin text-yellow-500" /></span>
              )}
              {socketStatus === 'disconnected' && (
                <span data-testid="indicator-disconnected"><WifiOff className="h-4 w-4 text-red-500" /></span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary" className="gap-1.5" data-testid="badge-credits">
                <Gem className="h-3.5 w-3.5" />
                {user.credits.toFixed(1)}
              </Badge>
              {pageState === 'connected' && (
                <Badge variant="outline" className="gap-1.5 border-emerald-500 text-emerald-400" data-testid="badge-session-time">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTime(sessionTime)}
                </Badge>
              )}
              <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4">
        <div className="max-w-5xl mx-auto space-y-4">
          {connectionError && (
            <div className="bg-red-900/50 border border-red-500/50 rounded-md p-4 flex items-center justify-between gap-4" data-testid="error-connection">
              <div className="flex items-center gap-3">
                <WifiOff className="h-5 w-5 text-red-400 shrink-0" />
                <p className="text-red-200 text-sm">{connectionError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRetryConnection} className="shrink-0 gap-1.5" data-testid="button-retry-connection">
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          )}

          {cameraError && pageState !== 'connected' && (
            <div className="bg-yellow-900/50 border border-yellow-500/50 rounded-md p-4 flex items-center justify-between gap-4" data-testid="error-camera">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
                <p className="text-yellow-200 text-sm">{cameraError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => startCamera()} className="shrink-0 gap-1.5" data-testid="button-retry-camera">
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-700">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover mirror"
                data-testid="video-local"
              />
              <div className="absolute top-2 left-2">
                <Badge variant="secondary" className="text-xs">You</Badge>
              </div>
              {!cameraReady && pageState !== 'connected' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-3">
                  <Video className="h-12 w-12 text-slate-500" />
                  <p className="text-slate-400 text-sm">Camera loading...</p>
                </div>
              )}
            </div>

            <div className="relative aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-700">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                data-testid="video-remote"
              />
              <div className="absolute top-2 left-2">
                <Badge variant="secondary" className="text-xs">Partner</Badge>
              </div>
              {pageState === 'matching' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-3">
                  <Loader2 className="h-12 w-12 animate-spin text-emerald-400" />
                  <p className="text-emerald-300 text-lg font-medium">Finding someone...</p>
                  <p className="text-slate-400 text-sm">This usually takes a few seconds</p>
                </div>
              )}
              {pageState !== 'matching' && pageState !== 'connected' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-3">
                  <Users className="h-12 w-12 text-slate-500" />
                  <p className="text-slate-400 text-sm">Click Start to find someone</p>
                </div>
              )}
            </div>
          </div>

          {pageState === 'connected' && (
            <Card className="border-slate-700 bg-slate-900/50">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2 text-slate-300">
                  <MessageSquare className="h-4 w-4" />
                  Text Chat
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div
                  ref={chatScrollRef}
                  className="h-36 overflow-y-auto mb-3 space-y-2 p-3 rounded-md bg-slate-950/50 border border-slate-700"
                  data-testid="chat-messages"
                >
                  {chatMessages.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">
                      Send a message to start chatting
                    </p>
                  )}
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}
                      data-testid={`chat-message-${msg.from}`}
                    >
                      <div
                        className={`max-w-[75%] px-3 py-1.5 rounded-md text-sm ${
                          msg.from === 'me'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-700 text-slate-100'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }}
                  className="flex gap-2"
                >
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    maxLength={500}
                    data-testid="input-chat-message"
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!chatInput.trim()}
                    data-testid="button-send-chat"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-center gap-4 py-2 flex-wrap">
            {pageState === 'connected' && (
              <>
                <Button
                  variant={videoEnabled ? "default" : "destructive"}
                  size="icon"
                  onClick={toggleVideo}
                  data-testid="button-toggle-video"
                >
                  {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>

                <Button
                  variant={audioEnabled ? "default" : "destructive"}
                  size="icon"
                  onClick={toggleAudio}
                  data-testid="button-toggle-audio"
                >
                  {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </Button>
              </>
            )}

            {(pageState === 'ready' || pageState === 'camera_prompt') && (
              <Button
                size="lg"
                onClick={handleStart}
                disabled={socketStatus !== 'connected' || user.credits < 1}
                data-testid="button-start"
                className="gap-2 text-lg px-8"
              >
                <Video className="h-5 w-5" />
                {socketStatus !== 'connected' ? 'Connecting...' : user.credits < 1 ? 'Need Credits' : 'Start (1 credit)'}
              </Button>
            )}

            {pageState === 'matching' && (
              <Button
                size="lg"
                variant="outline"
                onClick={handleCancel}
                data-testid="button-cancel"
                className="gap-2"
              >
                Cancel
              </Button>
            )}

            {pageState === 'connected' && (
              <>
                <Button
                  size="lg"
                  onClick={handleNext}
                  data-testid="button-next"
                  className="gap-2"
                >
                  <SkipForward className="h-5 w-5" />
                  Next
                </Button>

                <Button
                  variant="destructive"
                  size="lg"
                  onClick={handleDisconnect}
                  data-testid="button-disconnect"
                  className="gap-2"
                >
                  <PhoneOff className="h-5 w-5" />
                  Stop
                </Button>
              </>
            )}
          </div>
        </div>
      </main>

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(authUser: User) => {
          setUser(authUser);
          setShowAuthModal(false);
        }}
      />

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
