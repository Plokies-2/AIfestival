// src/pages/api/market_data.ts
import { NextApiRequest, NextApiResponse } from 'next';

interface MarketData {
  symbol: string;
  label: string;
  price: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'neutral';
}

// 시장 지표 심볼 매핑
const MARKET_SYMBOLS = {
  '^GSPC': 'S&P 500',      // S&P 500
  '^IXIC': '나스닥',        // NASDAQ
  '^DJI': '다우존스',       // Dow Jones
  '^VIX': 'VIX',           // VIX
  'KRW=X': '달러/원'        // USD/KRW
};

// yfinance 데이터를 가져오는 함수
async function fetchYahooFinanceData(symbol: string): Promise<any> {
  try {
    // Yahoo Finance API 사용 (무료 버전)
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    return null;
  }
}

// 시장 데이터 파싱 함수
function parseMarketData(symbol: string, data: any): MarketData | null {
  try {
    if (!data?.chart?.result?.[0]) {
      return null;
    }

    const result = data.chart.result[0];
    const meta = result.meta;
    
    const currentPrice = meta.regularMarketPrice || meta.previousClose;
    const previousClose = meta.previousClose;
    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;

    return {
      symbol,
      label: MARKET_SYMBOLS[symbol as keyof typeof MARKET_SYMBOLS] || symbol,
      price: currentPrice,
      change,
      changePercent,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    };
  } catch (error) {
    console.error(`Error parsing data for ${symbol}:`, error);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const symbols = Object.keys(MARKET_SYMBOLS);
    const marketData: MarketData[] = [];

    // 모든 심볼에 대해 데이터 가져오기
    const promises = symbols.map(async (symbol) => {
      const data = await fetchYahooFinanceData(symbol);
      if (data) {
        const parsed = parseMarketData(symbol, data);
        if (parsed) {
          marketData.push(parsed);
        }
      }
    });

    await Promise.all(promises);

    // 데이터가 없으면 fallback 데이터 사용
    if (marketData.length === 0) {
      console.log('No market data available, using fallback data');
      return res.status(200).json({
        success: true,
        data: [
          { symbol: '^GSPC', label: 'S&P 500', price: 4567.89, change: 12.34, changePercent: 0.27, trend: 'up' },
          { symbol: '^IXIC', label: '나스닥', price: 14234.56, change: -45.67, changePercent: -0.32, trend: 'down' },
          { symbol: '^DJI', label: '다우존스', price: 34567.12, change: 89.45, changePercent: 0.26, trend: 'up' },
          { symbol: '^VIX', label: 'VIX', price: 18.45, change: -1.23, changePercent: -6.25, trend: 'down' },
          { symbol: 'KRW=X', label: '달러/원', price: 1327.50, change: 5.25, changePercent: 0.40, trend: 'up' }
        ],
        timestamp: new Date().toISOString(),
        source: 'fallback'
      });
    }

    res.status(200).json({
      success: true,
      data: marketData,
      timestamp: new Date().toISOString(),
      source: 'yahoo_finance'
    });

  } catch (error) {
    console.error('Market data API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch market data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
