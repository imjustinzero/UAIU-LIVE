import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Gem, LogOut, DollarSign, Loader2, Zap, Gamepad2, Plus, Minus, UserCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthModal } from "@/components/AuthModal";
import { GameCanvas } from "@/components/GameCanvas";
import { Leaderboard } from "@/components/Leaderboard";
import { ActionLog } from "@/components/ActionLog";
import { PayoutModal } from "@/components/PayoutModal";
import { ShareButton } from "@/components/ShareButton";
import { MatchmakingLobby } from "@/components/MatchmakingLobby";
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

export default function Home() {
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

    // Fetch available games
    fetch('/api/games')
      .then(res => res.json())
      .then(games => setAvailableGames(games))
      .catch(err => console.error('Failed to fetch games:', err));
  }, []);

  useEffect(() => {
    if (user) {
      const sessionId = localStorage.getItem('pong-session');
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
    localStorage.setItem('pong-user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('pong-user');
    localStorage.removeItem('pong-session');
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

      <main className="container mx-auto px-4 py-8">
        {!user ? (
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <h2 className="text-5xl md:text-7xl font-display font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Play. Compete. Win Real Money.
              </h2>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
                Challenge players worldwide in real-time Pong matches. Every game is pay-to-play, winner takes the pot!
              </p>
            </div>

            <Card className="p-8 md:p-12 bg-gradient-to-br from-card to-primary/5 border-2 border-primary/20 shadow-2xl">
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-primary">$1</div>
                  <div className="text-sm text-muted-foreground">= 10 Credits</div>
                </div>
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-accent">1 Credit</div>
                  <div className="text-sm text-muted-foreground">Per Match</div>
                </div>
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-green-500">+60%</div>
                  <div className="text-sm text-muted-foreground">Winner Bonus</div>
                </div>
              </div>
              <Button
                onClick={() => setShowAuthModal(true)}
                size="lg"
                className="w-full h-16 text-xl font-bold"
                data-testid="button-get-started"
              >
                <Zap className="w-6 h-6 mr-2" />
                Get Started Now
              </Button>
            </Card>

            <div className="grid md:grid-cols-1 gap-6">
              <ActionLog />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
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
