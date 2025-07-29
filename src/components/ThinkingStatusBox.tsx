'use client';

import React, { useState, useEffect } from 'react';

interface ThinkingStep {
  id: string;
  type: 'searching' | 'analyzing' | 'reasoning' | 'concluding';
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed';
  duration?: number; // 단계별 예상 소요 시간 (초)
}

interface ThinkingStatusBoxProps {
  isVisible: boolean;
  onComplete?: () => void;
}

// HCX-005 모델의 추론 과정을 시뮬레이션하는 단계들
const THINKING_STEPS: ThinkingStep[] = [
  {
    id: 'search',
    type: 'searching',
    title: '정보 검색 중',
    description: '투자 관련 최신 뉴스와 시장 동향을 검색하고 있습니다...',
    status: 'pending',
    duration: 3
  },
  {
    id: 'analyze',
    type: 'analyzing', 
    title: '데이터 분석 중',
    description: '수집된 정보를 바탕으로 산업별 투자 기회를 분석하고 있습니다...',
    status: 'pending',
    duration: 4
  },
  {
    id: 'reason',
    type: 'reasoning',
    title: '추론 과정 진행 중',
    description: 'HCX-005 모델이 투자 전략과 포트폴리오 구성을 추론하고 있습니다...',
    status: 'pending',
    duration: 5
  },
  {
    id: 'conclude',
    type: 'concluding',
    title: '결론 도출 중',
    description: '최종 투자 추천안과 상세 분석 결과를 정리하고 있습니다...',
    status: 'pending',
    duration: 3
  }
];

const getStepIcon = (type: ThinkingStep['type'], status: ThinkingStep['status']) => {
  const baseClasses = "w-5 h-5 transition-all duration-300";
  
  if (status === 'completed') {
    return (
      <svg className={`${baseClasses} text-green-500`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    );
  }
  
  if (status === 'active') {
    return (
      <div className={`${baseClasses} relative`}>
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }
  
  // 타입별 아이콘 (pending 상태)
  switch (type) {
    case 'searching':
      return (
        <svg className={`${baseClasses} text-gray-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    case 'analyzing':
      return (
        <svg className={`${baseClasses} text-gray-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'reasoning':
      return (
        <svg className={`${baseClasses} text-gray-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    case 'concluding':
      return (
        <svg className={`${baseClasses} text-gray-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    default:
      return (
        <div className={`${baseClasses} bg-gray-300 rounded-full`}></div>
      );
  }
};

const ThinkingStatusBox: React.FC<ThinkingStatusBoxProps> = ({ isVisible, onComplete }) => {
  const [steps, setSteps] = useState<ThinkingStep[]>(THINKING_STEPS);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      // 리셋
      setSteps(THINKING_STEPS.map(step => ({ ...step, status: 'pending' })));
      setCurrentStepIndex(0);
      setProgress(0);
      return;
    }

    // 단계별 진행 시뮬레이션
    const processSteps = async () => {
      for (let i = 0; i < THINKING_STEPS.length; i++) {
        // 현재 단계를 활성화
        setSteps(prev => prev.map((step, index) => ({
          ...step,
          status: index < i ? 'completed' : index === i ? 'active' : 'pending'
        })));
        setCurrentStepIndex(i);

        // 단계별 진행률 업데이트
        const stepDuration = THINKING_STEPS[i].duration || 3;
        const stepProgressInterval = 50; // 50ms마다 업데이트
        const totalSteps = (stepDuration * 1000) / stepProgressInterval;
        
        for (let progress = 0; progress <= totalSteps; progress++) {
          await new Promise(resolve => setTimeout(resolve, stepProgressInterval));
          const stepProgress = (progress / totalSteps) * 100;
          const totalProgress = ((i * 100) + stepProgress) / THINKING_STEPS.length;
          setProgress(totalProgress);
        }

        // 단계 완료
        setSteps(prev => prev.map((step, index) => ({
          ...step,
          status: index <= i ? 'completed' : 'pending'
        })));
      }

      // 모든 단계 완료 후 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 500));
      onComplete?.();
    };

    processSteps();
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center space-x-3 mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">HCX-005 추론 과정</h3>
            <p className="text-sm text-gray-600">상세 분석을 위한 AI 추론이 진행 중입니다</p>
          </div>
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>진행률</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* 단계별 상태 */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className={`flex items-start space-x-3 p-3 rounded-lg transition-all duration-300 ${
              step.status === 'active' 
                ? 'bg-blue-100 border border-blue-200' 
                : step.status === 'completed'
                ? 'bg-green-50 border border-green-200'
                : 'bg-gray-50 border border-gray-200'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getStepIcon(step.type, step.status)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`text-sm font-medium ${
                step.status === 'active' ? 'text-blue-900' :
                step.status === 'completed' ? 'text-green-900' : 'text-gray-700'
              }`}>
                {step.title}
              </h4>
              <p className={`text-xs mt-1 ${
                step.status === 'active' ? 'text-blue-700' :
                step.status === 'completed' ? 'text-green-700' : 'text-gray-500'
              }`}>
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 현재 단계 상세 정보 */}
      {currentStepIndex < steps.length && (
        <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>현재 진행 중: {steps[currentStepIndex]?.title}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThinkingStatusBox;
