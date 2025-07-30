// src/pages/api/realtime_chart_data.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getTickerFromCompanyName, getYahooFinanceTicker, getCompanyName } from '../../utils/companyLookup';

interface ChartDataPoint {
  time: string;
  value: number; // close 가격 (기존 호환성 유지)
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

interface ChartResponse {
  data: ChartDataPoint[];
  symbol: string;
  companyName?: string;
  lastUpdate: string;
  source: 'cache' | 'yfinance';
}

interface ErrorResponse {
  error: string;
}

// 캐시 관련 코드 제거됨 - 실시간 데이터만 사용

// 캐시 관련 함수들 제거됨 - 실시간 데이터만 사용

/**
 * Yahoo Finance API를 사용하여 실시간 데이터 가져오기 (Node.js 기반)
 */
async function fetchRealtimeData(symbol: string): Promise<ChartDataPoint[] | null> {
  try {
    console.log(`🔄 Fetching realtime data for ${symbol} from Yahoo Finance API...`);

    // Yahoo Finance API 호출
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (3 * 365 * 24 * 60 * 60); // 3년 전

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`❌ Yahoo Finance API failed for ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      console.error(`❌ No data found for ${symbol}`);
      return null;
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];

    // Yahoo Finance API에서 제공하는 모든 가격 데이터 추출
    const closes = quote.close;
    const opens = quote.open;
    const highs = quote.high;
    const lows = quote.low;
    const volumes = quote.volume;

    if (!timestamps || !closes) {
      console.error(`❌ Invalid data structure for ${symbol}`);
      return null;
    }

    // 데이터 포맷팅 - SpeedTraffic 등을 위한 풍부한 데이터 제공
    const chartData: ChartDataPoint[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      const close = closes[i];
      const open = opens?.[i];
      const high = highs?.[i];
      const low = lows?.[i];
      const volume = volumes?.[i];

      if (timestamp && close !== null && close !== undefined) {
        const date = new Date(timestamp * 1000);
        const dataPoint: ChartDataPoint = {
          time: date.toISOString().split('T')[0], // YYYY-MM-DD 형식
          value: Math.round(close * 100) / 100 // 소수점 2자리 (기존 호환성 유지)
        };

        // 추가 데이터가 있으면 포함 (SpeedTraffic 분석용)
        if (open !== null && open !== undefined) {
          dataPoint.open = Math.round(open * 100) / 100;
        }
        if (high !== null && high !== undefined) {
          dataPoint.high = Math.round(high * 100) / 100;
        }
        if (low !== null && low !== undefined) {
          dataPoint.low = Math.round(low * 100) / 100;
        }
        if (volume !== null && volume !== undefined) {
          dataPoint.volume = volume;
        }

        chartData.push(dataPoint);
      }
    }

    console.log(`✅ Fetched ${chartData.length} data points for ${symbol} from Yahoo Finance (with OHLCV data)`);
    return chartData;

  } catch (error) {
    console.error(`❌ Error fetching realtime data for ${symbol}:`, error);
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChartResponse | ErrorResponse>
) {
  const { symbol, force_refresh } = req.query;

  if (!symbol || Array.isArray(symbol)) {
    return res.status(400).json({ error: 'symbol 파라미터가 필요합니다.' });
  }

  // 회사명을 티커로 변환 (예: "삼성전자" -> "005930")
  const convertedTicker = getTickerFromCompanyName(symbol);
  const ticker = convertedTicker.toUpperCase();
  const companyName = getCompanyName(ticker);

  // Yahoo Finance 형식으로 변환 (예: "005930" -> "005930.KS")
  const yahooSymbol = getYahooFinanceTicker(ticker);
  const forceRefresh = force_refresh === 'true';

  console.log(`[REALTIME_CHART] 입력: "${symbol}" -> 티커: "${ticker}" -> Yahoo: "${yahooSymbol}" -> 회사명: "${companyName}"`);

  try {
    // 캐시 로직 제거 - 항상 실시간 데이터 사용
    console.log(`🔄 Fetching realtime data for ${ticker}...`);
    const chartData = await fetchRealtimeData(yahooSymbol);
    const source = 'yfinance';

    if (!chartData || chartData.length === 0) {
      return res.status(404).json({ error: `${companyName} (${ticker})에 대한 데이터를 찾을 수 없습니다.` });
    }

    // 날짜순 정렬 (오래된 것부터)
    chartData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return res.status(200).json({
      data: chartData,
      symbol: ticker,
      companyName: companyName,
      lastUpdate: new Date().toISOString(),
      source
    });

  } catch (error) {
    console.error('Realtime chart data error:', error);
    return res.status(500).json({ 
      error: '실시간 차트 데이터를 불러오는 중 오류가 발생했습니다.' 
    });
  }
}
