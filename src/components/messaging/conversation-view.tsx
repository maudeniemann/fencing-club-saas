'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useClub } from '@/providers/club-provider';
import { ChevronLeft, X } from 'lucide-react';

interface Message {
  id: string;
  conversation_id: string;
  sender_member_id: string;
  content: string;
  created_at: string;
  sender: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface ConversationViewProps {
  conversationId: string;
  otherMember: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    role: string;
  };
  onClose?: () => void;
}

export function ConversationView({
  conversationId,
  otherMember,
  onClose,
}: ConversationViewProps) {
  const [messageContent, setMessageContent] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { currentMember } = useClub();
  const supabase = createClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json() as Promise<Message[]>;
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send message');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setMessageContent('');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}/read`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to mark as read');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Mark as read when conversation is opened
  useEffect(() => {
    markAsReadMutation.mutate();
  }, [conversationId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set up real-time subscription to new messages
  useEffect(() => {
    if (isSubscribed) return;

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          // Refetch messages when new message arrives
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          markAsReadMutation.mutate();
        }
      )
      .subscribe();

    setIsSubscribed(true);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient, isSubscribed, supabase]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim()) return;
    sendMutation.mutate(messageContent.trim());
  };

  const initials = otherMember.display_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || '??';

  return (
    <>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="lg:hidden -ml-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            <Avatar>
              <AvatarImage src={otherMember.avatar_url || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{otherMember.display_name}</CardTitle>
              <div className="text-sm text-muted-foreground capitalize">{otherMember.role}</div>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="hidden lg:inline-flex">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading messages...</div>
          </div>
        ) : messages && messages.length > 0 ? (
          <>
            {messages.map((message) => {
              const isOwnMessage = message.sender_member_id === currentMember?.id;
              const senderInitials = message.sender.display_name
                ?.split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase() || '??';

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={message.sender.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">{senderInitials}</AvatarFallback>
                  </Avatar>
                  <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[70%]`}>
                    <div
                      className={`rounded-lg px-4 py-2 ${
                        isOwnMessage
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(message.created_at), 'MMM d, h:mm a')}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground text-center">
              <p>No messages yet</p>
              <p className="text-sm mt-1">Start the conversation!</p>
            </div>
          </div>
        )}
      </CardContent>

      <div className="border-t p-4">
        <form onSubmit={handleSend} className="flex gap-2">
          <Textarea
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            placeholder="Type a message..."
            rows={2}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
          />
          <Button
            type="submit"
            disabled={!messageContent.trim() || sendMutation.isPending}
          >
            {sendMutation.isPending ? 'Sending...' : 'Send'}
          </Button>
        </form>
      </div>
    </>
  );
}
