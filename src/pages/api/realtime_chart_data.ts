// src/pages/api/realtime_chart_data.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

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

interface CacheData {
  data: ChartDataPoint[];
  timestamp: number;
  symbol: string;
}

// 캐시 설정
const CACHE_DURATION = 60 * 60 * 1000; // 1시간 (밀리초)
const CACHE_DIR = path.join(process.cwd(), '.cache', 'chart_data');

/**
 * 캐시 디렉토리 생성
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * 캐시에서 데이터 읽기
 */
function getCachedData(symbol: string): CacheData | null {
  try {
    ensureCacheDir();
    const cacheFile = path.join(CACHE_DIR, `${symbol.toUpperCase()}.json`);
    
    if (!fs.existsSync(cacheFile)) {
      return null;
    }
    
    const cacheContent = fs.readFileSync(cacheFile, 'utf-8');
    const cacheData: CacheData = JSON.parse(cacheContent);
    
    // 캐시 만료 확인
    const now = Date.now();
    if (now - cacheData.timestamp > CACHE_DURATION) {
      console.log(`📅 Cache expired for ${symbol}, age: ${Math.round((now - cacheData.timestamp) / 1000 / 60)} minutes`);
      return null;
    }
    
    console.log(`💾 Using cached data for ${symbol}, age: ${Math.round((now - cacheData.timestamp) / 1000 / 60)} minutes`);
    return cacheData;
  } catch (error) {
    console.error(`❌ Error reading cache for ${symbol}:`, error);
    return null;
  }
}

/**
 * 캐시에 데이터 저장
 */
function setCachedData(symbol: string, data: ChartDataPoint[]) {
  try {
    ensureCacheDir();
    const cacheFile = path.join(CACHE_DIR, `${symbol.toUpperCase()}.json`);
    
    const cacheData: CacheData = {
      data,
      timestamp: Date.now(),
      symbol: symbol.toUpperCase()
    };
    
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
    console.log(`💾 Cached data for ${symbol}, ${data.length} data points`);
  } catch (error) {
    console.error(`❌ Error writing cache for ${symbol}:`, error);
  }
}

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

  const symbolUpper = symbol.toUpperCase();
  const forceRefresh = force_refresh === 'true';

  try {
    let chartData: ChartDataPoint[] | null = null;
    let source: 'cache' | 'yfinance' = 'cache';

    // 강제 새로고침이 아닌 경우 캐시 확인
    if (!forceRefresh) {
      const cachedData = getCachedData(symbolUpper);
      if (cachedData) {
        chartData = cachedData.data;
        source = 'cache';
      }
    }

    // 캐시에 데이터가 없거나 강제 새로고침인 경우 실시간 데이터 가져오기
    if (!chartData) {
      chartData = await fetchRealtimeData(symbolUpper);
      source = 'yfinance';
      
      // 데이터를 성공적으로 가져온 경우 캐시에 저장
      if (chartData) {
        setCachedData(symbolUpper, chartData);
      }
    }

    if (!chartData || chartData.length === 0) {
      return res.status(404).json({ error: `${symbolUpper}에 대한 데이터를 찾을 수 없습니다.` });
    }

    // 날짜순 정렬 (오래된 것부터)
    chartData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return res.status(200).json({
      data: chartData,
      symbol: symbolUpper,
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
