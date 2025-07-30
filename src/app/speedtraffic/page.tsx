'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FinancialChart from '@/components/FinancialChart';
import { getCompanyName } from '@/utils/companyLookup';

export default function SpeedTrafficPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentSymbol, setCurrentSymbol] = useState<string | undefined>(undefined);

  // 디버깅 모드 감지 (직접 접속 시)
  const initialSymbol = searchParams?.get('symbol');
  const isDebugMode = !initialSymbol;
  const [chatMessages, setChatMessages] = useState<Array<{message: string, isBot: boolean, timestamp: Date}>>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  // 분석 중복 방지
  const inFlight = useRef(false);
  const processedSymbols = useRef(new Set<string>());

  // SpeedTraffic 분석법 관련 질문 프리셋 (15개)
  const questionPresets = [
    "볼린저 밴드가 무엇인가요?",
    "MFI는 어떻게 계산하나요?",
    "VaR가 무엇인가요?",
    "Industry 분석은 어떻게 했나요?",
    "RSI 지표는 무엇을 의미하나요?",
    "CAPM 베타는 어떻게 해석하나요?",
    "GARCH 모델이 무엇인가요?",
    "기술적 분석의 신호등은 어떻게 결정되나요?",
    "시장 분석에서 베타 계수의 의미는?",
    "리스크 분석은 어떤 방식으로 진행되나요?",
    "변동성은 어떻게 측정하나요?",
    "업종 베타와 시장 베타의 차이점은?",
    "신호등 색깔은 어떤 기준으로 정해지나요?",
    "과매수/과매도 구간은 어떻게 판단하나요?",
    "포트폴리오 리스크는 어떻게 계산하나요?"
  ];

  // 랜덤하게 3개 질문 선택
  const getRandomQuestions = () => {
    const shuffled = [...questionPresets].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  };

  // 컴포넌트 마운트 시 랜덤 질문 설정
  useEffect(() => {
    setSelectedQuestions(getRandomQuestions());
  }, [currentSymbol]);

  // 채팅 스크롤 ref 추가
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // 채팅 스크롤을 최하단으로 이동하는 함수
  const scrollToBottom = useCallback(() => {
    if (chatScrollRef.current) {
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, []);

  // 질문 카드 클릭 핸들러
  const handleQuestionClick = async (question: string) => {
    try {
      const response = await fetch('/api/hcx-002-dash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: question,
          context: `SpeedTraffic 분석 관련 질문: ${currentSymbol ? `현재 분석 중인 종목은 ${currentSymbol}입니다.` : ''}`
        })
      });

      if (response.ok) {
        const result = await response.json();
        // 채팅 메시지에 질문과 답변 추가
        setChatMessages(prev => [
          ...prev,
          {
            message: `Q: ${question}`,
            isBot: false,
            timestamp: new Date()
          },
          {
            message: result.reply || '답변을 생성할 수 없습니다.',
            isBot: true,
            timestamp: new Date()
          }
        ]);
        // 스크롤을 최하단으로 이동
        scrollToBottom();
      }
    } catch (error) {
      console.error('질문 처리 중 오류:', error);
      setChatMessages(prev => [
        ...prev,
        {
          message: `Q: ${question}`,
          isBot: false,
          timestamp: new Date()
        },
        {
          message: '죄송합니다. 현재 답변을 생성할 수 없습니다.',
          isBot: true,
          timestamp: new Date()
        }
      ]);
      // 스크롤을 최하단으로 이동
      scrollToBottom();
    }
  };

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

  // 질문 변경 시 스크롤 유지를 위한 플래그
  const [shouldPreventScroll, setShouldPreventScroll] = useState(false);

  // 채팅 메시지가 변경될 때마다 자동 스크롤 (질문 변경 시 제외)
  useEffect(() => {
    if (!shouldPreventScroll) {
      scrollToBottom();
    }
    // 플래그 리셋
    if (shouldPreventScroll) {
      setShouldPreventScroll(false);
    }
  }, [chatMessages, scrollToBottom, shouldPreventScroll]);

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
    // 분석 완료 상태 처리 (state 제거됨)

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
      // 분석 시작 (state 제거됨)

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

      // 통합된 분석 완료 메시지
      handleChatMessage('기술적 분석, 산업 민감도, 시장 민감도, 변동성 리스크 분석을 완료했어요! 📊\n\n4단계 분석이 완료되었습니다! 투자 신호등을 확인해보세요. 🎯');

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

      // 백엔드로 분석 결과 전송 (AI 해석용) - 확장된 데이터 구조
      try {
        console.log('🔍 [SPEEDTRAFFIC_PAGE] 백엔드 로그 전송 시작');
        console.log('🔍 [SPEEDTRAFFIC_PAGE] finalResults:', JSON.stringify(finalResults, null, 2));

        const enhancedAnalysisData = {
          symbol,
          companyName,
          analysisDate: finalResults.analysisDate,
          timestamp: finalResults.timestamp,

          // 신호등 상태 (AI 해석용)
          traffic_lights: finalResults.traffic_lights,

          // 기술적 분석 상세 데이터
          technical_analysis: {
            mfi: {
              value: finalResults.mfi?.mfi_14 || null,
              signal: finalResults.mfi?.signal || null,
              summary: finalResults.mfi?.summary_ko || null,
              traffic_light: finalResults.mfi?.traffic_light || null
            },
            rsi: {
              value: finalResults.rsi?.rsi_14 || null,
              signal: finalResults.rsi?.signal || null,
              summary: finalResults.rsi?.summary_ko || null,
              traffic_light: finalResults.rsi?.traffic_light || null
            },
            bollinger: {
              percent_b: finalResults.bollinger?.percent_b || null,
              signal: finalResults.bollinger?.signal || null,
              summary: finalResults.bollinger?.summary_ko || null,
              traffic_light: finalResults.bollinger?.traffic_light || null
            }
          },

          // 시장 분석 상세 데이터
          market_analysis: {
            capm: {
              beta: finalResults.capm?.beta_market || null,
              r_squared: finalResults.capm?.r2_market || null,
              t_stat: finalResults.capm?.tstat_market || null,
              signal: finalResults.capm?.signal || null,
              summary: finalResults.capm?.summary_ko || null,
              traffic_light: finalResults.capm?.traffic_light || null
            },
            industry: {
              beta: finalResults.industry?.beta || null,
              r_squared: finalResults.industry?.r2 || null,
              t_stat: finalResults.industry?.tstat || null,
              signal: finalResults.industry?.signal || null,
              summary: finalResults.industry?.summary_ko || null,
              traffic_light: finalResults.industry?.traffic_light || null
            }
          },

          // 리스크 분석 상세 데이터
          risk_analysis: {
            garch: {
              volatility: finalResults.garch?.sigma_pct || null,
              var_95: finalResults.garch?.var95_pct || null,
              var_99: finalResults.garch?.var99_pct || null,
              signal: finalResults.garch?.signal || null,
              summary: finalResults.garch?.summary_ko || null,
              traffic_light: finalResults.garch?.traffic_light || null
            }
          },

          // 원본 데이터 (백업용)
          raw_analysis_results: {
            mfi: finalResults.mfi,
            bollinger: finalResults.bollinger,
            rsi: finalResults.rsi,
            industry: finalResults.industry,
            capm: finalResults.capm,
            garch: finalResults.garch
          },

          session_id: `speedtraffic_${Date.now()}`
        };

        console.log('🔍 [SPEEDTRAFFIC_PAGE] enhancedAnalysisData:', JSON.stringify(enhancedAnalysisData, null, 2));

        const logResponse = await fetch('/api/speedtraffic_log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(enhancedAnalysisData)
        });

        console.log('🔍 [SPEEDTRAFFIC_PAGE] 로그 API 응답 상태:', logResponse.status);

        if (logResponse.ok) {
          const logResult = await logResponse.json();
          console.log('✅ [SPEEDTRAFFIC_PAGE] 로그 전송 성공:', logResult);
        } else {
          const errorText = await logResponse.text();
          console.error('❌ [SPEEDTRAFFIC_PAGE] 로그 전송 실패:', errorText);
        }

        console.log('📝 SpeedTraffic 확장 결과가 백엔드로 전송되었습니다.');
      } catch (logError) {
        console.error('❌ [SPEEDTRAFFIC_PAGE] 백엔드 로깅 실패:', logError);
        // 로깅 실패해도 사용자 경험에는 영향 없음
      }

      // 완료 메시지
      handleChatMessage('4단계 분석이 완료되었습니다! 투자 신호등을 확인해보세요. 🎯', true);

      // AI 해설 생성 요청
      try {
        handleChatMessage('🤖 AI가 분석 결과를 해설하고 있습니다...', true);

        const commentaryResponse = await fetch('/api/speedtraffic_commentary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol,
            companyName,
            analysisDate: finalResults.analysisDate,
            timestamp: finalResults.timestamp,
            traffic_lights: finalResults.traffic_lights,
            technical_analysis: {
              mfi: {
                value: finalResults.mfi?.mfi_14 || null,
                signal: finalResults.mfi?.traffic_light || null, // traffic_light를 signal로 매핑
                summary: finalResults.mfi?.summary_ko || null,
                traffic_light: finalResults.mfi?.traffic_light || null
              },
              rsi: {
                value: finalResults.rsi?.rsi_14 || null,
                signal: finalResults.rsi?.traffic_light || null, // traffic_light를 signal로 매핑
                summary: finalResults.rsi?.summary_ko || null,
                traffic_light: finalResults.rsi?.traffic_light || null
              },
              bollinger: {
                percent_b: finalResults.bollinger?.percent_b || null,
                signal: finalResults.bollinger?.traffic_light || null, // traffic_light를 signal로 매핑
                summary: finalResults.bollinger?.summary_ko || null,
                traffic_light: finalResults.bollinger?.traffic_light || null
              }
            },
            market_analysis: {
              capm: {
                beta: finalResults.capm?.beta_market || null,
                r_squared: finalResults.capm?.r2_market || null,
                t_stat: finalResults.capm?.tstat_market || null,
                signal: finalResults.capm?.signal || null,
                summary: finalResults.capm?.summary_ko || null,
                traffic_light: finalResults.capm?.traffic_light || null
              },
              industry: {
                beta: finalResults.industry?.beta || null,
                r_squared: finalResults.industry?.r2 || null,
                t_stat: finalResults.industry?.tstat || null,
                signal: finalResults.industry?.signal || null,
                summary: finalResults.industry?.summary_ko || null,
                traffic_light: finalResults.industry?.traffic_light || null
              }
            },
            risk_analysis: {
              garch: {
                volatility: finalResults.garch?.sigma_pct || null,
                var_95: finalResults.garch?.var95_pct || null,
                var_99: finalResults.garch?.var99_pct || null,
                signal: finalResults.garch?.signal || null,
                summary: finalResults.garch?.summary_ko || null,
                traffic_light: finalResults.garch?.traffic_light || null
              }
            }
          })
        });

        if (commentaryResponse.ok) {
          const commentaryResult = await commentaryResponse.json();
          if (commentaryResult.success && commentaryResult.commentary) {
            // 1.25초 후에 AI 해설 메시지 표시
            setTimeout(() => {
              handleChatMessage('🤖 AI가 분석 결과를 해설하고 있습니다...', true);
              // 실제 AI 해설을 추가로 표시
              setTimeout(() => {
                handleChatMessage(commentaryResult.commentary, true);
                // AI 분석 결과가 나오면 자동으로 스크롤을 최하단으로 이동
                scrollToBottom();
                console.log('🤖 AI 해설 생성 완료');
              }, 500);
            }, 1250);
          } else {
            setTimeout(() => {
              handleChatMessage('⚠️ AI 해설 생성에 실패했습니다. 신호등 결과를 참고해주세요.', true);
              scrollToBottom();
            }, 1250);
          }
        } else {
          setTimeout(() => {
            handleChatMessage('⚠️ AI 해설 서비스에 일시적인 문제가 발생했습니다.', true);
            scrollToBottom();
          }, 1250);
        }
      } catch (commentaryError) {
        console.warn('⚠️ AI 해설 생성 실패:', commentaryError);
        setTimeout(() => {
          handleChatMessage('⚠️ AI 해설 생성 중 오류가 발생했습니다. 분석 결과는 정상적으로 완료되었습니다.', true);
          scrollToBottom();
        }, 1250);
      }

    } catch (error) {
      console.error('분석 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '분석 서비스 연결 실패';
      handleChatMessage(`❌ 분석 중 오류가 발생했습니다: ${errorMessage}`);
    } finally {
      // 분석 완료 (state 제거됨)
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
                  <h2 className="text-lg font-semibold text-gray-900">
                    SpeedTraffic™
                    {isDebugMode && (
                      <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-md">
                        디버깅 모드
                      </span>
                    )}
                  </h2>
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

                <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
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

          {/* 질문 카드 섹션 */}
          {currentSymbol && selectedQuestions.length > 0 && (
            <div className="mt-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">💡 SpeedTraffic에 대해 질문하세요</h3>
                  <button
                    onClick={() => {
                      setShouldPreventScroll(true);
                      setSelectedQuestions(getRandomQuestions());
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    🔄 다른 질문 보기
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuestionClick(question)}
                      className="text-left p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all duration-200 hover:shadow-md group"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-colors">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
                            {question}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            클릭하여 질문
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

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
