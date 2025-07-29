/**
 * 서버 상태 관리 훅
 * 서버 재시작 감지 및 포트폴리오 자동 삭제 처리
 */

import { useEffect, useRef } from 'react';

interface ServerStatus {
  startTime: number;
  uptime: number;
  timestamp: number;
  restarted: boolean;
  shouldClearPortfolios: boolean;
}

interface UseServerStatusOptions {
  onServerRestart?: () => void;
  checkInterval?: number; // 체크 간격 (ms)
}

export function useServerStatus(options: UseServerStatusOptions = {}) {
  const { onServerRestart, checkInterval = 30000 } = options; // 기본 30초마다 체크
  const lastKnownStartTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkServerStatus = async () => {
    try {
      const params = new URLSearchParams();
      if (lastKnownStartTimeRef.current) {
        params.append('lastKnownStartTime', lastKnownStartTimeRef.current.toString());
      }

      const response = await fetch(`/api/server-status?${params}`);
      if (!response.ok) {
        console.warn('⚠️ [Server Status] 서버 상태 확인 실패');
        return;
      }

      const status: ServerStatus = await response.json();

      // 서버가 재시작된 경우
      if (status.restarted && status.shouldClearPortfolios) {
        console.log('🔄 [Server Status] 서버 재시작 감지됨');

        // 개발 환경에서는 포트폴리오 자동 삭제 비활성화
        const isDevelopment = process.env.NODE_ENV === 'development' ||
                             typeof window !== 'undefined' && window.location.hostname === 'localhost';

        if (!isDevelopment) {
          // 프로덕션 환경에서만 포트폴리오 삭제
          if (typeof window !== 'undefined') {
            localStorage.removeItem('ai_portfolios');
            console.log('✅ [Server Status] 포트폴리오 삭제 완료 (프로덕션 환경)');
          }
        } else {
          console.log('🔧 [Server Status] 개발 환경에서는 포트폴리오 자동 삭제 건너뜀');
        }

        // 콜백 실행
        onServerRestart?.();
      }

      // 서버 시작 시간 업데이트
      lastKnownStartTimeRef.current = status.startTime;

    } catch (error) {
      console.error('❌ [Server Status] 서버 상태 확인 오류:', error);
    }
  };

  useEffect(() => {
    // 초기 체크
    checkServerStatus();

    // 주기적 체크 설정
    intervalRef.current = setInterval(checkServerStatus, checkInterval);

    // 클린업
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkInterval, onServerRestart]);

  // 페이지 포커스 시에도 체크 (사용자가 탭을 다시 활성화했을 때)
  useEffect(() => {
    const handleFocus = () => {
      checkServerStatus();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return {
    checkServerStatus
  };
}
