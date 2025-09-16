import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { message } from 'antd';

interface User {
  username: string;
  given_name?: string;
  role?: string;
}

interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
}

const initialState: AuthState = {
  isLoggedIn: !!localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<AuthState>) => {
      state.isLoggedIn = action.payload.isLoggedIn;
      state.user = action.payload.user;
    },
    logout: (state) => {
      state.isLoggedIn = false;
      state.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      message.success('Successfully logged out');
    },
  },
});

export const { setAuth, logout } = authSlice.actions;
export default authSlice.reducer; 