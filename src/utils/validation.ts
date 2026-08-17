// Clean validation utilities with error handling

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Clean email validation with clear error messages
export const validateEmail = (email: string): ValidationResult => {
  try {
    if (!email || email.trim().length === 0) {
      return { isValid: false, error: '이메일을 입력해주세요' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email.trim())) {
      return { isValid: false, error: '올바른 이메일 형식이 아닙니다' };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Email validation error:', error);
    return { isValid: false, error: '이메일 검증 중 오류가 발생했습니다' };
  }
};

// Clean password validation with security requirements
export const validatePassword = (password: string): ValidationResult => {
  try {
    if (!password || password.length === 0) {
      return { isValid: false, error: '비밀번호를 입력해주세요' };
    }

    if (password.length < 6) {
      return { isValid: false, error: '비밀번호는 6자 이상이어야 합니다' };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Password validation error:', error);
    return { isValid: false, error: '비밀번호 검증 중 오류가 발생했습니다' };
  }
};

// Clean form validation utility
export const validateForm = (email: string, password: string): ValidationResult => {
  try {
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return emailValidation;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return passwordValidation;
    }

    return { isValid: true };
  } catch (error) {
    console.error('Form validation error:', error);
    return { isValid: false, error: '폼 검증 중 오류가 발생했습니다' };
  }
};

// Utility for checking if string is empty or whitespace
export const isEmpty = (value: string): boolean => {
  try {
    return !value || value.trim().length === 0;
  } catch (error) {
    console.error('isEmpty check error:', error);
    return true;
  }
};

// Clean duration formatting utility
export const formatDuration = (ms: number): string => {
  try {
    if (ms < 0) return '0초';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}시간 ${minutes % 60}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${seconds % 60}초`;
    } else {
      return `${seconds}초`;
    }
  } catch (error) {
    console.error('Duration formatting error:', error);
    return '0초';
  }
};

// 분 단위 우선 표시 유틸리티 (StatsScreen용)
export const formatDurationInMinutes = (duration: number): string => {
  try {
    if (duration < 0) return '0분';
    
    // 밀리초를 초로 변환 (duration이 밀리초 단위일 경우)
    let seconds = duration;
    if (duration > 1000) {
      seconds = Math.floor(duration / 1000);
    } else {
      seconds = Math.floor(duration);
    }
    
    const totalMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}시간 ${remainingMinutes}분`;
    } else if (totalMinutes > 0) {
      if (remainingSeconds > 0) {
        return `${totalMinutes}분 ${remainingSeconds}초`;
      } else {
        return `${totalMinutes}분`;
      }
    } else {
      return `${seconds}초`;
    }
  } catch (error) {
    console.error('Duration in minutes formatting error:', error);
    return '0분';
  }
}; 