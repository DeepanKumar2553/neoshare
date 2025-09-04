import { createSlice } from '@reduxjs/toolkit';

interface SocketState {
    shouldReconnect: boolean;
}

const initialState: SocketState = {
    shouldReconnect: false,
};

const socketSlice = createSlice({
    name: 'socket',
    initialState,
    reducers: {
        triggerReconnect: (state) => {
            state.shouldReconnect = !state.shouldReconnect;
        },
    },
});

export const { triggerReconnect } = socketSlice.actions;
export default socketSlice.reducer;