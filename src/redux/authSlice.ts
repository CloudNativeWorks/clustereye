import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
    username: string;
    email?: string;
    role?: string;
    isAdmin?: boolean;
    status?: string;
    created?: string;
}

interface AuthState {
    isLoggedIn: boolean;
    token: string | null;
    user: User | null;
}

const initialState: AuthState = {
    isLoggedIn: !!localStorage.getItem('token'),
    token: localStorage.getItem('token'),
    user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}') : null
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        login: (state, action: PayloadAction<{ token: string; user: User }>) => {
            state.isLoggedIn = true;
            state.token = action.payload.token;
            state.user = action.payload.user;
        },
        logout: (state) => {
            state.isLoggedIn = false;
            state.token = null;
            state.user = null;
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        },
        updateUser: (state, action: PayloadAction<User>) => {
            state.user = action.payload;
            localStorage.setItem('user', JSON.stringify(action.payload));
        }
    }
});

export const { login, logout, updateUser } = authSlice.actions;
export default authSlice.reducer; 