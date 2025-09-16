import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface HeadStats {
  panelName: string;
  totalMongoNodes: number;
  totalPostgresNodes: number;
  criticalNodes: number;
  warningNodes: number;
}

interface ReduxState {
  headStats: HeadStats;
  selectedMenuItem: string;
}

const initialState: ReduxState = {
  headStats: {
    panelName: '',
    totalMongoNodes: 0,
    totalPostgresNodes: 0,
    criticalNodes: 0,
    warningNodes: 0
  },
  selectedMenuItem: 'dashboard'
};

const reduxSlice = createSlice({
  name: 'redux',
  initialState,
  reducers: {
    setHeadStats: (state, action: PayloadAction<HeadStats>) => {
      state.headStats = action.payload;
    },
    setSelectedMenuItem: (state, action: PayloadAction<string>) => {
      state.selectedMenuItem = action.payload;
    }
  }
});

export const { setHeadStats, setSelectedMenuItem } = reduxSlice.actions;
export default reduxSlice.reducer; 