import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Heart, MessageCircle, UserPlus, Users, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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

export default function Feed() {
  const { toast } = useToast();
  const [postContent, setPostContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [friendIdentifier, setFriendIdentifier] = useState('');
  const [selectedPostComments, setSelectedPostComments] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState('');

  const { data: user } = useQuery<{ id: string; name: string; email: string; credits: number; username: string }>({
    queryKey: ['/api/auth/me'],
  });

  const { data: posts = [], isLoading: loadingPosts } = useQuery<Post[]>({
    queryKey: ['/api/feed'],
  });

  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ['/api/friends'],
  });

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ['/api/posts', selectedPostComments, 'comments'],
    enabled: !!selectedPostComments,
  });

  const createPostMutation = useMutation({
    mutationFn: async (data: { content: string; youtubeUrl?: string }) =>
      apiRequest('POST', '/api/posts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      setPostContent('');
      setYoutubeUrl('');
      toast({
        title: 'Post created',
        description: 'Your post has been shared with your friends',
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
      queryClient.invalidateQueries({ queryKey: ['/api/posts', selectedPostComments, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      setCommentContent('');
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
    if (!commentContent.trim()) {
      toast({
        title: 'Comment required',
        description: 'Please enter a comment',
        variant: 'destructive',
      });
      return;
    }

    commentMutation.mutate({
      postId,
      content: commentContent,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-emerald-400">Social Feed</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-friends">
                <Users className="w-4 h-4 mr-2" />
                Friends ({friends.length})
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manage Friends</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
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
                <div className="space-y-2 max-h-96 overflow-y-auto">
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
              </div>
            </DialogContent>
          </Dialog>
        </div>

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
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPostComments(post.id)}
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
                                value={commentContent}
                                onChange={(e) => setCommentContent(e.target.value)}
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
      </div>
    </div>
  );
}
