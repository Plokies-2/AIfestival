import { NextApiRequest, NextApiResponse } from 'next';

// SpeedTraffic 분석 결과를 백엔드에 로깅하는 API
// AI가 추후 이 로그들을 분석하여 SpeedTraffic 결과를 해석할 수 있도록 함
// Vercel 서버리스 환경을 위해 메모리 기반 저장 방식 사용

interface SpeedTrafficLogEntry {
  timestamp: string;
  symbol: string;
  companyName: string;
  analysisDate: string;
  traffic_lights: {
    technical?: string;
    industry?: string;
    market?: string;
    risk?: string;
  };
  // 확장된 분석 데이터 구조
  technical_analysis?: {
    mfi?: { value?: number; signal?: string; summary?: string; traffic_light?: string; };
    rsi?: { value?: number; signal?: string; summary?: string; traffic_light?: string; };
    bollinger?: { percent_b?: number; signal?: string; summary?: string; traffic_light?: string; };
  };
  market_analysis?: {
    capm?: { beta?: number; r_squared?: number; t_stat?: number; signal?: string; summary?: string; traffic_light?: string; };
    industry?: { beta?: number; r_squared?: number; t_stat?: number; signal?: string; summary?: string; traffic_light?: string; };
  };
  risk_analysis?: {
    garch?: { volatility?: number; var_95?: number; var_99?: number; signal?: string; summary?: string; traffic_light?: string; };
  };
  // 원본 데이터 (호환성)
  analysis_results?: {
    mfi?: any;
    bollinger?: any;
    rsi?: any;
    industry?: any;
    capm?: any;
    garch?: any;
  };
  raw_analysis_results?: any;
  session_id?: string;
  user_agent?: string;
}

// 메모리 기반 로그 저장소 (Vercel 서버리스 환경 대응)
// 각 인스턴스별로 독립적인 메모리 저장소 유지
const memoryLogStore: Map<string, SpeedTrafficLogEntry[]> = new Map();
const MAX_LOGS_PER_SYMBOL = 100; // 심볼당 최대 로그 개수
const MAX_TOTAL_LOGS = 1000; // 전체 최대 로그 개수

function addToMemoryLog(logEntry: SpeedTrafficLogEntry) {
  try {
    const symbol = logEntry.symbol;

    // 심볼별 로그 배열 가져오기 또는 생성
    if (!memoryLogStore.has(symbol)) {
      memoryLogStore.set(symbol, []);
    }

    const symbolLogs = memoryLogStore.get(symbol)!;

    // 새 로그 추가
    symbolLogs.push(logEntry);

    // 심볼별 로그 개수 제한
    if (symbolLogs.length > MAX_LOGS_PER_SYMBOL) {
      symbolLogs.shift(); // 가장 오래된 로그 제거
    }

    // 전체 로그 개수 제한 (메모리 사용량 관리)
    const totalLogs = Array.from(memoryLogStore.values()).reduce((sum, logs) => sum + logs.length, 0);
    if (totalLogs > MAX_TOTAL_LOGS) {
      // 가장 오래된 심볼의 로그부터 제거
      const oldestSymbol = Array.from(memoryLogStore.keys())[0];
      const oldestLogs = memoryLogStore.get(oldestSymbol)!;
      if (oldestLogs.length > 1) {
        oldestLogs.shift();
      } else {
        memoryLogStore.delete(oldestSymbol);
      }
    }

    console.log(`📝 SpeedTraffic 메모리 로그 저장됨: ${logEntry.symbol} - ${JSON.stringify(logEntry.traffic_lights)} (총 ${symbolLogs.length}개)`);
  } catch (error) {
    console.error('❌ SpeedTraffic 메모리 로그 저장 실패:', error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🔍 [SPEEDTRAFFIC_LOG] API 호출됨');
  console.log('🔍 [SPEEDTRAFFIC_LOG] 요청 데이터:', JSON.stringify(req.body, null, 2));

  try {
    const {
      symbol,
      companyName,
      analysisDate,
      traffic_lights,
      technical_analysis,
      market_analysis,
      risk_analysis,
      analysis_results,
      raw_analysis_results,
      session_id
    } = req.body;

    console.log('🔍 [SPEEDTRAFFIC_LOG] 파싱된 데이터:', {
      symbol,
      companyName,
      traffic_lights,
      technical_analysis: !!technical_analysis,
      market_analysis: !!market_analysis,
      risk_analysis: !!risk_analysis
    });

    // 필수 필드 검증
    if (!symbol || !traffic_lights) {
      console.error('❌ [SPEEDTRAFFIC_LOG] 필수 필드 누락:', { symbol: !!symbol, traffic_lights: !!traffic_lights });
      return res.status(400).json({ error: 'Symbol and traffic_lights are required' });
    }

    // 로그 엔트리 생성 (확장된 구조)
    const logEntry: SpeedTrafficLogEntry = {
      timestamp: new Date().toISOString(),
      symbol: symbol.toUpperCase(),
      companyName: companyName || '',
      analysisDate: analysisDate || new Date().toISOString().split('T')[0],
      traffic_lights,
      technical_analysis: technical_analysis || {},
      market_analysis: market_analysis || {},
      risk_analysis: risk_analysis || {},
      analysis_results: analysis_results || {},
      raw_analysis_results: raw_analysis_results || {},
      session_id: session_id || '',
      user_agent: req.headers['user-agent'] || ''
    };

    // 메모리 로그에 추가
    addToMemoryLog(logEntry);

    // SpeedTraffic 결과 로깅 완료

    return res.status(200).json({ 
      success: true, 
      message: 'SpeedTraffic 결과가 성공적으로 로깅되었습니다.',
      log_id: `${symbol}_${Date.now()}`
    });

  } catch (error) {
    console.error('❌ SpeedTraffic 로깅 API 오류:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// 메모리 로그 조회를 위한 헬퍼 함수들
export function getRecentLogs(days: number = 7): SpeedTrafficLogEntry[] {
  try {
    const logs: SpeedTrafficLogEntry[] = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // 모든 심볼의 로그를 수집
    for (const symbolLogs of memoryLogStore.values()) {
      for (const log of symbolLogs) {
        const logDate = new Date(log.timestamp);
        if (logDate >= cutoffDate) {
          logs.push(log);
        }
      }
    }

    // 타임스탬프 기준으로 최신순 정렬
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error('메모리 로그 조회 오류:', error);
    return [];
  }
}

export function getLogsBySymbol(symbol: string, days: number = 30): SpeedTrafficLogEntry[] {
  try {
    const symbolLogs = memoryLogStore.get(symbol.toUpperCase()) || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return symbolLogs
      .filter(log => new Date(log.timestamp) >= cutoffDate)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error('심볼별 메모리 로그 조회 오류:', error);
    return [];
  }
}

// 메모리 로그 통계 조회 함수 (디버깅용)
export function getMemoryLogStats(): { totalSymbols: number; totalLogs: number; symbolStats: Record<string, number> } {
  const symbolStats: Record<string, number> = {};
  let totalLogs = 0;

  for (const [symbol, logs] of memoryLogStore.entries()) {
    symbolStats[symbol] = logs.length;
    totalLogs += logs.length;
  }

  return {
    totalSymbols: memoryLogStore.size,
    totalLogs,
    symbolStats
  };
}
