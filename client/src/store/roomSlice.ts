import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface RoomState {
    roomCode: string;
    role: 'sender' | 'receiver' | null;
}

const initialState: RoomState = {
    roomCode: '',
    role: null,
};

const roomSlice = createSlice({
    name: 'room',
    initialState,
    reducers: {
        setRoomCode: (state, action: PayloadAction<string>) => {
            state.roomCode = action.payload;
        },
        setRole: (state, action: PayloadAction<'sender' | 'receiver'>) => {
            state.role = action.payload;
        },
        clearRoom: (state) => {
            state.roomCode = '';
            state.role = null;
        },
    },
});

export const { setRoomCode, setRole, clearRoom } = roomSlice.actions;
export default roomSlice.reducer;