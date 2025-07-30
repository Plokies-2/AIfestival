import { NextApiRequest, NextApiResponse } from 'next';

interface AnalysisResult {
  symbol: string;
  date: string;
  traffic_light: string;
  [key: string]: any;
}

interface SpeedTrafficResponse {
  symbol: string;
  timestamp: string;
  mfi?: AnalysisResult;
  bollinger?: AnalysisResult;
  rsi?: AnalysisResult;
  industry?: AnalysisResult;
  capm?: AnalysisResult;
  garch?: AnalysisResult;
  traffic_lights: {
    technical?: string;
    industry?: string;
    market?: string;
    risk?: string;
  };
}

// API 엔드포인트 URL들 (Vercel 배포 후 실제 URL로 변경 필요)
const API_BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}/api`
  : 'http://localhost:3000/api';



function determineTrafficLights(results: {
  mfi?: AnalysisResult | undefined;
  bollinger?: AnalysisResult | undefined;
  rsi?: AnalysisResult | undefined;
  industry?: AnalysisResult | undefined;
  capm?: AnalysisResult | undefined;
  garch?: AnalysisResult | undefined;
}) {
  const lights = {
    technical: 'inactive' as string,
    industry: 'inactive' as string,
    market: 'inactive' as string,
    risk: 'inactive' as string,
  };

  // 기술적 분석 (MFI, Bollinger, RSI 종합)
  const technicalSignals = [
    results.mfi?.traffic_light,
    results.bollinger?.traffic_light,
    results.rsi?.traffic_light
  ].filter(Boolean);

  if (technicalSignals.length > 0) {
    const greenCount = technicalSignals.filter(s => s === 'green').length;
    const redCount = technicalSignals.filter(s => s === 'red').length;
    
    if (greenCount > redCount) {
      lights.technical = 'green';
    } else if (redCount > greenCount) {
      lights.technical = 'red';
    } else {
      lights.technical = 'yellow';
    }
  }

  // 업종 분석
  if (results.industry?.traffic_light) {
    lights.industry = results.industry.traffic_light;
  }

  // 시장 분석 (CAPM)
  if (results.capm?.traffic_light) {
    lights.market = results.capm.traffic_light;
  }

  // 리스크 분석 (GARCH)
  if (results.garch?.traffic_light) {
    lights.risk = results.garch.traffic_light;
  }

  return lights;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Symbol parameter is required' });
  }

  const ticker = symbol.toUpperCase();

  try {
    console.log(`[SPEEDTRAFFIC_VERCEL] ${ticker} 분석 시작`);

    // 통합 분석 API 호출
    const apiResponse = await fetch(`${API_BASE_URL}/unified_analysis?symbol=${ticker}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!apiResponse.ok) {
      throw new Error(`Unified analysis API 호출 실패: ${apiResponse.status} ${apiResponse.statusText}`);
    }

    const analysisResult = await apiResponse.json();

    // 결과 추출 (기존 형식과 호환)
    const results = {
      mfi: analysisResult.mfi,
      bollinger: analysisResult.bollinger,
      rsi: analysisResult.rsi,
      industry: analysisResult.industry,
      capm: analysisResult.capm,
      garch: analysisResult.garch,
    };

    // 신호등 결정
    const trafficLights = determineTrafficLights(results);

    // 최종 응답 구성
    const response: SpeedTrafficResponse = {
      symbol: ticker,
      timestamp: new Date().toISOString(),
      ...results,
      traffic_lights: trafficLights
    };

    console.log(`[SPEEDTRAFFIC_VERCEL] ${ticker} 분석 완료`);
    
    res.status(200).json(response);

  } catch (error) {
    console.error(`[SPEEDTRAFFIC_VERCEL] ${ticker} 분석 오류:`, error);
    
    res.status(500).json({
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      symbol: ticker,
      timestamp: new Date().toISOString()
    });
  }
}
