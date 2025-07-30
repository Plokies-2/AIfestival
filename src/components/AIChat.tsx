'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import RealTimeThinkingBox from './RealTimeThinkingBox';

interface AIChatProps {
  onSymbolSubmit?: (symbol: string) => void;
  onSymbolError?: () => void;
  onShowingCompanyList?: (showing: boolean) => void;
  hasChart?: boolean; // 차트 표시 여부
  showingCompanyList?: boolean; // 기업 리스트 표시 여부
  currentSymbol?: string; // 현재 분석 중인 심볼
  analysisData?: any; // 분석 데이터 (SpeedTraffic 결과)
}

export interface AIChatRef {
  addBotMessage: (message: string, hasReportButton?: boolean, isLoading?: boolean) => void;
  resetChat: () => void;
}

interface ChatMessage {
  from: 'user' | 'bot';
  text: string;
  hasReportButton?: boolean;
  isLoading?: boolean; // 로딩 상태 표시용
  isThinking?: boolean; // 추론 과정 표시용
}

interface ChatApiResponse {
  reply: string;
  // Add other fields from the API response if needed
}

const AIChat = forwardRef<AIChatRef, AIChatProps>(({ onSymbolSubmit, onSymbolError, onShowingCompanyList, hasChart, showingCompanyList, currentSymbol, analysisData }, ref) => {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isHidingSuggestions, setIsHidingSuggestions] = useState(false);
  const [isThinking, setIsThinking] = useState(false); // 추론 과정 상태
  const [thinkingMessages, setThinkingMessages] = useState<Array<{
    id: string;
    text: string;
    detail?: string;
    type: 'search' | 'analyze' | 'extract' | 'generate' | 'complete';
    timestamp: number;
  }>>([]);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
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

  /* 컴포넌트 언마운트 시 polling 정리 */
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

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

  // 컴포넌트 마운트 시 채팅 기록 복원 또는 초기화
  useEffect(() => {
    const initializeChat = async () => {
      // 저장된 채팅 기록 확인 (포트폴리오에서 돌아온 경우)
      const savedHistory = localStorage.getItem('ai_chat_history');
      const savedTimestamp = localStorage.getItem('ai_chat_timestamp');

      // 5분 이내의 기록만 복원 (너무 오래된 기록은 무시)
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

      if (savedHistory && savedTimestamp && parseInt(savedTimestamp) > fiveMinutesAgo) {
        try {
          const parsedHistory = JSON.parse(savedHistory);
          if (parsedHistory.length > 0) {
            console.log('🔄 채팅 기록 복원됨');
            setHistory(parsedHistory);
            // 질문 예시는 기록이 있으면 숨김
            setSuggestedQuestions([]);
            return;
          }
        } catch (error) {
          console.error('채팅 기록 복원 실패:', error);
        }
      }

      // 저장된 기록이 없거나 오래된 경우 새로 초기화
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
    addBotMessage: (message: string, hasReportButton?: boolean, isLoading?: boolean) => {
      setHistory(h => [...h, { from: 'bot', text: message, hasReportButton, isLoading }]);
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
      setIsHidingSuggestions(false);

      // localStorage에서 채팅 기록 삭제 (완전 초기화)
      localStorage.removeItem('ai_chat_history');
      localStorage.removeItem('ai_chat_timestamp');

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
    ]
  }), []);

  const detectCompanyList = useCallback((text: string): boolean =>
    DETECTION_PATTERNS.companyList.some(pattern => pattern.test(text)), [DETECTION_PATTERNS]);

  // 분석 진행 상황 polling 함수
  const pollAnalysisProgress = useCallback(async () => {
    try {
      const response = await fetch('/api/analysis-progress?sessionId=global-session');
      const data = await response.json();

      if (data.success && data.currentProgress) {
        const progress = data.currentProgress;

        // 타입 매핑
        const getProgressType = (step: string): 'search' | 'analyze' | 'extract' | 'generate' | 'complete' => {
          if (step.includes('search') || step.includes('검색')) return 'search';
          if (step.includes('analyze') || step.includes('분석')) return 'analyze';
          if (step.includes('extract') || step.includes('추출')) return 'extract';
          if (step.includes('generate') || step.includes('생성')) return 'generate';
          if (step.includes('complete') || step.includes('완료')) return 'complete';
          return 'analyze';
        };

        const thinkingMessage = {
          id: `progress_${progress.timestamp}`,
          text: progress.message,
          detail: progress.detail,
          type: getProgressType(progress.step),
          timestamp: progress.timestamp
        };

        setThinkingMessages([thinkingMessage]);

        // 분석 완료 시 polling 중단
        if (!data.isAnalyzing || progress.completed) {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }

          // 완료 메시지 표시 후 thinking box 숨김 (3초로 연장)
          setTimeout(() => {
            setThinkingMessages([]);
          }, 3000);
        }
      }
    } catch (error) {
      // 개발 환경에서만 상세 에러 로깅
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ [Progress Polling] 오류:', error);
      }
    }
  }, [pollingInterval]);

  // polling 시작 함수
  const startProgressPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    const interval = setInterval(pollAnalysisProgress, 3000); // 3초마다 polling (호출 빈도 최적화)
    setPollingInterval(interval);

    // 개발 환경에서만 로깅
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 [Progress Polling] 시작');
    }
  }, [pollAnalysisProgress, pollingInterval]);

  // polling 중단 함수
  const stopProgressPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
      // 개발 환경에서만 로깅
      if (process.env.NODE_ENV === 'development') {
        console.log('⏹️ [Progress Polling] 중단');
      }
    }
  }, [pollingInterval]);

  // 상세 분석 API 호출 함수 (개선된 에러 핸들링)
  const fetchDetailedAnalysis = useCallback(async (retryCount = 0) => {
    const maxRetries = 3; // 재시도 횟수 증가

    try {
      console.log(`🔄 상세 분석 요청 시도 ${retryCount + 1}/${maxRetries + 1}`);

      const response = await fetch('/api/ai_chat_detailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'global-session' })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // 개발 환경에서만 상세 에러 로깅
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ 상세 분석 API 오류:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData.error || '알 수 없는 오류',
            retryCount: retryCount + 1
          });
        }

        // 400 에러 (세션 데이터 없음)인 경우 재시도 - 지연 시간 증가
        if (response.status === 400 && retryCount < maxRetries) {
          const delayMs = (retryCount + 1) * 500; // 점진적 지연 증가 (500ms, 1000ms, 1500ms)
          console.log(`⏳ 세션 데이터 동기화 대기 후 재시도... (${retryCount + 1}/${maxRetries}, ${delayMs}ms 대기)`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return fetchDetailedAnalysis(retryCount + 1);
        }

        throw new Error(`상세 분석 요청 실패 (${response.status}): ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ 상세 분석 성공');

      // 포트폴리오 데이터가 있으면 저장
      if (data.portfolioData) {
        try {
          const { traditionalStrategy, creativeStrategy, recommendedIndustries, userMessage, refinedQuery } = data.portfolioData;
          const portfolios = [];
          // 정제된 쿼리를 우선 사용하고, 없으면 사용자 메시지 사용
          const portfolioName = refinedQuery || userMessage || recommendedIndustries[0]?.industry_ko || '투자';
          const timestamp = new Date().toISOString();
          const groupId = `group_${Date.now()}`; // 하나의 답변당 하나의 그룹 ID

          // 정통한 전략 포트폴리오
          if (traditionalStrategy && traditionalStrategy.length > 0) {
            portfolios.push({
              id: `traditional_${Date.now()}`,
              name: portfolioName,
              strategy: 'traditional',
              companies: traditionalStrategy.map((company: any) => ({
                ticker: company.ticker,
                name: company.name,
                weight: 1000 // 기본 1000만원
              })),
              createdAt: timestamp,
              industry: portfolioName,
              refinedQuery: refinedQuery,
              groupId: groupId
            });
          }

          // 창의적 전략 포트폴리오
          if (creativeStrategy && creativeStrategy.length > 0) {
            portfolios.push({
              id: `creative_${Date.now() + 1}`,
              name: portfolioName,
              strategy: 'creative',
              companies: creativeStrategy.map((company: any) => ({
                ticker: company.ticker,
                name: company.name,
                weight: 1000 // 기본 1000만원
              })),
              createdAt: timestamp,
              industry: portfolioName,
              refinedQuery: refinedQuery,
              groupId: groupId
            });
          }

          // localStorage에 저장
          const existingPortfolios = JSON.parse(localStorage.getItem('ai_portfolios') || '[]');
          const updatedPortfolios = [...existingPortfolios, ...portfolios];
          localStorage.setItem('ai_portfolios', JSON.stringify(updatedPortfolios));

          console.log(`✅ [Portfolio] ${portfolios.length}개 포트폴리오 저장 완료`);
        } catch (error) {
          console.error('❌ [Portfolio] 포트폴리오 저장 실패:', error);
        }
      }

      return data.reply;
    } catch (error) {
      // 개발 환경에서만 상세 에러 로깅
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ 상세 분석 오류:', error);
      }

      if (retryCount < maxRetries) {
        const delayMs = (retryCount + 1) * 500;
        if (process.env.NODE_ENV === 'development') {
          console.log(`⏳ 네트워크 오류 재시도... (${retryCount + 1}/${maxRetries}, ${delayMs}ms 대기)`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return fetchDetailedAnalysis(retryCount + 1);
      }

      return '죄송합니다. 상세 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    }
  }, []);

  // 공통 응답 처리 로직 (메모이제이션)
  const handleApiResponse = useCallback(async (res: any) => {

    const isShowingCompanies = res.status === 'showing_companies' || detectCompanyList(res.reply);

    if (isShowingCompanies) {
      onShowingCompanyList?.(true);
    }

    // 상세 분석이 필요한 경우 2단계 처리
    if (res.needsDetailedAnalysis) {
      console.log('🤖 상세 분석 시작...');

      // thinking 메시지 초기화
      setThinkingMessages([]);

      // 2차 분석 추론 과정 표시
      setHistory(h => [...h, {
        from: 'bot',
        text: '', // 빈 텍스트 (ThinkingStatusBox가 표시됨)
        isThinking: true
      }]);
      setIsThinking(true);

      // 실시간 진행 상황 polling 시작
      startProgressPolling();

      // 세션 업데이트 완료를 위한 짧은 지연
      await new Promise(resolve => setTimeout(resolve, 100));

      // 상세 분석 요청 (재시도 로직 포함)
      const detailedReply = await fetchDetailedAnalysis();

      // polling 중단
      stopProgressPolling();

      // 추론 과정을 상세 분석 결과로 교체
      setIsThinking(false);
      setHistory(h => {
        const newHistory = [...h];
        if (newHistory.length > 0 && newHistory[newHistory.length - 1].isThinking) {
          newHistory[newHistory.length - 1] = {
            from: 'bot',
            text: detailedReply,
            isThinking: false
          };
        }
        return newHistory;
      });

      console.log('✅ 상세 분석 완료');
      return;
    }

    // 차트 요청 처리
    if (res.status === 'chart_requested' && res.symbol) {
      onSymbolSubmit?.(res.symbol);
      onShowingCompanyList?.(false);

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
    }
  }, [detectCompanyList, onShowingCompanyList, onSymbolSubmit, onSymbolError, send, fetchDetailedAnalysis]);

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
      await handleApiResponse(res);
    } catch (error) {
      console.error('Suggested question error:', error);
      setHistory(h => [...h, { from: 'bot', text: '죄송합니다. 일시적인 오류가 발생했습니다.' }]);
      onSymbolError?.();
      onShowingCompanyList?.(false);
    }
  };

  // 보고서 기능 제거됨 - 단순 완료 메시지만 표시

  // 최적화된 메인 제출 핸들러
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputRef.current?.value.trim();
    if (!text) return;

    const newHistory = [...history, { from: 'user' as const, text }];
    setHistory(newHistory);
    inputRef.current!.value = '';

    // 채팅 기록을 localStorage에 즉시 저장
    localStorage.setItem('ai_chat_history', JSON.stringify(newHistory));
    localStorage.setItem('ai_chat_timestamp', Date.now().toString());

    // 질문 예시 버튼 숨기기
    if (suggestedQuestions.length > 0) {
      setIsHidingSuggestions(true);
      setTimeout(() => {
        setSuggestedQuestions([]);
        setIsHidingSuggestions(false);
      }, 300);
    }

    try {
      // 1초 후에 thinking box 표시하고 LLM API 호출
      setTimeout(async () => {
        // 1차 답변 중에도 thinking box 표시
        setHistory(h => [...h, {
          from: 'bot',
          text: '', // 빈 텍스트 (ThinkingBox가 표시됨)
          isThinking: true
        }]);
        setIsThinking(true);
        setThinkingMessages([{
          id: 'thinking-1',
          text: '답변을 생성하고 있습니다...',
          type: 'analyze',
          timestamp: Date.now()
        }]);

        const res = await send({ message: text, history });

        // 1차 답변 완료 - thinking box 제거하고 실제 답변 표시
        setIsThinking(false);
        setThinkingMessages([]);

        // history에서 thinking 상태인 마지막 메시지를 실제 답변으로 교체
        setHistory(h => {
          const newHistory = [...h];
          const lastIndex = newHistory.length - 1;
          if (lastIndex >= 0 && newHistory[lastIndex].isThinking) {
            newHistory[lastIndex] = { from: 'bot', text: res.reply };
          }
          return newHistory;
        });

        // 봇 응답도 localStorage에 저장
        const currentHistory = [...newHistory, { from: 'bot', text: res.reply }];
        localStorage.setItem('ai_chat_history', JSON.stringify(currentHistory));
        localStorage.setItem('ai_chat_timestamp', Date.now().toString());

        // 1차 답변 완료 후 즉시 임시 thinking box 표시
        setTimeout(() => {
          setIsThinking(true);
          setThinkingMessages([{
            id: 'preparing-detailed',
            text: '고급 답변 준비 중...',
            type: 'analyze',
            timestamp: Date.now()
          }]);

          // 상세 분석 시작
          handleApiResponse(res);
        }, 200);

        await Promise.resolve(); // handleApiResponse를 비동기로 처리
      }, 1000); // 1초 후에 thinking box 표시 및 API 호출
    } catch (error) {
      // 개발 환경에서만 상세 에러 로깅
      if (process.env.NODE_ENV === 'development') {
        console.error('Chat error:', error);
      }
      const errorHistory = [...newHistory, { from: 'bot' as const, text: '죄송합니다. 일시적인 오류가 발생했습니다.' }];
      setHistory(errorHistory);

      // 에러 메시지도 localStorage에 저장
      localStorage.setItem('ai_chat_history', JSON.stringify(errorHistory));
      localStorage.setItem('ai_chat_timestamp', Date.now().toString());

      onSymbolError?.();
      onShowingCompanyList?.(false);
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
              : 'calc(100% - 120px)', // 입력창과 헤더 공간을 제외한 나머지 전체 사용
          height: showingCompanyList
            ? 'calc(100vh - 200px)'
            : hasChart
              ? '180px'
              : 'calc(100% - 120px)' // 입력창과 헤더 공간을 제외한 나머지 전체 사용
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
                  {m.isThinking ? (
                    <RealTimeThinkingBox
                      isVisible={true}
                      realTimeMessages={thinkingMessages}
                      onComplete={() => {
                        // 추론 완료 후 처리 (필요시)
                      }}
                    />
                  ) : (
                    <div className="px-3 py-2 rounded-xl shadow-sm whitespace-pre-line bg-white border border-slate-200 text-slate-900 animate-fadeIn">
                      {m.isLoading ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                          <p className="text-sm leading-relaxed text-slate-600">{m.text}</p>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed">{m.text}</p>
                      )}
                    </div>
                  )}

                  {/* 보고서 버튼 */}
                  {/* 보고서 버튼 제거됨 */}
                </div>
              </div>
            )}
          </div>
        ))}


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

    {/* Report Modal 제거됨 */}
  </>
  );
});

AIChat.displayName = 'AIChat';

export default AIChat;