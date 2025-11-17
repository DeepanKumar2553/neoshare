import { configureStore } from '@reduxjs/toolkit';
import socketReducer from './socketSlice';
import accessReducer from './accessSlice';
import roomReducer from './roomSlice';

export const store = configureStore({
    reducer: {
        socket: socketReducer,
        access: accessReducer,
        room: roomReducer,
    },
});

// Define types for TypeScript support
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;