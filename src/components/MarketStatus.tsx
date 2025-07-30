'use client';

import React, { useState, useEffect } from 'react';

interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  lastUpdate: string;
}

interface MarketStatusProps {
  className?: string;
}

const MarketStatus: React.FC<MarketStatusProps> = ({ className = '' }) => {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [lastRefresh, setLastRefresh] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 한국 시장 관련 심볼들
  const symbols = [
    { symbol: '^KS11', name: '코스피' },
    { symbol: 'KRW=X', name: '원/달러' },
    { symbol: '^VIX', name: 'VIX' },
    { symbol: '^TNX', name: '미국 10년 국채' }
  ];

  const fetchMarketData = async () => {
    try {
      setError(null);
      const promises = symbols.map(async ({ symbol, name }) => {
        try {
          // Yahoo Finance API 호출 (실제로는 백엔드 API를 통해 호출해야 함)
          const response = await fetch(`/api/market_data?symbol=${symbol}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${symbol}`);
          }
          const data = await response.json();
          
          return {
            symbol,
            name,
            price: data.price || 0,
            change: data.change || 0,
            changePercent: data.changePercent || 0,
            lastUpdate: new Date().toISOString()
          };
        } catch (error) {
          console.warn(`Failed to fetch data for ${symbol}:`, error);
          return {
            symbol,
            name,
            price: 0,
            change: 0,
            changePercent: 0,
            lastUpdate: new Date().toISOString()
          };
        }
      });

      const results = await Promise.all(promises);
      setMarketData(results);
      setLastRefresh(new Date().toLocaleTimeString('ko-KR'));
      setIsLoading(false);
    } catch (error) {
      console.error('시장 데이터 가져오기 실패:', error);
      setError('시장 데이터를 가져올 수 없습니다');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 초기 데이터 로드
    fetchMarketData();

    // 20초마다 데이터 업데이트
    const interval = setInterval(fetchMarketData, 20000);

    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number, symbol: string) => {
    if (symbol === 'KRW=X') {
      return `₩${price.toFixed(2)}`;
    } else if (symbol === '^TNX') {
      return `${price.toFixed(2)}%`;
    } else {
      return price.toLocaleString('ko-KR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
    }
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-red-600'; // 한국 시장에서는 상승이 빨간색
    if (change < 0) return 'text-blue-600'; // 하락이 파란색
    return 'text-gray-600';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return '▲';
    if (change < 0) return '▼';
    return '─';
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">시장 현황</h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
            <span className="text-gray-500 text-sm">로딩 중...</span>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded w-16"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">시장 현황</h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-red-600 text-sm">오류</span>
          </div>
        </div>
        <p className="text-sm text-gray-500">{error}</p>
        <button 
          onClick={fetchMarketData}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">시장 현황</h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-green-600 text-sm font-medium">LIVE</span>
        </div>
      </div>

      <div className="space-y-3">
        {marketData.map((item) => (
          <div key={item.symbol} className="flex justify-between items-center">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">{item.name}</div>
              <div className="text-xs text-gray-500">{item.symbol}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">
                {formatPrice(item.price, item.symbol)}
              </div>
              <div className={`text-xs flex items-center justify-end space-x-1 ${getChangeColor(item.change)}`}>
                <span>{getChangeIcon(item.change)}</span>
                <span>{Math.abs(item.change).toFixed(2)}</span>
                <span>({Math.abs(item.changePercent).toFixed(2)}%)</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-500 text-center">
          마지막 업데이트: {lastRefresh}
        </div>
      </div>
    </div>
  );
};

export default MarketStatus;
