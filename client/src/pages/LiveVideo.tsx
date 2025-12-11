import { useState, useEffect, useRef } from "react";
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

interface PeerConnection {
  pc: RTCPeerConnection;
  partnerId: string;
}

export default function LiveVideo() {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const partnerIdRef = useRef<string | null>(null); // Ref for current partnerId (avoids stale closure)
  
  const { toast } = useToast();

  // ICE servers for WebRTC
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  // Load user session
  useEffect(() => {
    const savedUser = localStorage.getItem('pong-user');
    const sessionId = localStorage.getItem('pong-session');
    
    if (savedUser && sessionId) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      
      fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${sessionId}`,
        },
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
        .catch(err => {
          console.error('Failed to refresh user data:', err);
        });
    }
  }, []);

  // Initialize socket connection
  useEffect(() => {
    if (user) {
      const sessionId = localStorage.getItem('pong-session');
      if (!sessionId) {
        console.error('[LiveVideo] No session ID found, cannot connect to socket');
        return;
      }

      console.log('[LiveVideo] Creating socket connection...');
      console.log('[LiveVideo] Origin:', window.location.origin);
      console.log('[LiveVideo] Session ID:', sessionId.substring(0, 8) + '...');

      const newSocket = io(window.location.origin, {
        auth: { sessionId },
        transports: ['websocket', 'polling'], // Prefer websocket but fallback to polling
      });
      
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('✅ [LiveVideo] Socket connected! ID:', newSocket.id);
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ [LiveVideo] Socket connection error:', error.message);
        toast({
          title: "Connection Error",
          description: "Failed to connect to server. Please refresh the page.",
          variant: "destructive",
        });
      });

      newSocket.on('disconnect', (reason) => {
        console.log('[LiveVideo] Socket disconnected:', reason);
      });

      newSocket.on('creditsUpdated', (newCredits: number) => {
        setUser(prev => prev ? { ...prev, credits: newCredits } : null);
      });

      // WebRTC signaling events
      newSocket.on('liveMatch:found', async (data: { partnerId: string; sessionId: string }) => {
        console.log('🎉 [LiveVideo] MATCH FOUND!');
        console.log('[LiveVideo] Partner ID:', data.partnerId);
        console.log('[LiveVideo] Session ID:', data.sessionId);
        
        setIsMatching(false);
        setPartnerId(data.partnerId);
        partnerIdRef.current = data.partnerId; // Update ref immediately
        
        // Request camera/mic access now that match is found
        try {
          console.log('[LiveVideo] Requesting camera/mic access...');
          await initLocalStream();
          console.log('[LiveVideo] Media access granted');
        } catch (err) {
          console.error('[LiveVideo] Failed to get media access:', err);
        }
        
        console.log('[LiveVideo] Creating peer connection as offerer...');
        await createPeerConnection(data.partnerId, true);
        console.log('[LiveVideo] Peer connection created');
      });

      newSocket.on('liveMatch:offer', async (data: { offer: RTCSessionDescriptionInit; from: string }) => {
        console.log('[LiveVideo] Received offer from:', data.from);
        console.log('[LiveVideo] Current partnerIdRef:', partnerIdRef.current);
        
        // Use ref to get current partnerId value (avoids stale closure)
        const currentPartnerId = partnerIdRef.current;
        if (!currentPartnerId || currentPartnerId !== data.from) {
          console.log('[LiveVideo] Ignoring offer - not from matched partner');
          return;
        }
        
        try {
          await createPeerConnection(data.from, false);
          await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await peerConnectionRef.current?.createAnswer();
          if (answer) {
            await peerConnectionRef.current?.setLocalDescription(answer);
            newSocket.emit('liveMatch:answer', { answer, to: data.from });
            console.log('[LiveVideo] Sent answer to:', data.from);
          }
        } catch (err) {
          console.error('[LiveVideo] Error handling offer:', err);
        }
      });

      newSocket.on('liveMatch:answer', async (data: { answer: RTCSessionDescriptionInit; from?: string }) => {
        console.log('[LiveVideo] Received answer from:', data.from);
        
        // Use ref for current partnerId (avoids stale closure)
        const currentPartnerId = partnerIdRef.current;
        if (!currentPartnerId || (data.from && data.from !== currentPartnerId)) {
          console.log('[LiveVideo] Ignoring answer - not from matched partner');
          return;
        }
        
        try {
          await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log('[LiveVideo] Set remote description from answer');
        } catch (err) {
          console.error('[LiveVideo] Error setting remote description:', err);
        }
      });

      newSocket.on('liveMatch:iceCandidate', async (data: { candidate: RTCIceCandidateInit; from: string }) => {
        console.log('[LiveVideo] Received ICE candidate from:', data.from);
        
        // Use ref for current partnerId (avoids stale closure)
        const currentPartnerId = partnerIdRef.current;
        if (!currentPartnerId || currentPartnerId !== data.from) {
          console.log('[LiveVideo] Ignoring ICE candidate - not from matched partner');
          return;
        }
        
        if (peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (err) {
            console.error('[LiveVideo] Error adding ICE candidate:', err);
          }
        }
      });

      newSocket.on('liveMatch:partnerDisconnected', () => {
        console.log('[LiveVideo] Partner disconnected');
        handleDisconnect();
        toast({
          title: "Partner Disconnected",
          description: "Your partner has left the session",
          variant: "destructive",
        });
      });

      newSocket.on('liveMatch:ended', () => {
        console.log('[LiveVideo] Session ended');
        handleDisconnect();
      });

      newSocket.on('error', (data: { message: string }) => {
        console.error('[LiveVideo] Server error:', data.message);
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive",
        });
        setIsMatching(false);
      });

      return () => {
        console.log('[LiveVideo] Cleaning up socket connection');
        newSocket.disconnect();
      };
    }
  }, [user?.id]); // Only reconnect if user ID changes, not on credit updates

  // Cleanup when leaving page
  useEffect(() => {
    return () => {
      // Send leave event when component unmounts (user navigates away)
      // liveMatch:leave handles both queue and session cleanup
      if (socket && (isMatching || partnerId)) {
        console.log('[LiveVideo Client] Component unmounting - sending leave event');
        socket.emit('liveMatch:leave');
      }
    };
  }, [socket, isMatching, partnerId]);

  // Initialize local video stream only when needed (privacy)
  const initLocalStream = async () => {
    if (localStreamRef.current) return; // Already initialized
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing media devices:', err);
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera and microphone access to use live video",
        variant: "destructive",
      });
      throw err;
    }
  };

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Session timer
  useEffect(() => {
    if (isConnected) {
      setSessionTime(0);
      sessionTimerRef.current = setInterval(() => {
        setSessionTime(prev => {
          const newTime = prev + 1;
          // Auto-end session after 60 seconds
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
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    };
  }, [isConnected]);

  const createPeerConnection = async (partnerIdParam: string, isOfferer: boolean) => {
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    // Add local stream to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('Received remote track');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setIsConnected(true);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('liveMatch:iceCandidate', {
          candidate: event.candidate,
          to: partnerIdParam
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        handleDisconnect();
      }
    };

    // Create and send offer if initiator
    if (isOfferer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.emit('liveMatch:offer', { offer, to: partnerIdParam });
    }
  };

  const handleFindMatch = async () => {
    console.log('[LiveVideo] handleFindMatch called');
    console.log('[LiveVideo] User:', user?.id);
    console.log('[LiveVideo] Socket exists:', !!socket);
    console.log('[LiveVideo] Socket connected:', socket?.connected);
    
    if (!user) {
      console.log('[LiveVideo] No user - showing auth modal');
      setShowAuthModal(true);
      return;
    }

    if (!socket) {
      console.error('[LiveVideo] Socket not initialized');
      toast({
        title: "Connection Error",
        description: "Please wait for connection or refresh the page",
        variant: "destructive",
      });
      return;
    }

    if (!socket.connected) {
      console.error('[LiveVideo] Socket not connected, attempting reconnect...');
      socket.connect();
      toast({
        title: "Reconnecting",
        description: "Attempting to reconnect to server...",
      });
      return;
    }

    if (user.credits < 1) {
      console.log('[LiveVideo] Insufficient credits');
      toast({
        title: "Not Enough Credits",
        description: "You need 1 credit to start a live video session",
        variant: "destructive",
      });
      return;
    }

    console.log('[LiveVideo] Emitting liveMatch:join event');
    setIsMatching(true);
    socket.emit('liveMatch:join');
    console.log('[LiveVideo] Event emitted successfully');
  };

  const handleNext = () => {
    if (socket && partnerId) {
      socket.emit('liveMatch:next');
    }
    handleDisconnect();
    handleFindMatch();
  };

  const handleDisconnect = () => {
    console.log('[LiveVideo] handleDisconnect called');
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setIsConnected(false);
    setPartnerId(null);
    partnerIdRef.current = null; // Clear ref too
    setIsMatching(false);
  };

  const handleLeaveSession = () => {
    if (socket && isConnected) {
      socket.emit('liveMatch:leave');
    }
    handleDisconnect();
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('pong-user');
    localStorage.removeItem('pong-session');
    setUser(null);
    socket?.disconnect();
    navigate('/');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-emerald-500/20 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                data-testid="button-home"
              >
                <Home className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold text-emerald-400">Live Video Chat</h1>
            </div>
            
            <div className="flex items-center gap-4">
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

      {/* Main Content */}
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
              {/* Status Bar */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
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
                      ) : (
                        <Badge variant="outline" className="gap-2" data-testid="badge-offline">
                          Offline
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      Cost: 1 credit per session
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Video Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Local Video */}
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
                      {!videoEnabled && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                          <VideoOff className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Remote Video */}
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

              {/* Controls */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center gap-4">
                    {/* Media Controls */}
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

                    {/* Session Controls */}
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

              {/* Info */}
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
        onAuthSuccess={(user: User) => {
          setUser(user);
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
