import { createContext } from 'react';
import type { Socket } from 'socket.io-client';

export interface SocketContextType {
    socket: Socket | null;
    isConnecting: boolean;
}

export const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnecting: true
});