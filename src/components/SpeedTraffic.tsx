import React, { useState, useEffect, useRef } from 'react';
import { getCompanyName } from '../utils/companyLookup';

interface MarketIndicator {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  color: string;
}

interface SpeedTrafficProps {
  symbol?: string;
  onPhaseMessage?: (message: string, hasReportButton?: boolean) => void;
  onAnalysisComplete?: (results: AnalysisResults) => void;
}

interface LSTMResult {
  symbol: string;
  train_until: string;
  accuracy?: number;  // Add accuracy field
  predictions: Array<{
    date: string;
    pred_prob_up: number;
    predicted_label: number;
    actual_label: number;
    result_color: string;
  }>;
  summary_ko?: string;
  showLowAccuracyWarning?: boolean;
}

interface MFIResult {
  symbol: string;
  date: string;
  mfi_14: number;
  traffic_light: string;
}

// Define interfaces for API responses
interface Phase1Result {
  mfi?: MFIResult;
  bollinger?: any;
  rsi?: any;
  industry?: any;
  capm?: any;
  garch?: any;
  traffic_lights?: {
    technical?: string;
    industry?: string;
    market?: string;
    risk?: string;
    neural?: string;
  };
}

interface Phase2Result {
  lstm?: LSTMResult;
  traffic_lights?: {
    neural?: string;
  };
}

interface PredictionResult {
  phase?: number;
  lstm?: LSTMResult;
  mfi?: MFIResult;
  bollinger?: any;
  rsi?: any;
  industry?: any;
  capm?: any;
  garch?: any;
  traffic_lights?: {
    technical?: string;
    industry?: string;
    market?: string;
    risk?: string;
    neural?: string;
  };
}

interface AnalysisResults {
  symbol: string;
  companyName: string;
  timestamp: string;
  analysisDate: string;
  lstm?: LSTMResult;
  mfi?: MFIResult;
  bollinger?: any;
  rsi?: any;
  industry?: any;
  capm?: any;
  garch?: any;
  traffic_lights: {
    technical?: string;
    industry?: string;
    market?: string;
    risk?: string;
    neural?: string;
  };
}

const SpeedTraffic: React.FC<SpeedTrafficProps> = ({ symbol, onPhaseMessage, onAnalysisComplete }) => {
  // Market indicators state (Pre-ticker mode)
  const [indicators, setIndicators] = useState<MarketIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Traffic lights state (Post-ticker mode) - New order
  const [technicalLight, setTechnicalLight] = useState<'good' | 'warning' | 'danger' | 'inactive'>('inactive'); // Light 1: Technical Analysis
  const [industryLight, setIndustryLight] = useState<'good' | 'warning' | 'danger' | 'inactive'>('inactive'); // Light 2: Industry Sensitivity
  const [marketLight, setMarketLight] = useState<'good' | 'warning' | 'danger' | 'inactive'>('inactive'); // Light 3: Market Sensitivity (CAPM)
  const [riskLight, setRiskLight] = useState<'good' | 'warning' | 'danger' | 'inactive'>('inactive'); // Light 4: Volatility Risk
  const [neuralLight, setNeuralLight] = useState<'good' | 'warning' | 'danger' | 'inactive'>('inactive'); // Light 5: Neural Network (LSTM)
  const [insufficientAccuracy, setInsufficientAccuracy] = useState(false); // Track if LSTM accuracy is insufficient

  // Prediction state
  const [phase1Loading, setPhase1Loading] = useState(false);
  const [phase2Loading, setPhase2Loading] = useState(false);
  const [lstmLoading, setLstmLoading] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const [lastRequestTime, setLastRequestTime] = useState<number>(0);

  // Results storage state
  const [allResults, setAllResults] = useState<Partial<AnalysisResults>>({});



  // Single-flight guard
  const inFlight = useRef(false);

  // Define market data response type
  interface MarketDataItem {
    label: string;
    price: number;
    changePercent: number;
    trend: 'up' | 'down' | 'neutral';
  }

  interface MarketDataResponse {
    success: boolean;
    data: MarketDataItem[];
  }

  // 실제 시장 데이터 가져오기 (Pre-ticker mode)
  const fetchMarketData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/market_data');
      const result: MarketDataResponse = await response.json();

      if (result.success && result.data) {
        const formattedData = result.data.map((item) => ({
          label: item.label,
          value: item.price.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }),
          change: `${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(2)}%`,
          trend: item.trend,
          color: item.trend === 'up' ? 'green' : item.trend === 'down' ? 'red' : 'yellow'
        }));

        setIndicators(formattedData);
        setLastUpdate(new Date().toLocaleTimeString('ko-KR'));
      }
    } catch (error) {
      console.error('Failed to fetch market data:', error);
      // 에러 시 fallback 데이터 사용
      setIndicators([
        { label: 'S&P 500', value: '4,567.89', change: '+1.2%', trend: 'up', color: 'green' },
        { label: '나스닥', value: '14,234.56', change: '+0.8%', trend: 'up', color: 'green' },
        { label: '다우존스', value: '34,567.12', change: '-0.3%', trend: 'down', color: 'red' },
        { label: 'VIX', value: '18.45', change: '-2.1%', trend: 'down', color: 'yellow' },
        { label: '달러/원', value: '1,327.50', change: '+0.5%', trend: 'up', color: 'green' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Convert result color to traffic light status
  const resultColorToStatus = (color: string): 'good' | 'warning' | 'danger' | 'inactive' => {
    switch (color?.toLowerCase()) {
      case 'green':
      case 'good':
        return 'good';
      case 'yellow':
      case 'warning':
        return 'warning';
      case 'red':
      case 'danger':
        return 'danger';
      case 'inactive':
      case 'grey':
      case 'gray':
        return 'inactive';
      default:
        return 'warning';
    }
  };

  // Extract color from LSTM/MFI results
  const getColorFromResult = (obj: any): string | undefined => {
    if (!obj) return undefined;
    if (typeof obj === 'string') return obj;
    if (obj.result_color) return obj.result_color;
    if (obj.traffic_light) return obj.traffic_light;
    if (obj.color) return obj.color;
    return undefined;
  };

  // Staged execution: Phase 1 (Fast services) + Phase 2 (LSTM)
  const fetchStagedPrediction = async () => {
    if (!symbol || inFlight.current) return;

    // Prevent too frequent requests (minimum 10 seconds between requests)
    const now = Date.now();
    if (now - lastRequestTime < 10000) {
      console.log('Prediction request throttled - too frequent');
      return;
    }

    try {
      // Set single-flight guard
      inFlight.current = true;
      setLastRequestTime(now);

      // Reset all lights to inactive state
      setTechnicalLight('inactive');
      setIndustryLight('inactive');
      setMarketLight('inactive');
      setRiskLight('inactive');
      setNeuralLight('inactive');

      setPredictionError(null);
      setShowTimeoutMessage(false);

      // Get company name for user feedback
      const companyName = getCompanyName(symbol);

      // Initial user feedback message
      onPhaseMessage?.(`🚀 ${companyName} 차트 분석을 시작할게요! 📊`);

      // Wait 1.5 seconds before starting Phase 1
      await new Promise(resolve => setTimeout(resolve, 1500));

      console.log(`[SpeedTraffic] Starting staged prediction for ${symbol}`);

      // Phase 1: Execute fast services (Technical, Industry, Market, Volatility)
      setPhase1Loading(true);
      console.log(`[SpeedTraffic] Phase 1: Starting fast services for ${symbol}`);

      // Fetch phase 1 data with proper typing
      const phase1Response = await fetch(`/api/speedtraffic_staged?symbol=${symbol}&stage=phase1`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout for fast services
      });

      if (!phase1Response.ok) {
        throw new Error(`Phase 1 HTTP ${phase1Response.status}: ${phase1Response.statusText}`);
      }

      // Parse and type the phase 1 response
      const phase1Result = await phase1Response.json() as Phase1Result;
      console.log(`[SpeedTraffic] Phase 1 result:`, phase1Result);

      // Update lights 1-4 immediately after Phase 1 completes
      if (phase1Result.traffic_lights) {
        if (phase1Result.traffic_lights.technical) {
          setTechnicalLight(resultColorToStatus(phase1Result.traffic_lights.technical));
          console.log(`[SpeedTraffic] Technical light set to: ${phase1Result.traffic_lights.technical}`);
        }
        if (phase1Result.traffic_lights.industry) {
          setIndustryLight(resultColorToStatus(phase1Result.traffic_lights.industry));
          console.log(`[SpeedTraffic] Industry light set to: ${phase1Result.traffic_lights.industry}`);
        }
        if (phase1Result.traffic_lights.market) {
          setMarketLight(resultColorToStatus(phase1Result.traffic_lights.market));
          console.log(`[SpeedTraffic] Market light set to: ${phase1Result.traffic_lights.market}`);
        }
        if (phase1Result.traffic_lights.risk) {
          setRiskLight(resultColorToStatus(phase1Result.traffic_lights.risk));
          console.log(`[SpeedTraffic] Risk light set to: ${phase1Result.traffic_lights.risk}`);
        }
      }

      // Store Phase 1 results
      setAllResults(prev => ({
        ...prev,
        symbol,
        mfi: phase1Result.mfi,
        bollinger: phase1Result.bollinger,
        rsi: phase1Result.rsi,
        industry: phase1Result.industry,
        capm: phase1Result.capm,
        garch: phase1Result.garch,
        traffic_lights: {
          ...prev.traffic_lights,
          ...phase1Result.traffic_lights
        }
      }));

      setPhase1Loading(false);
      console.log(`[SpeedTraffic] Phase 1 completed successfully for ${symbol}`);

      // Send Phase 1 completion message to chat
      onPhaseMessage?.('기술적 분석, 산업 민감도, 시장 민감도, 변동성 리스크 분석을 마쳤어요! 📊');

      // Wait 1.5 seconds before starting Phase 2
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Send Phase 2 entry message to chat
      onPhaseMessage?.('이제 딥러닝 기반 가격 변동 예측을 진행합니다. 잠시만 기다려 주세요! 🤖');

      // Phase 2: Execute LSTM service
      setPhase2Loading(true);
      setLstmLoading(true);
      console.log(`[SpeedTraffic] Phase 2: Starting LSTM service for ${symbol}`);

      // Start 20-second timer for Korean timeout message
      const timeoutTimer = setTimeout(() => {
        setShowTimeoutMessage(true);
      }, 20000);

      // Fetch phase 2 data with proper typing
      const phase2Response = await fetch(`/api/speedtraffic_staged?symbol=${symbol}&stage=phase2`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(60000), // 60 second timeout for LSTM
      });

      clearTimeout(timeoutTimer);

      if (!phase2Response.ok) {
        throw new Error(`Phase 2 HTTP ${phase2Response.status}: ${phase2Response.statusText}`);
      }

      // Parse and type the phase 2 response
      const phase2Result = await phase2Response.json() as Phase2Result;
      console.log(`[SpeedTraffic] Phase 2 result:`, phase2Result);

      // Check LSTM accuracy and set appropriate states
      // Accuracy is a float between 0 and 1, where 1 means perfect accuracy
      const lstmAccuracy = phase2Result.lstm?.accuracy;
      const LOW_ACCURACY_THRESHOLD = 0.4; // Threshold for low accuracy warning (40%)
      
      // Only disable when accuracy is exactly 0.00
      const isAccuracyInsufficient = lstmAccuracy !== undefined && lstmAccuracy === 0;
      // Show warning when accuracy is between 0 and 0.4 (exclusive)
      const isLowAccuracy = lstmAccuracy !== undefined && lstmAccuracy > 0 && lstmAccuracy < LOW_ACCURACY_THRESHOLD;
      
      setInsufficientAccuracy(isAccuracyInsufficient);
      
      // Add a property to track if we should show low accuracy warning
      if (phase2Result.lstm) {
        phase2Result.lstm = {
          ...phase2Result.lstm,
          showLowAccuracyWarning: isLowAccuracy
        };
      }

      // Update light 5 after Phase 2 completes
      if (phase2Result.traffic_lights?.neural) {
        // If accuracy is insufficient, force neural light to inactive (gray)
        const neuralStatus = isAccuracyInsufficient 
          ? 'inactive' 
          : resultColorToStatus(phase2Result.traffic_lights.neural);
        
        setNeuralLight(neuralStatus);
        console.log(`[SpeedTraffic] Neural light set to: ${neuralStatus}${isAccuracyInsufficient ? ' (insufficient accuracy)' : ''}`);
      }

      // Store Phase 2 results and save complete analysis
      const finalResults: AnalysisResults = {
        symbol,
        companyName: getCompanyName(symbol),
        timestamp: new Date().toISOString(),
        analysisDate: new Date().toISOString().split('T')[0],
        // Include all metrics from both phases
        lstm: phase2Result.lstm,
        mfi: phase1Result.mfi || allResults.mfi,
        bollinger: phase1Result.bollinger || allResults.bollinger,
        rsi: phase1Result.rsi || allResults.rsi,
        industry: phase1Result.industry || allResults.industry,
        capm: phase1Result.capm || allResults.capm,
        garch: phase1Result.garch || allResults.garch,
        traffic_lights: {
          // Merge traffic lights from both phases, with phase 2 taking precedence
          ...(phase1Result.traffic_lights || {}),
          ...(phase2Result.traffic_lights || {})
        }
      };

      // Log the final results for debugging
      console.log('[SpeedTraffic] Final analysis results:', JSON.stringify(finalResults, null, 2));

      // JSON 저장 로직 제거됨 - 더 이상 분석 결과를 파일로 저장하지 않음

      setPhase2Loading(false);
      setLstmLoading(false);
      console.log(`[SpeedTraffic] Phase 2 completed successfully for ${symbol}`);

      // Notify parent component of analysis completion
      onAnalysisComplete?.(finalResults);

      // Send Phase 2 completion message to chat
      onPhaseMessage?.('모든 분석이 완료되었습니다! 결과를 확인해 보세요. ✨');

      // Wait 1.5 seconds, then display report prompt
      setTimeout(() => {
        onPhaseMessage?.('모든 데이터가 준비되었네요. SpeedTraffic 분석 보고서가 필요하신가요? 📊', true);
      }, 1500);

      console.log(`[SpeedTraffic] All phases completed successfully for ${symbol}`);

    } catch (error) {
      console.error('Staged prediction error:', error);

      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          setPredictionError('요청 시간 초과');
        } else {
          setPredictionError(`예측 실패: ${error.message}`);
        }
      } else {
        setPredictionError('예측 서비스 연결 실패');
      }

      // Reset all lights to inactive on error
      setTechnicalLight('inactive');
      setIndustryLight('inactive');
      setMarketLight('inactive');
      setRiskLight('inactive');
      setNeuralLight('inactive');

    } finally {
      setPhase1Loading(false);
      setPhase2Loading(false);
      setLstmLoading(false);
      setShowTimeoutMessage(false);
      inFlight.current = false;
    }
  };

  // Effects
  useEffect(() => {
    if (symbol) {
      // When symbol is provided, fetch staged prediction once
      fetchStagedPrediction();
    } else {
      // When no symbol, fetch market data initially
      fetchMarketData();
    }
  }, [symbol]);

  // 20초마다 시장 데이터 업데이트 (Pre-ticker mode only)
  useEffect(() => {
    if (!symbol) {
      const interval = setInterval(() => {
        fetchMarketData();
      }, 20000);

      return () => clearInterval(interval);
    }
  }, [symbol]);

  // Utility functions for rendering
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
          </svg>
        );
      case 'down':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-9.2 9.2M7 7v10h10" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        );
    }
  };

  const getChangeColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-slate-500';
    }
  };

  const getTrafficLightColor = (status: 'good' | 'warning' | 'danger') => {
    switch (status) {
      case 'good': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'danger': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: 'good' | 'warning' | 'danger' | 'inactive') => {
    switch (status) {
      case 'good': return '양호';
      case 'warning': return '보통';
      case 'danger': return '주의';
      case 'inactive': return '비활성화';
      default: return '분석중';
    }
  };

  // Post-ticker mode: Traffic lights display
  if (symbol) {
    // Determine if we should show insufficient accuracy message
    const showInsufficientAccuracy = insufficientAccuracy && 
      technicalLight !== 'inactive' && 
      industryLight !== 'inactive' && 
      marketLight !== 'inactive' && 
      riskLight !== 'inactive';

    return (
      <div className="space-y-4 max-w-full overflow-hidden">
        {/* SpeedTraffic™ 브랜딩 */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-blue-600 bg-clip-text">
            SpeedTraffic™
          </h2>
        </div>



        {/* 5-Light 신호등 시스템 */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-7 shadow-xl border border-slate-700">
          <div className="space-y-5">
            {/* Light 1: Technical Analysis */}
            <div>
              <div className="flex items-center justify-between group">
                <div className="flex items-center space-x-5">
                  <div className="relative flex-shrink-0">
                    <div className={`w-6 h-6 rounded-full ${
                      technicalLight === 'inactive' ? 'bg-gray-500' : getTrafficLightColor(technicalLight)
                    } shadow-lg transition-colors duration-300`}></div>
                  </div>
                  <span className={`text-sm font-medium truncate ${
                    technicalLight === 'inactive' ? 'text-gray-400' : 'text-white group-hover:text-blue-300'
                  } transition-colors`}>
                    기술적 분석
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${
                  technicalLight === 'inactive' ? 'text-gray-400 bg-gray-800/50' :
                  technicalLight === 'good' ? 'text-green-300 bg-green-900/30' :
                  technicalLight === 'warning' ? 'text-yellow-300 bg-yellow-900/30' :
                  'text-red-300 bg-red-900/30'
                }`}>
                  {technicalLight === 'inactive' ? '분석중' : getStatusText(technicalLight)}
                </span>
              </div>
            </div>

            {/* Light 2: Industry Sensitivity */}
            <div>
              <div className="flex items-center justify-between group">
                <div className="flex items-center space-x-5">
                  <div className="relative flex-shrink-0">
                    <div className={`w-6 h-6 rounded-full ${
                      industryLight === 'inactive' ? 'bg-gray-500' : getTrafficLightColor(industryLight)
                    } shadow-lg transition-colors duration-300`}></div>
                  </div>
                  <span className={`text-sm font-medium ${
                    industryLight === 'inactive' ? 'text-gray-400' : 'text-white group-hover:text-blue-300'
                  } transition-colors`}>
                    산업 민감도
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${
                  industryLight === 'inactive' ? 'text-gray-400 bg-gray-800/50' :
                  industryLight === 'good' ? 'text-green-300 bg-green-900/30' :
                  industryLight === 'warning' ? 'text-yellow-300 bg-yellow-900/30' :
                  'text-red-300 bg-red-900/30'
                }`}>
                  {industryLight === 'inactive' ? '분석중' : getStatusText(industryLight)}
                </span>
              </div>
            </div>

            {/* Light 3: Market Sensitivity (CAPM) */}
            <div>
              <div className="flex items-center justify-between group">
                <div className="flex items-center space-x-5">
                  <div className="relative flex-shrink-0">
                    <div className={`w-6 h-6 rounded-full ${
                      marketLight === 'inactive' ? 'bg-gray-500' : getTrafficLightColor(marketLight)
                    } shadow-lg transition-colors duration-300`}></div>
                  </div>
                  <span className={`text-sm font-medium ${
                    marketLight === 'inactive' ? 'text-gray-400' : 'text-white group-hover:text-blue-300'
                  } transition-colors`}>
                    시장 민감도
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${
                  marketLight === 'inactive' ? 'text-gray-400 bg-gray-800/50' :
                  marketLight === 'good' ? 'text-green-300 bg-green-900/30' :
                  marketLight === 'warning' ? 'text-yellow-300 bg-yellow-900/30' :
                  'text-red-300 bg-red-900/30'
                }`}>
                  {marketLight === 'inactive' ? '분석중' : getStatusText(marketLight)}
                </span>
              </div>
            </div>

            {/* Light 4: Volatility Risk */}
            <div>
              <div className="flex items-center justify-between group">
                <div className="flex items-center space-x-5">
                  <div className="relative flex-shrink-0">
                    <div className={`w-6 h-6 rounded-full ${
                      riskLight === 'inactive' ? 'bg-gray-500' : getTrafficLightColor(riskLight)
                    } shadow-lg transition-colors duration-300`}></div>
                  </div>
                  <span className={`text-sm font-medium ${
                    riskLight === 'inactive' ? 'text-gray-400' : 'text-white group-hover:text-blue-300'
                  } transition-colors`}>
                    변동성 리스크
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${
                  riskLight === 'inactive' ? 'text-gray-400 bg-gray-800/50' :
                  riskLight === 'good' ? 'text-green-300 bg-green-900/30' :
                  riskLight === 'warning' ? 'text-yellow-300 bg-yellow-900/30' :
                  'text-red-300 bg-red-900/30'
                }`}>
                  {riskLight === 'inactive' ? '분석중' : getStatusText(riskLight)}
                </span>
              </div>
            </div>

            {/* Light 5: Neural Network Prediction (LSTM) */}
            <div>
              <div className="flex items-center justify-between group">
                <div className="flex items-center space-x-5">
                  <div className="relative flex-shrink-0">
                    <div className={`w-6 h-6 rounded-full ${
                      insufficientAccuracy ? 'bg-gray-500' : 
                      neuralLight === 'inactive' ? 'bg-gray-500' : getTrafficLightColor(neuralLight)
                    } shadow-lg transition-colors duration-300`}></div>
                    {lstmLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400 border-t-transparent"></div>
                      </div>
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    insufficientAccuracy ? 'text-gray-400' :
                    neuralLight === 'inactive' ? 'text-gray-400' : 'text-white group-hover:text-blue-300'
                  } transition-colors`}>
                    신경망 예측
                  </span>
                </div>
                <div className="flex items-center">
                  {lstmLoading ? (
                    <span className="text-xs text-gray-400">분석 중...</span>
                  ) : insufficientAccuracy ? (
                    <span className="text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap text-gray-400 bg-gray-800/50">
                      정확도 부족
                    </span>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${
                      neuralLight === 'inactive' ? 'text-gray-400 bg-gray-800/50' :
                      neuralLight === 'good' ? 'text-green-300 bg-green-900/30' :
                      neuralLight === 'warning' ? 'text-yellow-300 bg-yellow-900/30' :
                      'text-red-300 bg-red-900/30'
                    }`}>
                      {neuralLight === 'inactive' ? '대기중' : getStatusText(neuralLight)}
                    </span>
                  )}
                </div>
              </div>
              {insufficientAccuracy ? (
                <div className="mt-2 text-xs text-gray-400 text-center">
                  신경망 예측 정확도가 충분하지 않아 비활성화 되었습니다.
                </div>
              ) : allResults.lstm?.showLowAccuracyWarning && (
                <div className="mt-2 text-xs text-yellow-400 text-center">
                  주의: 정확도가 미흡합니다
                </div>
              )}
            </div>
          </div>
        </div>





        {/* Phase 2 Loading State */}
        {phase2Loading && (
          <div className="bg-slate-100 rounded-lg p-4">
            <div className="flex items-center justify-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-sm text-slate-600">
                딥러닝 기반 예측(LSTM) 분석 중...
              </span>
            </div>
          </div>
        )}

        {/* Korean Timeout Message */}
        {showTimeoutMessage && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <div className="text-xs text-yellow-600 text-center">
              이 작업은 시간이 걸립니다... (최대 60초)
            </div>
          </div>
        )}

        {/* Error Display */}
        {predictionError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-xs text-red-600">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>오류: {predictionError}</span>
            </div>
          </div>
        )}

        {/* Retry Button */}
        {predictionError && !phase1Loading && !phase2Loading && (
          <div className="text-center">
            <button
              onClick={fetchStagedPrediction}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}


      </div>
    );
  }

  // Pre-ticker mode: Market indicators display
  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">시장 현황</h3>
        <div className={`w-2 h-2 rounded-full animate-pulse ${loading ? 'bg-yellow-400' : 'bg-green-400'}`}></div>
      </div>

      {/* 지표 목록 */}
      <div className="space-y-3">
        {loading && indicators.length === 0 ? (
          // 로딩 스켈레톤
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-100 animate-pulse">
              <div className="flex items-center justify-between mb-1">
                <div className="h-4 bg-slate-200 rounded w-16"></div>
                <div className="w-4 h-4 bg-slate-200 rounded"></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="h-6 bg-slate-200 rounded w-20"></div>
                <div className="h-4 bg-slate-200 rounded w-12"></div>
              </div>
            </div>
          ))
        ) : (
          indicators.map((indicator, index) => (
          <div
            key={index}
            className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors duration-200"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-700">{indicator.label}</span>
              {getTrendIcon(indicator.trend)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-slate-900">{indicator.value}</span>
              <span className={`text-sm font-medium ${getChangeColor(indicator.trend)}`}>
                {indicator.change}
              </span>
            </div>
          </div>
          ))
        )}
      </div>

      {/* 푸터 */}
      <div className="pt-3 border-t border-slate-200">
        <div className="flex items-center justify-center space-x-2 text-xs text-slate-500">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {loading ? '업데이트 중...' :
             lastUpdate ? `마지막 업데이트: ${lastUpdate}` :
             '20초마다 업데이트'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SpeedTraffic;

