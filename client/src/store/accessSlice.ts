import { createSlice } from '@reduxjs/toolkit';

interface AccessState {
    senderAccess: boolean;
    receiverAccess: boolean;
}

const initialState: AccessState = {
    senderAccess: sessionStorage.getItem('senderAccess') === 'true',
    receiverAccess: sessionStorage.getItem('receiverAccess') === 'true',
};

const accessSlice = createSlice({
    name: 'access',
    initialState,
    reducers: {
        grantSenderAccess: (state) => {
            state.senderAccess = true;
            sessionStorage.setItem('senderAccess', 'true');
        },
        grantReceiverAccess: (state) => {
            state.receiverAccess = true;
            sessionStorage.setItem('receiverAccess', 'true');
        },
        revokeSenderAccess: (state) => {
            state.senderAccess = false;
            sessionStorage.removeItem('senderAccess');
        },
        revokeReceiverAccess: (state) => {
            state.receiverAccess = false;
            sessionStorage.removeItem('receiverAccess');
        },
    },
});

export const {
    grantSenderAccess,
    grantReceiverAccess,
    revokeSenderAccess,
    revokeReceiverAccess
} = accessSlice.actions;
export default accessSlice.reducer;