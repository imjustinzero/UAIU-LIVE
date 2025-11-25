import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  User as UserIcon, 
  Mail, 
  Trophy, 
  Gem, 
  TrendingUp,
  ArrowLeft,
  Heart,
  MessageCircle,
  UserPlus,
  Trash2,
  Globe,
  Lock,
  Copy,
  Check,
  Gift
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  credits: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  totalEarnings: number;
  affiliateCode?: string;
  referredBy?: string;
}

interface Post {
  id: string;
  userId: string;
  username: string;
  content: string;
  youtubeUrl: string | null;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
}

interface Friend {
  id: string;
  name: string;
  username: string;
  email: string;
  credits: number;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default function Profile() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [postContent, setPostContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [postVisibility, setPostVisibility] = useState<'friends' | 'public'>('friends');
  const [friendIdentifier, setFriendIdentifier] = useState('');
  const [selectedPostComments, setSelectedPostComments] = useState<string | null>(null);
  const [commentContents, setCommentContents] = useState<Record<string, string>>({});
  const [codeCopied, setCodeCopied] = useState(false);

  const { data: user, isLoading: loadingUser } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const isAdmin = user?.email === 'imjustinzero@gmail.com';

  const { data: posts = [], isLoading: loadingPosts } = useQuery<Post[]>({
    queryKey: ['/api/feed'],
    enabled: !!user,
  });

  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ['/api/friends'],
    enabled: !!user,
  });

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ['/api/posts', selectedPostComments, 'comments'],
    enabled: !!selectedPostComments && !!user,
  });

  useEffect(() => {
    if (user && !editing) {
      setName(user.name);
    }
  }, [user, editing]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name: string }) =>
      apiRequest('PATCH', '/api/profile/update', data),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['/api/auth/me'], updatedUser);
      localStorage.setItem('pong-user', JSON.stringify(updatedUser));
      setEditing(false);
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async (data: { content: string; youtubeUrl?: string; visibility?: string }) =>
      apiRequest('POST', '/api/posts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      setPostContent('');
      setYoutubeUrl('');
      setPostVisibility('friends');
      toast({
        title: 'Post created',
        description: postVisibility === 'public' ? 'Your post is now visible to everyone!' : 'Your post has been shared with your friends',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create post',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const likePostMutation = useMutation({
    mutationFn: async (postId: string) =>
      apiRequest('POST', `/api/posts/${postId}/like`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: 'Post liked',
        description: 'You spent 1 credit (0.6 to creator, 0.4 burned)',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to like post',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (data: { postId: string; content: string }) =>
      apiRequest('POST', `/api/posts/${data.postId}/comment`, { content: data.content }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
      queryClient.invalidateQueries({ queryKey: ['/api/posts', variables.postId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      // Clear comment for this specific post
      setCommentContents(prev => ({ ...prev, [variables.postId]: '' }));
      toast({
        title: 'Comment posted',
        description: 'You spent 1 credit (0.6 to creator, 0.4 burned)',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to comment',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const addFriendMutation = useMutation({
    mutationFn: async (friendIdentifier: string) =>
      apiRequest('POST', '/api/friends', { friendIdentifier }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      setFriendIdentifier('');
      toast({
        title: 'Friend added',
        description: 'You can now see their posts in your feed',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to add friend',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendId: string) =>
      apiRequest('DELETE', `/api/friends/${friendId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
      toast({
        title: 'Friend removed',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to remove friend',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleUpdateProfile = () => {
    if (!user || !name.trim()) {
      toast({
        title: "Error",
        description: "Name cannot be empty",
        variant: "destructive",
      });
      return;
    }
    updateProfileMutation.mutate({ name: name.trim() });
  };

  const handleCreatePost = () => {
    if (!postContent.trim()) {
      toast({
        title: 'Content required',
        description: 'Please enter some text for your post',
        variant: 'destructive',
      });
      return;
    }

    createPostMutation.mutate({
      content: postContent,
      youtubeUrl: youtubeUrl.trim() || undefined,
      visibility: postVisibility,
    });
  };

  const handleAddFriend = () => {
    if (!friendIdentifier.trim()) {
      toast({
        title: 'Identifier required',
        description: 'Enter a @username or email',
        variant: 'destructive',
      });
      return;
    }
    addFriendMutation.mutate(friendIdentifier.trim());
  };

  const handleComment = (postId: string) => {
    const content = commentContents[postId] || '';
    if (!content.trim()) {
      toast({
        title: 'Comment required',
        description: 'Please enter a comment',
        variant: 'destructive',
      });
      return;
    }
    commentMutation.mutate({ postId, content });
  };

  const handleCopyAffiliateCode = () => {
    if (user?.affiliateCode) {
      navigator.clipboard.writeText(user.affiliateCode);
      setCodeCopied(true);
      toast({
        title: 'Copied!',
        description: 'Referral code copied to clipboard',
      });
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate('/');
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
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
              <TabsTrigger value="feed" data-testid="tab-feed">Feed</TabsTrigger>
              <TabsTrigger value="friends" data-testid="tab-friends">Friends ({friends.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
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
                      <Button onClick={() => {
                        setEditing(true);
                        setName(user.name);
                      }} data-testid="button-edit-profile">
                        Edit Profile
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {user.affiliateCode && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gift className="w-6 h-6 text-primary" />
                      Referral Program
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Share your referral code with friends! You'll earn 1 credit for every 10 credits they purchase.
                    </p>
                    <div className="space-y-2">
                      <Label>Your Referral Code</Label>
                      <div className="flex gap-2">
                        <Input
                          value={user.affiliateCode}
                          readOnly
                          className="font-mono text-lg"
                          data-testid="input-affiliate-code"
                        />
                        <Button
                          onClick={handleCopyAffiliateCode}
                          variant="outline"
                          size="icon"
                          data-testid="button-copy-affiliate"
                        >
                          {codeCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

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
            </TabsContent>

            <TabsContent value="feed" className="space-y-6">
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold">Create Post</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="What's on your mind?"
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    rows={3}
                    data-testid="input-post-content"
                  />
                  <Input
                    placeholder="YouTube URL (optional)"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    data-testid="input-youtube-url"
                  />
                  {isAdmin && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Post Visibility</Label>
                      <RadioGroup 
                        value={postVisibility} 
                        onValueChange={(value) => setPostVisibility(value as 'friends' | 'public')}
                        className="flex gap-4"
                        data-testid="radio-group-visibility"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="friends" id="friends" data-testid="radio-friends" />
                          <Label htmlFor="friends" className="flex items-center gap-2 cursor-pointer">
                            <Lock className="w-4 h-4" />
                            Friends Only
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="public" id="public" data-testid="radio-public" />
                          <Label htmlFor="public" className="flex items-center gap-2 cursor-pointer">
                            <Globe className="w-4 h-4" />
                            Public (Everyone)
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={handleCreatePost}
                    disabled={createPostMutation.isPending}
                    className="w-full"
                    data-testid="button-create-post"
                  >
                    Post
                  </Button>
                </CardFooter>
              </Card>

              {loadingPosts ? (
                <div className="text-center py-8 text-muted-foreground">Loading feed...</div>
              ) : posts.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <p className="mb-2">No posts yet!</p>
                    <p className="text-sm">Add friends to see their posts, or create your first post above.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => {
                    const youtubeId = post.youtubeUrl ? extractYouTubeId(post.youtubeUrl) : null;
                    const isOwnPost = user && post.userId === user.id;

                    return (
                      <Card key={post.id} data-testid={`post-${post.id}`}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-emerald-400">{post.username}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(post.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="whitespace-pre-wrap">{post.content}</p>
                          {youtubeId && (
                            <div className="aspect-video w-full">
                              <iframe
                                width="100%"
                                height="100%"
                                src={`https://www.youtube.com/embed/${youtubeId}`}
                                title="YouTube video"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="flex gap-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => !isOwnPost && likePostMutation.mutate(post.id)}
                            disabled={isOwnPost || likePostMutation.isPending}
                            data-testid={`button-like-${post.id}`}
                          >
                            <Heart className="w-4 h-4 mr-2" />
                            {post.likesCount} {isOwnPost && '(your post)'}
                          </Button>
                          <Dialog onOpenChange={(open) => {
                            if (open) {
                              setSelectedPostComments(post.id);
                            } else {
                              setSelectedPostComments(null);
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`button-comments-${post.id}`}
                              >
                                <MessageCircle className="w-4 h-4 mr-2" />
                                {post.commentsCount}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Comments</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                {!isOwnPost && (
                                  <div className="space-y-2">
                                    <Textarea
                                      placeholder="Write a comment... (costs 1 credit)"
                                      value={commentContents[post.id] || ''}
                                      onChange={(e) => setCommentContents(prev => ({ ...prev, [post.id]: e.target.value }))}
                                      rows={2}
                                      data-testid={`input-comment-${post.id}`}
                                    />
                                    <Button
                                      onClick={() => handleComment(post.id)}
                                      disabled={commentMutation.isPending}
                                      size="sm"
                                      data-testid={`button-submit-comment-${post.id}`}
                                    >
                                      Comment (1 credit)
                                    </Button>
                                  </div>
                                )}
                                {isOwnPost && (
                                  <p className="text-sm text-muted-foreground">
                                    You cannot comment on your own post
                                  </p>
                                )}
                                <div className="space-y-2">
                                  {comments.map((comment) => (
                                    <Card key={comment.id}>
                                      <CardContent className="p-3">
                                        <p className="font-semibold text-sm text-emerald-400">
                                          {comment.username}
                                        </p>
                                        <p className="text-xs text-muted-foreground mb-2">
                                          {new Date(comment.createdAt).toLocaleString()}
                                        </p>
                                        <p className="text-sm">{comment.content}</p>
                                      </CardContent>
                                    </Card>
                                  ))}
                                  {comments.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                      No comments yet
                                    </p>
                                  )}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="friends" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add Friend</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="@username or email"
                      value={friendIdentifier}
                      onChange={(e) => setFriendIdentifier(e.target.value)}
                      data-testid="input-friend"
                    />
                    <Button
                      onClick={handleAddFriend}
                      disabled={addFriendMutation.isPending}
                      data-testid="button-add-friend"
                    >
                      <UserPlus className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {friends.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <p>No friends yet. Add friends to see their posts in your feed!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {friends.map((friend) => (
                    <Card key={friend.id}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{friend.name}</p>
                          <p className="text-sm text-muted-foreground">{friend.username}</p>
                          <p className="text-xs text-muted-foreground">{friend.credits.toFixed(1)} credits</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFriendMutation.mutate(friend.id)}
                          data-testid={`button-remove-friend-${friend.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
