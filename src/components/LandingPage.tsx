'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import RealTimeThinkingBox from './RealTimeThinkingBox';

interface LandingPageProps {
  onStartChat: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartChat }) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 고정된 파티클 위치 (hydration 오류 방지)
  const particlePositions = [
    { left: 10, top: 20 }, { left: 80, top: 15 }, { left: 25, top: 60 },
    { left: 70, top: 80 }, { left: 45, top: 30 }, { left: 90, top: 50 },
    { left: 15, top: 85 }, { left: 60, top: 10 }, { left: 35, top: 75 },
    { left: 85, top: 35 }, { left: 5, top: 45 }, { left: 95, top: 70 },
    { left: 50, top: 5 }, { left: 20, top: 90 }, { left: 75, top: 25 },
    { left: 40, top: 55 }, { left: 65, top: 85 }, { left: 30, top: 40 },
    { left: 55, top: 70 }, { left: 12, top: 65 }, { left: 88, top: 20 },
    { left: 42, top: 85 }, { left: 78, top: 45 }, { left: 18, top: 25 },
    { left: 68, top: 60 }, { left: 38, top: 15 }, { left: 82, top: 75 },
    { left: 28, top: 35 }, { left: 72, top: 90 }, { left: 52, top: 40 }
  ];

  // AI 질의응답 과정 단계
  const steps = [
    {
      id: 'intro',
      title: 'AI 투자 분석 플랫폼',
      subtitle: '자연어로 질문하면 AI가 맞춤형 투자 전략을 제안합니다'
    },
    {
      id: 'question',
      title: '질문 입력',
      subtitle: '사용자가 투자 관련 질문을 입력하는 단계',
      userInput: '"최근 AI 기술 발전으로 수혜를 받을 만한 산업에 투자하고 싶어요"'
    },
    {
      id: 'first-response',
      title: '1차 답변',
      subtitle: 'AI가 초기 분석 결과를 제공합니다',
      aiResponse: '반도체, 클라우드 컴퓨팅, 소프트웨어 산업이 AI 발전의 주요 수혜 분야입니다.'
    },
    {
      id: 'thinking',
      title: '심화 분석 중',
      subtitle: 'AI가 더 정확한 투자 전략을 위해 심화 분석을 진행합니다'
    },
    {
      id: 'final-response',
      title: '최종 분석 완료',
      subtitle: '맞춤형 포트폴리오와 백테스팅 결과를 제공합니다'
    }
  ];

  useEffect(() => {
    setIsVisible(true);

    // 자동 스크롤 애니메이션 (각 단계별 적절한 시간)
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % steps.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [steps.length]);

  useEffect(() => {
    // ThinkingBox 애니메이션 트리거 (심화 분석 단계)
    if (currentStep === 3) {
      setShowThinking(true);
      setTimeout(() => setShowThinking(false), 4000);
    } else {
      setShowThinking(false);
    }

    // 백테스팅 애니메이션 트리거 (최종 분석 완료 단계)
    if (currentStep === 4) {
      setShowBacktest(true);
      setTimeout(() => setShowBacktest(false), 4000);
    } else {
      setShowBacktest(false);
    }
  }, [currentStep]);

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentStep(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        onStartChat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStartChat, steps.length]);

  const handleScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY;
    
    if (delta > 0 && currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else if (delta < 0 && currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div
      className="h-screen overflow-hidden bg-gray-50 text-gray-900 relative cursor-default"
      onWheel={handleScroll}
      ref={scrollRef}
    >
      {/* 배경 그라디언트 */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-gray-100 opacity-90" />

      {/* 애니메이션 파티클 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particlePositions.map((pos, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-gray-400 rounded-full opacity-20"
            style={{
              left: `${pos.left}%`,
              top: `${pos.top}%`,
              animation: `float ${3 + (i % 4)}s ease-in-out infinite`,
              animationDelay: `${(i % 3)}s`
            }}
          />
        ))}
      </div>

      {/* CSS 애니메이션 정의 */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) scale(1.2); opacity: 0.6; }
        }

        @keyframes slideInUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .slide-in-up {
          animation: slideInUp 0.8s ease-out;
        }
      `}</style>
      
      {/* 메인 콘텐츠 */}
      <div className="relative z-10 h-full flex flex-col">
        
        {/* 헤더 */}
        <header className="p-6 flex justify-between items-center backdrop-blur-sm bg-white/80 border-b border-gray-200/50">
          <div className="flex items-center space-x-3 slide-in-up">
            <img
              src="/hanyang-logo.png"
              alt="한양대학교 로고"
              className="w-8 h-8 rounded-full shadow-lg"
            />
            <span className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              AI 투자 분석 플랫폼
            </span>
          </div>
          <button
            onClick={onStartChat}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full hover:from-blue-600 hover:to-purple-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl font-semibold"
          >
            시작하기
          </button>
        </header>

        {/* 메인 섹션 */}
        <main className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">

          {/* 단계별 콘텐츠 */}
          <div className="w-full max-w-7xl mx-auto">
            
            {/* 인트로 섹션 */}
            <div className={`transition-all duration-1000 ${currentStep === 0 ? 'opacity-100 transform translate-y-0 scale-100' : 'opacity-0 transform translate-y-10 scale-95'}`}>
              <div className="text-center mb-8 sm:mb-16">
                <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  AI 투자 분석 플랫폼
                </h1>
                <p className="text-lg sm:text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed px-4">
                  자연어로 질문하면 AI가 맞춤형 투자 전략을 제안합니다
                </p>
                <div className="mt-8 sm:mt-12 flex justify-center">
                  <div className="animate-bounce">
                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* 질문 입력 단계 */}
            <div className={`transition-all duration-1000 ${currentStep === 1 ? 'opacity-100 transform translate-y-0 scale-100' : 'opacity-0 transform translate-y-10 scale-95'}`}>
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                    질문 입력
                  </h2>
                  <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                    투자에 대한 궁금한 점을 자연어로 편하게 질문해보세요
                  </p>

                  {/* 모의 채팅 UI */}
                  <div className="bg-white rounded-2xl p-6 space-y-4 shadow-xl border border-gray-200">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-2xl max-w-sm transform hover:scale-105 transition-transform duration-300">
                      "최근 AI 기술 발전으로 수혜를 받을 만한 산업에 투자하고 싶어요"
                    </div>
                    <div className="flex items-center space-x-2 text-gray-500">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-sm">AI가 질문을 분석하고 있습니다...</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-200 max-w-md">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">질문 분석 중</h3>
                      <p className="text-gray-600 text-sm">AI가 투자 관련 키워드를 추출하고 있습니다</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 1차 답변 단계 */}
            <div className={`transition-all duration-1000 ${currentStep === 2 ? 'opacity-100 transform translate-y-0 scale-100' : 'opacity-0 transform translate-y-10 scale-95'}`}>
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    1차 답변
                  </h2>
                  <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                    AI가 초기 분석 결과를 빠르게 제공합니다
                  </p>

                  {/* 1차 답변 UI */}
                  <div className="bg-white rounded-2xl p-6 space-y-4 shadow-xl border border-gray-200">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-2xl max-w-sm">
                      "최근 AI 기술 발전으로 수혜를 받을 만한 산업에 투자하고 싶어요"
                    </div>
                    <div className="bg-gradient-to-r from-gray-100 to-gray-50 text-gray-800 p-4 rounded-2xl ml-auto max-w-lg">
                      <strong>반도체, 클라우드 컴퓨팅, 소프트웨어 산업</strong>이 AI 발전의 주요 수혜 분야입니다.
                      특히 NVIDIA, Microsoft, Google 등의 기업들이 주목받고 있습니다.
                    </div>
                    <div className="flex items-center space-x-2 text-gray-500">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                      <span className="text-sm">더 정확한 분석을 위해 심화 분석을 진행합니다...</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-200 max-w-md">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">초기 분석 결과</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="text-gray-700">반도체</span>
                        <span className="text-blue-600 font-bold">85%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <span className="text-gray-700">클라우드</span>
                        <span className="text-purple-600 font-bold">78%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-gray-700">소프트웨어</span>
                        <span className="text-green-600 font-bold">72%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 심화 분석 단계 */}
            <div className={`transition-all duration-1000 ${currentStep === 3 ? 'opacity-100 transform translate-y-0 scale-100' : 'opacity-0 transform translate-y-10 scale-95'}`}>
              <div className="text-center space-y-8">
                <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  심화 분석 중
                </h2>
                <p className="text-lg text-gray-600 mb-12 leading-relaxed max-w-2xl mx-auto">
                  AI가 더 정확한 투자 전략을 위해 시장 데이터와 뉴스를 종합 분석하고 있습니다
                </p>

                <div className="flex justify-center">
                  {showThinking && (
                    <div className="transform scale-90">
                      <RealTimeThinkingBox
                        isVisible={true}
                        realTimeMessages={[
                          {
                            id: 'analysis1',
                            text: '반도체 산업 시장 동향 분석 중...',
                            type: 'search',
                            timestamp: 1000000000000
                          },
                          {
                            id: 'analysis2',
                            text: 'AI 관련 기업 재무 데이터 수집 중...',
                            type: 'analyze',
                            timestamp: 1000000001000
                          },
                          {
                            id: 'analysis3',
                            text: '최적 포트폴리오 구성 계산 중...',
                            type: 'generate',
                            timestamp: 1000000002000
                          },
                          {
                            id: 'analysis4',
                            text: '백테스팅 시뮬레이션 실행 중...',
                            type: 'complete',
                            timestamp: 1000000003000
                          }
                        ]}
                      />
                    </div>
                  )}
                </div>

                {!showThinking && (
                  <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="font-semibold text-gray-800 mb-2">시장 데이터 분석</h3>
                      <p className="text-gray-600 text-sm">실시간 주가, 거래량, 변동성 분석</p>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                        </svg>
                      </div>
                      <h3 className="font-semibold text-gray-800 mb-2">뉴스 감성 분석</h3>
                      <p className="text-gray-600 text-sm">AI 관련 뉴스의 긍정/부정 감성 분석</p>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="font-semibold text-gray-800 mb-2">리스크 계산</h3>
                      <p className="text-gray-600 text-sm">포트폴리오 최적화 및 리스크 측정</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 최종 분석 완료 섹션 */}
            <div className={`transition-all duration-1000 ${currentStep === 4 ? 'opacity-100 transform translate-y-0 scale-100' : 'opacity-0 transform translate-y-10 scale-95'}`}>
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
                    최종 분석 완료
                  </h2>
                  <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                    맞춤형 포트폴리오와 백테스팅 결과를 제공합니다
                  </p>

                  {/* 최종 답변 UI */}
                  <div className="bg-white rounded-2xl p-6 space-y-4 shadow-xl border border-gray-200">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-2xl max-w-sm">
                      "최근 AI 기술 발전으로 수혜를 받을 만한 산업에 투자하고 싶어요"
                    </div>
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 text-gray-800 p-6 rounded-2xl ml-auto max-w-lg border border-green-200">
                      <div className="space-y-3">
                        <div className="font-semibold text-green-700">📊 추천 포트폴리오</div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>• NVIDIA (NVDA)</span>
                            <span className="font-bold">30%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• Microsoft (MSFT)</span>
                            <span className="font-bold">25%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• Google (GOOGL)</span>
                            <span className="font-bold">20%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• AMD (AMD)</span>
                            <span className="font-bold">15%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• Intel (INTC)</span>
                            <span className="font-bold">10%</span>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-green-200">
                          <div className="flex justify-between font-semibold text-green-700">
                            <span>예상 연간 수익률</span>
                            <span>+24.7%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  {showBacktest && (
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl border border-gray-200 transform hover:scale-105 transition-all duration-300">
                      <h3 className="text-xl font-bold mb-4 text-center text-gray-800">백테스팅 결과</h3>
                      {/* 모의 차트 */}
                      <div className="h-48 bg-gradient-to-t from-green-100 via-green-300 to-green-500 rounded-lg flex items-end justify-center relative overflow-hidden">
                        {/* 애니메이션 라인 */}
                        <div className="absolute inset-0 flex items-end justify-center">
                          <div className="w-full h-full relative">
                            {[...Array(12)].map((_, i) => (
                              <div
                                key={i}
                                className="absolute bottom-0 bg-white opacity-30"
                                style={{
                                  left: `${i * 8}%`,
                                  width: '3px',
                                  height: `${30 + Math.sin(i * 0.5) * 20 + i * 3}%`,
                                  animationDelay: `${i * 0.1}s`
                                }}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="text-3xl font-bold text-white mb-4 z-10">📈</div>
                      </div>
                      <div className="mt-4 space-y-3">
                        <div className="text-center">
                          <span className="text-green-600 text-2xl font-bold block">+24.7%</span>
                          <span className="text-gray-500 text-sm">연간 수익률</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div>
                            <div className="text-blue-600 font-bold">15.2%</div>
                            <div className="text-gray-500 text-xs">변동성</div>
                          </div>
                          <div>
                            <div className="text-purple-600 font-bold">1.62</div>
                            <div className="text-gray-500 text-xs">샤프 비율</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </main>

        {/* 하단 네비게이션 */}
        <footer className="p-6 flex justify-center items-center space-x-8 backdrop-blur-sm bg-white/80 border-t border-gray-200/50">
          <div className="flex space-x-3">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 transform hover:scale-125 ${
                  currentStep === index ? 'bg-blue-500 shadow-lg' : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>

          {/* 스크롤 힌트 */}
          <div className="text-gray-500 text-sm flex items-center space-x-2">
            <span>스크롤하여 탐색</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default LandingPage;
