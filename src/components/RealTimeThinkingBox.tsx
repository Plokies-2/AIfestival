'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ThinkingMessage {
  id: string;
  text: string;
  detail?: string; // 추가 세부 정보 (기업명, 검색 대상 등)
  type: 'search' | 'analyze' | 'extract' | 'generate' | 'complete';
  timestamp: number;
}

interface RealTimeThinkingBoxProps {
  isVisible: boolean;
  onComplete?: () => void;
  realTimeMessages?: ThinkingMessage[];
}

const RealTimeThinkingBox: React.FC<RealTimeThinkingBoxProps> = ({ isVisible, onComplete, realTimeMessages }) => {
  const [currentMessage, setCurrentMessage] = useState<ThinkingMessage | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [messageHistory, setMessageHistory] = useState<ThinkingMessage[]>([]);

  // 메시지 타입별 아이콘
  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'search': return '🔍';
      case 'analyze': return '📊';
      case 'extract': return '🎯';
      case 'generate': return '⚡';
      case 'complete': return '✅';
      default: return '💭';
    }
  };

  // 백엔드 로그를 파싱하여 메시지 생성
  const parseLogToMessage = (logText: string): ThinkingMessage | null => {
    const timestamp = Date.now();
    
    // 뉴스 검색 관련
    if (logText.includes('뉴스 검색 시작') || logText.includes('Investment Trend Search')) {
      return {
        id: `search_${timestamp}`,
        text: '투자 동향 뉴스 검색 중...',
        type: 'search',
        timestamp
      };
    }
    
    // RAG reasoning
    if (logText.includes('RAG Reasoning') || logText.includes('검색어 정제')) {
      return {
        id: `analyze_${timestamp}`,
        text: '검색어 정제 및 분석 중...',
        type: 'analyze',
        timestamp
      };
    }
    
    // 기업 추출
    if (logText.includes('기업 추출') || logText.includes('extract_companies')) {
      return {
        id: `extract_${timestamp}`,
        text: '투자 대상 기업 추출 중...',
        type: 'extract',
        timestamp
      };
    }
    
    // 투자 전략 생성
    if (logText.includes('투자 전략 생성') || logText.includes('generate_investment')) {
      return {
        id: `generate_${timestamp}`,
        text: '투자 전략 및 포트폴리오 생성 중...',
        type: 'generate',
        timestamp
      };
    }
    
    // 완료
    if (logText.includes('분석 완료') || logText.includes('성공')) {
      return {
        id: `complete_${timestamp}`,
        text: '분석 완료!',
        type: 'complete',
        timestamp
      };
    }
    
    return null;
  };

  // 실시간 메시지 처리 (최우선순위 - 백엔드 실제 데이터)
  useEffect(() => {
    if (realTimeMessages && realTimeMessages.length > 0) {
      const latestMessage = realTimeMessages[realTimeMessages.length - 1];
      setCurrentMessage(latestMessage);
      setMessageHistory(realTimeMessages);
      setIsCompleted(latestMessage.type === 'complete');

      console.log('📊 [Real-time] 실제 백엔드 진행 상황:', latestMessage);

      if (latestMessage.type === 'complete') {
        // 완료 메시지를 더 오래 표시 (3초)
        setTimeout(() => {
          setCurrentMessage(null);
          onComplete?.();
        }, 3000);
      }
      return;
    }
  }, [realTimeMessages, onComplete]);

  // 시뮬레이션된 진행 상황 (실시간 메시지가 없을 때만)
  useEffect(() => {
    if (!isVisible) {
      setCurrentMessage(null);
      setIsCompleted(false);
      setMessageHistory([]);
      return;
    }

    // 실시간 메시지가 있으면 시뮬레이션 건너뛰기
    if (realTimeMessages && realTimeMessages.length > 0) {
      return;
    }

    const simulatedSteps = [
      { text: '검색어 정제 및 분석', detail: '사용자 입력 분석 및 투자 의도 파악', type: 'analyze', delay: 1000 },
      { text: '투자 동향 뉴스 검색', detail: '관련 산업 뉴스 대량 수집', type: 'search', delay: 2500 },
      { text: '투자 대상 기업 추출', detail: '정통한 전략 3개, 창의적 전략 3개', type: 'extract', delay: 4500 },
      { text: '개별 기업 뉴스 수집', detail: '선정된 기업들의 최신 뉴스 분석', type: 'search', delay: 6500 },
      { text: '투자 전략 및 포트폴리오 생성', detail: '종합 분석 및 투자 전략 수립', type: 'generate', delay: 8500 },
      { text: '분석 마무리 중', detail: '투자 추천 보고서 생성 완료', type: 'complete', delay: 10000 }
    ];

    let timeouts: NodeJS.Timeout[] = [];

    simulatedSteps.forEach((step, index) => {
      const timeout = setTimeout(() => {
        const message: ThinkingMessage = {
          id: `sim_${Date.now()}_${index}`,
          text: step.text,
          detail: step.detail,
          type: step.type as any,
          timestamp: Date.now()
        };

        setCurrentMessage(message);
        setMessageHistory(prev => [...prev, message]);

        if (index === simulatedSteps.length - 1) {
          setIsCompleted(true);
          // 완료 메시지를 더 오래 표시 (3초)
          setTimeout(() => {
            setCurrentMessage(null); // 완료 후 박스 숨김
            onComplete?.();
          }, 3000);
        }
      }, step.delay);

      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [isVisible, onComplete, realTimeMessages]);

  if (!isVisible || !currentMessage) return null;

  return (
    <div className="inline-block max-w-3xl">
      <div className="bg-gray-100 rounded-2xl px-4 py-2 shadow-sm border border-gray-200">
        <div className="flex items-center space-x-2">
          {/* 아이콘 */}
          <div className="flex-shrink-0">
            <span className="text-sm">{getMessageIcon(currentMessage.type)}</span>
          </div>

          {/* 메시지 내용 */}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-800 font-medium">
              {currentMessage.text}
            </div>
            {currentMessage.detail && (
              <div className="text-xs text-gray-600 mt-1.5">
                <div className="break-words leading-relaxed bg-gray-50 rounded-lg px-2 py-1 border">
                  {currentMessage.detail}
                </div>
              </div>
            )}
          </div>

          {/* 로딩 애니메이션 (완료되지 않은 경우) */}
          {!isCompleted && currentMessage.type !== 'complete' && (
            <div className="flex space-x-1">
              <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealTimeThinkingBox;
