import { NextApiRequest, NextApiResponse } from 'next';

// 시장 데이터를 가져오는 API
// yfinance 대신 Yahoo Finance API를 직접 호출

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Symbol parameter is required' });
  }

  try {
    // Yahoo Finance API 호출
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
    
    const response = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error('No data available for this symbol');
    }

    const result = data.chart.result[0];
    const meta = result.meta;
    
    // 현재 가격과 변화량 계산
    const currentPrice = meta.regularMarketPrice || meta.previousClose || 0;
    const previousClose = meta.previousClose || 0;
    const change = currentPrice - previousClose;
    const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;

    console.log(`📊 [MARKET_DATA] ${symbol}: ${currentPrice} (${change >= 0 ? '+' : ''}${change.toFixed(2)}, ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`);

    return res.status(200).json({
      symbol,
      price: currentPrice,
      change,
      changePercent,
      previousClose,
      timestamp: new Date().toISOString(),
      currency: meta.currency || 'USD',
      exchangeName: meta.exchangeName || 'Unknown'
    });

  } catch (error) {
    console.error(`❌ [MARKET_DATA] ${symbol} 데이터 가져오기 실패:`, error);
    
    // 폴백 데이터 (실제 서비스에서는 캐시된 데이터나 다른 소스 사용)
    const fallbackData = {
      '^KS11': { price: 2500.00, change: 15.50, changePercent: 0.62 },
      'KRW=X': { price: 1320.50, change: -2.30, changePercent: -0.17 },
      '^VIX': { price: 15.25, change: 0.45, changePercent: 3.04 },
      '^TNX': { price: 4.25, change: -0.05, changePercent: -1.16 }
    };

    const fallback = fallbackData[symbol as keyof typeof fallbackData];
    
    if (fallback) {
      console.log(`📊 [MARKET_DATA] ${symbol}: 폴백 데이터 사용`);
      return res.status(200).json({
        symbol,
        price: fallback.price,
        change: fallback.change,
        changePercent: fallback.changePercent,
        timestamp: new Date().toISOString(),
        fallback: true
      });
    }

    return res.status(500).json({ 
      error: 'Failed to fetch market data',
      symbol,
      timestamp: new Date().toISOString()
    });
  }
}
