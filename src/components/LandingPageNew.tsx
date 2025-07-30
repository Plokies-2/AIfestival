'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useRouter } from 'next/navigation';

interface LandingPageProps {}

const LandingPage: React.FC<LandingPageProps> = () => {
  const router = useRouter();
  const [currentSection, setCurrentSection] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement[]>([]);

  //섹션 정의
  const sections = [
    {
      id: 'hero',
      title: '사용자 맞춤형 AI 투자 분석 플랫폼',
      subtitle: '의도 분석, 뉴스 분석, 포트폴리오 백테스팅, SpeedTraffic™',
      description: '자연어로 질문하면 AI가 맞춤형 투자 전략을 제안하는 혁신적인 플랫폼',
      bgColor: 'from-slate-900 via-blue-900 to-indigo-900',
      textColor: 'text-white'
    },
    {
      id: 'rag-system',
      title: '1차 RAG 기반 산업 매칭',
      subtitle: '어떤 아이디어든 물어보세요!',
      description: 'BGE-M3 모델을 통해 KRX 기업공시채널 분류 기준 데이터베이스를 백터화하였습니다. 이 지도를 통해 사용자의 전략에 맞는 산업을 추론합니다.',
      features: [
        { icon: '⚡', title: '빠른 1차 답변', desc: '이미 구성된 백터 지도를 통해 3초 내로 사용자의 아이디어를 타겟팅할 수 있는 산업군을 추출합니다.' },
        { icon: '🧠', title: 'KRX 분류 기준 데이터베이스', desc: '기분류된 데이터를 활용해 LLM의 고질적인 문제인 일관성 문제를 해결해 정확한 산업 타겟팅을 구현합니다.' },
        { icon: '🎯', title: '정확한 의도 파악', desc: 'HCX-002-DASH 모델이 사용자의 질의를 임베딩하기 전   ' },
        { icon: '🔍', title: 'RAG 기반 매칭', desc: '정확한 산업/기업 매칭' }
      ],
      bgColor: 'from-blue-50 to-indigo-100',
      textColor: 'text-gray-900'
    },
    {
      id: 'news-analysis',
      title: '2차 뉴스 데이터 기반 전략 도출',
      subtitle: '방대한 뉴스를 기반으로 치밀한 전략을 생성합니다',
      description: '사용자 전략과 추론된 산업을 바탕으로, Naver News API를 활용해 광범위한 뉴스 데이터를 수집합니다. 수집된 데이터를 바탕으로 HCX-005 추론형 모델이 맞춤 전략을 제안합니다.',
      features: [
        { icon: '📰', title: '실시간 뉴스 분석', desc: '최신 뉴스 데이터를 수집해 발빠른 투자 전략을 구상합니다.' },
        { icon: '📊', title: '산업 동향 분석', desc: '관련 산업 뉴스 데이터를 광범위하게 분석해 동향을 파악합니다. Naver RAG Reasoning API를 활용해 보다 목적적합한 데이터를 수집합니다. ' },
        { icon: '🔄', title: '전략 구체화', desc: '1차 응답에서 추론된 산업과 사용자의 전략을 바탕으로 정교하게 분석합니다.' },
        { icon: '💡', title: '투자 인사이트', desc: '방대한 뉴스 데이터는 Naver 요약 api를 통해 가공되어 LLM이 길을 잃지 않도록 합니다.' }
      ],
      bgColor: 'from-purple-50 to-pink-100',
      textColor: 'text-gray-900'
    },
    {
      id: 'portfolio-testing',
      title: 'AI 포트폴리오 테스트',
      subtitle: '실전에서도 강건한 투자 전략 확보',
      description: 'AI가 제공한 투자 포트폴리오를 백테스팅할 수 있습니다. 과거가 미래를 정확히 예측할 수는 없지만, 항상 과거는 교훈을 남긴다는 점을 기억해 주세요.',
      features: [
        { icon: '💾', title: '자동 저장', desc: 'AI 추천 포트폴리오 저장' },
        { icon: '📈', title: '백테스팅', desc: '과거 데이터 기반 검증' },
        { icon: '⚠️', title: '위험도 분석', desc: '포트폴리오 리스크 평가' },
        { icon: '📋', title: '성과 지표', desc: '샤프 비율, 최대 낙폭 등' }
      ],
      bgColor: 'from-green-50 to-emerald-100',
      textColor: 'text-gray-900'
    },
    {
      id: 'speedtraffic',
      title: 'SpeedTraffic™ 개별 기업 분석',
      subtitle: '포트폴리오를 넘어선 섬세한 개별 주식 분석',
      description: '개별 주식에 대한 초직관적인 정보를 제공하는 Speedtraffic은 차트 분석에 대한 정보가 없는 사용자에게도 빠르고 정확한 정보를 제공합니다. 상세 분석 기법이 궁금하다면, 언제든지 AI에게 물어보세요!',
      features: [
        { icon: '📊', title: '기술적 분석 3종', desc: 'MFI, 볼린저 밴드, RSI' },
        { icon: '📉', title: 'VaR 측정', desc: 'Value at Risk 리스크 분석' },
        { icon: '🏭', title: '산업베타', desc: '산업 포트폴리오 회귀를 통한 산업 민감도 분석' },
        { icon: '📈', title: '시장베타', desc: 'CAPM 기반 분석' },
        { icon: '🚦', title: 'SpeedTraffic™', desc: '직관적 UI와 직관적 해설' }
      ],
      bgColor: 'from-orange-50 to-red-100',
      textColor: 'text-gray-900'
    }
  ];

  // Apple 스타일 스크롤 감지 및 섹션 전환
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      const scrollTop = containerRef.current.scrollTop;
      const windowHeight = window.innerHeight;

      // 현재 보이는 섹션 계산
      const newSection = Math.round(scrollTop / windowHeight);
      const clampedSection = Math.max(0, Math.min(newSection, sections.length - 1));

      if (clampedSection !== currentSection) {
        setCurrentSection(clampedSection);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [currentSection, sections.length]);

  // 애니메이션 제거 - 정적 표시로 변경

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        scrollToSection(Math.min(currentSection + 1, sections.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollToSection(Math.max(currentSection - 1, 0));
      } else if (e.key === 'Enter') {
        router.push('/analysis');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSection, sections.length, router]);

  // 섹션으로 스크롤하는 함수
  const scrollToSection = useCallback((sectionIndex: number) => {
    if (!containerRef.current) return;

    const targetY = sectionIndex * window.innerHeight;
    containerRef.current.scrollTo({
      top: targetY,
      behavior: 'smooth'
    });
  }, []);

  return (
    <div className="relative h-screen overflow-hidden bg-gray-50">
      {/* 고정 헤더 - 밝은 톤 */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm bg-white/95 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <img
              src="/hanyang-logo.png"
              alt="한양대학교 로고"
              className="w-8 h-8 rounded-full"
            />
            <span className="text-xl font-semibold text-gray-900">
              AI 투자 분석 플랫폼
            </span>
          </div>
          <button
            onClick={() => router.push('/analysis')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            시작하기
          </button>
        </div>
      </header>



      {/* 메인 스크롤 컨테이너 */}
      <div
        ref={containerRef}
        className="h-screen overflow-y-scroll"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >

        {/* 섹션들 - 심플한 디자인 */}
        {sections.map((section, index) => (
          <section
            key={section.id}
            ref={(el) => {
              if (el) sectionsRef.current[index] = el;
            }}
            className={`relative min-h-screen flex items-center justify-center py-20 ${
              index === 0
                ? 'bg-gradient-to-br from-blue-600 to-purple-700 text-white'
                : 'bg-white text-gray-900'
            }`}
          >
            <div className={`relative z-10 max-w-6xl mx-auto px-8 ${index === 0 ? 'text-center' : 'text-left'}`}>
              {index === 0 ? (
                // 히어로 섹션 - 심플한 디자인
                <>
                  <h1 className="text-5xl md:text-7xl font-bold mb-6">
                    {section.title}
                  </h1>
                  <p className="text-xl md:text-2xl mb-4 opacity-90">
                    {section.subtitle}
                  </p>
                  <p className="text-lg opacity-80 max-w-2xl mx-auto mb-12">
                    {section.description}
                  </p>
                  <button
                    onClick={() => router.push('/analysis')}
                    className="px-8 py-3 bg-white text-blue-600 rounded-lg text-lg font-semibold hover:bg-gray-100"
                  >
                    지금 시작하기
                  </button>
                </>
              ) : (
                // 기능 섹션들 - 심플한 디자인
                <>
                  <div className="mb-12 text-center">
                    <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
                      {section.title}
                    </h2>
                    <p className="text-xl md:text-2xl mb-6 text-gray-600">
                      {section.subtitle}
                    </p>
                    <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                      {section.description}
                    </p>
                  </div>

                  {/* 기능 그리드 - 심플한 카드 */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {section.features?.map((feature, featureIndex) => (
                      <div
                        key={featureIndex}
                        className="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:shadow-md"
                      >
                        <div className="text-3xl mb-3">{feature.icon}</div>
                        <h3 className="text-lg font-semibold mb-2 text-gray-900">{feature.title}</h3>
                        <p className="text-gray-600 text-sm">{feature.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* RAG 시스템 실제 구현 모습 - 실제 채팅 UI 사용 */}
                  {index === 1 && (
                    <div className="mt-12 bg-white rounded-xl shadow-sm border border-slate-200 max-w-4xl mx-auto overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-slate-200">
                        <div className="text-xl font-bold text-gray-900 flex items-center">
                          <span className="mr-2">💬</span>
                          실제 AI 채팅 인터페이스
                        </div>
                      </div>

                      <div className="p-6 space-y-4 bg-gradient-to-b from-slate-50/30 to-white">
                        {/* 사용자 메시지 (오른쪽 정렬) */}
                        <div className="flex justify-end">
                          <div className="flex items-start flex-row-reverse max-w-[85%]">
                            {/* 아바타 */}
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br from-blue-500 to-blue-600">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div className="w-2"></div>
                            {/* 메시지 버블 */}
                            <div className="px-3 py-2 rounded-xl shadow-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                              <p className="text-sm leading-relaxed">
                                미국이 조선업에 대한 투자를 시작하려는 것 같아. 우리나라 조선업 관련주에 투자하고싶어.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Thinking Box - 30% 축소 */}
                        <div className="flex justify-start">
                          <div className="flex items-start max-w-[60%]">
                            {/* AI 아바타 */}
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <div className="w-1.5"></div>
                            {/* Thinking Box */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl px-4 py-2 shadow-md border border-blue-200/50 backdrop-blur-sm">
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                  <span className="text-base">📊</span>
                                </div>
                                <div className="flex-1">
                                  <div className="text-xs font-medium text-blue-900">답변을 생성하고 있습니다...</div>
                                </div>
                                <div className="flex space-x-1">
                                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* AI 답변 */}
                        <div className="flex justify-start">
                          <div className="flex items-start max-w-[85%]">
                            {/* AI 아바타 */}
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <div className="w-2"></div>
                            {/* 메시지 버블 */}
                            <div className="px-3 py-2 rounded-xl shadow-sm bg-white border border-slate-200 text-slate-900">
                              <p className="text-sm leading-relaxed">
                                <strong>사용자님의 투자 전략 판단 결과, 선박 및 보트 건조업 산업이 가장 적합해 보입니다!</strong>
                                <br /><br />
                                곧 더 자세한 분석을 전달하겠습니다🚢✨
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 뉴스 분석 실제 구현 모습 */}
                  {index === 2 && (
                    <div className="mt-12 bg-white rounded-xl shadow-sm border border-slate-200 max-w-4xl mx-auto overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-slate-200">
                        <div className="text-xl font-bold text-gray-900 flex items-center">
                          <span className="mr-2">📰</span>
                          실시간 뉴스 분석 진행 상황
                        </div>
                      </div>

                      <div className="p-6 space-y-4 bg-gradient-to-b from-slate-50/30 to-white">
                        {/* 진행 상황 1: 뉴스 검색 */}
                        <div className="flex justify-start">
                          <div className="flex items-start max-w-[85%]">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <div className="w-2"></div>
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl px-6 py-3 shadow-md border border-blue-200/50 backdrop-blur-sm">
                              <div className="flex items-center space-x-4">
                                <div className="flex-shrink-0">
                                  <span className="text-lg">🔍</span>
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-blue-900">투자 동향 뉴스 검색</div>
                                  <div className="text-xs text-blue-700 mt-1">선박 및 보트 건조업 관련 뉴스 수집 중...</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 진행 상황 2: 뉴스 데이터 요약 */}
                        <div className="flex justify-start">
                          <div className="flex items-start max-w-[85%]">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <div className="w-2"></div>
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl px-6 py-3 shadow-md border border-purple-200/50 backdrop-blur-sm">
                              <div className="flex items-center space-x-4">
                                <div className="flex-shrink-0">
                                  <span className="text-lg">📊</span>
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-purple-900">뉴스 데이터 요약 중...</div>
                                  <div className="text-xs text-purple-700 mt-1">수집된 뉴스 30건 분석 중</div>
                                </div>
                                <div className="flex space-x-1.5">
                                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 진행 상황 3: 투자 전략 생성 */}
                        <div className="flex justify-start">
                          <div className="flex items-start max-w-[85%]">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <div className="w-2"></div>
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl px-6 py-3 shadow-md border border-green-200/50 backdrop-blur-sm">
                              <div className="flex items-center space-x-4">
                                <div className="flex-shrink-0">
                                  <span className="text-lg">⚡</span>
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-green-900">투자 전략 및 포트폴리오 생성</div>
                                  <div className="text-xs text-green-700 mt-1">선정 기업: HD현대중공업, 세진중공업, 한화오션</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* AI 답변 */}
                        <div className="flex justify-start">
                          <div className="flex items-start max-w-[95%]">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <div className="w-2"></div>
                            <div className="px-4 py-3 rounded-xl shadow-sm bg-white border border-slate-200 text-slate-900">
                              <div className="text-sm leading-relaxed space-y-3">
                                <p>
                                  📊 <strong>관련 산업 동향과 기업별 뉴스를 종합 분석하였습니다.</strong> 최근 뉴스들을 종합하면, 미국 조선업은 관세 협상과 대중국 제재로 인해 반사이익을 얻고 있으며, 국내 조선업계가 글로벌 수주 시장에서 반등의 기회를 잡고 있습니다.
                                </p>
                                <p>
                                  또한, 미국 무역대표부의 대중국 해사산업 제재로 일부 대형 컨테이너선이 발주처를 중국에서 한국으로 변경하고 있으며, 한국 조선업이 수주 점유율에서 반사이익을 보고 있습니다. 이러한 동향은 미국 조선업의 회복과 한국 조선업의 성장 가능성을 시사합니다.
                                </p>

                                <h3 className="text-base font-semibold text-slate-900 mt-4">🎯 정통한 투자 전략</h3>

                                <div className="space-y-2">
                                  <p>
                                    <strong>329180 (HD현대중공업)</strong><br />
                                    뉴스31에 따르면, HD현대중공업은 새로운 안전보건 경영체계인 '더 세이프 케어'를 전면 시행한다고 밝혔습니다. 이는 조선업계의 고질적인 안전 문제 해결과 중대재해의 원천 차단을 목표로 하고 있습니다. 또한, 뉴스34에서는 HD현대중공업이 조선업계의 안전 문제를 해결하기 위해 새로운 안전보건 경영체계를 시행한다고 발표했습니다.
                                  </p>

                                  <p>
                                    <strong>075580 (세진중공업)</strong><br />
                                    뉴스41에 따르면, 세진중공업은 울산항에서 6월 물동량이 역대 최고치를 경신했습니다. 또한, 뉴스42에서는 세진중공업의 주가가 13,340원으로 거래되고 있으며, 전일 대비 450원(3.49%) 상승했다고 보도되었습니다.
                                  </p>

                                  <div style={{
                                    background: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0.3) 80%, rgba(0,0,0,0) 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text'
                                  }}>
                                    <p>
                                      <strong>042660 (한화오션)</strong><br />
                                      뉴스52에 따르면, 한화오션은 실적 성장이 본격화되며 안정적인 성장구간에 진입하고 있습니다. 또한, 뉴스54에서는 해양수산부 극지연구소와 한화오션이 차세대 쇄빙연구선 건조 계약을 체결했다고 발표했습니다.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 포트폴리오 백테스팅 실제 구현 모습 - 실제 포트폴리오 페이지 복제 */}
                  {index === 3 && (
                    <div className="mt-12 bg-white rounded-xl shadow-sm border border-slate-200 max-w-7xl mx-auto overflow-hidden">
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-slate-200">
                        <div className="text-xl font-bold text-gray-900 flex items-center">
                          <span className="mr-2">📈</span>
                          실제 포트폴리오 백테스팅 결과 (1년)
                        </div>
                      </div>

                      <div className="p-6 flex gap-6">
                        {/* 좌측: 포트폴리오 리스트 (실제 portfolio 페이지 좌측과 동일) */}
                        <div className="w-80 flex-shrink-0">
                          <div className="bg-slate-50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-4">
                              <h2 className="text-lg font-semibold text-slate-900">내 포트폴리오</h2>
                              <button className="text-sm text-red-600 hover:text-red-700 font-medium">초기화</button>
                            </div>
                            <p className="text-sm text-slate-600 mb-4">AI가 추천한 포트폴리오 목록</p>

                            {/* 포트폴리오 항목 */}
                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                              <div className="p-4 cursor-pointer hover:bg-slate-50">
                                <h3 className="font-medium text-slate-900 mb-1">미국이 조선업에 대한 투자를 시작하려는 것 같아. 우리나라 조선업 관련주에 투자하고 싶어.</h3>
                                <p className="text-sm text-slate-600">2025. 7. 30. • 2개 전략</p>
                              </div>

                              {/* 전략 목록 */}
                              <div className="border-t border-slate-200 bg-slate-50">
                                <div className="p-3 border-b border-slate-200 cursor-pointer hover:bg-slate-100">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-sm font-medium text-slate-900">정통한 전략</div>
                                      <div className="text-xs text-slate-600">3개 종목</div>
                                    </div>
                                    <div className="text-xs text-slate-500">정통한</div>
                                  </div>
                                </div>
                                <div className="p-3 cursor-pointer hover:bg-slate-100">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-sm font-medium text-slate-900">창의적 전략</div>
                                      <div className="text-xs text-slate-600">3개 종목</div>
                                    </div>
                                    <div className="text-xs text-slate-500">창의적</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 우측: 백테스팅 결과 */}
                        <div className="flex-1">
                          {/* 차트 영역 */}
                          <div className="mb-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">포트폴리오 수익률 추이 (1Y)</h3>
                            <div className="h-80 bg-slate-50 rounded-lg border border-slate-200">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={[
                                  { date: '8/9', value: 0 },
                                  { date: '8/26', value: -5.2 },
                                  { date: '9/6', value: -8.1 },
                                  { date: '9/24', value: -12.3 },
                                  { date: '10/11', value: -17.01 },
                                  { date: '10/28', value: -8.7 },
                                  { date: '11/11', value: 12.4 },
                                  { date: '11/25', value: 28.9 },
                                  { date: '12/10', value: 45.2 },
                                  { date: '12/26', value: 62.8 },
                                  { date: '1/13', value: 78.3 },
                                  { date: '1/24', value: 89.7 },
                                  { date: '2/12', value: 95.4 },
                                  { date: '2/26', value: 102.1 },
                                  { date: '3/13', value: 108.6 },
                                  { date: '3/27', value: 112.3 },
                                  { date: '4/9', value: 115.92 },
                                  { date: '4/23', value: 113.8 },
                                  { date: '5/9', value: 110.2 },
                                  { date: '5/22', value: 108.9 },
                                  { date: '6/5', value: 111.4 },
                                  { date: '6/19', value: 114.1 },
                                  { date: '7/1', value: 115.92 },
                                  { date: '7/11', value: 115.92 },
                                  { date: '7/29', value: 115.92 }
                                ]}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                  <XAxis
                                    dataKey="date"
                                    stroke="#64748b"
                                    fontSize={12}
                                  />
                                  <YAxis
                                    stroke="#64748b"
                                    fontSize={12}
                                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                                  />
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: '#1e293b',
                                      border: 'none',
                                      borderRadius: '12px',
                                      color: '#ffffff',
                                      fontSize: '14px',
                                      fontWeight: '500',
                                      padding: '12px 16px'
                                    }}
                                    formatter={(value: number) => [`${value.toFixed(2)}%`, '수익률']}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#ffffff' }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* 성과 지표 - 실제 백테스팅 결과 사용 */}
                          <div className="bg-slate-50 rounded-lg p-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">백테스팅 결과 (1Y)</h3>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                              <div className="text-center p-4 bg-white rounded-lg border border-slate-200">
                                <div className="text-2xl font-bold text-green-600">115.92%</div>
                                <div className="text-sm text-slate-600">총 수익률</div>
                              </div>
                              <div className="text-center p-4 bg-white rounded-lg border border-slate-200">
                                <div className="text-2xl font-bold text-green-600">115.92%</div>
                                <div className="text-sm text-slate-600">연환산 수익률</div>
                              </div>
                              <div className="text-center p-4 bg-white rounded-lg border border-slate-200">
                                <div className="text-2xl font-bold text-orange-600">42.36%</div>
                                <div className="text-sm text-slate-600">변동성</div>
                              </div>
                              <div className="text-center p-4 bg-white rounded-lg border border-slate-200">
                                <div className="text-2xl font-bold text-purple-600">2.67</div>
                                <div className="text-sm text-slate-600">샤프 비율</div>
                              </div>
                              <div className="text-center p-4 bg-white rounded-lg border border-slate-200">
                                <div className="text-2xl font-bold text-red-600">-17.01%</div>
                                <div className="text-sm text-slate-600">최대 낙폭</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SpeedTraffic 실제 구현 모습 - 실제 SpeedTraffic 페이지 복제 */}
                  {index === 4 && (
                    <div className="mt-12 bg-white rounded-xl shadow-sm border border-slate-200 max-w-6xl mx-auto overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-slate-200">
                        <div className="text-xl font-bold text-gray-900 flex items-center">
                          <span className="mr-2">⚡</span>
                          실제 SpeedTraffic™ 분석 결과
                        </div>
                      </div>

                      <div className="p-6">
                        {/* SpeedTraffic 헤더 */}
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h2 className="text-lg font-semibold text-slate-900">SpeedTraffic™</h2>
                              <div className="text-sm text-slate-600">4중 AI 분석</div>
                            </div>
                          </div>
                        </div>

                        {/* 좌우 배치: 신호등(좌측) + 해설 채팅창(우측) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* 좌측: 4개 신호등 - 원형, 세로 정렬 */}
                          <div className="flex justify-center">
                            <div className="bg-slate-800 rounded-lg p-3 flex flex-col space-y-2 w-fit">
                              {/* 기술적 분석 - Red */}
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-red-500"></div>
                                <div className="text-xs font-medium text-white">기술적</div>
                              </div>

                              {/* 업종 민감도 - Green */}
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-green-500"></div>
                                <div className="text-xs font-medium text-white">업종</div>
                              </div>

                              {/* 시장 민감도 - Yellow */}
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-yellow-500"></div>
                                <div className="text-xs font-medium text-white">시장</div>
                              </div>

                              {/* 변동성 리스크 - Red */}
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-red-500"></div>
                                <div className="text-xs font-medium text-white">리스크</div>
                              </div>
                            </div>
                          </div>

                          {/* 우측: AI 해설 채팅창 */}
                          <div className="bg-gradient-to-b from-slate-50/30 to-white p-4 rounded-lg border border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">AI 분석 진행상황</h3>
                            <div className="space-y-3">
                            {/* 분석 시작 */}
                            <div className="flex items-start">
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                              </div>
                              <div className="ml-2 flex-1">
                                <div className="text-xs text-slate-900 bg-white rounded-lg p-2 border border-slate-200">
                                  🚀 HD현대중공업 차트 분석을 시작할게요! 📊
                                </div>
                                <div className="text-xs text-slate-500 mt-1">오후 9:48:06</div>
                              </div>
                            </div>

                            {/* 분석 완료 */}
                            <div className="flex items-start">
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <div className="ml-2 flex-1">
                                <div className="text-xs text-slate-900 bg-white rounded-lg p-2 border border-slate-200">
                                  4단계 분석이 완료되었습니다! 투자 신호등을 확인해보세요. 🎯
                                </div>
                                <div className="text-xs text-slate-500 mt-1">오후 9:48:12</div>
                              </div>
                            </div>

                            {/* AI 해설 */}
                            <div className="flex items-start">
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                              </div>
                              <div className="ml-2 flex-1">
                                <div className="text-xs text-slate-900 bg-white rounded-lg p-3 border border-slate-200">
                                  <div className="space-y-2">
                                    <div><strong>📊 SpeedTraffic™ 분석 해설</strong></div>

                                    <div><strong>종합 판단</strong></div>
                                    <div>• <strong>기술적 분석</strong>: Red - 현재 주가가 하락 추세에 있으며, 이전 고점을 하회하는 상황입니다. 추가 하락 가능성이 있어 주의가 필요합니다.</div>
                                    <div>• <strong>업종 민감도</strong>: Green - 해당 기업이 속한 업종이 긍정적인 성장 전망을 보이고 있습니다.</div>
                                    <div>• <strong>시장 민감도</strong>: Yellow - 전반적인 시장의 분위기는 중립적입니다. 신중한 접근이 요구됩니다.</div>
                                    <div>• <strong>변동성 리스크</strong>: Red - 높은 변동성으로 인해 단기적으로 불확실성이 큽니다.</div>

                                    <div><strong>핵심 분석 지표</strong></div>
                                    <div><strong>기술적 지표:</strong></div>
                                    <div>• <strong>MFI(자금흐름지수)</strong>: 70.17% → 현재 자금 흐름은 다소 약화된 상태이며, 약세 신호를 나타냅니다.</div>

                                    <div style={{
                                      background: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0.3) 80%, rgba(0,0,0,0) 100%)',
                                      WebkitBackgroundClip: 'text',
                                      WebkitTextFillColor: 'transparent',
                                      backgroundClip: 'text'
                                    }}>
                                      <div>• <strong>RSI(상대강도지수)</strong>: 68.69 → 과매도 구간에 진입하였으나, 이는 바닥권 확인보다는 단기 반등의 가능성을 시사합니다.</div>
                                      <div>• <strong>볼린저밴드 %B</strong>: 0.99 → 밴드 하단에 위치하여 하락세를 반영하며 경계심이 필요합니다.</div>

                                      <div><strong>시장 및 리스크 분석:</strong></div>
                                      <div>• <strong>CAPM 베타</strong>: 1.06 → 시장 대비 회사 성과가 더 민감함을 보여줍니다.</div>
                                      <div>• <strong>업종 베타</strong>: 0.975 → 업종 내에서는 안정적인 성과를 보입니다.</div>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-xs text-slate-500 mt-1">오후 9:48:20</div>
                              </div>
                            </div>
                          </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        ))}

      </div>



      {/* CSS 스타일 */}
      <style jsx>{`
        /* 스크롤바 숨기기 */
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default memo(LandingPage);
