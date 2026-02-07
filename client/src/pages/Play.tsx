import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Gem, LogOut, DollarSign, Loader2, Zap, Gamepad2, Plus, Minus, UserCircle, Trophy, Users, TrendingUp, Shield, Check, Star, MessageCircle, ChevronRight, Sparkles, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthModal } from "@/components/AuthModal";
import { GameCanvas } from "@/components/GameCanvas";
import { Leaderboard } from "@/components/Leaderboard";
import { ActionLog } from "@/components/ActionLog";
import { PayoutModal } from "@/components/PayoutModal";
import { ShareButton } from "@/components/ShareButton";
import { MatchmakingLobby } from "@/components/MatchmakingLobby";
import { getSessionId, getUserData, setUserData, clearAllSession } from "@/lib/sessionHelper";
import logoImg from "@assets/IMG_2786_1763969320612.jpeg";

interface User {
  id: string;
  email: string;
  name: string;
  credits: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  totalEarnings: number;
}

interface Game {
  id: string;
  name: string;
  description: string;
  players: string;
  difficulty: string;
}

export default function Play() {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [matchmaking, setMatchmaking] = useState(false);
  const [matchmakingTimer, setMatchmakingTimer] = useState(1);
  const [inGame, setInGame] = useState(false);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<string>('pong');
  const [betAmount, setBetAmount] = useState<number>(1);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [queuedPlayers, setQueuedPlayers] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const savedUser = getUserData();
    const sessionId = getSessionId();
    
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
        .catch(err => {
          console.error('Failed to refresh user data:', err);
        });
    }

    // Fetch available games
    fetch('/api/games')
      .then(res => res.json())
      .then(games => setAvailableGames(games))
      .catch(err => console.error('Failed to fetch games:', err));
  }, []);

  useEffect(() => {
    if (user) {
      const sessionId = getSessionId();
      if (!sessionId) {
        console.error('No session ID found, cannot connect to socket');
        return;
      }

      console.log('Initializing socket with sessionId:', sessionId);
      
      const newSocket = io(window.location.origin, {
        auth: { sessionId }
      });
      
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('✅ Socket connected successfully!', newSocket.id);
      });
      
      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
      });
      
      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });

      newSocket.on('matchFound', (data?: { matchId?: string; gameType?: string }) => {
        console.log('[CLIENT] ✅ matchFound event received:', data);
        console.log('[CLIENT] Setting inGame=true, matchId=', data?.matchId);
        setMatchmaking(false);
        setInGame(true);
        if (data?.matchId) {
          setCurrentMatchId(data.matchId);
        }
        console.log('[CLIENT] State updated - waiting for gameState event...');
        toast({
          title: "Match Found!",
          description: "Get ready to play!",
        });
      });

      newSocket.on('matchEnded', (result: { winnerId: string; player1Credits: number; player2Credits: number; player1Id: string; player2Id: string }) => {
        setInGame(false);
        setCurrentMatchId(null);
        const won = result.winnerId === user.id;
        const isPlayer1 = result.player1Id === user.id;
        const newCredits = isPlayer1 ? result.player1Credits : result.player2Credits;
        
        setUser(prev => prev ? {
          ...prev,
          credits: newCredits,
          wins: won ? prev.wins + 1 : prev.wins,
          losses: won ? prev.losses : prev.losses + 1,
          matchesPlayed: prev.matchesPlayed + 1,
          totalEarnings: prev.totalEarnings + (won ? 1.6 : 0)
        } : null);

        toast({
          title: won ? "Victory!" : "Defeat",
          description: won 
            ? `You won! +1.6 credits (net +0.6)` 
            : `You lost (entry fee -1 credit)`,
          variant: won ? "default" : "destructive",
        });
      });

      newSocket.on('creditsUpdated', (newCredits: number) => {
        setUser(prev => prev ? { ...prev, credits: newCredits } : null);
      });

      newSocket.on('queueUpdate', (players: any[]) => {
        setQueuedPlayers(players);
      });

      newSocket.on('matchmakingCountdown', (seconds: number) => {
        console.log('[CLIENT] Countdown update:', seconds);
        setMatchmakingTimer(seconds);
      });

      return () => {
        newSocket.close();
      };
    }
  }, [user ? true : false]);

  const handleAuthSuccess = (newUser: User) => {
    setUser(newUser);
    setUserData(JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    clearAllSession();
    if (socket) {
      socket.close();
    }
    toast({
      title: "Logged Out",
      description: "See you next time!",
    });
  };

  const handleJoinMatchmaking = async () => {
    if (!user || user.credits < betAmount) {
      toast({
        title: "Insufficient Credits",
        description: `You need at least ${betAmount} credits to play. Add credits to continue!`,
        variant: "destructive",
      });
      return;
    }

    setMatchmaking(true);
    setMatchmakingTimer(10);
    socket?.emit('joinMatchmaking', { gameType: selectedGame, betAmount });
    toast({
      title: "Finding Match...",
      description: `Searching for ${availableGames.find(g => g.id === selectedGame)?.name || 'Pong'} opponent (Bet: ${betAmount} credits)`,
    });
  };

  const handleCancelMatchmaking = () => {
    setMatchmaking(false);
    setMatchmakingTimer(10);
    socket?.emit('leaveMatchmaking');
  };

  const handleMatchNow = () => {
    socket?.emit('matchNow');
    toast({
      title: "Matching Now!",
      description: "Starting match with AI bot...",
    });
  };

  const handleAddCredits = () => {
    window.location.href = 'https://buy.stripe.com/8x26oIa5OacYb46eVCcMM02';
  };

  const handlePayoutSuccess = () => {
    setUser(prev => prev ? { ...prev, credits: 0 } : null);
  };

  const handleJoinSpecificMatch = async (targetUserId: string) => {
    if (!socket || !user) return;

    const targetPlayer = queuedPlayers.find(p => p.userId === targetUserId);
    if (!targetPlayer) {
      toast({
        title: "Match Unavailable",
        description: "This match request is no longer available.",
        variant: "destructive",
      });
      return;
    }

    if (user.credits < targetPlayer.betAmount) {
      toast({
        title: "Insufficient Credits",
        description: `You need ${targetPlayer.betAmount} credits to join this match.`,
        variant: "destructive",
      });
      return;
    }

    // Server will deduct credits and validate
    socket.emit('joinSpecificMatch', { targetUserId });
    
    toast({
      title: "Joining Match...",
      description: `Joining ${targetPlayer.name}'s ${targetPlayer.gameType} match (Bet: ${targetPlayer.betAmount} credits)`,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img 
                src={logoImg} 
                alt="UAU - Universal AI Unlimited" 
                className="h-12 md:h-16 w-auto"
              />
              <a href="https://JustinZaragoza.com" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" data-testid="button-contact">
                  Contact
                </Button>
              </a>
              {user && (
                <Badge variant="secondary" className="text-base font-semibold hidden sm:flex">
                  {user.name}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {user ? (
                <>
                  <Card className="p-2 md:p-3 shadow-lg border-primary/20 bg-card/90">
                    <div className="flex items-center gap-2">
                      <Gem className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                      <span className="font-mono font-bold text-lg md:text-2xl text-primary" data-testid="text-credit-balance">
                        {user.credits.toFixed(1)}
                      </span>
                      <span className="text-xs md:text-sm text-muted-foreground hidden sm:inline">credits</span>
                    </div>
                  </Card>
                  <Button onClick={handleAddCredits} size="sm" data-testid="button-add-credits">
                    <DollarSign className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Add Credits</span>
                  </Button>
                  <Button
                    onClick={() => setShowPayoutModal(true)}
                    variant="outline"
                    size="sm"
                    disabled={user.credits < 1}
                    data-testid="button-request-payout"
                  >
                    <span className="hidden sm:inline">Payout</span>
                    <span className="sm:hidden">$</span>
                  </Button>
                  <ShareButton />
                  <Button 
                    onClick={() => navigate('/live')} 
                    variant="ghost" 
                    size="icon" 
                    data-testid="button-live-video"
                    title="Live Video Chat"
                  >
                    <Video className="w-4 h-4" />
                  </Button>
                  <Button 
                    onClick={() => navigate('/profile')} 
                    variant="ghost" 
                    size="icon" 
                    data-testid="button-profile"
                  >
                    <UserCircle className="w-4 h-4" />
                  </Button>
                  <Button onClick={handleLogout} variant="ghost" size="icon" data-testid="button-logout">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button onClick={() => setShowAuthModal(true)} size="lg" data-testid="button-open-auth">
                  Login / Sign Up
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>
        {!user ? (
          <div className="space-y-0 overflow-hidden">
            {/* HERO SECTION */}
            <section className="relative bg-gradient-to-br from-background via-primary/5 to-background py-20 md:py-32 overflow-hidden">
              <div className="absolute inset-0 opacity-5"></div>
              <div className="container mx-auto px-4 relative z-10">
                <div className="max-w-5xl mx-auto text-center space-y-8">
                  <Badge variant="secondary" className="text-sm px-4 py-2 animate-pulse" data-testid="badge-live">
                    <Sparkles className="w-4 h-4 mr-2 inline" />
                    Live Multiplayer Arcade
                  </Badge>
                  
                  <h1 className="text-6xl md:text-8xl font-display font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent leading-tight">
                    Win Real Cash
                    <br />
                    Playing Games
                  </h1>
                  
                  <p className="text-xl md:text-3xl text-muted-foreground max-w-3xl mx-auto font-medium">
                    Challenge players worldwide in 6 arcade classics. Every match is pay-to-play. Winners earn credits, losers learn.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                    <Button
                      onClick={() => setShowAuthModal(true)}
                      size="lg"
                      className="h-16 px-12 text-2xl font-bold shadow-2xl hover:shadow-primary/50 transition-all"
                      data-testid="button-hero-cta"
                    >
                      <Zap className="w-6 h-6 mr-2" />
                      Start Playing Free
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Get 1 free credit • No credit card required
                    </p>
                  </div>

                  {/* Live Stats Banner */}
                  <div className="grid grid-cols-3 gap-6 pt-12 max-w-4xl mx-auto">
                    <Card className="p-4 bg-card/50 backdrop-blur border-primary/10 hover-elevate" data-testid="stat-games-available">
                      <div className="text-3xl md:text-4xl font-bold text-accent">6</div>
                      <div className="text-xs md:text-sm text-muted-foreground">Games Available</div>
                    </Card>
                    <Card className="p-4 bg-card/50 backdrop-blur border-primary/10 hover-elevate" data-testid="stat-winner-payout">
                      <div className="text-3xl md:text-4xl font-bold text-green-500">1.6x</div>
                      <div className="text-xs md:text-sm text-muted-foreground">Winner Payout</div>
                    </Card>
                    <Card className="p-4 bg-card/50 backdrop-blur border-primary/10 hover-elevate" data-testid="stat-instant-match">
                      <div className="text-3xl md:text-4xl font-bold text-primary">24/7</div>
                      <div className="text-xs md:text-sm text-muted-foreground">Instant Match</div>
                    </Card>
                  </div>
                </div>
              </div>
            </section>

            {/* GAMES SHOWCASE */}
            <section className="py-20 md:py-32 bg-gradient-to-b from-background to-primary/5">
              <div className="container mx-auto px-4">
                <div className="text-center space-y-4 mb-16">
                  <h2 className="text-5xl md:text-6xl font-display font-bold">
                    Choose Your Game
                  </h2>
                  <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Six classic arcade games. Real-time multiplayer. Skill-based competition.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                  {availableGames.map((game, index) => (
                    <Card
                      key={game.id}
                      className="group relative overflow-hidden hover-elevate cursor-pointer border-2 border-transparent hover:border-primary/50 transition-all"
                      data-testid={`card-game-showcase-${game.id}`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <CardContent className="p-6 relative z-10">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                              <Gamepad2 className="w-8 h-8 text-primary" />
                            </div>
                            <Badge variant="secondary" className="font-semibold">
                              {game.players}
                            </Badge>
                          </div>
                          
                          <div>
                            <h3 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors">
                              {game.name}
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                              {game.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={game.difficulty === 'Easy' ? 'default' : game.difficulty === 'Medium' ? 'secondary' : 'outline'}
                            >
                              {game.difficulty}
                            </Badge>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-sm font-medium text-primary">1 credit entry</span>
                          </div>

                          <Button 
                            onClick={() => setShowAuthModal(true)}
                            className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                            variant="outline"
                            data-testid={`button-play-${game.id}`}
                          >
                            Play Now
                            <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </section>

            {/* PRICING / CREDITS SECTION */}
            <section className="py-20 md:py-32 bg-background">
              <div className="container mx-auto px-4">
                <div className="text-center space-y-4 mb-16">
                  <Badge variant="outline" className="text-sm px-4 py-2">
                    <Gem className="w-4 h-4 mr-2 inline" />
                    Simple Pricing
                  </Badge>
                  <h2 className="text-5xl md:text-6xl font-display font-bold">
                    Get Credits, Start Winning
                  </h2>
                  <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Buy credits. Play games. Win real money. It's that simple.
                  </p>
                </div>

                <div className="max-w-5xl mx-auto">
                  <Card className="p-8 md:p-12 bg-gradient-to-br from-card via-primary/5 to-card border-2 border-primary/20 shadow-2xl">
                    <div className="grid md:grid-cols-3 gap-8 mb-10">
                      <div className="text-center space-y-3">
                        <div className="text-6xl font-black text-primary">$1</div>
                        <div className="text-lg font-medium">= 10 Credits</div>
                        <div className="text-sm text-muted-foreground">Best Value</div>
                      </div>
                      <div className="text-center space-y-3">
                        <div className="text-6xl font-black text-accent">1</div>
                        <div className="text-lg font-medium">Credit Per Match</div>
                        <div className="text-sm text-muted-foreground">Pay to Play</div>
                      </div>
                      <div className="text-center space-y-3">
                        <div className="text-6xl font-black text-green-500">1.6</div>
                        <div className="text-lg font-medium">Credits If You Win</div>
                        <div className="text-sm text-muted-foreground">+60% Bonus</div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Button
                        onClick={() => setShowAuthModal(true)}
                        size="lg"
                        className="w-full h-16 text-2xl font-bold shadow-xl"
                        data-testid="button-pricing-cta"
                      >
                        <Gem className="w-6 h-6 mr-2" />
                        Sign Up & Get 1 Free Credit
                      </Button>
                      
                      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-green-500" />
                          Secure Payments
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-500" />
                          Instant Credits
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-500" />
                          Request Payouts
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Value Props */}
                  <div className="grid md:grid-cols-3 gap-6 mt-8">
                    <Card className="p-6 text-center hover-elevate">
                      <Trophy className="w-12 h-12 mx-auto mb-4 text-primary" />
                      <h3 className="font-bold text-lg mb-2">Win Real Cash</h3>
                      <p className="text-sm text-muted-foreground">
                        Winners earn 1.6x their bet. Request payouts anytime.
                      </p>
                    </Card>
                    <Card className="p-6 text-center hover-elevate">
                      <Zap className="w-12 h-12 mx-auto mb-4 text-accent" />
                      <h3 className="font-bold text-lg mb-2">Instant Matches</h3>
                      <p className="text-sm text-muted-foreground">
                        AI bots join in 10 seconds. Play anytime, 24/7.
                      </p>
                    </Card>
                    <Card className="p-6 text-center hover-elevate">
                      <Shield className="w-12 h-12 mx-auto mb-4 text-green-500" />
                      <h3 className="font-bold text-lg mb-2">Fair & Secure</h3>
                      <p className="text-sm text-muted-foreground">
                        Server-authoritative gameplay. No cheating possible.
                      </p>
                    </Card>
                  </div>
                </div>
              </div>
            </section>

            {/* HOW IT WORKS */}
            <section className="py-20 md:py-32 bg-gradient-to-b from-primary/5 to-background">
              <div className="container mx-auto px-4">
                <div className="text-center space-y-4 mb-16">
                  <h2 className="text-5xl md:text-6xl font-display font-bold">
                    How It Works
                  </h2>
                  <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Three simple steps to start winning
                  </p>
                </div>

                <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
                  <Card className="p-8 text-center hover-elevate border-2 border-primary/20">
                    <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                      1
                    </div>
                    <h3 className="text-2xl font-bold mb-4">Sign Up Free</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Create your account in seconds. Get 1 free credit to try your first game. No credit card required.
                    </p>
                  </Card>

                  <Card className="p-8 text-center hover-elevate border-2 border-accent/20">
                    <div className="w-16 h-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                      2
                    </div>
                    <h3 className="text-2xl font-bold mb-4">Choose & Play</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Pick your game, set your bet (1-100 credits), and get matched with an opponent in seconds.
                    </p>
                  </Card>

                  <Card className="p-8 text-center hover-elevate border-2 border-green-500/20">
                    <div className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                      3
                    </div>
                    <h3 className="text-2xl font-bold mb-4">Win & Cash Out</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Winners get 1.6x their bet instantly. Request payouts anytime via PayPal, Venmo, or CashApp.
                    </p>
                  </Card>
                </div>

                <div className="text-center mt-12">
                  <Button
                    onClick={() => setShowAuthModal(true)}
                    size="lg"
                    className="h-16 px-12 text-xl font-bold"
                    data-testid="button-how-it-works-cta"
                  >
                    Start Your First Game Free
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </div>
            </section>

            {/* SOCIAL PROOF / LIVE ACTIVITY */}
            <section className="py-20 md:py-32 bg-background">
              <div className="container mx-auto px-4">
                <div className="text-center space-y-4 mb-12">
                  <h2 className="text-5xl md:text-6xl font-display font-bold">
                    Live Activity
                  </h2>
                  <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Real players. Real games. Real wins happening now.
                  </p>
                </div>

                <div className="max-w-4xl mx-auto">
                  <ActionLog />
                </div>

                <div className="grid md:grid-cols-2 gap-8 mt-16 max-w-5xl mx-auto">
                  <Card className="p-8 hover-elevate">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <Star className="w-8 h-8 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-bold text-lg">Sarah M.</h4>
                          <Badge variant="secondary" className="text-xs">Verified Winner</Badge>
                        </div>
                        <p className="text-muted-foreground">
                          "Won $50 playing Snake in my first week! The instant matchmaking is addictive and payouts are super fast."
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-8 hover-elevate">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-accent/10">
                        <Star className="w-8 h-8 text-accent" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-bold text-lg">Mike T.</h4>
                          <Badge variant="secondary" className="text-xs">Top Player</Badge>
                        </div>
                        <p className="text-muted-foreground">
                          "Love the variety of games. Tetris and Connect 4 are my favorites. Fair gameplay and the AI is challenging!"
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </section>

            {/* FINAL CTA */}
            <section className="py-20 md:py-32 bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10">
              <div className="container mx-auto px-4">
                <Card className="max-w-4xl mx-auto p-12 md:p-16 text-center border-2 border-primary/30 shadow-2xl bg-card/80 backdrop-blur">
                  <h2 className="text-5xl md:text-6xl font-display font-bold mb-6">
                    Ready to Start Winning?
                  </h2>
                  <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                    Join hundreds of players competing in real-time arcade games. Sign up now and get your first credit free.
                  </p>
                  <Button
                    onClick={() => setShowAuthModal(true)}
                    size="lg"
                    className="h-20 px-16 text-2xl font-bold shadow-2xl hover:shadow-primary/50 transition-all"
                    data-testid="button-final-cta"
                  >
                    <Zap className="w-8 h-8 mr-3" />
                    Play Your First Game Free
                  </Button>
                  <p className="text-sm text-muted-foreground mt-6">
                    No credit card required • Instant access • 1 free credit
                  </p>
                </Card>
              </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-card border-t border-border">
              <div className="container mx-auto px-4 py-12">
                <div className="grid md:grid-cols-4 gap-8 mb-8">
                  <div className="space-y-4">
                    <img 
                      src={logoImg} 
                      alt="UAIU Arcade" 
                      className="h-12 w-auto"
                    />
                    <p className="text-sm text-muted-foreground">
                      The ultimate online arcade for competitive gaming and real cash prizes.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold mb-4">Games</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li><a href="#" className="hover:text-primary transition-colors">Pong</a></li>
                      <li><a href="#" className="hover:text-primary transition-colors">Snake</a></li>
                      <li><a href="#" className="hover:text-primary transition-colors">Tetris</a></li>
                      <li><a href="#" className="hover:text-primary transition-colors">Breakout</a></li>
                      <li><a href="#" className="hover:text-primary transition-colors">Flappy Bird</a></li>
                      <li><a href="#" className="hover:text-primary transition-colors">Connect 4</a></li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-bold mb-4">Account</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>
                        <button onClick={() => setShowAuthModal(true)} className="hover:text-primary transition-colors">
                          Sign Up
                        </button>
                      </li>
                      <li>
                        <button onClick={() => setShowAuthModal(true)} className="hover:text-primary transition-colors">
                          Login
                        </button>
                      </li>
                      <li><a href="#" className="hover:text-primary transition-colors">Buy Credits</a></li>
                      <li><a href="#" className="hover:text-primary transition-colors">Leaderboard</a></li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-bold mb-4">Support</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li><a href="#" className="hover:text-primary transition-colors">Help Center</a></li>
                      <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
                      <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
                      <li><a href="#" className="hover:text-primary transition-colors">Contact Us</a></li>
                    </ul>
                  </div>
                </div>

                <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                  <p className="text-sm text-muted-foreground">
                    © 2025 UAIU Arcade. All rights reserved.
                  </p>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      Secure Platform
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Users className="w-3 h-3 mr-1" />
                      Fair Play Guaranteed
                    </Badge>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        ) : (
          <div className="container mx-auto px-4 py-8 space-y-6">
            <div className="grid lg:grid-cols-[300px_1fr_300px] gap-6">
              <div className="space-y-6 order-2 lg:order-1">
                <Leaderboard currentUserId={user.id} />
              </div>

              <div className="space-y-6 order-1 lg:order-2">
              <Card className="p-6">
                <CardContent className="space-y-6 p-0">
                  {!inGame && !matchmaking && (
                    <div className="text-center space-y-6">
                      <div className="space-y-2">
                        <h3 className="text-2xl font-display font-bold">Select Your Game</h3>
                        <p className="text-muted-foreground">
                          Winner gets {(betAmount * 1.6).toFixed(1)} credits. Loser loses {betAmount} credits.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {availableGames.map((game) => (
                          <Card
                            key={game.id}
                            className={`p-4 cursor-pointer transition-all hover-elevate ${
                              selectedGame === game.id 
                                ? 'ring-2 ring-primary bg-primary/10' 
                                : 'hover:bg-accent/50'
                            }`}
                            onClick={() => setSelectedGame(game.id)}
                            data-testid={`card-game-${game.id}`}
                          >
                            <div className="space-y-2 text-left">
                              <div className="flex items-center gap-2">
                                <Gamepad2 className="w-5 h-5 text-primary" />
                                <h4 className="font-bold text-sm">{game.name}</h4>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {game.description}
                              </p>
                              <div className="flex gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  {game.players}
                                </Badge>
                                <Badge 
                                  variant={game.difficulty === 'Easy' ? 'default' : game.difficulty === 'Medium' ? 'secondary' : 'outline'}
                                  className="text-xs"
                                >
                                  {game.difficulty}
                                </Badge>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Bet Amount</label>
                          <div className="flex items-center justify-center gap-4">
                            <Button
                              onClick={() => setBetAmount(Math.max(1, betAmount - 1))}
                              variant="outline"
                              size="icon"
                              disabled={betAmount <= 1}
                              data-testid="button-decrease-bet"
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <Card className="px-8 py-4 bg-primary/10">
                              <div className="text-3xl font-mono font-bold text-primary" data-testid="text-bet-amount">
                                {betAmount}
                              </div>
                              <div className="text-xs text-muted-foreground">credits</div>
                            </Card>
                            <Button
                              onClick={() => setBetAmount(Math.min(100, Math.min(user.credits, betAmount + 1)))}
                              variant="outline"
                              size="icon"
                              disabled={betAmount >= 100 || betAmount >= user.credits}
                              data-testid="button-increase-bet"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Bet between 1-100 credits (max: {Math.min(100, user.credits)} based on your balance)
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={handleJoinMatchmaking}
                        size="lg"
                        className="w-full h-16 text-2xl font-bold"
                        disabled={user.credits < betAmount}
                        data-testid="button-play"
                      >
                        <Zap className="w-6 h-6 mr-2" />
                        PLAY {availableGames.find(g => g.id === selectedGame)?.name.toUpperCase() || 'NOW'}
                      </Button>
                      {user.credits < betAmount && (
                        <p className="text-sm text-destructive">
                          Insufficient credits. You need {betAmount} credits to play!
                        </p>
                      )}
                    </div>
                  )}

                  {matchmaking && (
                    <div className="text-center space-y-4">
                      <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary" />
                      <div className="space-y-2">
                        <h3 className="text-2xl font-display font-bold">Finding Opponent...</h3>
                        <p className="text-muted-foreground">
                          {matchmakingTimer > 0 
                            ? `AI bot will join in ${matchmakingTimer} seconds...`
                            : "Starting match with AI bot..."}
                        </p>
                        <div className="text-6xl font-mono font-bold text-primary" data-testid="text-matchmaking-timer">
                          {matchmakingTimer}
                        </div>
                      </div>
                      <div className="flex gap-3 justify-center">
                        <Button
                          onClick={handleMatchNow}
                          size="lg"
                          className="flex-1 max-w-xs"
                          data-testid="button-match-now"
                        >
                          <Zap className="w-5 h-5 mr-2" />
                          Match Now
                        </Button>
                        <Button
                          onClick={handleCancelMatchmaking}
                          variant="outline"
                          size="lg"
                          data-testid="button-cancel-matchmaking"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {inGame && (
                    <GameCanvas
                      socket={socket}
                      userId={user.id}
                      matchId={currentMatchId}
                      gameType={selectedGame}
                      onMatchStart={() => setInGame(true)}
                      onMatchEnd={() => setInGame(false)}
                    />
                  )}

                  <div className="grid grid-cols-3 gap-4 pt-6 border-t">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{user.matchesPlayed}</div>
                      <div className="text-xs text-muted-foreground">Matches</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500">{user.wins}W</div>
                      <div className="text-xs text-muted-foreground">Wins</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-500">{user.losses}L</div>
                      <div className="text-xs text-muted-foreground">Losses</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6 order-3">
              <MatchmakingLobby
                queuedPlayers={queuedPlayers}
                currentUserId={user?.id}
                onJoinMatch={handleJoinSpecificMatch}
                userCredits={user?.credits || 0}
              />
              <ActionLog />
            </div>
          </div>
          </div>
        )}
      </main>

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {user && (
        <PayoutModal
          open={showPayoutModal}
          onClose={() => setShowPayoutModal(false)}
          credits={user.credits}
          userId={user.id}
          onPayoutSuccess={handlePayoutSuccess}
        />
      )}
    </div>
  );
}
