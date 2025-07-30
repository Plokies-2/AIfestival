/**
 * 서버 세션 관리 유틸리티
 * 서버 재시작 감지 및 클라이언트 상태 초기화 관리
 */

// 서버 시작 시간을 저장하는 전역 변수
let serverStartTime: number = Date.now();
// 포트폴리오 삭제 로직 제거됨 - 사용자가 생성한 포트폴리오는 유지

/**
 * 서버 시작 시간 반환
 */
export function getServerStartTime(): number {
  return serverStartTime;
}

/**
 * 서버 재시작 여부 확인
 * 클라이언트가 마지막으로 알고 있던 서버 시작 시간과 비교
 */
export function isServerRestarted(clientLastKnownStartTime?: number): boolean {
  if (!clientLastKnownStartTime) {
    return true; // 클라이언트가 서버 시작 시간을 모르면 재시작으로 간주
  }

  return clientLastKnownStartTime !== serverStartTime;
}

/**
 * 포트폴리오 삭제 로직 제거됨 - 항상 false 반환
 */
export function shouldClearPortfolios(): boolean {
  return false; // 포트폴리오를 삭제하지 않음
}

/**
 * 서버 상태 정보 반환
 */
export function getServerStatus() {
  return {
    startTime: serverStartTime,
    uptime: Date.now() - serverStartTime,
    timestamp: Date.now()
  };
}

/**
 * 서버 재시작 시 실행할 초기화 작업
 */
export function initializeServerSession() {
  serverStartTime = Date.now();
  // 포트폴리오 삭제 플래그 제거됨 - 사용자가 생성한 포트폴리오는 유지
  console.log(`🚀 [Server Session] 서버 시작됨: ${new Date(serverStartTime).toISOString()}`);
}

// 서버 시작 시 자동으로 초기화
initializeServerSession();
