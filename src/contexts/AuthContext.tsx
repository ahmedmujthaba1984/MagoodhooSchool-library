import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { UserProfile } from '../types';
import {
  AUTH_SESSION_STORAGE_KEY,
  GUEST_USER,
  persistSessionUser,
  readInitialSessionUser,
  resolveDeskPinUser,
  signInWithGoogleDirectory,
  signOutSession,
  subscribeFirebaseAuth,
} from '../services/authService';

export { AUTH_SESSION_STORAGE_KEY, GUEST_USER };

export interface DeskPinMatchResult {
  matched: boolean;
  user?: UserProfile;
}

export interface AuthContextValue {
  currentUser: UserProfile;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  loginWithProfile: (user: UserProfile) => void;
  loginWithGoogle: (allUsers: UserProfile[]) => Promise<UserProfile>;
  loginWithDeskPin: (pin: string, allUsers: UserProfile[]) => DeskPinMatchResult;
  enterGuestMode: () => void;
  logout: () => Promise<void>;
  syncWithDirectory: (allUsers: UserProfile[]) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<UserProfile>(() => readInitialSessionUser());
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  const persistSession = useCallback((user: UserProfile) => {
    persistSessionUser(user);
  }, []);

  const setCurrentUser: React.Dispatch<React.SetStateAction<UserProfile>> = useCallback(
    (updater) => {
      setCurrentUserState((prev) => {
        const next = typeof updater === 'function' ? (updater as (p: UserProfile) => UserProfile)(prev) : updater;
        persistSession(next);
        return next;
      });
    },
    [persistSession]
  );

  useEffect(() => {
    const unsubscribe = subscribeFirebaseAuth((fbUser) => {
      setFirebaseUser(fbUser);
    });
    return () => unsubscribe();
  }, []);

  const loginWithProfile = useCallback(
    (user: UserProfile) => {
      setCurrentUser(user);
    },
    [setCurrentUser]
  );

  const loginWithGoogle = useCallback(
    async (allUsers: UserProfile[]): Promise<UserProfile> => {
      const { firebaseUser: fbUser, profile } = await signInWithGoogleDirectory(allUsers);
      setFirebaseUser(fbUser);
      setCurrentUser(profile);
      return profile;
    },
    [setCurrentUser]
  );

  const loginWithDeskPin = useCallback(
    (pin: string, allUsers: UserProfile[]): DeskPinMatchResult => {
      const result = resolveDeskPinUser(pin, allUsers);
      if (!result.matched || !result.user) {
        return { matched: false };
      }
      setCurrentUser(result.user);
      return { matched: true, user: result.user };
    },
    [setCurrentUser]
  );

  const enterGuestMode = useCallback(() => {
    setCurrentUser(GUEST_USER);
  }, [setCurrentUser]);

  const logout = useCallback(async () => {
    await signOutSession();
    setCurrentUser(GUEST_USER);
  }, [setCurrentUser]);

  const syncWithDirectory = useCallback(
    (allUsers: UserProfile[]) => {
      setCurrentUserState((prev) => {
        if (!prev || prev.id === 'guest') return prev;
        const fresh = allUsers.find((u) => u.id === prev.id);
        if (!fresh) return prev;
        if (JSON.stringify(fresh) === JSON.stringify(prev)) return prev;
        persistSession(fresh);
        return fresh;
      });
    },
    [persistSession]
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        isAuthenticated: currentUser.id !== 'guest',
        isGuest: currentUser.id === 'guest',
        setCurrentUser,
        loginWithProfile,
        loginWithGoogle,
        loginWithDeskPin,
        enterGuestMode,
        logout,
        syncWithDirectory,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
