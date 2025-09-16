import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { NodeType } from '../type';

interface NodesState {
  mongoNodes: NodeType[];
  postgresNodes: NodeType[];
}

const initialState: NodesState = {
  mongoNodes: [],
  postgresNodes: []
};

const nodesSlice = createSlice({
  name: 'nodes',
  initialState,
  reducers: {
    setMongoNodes: (state, action: PayloadAction<NodeType[]>) => {
      state.mongoNodes = action.payload;
    },
    setPostgresNodes: (state, action: PayloadAction<NodeType[]>) => {
      state.postgresNodes = action.payload;
    }
  }
});

export const { setMongoNodes, setPostgresNodes } = nodesSlice.actions;
export default nodesSlice.reducer; 