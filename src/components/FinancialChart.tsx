'use client';

import React, { useEffect, useRef, memo, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts';

interface FinancialChartProps {
  symbol?: string;
  isMinimized?: boolean; // 최소화 상태 여부
  isExpanded?: boolean; // 확장 상태 여부
  onToggleExpand?: () => void; // 확장/축소 토글 콜백
}

const FinancialChart: React.FC<FinancialChartProps> = memo(({ symbol, isMinimized, isExpanded, onToggleExpand }) => {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSymbol, setCurrentSymbol] = useState<string | null>(null);
  const [isChartInitialized, setIsChartInitialized] = useState(false);







  // ESC 키로 확장 모드 종료
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        onToggleExpand?.();
      }
    };

    if (isExpanded) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isExpanded, onToggleExpand]);



  // 확장 상태 변경 시 차트 크기만 조정 (재생성 방지로 채팅 상태 보존)
  useEffect(() => {
    // 차트가 초기화되지 않았거나 차트 인스턴스가 없으면 무시
    if (!isChartInitialized || !chartRef.current) {
      return;
    }

    console.log('🔄 Chart expand state changed:', { isExpanded, hasChart: !!chartRef.current });

    try {
      // 확장 상태에 따른 새로운 높이 계산
      const newHeight = isExpanded ? Math.max(window.innerHeight - 150, 400) : 400;
      console.log('📏 Resizing chart to height:', newHeight);

      // 차트 크기만 변경 (재생성하지 않음으로써 채팅 상태 보존)
      chartRef.current.applyOptions({ height: newHeight });

      // 차트 내용을 새로운 크기에 맞게 조정
      chartRef.current.timeScale().fitContent();

      console.log('✅ Chart resize completed successfully');
    } catch (error) {
      console.error('❌ Chart resize failed:', error);
    }
  }, [isExpanded, isChartInitialized]);

  // 차트 초기화 - 한 번만 생성하고 유지
  useEffect(() => {
    if (isChartInitialized || !ref.current) {
      return;
    }

    // 이미 차트가 있으면 스킵 (재생성 방지)
    if (chartRef.current && seriesRef.current) {
      setIsChartInitialized(true);
      return;
    }

    // 기존 차트가 있으면 제거 후 새로 생성
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    try {
      // 초기 차트 높이 설정
      const initialHeight = isExpanded ? Math.max(window.innerHeight - 150, 400) : 400;

      // 새로운 차트 생성
      chartRef.current = createChart(ref.current, {
        height: initialHeight,
        layout: {
          background: { color: '#ffffff' },
          textColor: '#333',
        },
        grid: {
          vertLines: { color: '#f0f0f0' },
          horzLines: { color: '#f0f0f0' },
        },
        timeScale: {
          borderColor: '#cccccc',
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: '#cccccc',
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        watermark: {
          visible: false,
        },
        crosshair: {
          mode: 1,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });

      // 라인 시리즈 추가
      seriesRef.current = chartRef.current.addLineSeries({
        color: '#2563eb',
        lineWidth: 2,
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        lastValueVisible: true,
        priceLineVisible: true,
      });

      setIsChartInitialized(true);

      // 윈도우 리사이즈 이벤트 리스너 추가
      const handleResize = () => {
        if (chartRef.current) {
          const newHeight = isExpanded ? Math.max(window.innerHeight - 150, 400) : 400;
          chartRef.current.applyOptions({ height: newHeight });
          chartRef.current.timeScale().fitContent();
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    } catch (error) {
      console.error('Chart initialization failed:', error);
    }
  }, []); // 한 번만 실행

  // 심볼이 실제로 변경될 때만 데이터 로드
  useEffect(() => {
    if (!symbol || !seriesRef.current || !chartRef.current) {
      return;
    }

    // 같은 심볼이면 데이터 로드 스킵
    if (symbol === currentSymbol) {
      return;
    }

    const loadChartData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 실시간 데이터 API 호출 (캐싱 지원)
        const res = await fetch(`/api/realtime_chart_data?symbol=${symbol}`);
        const data = await res.json();

        if (data.error) {
          setError(data.error);
          return;
        }

        // 데이터를 lightweight-charts 형식으로 변환
        const chartData = data.data.map((point: any) => ({
          time: point.time,
          value: point.value,
        }));

        // 시리즈에 데이터 설정
        seriesRef.current?.setData(chartData);

        // 차트를 데이터에 맞게 조정
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }

        // 현재 심볼 업데이트
        setCurrentSymbol(symbol);
      } catch (error) {
        console.error('Failed to load chart data:', error);
        setError('실시간 차트 데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    // 약간의 지연을 두고 데이터 로드 (차트 초기화 완료 후)
    const timer = setTimeout(loadChartData, 200);
    return () => {
      clearTimeout(timer);
    };
  }, [symbol]);

  return (
    <div className="w-full h-full flex flex-col">
      {symbol ? (
        <>
          {/* 차트 헤더 */}
          <div className="px-4 py-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {symbol} 주가 차트 {isExpanded && '(확장 모드)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isExpanded ? 'ESC 키로 닫기' : '실시간 차트'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* 상태 표시 */}
                <div className="flex items-center space-x-1">
                  {isLoading ? (
                    <div className="flex items-center space-x-1 text-amber-600">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                      <span className="text-xs font-medium">로딩중</span>
                    </div>
                  ) : error ? (
                    <div className="flex items-center space-x-1 text-red-600">
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      <span className="text-xs font-medium">오류</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-green-600">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-xs font-medium">실시간</span>
                    </div>
                  )}
                </div>

                {/* 확장/축소 버튼 */}
                {symbol && onToggleExpand && (
                  <button
                    onClick={onToggleExpand}
                    className="px-2 py-1 text-xs bg-slate-500 hover:bg-slate-600 text-white rounded-md transition-colors duration-200 flex items-center space-x-1"
                    title={isExpanded ? "차트 축소" : "차트 확장"}
                  >
                    {isExpanded ? (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" />
                        </svg>
                        <span>축소</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <span>확장</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-red-700">{error}</span>
                </div>
              </div>
            )}
          </div>

          {/* 차트 영역 - 최소화 상태에서는 숨김 */}
          {!isMinimized && (
            <div className="flex-1 min-h-0 relative bg-white">
              <div ref={ref} className="absolute inset-0 w-full h-full" />

              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm">
                  <div className="text-center p-8">
                    <div className="relative">
                      <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                      <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-purple-500 rounded-full animate-spin mx-auto" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
                    </div>
                    <h4 className="text-lg font-medium text-slate-900 mb-2">차트 데이터 로딩 중</h4>
                    <p className="text-sm text-slate-500">최신 시장 정보를 가져오는 중...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : isMinimized ? (
        <div className="flex items-center h-full bg-gradient-to-r from-slate-50 to-white px-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold text-slate-900">포트폴리오 생성 중</h3>
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-white">
          <div className="text-center p-12 max-w-md">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">분석 준비 완료</h3>
            <p className="text-slate-600 mb-4 leading-relaxed">
              아래 AI 어시스턴트를 통해 관심 있는 기업이나 산업을 검색해보세요.
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-slate-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>실시간 시장 데이터 기반</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default FinancialChart;
