import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import menuReducer from './menuSlice';
import aiLimitReducer from './aiLimitSlice';
import sidebarReducer from './sidebarSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        menu: menuReducer,
        aiLimit: aiLimitReducer,
        sidebar: sidebarReducer,
    }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 