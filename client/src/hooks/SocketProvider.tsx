import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import io, { Socket } from 'socket.io-client';
import { SocketContext } from './socketContext';
import { useAppSelector } from '../store/hooks';

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const shouldReconnect = useAppSelector((state) => state.socket.shouldReconnect);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    setIsConnecting(true);

    // Create new socket connection
    const newSocket = io("https://neoshare.onrender.com");
    // const newSocket = io("http://localhost:8080/");

    newSocket.on("connect", () => {
      setIsConnecting(false);
      console.log('Socket connected');
    });

    newSocket.on("connect_error", (err) => {
      setIsConnecting(false);
      console.error('Socket connection error:', err.message);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket.connected) {
        newSocket.disconnect();
        console.log('Socket disconnected');
      }
    };
  }, [shouldReconnect]);

  return (
    <SocketContext.Provider value={{ socket, isConnecting }}>
      {children}
    </SocketContext.Provider>
  );
};