/**
 * Redux Store Configuration
 * Configures the main application store with persistence
 */

import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import { combineReducers } from '@reduxjs/toolkit';

// Create a custom storage wrapper to handle any compatibility issues
const createStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return {
      getItem: (key: string): Promise<string | null> => {
        try {
          const item = window.localStorage.getItem(key);
          return Promise.resolve(item);
        } catch (error) {
          console.warn('Failed to get item from localStorage:', error);
          return Promise.resolve(null);
        }
      },
      setItem: (key: string, value: string): Promise<void> => {
        try {
          window.localStorage.setItem(key, value);
          return Promise.resolve();
        } catch (error) {
          console.warn('Failed to set item in localStorage:', error);
          return Promise.resolve();
        }
      },
      removeItem: (key: string): Promise<void> => {
        try {
          window.localStorage.removeItem(key);
          return Promise.resolve();
        } catch (error) {
          console.warn('Failed to remove item from localStorage:', error);
          return Promise.resolve();
        }
      }
    };
  }
  
  // Fallback for server-side rendering or when localStorage is not available
  return {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.resolve(),
    removeItem: () => Promise.resolve()
  };
};

const storage = createStorage();

// Import reducers
import authReducer from './slices/authSlice.js';
import certificateReducer from './slices/certificateSlice.js';

// Import types
import type { 
  AuthState, 
  CertificateState,
  NotificationState,
  UIState 
} from '../types/index.js';

// Root state interface
export interface RootState {
  auth: AuthState;
  certificate: CertificateState;
  notification: NotificationState;
  ui: UIState;
}

// Simplified configuration without persistence for now
// This avoids storage-related errors during development

// Notification slice (simple implementation)
const notificationInitialState: NotificationState = {
  notifications: [],
  settings: {
    enabled: true,
    soundEnabled: true,
    showBrowserNotifications: true,
    maxVisible: 5,
    defaultTimeout: 5000,
  },
  systemAlerts: [],
  connectionStatus: {
    api: 'disconnected',
    blockchain: 'disconnected',
    ipfs: 'disconnected',
  },
  isSubscribed: false,
  subscriptionError: null,
};

const notificationSlice = {
  name: 'notification',
  reducer: (state = notificationInitialState, action: any) => {
    switch (action.type) {
      case 'notification/addNotification':
        return {
          ...state,
          notifications: [action.payload, ...state.notifications.slice(0, state.settings.maxVisible - 1)],
        };
      case 'notification/removeNotification':
        return {
          ...state,
          notifications: state.notifications.filter(n => n.id !== action.payload),
        };
      case 'notification/clearAll':
        return {
          ...state,
          notifications: [],
        };
      case 'notification/updateConnectionStatus':
        return {
          ...state,
          connectionStatus: { ...state.connectionStatus, ...action.payload },
        };
      default:
        return state;
    }
  },
};

// UI slice (simple implementation)
const uiInitialState: UIState = {
  sidebarOpen: false,
  currentPage: '/',
  navigationHistory: ['/'],
  modals: {},
  loadingStates: {},
  theme: 'light',
  language: 'en',
  compactView: false,
  animationsEnabled: true,
  qrScanner: {
    isActive: false,
    hasPermission: null,
    error: null,
  },
  forms: {},
  toastQueue: [],
  search: {
    isOpen: false,
    query: '',
    recentQueries: [],
    suggestions: [],
  },
  layout: {
    density: 'normal',
    cardSize: 'medium',
    listView: false,
  },
};

const uiSlice = {
  name: 'ui',
  reducer: (state = uiInitialState, action: any) => {
    switch (action.type) {
      case 'ui/toggleSidebar':
        return { ...state, sidebarOpen: !state.sidebarOpen };
      case 'ui/setSidebarOpen':
        return { ...state, sidebarOpen: action.payload };
      case 'ui/setCurrentPage':
        return { 
          ...state, 
          currentPage: action.payload,
          navigationHistory: [...state.navigationHistory, action.payload].slice(-10),
        };
      case 'ui/toggleModal':
        return {
          ...state,
          modals: { ...state.modals, [action.payload]: !state.modals[action.payload] },
        };
      case 'ui/setLoadingState':
        return {
          ...state,
          loadingStates: { ...state.loadingStates, [action.payload.key]: action.payload.value },
        };
      case 'ui/setTheme':
        return { ...state, theme: action.payload };
      case 'ui/addToast':
        return {
          ...state,
          toastQueue: [...state.toastQueue, action.payload],
        };
      case 'ui/removeToast':
        return {
          ...state,
          toastQueue: state.toastQueue.filter(t => t.id !== action.payload),
        };
      default:
        return state;
    }
  },
};

// Persist configuration for auth slice only
const authPersistConfig = {
  key: 'certivert-auth',
  storage,
  whitelist: ['isConnected', 'user', 'walletAddress', 'publicKey', 'userRole', 'sessionValid'] // Only persist essential auth data
};

// Combine reducers with persistence for auth only
const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  certificate: certificateReducer,
  notification: notificationSlice.reducer,
  ui: uiSlice.reducer,
});

// Configure store with persistence
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        ignoredActionsPaths: ['meta.arg', 'payload.timestamp', 'payload.user.lastLoginAt', 'register'],
        ignoredPaths: ['auth.user.lastLoginAt', 'auth.lastActivity', 'auth._persist']
      },
    }),
  devTools: import.meta.env.MODE === 'development',
});

// Create real persistor for auth state
export const persistor = persistStore(store);

// Make store accessible globally for API service
if (typeof window !== 'undefined') {
  (window as any).__REDUX_STORE__ = store;
}

// Export types
export type AppDispatch = typeof store.dispatch;
export type AppSelector<T = any> = (state: RootState) => T;

// Export action creators for simple slices
export const notificationActions = {
  addNotification: (notification: any) => ({
    type: 'notification/addNotification',
    payload: notification,
  }),
  removeNotification: (id: string | number) => ({
    type: 'notification/removeNotification',
    payload: id,
  }),
  clearAll: () => ({ type: 'notification/clearAll' }),
  updateConnectionStatus: (status: Partial<NotificationState['connectionStatus']>) => ({
    type: 'notification/updateConnectionStatus',
    payload: status,
  }),
};

export const uiActions = {
  toggleSidebar: () => ({ type: 'ui/toggleSidebar' }),
  setSidebarOpen: (open: boolean) => ({ type: 'ui/setSidebarOpen', payload: open }),
  setCurrentPage: (page: string) => ({ type: 'ui/setCurrentPage', payload: page }),
  toggleModal: (modalId: string) => ({ type: 'ui/toggleModal', payload: modalId }),
  setLoadingState: (key: string, value: boolean) => ({
    type: 'ui/setLoadingState',
    payload: { key, value },
  }),
  setTheme: (theme: 'light' | 'dark' | 'auto') => ({ type: 'ui/setTheme', payload: theme }),
  addToast: (toast: any) => ({ type: 'ui/addToast', payload: toast }),
  removeToast: (id: string | number) => ({ type: 'ui/removeToast', payload: id }),
};

// Utility function to clear all app data
export const clearAppData = () => {
  // For now, just clear local storage
  localStorage.clear();
  sessionStorage.clear();
};

// Export default store
export default store;