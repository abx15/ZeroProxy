'use client';
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export function useSocket(onEvent?: (event: string, data: unknown) => void) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (!token) return;

    const socketInstance = io(`${WS_URL}/events`, {
      auth: { token },
      transports: ['websocket'],
    });

    const timer = setTimeout(() => {
      setSocket(socketInstance);
    }, 0);

    socketInstance.on('connect', () => {
      console.log('✅ WebSocket connected');
    });

    socketInstance.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
    });

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
      socketInstance.on(event, (data) => {
        onEventRef.current?.(event, data);
      });
    });

    return () => {
      clearTimeout(timer);
      socketInstance.disconnect();
    };
  }, []);

  return socket;
}
