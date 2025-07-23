'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import ReportModal from './ReportModal';

interface AIChatProps {
  onSymbolSubmit?: (symbol: string) => void;
  onSymbolError?: () => void;
  onShowingCompanyList?: (showing: boolean) => void;
  hasChart?: boolean; // 차트 표시 여부
  showingCompanyList?: boolean; // 기업 리스트 표시 여부
  isChartExpanded?: boolean; // 차트 확장 상태 (상태 보존용)
  currentSymbol?: string; // 현재 분석 중인 심볼
  analysisData?: any; // 분석 데이터 (SpeedTraffic 결과)
}

export interface AIChatRef {
  addBotMessage: (message: string, hasReportButton?: boolean) => void;
  resetChat: () => void;
}

interface ChatMessage {
  from: 'user' | 'bot';
  text: string;
  hasReportButton?: boolean;
}

interface ChatApiResponse {
  reply: string;
  // Add other fields from the API response if needed
}

const AIChat = forwardRef<AIChatRef, AIChatProps>(({ onSymbolSubmit, onSymbolError, onShowingCompanyList, hasChart, showingCompanyList, isChartExpanded, currentSymbol, analysisData }, ref) => {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [showMoreButton, setShowMoreButton] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isHidingSuggestions, setIsHidingSuggestions] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollDiv = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  // 성능 최적화된 질문 예시 생성 (메모이제이션)
  const QUESTION_POOLS = useMemo(() => ({
    casual: ['넌 누구니?', '잘할 수 있어?', '뭐하고 있어?', '안녕하세요', '고마워', '넌 뭐야?', '넌 몇 살이야?'],
    industry: ['반도체 산업', '자동차 관련 기업', '바이오테크놀로지', '은행 금융 기업', '미디어 엔터테인먼트', '소프트웨어 회사들', '클라우드 IT 서비스', '의료기기 회사', '제약회사들', '항공우주 방위산업', '투자 추천해줘', '어떤 기업이 좋을까?'],
    company: ['테슬라', '애플', '마이크로소프트', '인텔', '엔비디아', '구글', '아마존', '메타', 'AMD', '퀄컴']
  }), []);

  const generateSuggestedQuestions = useCallback((): string[] => {
    const getRandomItem = (arr: readonly string[]) => arr[Math.floor(Math.random() * arr.length)];

    const casualQ = getRandomItem(QUESTION_POOLS.casual);
    const industryQ1 = getRandomItem(QUESTION_POOLS.industry);
    let industryQ2 = getRandomItem(QUESTION_POOLS.industry);
    while (industryQ2 === industryQ1) {
      industryQ2 = getRandomItem(QUESTION_POOLS.industry);
    }
    const companyQ = getRandomItem(QUESTION_POOLS.company);

    return [casualQ, industryQ1, industryQ2, companyQ];
  }, [QUESTION_POOLS]);

  // 컴포넌트 마운트 시 질문 예시 생성
  useEffect(() => {
    const questions = generateSuggestedQuestions();
    console.log('Generated suggested questions:', questions);
    setSuggestedQuestions(questions);
  }, [generateSuggestedQuestions]);

  /* 자동 스크롤 - history 변경 시와 차트 상태 변경 시 */
  useEffect(() => {
    const scrollToBottom = () => {
      // 마지막 메시지로 스크롤 (더 정확함)
      if (lastMessageRef.current) {
        lastMessageRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
          inline: 'nearest'
        });
      } else if (scrollDiv.current) {
        // fallback: 컨테이너 맨 아래로 스크롤
        scrollDiv.current.scrollTo({
          top: scrollDiv.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    };

    // 약간의 지연을 두고 스크롤 (DOM 업데이트 완료 후)
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [history, hasChart]);

  /* 컨테이너 크기 변경 감지 및 스크롤 재조정 */
  useEffect(() => {
    const scrollContainer = scrollDiv.current;
    if (!scrollContainer) return;

    const resizeObserver = new ResizeObserver(() => {
      // 크기 변경 후 스크롤을 맨 아래로
      setTimeout(() => {
        if (scrollContainer) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 50);
    });

    resizeObserver.observe(scrollContainer);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // API에서 환영 메시지 가져오기
  const fetchWelcomeMessage = useCallback(async () => {
    try {
      const response = await fetch('/api/ai_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '' }) // 빈 메시지로 환영 메시지 요청
      });

      if (!response.ok) {
        throw new Error('Failed to fetch welcome message');
      }

      const data = await response.json() as ChatApiResponse;
      return data.reply || '안녕하세요! 금융 분석 어시스턴트입니다.\n어떤 주식이나 산업에 대해 알고 싶으신가요?';
    } catch (error) {
      console.error('Error fetching welcome message:', error);
      return '안녕하세요! 금융 분석 어시스턴트입니다.\n어떤 주식이나 산업에 대해 알고 싶으신가요?';
    }
  }, []);

  // 컴포넌트 마운트 시 채팅 초기화 및 환영 메시지 표시
  useEffect(() => {
    const initializeChat = async () => {
      // 새로고침 시 항상 채팅 초기화
      setHistory([]);
      
      // 질문 예시 생성
      const questions = generateSuggestedQuestions();
      console.log('Generated suggested questions:', questions);
      setSuggestedQuestions(questions);
      
      // API에서 환영 메시지 가져오기
      try {
        const welcomeMessage = await fetchWelcomeMessage();
        setHistory([{ from: 'bot', text: welcomeMessage }]);
        console.log('✅ Chat initialized with welcome message');
      } catch (error) {
        console.error('Failed to initialize chat:', error);
        setHistory([{ 
          from: 'bot', 
          text: '안녕하세요! 금융 분석 어시스턴트입니다.\n어떤 주식이나 산업에 대해 알고 싶으신가요?' 
        }]);
      }
    };

    initializeChat();
  }, [fetchWelcomeMessage, generateSuggestedQuestions]);

  // 성능 최적화된 API 호출 (메모이제이션)
  const send = useCallback(async (body: Record<string, any>) => {
    try {
      const res = await fetch('/api/ai_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      return await res.json();
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }, []);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    addBotMessage: (message: string, hasReportButton?: boolean) => {
      setHistory(h => [...h, { from: 'bot', text: message, hasReportButton }]);
      // Auto-scroll to bottom
      setTimeout(() => {
        scrollDiv.current?.scrollTo({
          top: scrollDiv.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    },
    resetChat: () => {
      console.log('🔄 Resetting AI chat');
      setHistory([]);
      setShowMoreButton(false);
      setIsLoadingMore(false);
      setIsHidingSuggestions(false);

      // 환영 메시지 다시 표시
      setTimeout(() => {
        setHistory([{
          from: 'bot',
          text: '안녕하세요! 금융 분석 어시스턴트입니다.\n어떤 주식이나 산업에 대해 알고 싶으신가요?'
        }]);
      }, 100);
    }
  }), []);

  // 성능 최적화된 패턴 감지 (메모이제이션)
  const DETECTION_PATTERNS = useMemo(() => ({
    companyList: [
      /산업의?\s*(주요\s*)?기업들?입니다/,
      /분야의?\s*(대표\s*)?기업들?입니다/,
      /산업에는?\s*다음과?\s*같은\s*기업들?이\s*있습니다/,
      /\d+\.\s*[가-힣A-Za-z\s]+\s*\([A-Z]+\)/,
      /등이\s*있습니다/,
      /관심\s*있는\s*기업이\s*있나요/,
      /어떤\s*회사가\s*궁금하신가요/
    ],
    moreButton: [
      /더 많은 기업을 보시려면.*더보기.*말씀해 주세요/,
      /총 \d+개 기업/
    ]
  }), []);

  const detectCompanyList = useCallback((text: string): boolean =>
    DETECTION_PATTERNS.companyList.some(pattern => pattern.test(text)), [DETECTION_PATTERNS]);

  const detectMoreButton = useCallback((text: string): boolean =>
    DETECTION_PATTERNS.moreButton.some(pattern => pattern.test(text)), [DETECTION_PATTERNS]);

  // 공통 응답 처리 로직 (메모이제이션)
  const handleApiResponse = useCallback((res: any) => {
    const isShowingCompanies = res.status === 'showing_companies' || detectCompanyList(res.reply);
    const shouldShowMoreButton = res.hasMore || detectMoreButton(res.reply);

    if (isShowingCompanies) {
      onShowingCompanyList?.(true);
    }

    setShowMoreButton(shouldShowMoreButton);

    // 차트 요청 처리
    if (res.status === 'chart_requested' && res.symbol) {
      onSymbolSubmit?.(res.symbol);
      onShowingCompanyList?.(false);
      setShowMoreButton(false);

      // 스크롤 재조정
      setTimeout(() => {
        scrollDiv.current?.scrollTo({
          top: scrollDiv.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 200);

      // 세션 리셋
      setTimeout(async () => {
        try {
          await send({ message: '__RESET_SESSION__' });
        } catch (error) {
          console.error('Failed to reset session:', error);
        }
      }, 1000);
    } else if (res.status === 'error') {
      onSymbolError?.();
      onShowingCompanyList?.(false);
      setShowMoreButton(false);
    }
  }, [detectCompanyList, detectMoreButton, onShowingCompanyList, onSymbolSubmit, onSymbolError, send]);

  // 최적화된 질문 예시 버튼 클릭 핸들러
  const handleSuggestedQuestionClick = async (question: string) => {
    // 질문 예시 버튼 부드럽게 숨기기
    setIsHidingSuggestions(true);
    setTimeout(() => {
      setSuggestedQuestions([]);
      setIsHidingSuggestions(false);
    }, 300);

    // 사용자 메시지로 추가
    setHistory(h => [...h, { from: 'user', text: question }]);

    try {
      const res = await send({ message: question, history });
      setHistory(h => [...h, { from: 'bot', text: res.reply }]);
      handleApiResponse(res);
    } catch (error) {
      console.error('Suggested question error:', error);
      setHistory(h => [...h, { from: 'bot', text: '죄송합니다. 일시적인 오류가 발생했습니다.' }]);
      onSymbolError?.();
      onShowingCompanyList?.(false);
      setShowMoreButton(false);
    }
  };

  // 최적화된 더보기 버튼 클릭 핸들러
  const handleMoreClick = async () => {
    setIsLoadingMore(true);
    setShowMoreButton(false);

    try {
      // 더보기 버튼 클릭임을 명시적으로 표시하는 특별한 메시지 사용
      const res = await send({ message: '__SHOW_MORE_COMPANIES__', history });

      // 마지막 봇 메시지를 새로운 전체 리스트로 대체
      setHistory(h => {
        const newHistory = [...h];
        for (let i = newHistory.length - 1; i >= 0; i--) {
          if (newHistory[i].from === 'bot') {
            newHistory[i] = { from: 'bot', text: res.reply };
            break;
          }
        }
        return newHistory;
      });

      handleApiResponse(res);
    } catch (error) {
      console.error('More companies error:', error);
      setHistory(h => [...h, { from: 'bot', text: '죄송합니다. 더보기 요청 중 오류가 발생했습니다.' }]);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // 보고서 버튼 클릭 핸들러
  const handleReportClick = async () => {
    if (!currentSymbol || !analysisData) {
      console.error('No symbol or analysis data available for report generation');
      return;
    }

    setIsGeneratingReport(true);
    setIsReportModalOpen(true);
    setReportContent('');

    try {
      // Extract data from analysis results with default values for all required fields
      const reportData = {
        symbol: currentSymbol,
        companyName: analysisData.companyName || currentSymbol,
        rsi: {
          value: analysisData.rsi?.rsi_14 || 0,
          traffic_light: analysisData.rsi?.traffic_light || analysisData.traffic_lights?.technical || 'red'
        },
        bollinger: {
          value: analysisData.bollinger?.percent_b || 0,
          traffic_light: analysisData.bollinger?.traffic_light || analysisData.traffic_lights?.technical || 'red'
        },
        mfi: {
          value: analysisData.mfi?.mfi_14 || 0,
          traffic_light: analysisData.mfi?.traffic_light || analysisData.traffic_lights?.technical || 'red'
        },
        capm: {
          beta: analysisData.capm?.beta_market || 0,
          r2: analysisData.capm?.r2_market || 0,
          tstat: analysisData.capm?.tstat_market || 0,
          traffic_light: analysisData.traffic_lights?.market || 'red'
        },
        garch: {
          volatility: analysisData.garch?.sigma_pct || 0,
          var95: analysisData.garch?.var95_pct || 0,
          traffic_light: analysisData.traffic_lights?.risk || 'red'
        },
        industry: {
          beta: analysisData.industry?.beta || 0,
          r2: analysisData.industry?.r2 || 0,
          tstat: analysisData.industry?.tstat || 0,
          industry_name: analysisData.industry?.industry || 'Unknown',
          traffic_light: analysisData.traffic_lights?.industry || 'red'
        },
        lstm: {
          accuracy: analysisData.lstm?.accuracy || 0,
          pred_prob_up: analysisData.lstm?.pred_prob_up || 0,
          traffic_light: analysisData.traffic_lights?.neural || 'red'
        }
      };

      const response = await fetch('/api/generate_report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setReportContent(result.report);

    } catch (error) {
      console.error('Error generating report:', error);
      setReportContent('보고서 생성 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // 최적화된 메인 제출 핸들러
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputRef.current?.value.trim();
    if (!text) return;

    setHistory(h => [...h, { from: 'user', text }]);
    inputRef.current!.value = '';

    // 질문 예시 버튼 숨기기
    if (suggestedQuestions.length > 0) {
      setIsHidingSuggestions(true);
      setTimeout(() => {
        setSuggestedQuestions([]);
        setIsHidingSuggestions(false);
      }, 300);
    }

    try {
      const res = await send({ message: text, history });
      setHistory(h => [...h, { from: 'bot', text: res.reply }]);
      handleApiResponse(res);
    } catch (error) {
      console.error('Chat error:', error);
      setHistory(h => [...h, { from: 'bot', text: '죄송합니다. 일시적인 오류가 발생했습니다.' }]);
      onSymbolError?.();
      onShowingCompanyList?.(false);
      setShowMoreButton(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full max-h-full relative">
      {/* 채팅 헤더 - 축소 */}
      <div className="px-3 sm:px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">AI 어시스턴트</h3>
          </div>
        </div>
      </div>

      {/* 메시지 영역 - 동적 높이 조정, 입력창 공간 확보 */}
      <div
        ref={scrollDiv}
        className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 scroll-smooth bg-gradient-to-b from-slate-50/30 to-white"
        style={{
          scrollBehavior: 'smooth',
          transition: 'all 700ms cubic-bezier(0.4, 0, 0.2, 1)', // 부드러운 커스텀 애니메이션
          maxHeight: showingCompanyList
            ? 'calc(100vh - 200px)' // 질문 블럭 공간 고려
            : hasChart
              ? '180px'
              : '280px',
          height: showingCompanyList
            ? 'calc(100vh - 200px)'
            : hasChart
              ? '180px'
              : '280px'
        }}
      >
        {history.map((m, i) => (
          <div
            key={i}
            ref={i === history.length - 1 ? lastMessageRef : null}
            className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
          >
            {m.from === 'user' ? (
              // 사용자 메시지 (오른쪽 정렬)
              <div className="flex items-start flex-row-reverse max-w-[85%] sm:max-w-[80%]">
                {/* 아바타 */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br from-blue-500 to-blue-600">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>

                {/* 간격 */}
                <div className="w-2"></div>

                {/* 메시지 버블 */}
                <div className="px-3 py-2 rounded-xl shadow-sm whitespace-pre-line bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <p className="text-sm leading-relaxed">{m.text}</p>
                </div>
              </div>
            ) : (
              // AI 메시지 (왼쪽 정렬)
              <div className="flex items-start max-w-[85%] sm:max-w-[80%]">
                {/* 아바타 */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br from-slate-100 to-slate-200">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>

                {/* 간격 */}
                <div className="w-2"></div>

                {/* 메시지 버블 */}
                <div className="space-y-2">
                  <div className="px-3 py-2 rounded-xl shadow-sm whitespace-pre-line bg-white border border-slate-200 text-slate-900">
                    <p className="text-sm leading-relaxed">{m.text}</p>
                  </div>

                  {/* 보고서 버튼 */}
                  {m.hasReportButton && (
                    <div className="flex justify-start">
                      <button
                        onClick={handleReportClick}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors duration-200 flex items-center space-x-1 shadow-sm"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>보고서 출력</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* '더보기' 버튼 */}
        {showMoreButton && (
          <div className="flex justify-center py-3">
            <button
              onClick={handleMoreClick}
              disabled={isLoadingMore}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors duration-200 flex items-center space-x-2"
            >
              {isLoadingMore ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>로딩중...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <span>더보기</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 질문 예시 버튼들 - 채팅창 바로 위 */}
      {suggestedQuestions.length > 0 && (
        <div className={`px-3 py-3 bg-slate-50/50 border-t border-slate-100 flex-shrink-0 transition-all duration-700 ease-out ${
          isHidingSuggestions
            ? 'opacity-0 transform translate-y-2'
            : 'opacity-100 transform translate-y-0 animate-slide-up'
        }`}>
          <p className="text-xs text-slate-500 mb-3 text-center">💡 이런 질문은 어떠세요?</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestedQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedQuestionClick(question)}
                className={`px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded-lg transition-all duration-200 border border-slate-200 shadow-sm ${
                  isHidingSuggestions ? 'opacity-0' : 'opacity-100'
                }`}
                style={{
                  animationDelay: isHidingSuggestions ? '0ms' : `${index * 100}ms`
                }}
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 입력 영역 - 일반 플로우 */}
      <div className="p-2 sm:p-3 border-t border-slate-100 bg-white flex-shrink-0">
        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              placeholder="메시지를 입력하세요..."
              className="w-full input-modern pr-9 text-sm py-2"
            />
            <button
              type="submit"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 w-7 h-7 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center justify-center transition-colors duration-200"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>

    {/* Report Modal */}
    <ReportModal
      isOpen={isReportModalOpen}
      onClose={() => setIsReportModalOpen(false)}
      report={reportContent}
      symbol={currentSymbol || ''}
      companyName={analysisData?.companyName || currentSymbol || ''}
      isLoading={isGeneratingReport}
    />
  </>
  );
});

AIChat.displayName = 'AIChat';

export default AIChat;