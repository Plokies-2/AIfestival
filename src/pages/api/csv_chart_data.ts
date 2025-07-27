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
    console.warn(`⚠️ Realtime API failed, falling back to CSV for ${symbol}:`, realtimeError);

    try {
      // 실시간 API 실패 시 기존 CSV 로직으로 폴백
      const fs = require('fs');
      const path = require('path');

      // CSV 파일 경로
      const csvPath = path.join(process.cwd(), 'src', 'data', 'sp500_adj_close_3y.csv');

      // CSV 파일 읽기
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.split('\n');

      if (lines.length < 2) {
        return res.status(500).json({ error: 'CSV 파일이 비어있습니다.' });
      }

      // 헤더 파싱 (첫 번째 줄)
      const headers = lines[0].split(',');
      const symbolIndex = headers.findIndex(header => header.trim() === symbol.toUpperCase());

      if (symbolIndex === -1) {
        return res.status(404).json({ error: `심볼 ${symbol}을 찾을 수 없습니다.` });
      }

      // 데이터 파싱
      const chartData: ChartDataPoint[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',');
        const date = values[0];
        const priceStr = values[symbolIndex];

        if (date && priceStr && priceStr !== '') {
          const price = parseFloat(priceStr);
          if (!isNaN(price) && price > 0) {
            chartData.push({
              time: date,
              value: price
            });
          }
        }
      }

      if (chartData.length === 0) {
        return res.status(404).json({ error: `${symbol}에 대한 유효한 데이터가 없습니다.` });
      }

      // 날짜순 정렬 (오래된 것부터)
      chartData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      console.log(`📊 CSV fallback successful for ${symbol}, ${chartData.length} data points`);
      return res.status(200).json({
        data: chartData,
        symbol: symbol.toUpperCase()
      });

    } catch (csvError) {
      console.error('CSV chart data error:', csvError);
      return res.status(500).json({
        error: '차트 데이터를 불러오는 중 오류가 발생했습니다.'
      });
    }
  }
}
