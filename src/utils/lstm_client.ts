// src/utils/lstm_client.ts
/**
 * Client-side utilities for LSTM prediction integration
 */

export interface LSTMAccuracyMetrics {
  mae: number;
  mse: number;
  rmse: number;
  directionalAccuracy: number;
  signChangePoints: number;
}

export interface LSTMDetailedResults {
  june_3_price?: number;
  june_4_actual?: number;
  june_4_predicted?: number;
  june_5_actual?: number;
  june_5_predicted?: number;
  actual_3_to_4_change?: number;
  predicted_3_to_4_change?: number;
  actual_4_to_5_change?: number;
  predicted_4_to_5_change?: number;
  june_3_to_4_correct?: boolean;
  june_4_to_5_correct?: boolean;
  total_points?: number;
  color_explanation?: string;
  volatility?: number;
  method?: string;
  error?: string;
}

// Legacy interface - kept for backward compatibility
export interface LSTMPredictionData {
  symbol: string;
  shockLevel?: 'none' | 'minor' | 'major'; // Deprecated
  lastPrediction?: number;
  accuracy?: number;
  timestamp?: string;
  modelType?: 'LSTM' | 'fallback';
  sequenceLength?: number;
  predictionCount?: number;
  installationStatus?: string;
  accuracyMetrics?: LSTMAccuracyMetrics;
  explanation?: string;
  detailedResults?: LSTMDetailedResults;
}

export interface LSTMPredictionResult {
  success: boolean;
  data?: any; // Updated to match new JSON schema
  error?: string;
  summary_ko?: string;
}

export interface LSTMProgressCallback {
  onProgress?: (message: string) => void;
  onDone?: (result: any) => void;
  onError?: (error: string) => void;
}

/**
 * Fetch LSTM prediction using Server-Sent Events
 */
export async function fetchLSTMPrediction(
  symbol: string,
  callbacks?: LSTMProgressCallback
): Promise<LSTMPredictionResult> {
  return new Promise((resolve) => {
    let resolved = false;

    // Make the POST request which will return SSE stream
    fetch('/api/lstm_prediction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ symbol }),
    }).then(response => {
      if (response.status === 429) {
        if (!resolved) {
          resolved = true;
          resolve({
            success: false,
            error: 'LSTM prediction already in progress for this symbol'
          });
        }
        return;
      }

      if (response.status === 405) {
        if (!resolved) {
          resolved = true;
          resolve({
            success: false,
            error: 'Method not allowed - API endpoint configuration error'
          });
        }
        return;
      }

      if (!response.ok) {
        if (!resolved) {
          resolved = true;
          resolve({
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`
          });
        }
        return;
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        if (!resolved) {
          resolved = true;
          resolve({
            success: false,
            error: 'Failed to get response stream'
          });
        }
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      const readStream = async () => {
        let currentEvent: string | null = null;
        let lastHeartbeat = Date.now();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log('SSE stream ended normally');
              break;
            }

            lastHeartbeat = Date.now();
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '') continue;

              if (line.startsWith('event: ')) {
                currentEvent = line.substring(7).trim();
                console.log(`SSE event type: ${currentEvent}`);
                continue;
              }

              if (line.startsWith('data: ')) {
                const data = line.substring(6).trim();
                console.log(`SSE data received: ${data.substring(0, 100)}...`);

                if (currentEvent === 'progress') {
                  // Treat both explicit progress event or simple text markers as progress
                  callbacks?.onProgress?.(data);
                } else if (currentEvent === 'error') {
                  // Error event
                  try {
                    const errObj = JSON.parse(data);
                    const errMsg = errObj.error || errObj.message || 'Unknown error';
                    callbacks?.onError?.(errMsg);
                  } catch {
                    callbacks?.onError?.(data);
                  }
                  if (!resolved) {
                    resolved = true;
                    resolve({ success: false, error: data });
                  }
                } else if (currentEvent === 'done' || !currentEvent) {
                  // Success event (done) or default event
                  try {
                    const result = JSON.parse(data);
                    console.log('[SSE] Successfully parsed result:', result);
                    callbacks?.onDone?.(result);
                    if (!resolved) {
                      resolved = true;
                      resolve({ success: true, data: result, summary_ko: result.summary_ko });
                    }
                  } catch (parseError) {
                    console.error('[SSE] JSON parse error for success event:', parseError, 'Data:', data);
                    // Only treat as error if the data actually contains error indicators
                    try {
                      const errorResult = JSON.parse(data);
                      if (errorResult.error || errorResult.message) {
                        // This is actually an error response
                        const errorMessage = errorResult.error || errorResult.message || data;
                        callbacks?.onError?.(errorMessage);
                        if (!resolved) {
                          resolved = true;
                          resolve({
                            success: false,
                            error: errorMessage
                          });
                        }
                      } else {
                        // JSON parse failed but no error indicators - treat as malformed success
                        console.warn('[SSE] Malformed success response, treating as error:', data);
                        callbacks?.onError?.('Malformed response from server');
                        if (!resolved) {
                          resolved = true;
                          resolve({
                            success: false,
                            error: 'Malformed response from server'
                          });
                        }
                      }
                    } catch (errorParseError) {
                      // Not valid JSON at all - treat as plain text error
                      console.warn('[SSE] Non-JSON response, treating as error:', data);
                      callbacks?.onError?.(data);
                      if (!resolved) {
                        resolved = true;
                        resolve({
                          success: false,
                          error: data
                        });
                      }
                    }
                    return;
                  }
                } else {
                  // Unknown event type
                  console.warn('[SSE] Unknown event type:', currentEvent, 'Data:', data);
                }
              }
            }
          }

          // If we reach here, stream ended without result
          if (!resolved) {
            resolved = true;
            resolve({
              success: false,
              error: 'Stream ended without result'
            });
          }
        } catch (streamError) {
          console.error('Stream reading error:', streamError);
          callbacks?.onError?.('Connection error');
          if (!resolved) {
            resolved = true;
            resolve({
              success: false,
              error: 'Connection error'
            });
          }
        }
      };

      readStream();

      // Timeout after 2 minutes
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reader.cancel();
          resolve({
            success: false,
            error: 'Request timeout'
          });
        }
      }, 120000);

    }).catch(error => {
      if (!resolved) {
        resolved = true;
        resolve({
          success: false,
          error: error.message
        });
      }
    });
  });
}

// Legacy functions - kept for backward compatibility but deprecated

/**
 * @deprecated Use result_color from new prediction schema instead
 */
export function shockLevelToTrafficStatus(shockLevel: 'none' | 'minor' | 'major'): 'good' | 'warning' | 'danger' {
  switch (shockLevel) {
    case 'none':
      return 'good';
    case 'minor':
      return 'warning';
    case 'major':
      return 'danger';
    default:
      return 'warning';
  }
}

/**
 * @deprecated Use summary_ko from new prediction schema instead
 */
export function shockLevelToDescription(shockLevel: 'none' | 'minor' | 'major'): string {
  switch (shockLevel) {
    case 'none':
      return '안정';
    case 'minor':
      return '주의';
    case 'major':
      return '위험';
    default:
      return '분석중';
  }
}

/**
 * Validate symbol format
 */
export function isValidSymbol(symbol: string): boolean {
  if (!symbol || typeof symbol !== 'string') {
    return false;
  }
  
  // Basic validation: 1-5 uppercase letters
  const symbolRegex = /^[A-Z]{1,5}$/;
  return symbolRegex.test(symbol.toUpperCase());
}

/**
 * Default symbols for testing
 */
export const DEFAULT_SYMBOLS = [
  'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA',
  'META', 'NVDA', 'NFLX', 'AMD', 'INTC'
];

/**
 * Get a random default symbol for testing
 */
export function getRandomSymbol(): string {
  return DEFAULT_SYMBOLS[Math.floor(Math.random() * DEFAULT_SYMBOLS.length)];
}
