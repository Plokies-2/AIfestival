import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// SpeedTraffic 분석 결과를 백엔드에 로깅하는 API
// AI가 추후 이 로그들을 분석하여 SpeedTraffic 결과를 해석할 수 있도록 함

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

// 로그 디렉토리 설정
const LOG_DIR = path.join(process.cwd(), 'logs', 'speedtraffic');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogFileName() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(LOG_DIR, `speedtraffic_${today}.jsonl`);
}

function appendToLog(logEntry: SpeedTrafficLogEntry) {
  try {
    ensureLogDir();
    const logFile = getLogFileName();
    const logLine = JSON.stringify(logEntry) + '\n';
    
    fs.appendFileSync(logFile, logLine, 'utf-8');
    console.log(`📝 SpeedTraffic 로그 저장됨: ${logEntry.symbol} - ${JSON.stringify(logEntry.traffic_lights)}`);
  } catch (error) {
    console.error('❌ SpeedTraffic 로그 저장 실패:', error);
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

    // 로그 파일에 추가
    appendToLog(logEntry);

    // 콘솔에도 상세 요약 출력 (AI 해석용)
    const techSummary = technical_analysis ?
      `MFI:${technical_analysis.mfi?.value?.toFixed(1) || 'N/A'} RSI:${technical_analysis.rsi?.value?.toFixed(1) || 'N/A'} BB:${technical_analysis.bollinger?.percent_b?.toFixed(2) || 'N/A'}` : 'N/A';
    const marketSummary = market_analysis ?
      `CAPM_β:${market_analysis.capm?.beta?.toFixed(2) || 'N/A'} IND_β:${market_analysis.industry?.beta?.toFixed(2) || 'N/A'}` : 'N/A';
    const riskSummary = risk_analysis ?
      `VOL:${risk_analysis.garch?.volatility?.toFixed(2) || 'N/A'}% VaR95:${risk_analysis.garch?.var_95?.toFixed(2) || 'N/A'}%` : 'N/A';

    console.log(`🚦 [SPEEDTRAFFIC_RESULT] ${symbol} | 신호등: 기술적:${traffic_lights.technical} 업종:${traffic_lights.industry} 시장:${traffic_lights.market} 리스크:${traffic_lights.risk}`);
    console.log(`📊 [SPEEDTRAFFIC_DATA] ${symbol} | 기술적:[${techSummary}] 시장:[${marketSummary}] 리스크:[${riskSummary}]`);

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

// 로그 조회를 위한 헬퍼 함수들 (필요시 사용)
export function getRecentLogs(days: number = 7): SpeedTrafficLogEntry[] {
  try {
    const logs: SpeedTrafficLogEntry[] = [];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const logFile = path.join(LOG_DIR, `speedtraffic_${dateStr}.jsonl`);
      
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            logs.push(JSON.parse(line));
          } catch (parseError) {
            console.warn('로그 파싱 오류:', parseError);
          }
        }
      }
    }
    
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error('로그 조회 오류:', error);
    return [];
  }
}

export function getLogsBySymbol(symbol: string, days: number = 30): SpeedTrafficLogEntry[] {
  const allLogs = getRecentLogs(days);
  return allLogs.filter(log => log.symbol === symbol.toUpperCase());
}
