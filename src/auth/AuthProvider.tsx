import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { ApiError, authApi, type AuthUser } from '../config/api';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  checkSession: () => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function messageFor(error: unknown, action: 'signIn' | 'signUp' | 'restore' | 'logout'): string {
  if (error instanceof ApiError && error.status === null) return error.message;
  if (error instanceof ApiError && error.status === 401) {
    return action === 'signIn'
      ? 'Email or password is incorrect.'
      : 'Your session has expired. Sign in again.';
  }
  if (error instanceof ApiError && error.status === 409) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (error instanceof ApiError && error.status !== null && error.status >= 500) {
    if (__DEV__) {
      console.warn(
        `[Auth API] ${action}: ${error.method} ${error.path} returned HTTP ${error.status}${error.responseDetail ? `: ${error.responseDetail}` : ''}`,
      );
      return `GP Autos API error: HTTP ${error.status} from ${error.method} ${error.path}${error.responseDetail ? `: ${error.responseDetail}` : ''}`;
    }
    return 'GP Autos is temporarily unavailable. Please try again shortly.';
  }
  return action === 'logout'
    ? 'Could not contact GP Autos. You have been signed out on this device.'
    : 'Something went wrong. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void authApi
      .getCurrentUser()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setStatus('authenticated');
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          setUser(null);
          setStatus('unauthenticated');
          return;
        }
        setUser(null);
        setError(messageFor(requestError, 'restore'));
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<boolean> => {
    setError(null);
    setStatus('loading');

    try {
      await authApi.signIn({ email: email.trim(), password });
    } catch (requestError: unknown) {
      setUser(null);
      setError(messageFor(requestError, 'signIn'));
      setStatus('unauthenticated');
      return false;
    }

    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      setStatus('authenticated');
      return true;
    } catch (requestError: unknown) {
      setUser(null);
      setError(
        requestError instanceof ApiError && requestError.status === 401
          ? 'Sign-in could not be verified. Please try again.'
          : messageFor(requestError, 'restore'),
      );
      setStatus('unauthenticated');
      return false;
    }
  };

  const signUp = async (name: string, email: string, password: string): Promise<boolean> => {
    setError(null);
    setStatus('loading');

    try {
      await authApi.signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        confirm_password: password,
      });
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      setStatus('authenticated');
      return true;
    } catch (requestError: unknown) {
      setUser(null);
      setError(messageFor(requestError, 'signUp'));
      setStatus('unauthenticated');
      return false;
    }
  };

  const checkSession = async (): Promise<boolean> => {
    setError(null);
    setStatus('loading');
    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      setStatus('authenticated');
      return true;
    } catch (requestError: unknown) {
      setUser(null);
      setStatus('unauthenticated');
      setError(
        requestError instanceof ApiError && requestError.status === 401
          ? 'The browser sign-in is not available to the app. Use email and password, or contact GP Autos support.'
          : messageFor(requestError, 'restore'),
      );
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    setError(null);
    try {
      await authApi.logout();
      setUser(null);
      setStatus('unauthenticated');
    } catch (requestError: unknown) {
      setUser(null);
      setError(messageFor(requestError, 'logout'));
      setStatus('unauthenticated');
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ status, user, error, signIn, signUp, checkSession, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}