import React from 'react';

interface TrafficLight {
  id: string;
  label: string;
  status: 'inactive' | 'red' | 'yellow' | 'green';
  description: string;
  icon: React.ReactNode;
}

interface SpeedTrafficLightsProps {
  technicalLight: 'inactive' | 'red' | 'yellow' | 'green';
  industryLight: 'inactive' | 'red' | 'yellow' | 'green';
  marketLight: 'inactive' | 'red' | 'yellow' | 'green';
  riskLight: 'inactive' | 'red' | 'yellow' | 'green';
  isLoading?: boolean;
}

const SpeedTrafficLights: React.FC<SpeedTrafficLightsProps> = ({
  technicalLight,
  industryLight,
  marketLight,
  riskLight,
  isLoading = false
}) => {
  const getTrafficLightColor = (status: 'inactive' | 'red' | 'yellow' | 'green') => {
    switch (status) {
      case 'red': return 'bg-red-500 shadow-red-500/50';
      case 'yellow': return 'bg-yellow-500 shadow-yellow-500/50';
      case 'green': return 'bg-green-500 shadow-green-500/50';
      default: return 'bg-gray-600 shadow-gray-600/30';
    }
  };

  const getStatusText = (status: 'inactive' | 'red' | 'yellow' | 'green') => {
    switch (status) {
      case 'red': return '매도 신호';
      case 'yellow': return '관망 신호';
      case 'green': return '매수 신호';
      default: return '분석 중...';
    }
  };

  const getStatusIcon = (status: 'inactive' | 'red' | 'yellow' | 'green') => {
    switch (status) {
      case 'red':
        return (
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m0 0l7-7m-7 7h14" />
          </svg>
        );
      case 'yellow':
        return (
          <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'green':
        return (
          <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m0 0l-7 7m7-7H3" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6 text-gray-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
    }
  };

  const lights: TrafficLight[] = [
    {
      id: 'technical',
      label: '기술적 분석',
      status: technicalLight,
      description: '차트 패턴 및 기술 지표 분석',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'industry',
      label: '산업 분석',
      status: industryLight,
      description: '업종 및 동종업계 비교 분석',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      id: 'market',
      label: '시장 분석',
      status: marketLight,
      description: '전체 시장 동향 및 거시경제 분석',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'risk',
      label: '리스크 분석',
      status: riskLight,
      description: '변동성 및 위험도 평가',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    }
  ];

  // 전체 투자 신호 계산
  const calculateOverallSignal = () => {
    const signals = [technicalLight, industryLight, marketLight, riskLight];
    const activeSignals = signals.filter(signal => signal !== 'inactive');
    
    if (activeSignals.length === 0) return 'analyzing';
    
    const greenCount = activeSignals.filter(signal => signal === 'green').length;
    const redCount = activeSignals.filter(signal => signal === 'red').length;
    const yellowCount = activeSignals.filter(signal => signal === 'yellow').length;
    
    if (greenCount >= 3) return 'strong_buy';
    if (greenCount >= 2 && redCount <= 1) return 'buy';
    if (redCount >= 3) return 'strong_sell';
    if (redCount >= 2 && greenCount <= 1) return 'sell';
    return 'hold';
  };

  const overallSignal = calculateOverallSignal();

  const getOverallSignalInfo = () => {
    switch (overallSignal) {
      case 'strong_buy':
        return { text: '강력 매수', color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30' };
      case 'buy':
        return { text: '매수', color: 'text-green-300', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20' };
      case 'strong_sell':
        return { text: '강력 매도', color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/30' };
      case 'sell':
        return { text: '매도', color: 'text-red-300', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' };
      case 'hold':
        return { text: '관망', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/30' };
      default:
        return { text: '분석 중', color: 'text-gray-400', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/30' };
    }
  };

  const signalInfo = getOverallSignalInfo();

  return (
    <div className="space-y-8">
      {/* 전체 투자 신호 */}
      <div className={`p-6 rounded-2xl border ${signalInfo.bgColor} ${signalInfo.borderColor}`}>
        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-2">종합 투자 신호</h3>
          <div className={`text-4xl font-bold ${signalInfo.color} mb-2`}>
            {signalInfo.text}
          </div>
          <p className="text-blue-300 text-sm">
            5개 분석 항목을 종합한 최종 투자 판단
          </p>
        </div>
      </div>

      {/* 개별 신호등 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {lights.map((light) => (
          <div key={light.id} className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="text-center space-y-4">
              {/* 신호등 */}
              <div className="relative mx-auto w-20 h-20">
                <div className={`w-full h-full rounded-full ${getTrafficLightColor(light.status)} shadow-2xl transition-all duration-500 flex items-center justify-center`}>
                  {light.status === 'inactive' && isLoading ? (
                    <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <div className="text-white">
                      {light.icon}
                    </div>
                  )}
                </div>
                {/* 글로우 효과 */}
                {light.status !== 'inactive' && (
                  <div className={`absolute inset-0 rounded-full ${getTrafficLightColor(light.status)} opacity-30 animate-pulse`}></div>
                )}
              </div>

              {/* 라벨 */}
              <div>
                <h4 className="text-white font-semibold text-lg mb-1">{light.label}</h4>
                <p className="text-blue-300 text-xs mb-2">{light.description}</p>
                
                {/* 상태 */}
                <div className="flex items-center justify-center space-x-2">
                  {getStatusIcon(light.status)}
                  <span className={`text-sm font-medium ${
                    light.status === 'inactive' ? 'text-gray-400' : 'text-white'
                  }`}>
                    {getStatusText(light.status)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 투자 가이드 */}
      {overallSignal !== 'analyzing' && (
        <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <h4 className="text-white font-semibold text-lg mb-4">💡 투자 가이드</h4>
          <div className="space-y-2 text-blue-300 text-sm">
            {overallSignal === 'strong_buy' && (
              <>
                <p>• 모든 지표가 긍정적입니다. 적극적인 매수를 고려해보세요.</p>
                <p>• 단, 개인의 투자 성향과 리스크 허용도를 고려하세요.</p>
              </>
            )}
            {overallSignal === 'buy' && (
              <>
                <p>• 대부분의 지표가 긍정적입니다. 매수를 고려해보세요.</p>
                <p>• 일부 부정적 신호가 있으니 신중하게 판단하세요.</p>
              </>
            )}
            {overallSignal === 'hold' && (
              <>
                <p>• 혼재된 신호가 나타나고 있습니다. 관망하는 것이 좋겠습니다.</p>
                <p>• 추가 정보를 수집하고 시장 상황을 지켜보세요.</p>
              </>
            )}
            {overallSignal === 'sell' && (
              <>
                <p>• 부정적인 신호가 우세합니다. 매도를 고려해보세요.</p>
                <p>• 손실을 최소화하는 전략을 세워보세요.</p>
              </>
            )}
            {overallSignal === 'strong_sell' && (
              <>
                <p>• 강력한 매도 신호입니다. 즉시 매도를 고려하세요.</p>
                <p>• 추가 하락 위험이 높으니 신속한 대응이 필요합니다.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpeedTrafficLights;
