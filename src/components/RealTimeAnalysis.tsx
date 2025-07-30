'use client';

import React, { useState, useEffect } from 'react';

interface MarketData {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  lastUpdate: string;
}

const RealTimeAnalysis: React.FC = () => {
  const [marketData, setMarketData] = useState<MarketData[]>([
    {
      symbol: '^KS11',
      name: 'KOSPI',
      value: 2650.45,
      change: 12.34,
      changePercent: 0.47,
      lastUpdate: new Date().toLocaleTimeString('ko-KR')
    },
    {
      symbol: '^KQ11',
      name: '한국 VIX',
      value: 18.23,
      change: -0.45,
      changePercent: -2.41,
      lastUpdate: new Date().toLocaleTimeString('ko-KR')
    },
    {
      symbol: 'KRW=X',
      name: '원/달러',
      value: 1342.50,
      change: 5.20,
      changePercent: 0.39,
      lastUpdate: new Date().toLocaleTimeString('ko-KR')
    },
    {
      symbol: '^TNX',
      name: '미국 10년 국채',
      value: 4.25,
      change: 0.03,
      changePercent: 0.71,
      lastUpdate: new Date().toLocaleTimeString('ko-KR')
    }
  ]);

  const [isLoading, setIsLoading] = useState(false);

  // 실시간 시장 데이터 가져오기
  const fetchMarketData = async () => {
    try {
      setIsLoading(true);

      // 각 심볼별로 개별 API 호출
      const symbols = ['^KS11', '^KQ11', 'KRW=X', '^TNX'];
      const promises = symbols.map(async (symbol) => {
        try {
          const response = await fetch(`/api/market_data?symbol=${encodeURIComponent(symbol)}`);
          const result = await response.json();

          if (response.ok) {
            return {
              symbol: result.symbol,
              name: getSymbolName(result.symbol),
              value: result.price || 0,
              change: result.change || 0,
              changePercent: result.changePercent || 0,
              lastUpdate: new Date().toLocaleTimeString('ko-KR')
            };
          } else {
            console.error(`${symbol} 데이터 가져오기 실패:`, result.error);
            return null;
          }
        } catch (error) {
          console.error(`${symbol} API 호출 오류:`, error);
          return null;
        }
      });

      const results = await Promise.all(promises);
      const validResults = results.filter(result => result !== null) as MarketData[];

      if (validResults.length > 0) {
        setMarketData(validResults);
      }
    } catch (error) {
      console.error('시장 데이터 API 호출 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 심볼에 따른 한국어 이름 반환
  const getSymbolName = (symbol: string): string => {
    const nameMap: { [key: string]: string } = {
      '^KS11': 'KOSPI',
      '^KQ11': '한국 VIX',
      'KRW=X': '원/달러',
      '^TNX': '미국 10년 국채'
    };
    return nameMap[symbol] || symbol;
  };

  // 컴포넌트 마운트 시 초기 데이터 로드
  useEffect(() => {
    fetchMarketData();
  }, []);

  // 30초마다 데이터 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMarketData();
    }, 30000); // 30초마다 업데이트

    return () => clearInterval(interval);
  }, []);

  const formatValue = (value: number, symbol: string) => {
    if (symbol === '^KS11' || symbol === '^KQ11') {
      return value.toFixed(2);
    } else if (symbol === 'KRW=X') {
      return value.toFixed(2);
    } else {
      return value.toFixed(3);
    }
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-red-600';
    if (change < 0) return 'text-blue-600';
    return 'text-gray-600';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return '▲';
    if (change < 0) return '▼';
    return '─';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">실시간 시장 분석</h3>
        <div className="flex items-center space-x-2">
          {isLoading ? (
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
          ) : (
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          )}
          <span className="text-xs text-gray-500">30초 간격 업데이트</span>
        </div>
      </div>

      <div className="space-y-3">
        {marketData.map((item, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="font-medium text-gray-900 text-sm">{item.name}</div>
              <div className="text-xs text-gray-500">{item.lastUpdate}</div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-900">
                {formatValue(item.value, item.symbol)}
              </div>
              
              <div className={`text-sm font-medium ${getChangeColor(item.change)}`}>
                {getChangeIcon(item.change)} {Math.abs(item.change).toFixed(2)} 
                ({item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(2)}%)
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        * yfinance API를 통한 실시간 시장 데이터
      </div>
    </div>
  );
};

export default RealTimeAnalysis;
