import { createSlice } from '@reduxjs/toolkit';


const headStatsSlice = createSlice({
  name: 'headstats',
  initialState: {},
  reducers: {
    setHeadStats: (_, action) => {
      return action.payload;
    },
  },
});


export const { setHeadStats } = headStatsSlice.actions;

export default headStatsSlice.reducer;

