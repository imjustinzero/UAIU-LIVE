import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@shared/schema";

interface LeaderboardProps {
  currentUserId?: string;
}

export function Leaderboard({ currentUserId }: LeaderboardProps) {
  const { data: leaders, isLoading } = useQuery<User[]>({
    queryKey: ['/api/leaderboard'],
    refetchInterval: 5000,
  });

  return (
    <Card className="h-fit">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-2xl font-display">
          <Trophy className="w-6 h-6 text-primary" />
          Top Players
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="w-8 h-8 rounded-md" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="w-20 h-6" />
            </div>
          ))
        ) : leaders && leaders.length > 0 ? (
          leaders.map((leader, index) => {
            const isCurrentUser = leader.id === currentUserId;
            const rankColors = ['text-yellow-500', 'text-gray-400', 'text-orange-600'];
            const rankBg = ['bg-yellow-500/10', 'bg-gray-400/10', 'bg-orange-600/10'];
            
            return (
              <div
                key={leader.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isCurrentUser ? 'bg-primary/10 border-2 border-primary' : 'hover-elevate'
                }`}
                data-testid={`leaderboard-entry-${index}`}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-md font-bold ${
                  index < 3 ? `${rankColors[index]} ${rankBg[index]}` : 'bg-muted text-muted-foreground'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate" data-testid={`text-player-name-${index}`}>
                    {leader.name}
                    {isCurrentUser && (
                      <Badge variant="secondary" className="ml-2 text-xs">You</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {leader.wins}W - {leader.losses}L
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-primary" data-testid={`text-credits-${index}`}>
                    {leader.credits.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {leader.totalEarnings.toFixed(1)}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No players yet. Be the first to play!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
