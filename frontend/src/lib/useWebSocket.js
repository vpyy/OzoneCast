import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook useWebSocket
 * - Quản lý kết nối WebSocket tới Database API Gateway (/ws/stream)
 * - Tự động kết nối lại với Exponential Backoff khi mất kết nối (1s -> 30s)
 * - Cleanup khi component unmount
 * - Cung cấp status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
 * - Cơ chế Fallback: tự động kích hoạt polling qua REST API nếu WebSocket không kết nối được
 */
export function useWebSocket({
  url,
  onMessage,
  onFallbackPoll,
  enabled = true,
  fallbackIntervalMs = 30000
}) {
  const [status, setStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef(null);
  const fallbackTimer = useRef(null);
  const onMessageRef = useRef(onMessage);
  const onFallbackPollRef = useRef(onFallbackPoll);

  // Giữ ref handler mới nhất để tránh re-subscribe không cần thiết
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onFallbackPollRef.current = onFallbackPoll;
  }, [onFallbackPoll]);

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

  const connect = useCallback(() => {
    if (!enabled || !url) return;

    try {
      setStatus(reconnectAttempt.current > 0 ? 'reconnecting' : 'connecting');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        reconnectAttempt.current = 0;
        // Gửi ping heartbeat khởi đầu
        try {
          ws.send('ping');
        } catch (_) {}
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          setLastMessage(payload);
          if (onMessageRef.current) {
            onMessageRef.current(payload);
          }
        } catch (e) {
          console.warn('[WS] Failed to parse message JSON:', event.data);
        }
      };

      ws.onerror = (err) => {
        console.warn('[WS] Socket error:', err);
      };

      ws.onclose = () => {
        setStatus('disconnected');
        wsRef.current = null;

        // Exponential backoff reconnect: min(1000 * 2^attempt, 30000) ms
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 30000);
        reconnectAttempt.current += 1;
        setStatus('reconnecting');
        reconnectTimer.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (err) {
      console.error('[WS] Connection exception:', err);
      setStatus('disconnected');
    }
  }, [url, enabled]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendMessage = useCallback((msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
      wsRef.current.send(data);
    }
  }, []);

  return {
    status,
    lastMessage,
    sendMessage,
    isConnected: status === 'connected'
  };
}
