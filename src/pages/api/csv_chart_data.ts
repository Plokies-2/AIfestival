// src/pages/api/csv_chart_data.ts
// 🚨 DEPRECATED: 이 API는 더 이상 사용되지 않습니다.
// 실시간 데이터를 위해 /api/realtime_chart_data를 사용하세요.
import type { NextApiRequest, NextApiResponse } from 'next';

interface ChartDataPoint {
  time: string;
  value: number;
}

interface ChartResponse {
  data: ChartDataPoint[];
  symbol: string;
  companyName?: string;
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChartResponse | ErrorResponse>
) {
  const { symbol } = req.query;

  if (!symbol || Array.isArray(symbol)) {
    return res.status(400).json({ error: 'symbol 파라미터가 필요합니다.' });
  }

  // 🔄 실시간 데이터 API로 리다이렉트
  console.log(`🔄 Redirecting CSV request for ${symbol} to realtime API`);

  try {
    // 실시간 데이터 API 호출
    const realtimeUrl = `${req.headers.host}/api/realtime_chart_data?symbol=${symbol}`;
    const response = await fetch(`http://${realtimeUrl}`);

    if (!response.ok) {
      throw new Error(`Realtime API failed: ${response.status}`);
    }

    const realtimeData = await response.json();

    // 기존 형식으로 변환하여 호환성 유지
    return res.status(200).json({
      data: realtimeData.data,
      symbol: realtimeData.symbol,
      companyName: realtimeData.companyName
    });

  } catch (realtimeError) {
    console.error(`❌ Realtime API failed for ${symbol}:`, realtimeError);
    return res.status(500).json({
      error: '실시간 차트 데이터를 불러오는 중 오류가 발생했습니다. CSV 파일은 더 이상 지원되지 않습니다.'
    });
  }
}
