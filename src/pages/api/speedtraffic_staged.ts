import { NextApiRequest, NextApiResponse } from 'next';

// SpeedTraffic 단계별 실행 API
// 6개 분석 서비스만 실행 (RSI, MFI, Bollinger, CAPM, GARCH, Industry)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol, stage } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  // stage 파라미터는 호환성을 위해 유지하지만 실제로는 phase1만 실행
  const ticker = symbol.toUpperCase();

  try {
    // 새로운 speedtraffic_analysis API 호출
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/speedtraffic_analysis?symbol=${ticker}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    // 기존 형식과 호환되도록 phase 정보 추가
    const compatibleResult = {
      ...result,
      phase: stage === 'phase2' ? 2 : 1
    };

    res.status(200).json(compatibleResult);

  } catch (error) {
    console.error(`[SPEEDTRAFFIC_STAGED] ${ticker} 오류 (stage: ${stage}):`, error);
    res.status(500).json({
      error: '내부 서버 오류',
      details: error instanceof Error ? error.message : String(error),
      stage: stage,
      timestamp: new Date().toISOString()
    });
  }
}
