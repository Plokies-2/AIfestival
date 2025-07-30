'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import RealTimeThinkingBox from './RealTimeThinkingBox';

interface LandingPageProps {
  onStartChat: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartChat }) => {
  const [currentSection, setCurrentSection] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [showThinking, setShowThinking] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement[]>([]);

  // Apple 스타일 섹션 정의
  const sections = [
    {
      id: 'hero',
      title: 'AI 투자 분석 플랫폼',
      subtitle: '불가능이란 없다.',
      description: '자연어로 질문하면 AI가 맞춤형 투자 전략을 제안하는 혁신적인 플랫폼',
      bgColor: 'from-slate-900 via-blue-900 to-indigo-900',
      textColor: 'text-white'
    },
    {
      id: 'rag-system',
      title: '1차 RAG 기반 산업 매칭',
      subtitle: '즉시 답변. 정확한 매칭.',
      description: '사용자 전략을 RAG로 분석해 적정 산업 매칭 (1차 응답)',
      features: [
        { icon: '⚡', title: '즉시 1차 답변', desc: '0.8초 내 빠른 응답' },
        { icon: '🧠', title: 'AI 사고 과정 시각화', desc: '실시간 thinking box' },
        { icon: '🎯', title: '맞춤 응답', desc: '의도 분류 및 페르소나 기반' },
        { icon: '🔍', title: 'RAG 기반 매칭', desc: '정확한 산업/기업 매칭' }
      ],
      bgColor: 'from-blue-50 to-indigo-100',
      textColor: 'text-gray-900'
    },
    {
      id: 'news-analysis',
      title: '2차 뉴스 데이터 전략 도출',
      subtitle: '뉴스가 말하는 진실.',
      description: '사용자 전략과 뉴스 데이터를 활용한 전략 도출 (2차 응답)',
      features: [
        { icon: '📰', title: '실시간 뉴스 분석', desc: '최신 뉴스 데이터 활용' },
        { icon: '📊', title: '감성 분석', desc: '시장 심리 파악' },
        { icon: '🔄', title: '전략 수정', desc: '1차 대비 정교한 분석' },
        { icon: '💡', title: '투자 인사이트', desc: '뉴스 기반 통찰 제공' }
      ],
      bgColor: 'from-purple-50 to-pink-100',
      textColor: 'text-gray-900'
    },
    {
      id: 'portfolio-testing',
      title: 'AI 포트폴리오 테스트',
      subtitle: '과거가 미래를 말한다.',
      description: 'AI의 포트폴리오를 테스트할 수 있는 페이지',
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
      title: 'SpeedTraffic™ 즉시 분석',
      subtitle: '속도가 곧 기회다.',
      description: '개별 주식에 대해 즉시 테스트할 수 있는 speedtraffic',
      features: [
        { icon: '📊', title: '기술적 분석 3종', desc: 'MFI, 볼린저 밴드, RSI' },
        { icon: '📉', title: 'VaR 측정', desc: 'Value at Risk 리스크' },
        { icon: '🏭', title: '산업베타', desc: '산업 민감도 분석' },
        { icon: '📈', title: '시장베타', desc: 'CAPM 기반 분석' },
        { icon: '🚦', title: '투자 신호등', desc: '직관적 AI 해설' }
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

      setScrollY(scrollTop);

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
        onStartChat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSection, sections.length, onStartChat]);

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
            onClick={onStartChat}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            시작하기
          </button>
        </div>
      </header>

      {/* 섹션 인디케이터 - 심플한 스타일 */}
      <div className="fixed right-6 top-1/2 transform -translate-y-1/2 z-50 flex flex-col space-y-2">
        {sections.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollToSection(index)}
            className={`w-3 h-3 rounded-full ${
              currentSection === index
                ? 'bg-blue-600'
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
          />
        ))}
      </div>

      {/* 메인 스크롤 컨테이너 */}
      <div
        ref={containerRef}
        className="h-screen overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >

        {/* 섹션들 - 심플한 디자인 */}
        {sections.map((section, index) => (
          <section
            key={section.id}
            ref={(el) => {
              if (el) sectionsRef.current[index] = el;
            }}
            className={`relative h-screen flex items-center justify-center snap-start ${
              index === 0
                ? 'bg-gradient-to-br from-blue-600 to-purple-700 text-white'
                : 'bg-white text-gray-900'
            }`}
          >
            <div className="relative z-10 max-w-6xl mx-auto px-8 text-center">
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
                    onClick={onStartChat}
                    className="px-8 py-3 bg-white text-blue-600 rounded-lg text-lg font-semibold hover:bg-gray-100"
                  >
                    지금 시작하기
                  </button>
                </>
              ) : (
                // 기능 섹션들 - 심플한 디자인
                <>
                  <div className="mb-12">
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

                  {/* 정적 데모 결과 표시 */}
                  {index === 3 && (
                    <div className="mt-12 bg-white rounded-xl p-8 border border-gray-200 shadow-sm max-w-2xl mx-auto">
                      <div className="text-2xl font-bold mb-4 text-gray-900">📈 포트폴리오 테스트 결과</div>
                      <div className="text-gray-600 mb-6">AI 포트폴리오 백테스팅 결과</div>
                      <div className="grid grid-cols-3 gap-6 text-center">
                        <div>
                          <div className="text-xl font-bold text-green-600">+18.5%</div>
                          <div className="text-gray-500 text-sm">연간 수익률</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-orange-600">12.3%</div>
                          <div className="text-gray-500 text-sm">변동성</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-purple-600">1.85</div>
                          <div className="text-gray-500 text-sm">샤프 비율</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {index === 4 && (
                    <div className="mt-12 bg-white rounded-xl p-8 border border-gray-200 shadow-sm max-w-2xl mx-auto">
                      <div className="text-2xl font-bold mb-4 text-gray-900">⚡ SpeedTraffic 분석 결과</div>
                      <div className="text-gray-600 mb-6">개별 주식 즉시 분석 결과</div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                          <div className="text-lg font-bold text-green-700">🟢 매수 신호</div>
                          <div className="text-green-600 text-sm">기술적 분석 3종 긍정</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <div className="text-lg font-bold text-blue-700">VaR: 2.3%</div>
                          <div className="text-blue-600 text-sm">일일 최대 손실 예상</div>
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

      {/* 하단 네비게이션 - 심플한 스타일 */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex space-x-3 bg-white/90 backdrop-blur-sm rounded-full px-6 py-3 border border-gray-200 shadow-lg">
        {sections.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollToSection(index)}
            className={`w-3 h-3 rounded-full ${
              currentSection === index
                ? 'bg-blue-600'
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
          />
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
