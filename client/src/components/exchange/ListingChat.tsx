import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// ── REAL-TIME LISTING CHAT ────────────────────────────────
// Each listing card has a live chat thread
// Socket.io is already installed on the server

interface ChatMessage {
  id: string;
  listing_id: string;
  sender: string;
  sender_type: 'buyer' | 'seller' | 'system';
  text: string;
  timestamp: string;
}

interface ListingChatProps {
  listingId: string;
  listingName: string;
  userHandle?: string;
  isDark?: boolean;
}

// Shared socket instance (one connection for all chats)
let sharedSocket: Socket | null = null;

function getSocket(): Socket {
  if (!sharedSocket || !sharedSocket.connected) {
    sharedSocket = io('/', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return sharedSocket;
}

export function ListingChat({
  listingId, listingName,
  userHandle = `Trader-${Math.random().toString(36).slice(2,6).toUpperCase()}`,
  isDark = true
}: ListingChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState(0);
  const [onlineCount, setOnlineCount] = useState(1);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const room = `listing-${listingId}`;

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-listing-chat', { room, listingId, listingName, userHandle });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('chat-history', (history: ChatMessage[]) => {
      setMessages(history);
    });

    socket.on('chat-message', (msg: ChatMessage) => {
      if (msg.listing_id !== listingId) return;
      setMessages(prev => [...prev, msg]);
      if (!open) setUnread(prev => prev + 1);
    });

    socket.on('listing-online-count', ({ listing_id, count }: any) => {
      if (listing_id === listingId) setOnlineCount(count);
    });

    // Attempt connect if not already
    if (!socket.connected) {
      socket.connect();
    } else {
      setConnected(true);
      socket.emit('join-listing-chat', { room, listingId, listingName, userHandle });
    }

    return () => {
      socket.off('chat-history');
      socket.off('chat-message');
      socket.off('listing-online-count');
      socket.emit('leave-listing-chat', { room, listingId });
    };
  }, [listingId]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages]);

  const sendMessage = () => {
    if (!input.trim() || !socketRef.current?.connected) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      listing_id: listingId,
      sender: userHandle,
      sender_type: 'buyer',
      text: input.trim(),
      timestamp: new Date().toISOString()
    };
    socketRef.current.emit('listing-chat-message', { room, message: msg });
    setMessages(prev => [...prev, msg]);
    setInput('');
  };

  const GOLD = '#D4A843';
  const bg = isDark ? '#0d1b2e' : '#ffffff';
  const msgBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const ownBg = 'rgba(212,168,67,0.12)';

  const formatTime = (ts: string) => {
    try { return new Date(ts).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false}); }
    catch { return ''; }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* CHAT TOGGLE BUTTON */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 14px', borderRadius: '7px', width: '100%',
          border: `1px solid ${open ? GOLD : 'rgba(212,168,67,0.2)'}`,
          background: open ? 'rgba(212,168,67,0.08)' : 'rgba(255,255,255,0.03)',
          color: GOLD, fontSize: '12px', fontWeight: 600,
          cursor: 'pointer', letterSpacing: '0.04em',
          justifyContent: 'space-between', marginTop: '6px'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          💬 Live Chat
          <span style={{
            fontSize: '10px', padding: '1px 5px', borderRadius: '3px',
            background: connected ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.1)',
            color: connected ? '#4ade80' : 'rgba(255,255,255,0.3)'
          }}>
            {connected ? `● ${onlineCount} online` : '○ offline'}
          </span>
        </span>
        {unread > 0 && (
          <span style={{
            background: '#f87171', color: '#fff',
            borderRadius: '10px', padding: '1px 7px',
            fontSize: '10px', fontWeight: 700
          }}>
            {unread}
          </span>
        )}
        <span style={{ fontSize: '10px', opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* CHAT PANEL */}
      {open && (
        <div style={{
          position: 'absolute', bottom: '42px', left: 0, right: 0,
          background: bg,
          border: `1px solid ${GOLD}44`,
          borderRadius: '10px', zIndex: 100,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column',
          height: '300px', overflow: 'hidden'
        }}>
          {/* Chat header */}
          <div style={{
            padding: '10px 14px', flexShrink: 0,
            borderBottom: `1px solid rgba(212,168,67,0.15)`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: GOLD,
                letterSpacing: '0.06em' }}>
                TRADE CHAT
              </span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)',
                marginLeft: '8px' }}>
                {listingName.slice(0, 24)}...
              </span>
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: 'transparent', border: 'none',
              color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px'
            }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: '6px'
          }}>
            {messages.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '20px',
                color: 'rgba(255,255,255,0.3)', fontSize: '12px'
              }}>
                No messages yet. Ask a question about this listing.
              </div>
            )}
            {messages.map((msg) => {
              const isOwn = msg.sender === userHandle;
              const isSystem = msg.sender_type === 'system';
              return (
                <div key={msg.id} style={{
                  display: 'flex',
                  flexDirection: isOwn ? 'row-reverse' : 'row',
                  gap: '6px', alignItems: 'flex-end'
                }}>
                  {!isOwn && (
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: isSystem ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', flexShrink: 0,
                      color: isSystem ? GOLD : 'rgba(255,255,255,0.6)'
                    }}>
                      {isSystem ? '◈' : msg.sender.slice(0,2).toUpperCase()}
                    </div>
                  )}
                  <div style={{
                    maxWidth: '75%',
                    background: isSystem ? 'transparent' : isOwn ? ownBg : msgBg,
                    border: isSystem ? 'none' : `1px solid ${isOwn ? GOLD + '44' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '8px', padding: isSystem ? '2px 0' : '8px 10px'
                  }}>
                    {!isOwn && !isSystem && (
                      <p style={{ margin: '0 0 3px', fontSize: '9px', fontWeight: 700,
                        color: GOLD, letterSpacing: '0.06em' }}>
                        {msg.sender}
                      </p>
                    )}
                    <p style={{
                      margin: 0, fontSize: '12px', lineHeight: 1.5,
                      color: isSystem
                        ? 'rgba(212,168,67,0.5)'
                        : isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)',
                      fontStyle: isSystem ? 'italic' : 'normal',
                      textAlign: isSystem ? 'center' : 'left'
                    }}>
                      {msg.text}
                    </p>
                    {!isSystem && (
                      <p style={{ margin: '3px 0 0', fontSize: '9px',
                        color: 'rgba(255,255,255,0.3)', textAlign: isOwn ? 'right' : 'left' }}>
                        {formatTime(msg.timestamp)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '8px 10px', flexShrink: 0,
            borderTop: `1px solid rgba(212,168,67,0.15)`,
            display: 'flex', gap: '8px'
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask about this listing..."
              style={{
                flex: 1, padding: '8px 10px', borderRadius: '6px',
                border: '1px solid rgba(212,168,67,0.2)',
                background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)',
                color: isDark ? '#ffffff' : '#0d1b3e',
                fontSize: '12px', outline: 'none', fontFamily: 'inherit'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !connected}
              style={{
                padding: '8px 14px', borderRadius: '6px', border: 'none',
                background: input.trim() && connected ? GOLD : 'rgba(212,168,67,0.2)',
                color: input.trim() && connected ? '#0a0a0f' : 'rgba(212,168,67,0.4)',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer'
              }}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
