import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebase';

// Firebase 인증 상태 관리
export const useAuth = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    const initAuth = async () => {
      try {
        console.log('Initializing Firebase Auth...');
        
        unsubscribe = onAuthStateChanged(auth, (user) => {
          try {
            setUser(user);
            setIsLoggedIn(!!user);
            setLoading(false);
            setError(null);
          } catch (error) {
            console.error('Auth state change error:', error);
            setError('인증 상태 변경 중 오류가 발생했습니다.');
            setLoading(false);
          }
        });
      } catch (error) {
        console.error('Firebase initialization error:', error);
        setError('Firebase 초기화 중 오류가 발생했습니다.');
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      unsubscribe?.();
    };
  }, []); // 빈 의존성 배열로 한 번만 실행

  return {
    loading,
    user,
    error,
    isLoggedIn,
    setUser,
    setError,
    setIsLoggedIn
  };
};

