'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FinancialChart from '@/components/FinancialChart';
import { getCompanyName } from '@/utils/companyLookup';

export default function SpeedTrafficPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentSymbol, setCurrentSymbol] = useState<string | undefined>(undefined);
  const [chatMessages, setChatMessages] = useState<Array<{message: string, isBot: boolean, timestamp: Date}>>([]);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 분석 중복 방지
  const inFlight = useRef(false);
  const processedSymbols = useRef(new Set<string>());

  // 신호등 상태 관리 (4중 분석)
  const [trafficLights, setTrafficLights] = useState({
    technical: 'inactive' as 'inactive' | 'red' | 'yellow' | 'green',
    industry: 'inactive' as 'inactive' | 'red' | 'yellow' | 'green',
    market: 'inactive' as 'inactive' | 'red' | 'yellow' | 'green',
    risk: 'inactive' as 'inactive' | 'red' | 'yellow' | 'green'
  });

  // URL에서 symbol 파라미터 읽기
  useEffect(() => {
    if (!searchParams) return;
    const symbol = searchParams.get('symbol');
    if (symbol) {
      setCurrentSymbol(symbol);
    }
  }, [searchParams]);

  // 채팅 메시지 추가 (메모이제이션으로 무한 루프 방지)
  const handleChatMessage = useCallback((message: string, isBot: boolean = true) => {
    setChatMessages(prev => [...prev, {
      message,
      isBot,
      timestamp: new Date()
    }]);
  }, []);

  // 분석 완료 처리 (메모이제이션으로 무한 루프 방지)
  const handleAnalysisComplete = useCallback((results: any) => {
    setIsAnalysisComplete(true);
    setAnalysisResults(results);

    // 신호등 상태 업데이트
    if (results.traffic_lights) {
      setTrafficLights({
        technical: results.traffic_lights.technical || 'inactive',
        industry: results.traffic_lights.industry || 'inactive',
        market: results.traffic_lights.market || 'inactive',
        risk: results.traffic_lights.risk || 'inactive'
      });
    }

    // 분석 결과를 로컬 스토리지에 저장
    const savedResults = {
      ...results,
      savedAt: new Date().toISOString(),
      id: `analysis_${results.symbol}_${Date.now()}`
    };

    try {
      const existingResults = JSON.parse(localStorage.getItem('speedtraffic_results') || '[]');
      existingResults.push(savedResults);
      // 최근 10개만 유지
      if (existingResults.length > 10) {
        existingResults.splice(0, existingResults.length - 10);
      }
      localStorage.setItem('speedtraffic_results', JSON.stringify(existingResults));
      console.log('📊 SpeedTraffic 분석 결과 저장됨:', savedResults.id);
    } catch (error) {
      console.error('분석 결과 저장 실패:', error);
    }
  }, []);

  // 분석 실행 함수
  const executeAnalysis = useCallback(async (symbol: string) => {
    if (!symbol || inFlight.current || processedSymbols.current.has(symbol)) {
      return;
    }

    try {
      inFlight.current = true;
      processedSymbols.current.add(symbol);
      setIsAnalyzing(true);

      const companyName = getCompanyName(symbol);
      handleChatMessage(`🚀 ${companyName} 차트 분석을 시작할게요! 📊`);

      // 1.5초 대기
      await new Promise(resolve => setTimeout(resolve, 1500));

      // API 호출
      const response = await fetch(`/api/speedtraffic_analysis?symbol=${symbol}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(45000), // 45초 타임아웃
      });

      if (!response.ok) {
        throw new Error(`분석 실패: HTTP ${response.status}`);
      }

      const result = await response.json();

      // 분석 완료 메시지
      handleChatMessage('기술적 분석, 산업 민감도, 시장 민감도, 변동성 리스크 분석을 완료했어요! 📊');

      // 최종 결과 구성
      const finalResults = {
        symbol,
        companyName,
        timestamp: new Date().toISOString(),
        analysisDate: new Date().toISOString().split('T')[0],
        mfi: result.mfi,
        bollinger: result.bollinger,
        rsi: result.rsi,
        industry: result.industry,
        capm: result.capm,
        garch: result.garch,
        traffic_lights: result.traffic_lights || {}
      };

      // 분석 완료 처리
      handleAnalysisComplete(finalResults);

      // 완료 메시지
      handleChatMessage('4단계 분석이 완료되었습니다! 투자 신호등을 확인해보세요. 🎯', true);

    } catch (error) {
      console.error('분석 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '분석 서비스 연결 실패';
      handleChatMessage(`❌ 분석 중 오류가 발생했습니다: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
      inFlight.current = false;
    }
  }, [handleChatMessage, handleAnalysisComplete]);

  // symbol이 변경될 때 분석 실행
  useEffect(() => {
    if (currentSymbol && !processedSymbols.current.has(currentSymbol)) {
      executeAnalysis(currentSymbol);
    }
  }, [currentSymbol, executeAnalysis]);

  // 새 분석 시작
  const handleNewAnalysis = () => {
    setCurrentSymbol(undefined);
    setChatMessages([]);
    setAnalysisResults(null);
    setIsAnalysisComplete(false);
    setIsAnalyzing(false);
    setTrafficLights({
      technical: 'inactive',
      industry: 'inactive',
      market: 'inactive',
      risk: 'inactive'
    });
    // 처리된 심볼 목록 초기화
    processedSymbols.current.clear();
    inFlight.current = false;
  };

  // 종목 입력 처리
  const handleSymbolSubmit = (symbol: string) => {
    setCurrentSymbol(symbol);
    setChatMessages([]);
    setAnalysisResults(null);
    setIsAnalysisComplete(false);
    setIsAnalyzing(false);
    setTrafficLights({
      technical: 'inactive',
      industry: 'inactive',
      market: 'inactive',
      risk: 'inactive'
    });
    // 처리된 심볼 목록 초기화
    processedSymbols.current.clear();
    inFlight.current = false;
  };

  // 종목 입력 폼 컴포넌트
  const SymbolInputForm = () => {
    const [inputSymbol, setInputSymbol] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (inputSymbol.trim()) {
        handleSymbolSubmit(inputSymbol.trim().toUpperCase());
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">SpeedTraffic™</h1>
            <p className="text-gray-600">AI 기반 투자 신호등 시스템</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="symbol" className="block text-sm font-medium text-gray-700 mb-2">
                분석할 종목 티커
              </label>
              <input
                type="text"
                id="symbol"
                value={inputSymbol}
                onChange={(e) => setInputSymbol(e.target.value)}
                placeholder="예: 005930, 000660, 035420"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              분석 시작
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-gray-600 hover:text-gray-900 transition-colors text-sm"
            >
              ← 메인으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 메인 분석 화면 컴포넌트
  const AnalysisScreen = () => {
    const companyName = getCompanyName(currentSymbol || '');

    return (
      <div className="min-h-screen bg-gray-50">
        {/* 헤더 */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/')}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span className="text-sm font-medium">메인</span>
                </button>
                <div className="h-6 w-px bg-gray-300"></div>
                <h1 className="text-xl font-bold text-gray-900">SpeedTraffic™</h1>
                <div className="text-gray-600 text-sm">
                  {currentSymbol} • {companyName}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={handleNewAnalysis}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                >
                  새 분석
                </button>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600">실시간</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* 상단: 신호등과 채팅창 */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
            {/* 신호등 영역 */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">SpeedTraffic™</h2>
                  <div className="text-sm text-gray-500">4중 AI 분석</div>
                </div>

                {/* 신호등 디스플레이 */}
                <div className="bg-gray-900 rounded-xl p-6 mx-auto max-w-[120px]">
                  <div className="grid grid-rows-4 gap-4">
                    {[
                      { name: '기술적', status: trafficLights.technical },
                      { name: '업종', status: trafficLights.industry },
                      { name: '시장', status: trafficLights.market },
                      { name: '리스크', status: trafficLights.risk }
                    ].map((light, index) => (
                      <div key={index} className="text-center">
                        <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center border-2 border-gray-700 ${
                          light.status === 'green' ? 'bg-green-500 shadow-green-500/50 shadow-lg' :
                          light.status === 'yellow' ? 'bg-yellow-500 shadow-yellow-500/50 shadow-lg' :
                          light.status === 'red' ? 'bg-red-500 shadow-red-500/50 shadow-lg' :
                          'bg-gray-600'
                        }`}>
                          {light.status === 'inactive' ? (
                            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <div className={`w-8 h-8 rounded-full ${
                              light.status === 'green' ? 'bg-green-400 animate-pulse' :
                              light.status === 'yellow' ? 'bg-yellow-400 animate-pulse' :
                              light.status === 'red' ? 'bg-red-400 animate-pulse' : 'bg-gray-500'
                            }`}></div>
                          )}
                        </div>
                        <div className="text-xs font-medium text-white">{light.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 채팅창 영역 */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[400px] flex flex-col">
                <div className="px-4 py-3 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">AI 분석 진행상황</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-8">
                      분석을 시작하면 진행상황이 표시됩니다
                    </div>
                  ) : (
                    chatMessages.map((msg, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="bg-gray-100 rounded-lg px-4 py-3">
                            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{msg.message}</div>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            {msg.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 하단: 차트 */}
          {currentSymbol && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">실시간 차트</h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-green-600 text-sm font-medium">LIVE</span>
                    </div>
                    <div className="text-gray-600 text-sm">
                      {getCompanyName(currentSymbol)} ({currentSymbol})
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3">
                <div className="h-[450px] bg-gray-50 rounded-lg overflow-hidden">
                  <FinancialChart symbol={currentSymbol} isExpanded={false} />
                </div>
              </div>
            </div>
          )}

          {/* SpeedTraffic 컴포넌트 제거 - 직접 분석 처리 */}
        </main>
      </div>
    );
  };

  // 현재 심볼이 없으면 입력 폼을, 있으면 분석 화면을 표시
  return currentSymbol ? <AnalysisScreen /> : <SymbolInputForm />;
}
