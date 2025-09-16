import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import nodesReducer from './nodesSlice';
import reduxReducer from '../redux/redux';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    nodes: nodesReducer,
    headStats: (state = {}) => state ?? {}, // Add temporary headStats reducer
    redux: reduxReducer
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 