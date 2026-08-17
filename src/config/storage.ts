import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase Auth state persistence을 위한 AsyncStorage 설정
export const setAuthState = async (key: string, value: string) => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.error('Auth state save error:', error);
  }
};

export const getAuthState = async (key: string) => {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.error('Auth state read error:', error);
    return null;
  }
};

export const removeAuthState = async (key: string) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Auth state remove error:', error);
  }
};

export default AsyncStorage; 