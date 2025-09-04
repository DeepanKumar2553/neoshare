import { configureStore } from '@reduxjs/toolkit';
import socketReducer from './socketSlice';
import accessReducer from './accessSlice';

// Create the root store
export const store = configureStore({
    reducer: {
        socket: socketReducer,
        access: accessReducer,
    },
});

// Define types for TypeScript support
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;