/**
 * Session Validator Component
 * Periodically validates wallet connection and clears invalid sessions
 */

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store/index.js';
import { validateSession, restoreSession, selectIsConnected, selectSessionValid } from '../../store/slices/authSlice.js';

const SessionValidator: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isConnected = useSelector((state: RootState) => selectIsConnected(state));
  const sessionValid = useSelector((state: RootState) => selectSessionValid(state));

  // Restore session on app startup
  useEffect(() => {
    console.log('🔄 Attempting to restore session...');
    dispatch(restoreSession()).then((result) => {
      if (result.meta.requestStatus === 'fulfilled') {
        console.log('✅ Session restored successfully');
      } else {
        console.log('ℹ️ No valid session to restore');
      }
    });
  }, [dispatch]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    // Only validate if connected
    if (isConnected) {
      // Validate immediately
      dispatch(validateSession());

      // Then validate every 30 seconds
      intervalId = setInterval(() => {
        dispatch(validateSession());
      }, 30000); // 30 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [dispatch, isConnected]);

  // Validate on focus (when user returns to tab)
  useEffect(() => {
    const handleFocus = () => {
      if (isConnected) {
        dispatch(validateSession());
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [dispatch, isConnected]);

  // This component doesn't render anything
  return null;
};

export default SessionValidator;