import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Video, VideoOff, Mic, MicOff, Users, Clock, Gem, LogOut, Home, Loader2, SkipForward, PhoneOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthModal } from "@/components/AuthModal";

interface User {
  id: string;
  email: string;
  name: string;
  credits: number;
}

interface MatchData {
  sessionId: string;
  roomName: string;
  meteredDomain: string;
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

  const socketRef = useRef<Socket | null>(null);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const meetingRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const sdkLoadedRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);

  const { toast } = useToast();

  const loadMeteredSdk = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      if ((window as any).Metered) {
        sdkLoadedRef.current = true;
        resolve();
        return;
      }
      if (sdkLoadedRef.current) {
        resolve();
        return;
      }
      const existing = document.querySelector('script[src*="metered"]');
      if (existing) {
        existing.addEventListener('load', () => {
          sdkLoadedRef.current = true;
          resolve();
        });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.metered.ca/sdk/video/1.4.6/sdk.min.js';
      script.async = true;
      script.onload = () => {
        sdkLoadedRef.current = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Metered SDK'));
      document.head.appendChild(script);
    });
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('pong-user');
    const sessionId = localStorage.getItem('pong-session');
    
    if (savedUser && sessionId) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${sessionId}` },
      })
        .then(res => {
          if (!res.ok) {
            localStorage.removeItem('pong-user');
            localStorage.removeItem('pong-session');
            setUser(null);
            return null;
          }
          return res.json();
        })
        .then(freshUser => {
          if (freshUser) {
            setUser(freshUser);
            localStorage.setItem('pong-user', JSON.stringify(freshUser));
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (user) {
      const sessionId = localStorage.getItem('pong-session');
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
        console.log('[LiveVideo] Match found! Room:', data.roomName);
        setIsMatching(false);
        setCurrentRoom(data);
        setIsConnected(true);

        try {
          await loadMeteredSdk();
          await joinMeteredRoom(data);
        } catch (err) {
          console.error('[LiveVideo] Failed to join room:', err);
          toast({ title: "Video Error", description: "Failed to start video. Please try again.", variant: "destructive" });
          cleanupMeeting();
        }
      });

      newSocket.on('liveMatch:partnerDisconnected', () => {
        toast({ title: "Partner Disconnected", description: "Your partner has left the session", variant: "destructive" });
        cleanupMeeting();
      });

      newSocket.on('liveMatch:ended', () => {
        cleanupMeeting();
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

  const joinMeteredRoom = async (data: MatchData) => {
    try {
      const MeteredModule = (window as any).Metered;
      if (!MeteredModule) {
        throw new Error('Metered SDK not loaded. Please refresh the page.');
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }

      const meeting = new MeteredModule.Meeting();
      meetingRef.current = meeting;

      meeting.on('localTrackStarted', (trackItem: any) => {
        console.log('[LiveVideo] Local track started:', trackItem.type);
        if (trackItem.type === 'video' && localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([trackItem.track]);
        }
      });

      meeting.on('localTrackUpdated', (trackItem: any) => {
        console.log('[LiveVideo] Local track updated:', trackItem.type);
        if (trackItem.type === 'video' && localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([trackItem.track]);
        }
      });

      meeting.on('remoteTrackStarted', (trackItem: any) => {
        console.log('[LiveVideo] Remote track started:', trackItem.type);
        if (trackItem.type === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = new MediaStream([trackItem.track]);
        }
        if (trackItem.type === 'audio') {
          const audio = document.createElement('audio');
          audio.srcObject = new MediaStream([trackItem.track]);
          audio.autoplay = true;
          audio.id = `remote-audio-${trackItem.participantSessionId}`;
          document.body.appendChild(audio);
        }
      });

      meeting.on('remoteTrackStopped', (trackItem: any) => {
        if (trackItem.type === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        if (trackItem.type === 'audio') {
          const el = document.getElementById(`remote-audio-${trackItem.participantSessionId}`);
          if (el) el.remove();
        }
      });

      meeting.on('participantLeft', () => {
        console.log('[LiveVideo] Participant left');
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      });

      meeting.on('onlineParticipants', (participants: any[]) => {
        console.log('[LiveVideo] Online participants:', participants.length);
      });

      meeting.on('error', (error: any) => {
        console.error('[LiveVideo] Metered SDK error:', error);
        toast({ title: "Video Error", description: "A video connection error occurred. Please try again.", variant: "destructive" });
      });

      const roomUrl = `${data.meteredDomain}/${data.roomName}`;
      console.log('[LiveVideo] Joining Metered room:', roomUrl);

      const meetingInfo = await meeting.join({
        roomURL: roomUrl,
        name: user?.name || 'User',
      });

      console.log('[LiveVideo] Joined Metered room successfully, info:', JSON.stringify(meetingInfo));

      try {
        await meeting.startVideo();
        console.log('[LiveVideo] Video started');
      } catch (videoErr) {
        console.error('[LiveVideo] startVideo error:', videoErr);
      }

      try {
        await meeting.startAudio();
        console.log('[LiveVideo] Audio started');
      } catch (audioErr) {
        console.error('[LiveVideo] startAudio error:', audioErr);
      }
    } catch (err) {
      console.error('[LiveVideo] Error joining Metered room:', err);
      throw err;
    }
  };

  const cleanupMeeting = useCallback(() => {
    if (meetingRef.current) {
      try {
        meetingRef.current.leaveMeeting();
      } catch (e) {
        console.error('[LiveVideo] Error leaving meeting:', e);
      }
      meetingRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    document.querySelectorAll('audio[id^="remote-audio-"]').forEach(el => el.remove());

    setIsConnected(false);
    setCurrentRoom(null);
    setIsMatching(false);
    setVideoEnabled(true);
    setAudioEnabled(true);
  }, []);

  useEffect(() => {
    return () => {
      if (meetingRef.current) {
        try { meetingRef.current.leaveMeeting(); } catch (e) {}
        meetingRef.current = null;
      }
      document.querySelectorAll('audio[id^="remote-audio-"]').forEach(el => el.remove());
    };
  }, []);

  useEffect(() => {
    if (isConnected) {
      setSessionTime(0);
      sessionTimerRef.current = setInterval(() => {
        setSessionTime(prev => {
          const newTime = prev + 1;
          if (newTime >= 60) {
            handleNext();
          }
          return newTime;
        });
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
      await loadMeteredSdk();
    } catch {
      toast({ title: "Error", description: "Failed to load video system. Please refresh.", variant: "destructive" });
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
      toast({ title: "Camera Access Required", description: "Please allow camera and microphone access to use video chat.", variant: "destructive" });
      return;
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
    cleanupMeeting();
    setTimeout(() => {
      handleFindMatch();
    }, 500);
  };

  const handleLeaveSession = () => {
    const sock = socketRef.current;
    if (sock && isConnected) {
      sock.emit('liveMatch:leave');
    }
    cleanupMeeting();
  };

  const toggleVideo = async () => {
    if (!meetingRef.current) return;
    try {
      if (videoEnabled) {
        await meetingRef.current.stopVideo();
        setVideoEnabled(false);
      } else {
        await meetingRef.current.startVideo();
        setVideoEnabled(true);
      }
    } catch (err) {
      console.error('[LiveVideo] Toggle video error:', err);
    }
  };

  const toggleAudio = async () => {
    if (!meetingRef.current) return;
    try {
      if (audioEnabled) {
        await meetingRef.current.stopAudio();
        setAudioEnabled(false);
      } else {
        await meetingRef.current.startAudio();
        setAudioEnabled(true);
      }
    } catch (err) {
      console.error('[LiveVideo] Toggle audio error:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('pong-user');
    localStorage.removeItem('pong-session');
    setUser(null);
    cleanupMeeting();
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
                  Connect with random people in 1-minute video sessions. 1 credit per session.
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
                            {formatTime(sessionTime)} / 1:00
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
                      {!isConnected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                          <Video className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      {isConnected && !videoEnabled && (
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
                  <strong>How it works:</strong> Each session costs 1 credit and lasts up to 1 minute. 
                  Click "Find Match" to connect with a random person. Use "Next" to skip to another match, 
                  or "Disconnect" to end your session.
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
