import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useLocation } from "wouter";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Video, VideoOff, Mic, MicOff, Users, Clock, Gem, LogOut, Home, Loader2, SkipForward, PhoneOff, Send, MessageSquare } from "lucide-react";
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

export default function LiveVideo() {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [currentRoom, setCurrentRoom] = useState<MatchData | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const callObjectRef = useRef<DailyCall | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    const savedUser = getUserData();
    const sessionId = getSessionId();
    
    if (savedUser && sessionId) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${sessionId}` },
      })
        .then(res => {
          if (!res.ok) {
            clearAllSession();
            setUser(null);
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
    }
  }, []);

  useEffect(() => {
    if (user) {
      const sessionId = getSessionId();
      if (!sessionId) return;

      const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
      const newSocket = io(socketUrl, {
        auth: { sessionId },
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
      });
      
      socketRef.current = newSocket;
      setSocket(newSocket);

      newSocket.on('connect', () => {
        setSocketConnected(true);
        toast({ title: "Connected", description: "Ready to find a match!" });
      });

      newSocket.on('connect_error', () => {
        setSocketConnected(false);
        toast({ title: "Connection Error", description: "Failed to connect. Please refresh.", variant: "destructive" });
      });

      newSocket.on('disconnect', () => setSocketConnected(false));

      newSocket.on('creditsUpdated', (newCredits: number) => {
        setUser(prev => prev ? { ...prev, credits: newCredits } : null);
      });

      newSocket.on('liveMatch:found', async (data: MatchData) => {
        console.log('[LiveVideo] Match found! Room:', data.roomUrl);
        setIsMatching(false);
        setCurrentRoom(data);
        setIsConnected(true);

        try {
          await joinDailyRoom(data);
        } catch (err) {
          console.error('[LiveVideo] Failed to join room:', err);
          toast({ title: "Video Error", description: "Failed to start video. Please try again.", variant: "destructive" });
          cleanupCall();
        }
      });

      newSocket.on('liveMatch:partnerDisconnected', () => {
        toast({ title: "Partner Disconnected", description: "Your partner has left the session", variant: "destructive" });
        cleanupCall();
      });

      newSocket.on('liveMatch:ended', () => {
        cleanupCall();
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
        toast({ title: "Error", description: data.message, variant: "destructive" });
        setIsMatching(false);
      });

      return () => {
        socketRef.current = null;
        newSocket.disconnect();
      };
    }
  }, [user?.id]);

  useEffect(() => {
    return () => {
      const sock = socketRef.current;
      if (sock && (isMatching || currentRoom)) {
        sock.emit('liveMatch:leave');
      }
    };
  }, [isMatching, currentRoom]);

  const joinDailyRoom = async (data: MatchData) => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }

      if (callObjectRef.current) {
        try { await callObjectRef.current.destroy(); } catch (e) {}
        callObjectRef.current = null;
      }

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
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        if (event?.participant) {
          const el = document.getElementById(`daily-remote-audio-${event.participant.session_id}`);
          if (el) el.remove();
        }
      });

      callObject.on('error', (event) => {
        console.error('[Daily] Call error:', event);
        toast({ title: "Video Error", description: "A video connection error occurred.", variant: "destructive" });
      });

      console.log('[Daily] Joining room:', data.roomUrl);
      await callObject.join({ url: data.roomUrl, token: data.token });
      console.log('[Daily] Joined room successfully');

    } catch (err) {
      console.error('[Daily] Error joining room:', err);
      throw err;
    }
  };

  const cleanupCall = useCallback(() => {
    if (callObjectRef.current) {
      try {
        callObjectRef.current.leave();
        callObjectRef.current.destroy();
      } catch (e) {
        console.error('[Daily] Error leaving call:', e);
      }
      callObjectRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    document.querySelectorAll('audio[id^="daily-remote-audio-"]').forEach(el => el.remove());

    setIsConnected(false);
    setCurrentRoom(null);
    setIsMatching(false);
    setVideoEnabled(true);
    setAudioEnabled(true);
  }, []);

  useEffect(() => {
    return () => {
      if (callObjectRef.current) {
        try { callObjectRef.current.leave(); callObjectRef.current.destroy(); } catch (e) {}
        callObjectRef.current = null;
      }
      document.querySelectorAll('audio[id^="daily-remote-audio-"]').forEach(el => el.remove());
    };
  }, []);

  useEffect(() => {
    if (isConnected) {
      setSessionTime(0);
      setChatMessages([]);
      setChatInput('');
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
  }, [isConnected]);

  const handleFindMatch = async () => {
    const sock = socketRef.current;
    
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!sock || !sock.connected) {
      toast({ title: "Connection Error", description: "Please wait for connection or refresh the page", variant: "destructive" });
      if (sock && !sock.connected) sock.connect();
      return;
    }

    if (user.credits < 1) {
      toast({ title: "Not Enough Credits", description: "You need 1 credit to start a live video session", variant: "destructive" });
      return;
    }

    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      console.log('[LiveVideo] Camera/mic permission granted');
    } catch (err: any) {
      console.error('[LiveVideo] getUserMedia error:', err);
      toast({ title: "Camera Not Available", description: "Video/audio unavailable. You can still use text chat.", variant: "default" });
    }

    setIsMatching(true);
    sock.emit('liveMatch:join');
    console.log('[LiveVideo] Emitted liveMatch:join');
  };

  const handleNext = () => {
    const sock = socketRef.current;
    if (sock && currentRoom) {
      sock.emit('liveMatch:next');
    }
    cleanupCall();
    setTimeout(() => {
      handleFindMatch();
    }, 500);
  };

  const handleLeaveSession = () => {
    const sock = socketRef.current;
    if (sock && isConnected) {
      sock.emit('liveMatch:leave');
    }
    cleanupCall();
  };

  const sendChatMessage = () => {
    const sock = socketRef.current;
    if (!sock || !isConnected || !chatInput.trim()) return;

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
      if (videoEnabled) {
        callObjectRef.current.setLocalVideo(false);
        setVideoEnabled(false);
      } else {
        callObjectRef.current.setLocalVideo(true);
        setVideoEnabled(true);
      }
    } catch (err) {
      console.error('[Daily] Toggle video error:', err);
    }
  };

  const toggleAudio = async () => {
    if (!callObjectRef.current) return;
    try {
      if (audioEnabled) {
        callObjectRef.current.setLocalAudio(false);
        setAudioEnabled(false);
      } else {
        callObjectRef.current.setLocalAudio(true);
        setAudioEnabled(true);
      }
    } catch (err) {
      console.error('[Daily] Toggle audio error:', err);
    }
  };

  const handleLogout = () => {
    clearAllSession();
    setUser(null);
    cleanupCall();
    socketRef.current?.disconnect();
    navigate('/');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      <header className="border-b border-emerald-500/20 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                data-testid="button-home"
              >
                <Home className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold text-emerald-400" data-testid="text-page-title">Live Video Chat</h1>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap">
              {user ? (
                <>
                  <Badge variant="secondary" className="gap-2 px-4 py-2" data-testid="badge-credits">
                    <Gem className="h-4 w-4" />
                    {user.credits.toFixed(1)} Credits
                  </Badge>
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    data-testid="button-logout"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setShowAuthModal(true)}
                  data-testid="button-login"
                >
                  Login / Sign Up
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {!user ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-16 w-16 mx-auto mb-4 text-emerald-400" />
                <h2 className="text-2xl font-bold mb-4">Welcome to Live Video Chat</h2>
                <p className="text-muted-foreground mb-6">
                  Connect with random people via video, audio, and text chat. 1 credit per session.
                </p>
                <Button
                  size="lg"
                  onClick={() => setShowAuthModal(true)}
                  data-testid="button-get-started"
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      {isConnected ? (
                        <>
                          <Badge variant="default" className="gap-2" data-testid="badge-connected">
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                            Connected
                          </Badge>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-session-time">
                            <Clock className="h-4 w-4" />
                            {formatTime(sessionTime)}
                          </div>
                        </>
                      ) : isMatching ? (
                        <Badge variant="secondary" className="gap-2" data-testid="badge-matching">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Finding a match...
                        </Badge>
                      ) : socketConnected ? (
                        <Badge variant="outline" className="gap-2 border-green-500" data-testid="badge-ready">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-2 border-yellow-500" data-testid="badge-connecting">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Connecting...
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-sm text-muted-foreground" data-testid="text-cost-info">
                      Cost: 1 credit per session
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">You</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="relative aspect-video bg-slate-950 rounded-b-lg overflow-hidden">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover mirror"
                        data-testid="video-local"
                      />
                      {!isConnected && !isMatching && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                          <Video className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      {(isConnected || isMatching) && !videoEnabled && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                          <VideoOff className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Partner</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="relative aspect-video bg-slate-950 rounded-b-lg overflow-hidden">
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                        data-testid="video-remote"
                      />
                      {!isConnected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                          <Users className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {isConnected && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Text Chat
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div
                      ref={chatScrollRef}
                      className="h-48 overflow-y-auto mb-3 space-y-2 p-3 rounded-md bg-slate-950/50 border border-border"
                      data-testid="chat-messages"
                    >
                      {chatMessages.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
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
                                : 'bg-muted text-foreground'
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

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center gap-4 flex-wrap">
                    <Button
                      variant={videoEnabled ? "default" : "destructive"}
                      size="icon"
                      onClick={toggleVideo}
                      disabled={!isConnected}
                      data-testid="button-toggle-video"
                    >
                      {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                    </Button>
                    
                    <Button
                      variant={audioEnabled ? "default" : "destructive"}
                      size="icon"
                      onClick={toggleAudio}
                      disabled={!isConnected}
                      data-testid="button-toggle-audio"
                    >
                      {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                    </Button>

                    {!isConnected && !isMatching && (
                      <Button
                        size="lg"
                        onClick={handleFindMatch}
                        disabled={!user || user.credits < 1}
                        data-testid="button-find-match"
                        className="gap-2"
                      >
                        <Users className="h-5 w-5" />
                        Find Match (1 credit)
                      </Button>
                    )}

                    {isMatching && (
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => {
                          const sock = socketRef.current;
                          if (sock) sock.emit('liveMatch:leave');
                          if (localStreamRef.current) {
                            localStreamRef.current.getTracks().forEach(t => t.stop());
                            localStreamRef.current = null;
                          }
                          if (localVideoRef.current) localVideoRef.current.srcObject = null;
                          setIsMatching(false);
                        }}
                        data-testid="button-cancel-match"
                        className="gap-2"
                      >
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Cancel
                      </Button>
                    )}

                    {isConnected && (
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
                          onClick={handleLeaveSession}
                          data-testid="button-disconnect"
                          className="gap-2"
                        >
                          <PhoneOff className="h-5 w-5" />
                          Disconnect
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Alert>
                <AlertDescription>
                  <strong>How it works:</strong> Each session costs 1 credit. 
                  Click "Find Match" to connect with a random person. Chat via video, audio, or text for as long as you like. 
                  Use "Next" to skip to another match, or "Disconnect" to end your session.
                </AlertDescription>
              </Alert>
            </div>
          )}
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
