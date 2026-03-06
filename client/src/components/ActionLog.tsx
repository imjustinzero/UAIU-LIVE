import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActionLogEntry } from "@shared/schema";

export function ActionLog() {
  const { data: logs, isLoading } = useQuery<ActionLogEntry[]>({
    queryKey: ['/api/action-log'],
    refetchInterval: 3000,
  });

  const getLogColor = (type: string) => {
    switch (type) {
      case 'match':
        return 'text-primary';
      case 'signup':
        return 'text-accent';
      case 'payout':
        return 'text-yellow-500';
      case 'credit':
        return 'text-green-500';
      default:
        return 'text-foreground';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="h-fit">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-2xl font-display">
          <Activity className="w-6 h-6 text-accent" />
          Live Feed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))
            ) : logs && logs.length > 0 ? (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="border-l-2 border-muted pl-3 py-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-300"
                  data-testid={`log-entry-${log.type}`}
                >
                  <p className={`text-sm font-medium ${getLogColor(log.type)}`}>
                    {log.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimestamp(new Date(log.timestamp).getTime())}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No activity yet</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
