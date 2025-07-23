import { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Per-symbol mutex using in-memory Map with timestamps
const processing = new Map<string, { active: boolean; startTime: number }>();

// Circuit breaker pattern - track failures per symbol
const failureCount = new Map<string, number>();
const lastFailureTime = new Map<string, number>();
const FAILURE_THRESHOLD = 3;
const CIRCUIT_BREAKER_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Cleanup stale processing entries (older than 5 minutes)
const cleanupStaleProcessing = () => {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  for (const [symbol, info] of processing.entries()) {
    if (info.active && (now - info.startTime) > fiveMinutes) {
      console.log(`[LSTM_SIMPLE_API] Cleaning up stale processing entry for ${symbol}`);
      processing.delete(symbol);
    }
  }
};

// Check if circuit breaker is open for a symbol
const isCircuitBreakerOpen = (symbol: string): boolean => {
  const failures = failureCount.get(symbol) || 0;
  const lastFailure = lastFailureTime.get(symbol) || 0;
  const now = Date.now();

  if (failures >= FAILURE_THRESHOLD) {
    if (now - lastFailure < CIRCUIT_BREAKER_TIMEOUT) {
      return true; // Circuit breaker is open
    } else {
      // Reset circuit breaker after timeout
      failureCount.delete(symbol);
      lastFailureTime.delete(symbol);
      return false;
    }
  }
  return false;
};

// Record a failure for circuit breaker
const recordFailure = (symbol: string) => {
  const failures = (failureCount.get(symbol) || 0) + 1;
  failureCount.set(symbol, failures);
  lastFailureTime.set(symbol, Date.now());
  console.log(`[LSTM_SIMPLE_API] Recorded failure ${failures} for ${symbol}`);
};

// Run cleanup every minute
setInterval(cleanupStaleProcessing, 60 * 1000);

// Korean summary mapping
const getKoreanSummary = (predictions: any[]): string => {
  const correctCount = predictions.filter(p => p.predicted_label === p.actual_label).length;

  if (correctCount === 2) {
    return "모두 예측 성공 결과 : green";
  } else if (correctCount === 1) {
    return "2일 예측 중 1일 예측 실패 결과 : yellow";
  } else {
    return "모두 예측 실패 결과 : red";
  }
};

// Traffic light color determination
const getTrafficLightColor = (result: any, processType: 'LSTM' | 'MFI'): string => {
  if (processType === 'LSTM') {
    // Check for deactivation status first (accuracy 0 or 1)
    if (result.is_deactivated === true || result.traffic_light === 'inactive') {
      return 'inactive';
    }

    // Use the traffic_light field from LSTM service (probability-based)
    if (result.traffic_light) {
      return result.traffic_light.toLowerCase();
    }

    // Legacy fallback: accuracy-based calculation with deactivation logic
    if (result.predictions && Array.isArray(result.predictions)) {
      const correctCount = result.predictions.filter((p: any) => p.predicted_label === p.actual_label).length;
      // Deactivate if accuracy is 0 or 1
      if (correctCount <= 1) return 'inactive';
      if (correctCount === 2) return 'green';
      return 'yellow';
    }

    // Check accuracy field directly
    if (typeof result.accuracy === 'number' && result.accuracy <= 1) {
      return 'inactive';
    }

    // Final fallback
    return result.result_color || result.color || 'yellow';
  } else if (processType === 'MFI') {
    return result.traffic_light || result.color || 'yellow';
  }
  return 'yellow';
};

// Normalize LSTM accuracy to decimal format
const normalizeLSTMAccuracy = (rawAccuracy: number): number => {
  // Convert raw accuracy values to decimal format:
  // 3 correct predictions → 0.600 (3/5)
  // 2 correct predictions → 0.400 (2/5)
  // 5+ correct predictions → 1.00 (capped at 1.0)
  if (rawAccuracy >= 5) {
    return 1.0;
  }
  return Math.round((rawAccuracy / 5) * 1000) / 1000; // Round to 3 decimal places
};

// Calculate LSTM accuracy percentage
const calculateLSTMAccuracy = (result: any): number => {
  // For lstm_finetuning.py output, use the accuracy field directly
  if (typeof result.accuracy === 'number') {
    // If accuracy is already normalized (decimal), return as is
    if (result.accuracy <= 1.0) {
      return result.accuracy;
    }
    // If accuracy is raw count, normalize it
    return normalizeLSTMAccuracy(result.accuracy);
  }

  // Legacy fallback for lstm_service.py output
  if (!Array.isArray(result.predictions) || result.predictions.length === 0) return 0;
  const correctCount = result.predictions.filter((p: any) => p.predicted_label === p.actual_label).length;
  return normalizeLSTMAccuracy(correctCount);
};

// Get LSTM pred_prob_up value
const getLSTMPredProbUp = (result: any): number => {
  if (result.predictions && Array.isArray(result.predictions) && result.predictions.length > 0) {
    return result.predictions[0].pred_prob_up || 0;
  }
  return result.pred_prob_up || 0;
};

// Get MFI numerical value
const getMFIValue = (result: any): number => {
  return result.mfi_14 || result.mfi || 0;
};

// Get service-specific values for logging and fine-tuning
const getBollingerValue = (result: any): number => {
  return result.percent_b || result.bollinger_position || result.position || 0;
};

const getRSIValue = (result: any): number => {
  return result.rsi_14 || result.rsi || 0;
};

const getIndustryValue = (result: any): string => {
  return result.industry || result.industry_sentiment || result.sentiment || 'neutral';
};

const getGARCHValue = (result: any): number => {
  return result.var95_pct || result.var_pct || result.volatility_forecast || result.volatility || 0;
};



// Get traffic light color from service results
const getServiceTrafficLight = (result: any): string => {
  return result.traffic_light || result.color || 'yellow';
};

// Majority vote logic for technical analysis (MFI, Bollinger, RSI)
const getTechnicalMajorityVote = (mfiColor: string, bollingerColor: string, rsiColor: string): string => {
  const colors = [mfiColor, bollingerColor, rsiColor];
  const colorCounts = {
    green: colors.filter(c => c === 'green').length,
    yellow: colors.filter(c => c === 'yellow').length,
    red: colors.filter(c => c === 'red').length
  };

  // Return the color with the highest count
  if (colorCounts.green >= 2) return 'green';
  if (colorCounts.red >= 2) return 'red';
  return 'yellow'; // Default to yellow if no majority or all different
};



// Execute a process and return its result with enhanced logging
const executeProcess = (scriptPath: string, ticker: string, processName: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const servicesDir = path.join(process.cwd(), 'src', 'services');
    const startTime = Date.now();

    console.log(`[LSTM_SIMPLE_API] Starting ${processName} process for ${ticker}`);

    // Special handling for LSTM finetuning script which requires date parameter
    const args = processName === 'LSTM' ? [scriptPath, ticker, '2025-06-05'] : [scriptPath, ticker];

    const childProcess = spawn('python', args, {
      cwd: servicesDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code) => {
      const executionTime = Date.now() - startTime;
      console.log(`[LSTM_SIMPLE_API] ${processName} process closed for ${ticker} with code ${code} (${executionTime}ms)`);

      if (code === 0) {
        try {
          const lines = stdout.trim().split('\n').filter(line => line.trim());
          let jsonOutput: any;

          if (processName === 'LSTM') {
            // Parse LSTM finetuning output format: [LSTM accuracy: 3, Prediction probability up: 0.623, Traffic light: GREEN]
            let lstmResultLine = null;
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i].trim();
              if (line.startsWith('[LSTM accuracy:')) {
                lstmResultLine = line;
                break;
              }
            }

            if (!lstmResultLine) {
              throw new Error(`No LSTM result found in stdout`);
            }

            // Parse the LSTM result line
            const accuracyMatch = lstmResultLine.match(/accuracy:\s*(\d+)/);
            const probMatch = lstmResultLine.match(/probability up:\s*([\d.]+)/);
            const trafficMatch = lstmResultLine.match(/Traffic light:\s*(\w+)/);

            const rawAccuracy = accuracyMatch ? parseInt(accuracyMatch[1]) : 0;
            const probUp = probMatch ? parseFloat(probMatch[1]) : 0.0;
            const trafficLight = trafficMatch ? trafficMatch[1].toLowerCase() : 'red';

            jsonOutput = {
              accuracy: normalizeLSTMAccuracy(rawAccuracy), // Normalize accuracy to decimal format
              pred_prob_up: probUp,
              traffic_light: trafficLight,
              predictions: [] // Empty array for compatibility
            };
          } else {
            // Parse the JSON output from the last line for other services
            let jsonLine = null;
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i].trim();
              if (line.startsWith('{')) {
                jsonLine = line;
                break;
              }
            }

            if (!jsonLine) {
              throw new Error(`No JSON output found in ${processName} stdout`);
            }

            jsonOutput = JSON.parse(jsonLine);
          }

          // Enhanced result logging
          if (processName === 'LSTM') {
            const accuracy = calculateLSTMAccuracy(jsonOutput);
            const predProbUp = getLSTMPredProbUp(jsonOutput);
            const trafficLight = getTrafficLightColor(jsonOutput, 'LSTM');
            console.log(`[LSTM_RESULT] ${ticker} - Accuracy: ${accuracy}%, pred_prob_up: ${predProbUp}, Traffic Light: ${trafficLight.toUpperCase()}, Execution Time: ${executionTime}ms, Status: SUCCESS`);
          } else if (processName === 'MFI') {
            const mfiValue = getMFIValue(jsonOutput);
            const trafficLight = getTrafficLightColor(jsonOutput, 'MFI');
            console.log(`[MFI_RESULT] ${ticker} - MFI Value: ${mfiValue}, Traffic Light: ${trafficLight.toUpperCase()}, Execution Time: ${executionTime}ms, Status: SUCCESS`);
          } else if (processName === 'BOLLINGER') {
            const bollingerValue = getBollingerValue(jsonOutput);
            const trafficLight = getServiceTrafficLight(jsonOutput);
            console.log(`[BOLLINGER_RESULT] ${ticker} - Percent B: ${bollingerValue}, Traffic Light: ${trafficLight.toUpperCase()}, Execution Time: ${executionTime}ms, Status: SUCCESS`);
          } else if (processName === 'RSI') {
            const rsiValue = getRSIValue(jsonOutput);
            const trafficLight = getServiceTrafficLight(jsonOutput);
            console.log(`[RSI_RESULT] ${ticker} - RSI Value: ${rsiValue}, Traffic Light: ${trafficLight.toUpperCase()}, Execution Time: ${executionTime}ms, Status: SUCCESS`);
          } else if (processName === 'INDUSTRY') {
            const industryValue = getIndustryValue(jsonOutput);
            const trafficLight = getServiceTrafficLight(jsonOutput);
            console.log(`[INDUSTRY_RESULT] ${ticker} - Industry: ${industryValue}, Traffic Light: ${trafficLight.toUpperCase()}, Execution Time: ${executionTime}ms, Status: SUCCESS`);
          } else if (processName === 'GARCH') {
            const garchValue = getGARCHValue(jsonOutput);
            const trafficLight = getServiceTrafficLight(jsonOutput);
            console.log(`[GARCH_RESULT] ${ticker} - VaR %: ${garchValue}, Traffic Light: ${trafficLight.toUpperCase()}, Execution Time: ${executionTime}ms, Status: SUCCESS`);
          } else if (processName === 'CAPM') {
            const capmBeta = jsonOutput.beta_market || 0;
            const capmR2 = jsonOutput.r2_market || 0;
            const trafficLight = getServiceTrafficLight(jsonOutput);
            console.log(`[CAPM_RESULT] ${ticker} - Beta: ${capmBeta}, R²: ${capmR2}, Traffic Light: ${trafficLight.toUpperCase()}, Execution Time: ${executionTime}ms, Status: SUCCESS`);
          }

          resolve(jsonOutput);
        } catch (parseError) {
          console.error(`[${processName}_RESULT] ${ticker} - Status: PARSE_ERROR, Execution Time: ${executionTime}ms, Error: ${parseError}`);
          reject(new Error(`Failed to parse ${processName} output: ${parseError}`));
        }
      } else {
        console.error(`[${processName}_RESULT] ${ticker} - Status: PROCESS_FAILED, Execution Time: ${executionTime}ms, Exit Code: ${code}`);
        console.error(`[${processName}_RESULT] ${ticker} - stderr:`, stderr);
        reject(new Error(`${processName} process failed with code ${code}`));
      }
    });

    childProcess.on('error', (error) => {
      const executionTime = Date.now() - startTime;
      console.error(`[${processName}_RESULT] ${ticker} - Status: SPAWN_ERROR, Execution Time: ${executionTime}ms, Error: ${error.message}`);
      reject(new Error(`${processName} process error: ${error.message}`));
    });

    // Set timeout for individual process (60 seconds)
    setTimeout(() => {
      const executionTime = Date.now() - startTime;
      console.error(`[${processName}_RESULT] ${ticker} - Status: TIMEOUT, Execution Time: ${executionTime}ms`);
      childProcess.kill('SIGTERM');
      reject(new Error(`${processName} process timed out after 60 seconds`));
    }, 60000);
  });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  const ticker = symbol.toUpperCase();

  // Check circuit breaker
  if (isCircuitBreakerOpen(ticker)) {
    return res.status(503).json({
      error: 'Service temporarily unavailable due to repeated failures',
      retryAfter: Math.ceil(CIRCUIT_BREAKER_TIMEOUT / 1000)
    });
  }

  // Check if already processing
  const currentProcessing = processing.get(ticker);
  if (currentProcessing?.active) {
    return res.status(429).json({ 
      error: 'Already processing this symbol',
      retryAfter: 15
    });
  }

  // Set processing flag
  processing.set(ticker, { active: true, startTime: Date.now() });

  try {
    console.log(`[LSTM_SIMPLE_API] Starting prediction for ${ticker}`);

    // Check if this is a staged execution request
    const { stage } = req.query;

    // Paths to service scripts
    const lstmScriptPath = path.join(process.cwd(), 'src', 'services', 'lstm_finetuning.py');
    const mfiScriptPath = path.join(process.cwd(), 'src', 'services', 'mfi_service.py');
    const bollingerScriptPath = path.join(process.cwd(), 'src', 'services', 'bollinger_service.py');
    const rsiScriptPath = path.join(process.cwd(), 'src', 'services', 'rsi_service.py');
    const industryScriptPath = path.join(process.cwd(), 'src', 'services', 'industry_regression_service.py');
    const garchScriptPath = path.join(process.cwd(), 'src', 'services', 'garch_service.py');
    const capmScriptPath = path.join(process.cwd(), 'src', 'services', 'capm_service.py');

    // Staged execution: Phase 1 (Fast services) vs Phase 2 (LSTM)
    if (stage === 'phase1') {
      console.log(`[LSTM_SIMPLE_API] Starting Phase 1 (fast services) for ${ticker}`);

      // Execute Phase 1: Technical, Industry, Market, Volatility services in parallel
      const [mfiResult, bollingerResult, rsiResult, industryResult, capmResult, garchResult] = await Promise.allSettled([
        fs.existsSync(mfiScriptPath) ? executeProcess(mfiScriptPath, ticker, 'MFI') : Promise.resolve(null),
        fs.existsSync(bollingerScriptPath) ? executeProcess(bollingerScriptPath, ticker, 'BOLLINGER') : Promise.resolve(null),
        fs.existsSync(rsiScriptPath) ? executeProcess(rsiScriptPath, ticker, 'RSI') : Promise.resolve(null),
        fs.existsSync(industryScriptPath) ? executeProcess(industryScriptPath, ticker, 'INDUSTRY') : Promise.resolve(null),
        fs.existsSync(capmScriptPath) ? executeProcess(capmScriptPath, ticker, 'CAPM') : Promise.resolve(null),
        fs.existsSync(garchScriptPath) ? executeProcess(garchScriptPath, ticker, 'GARCH') : Promise.resolve(null)
      ]);

      // Extract results with error handling
      const finalMFIResult = mfiResult.status === 'fulfilled' ? mfiResult.value : null;
      const finalBollingerResult = bollingerResult.status === 'fulfilled' ? bollingerResult.value : null;
      const finalRSIResult = rsiResult.status === 'fulfilled' ? rsiResult.value : null;
      const finalIndustryResult = industryResult.status === 'fulfilled' ? industryResult.value : null;
      const finalCAPMResult = capmResult.status === 'fulfilled' ? capmResult.value : null;
      const finalGARCHResult = garchResult.status === 'fulfilled' ? garchResult.value : null;

      // Log any service failures
      if (mfiResult.status === 'rejected') console.error(`[MFI_ERROR] ${ticker}:`, mfiResult.reason);
      if (bollingerResult.status === 'rejected') console.error(`[BOLLINGER_ERROR] ${ticker}:`, bollingerResult.reason);
      if (rsiResult.status === 'rejected') console.error(`[RSI_ERROR] ${ticker}:`, rsiResult.reason);
      if (industryResult.status === 'rejected') console.error(`[INDUSTRY_ERROR] ${ticker}:`, industryResult.reason);
      if (capmResult.status === 'rejected') console.error(`[CAPM_ERROR] ${ticker}:`, capmResult.reason);
      if (garchResult.status === 'rejected') console.error(`[GARCH_ERROR] ${ticker}:`, garchResult.reason);

      // Calculate technical majority vote for traffic light
      const mfiColor = finalMFIResult ? getTrafficLightColor(finalMFIResult, 'MFI') : 'red';
      const bollingerColor = finalBollingerResult ? getServiceTrafficLight(finalBollingerResult) : 'red';
      const rsiColor = finalRSIResult ? getServiceTrafficLight(finalRSIResult) : 'red';
      const technicalColor = getTechnicalMajorityVote(mfiColor, bollingerColor, rsiColor);

      console.log(`[TECHNICAL_VOTE] ${ticker} - MFI: ${mfiColor}, Bollinger: ${bollingerColor}, RSI: ${rsiColor} → Technical: ${technicalColor.toUpperCase()}`);

      // Phase 1 result structure
      const phase1Result = {
        phase: 1,
        mfi: finalMFIResult,
        bollinger: finalBollingerResult,
        rsi: finalRSIResult,
        industry: finalIndustryResult,
        capm: finalCAPMResult,
        garch: finalGARCHResult,
        traffic_lights: {
          technical: technicalColor, // Light 1: Combined MFI + Bollinger + RSI
          industry: finalIndustryResult ? getServiceTrafficLight(finalIndustryResult) : 'inactive', // Light 2: Industry Sensitivity
          market: finalCAPMResult ? getServiceTrafficLight(finalCAPMResult) : 'inactive', // Light 3: Market Sensitivity (CAPM)
          risk: finalGARCHResult ? getServiceTrafficLight(finalGARCHResult) : 'inactive' // Light 4: Volatility Risk
        }
      };

      // 📊 Phase 1 상세 분석 결과 로그 출력
      console.log(`\n🎯 ===== ${ticker} Phase 1 분석 결과 상세 로그 =====`);

      // 1. Technical Analysis (RSI, Bollinger Bands, MFI)
      console.log(`📈 1. Technical Analysis (기술적 분석):`);
      console.log(`   - RSI: ${finalRSIResult ? JSON.stringify(finalRSIResult, null, 2) : 'N/A'}`);
      console.log(`   - Bollinger Bands: ${finalBollingerResult ? JSON.stringify(finalBollingerResult, null, 2) : 'N/A'}`);
      console.log(`   - MFI: ${finalMFIResult ? JSON.stringify(finalMFIResult, null, 2) : 'N/A'}`);
      console.log(`   - 종합 신호등: ${technicalColor}`);

      // 2. Industry Analysis
      console.log(`🏭 2. Industry Analysis (업종 비교 분석):`);
      console.log(`   - 결과: ${finalIndustryResult ? JSON.stringify(finalIndustryResult, null, 2) : 'N/A'}`);
      console.log(`   - 신호등: ${finalIndustryResult ? getServiceTrafficLight(finalIndustryResult) : 'inactive'}`);

      // 3. Market Analysis (CAPM)
      console.log(`📊 3. Market Analysis (시장 민감도 분석):`);
      console.log(`   - CAPM 결과: ${finalCAPMResult ? JSON.stringify(finalCAPMResult, null, 2) : 'N/A'}`);
      console.log(`   - 신호등: ${finalCAPMResult ? getServiceTrafficLight(finalCAPMResult) : 'inactive'}`);

      // 4. Risk Analysis (GARCH)
      console.log(`⚠️ 4. Risk Analysis (변동성 리스크 분석):`);
      console.log(`   - GARCH 결과: ${finalGARCHResult ? JSON.stringify(finalGARCHResult, null, 2) : 'N/A'}`);
      console.log(`   - 신호등: ${finalGARCHResult ? getServiceTrafficLight(finalGARCHResult) : 'inactive'}`);

      console.log(`🎯 ===== ${ticker} Phase 1 분석 완료 =====\n`);

      console.log(`[LSTM_SIMPLE_API] Phase 1 completed successfully for ${ticker}`);
      return res.status(200).json(phase1Result);

    } else if (stage === 'phase2') {
      console.log(`[LSTM_SIMPLE_API] Starting Phase 2 (LSTM) for ${ticker}`);

      // Validate LSTM script path exists
      if (!fs.existsSync(lstmScriptPath)) {
        throw new Error('LSTM service script not found');
      }

      // Execute Phase 2: LSTM service only
      const lstmResult = await executeProcess(lstmScriptPath, ticker, 'LSTM');

      // Add Korean summary to LSTM result
      if (lstmResult?.predictions) {
        lstmResult.summary_ko = getKoreanSummary(lstmResult.predictions);
      }

      // Phase 2 result structure
      const phase2Result = {
        phase: 2,
        lstm: lstmResult,
        traffic_lights: {
          neural: lstmResult ? getTrafficLightColor(lstmResult, 'LSTM') : 'red' // Light 5: Neural Network Prediction
        }
      };

      // 🤖 Phase 2 상세 분석 결과 로그 출력
      console.log(`\n🎯 ===== ${ticker} Phase 2 분석 결과 상세 로그 =====`);

      // 5. Neural Analysis (LSTM 예측)
      console.log(`🤖 5. Neural Analysis (딥러닝 기반 가격 변동 예측):`);
      if (lstmResult) {
        console.log(`   - 정확도: ${lstmResult.accuracy ? (lstmResult.accuracy * 100).toFixed(2) + '%' : 'N/A'}`);
        console.log(`   - 상승 확률: ${lstmResult.pred_prob_up ? (lstmResult.pred_prob_up * 100).toFixed(2) + '%' : 'N/A'}`);
        console.log(`   - 신호등: ${getTrafficLightColor(lstmResult, 'LSTM')}`);
        console.log(`   - 전체 결과: ${JSON.stringify(lstmResult, null, 2)}`);

        if (lstmResult.summary_ko) {
          console.log(`   - 한국어 요약: ${lstmResult.summary_ko}`);
        }
      } else {
        console.log(`   - 결과: N/A (LSTM 분석 실패)`);
      }

      console.log(`🎯 ===== ${ticker} Phase 2 분석 완료 =====\n`);

      console.log(`[LSTM_SIMPLE_API] Phase 2 completed successfully for ${ticker}`);
      return res.status(200).json(phase2Result);
    }

    // Legacy mode: Execute all processes in parallel (backward compatibility)
    console.log(`[LSTM_SIMPLE_API] Starting legacy mode (all services) for ${ticker}`);

    // Validate required script paths exist
    if (!fs.existsSync(lstmScriptPath)) {
      throw new Error('LSTM service script not found');
    }

    if (!fs.existsSync(mfiScriptPath)) {
      throw new Error('MFI service script not found');
    }

    // Execute all processes in parallel with graceful error handling
    const [lstmResult, mfiResult, bollingerResult, rsiResult, industryResult, capmResult, garchResult] = await Promise.allSettled([
      executeProcess(lstmScriptPath, ticker, 'LSTM'),
      executeProcess(mfiScriptPath, ticker, 'MFI'),
      fs.existsSync(bollingerScriptPath) ? executeProcess(bollingerScriptPath, ticker, 'BOLLINGER') : Promise.resolve(null),
      fs.existsSync(rsiScriptPath) ? executeProcess(rsiScriptPath, ticker, 'RSI') : Promise.resolve(null),
      fs.existsSync(industryScriptPath) ? executeProcess(industryScriptPath, ticker, 'INDUSTRY') : Promise.resolve(null),
      fs.existsSync(capmScriptPath) ? executeProcess(capmScriptPath, ticker, 'CAPM') : Promise.resolve(null),
      fs.existsSync(garchScriptPath) ? executeProcess(garchScriptPath, ticker, 'GARCH') : Promise.resolve(null)
    ]);

    // Extract results with error handling
    const finalLSTMResult = lstmResult.status === 'fulfilled' ? lstmResult.value : null;
    const finalMFIResult = mfiResult.status === 'fulfilled' ? mfiResult.value : null;
    const finalBollingerResult = bollingerResult.status === 'fulfilled' ? bollingerResult.value : null;
    const finalRSIResult = rsiResult.status === 'fulfilled' ? rsiResult.value : null;
    const finalIndustryResult = industryResult.status === 'fulfilled' ? industryResult.value : null;
    const finalCAPMResult = capmResult.status === 'fulfilled' ? capmResult.value : null;
    const finalGARCHResult = garchResult.status === 'fulfilled' ? garchResult.value : null;

    // Log any service failures
    if (lstmResult.status === 'rejected') console.error(`[LSTM_ERROR] ${ticker}:`, lstmResult.reason);
    if (mfiResult.status === 'rejected') console.error(`[MFI_ERROR] ${ticker}:`, mfiResult.reason);
    if (bollingerResult.status === 'rejected') console.error(`[BOLLINGER_ERROR] ${ticker}:`, bollingerResult.reason);
    if (rsiResult.status === 'rejected') console.error(`[RSI_ERROR] ${ticker}:`, rsiResult.reason);
    if (industryResult.status === 'rejected') console.error(`[INDUSTRY_ERROR] ${ticker}:`, industryResult.reason);
    if (capmResult.status === 'rejected') console.error(`[CAPM_ERROR] ${ticker}:`, capmResult.reason);
    if (garchResult.status === 'rejected') console.error(`[GARCH_ERROR] ${ticker}:`, garchResult.reason);

    // Add Korean summary to LSTM result
    if (finalLSTMResult?.predictions) {
      finalLSTMResult.summary_ko = getKoreanSummary(finalLSTMResult.predictions);
    }

    // Calculate technical majority vote for traffic light
    const mfiColor = finalMFIResult ? getTrafficLightColor(finalMFIResult, 'MFI') : 'red';
    const bollingerColor = finalBollingerResult ? getServiceTrafficLight(finalBollingerResult) : 'red';
    const rsiColor = finalRSIResult ? getServiceTrafficLight(finalRSIResult) : 'red';
    const technicalColor = getTechnicalMajorityVote(mfiColor, bollingerColor, rsiColor);

    console.log(`[TECHNICAL_VOTE] ${ticker} - MFI: ${mfiColor}, Bollinger: ${bollingerColor}, RSI: ${rsiColor} → Technical: ${technicalColor.toUpperCase()}`);

    // Note: Fine-tuning data is now saved by SpeedTraffic component after complete analysis

    // Merge results with enhanced structure (legacy mode)
    const mergedResult = {
      lstm: finalLSTMResult,
      mfi: finalMFIResult,
      bollinger: finalBollingerResult,
      rsi: finalRSIResult,
      industry: finalIndustryResult,
      capm: finalCAPMResult,
      garch: finalGARCHResult,
      traffic_lights: {
        technical: technicalColor, // Light 1: Combined MFI + Bollinger + RSI
        industry: finalIndustryResult ? getServiceTrafficLight(finalIndustryResult) : 'inactive', // Light 2: Industry Sensitivity
        market: finalCAPMResult ? getServiceTrafficLight(finalCAPMResult) : 'inactive', // Light 3: Market Sensitivity (CAPM)
        risk: finalGARCHResult ? getServiceTrafficLight(finalGARCHResult) : 'inactive', // Light 4: Volatility Risk
        neural: finalLSTMResult ? getTrafficLightColor(finalLSTMResult, 'LSTM') : 'red' // Light 5: Neural Network Prediction
      }
    };

    // 📊 전체 분석 결과 상세 로그 출력 (레거시 모드)
    console.log(`\n🎯 ===== ${ticker} 전체 분석 결과 상세 로그 (레거시 모드) =====`);

    // 1. Technical Analysis
    console.log(`📈 1. Technical Analysis (기술적 분석):`);
    console.log(`   - RSI: ${finalRSIResult ? JSON.stringify(finalRSIResult, null, 2) : 'N/A'}`);
    console.log(`   - Bollinger Bands: ${finalBollingerResult ? JSON.stringify(finalBollingerResult, null, 2) : 'N/A'}`);
    console.log(`   - MFI: ${finalMFIResult ? JSON.stringify(finalMFIResult, null, 2) : 'N/A'}`);
    console.log(`   - 종합 신호등: ${technicalColor}`);

    // 2. Industry Analysis
    console.log(`🏭 2. Industry Analysis (업종 비교 분석):`);
    console.log(`   - 결과: ${finalIndustryResult ? JSON.stringify(finalIndustryResult, null, 2) : 'N/A'}`);
    console.log(`   - 신호등: ${finalIndustryResult ? getServiceTrafficLight(finalIndustryResult) : 'inactive'}`);

    // 3. Market Analysis
    console.log(`📊 3. Market Analysis (시장 민감도 분석):`);
    console.log(`   - CAPM 결과: ${finalCAPMResult ? JSON.stringify(finalCAPMResult, null, 2) : 'N/A'}`);
    console.log(`   - 신호등: ${finalCAPMResult ? getServiceTrafficLight(finalCAPMResult) : 'inactive'}`);

    // 4. Risk Analysis
    console.log(`⚠️ 4. Risk Analysis (변동성 리스크 분석):`);
    console.log(`   - GARCH 결과: ${finalGARCHResult ? JSON.stringify(finalGARCHResult, null, 2) : 'N/A'}`);
    console.log(`   - 신호등: ${finalGARCHResult ? getServiceTrafficLight(finalGARCHResult) : 'inactive'}`);

    // 5. Neural Analysis
    console.log(`🤖 5. Neural Analysis (딥러닝 기반 가격 변동 예측):`);
    if (finalLSTMResult) {
      console.log(`   - 정확도: ${finalLSTMResult.accuracy ? (finalLSTMResult.accuracy * 100).toFixed(2) + '%' : 'N/A'}`);
      console.log(`   - 상승 확률: ${finalLSTMResult.pred_prob_up ? (finalLSTMResult.pred_prob_up * 100).toFixed(2) + '%' : 'N/A'}`);
      console.log(`   - 신호등: ${getTrafficLightColor(finalLSTMResult, 'LSTM')}`);
      console.log(`   - 전체 결과: ${JSON.stringify(finalLSTMResult, null, 2)}`);

      if (finalLSTMResult.summary_ko) {
        console.log(`   - 한국어 요약: ${finalLSTMResult.summary_ko}`);
      }
    } else {
      console.log(`   - 결과: N/A (LSTM 분석 실패)`);
    }

    // 종합 신호등 상태
    console.log(`🚦 종합 신호등 상태:`);
    Object.entries(mergedResult.traffic_lights).forEach(([key, value]) => {
      console.log(`   - ${key}: ${value}`);
    });

    console.log(`🎯 ===== ${ticker} 전체 분석 완료 =====\n`);

    console.log(`[LSTM_SIMPLE_API] Prediction completed successfully for ${ticker} with ${Object.keys(mergedResult.traffic_lights).length} traffic lights`);

    // Return the merged result
    res.status(200).json(mergedResult);

  } catch (error) {
    console.error(`[LSTM_SIMPLE_API] Prediction error for ${ticker}:`, error);
    
    // Record failure for circuit breaker
    recordFailure(ticker);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      error: 'Prediction failed',
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  } finally {
    // Clean up processing flag
    processing.delete(ticker);
  }
}
