import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AILimitState {
  dailyUsageCount: number;
  dailyLimit: number;
  lastResetDate: string | null;
}

// Load initial state from localStorage if available
const loadStateFromStorage = (): AILimitState => {
  try {
    const savedState = localStorage.getItem('aiLimitState');
    if (savedState) {
      return JSON.parse(savedState);
    }
  } catch (err) {
    console.error('Error loading AI limit state from localStorage:', err);
  }
  
  return {
    dailyUsageCount: 0,
    dailyLimit: 10, // Default limit of 10 AI analyses per day
    lastResetDate: null
  };
};

const initialState: AILimitState = loadStateFromStorage();

// Helper function to save state to localStorage
const saveStateToStorage = (state: AILimitState) => {
  try {
    localStorage.setItem('aiLimitState', JSON.stringify(state));
  } catch (err) {
    console.error('Error saving AI limit state to localStorage:', err);
  }
};

// Helper function to check if we need to reset the counter for a new day
const shouldResetCounter = (lastResetDate: string | null): boolean => {
  if (!lastResetDate) return true;
  
  const lastDate = new Date(lastResetDate);
  const currentDate = new Date();
  
  return (
    lastDate.getFullYear() !== currentDate.getFullYear() ||
    lastDate.getMonth() !== currentDate.getMonth() ||
    lastDate.getDate() !== currentDate.getDate()
  );
};

const aiLimitSlice = createSlice({
  name: 'aiLimit',
  initialState,
  reducers: {
    incrementUsage: (state) => {
      // Check if we need to reset the counter for a new day
      const currentDate = new Date().toISOString();
      if (shouldResetCounter(state.lastResetDate)) {
        state.dailyUsageCount = 1;
        state.lastResetDate = currentDate;
      } else {
        state.dailyUsageCount += 1;
      }
      
      // Save updated state to localStorage
      saveStateToStorage(state);
    },
    setDailyLimit: (state, action: PayloadAction<number>) => {
      state.dailyLimit = action.payload;
      
      // Save updated state to localStorage
      saveStateToStorage(state);
    },
    resetUsage: (state) => {
      state.dailyUsageCount = 0;
      state.lastResetDate = new Date().toISOString();
      
      // Save updated state to localStorage
      saveStateToStorage(state);
    }
  }
});

export const { incrementUsage, setDailyLimit, resetUsage } = aiLimitSlice.actions;
export default aiLimitSlice.reducer; 