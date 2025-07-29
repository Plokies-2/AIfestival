'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import FinancialChart from '@/components/FinancialChart';
import AIChat, { AIChatRef } from '@/components/AIChat';
import SpeedTraffic from '@/components/SpeedTraffic';
import { useServerStatus } from '@/hooks/useServerStatus';

export default function DashboardPage() {
  const router = useRouter();
  const [currentSymbol, setCurrentSymbol] = useState<string | undefined>(undefined);
  const [showingCompanyList, setShowingCompanyList] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);

  const [isChartExpanded, setIsChartExpanded] = useState(false); // 차트 확장 상태
  const aiChatRef = useRef<AIChatRef>(null);

  // 서버 재시작 감지 및 포트폴리오 자동 삭제
  useServerStatus({
    onServerRestart: () => {
      console.log('🔄 [Main Page] 서버 재시작으로 인한 포트폴리오 삭제 완료');
      // 필요시 추가 처리 (예: 사용자에게 알림)
    }
  });

  // Handle phase messages from SpeedTraffic
  const handlePhaseMessage = (message: string, hasReportButton?: boolean) => {
    aiChatRef.current?.addBotMessage(message, hasReportButton);
  };

  // Handle analysis completion from SpeedTraffic
  const handleAnalysisComplete = (results: any) => {
    setAnalysisData(results);
  };

  // 홈으로 돌아가기 (세션 정리 + 완전한 페이지 새로고침)
  const handleHomeClick = async () => {
    console.log('🏠 Home button clicked - triggering session cleanup and page reload');

    try {
      // 1. 먼저 세션 정리 트리거
      try {
        await fetch('/api/ai_chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: '__RESET_SESSION__' })
        });
        console.log('✅ Session cleanup triggered');
      } catch (sessionError) {
        console.warn('⚠️ Session cleanup failed, proceeding with page reload:', sessionError);
      }

      // 2. 완전한 페이지 새로고침을 위해 window.location을 사용
      // 이는 "처음부터 다시 접속"한 것과 동일한 효과를 제공
      // 모든 세션 데이터, 캐시, 상태가 완전히 초기화됨

      // 안전한 새로고침을 위해 setTimeout으로 비동기 실행
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          // 현재 URL로 완전 새로고침 (캐시 무시)
          window.location.href = window.location.href;
        }
      }, 100);

    } catch (error) {
      console.error('❌ Page reload failed, falling back to router refresh:', error);

      // 오류 발생 시 fallback으로 기존 방식 사용
      setCurrentSymbol(undefined);
      setShowingCompanyList(false);
      setAnalysisData(null);
      setIsChartExpanded(false);

      if (aiChatRef.current) {
        aiChatRef.current.resetChat();
      }

      router.refresh();
    }
  };



  // 차트 확장/축소 토글 (채팅 상태 보존)
  const handleToggleChartExpand = () => {
    console.log('🔄 Toggling chart expand state:', { current: isChartExpanded, willBe: !isChartExpanded });

    setIsChartExpanded(!isChartExpanded);



    console.log('✅ Chart expand toggle completed');
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      {/* 헤더 */}
      <header className="relative bg-white border-b border-slate-200 shadow-sm">
        <div className="absolute inset-0 gradient-bg opacity-5"></div>
        <div className="relative px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleHomeClick}
              className="flex items-center space-x-2 sm:space-x-3 hover:bg-slate-50 rounded-lg p-2 -m-2 transition-colors duration-200 group"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden group-hover:scale-105 transition-transform duration-200 shadow-sm">
                <img
                  src="/hanyang-logo.png"
                  alt="한양대학교 로고"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-left">
                <h1 className="text-lg sm:text-xl font-semibold text-slate-900 group-hover:text-blue-600 transition-colors duration-200">금융인공지능실무 AI</h1>
                <p className="text-xs sm:text-sm text-slate-500 hidden sm:block group-hover:text-slate-600 transition-colors duration-200">사용자 맞춤형 투자지원 AI - 2021064802/송승은</p>
              </div>
            </button>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/portfolio')}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 text-sm font-medium shadow-sm hover:shadow-md"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>내 포트폴리오</span>
              </button>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs sm:text-sm text-slate-600">실시간</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden p-2 sm:p-4 gap-2 sm:gap-4">
        {/* 좌측 : 차트 + 채팅 */}
        <section className="flex flex-col flex-1 overflow-hidden">
          {/* 차트 영역 - 드래그 가능 및 확장 가능 */}
          <div
            className={`${
              isChartExpanded
                ? 'fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4' // 확장 시 전체 화면 + 배경
                : showingCompanyList
                  ? 'h-16 flex-shrink-0' // 차트 바 고정 크기
                  : currentSymbol
                    ? 'h-64 sm:h-80 flex-shrink-0' // 차트 표시 시 고정 높이로 더 작게
                    : 'h-60 sm:h-80 flex-shrink-0' // 기본 차트 크기
            } ${isChartExpanded ? '' : 'mb-2 sm:mb-3'} transition-all duration-600 ease-in-out animate-fade-in overflow-hidden`}

          >
            <div className={`${isChartExpanded ? 'w-full h-full max-w-7xl max-h-full' : 'h-full'} bg-white ${isChartExpanded ? 'rounded-lg' : 'rounded-lg sm:rounded-xl'} shadow-sm border border-slate-200 overflow-hidden`}>
              <FinancialChart
                symbol={currentSymbol}
                isMinimized={showingCompanyList}
                isExpanded={isChartExpanded}
                onToggleExpand={handleToggleChartExpand}
              />
            </div>
          </div>

          {/* 채팅 영역 - 차트 확장 시 숨김 (DOM에서 제거하지 않고 display로 처리하여 상태 보존) */}
          <div className={`${
            isChartExpanded
              ? 'hidden' // 확장 시 숨김 (display: none으로 DOM은 유지하되 렌더링 안함)
              : showingCompanyList
                ? 'flex-1' // 기업 리스트 표시 시 전체 공간 사용
                : currentSymbol
                  ? 'flex-1' // 차트 있을 때 나머지 공간 모두 사용
                  : 'h-96 sm:h-[32rem]' // 기본 채팅창 크기 증가
          } min-h-0 transition-all duration-600 ease-out animate-slide-up`}>
            <div className="h-full bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <AIChat
                ref={aiChatRef}
                key="persistent-chat" // 고정 key로 컴포넌트 상태 보존
                onSymbolSubmit={(s) => {
                  console.log('📊 Symbol submitted from chat:', s);
                  setCurrentSymbol(s);
                  setShowingCompanyList(false);
                  setAnalysisData(null); // Reset analysis data for new symbol
                }}
                onSymbolError={() => {
                  console.log('❌ Symbol error from chat');
                  setCurrentSymbol(undefined);
                  setShowingCompanyList(false);
                  setAnalysisData(null);
                }}
                onShowingCompanyList={(showing) => {
                  console.log('📋 Company list visibility changed:', showing);
                  setShowingCompanyList(showing);
                }}
                hasChart={!!currentSymbol}
                showingCompanyList={showingCompanyList}
                currentSymbol={currentSymbol}
                analysisData={analysisData}
              />
            </div>
          </div>
        </section>

        {/* 우측 : SpeedTraffic 카드 - 데스크톱에서만 표시 */}
        <aside className="hidden lg:block w-80 animate-fade-in">
          <div className="h-full bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">
                {currentSymbol ? '투자 분석' : '시장 현황'}
              </h2>
              <p className="text-sm text-slate-500">
                {currentSymbol ? 'AI 기반 투자 적격성 분석' : '실시간 시장 지표'}
              </p>
            </div>
            <SpeedTraffic
              symbol={currentSymbol}
              onPhaseMessage={handlePhaseMessage}
              onAnalysisComplete={handleAnalysisComplete}
            />
          </div>
        </aside>

        {/* 모바일용 Market Overview - 하단에 표시 */}
        <div className="lg:hidden fixed bottom-4 right-4 z-50">
          <button
            className="w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105"
            onClick={() => {/* 모달 열기 로직 추가 가능 */}}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
        </div>
      </main>
    </div>
  );
}