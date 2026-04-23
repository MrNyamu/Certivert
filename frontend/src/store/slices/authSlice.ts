/**
 * Authentication Redux Slice (TypeScript)
 * Enhanced with wallet service integration and comprehensive state management
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { 
  AuthState, 
  SerializedUser, 
  AuthenticationResult 
} from '../../types/index.js';
import { walletService } from '../../services/wallet.js';

// Initial state
const initialState: AuthState = {
  isConnected: false,
  user: null,
  walletAddress: null,
  publicKey: null,
  userRole: null,
  connectionStatus: 'idle',
  error: null,
  lastActivity: null,
  sessionValid: false
};

// Async thunks
export const connectWallet = createAsyncThunk<
  AuthenticationResult,
  void,
  { rejectValue: string }
>(
  'auth/connectWallet',
  async (_, { rejectWithValue }) => {
    try {
      const result = await walletService.connect();
      
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to connect wallet');
      }

      return result;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to connect wallet'
      );
    }
  }
);

export const disconnectWallet = createAsyncThunk<
  { success: boolean; message?: string },
  void,
  { rejectValue: string }
>(
  'auth/disconnectWallet',
  async (_, { rejectWithValue }) => {
    try {
      await walletService.disconnect();
      return { success: true, message: 'Wallet disconnected successfully' };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to disconnect wallet'
      );
    }
  }
);

export const validateSession = createAsyncThunk<
  { isValid: boolean },
  void,
  { rejectValue: string }
>(
  'auth/validateSession',
  async (_, { rejectWithValue }) => {
    try {
      const isValid = await walletService.validateSession();
      return { isValid };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to validate session'
      );
    }
  }
);

export const restoreSession = createAsyncThunk<
  AuthenticationResult,
  void,
  { rejectValue: string }
>(
  'auth/restoreSession',
  async (_, { rejectWithValue }) => {
    try {
      const user = await walletService.restoreSession();
      
      if (!user) {
        return rejectWithValue('No valid session found');
      }

      return { success: true, user };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to restore session'
      );
    }
  }
);

export const refreshUserRole = createAsyncThunk<
  { role: string; roleValue: number },
  void,
  { rejectValue: string }
>(
  'auth/refreshUserRole',
  async (_, { rejectWithValue }) => {
    try {
      const roleInfo = await walletService.getRole();
      return roleInfo;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to refresh user role'
      );
    }
  }
);

export const clearAllSessions = createAsyncThunk<
  { success: boolean },
  void,
  { rejectValue: string }
>(
  'auth/clearAllSessions',
  async (_, { rejectWithValue }) => {
    try {
      await walletService.clearAllSessions();
      return { success: true };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to clear sessions'
      );
    }
  }
);

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },

    updateLastActivity: (state) => {
      state.lastActivity = new Date().toISOString();
    },

    setSessionValid: (state, action: PayloadAction<boolean>) => {
      state.sessionValid = action.payload;
    },

    handleSessionExpired: (state) => {
      state.isConnected = false;
      state.user = null;
      state.walletAddress = null;
      state.publicKey = null;
      state.userRole = null;
      state.connectionStatus = 'disconnected';
      state.sessionValid = false;
      state.error = 'Session expired. Please reconnect your wallet.';
    },

    // For handling real-time updates from wallet service events
    handleWalletEvent: (state, action: PayloadAction<{
      type: 'connected' | 'disconnected' | 'error';
      data?: any;
    }>) => {
      const { type, data } = action.payload;

      switch (type) {
        case 'connected':
          if (data?.user) {
            state.isConnected = true;
            state.user = data.user;
            state.walletAddress = data.address;
            state.publicKey = data.publicKey;
            state.userRole = data.user.role;
            state.connectionStatus = 'connected';
            state.error = null;
            state.sessionValid = true;
            state.lastActivity = new Date().toISOString();
          }
          break;

        case 'disconnected':
          state.isConnected = false;
          state.user = null;
          state.walletAddress = null;
          state.publicKey = null;
          state.userRole = null;
          state.connectionStatus = 'disconnected';
          state.sessionValid = false;
          state.error = null;
          break;

        case 'error':
          state.connectionStatus = 'error';
          state.error = data?.error || 'Wallet connection error';
          break;
      }
    },

    // For manual state updates
    updateConnectionStatus: (state, action: PayloadAction<AuthState['connectionStatus']>) => {
      state.connectionStatus = action.payload;
    },

    // Reset all authentication state
    resetAuthState: (state) => {
      state.isConnected = false;
      state.user = null;
      state.walletAddress = null;
      state.publicKey = null;
      state.userRole = null;
      state.connectionStatus = 'idle';
      state.error = null;
      state.lastActivity = null;
      state.sessionValid = false;
    }
  },

  extraReducers: (builder) => {
    // Connect wallet
    builder
      .addCase(connectWallet.pending, (state) => {
        state.connectionStatus = 'connecting';
        state.error = null;
      })
      .addCase(connectWallet.fulfilled, (state, action) => {
        const result = action.payload;
        state.isConnected = true;
        state.user = result.user || null;
        state.walletAddress = result.address || null;
        state.publicKey = result.publicKey || null;
        state.userRole = result.user?.role || null;
        state.connectionStatus = 'connected';
        state.error = null;
        state.sessionValid = true;
        state.lastActivity = new Date().toISOString();
      })
      .addCase(connectWallet.rejected, (state, action) => {
        state.connectionStatus = 'error';
        state.error = action.payload || 'Failed to connect wallet';
        state.isConnected = false;
        state.user = null;
        state.walletAddress = null;
        state.publicKey = null;
        state.userRole = null;
        state.sessionValid = false;
      });

    // Disconnect wallet
    builder
      .addCase(disconnectWallet.pending, (state) => {
        state.connectionStatus = 'connecting'; // Show loading during disconnect
      })
      .addCase(disconnectWallet.fulfilled, (state) => {
        state.isConnected = false;
        state.user = null;
        state.walletAddress = null;
        state.publicKey = null;
        state.userRole = null;
        state.connectionStatus = 'disconnected';
        state.error = null;
        state.sessionValid = false;
        state.lastActivity = null;
      })
      .addCase(disconnectWallet.rejected, (state, action) => {
        // Even if disconnect fails, clear the state
        state.isConnected = false;
        state.user = null;
        state.walletAddress = null;
        state.publicKey = null;
        state.userRole = null;
        state.connectionStatus = 'disconnected';
        state.error = action.payload || 'Failed to disconnect wallet';
        state.sessionValid = false;
      });

    // Restore session
    builder
      .addCase(restoreSession.pending, (state) => {
        state.connectionStatus = 'connecting';
        state.error = null;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        const result = action.payload;
        state.isConnected = true;
        state.user = result.user || null;
        state.walletAddress = result.address || null;
        state.publicKey = result.publicKey || null;
        state.userRole = result.user?.role || null;
        state.connectionStatus = 'connected';
        state.error = null;
        state.sessionValid = true;
        state.lastActivity = new Date().toISOString();
      })
      .addCase(restoreSession.rejected, (state, action) => {
        state.connectionStatus = 'disconnected';
        state.error = null; // Don't show error for failed session restore
        state.isConnected = false;
        state.user = null;
        state.walletAddress = null;
        state.publicKey = null;
        state.userRole = null;
        state.sessionValid = false;
      });

    // Validate session
    builder
      .addCase(validateSession.fulfilled, (state, action) => {
        const { isValid } = action.payload;
        if (!isValid && state.isConnected) {
          // Session is invalid but state shows connected - disconnect
          state.isConnected = false;
          state.user = null;
          state.walletAddress = null;
          state.publicKey = null;
          state.userRole = null;
          state.connectionStatus = 'disconnected';
          state.sessionValid = false;
          state.lastActivity = null;
        } else {
          state.sessionValid = isValid;
        }
      })
      .addCase(validateSession.rejected, (state, action) => {
        // If validation fails, assume disconnected
        if (state.isConnected) {
          state.isConnected = false;
          state.user = null;
          state.walletAddress = null;
          state.publicKey = null;
          state.userRole = null;
          state.connectionStatus = 'disconnected';
          state.sessionValid = false;
          state.lastActivity = null;
        }
      });

    // Refresh user role
    builder
      .addCase(refreshUserRole.pending, (state) => {
        state.error = null;
      })
      .addCase(refreshUserRole.fulfilled, (state, action) => {
        const { role, roleValue } = action.payload;
        if (state.user) {
          state.user.role = role;
          state.user.roleValue = roleValue;
          state.user.isAdmin = roleValue === 1;      // Changed from isStudent to isAdmin
          state.user.isUniversity = roleValue === 2;
          state.user.isKNQA = roleValue === 3;
          state.user.isActive = roleValue > 0;
          state.userRole = role;
          state.lastActivity = new Date().toISOString();
        }
        state.error = null;
      })
      .addCase(refreshUserRole.rejected, (state, action) => {
        state.error = action.payload || 'Failed to refresh user role';
      });

    // Clear all sessions
    builder
      .addCase(clearAllSessions.pending, (state) => {
        state.connectionStatus = 'connecting';
        state.error = null;
      })
      .addCase(clearAllSessions.fulfilled, (state) => {
        // Reset all state to initial values
        Object.assign(state, initialState);
      })
      .addCase(clearAllSessions.rejected, (state, action) => {
        state.connectionStatus = 'error';
        state.error = action.payload || 'Failed to clear sessions';
      });
  }
});

// Selectors
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectIsConnected = (state: { auth: AuthState }) => state.auth.isConnected;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectWalletAddress = (state: { auth: AuthState }) => state.auth.walletAddress;
export const selectUserRole = (state: { auth: AuthState }) => state.auth.userRole;
export const selectConnectionStatus = (state: { auth: AuthState }) => state.auth.connectionStatus;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectSessionValid = (state: { auth: AuthState }) => state.auth.sessionValid;

// Complex selectors
export const selectIsAuthenticated = (state: { auth: AuthState }) => {
  const auth = state.auth;
  return auth.isConnected && auth.user !== null && auth.sessionValid;
};

export const selectUserPermissions = (state: { auth: AuthState }) => {
  return state.auth.user?.permissions || [];
};

export const selectCanPerformAction = (action: string) => (state: { auth: AuthState }) => {
  const user = state.auth.user;
  if (!user || !state.auth.isConnected) return false;

  switch (action) {
    case 'issue_certificates':
      return user.isUniversity;
    case 'approve_certificates':
      return user.isKNQA;
    case 'revoke_certificates':
      return user.isUniversity || user.isKNQA;
    case 'audit_system':
      return user.isKNQA;
    case 'manage_roles':
      return user.isAdmin;
    case 'verify_certificates':
      return true;
    default:
      return false;
  }
};

export const selectHasRole = (role: 'admin' | 'university' | 'knqa') => (state: { auth: AuthState }) => {
  const user = state.auth.user;
  if (!user || !state.auth.isConnected) return false;

  switch (role) {
    case 'admin':
      return user.isAdmin;
    case 'university':
      return user.isUniversity;
    case 'knqa':
      return user.isKNQA;
    default:
      return false;
  }
};

export const selectHasPermission = (permission: string) => (state: { auth: AuthState }) => {
  const user = state.auth.user;
  return user?.permissions.includes(permission) || false;
};

// Actions
export const {
  clearError,
  updateLastActivity,
  setSessionValid,
  handleSessionExpired,
  handleWalletEvent,
  updateConnectionStatus,
  resetAuthState
} = authSlice.actions;

export default authSlice.reducer;