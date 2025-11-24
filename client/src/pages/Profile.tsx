import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  User as UserIcon, 
  Mail, 
  Trophy, 
  Gem, 
  TrendingUp,
  ArrowLeft
} from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  credits: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  totalEarnings: number;
  emailVerified: boolean;
}

export default function Profile() {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const sessionId = localStorage.getItem('pong-session');
    
    if (!sessionId) {
      navigate('/');
      return;
    }

    fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${sessionId}`,
      },
    })
      .then(res => {
        if (!res.ok) {
          localStorage.removeItem('pong-user');
          localStorage.removeItem('pong-session');
          navigate('/');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data) {
          setUser(data);
          setName(data.name);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch user:', err);
        setLoading(false);
      });
  }, [navigate]);

  const handleUpdateProfile = async () => {
    if (!user || !name.trim()) {
      toast({
        title: "Error",
        description: "Name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      const sessionId = localStorage.getItem('pong-session');
      const res = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionId}`,
        },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) throw new Error('Update failed');

      const updatedUser = await res.json();
      setUser(updatedUser);
      localStorage.setItem('pong-user', JSON.stringify(updatedUser));
      setEditing(false);
      
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const winRate = user.matchesPlayed > 0 
    ? ((user.wins / user.matchesPlayed) * 100).toFixed(1) 
    : '0.0';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            size="sm"
            data-testid="button-back-home"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Games
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="w-6 h-6 text-primary" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  {editing ? (
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      data-testid="input-name"
                    />
                  ) : (
                    <div className="px-3 py-2 border rounded-md bg-muted" data-testid="text-display-name">
                      {user.name}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 px-3 py-2 border rounded-md bg-muted text-sm" data-testid="text-email">
                      {user.email}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                {editing ? (
                  <>
                    <Button onClick={handleUpdateProfile} data-testid="button-save-profile">
                      Save Changes
                    </Button>
                    <Button onClick={() => {
                      setEditing(false);
                      setName(user.name);
                    }} variant="outline" data-testid="button-cancel-edit">
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setEditing(true)} data-testid="button-edit-profile">
                    Edit Profile
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <Gem className="w-4 h-4" />
                  Current Credits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary" data-testid="text-profile-credits">
                  {user.credits.toFixed(1)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <Trophy className="w-4 h-4" />
                  Win Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="text-win-rate">
                  {winRate}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {user.wins}W - {user.losses}L
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  Total Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500" data-testid="text-total-earnings">
                  {user.totalEarnings.toFixed(1)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Game Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold" data-testid="text-matches-played">
                    {user.matchesPlayed}
                  </div>
                  <div className="text-sm text-muted-foreground">Matches Played</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-500" data-testid="text-wins">
                    {user.wins}
                  </div>
                  <div className="text-sm text-muted-foreground">Wins</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-red-500" data-testid="text-losses">
                    {user.losses}
                  </div>
                  <div className="text-sm text-muted-foreground">Losses</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-primary" data-testid="text-avg-earnings">
                    {user.matchesPlayed > 0 ? (user.totalEarnings / user.matchesPlayed).toFixed(2) : '0.00'}
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Per Match</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
