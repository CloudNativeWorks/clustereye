import { configureStore } from '@reduxjs/toolkit';
import headStatsReducer from './redux';

export const store = configureStore({
    reducer: {
        headStats: headStatsReducer,
    },
});