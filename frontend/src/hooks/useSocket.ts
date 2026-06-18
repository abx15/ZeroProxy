'use client';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export function useSocket(onEvent?: (event: string, data: any) => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (!token) return;

    socketRef.current = io(`${WS_URL}/events`, {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => {
      console.log('✅ WebSocket connected');
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
    });

    // Forward all events to callback
    if (onEvent) {
      const events = [
        'employee:checkin',
        'employee:checkout',
        'user:login',
        'user:logout',
        'session:force-logout',
        'user:created',
        'user:deactivated',
        'stats:update',
      ];

      events.forEach((event) => {
        socketRef.current?.on(event, (data) => onEvent(event, data));
      });
    }

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return socketRef.current;
}
