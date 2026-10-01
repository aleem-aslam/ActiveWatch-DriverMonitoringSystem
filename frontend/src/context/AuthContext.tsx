// context/AuthContext.tsx — additive change only
import React, {
  createContext,
  useCallback,
  useEffect,
  useState
} from "react";

import { subscribeAuth } from "../firebase/auth";
import { createUserDocument, getUserDocument } from "../firebase/userService";

export const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: any) {
  const [user, setUser] = useState<any>(null);
  const [guest, setGuest] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // NEW: lets a screen re-pull the doc after writing a change, since
  // `profile` otherwise only updates on auth state changes.
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const data = await getUserDocument(user.uid);
    setProfile(data);
  }, [user]);

  useEffect(() => {
    const unsubscribe = subscribeAuth(async (firebaseUser: any) => {
      if (firebaseUser) {
        await createUserDocument(firebaseUser);
        const data = await getUserDocument(firebaseUser.uid);
        setProfile(data);
        setUser(firebaseUser);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, guest, setGuest, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}