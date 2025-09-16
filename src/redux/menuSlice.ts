import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface MenuState {
  selectedMenuItem: string;
}

const initialState: MenuState = {
  selectedMenuItem: 'home'
};

const menuSlice = createSlice({
  name: 'menu',
  initialState,
  reducers: {
    setSelectedMenuItem: (state, action: PayloadAction<string>) => {
      state.selectedMenuItem = action.payload;
    }
  }
});

export const { setSelectedMenuItem } = menuSlice.actions;
export default menuSlice.reducer; 