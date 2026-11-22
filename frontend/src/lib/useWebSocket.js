import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Shared WebSocket Connection Pool (Singleton per URL)
 * - Tái sử dụng duy nhất 1 kết nối WebSocket cho toàn bộ ứng dụng, tránh mở nhiều socket tới cùng endpoint
 * - Quản lý danh sách subscribers đa thành phần
 * - Tự động kết nối lại với Exponential Backoff khi mất kết nối (1s -> 30s)
 * - Cung cấp status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
 */
const connectionPool = new Map();

function getSharedConnection(url) {
  let conn = connectionPool.get(url);
  if (!conn) {
    conn = {
      url,
      ws: null,
      status: 'disconnected',
      reconnectAttempt: 0,
      reconnectTimer: null,
      subscribers: new Set(),
      statusListeners: new Set(),
      lastMessage: null,

      connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
          return;
        }

        this.status = this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting';
        this.notifyStatus();

        try {
          const ws = new WebSocket(this.url);
          this.ws = ws;

          ws.onopen = () => {
            this.status = 'connected';
            this.reconnectAttempt = 0;
            this.notifyStatus();
            try {
              ws.send('ping');
            } catch (_) {}
          };

          ws.onmessage = (event) => {
            try {
              const payload = JSON.parse(event.data);
              this.lastMessage = payload;
              this.subscribers.forEach((cb) => {
                try {
                  cb(payload);
                } catch (e) {
                  console.error('[WS Sub Error]', e);
                }
              });
            } catch (e) {
              console.warn('[WS] Failed to parse message JSON:', event.data);
            }
          };

          ws.onerror = (err) => {
            console.warn('[WS] Socket error:', err);
          };

          ws.onclose = () => {
            this.status = 'disconnected';
            this.ws = null;
            this.notifyStatus();

            // Exponential backoff reconnect: min(1000 * 2^attempt, 30000) ms
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), 30000);
            this.reconnectAttempt += 1;
            this.status = 'reconnecting';
            this.notifyStatus();

            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              this.connect();
            }, delay);
          };
        } catch (err) {
          console.error('[WS] Connection exception:', err);
          this.status = 'disconnected';
          this.notifyStatus();
        }
      },

      notifyStatus() {
        this.statusListeners.forEach((fn) => {
          try {
            fn(this.status);
          } catch (_) {}
        });
      },

      sendMessage(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
          this.ws.send(data);
        }
      }
    };
    connectionPool.set(url, conn);
  }
  return conn;
}

export function useWebSocket({
  url,
  onMessage,
  onFallbackPoll,
  enabled = true,
  fallbackIntervalMs = 30000
}) {
  const [status, setStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState(null);
  const onMessageRef = useRef(onMessage);
  const onFallbackPollRef = useRef(onFallbackPoll);
  const fallbackTimer = useRef(null);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onFallbackPollRef.current = onFallbackPoll;
  }, [onFallbackPoll]);

  useEffect(() => {
    if (!enabled || !url) return;

    const conn = getSharedConnection(url);
    setStatus(conn.status);

    const handleMessage = (payload) => {
      setLastMessage(payload);
      if (onMessageRef.current) {
        onMessageRef.current(payload);
      }
    };

    const handleStatus = (s) => {
      setStatus(s);
    };

    conn.subscribers.add(handleMessage);
    conn.statusListeners.add(handleStatus);
    conn.connect();

    return () => {
      conn.subscribers.delete(handleMessage);
      conn.statusListeners.delete(handleStatus);
    };
  }, [url, enabled]);

  // Khởi chạy fallback polling định kỳ nếu WebSocket không ở trạng thái connected
  useEffect(() => {
    if (!enabled) return;

    if (status !== 'connected' && onFallbackPollRef.current) {
      fallbackTimer.current = setInterval(() => {
        if (onFallbackPollRef.current) {
          onFallbackPollRef.current();
        }
      }, fallbackIntervalMs);
    } else {
      if (fallbackTimer.current) {
        clearInterval(fallbackTimer.current);
        fallbackTimer.current = null;
      }
    }

    return () => {
      if (fallbackTimer.current) {
        clearInterval(fallbackTimer.current);
        fallbackTimer.current = null;
      }
    };
  }, [status, enabled, fallbackIntervalMs]);

  const sendMessage = useCallback((msg) => {
    if (!url) return;
    const conn = getSharedConnection(url);
    conn.sendMessage(msg);
  }, [url]);

  return {
    status,
    lastMessage,
    sendMessage,
    isConnected: status === 'connected'
  };
}
