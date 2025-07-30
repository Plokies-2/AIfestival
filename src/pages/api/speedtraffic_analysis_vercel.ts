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

async function callAnalysisAPI(endpoint: string, symbol: string): Promise<AnalysisResult | undefined> {
  try {
    const response = await fetch(`${API_BASE_URL}/${endpoint}?symbol=${symbol}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`${endpoint} API 호출 실패:`, response.status, response.statusText);
      return undefined;
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`${endpoint} API 호출 오류:`, error);
    return undefined;
  }
}

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

    // 6개 분석 서비스 병렬 호출
    const [mfiResult, bollingerResult, rsiResult, industryResult, capmResult, garchResult] = await Promise.allSettled([
      callAnalysisAPI('mfi_analysis', ticker),
      callAnalysisAPI('bollinger_analysis', ticker),
      callAnalysisAPI('rsi_analysis', ticker),
      callAnalysisAPI('industry_analysis', ticker),
      callAnalysisAPI('capm_analysis', ticker),
      callAnalysisAPI('garch_analysis', ticker)
    ]);

    // 결과 추출
    const results = {
      mfi: mfiResult.status === 'fulfilled' ? mfiResult.value : undefined,
      bollinger: bollingerResult.status === 'fulfilled' ? bollingerResult.value : undefined,
      rsi: rsiResult.status === 'fulfilled' ? rsiResult.value : undefined,
      industry: industryResult.status === 'fulfilled' ? industryResult.value : undefined,
      capm: capmResult.status === 'fulfilled' ? capmResult.value : undefined,
      garch: garchResult.status === 'fulfilled' ? garchResult.value : undefined,
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
