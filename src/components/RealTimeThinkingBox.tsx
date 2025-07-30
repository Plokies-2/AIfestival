'use client';

import React, { useState, useEffect } from 'react';

interface ThinkingMessage {
  id: string;
  text: string;
  detail?: string; // 추가 세부 정보 (기업명, 검색 대상 등)
  type: 'search' | 'analyze' | 'extract' | 'generate' | 'summarize' | 'complete';
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
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  // 메시지 타입별 아이콘
  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'search': return '🔍';
      case 'analyze': return '📊';
      case 'extract': return '🎯';
      case 'generate': return '⚡';
      case 'summarize': return '📝';
      case 'complete': return '✅';
      default: return '💭';
    }
  };



  // 실시간 메시지 처리 (최우선순위 - 백엔드 실제 데이터)
  useEffect(() => {
    if (realTimeMessages && realTimeMessages.length > 0) {
      const latestMessage = realTimeMessages[realTimeMessages.length - 1];
      setCurrentMessage(latestMessage);
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
      // fade-out 애니메이션 시작
      if (currentMessage && !isAnimatingOut) {
        setIsAnimatingOut(true);
        // 300ms 후에 실제로 숨김
        setTimeout(() => {
          setCurrentMessage(null);
          setIsCompleted(false);
          setIsAnimatingOut(false);
        }, 300);
      } else if (!currentMessage) {
        setIsCompleted(false);
        setIsAnimatingOut(false);
      }
      return;
    }

    // 실시간 메시지가 있으면 시뮬레이션 건너뛰기
    if (realTimeMessages && realTimeMessages.length > 0) {
      return;
    }

    // 시뮬레이션 코드는 실제 백엔드 데이터를 사용하므로 더 이상 필요하지 않음
    // 실시간 메시지만 사용
  }, [isVisible, onComplete, realTimeMessages]);

  if (!currentMessage) return null;

  return (
    <div className={`inline-block w-full max-w-3xl lg:max-w-4xl transition-all duration-300 ease-in-out ${
      isAnimatingOut ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
    }`}>
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl px-6 py-3 shadow-md border border-blue-200/50 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          {/* 아이콘 */}
          <div className="flex-shrink-0">
            <span className="text-lg">{getMessageIcon(currentMessage.type)}</span>
          </div>

          {/* 메시지 내용 */}
          <div className="flex-1 min-w-0">
            <div className="text-base text-gray-800 font-medium leading-relaxed">
              {currentMessage.text}
            </div>
            {currentMessage.detail && (
              <div className="text-sm text-gray-600 mt-2">
                <div className="break-words leading-relaxed bg-white/70 rounded-lg px-3 py-2 border border-blue-100">
                  {currentMessage.detail}
                </div>
              </div>
            )}
          </div>

          {/* 로딩 애니메이션 (완료되지 않은 경우) */}
          {!isCompleted && currentMessage.type !== 'complete' && (
            <div className="flex space-x-1.5">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealTimeThinkingBox;
