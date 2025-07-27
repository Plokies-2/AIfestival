/**
 * LSTM Data Integration Service Module
 * 
 * This module handles all LSTM-related functionality including:
 * - Fetching LSTM prediction data for specific symbols
 * - Getting available LSTM symbols
 * - Enhancing responses with LSTM analysis
 * - Managing LSTM data integration with the chat pipeline
 */

import { LSTMData } from './types';
import { PERFORMANCE_CONFIG, ENV_CONFIG } from './config';
import { getCompanyName } from './rag-service';

// ============================================================================
// LSTM Data Fetching Functions
// ============================================================================

/**
 * Fetches LSTM data for a specific symbol
 */
export async function getLSTMDataForSymbol(symbol: string): Promise<LSTMData | null> {
  try {
    const response = await fetch(
      `${ENV_CONFIG.baseUrl}/api/lstm_data?symbol=${symbol}&format=summary`
    );
    
    if (!response.ok) {
      // 로그 최적화: 에러만 간단히 출력
      console.warn(`[LSTM] ${symbol} API failed: ${response.status}`);
      return null;
    }

    const result = await response.json();

    if (!result.success) {
      // 로그 최적화: 에러만 간단히 출력
      console.warn(`[LSTM] ${symbol} unsuccessful`);
      return null;
    }
    
    return result.data;
  } catch (error) {
    // 로그 최적화: 에러만 간단히 출력
    console.error(`[LSTM] ${symbol} failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Gets list of available LSTM symbols
 */
export async function getAvailableLSTMSymbols(): Promise<string[]> {
  try {
    const response = await fetch(
      `${ENV_CONFIG.baseUrl}/api/lstm_data?action=list`
    );
    
    if (!response.ok) {
      console.warn(`LSTM symbols API returned ${response.status}`);
      return [];
    }
    
    const result = await response.json();
    
    if (!result.success) {
      console.warn('LSTM symbols API returned unsuccessful result:', result);
      return [];
    }
    
    return result.available_symbols || [];
  } catch (error) {
    console.error('Failed to get available LSTM symbols:', error);
    return [];
  }
}

// ============================================================================
// LSTM Data Enhancement Functions
// ============================================================================

/**
 * Enhances response with LSTM data for multiple companies
 */
export async function enhanceResponseWithLSTMData(
  companies: string[], 
  response: string
): Promise<string> {
  try {
    const availableSymbols = await getAvailableLSTMSymbols();
    
    // Filter companies that have LSTM data and limit to prevent overwhelming response
    const lstmDataPromises = companies
      .filter(ticker => availableSymbols.includes(ticker))
      .slice(0, PERFORMANCE_CONFIG.maxLSTMEnhancement) // Limit to 2 companies to avoid overwhelming the response
      .map(ticker => getLSTMDataForSymbol(ticker));

    const lstmResults = await Promise.all(lstmDataPromises);
    const validResults = lstmResults.filter(result => result !== null) as LSTMData[];

    if (validResults.length > 0) {
      let lstmEnhancement = '\n\n🔮 **LSTM 실시간 분석 결과:**\n';

      for (const data of validResults) {
        const companyName = getCompanyName(data.symbol);
        lstmEnhancement += `\n**${companyName} (${data.symbol})**: ${data.analysis.ai_summary}`;
      }

      lstmEnhancement += '\n\n*LSTM 분석은 AI 기반 실시간 예측으로 참고용입니다.*';
      return response + lstmEnhancement;
    }

    return response;
  } catch (error) {
    // 로그 최적화: 에러만 간단히 출력
    console.error('[LSTM] Enhancement failed:', error instanceof Error ? error.message : error);
    return response; // Return original response on error
  }
}

/**
 * Gets detailed LSTM analysis for a single company
 */
export async function getDetailedLSTMAnalysis(symbol: string): Promise<{
  summary: string;
  details: string;
} | null> {
  try {
    const lstmData = await getLSTMDataForSymbol(symbol);
    
    if (!lstmData) {
      return null;
    }

    const companyName = getCompanyName(symbol);
    
    const summary = `📊 AI 분석 요약:\n${lstmData.analysis.ai_summary}\n`;
    
    const details = `- 충격 수준: ${lstmData.prediction_data.shock_level}\n` +
                   `- 예측 정확도: ${(lstmData.prediction_data.accuracy * 100).toFixed(2)}%\n` +
                   `- 모델 타입: ${lstmData.prediction_data.model_type}\n` +
                   `- 마지막 예측값: ${lstmData.prediction_data.last_prediction.toFixed(4)}\n` +
                   `- 충격 설명: ${lstmData.prediction_data.shock_description}`;

    return {
      summary,
      details
    };
  } catch (error) {
    console.error(`Failed to get detailed LSTM analysis for ${symbol}:`, error);
    return null;
  }
}

// ============================================================================
// LSTM Data Validation and Utilities
// ============================================================================

/**
 * Checks if LSTM data is available for a symbol
 */
export async function isLSTMDataAvailable(symbol: string): Promise<boolean> {
  try {
    const availableSymbols = await getAvailableLSTMSymbols();
    return availableSymbols.includes(symbol);
  } catch (error) {
    console.error(`Failed to check LSTM availability for ${symbol}:`, error);
    return false;
  }
}

/**
 * Gets LSTM data for multiple symbols in batch
 */
export async function getBatchLSTMData(symbols: string[]): Promise<Map<string, LSTMData>> {
  const results = new Map<string, LSTMData>();
  
  try {
    const availableSymbols = await getAvailableLSTMSymbols();
    const validSymbols = symbols.filter(symbol => availableSymbols.includes(symbol));
    
    const lstmDataPromises = validSymbols.map(async (symbol) => {
      const data = await getLSTMDataForSymbol(symbol);
      return { symbol, data };
    });

    const lstmResults = await Promise.all(lstmDataPromises);
    
    for (const { symbol, data } of lstmResults) {
      if (data) {
        results.set(symbol, data);
      }
    }
  } catch (error) {
    console.error('Failed to get batch LSTM data:', error);
  }
  
  return results;
}

/**
 * Formats LSTM data for display
 */
export function formatLSTMDataForDisplay(lstmData: LSTMData): string {
  const companyName = getCompanyName(lstmData.symbol);
  
  return `**${companyName} (${lstmData.symbol}) LSTM 분석**\n\n` +
         `📈 **AI 요약**: ${lstmData.analysis.ai_summary}\n\n` +
         `📊 **예측 정보**:\n` +
         `- 충격 수준: ${lstmData.prediction_data.shock_level}\n` +
         `- 예측 정확도: ${(lstmData.prediction_data.accuracy * 100).toFixed(2)}%\n` +
         `- 마지막 예측: ${lstmData.prediction_data.last_prediction.toFixed(4)}\n` +
         `- 모델: ${lstmData.prediction_data.model_type}\n\n` +
         `💡 **상세 설명**: ${lstmData.analysis.explanation}\n\n` +
         `⚠️ **충격 분석**: ${lstmData.prediction_data.shock_description}\n\n` +
         `*분석 시점: ${new Date(lstmData.timestamp).toLocaleString('ko-KR')}*`;
}

// ============================================================================
// LSTM Service Health Check
// ============================================================================

/**
 * Checks if LSTM service is available and responsive
 */
export async function checkLSTMServiceHealth(): Promise<{
  isAvailable: boolean;
  symbolCount: number;
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const symbols = await getAvailableLSTMSymbols();
    const responseTime = Date.now() - startTime;
    
    return {
      isAvailable: true,
      symbolCount: symbols.length,
      responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      isAvailable: false,
      symbolCount: 0,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// LSTM Data Caching (Optional Enhancement)
// ============================================================================

/**
 * Simple in-memory cache for LSTM symbols to reduce API calls
 */
class LSTMSymbolCache {
  private cache: string[] | null = null;
  private lastUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async getSymbols(): Promise<string[]> {
    const now = Date.now();
    
    if (this.cache && (now - this.lastUpdate) < this.CACHE_DURATION) {
      return this.cache;
    }
    
    try {
      this.cache = await getAvailableLSTMSymbols();
      this.lastUpdate = now;
      return this.cache;
    } catch (error) {
      // Return cached data if available, even if stale
      return this.cache || [];
    }
  }

  clearCache(): void {
    this.cache = null;
    this.lastUpdate = 0;
  }
}

// Export cached instance
export const lstmSymbolCache = new LSTMSymbolCache();

/**
 * Gets available LSTM symbols with caching
 */
export async function getCachedAvailableLSTMSymbols(): Promise<string[]> {
  return lstmSymbolCache.getSymbols();
}

// ============================================================================
// LSTM Integration Utilities
// ============================================================================

/**
 * Determines if LSTM enhancement should be applied based on context
 */
export function shouldEnhanceWithLSTM(
  companies: string[], 
  stage: string,
  userIntent?: string
): boolean {
  // Don't enhance for casual conversation
  if (userIntent === 'casual_chat' || userIntent === 'greeting') {
    return false;
  }
  
  // Don't enhance if no companies
  if (companies.length === 0) {
    return false;
  }
  
  // Enhance for investment-related stages
  return stage === 'SHOW_INDUSTRY' || stage === 'ASK_CHART';
}

/**
 * Creates a summary of LSTM availability for a list of companies
 */
export async function getLSTMAvailabilitySummary(companies: string[]): Promise<{
  totalCompanies: number;
  lstmAvailable: number;
  availableSymbols: string[];
  unavailableSymbols: string[];
}> {
  try {
    const availableSymbols = await getCachedAvailableLSTMSymbols();
    const available = companies.filter(symbol => availableSymbols.includes(symbol));
    const unavailable = companies.filter(symbol => !availableSymbols.includes(symbol));
    
    return {
      totalCompanies: companies.length,
      lstmAvailable: available.length,
      availableSymbols: available,
      unavailableSymbols: unavailable
    };
  } catch (error) {
    console.error('Failed to get LSTM availability summary:', error);
    return {
      totalCompanies: companies.length,
      lstmAvailable: 0,
      availableSymbols: [],
      unavailableSymbols: companies
    };
  }
}
