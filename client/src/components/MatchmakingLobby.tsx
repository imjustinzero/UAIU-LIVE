import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Gem, Gamepad2 } from "lucide-react";

interface QueuedPlayer {
  userId: string;
  name: string;
  gameType: string;
  betAmount: number;
  joinedAt: number;
}

interface MatchmakingLobbyProps {
  queuedPlayers: QueuedPlayer[];
  currentUserId?: string;
  onJoinMatch: (targetUserId: string) => void;
  userCredits: number;
}

const GAME_NAMES: Record<string, string> = {
  pong: 'Pong',
  snake: 'Snake',
  tetris: 'Tetris',
  breakout: 'Breakout',
  flappybird: 'Flappy Bird',
  connect4: 'Connect 4',
};

export function MatchmakingLobby({ queuedPlayers, currentUserId, onJoinMatch, userCredits }: MatchmakingLobbyProps) {
  const availablePlayers = queuedPlayers.filter(p => p.userId !== currentUserId);

  if (availablePlayers.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-3">
          <Users className="w-12 h-12 mx-auto text-muted-foreground" />
          <h3 className="text-lg font-semibold">No Active Match Requests</h3>
          <p className="text-sm text-muted-foreground">
            Be the first to create a match request!
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Live Match Requests</h3>
          <Badge variant="secondary" className="ml-auto">
            {availablePlayers.length}
          </Badge>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {availablePlayers.map((player) => (
            <Card
              key={player.userId}
              className="p-4 hover-elevate"
              data-testid={`match-request-${player.userId}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Gamepad2 className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="font-semibold truncate">{player.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {GAME_NAMES[player.gameType] || player.gameType}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Gem className="w-3 h-3" />
                      <span>{player.betAmount} credits</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => onJoinMatch(player.userId)}
                  size="sm"
                  disabled={userCredits < player.betAmount}
                  data-testid={`button-join-${player.userId}`}
                >
                  Join
                </Button>
              </div>
              {userCredits < player.betAmount && (
                <p className="text-xs text-destructive mt-2">
                  Need {player.betAmount} credits
                </p>
              )}
            </Card>
          ))}
        </div>
      </div>
    </Card>
  );
}
