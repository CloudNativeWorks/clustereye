import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// localStorage'dan başlangıç durumunu al
const getInitialState = (): boolean => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
};

const sidebarSlice = createSlice({
    name: 'sidebar',
    initialState: {
        collapsed: getInitialState(),
    },
    reducers: {
        setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
            state.collapsed = action.payload;
            // localStorage'a kaydet
            localStorage.setItem('sidebarCollapsed', JSON.stringify(action.payload));
        },
    },
});

export const { setSidebarCollapsed } = sidebarSlice.actions;
export default sidebarSlice.reducer; 