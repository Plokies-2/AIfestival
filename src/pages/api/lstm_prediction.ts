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
      console.log(`[LSTM_API] Cleaning up stale processing entry for ${symbol}`);
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
  console.log(`[LSTM_API] Recorded failure ${failures} for ${symbol}`);
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.body;

  if (!symbol) {
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
    res.setHeader('Retry-After', '15');
    return res.status(429).json({ status: 'processing' });
  }

  // Set processing flag
  processing.set(ticker, { active: true, startTime: Date.now() });

  // Track if response has been sent
  let responseSent = false;

  // Cleanup function
  const cleanup = () => {
    processing.delete(ticker);
    if (!responseSent) {
      responseSent = true;
      try {
        res.end();
      } catch (error) {
        console.error(`[LSTM_API] Error ending response for ${ticker}:`, error);
      }
    }
  };

  // Handle client disconnect
  req.on('close', () => {
    console.log(`[LSTM_API] Client disconnected for ${ticker}`);
    cleanup();
  });

  req.on('error', (error) => {
    console.error(`[LSTM_API] Request error for ${ticker}:`, error);
    cleanup();
  });

  try {
    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Set up heartbeats
    const lstmHeartbeat = setInterval(() => {
      res.write('event: progress\ndata: lstm working\n\n');
    }, 5000);

    const mfiHeartbeat = setInterval(() => {
      res.write('event: progress\ndata: mfi working\n\n');
    }, 1000);

    // Paths to service scripts
    const lstmScriptPath = path.join(process.cwd(), 'src', 'services', 'lstm_service.py');
    const mfiScriptPath = path.join(process.cwd(), 'src', 'services', 'mfi_service.py');

    // Validate script paths exist
    if (!fs.existsSync(lstmScriptPath)) {
      console.error(`[LSTM_API] LSTM script not found: ${lstmScriptPath}`);
      recordFailure(ticker);
      return res.status(500).json({ error: 'LSTM service script not found' });
    }

    if (!fs.existsSync(mfiScriptPath)) {
      console.error(`[LSTM_API] MFI script not found: ${mfiScriptPath}`);
      recordFailure(ticker);
      return res.status(500).json({ error: 'MFI service script not found' });
    }

    // Log process startup
    console.log(`[LSTM_API] Starting processes for ${ticker}`);
    console.log(`[LSTM_API] LSTM script path: ${lstmScriptPath}`);
    console.log(`[LSTM_API] MFI script path: ${mfiScriptPath}`);
    console.log(`[LSTM_API] Working directory: ${process.cwd()}`);

    // Spawn both processes in parallel with correct working directory
    const servicesDir = path.join(process.cwd(), 'src', 'services');

    console.log(`[LSTM_API] About to spawn LSTM process: python ${lstmScriptPath} ${ticker}`);
    console.log(`[LSTM_API] LSTM process cwd: ${servicesDir}`);

    const lstmProcess = spawn('python', [lstmScriptPath, ticker], {
      cwd: servicesDir,  // Run from services directory
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    console.log(`[LSTM_API] About to spawn MFI process: python ${mfiScriptPath} ${ticker}`);
    console.log(`[LSTM_API] MFI process cwd: ${servicesDir}`);

    const mfiProcess = spawn('python', [mfiScriptPath, ticker], {
      cwd: servicesDir,  // Run from services directory
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    console.log(`[LSTM_API] LSTM process PID: ${lstmProcess.pid}`);
    console.log(`[LSTM_API] MFI process PID: ${mfiProcess.pid}`);

    let lstmStdout = '';
    let lstmStderr = '';
    let mfiStdout = '';
    let mfiStderr = '';
    let lstmResult: any = null;
    let mfiResult: any = null;
    let lstmCompleted = false;
    let mfiCompleted = false;
    let lstmResultParsed = false;  // Track if LSTM result was successfully parsed
    let mfiResultParsed = false;   // Track if MFI result was successfully parsed

    // Handle LSTM stdout and forward progress lines
    lstmProcess.stdout.on('data', (data) => {
      const output = data.toString();
      lstmStdout += output;
      console.log(`[LSTM_API] LSTM stdout chunk: ${output.trim()}`);

      // Forward lines starting with "Epoch" or "💡"
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.startsWith('Epoch') || line.startsWith('💡')) {
          res.write(`event: progress\ndata: lstm:${line}\n\n`);
        }
      }
    });

    // Handle MFI stdout
    mfiProcess.stdout.on('data', (data) => {
      const output = data.toString();
      mfiStdout += output;
      console.log(`[MFI_API] MFI stdout chunk: ${output.trim()}`);
    });

    // Collect stderr from both processes
    lstmProcess.stderr.on('data', (data) => {
      const error = data.toString();
      lstmStderr += error;
      console.log(`[LSTM_API] LSTM stderr: ${error.trim()}`);
    });

    mfiProcess.stderr.on('data', (data) => {
      const error = data.toString();
      mfiStderr += error;
      console.log(`[MFI_API] MFI stderr: ${error.trim()}`);
    });

    // Function to check if both processes are complete and send final result
    const checkCompletion = () => {
      console.log(`[LSTM_API] checkCompletion called for ${ticker}`);
      console.log(`[LSTM_API] lstmCompleted: ${lstmCompleted}, mfiCompleted: ${mfiCompleted}`);
      console.log(`[LSTM_API] lstmResult:`, lstmResult ? 'EXISTS' : 'NULL');
      console.log(`[LSTM_API] mfiResult:`, mfiResult ? 'EXISTS' : 'NULL');
      console.log(`[LSTM_API] responseSent: ${responseSent}`);

      if (lstmCompleted && mfiCompleted) {
        console.log(`[LSTM_API] Both processes completed for ${ticker}, clearing intervals and timeout`);
        clearInterval(lstmHeartbeat);
        clearInterval(mfiHeartbeat);
        clearTimeout(timeout);

        if (!responseSent) {
          console.log(`[LSTM_API] Checking results for ${ticker} - LSTM: ${!!lstmResult}, MFI: ${!!mfiResult}`);

          // Additional debugging: log the actual result types
          console.log(`[LSTM_API] LSTM result type: ${typeof lstmResult}, truthy: ${!!lstmResult}`);
          console.log(`[LSTM_API] MFI result type: ${typeof mfiResult}, truthy: ${!!mfiResult}`);

          if (lstmResult && mfiResult) {
            console.log(`[LSTM_API] Both results exist, sending success for ${ticker}`);
          } else {
            console.log(`[LSTM_API] One or both results missing for ${ticker} - LSTM: ${!!lstmResult}, MFI: ${!!mfiResult}`);
            // Log the actual values for debugging
            console.log(`[LSTM_API] LSTM result value:`, lstmResult);
            console.log(`[LSTM_API] MFI result value:`, mfiResult);
          }

          if (lstmResult && mfiResult) {
            // Merge results
            const mergedResult = {
              lstm: lstmResult,
              mfi: mfiResult
            };



            // Send success event
            try {
              res.write(`event: done\ndata: ${JSON.stringify(mergedResult)}\n\n`);
              responseSent = true;
              res.end();
            } catch (writeError) {
              console.error(`[LSTM_API] Error writing success response for ${ticker}:`, writeError);
              cleanup();
            }
          } else {
            // Record failure for circuit breaker
            recordFailure(ticker);

            // Create a proper error response object
            const errorResponse = {
              error: "One or both processes failed",
              lstm_success: !!lstmResult,
              mfi_success: !!mfiResult,
              timestamp: new Date().toISOString()
            };

            try {
              res.write(`event: error\ndata: ${JSON.stringify(errorResponse)}\n\n`);
              responseSent = true;
              res.end();
            } catch (writeError) {
              console.error(`[LSTM_API] Error writing error response for ${ticker}:`, writeError);
              cleanup();
            }
          }
        }

        processing.delete(ticker);
      }
    };

    // Set timeout to kill processes after 120 seconds
    const timeout = setTimeout(() => {
      if (!responseSent) {
        lstmProcess.kill('SIGTERM');
        mfiProcess.kill('SIGTERM');
        clearInterval(lstmHeartbeat);
        clearInterval(mfiHeartbeat);
        try {
          const timeoutResponse = {
            error: "Processes timed out",
            timeout_seconds: 120,
            timestamp: new Date().toISOString()
          };
          res.write(`event: error\ndata: ${JSON.stringify(timeoutResponse)}\n\n`);
          responseSent = true;
          res.end();
        } catch (error) {
          console.error(`[LSTM_API] Error writing timeout response for ${ticker}:`, error);
        }
        processing.delete(ticker);
      }
    }, 120000);

    // Handle LSTM process completion
    lstmProcess.on('close', (code: number) => {
      console.log(`[LSTM_API] LSTM process closed for ${ticker} with code ${code}`);
      console.log(`[LSTM_API] LSTM stdout length: ${lstmStdout.length}`);
      console.log(`[LSTM_API] LSTM stderr length: ${lstmStderr.length}`);

      // Prevent duplicate processing if already completed
      if (lstmCompleted) {
        console.log(`[LSTM_API] LSTM already completed for ${ticker}, skipping close handler`);
        return;
      }

      if (code === 0) {
        console.log(`[LSTM_API] LSTM stdout content: ${lstmStdout}`);
        try {
          // Parse the JSON output from the last line
          const lines = lstmStdout.trim().split('\n').filter(line => line.trim());
          console.log(`[LSTM_API] LSTM output lines count: ${lines.length}`);

          // Find the line that looks like JSON (starts with '{')
          let jsonLine = null;
          console.log(`[LSTM_API] Searching for JSON in ${lines.length} lines for ${ticker}`);
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            console.log(`[LSTM_API] Line ${i}: "${line.substring(0, 50)}..."`);
            if (line.startsWith('{')) {
              jsonLine = line;
              console.log(`[LSTM_API] Found JSON line at index ${i} for ${ticker}: ${line.substring(0, 100)}...`);
              break;
            }
          }

          if (!jsonLine) {
            console.error(`[LSTM_API] No JSON line found in LSTM stdout for ${ticker}`);
            console.error(`[LSTM_API] All lines:`, lines);
            throw new Error('No JSON output found in LSTM stdout');
          }

          console.log(`[LSTM_API] LSTM JSON line: ${jsonLine}`);
          const jsonOutput = JSON.parse(jsonLine);

          // Add Korean summary
          if (jsonOutput.predictions) {
            jsonOutput.summary_ko = getKoreanSummary(jsonOutput.predictions);
          }

          lstmResult = jsonOutput;
          lstmResultParsed = true;  // Mark as successfully parsed
          console.log(`[LSTM_API] LSTM result parsed successfully for ${ticker}`);

          // Send LSTM completion event immediately for progressive display
          if (!responseSent) {
            try {
              const lstmCompletionEvent = {
                type: 'lstm_complete',
                lstm: lstmResult
              };
              const eventData = `lstm_complete:${JSON.stringify(lstmCompletionEvent)}`;
              console.log(`[LSTM_API] Sending LSTM completion event for ${ticker}:`, eventData);
              res.write(`event: progress\ndata: ${eventData}\n\n`);
              console.log(`[LSTM_API] LSTM completion event sent successfully for ${ticker}`);
            } catch (writeError) {
              console.error(`[LSTM_API] Error writing LSTM completion event for ${ticker}:`, writeError);
            }
          }

          // Mark LSTM as completed AFTER successful parsing
          lstmCompleted = true;
          checkCompletion();
        } catch (parseError) {
          console.error(`[LSTM_API] LSTM JSON parse error for ${ticker}:`, parseError);
          console.error(`[LSTM_API] LSTM stdout for parsing: ${lstmStdout}`);
          console.error(`[LSTM_API] LSTM stdout lines:`, lstmStdout.trim().split('\n'));
          lstmResult = null;
          // Mark LSTM as completed even on parse error
          lstmCompleted = true;
          checkCompletion();
        }
      } else {
        console.error(`[LSTM_API] LSTM process failed for ${ticker} with code ${code}`);
        console.error(`[LSTM_API] LSTM stderr:`, lstmStderr);
        lstmResult = null;
        // Mark LSTM as completed on process failure
        lstmCompleted = true;
        checkCompletion();
      }
    });

    // Handle MFI process completion
    mfiProcess.on('close', (code: number) => {
      console.log(`[MFI_API] MFI process closed for ${ticker} with code ${code}`);
      console.log(`[MFI_API] MFI stdout length: ${mfiStdout.length}`);
      console.log(`[MFI_API] MFI stderr length: ${mfiStderr.length}`);

      // Prevent duplicate processing if already completed
      if (mfiCompleted) {
        console.log(`[MFI_API] MFI already completed for ${ticker}, skipping close handler`);
        return;
      }

      if (code === 0) {
        console.log(`[MFI_API] MFI stdout content: ${mfiStdout}`);
        try {
          // Parse the JSON output - find the JSON line
          const lines = mfiStdout.trim().split('\n').filter(line => line.trim());
          console.log(`[MFI_API] MFI output lines count: ${lines.length}`);

          // Find the line that looks like JSON (starts with '{')
          let jsonLine = null;
          console.log(`[MFI_API] Searching for JSON in ${lines.length} lines for ${ticker}`);
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            console.log(`[MFI_API] Line ${i}: "${line.substring(0, 50)}..."`);
            if (line.startsWith('{')) {
              jsonLine = line;
              console.log(`[MFI_API] Found JSON line at index ${i} for ${ticker}: ${line.substring(0, 100)}...`);
              break;
            }
          }

          if (!jsonLine) {
            console.error(`[MFI_API] No JSON line found in MFI stdout for ${ticker}`);
            console.error(`[MFI_API] All lines:`, lines);
            throw new Error('No JSON output found in MFI stdout');
          }

          console.log(`[MFI_API] MFI JSON line: ${jsonLine}`);
          const jsonOutput = JSON.parse(jsonLine);
          mfiResult = jsonOutput;
          mfiResultParsed = true;  // Mark as successfully parsed
          console.log(`[MFI_API] MFI result parsed successfully for ${ticker}`);

          // Send MFI completion event immediately for progressive display
          if (!responseSent) {
            try {
              const mfiCompletionEvent = {
                type: 'mfi_complete',
                mfi: mfiResult
              };
              const eventData = `mfi_complete:${JSON.stringify(mfiCompletionEvent)}`;
              console.log(`[MFI_API] Sending MFI completion event for ${ticker}:`, eventData);
              res.write(`event: progress\ndata: ${eventData}\n\n`);
              console.log(`[MFI_API] MFI completion event sent successfully for ${ticker}`);
            } catch (writeError) {
              console.error(`[MFI_API] Error writing MFI completion event for ${ticker}:`, writeError);
            }
          }

          // Mark MFI as completed AFTER successful parsing
          mfiCompleted = true;
          clearInterval(mfiHeartbeat);
          checkCompletion();
        } catch (parseError) {
          console.error(`[MFI_API] MFI JSON parse error for ${ticker}:`, parseError);
          console.error(`[MFI_API] MFI stdout for parsing: ${mfiStdout}`);
          console.error(`[MFI_API] MFI stdout lines:`, mfiStdout.trim().split('\n'));
          mfiResult = null;
          // Mark MFI as completed even on parse error
          mfiCompleted = true;
          clearInterval(mfiHeartbeat);
          checkCompletion();
        }
      } else {
        console.error(`[MFI_API] MFI process failed for ${ticker} with code ${code}`);
        console.error(`[MFI_API] MFI stderr:`, mfiStderr);
        mfiResult = null;
        // Mark MFI as completed on process failure
        mfiCompleted = true;
        clearInterval(mfiHeartbeat);
        checkCompletion();
      }
    });

    // Handle process errors
    lstmProcess.on('error', (error) => {
      console.error(`[LSTM_API] LSTM process error for ${ticker}:`, error);
      // Prevent duplicate processing if already completed
      if (lstmCompleted) {
        console.log(`[LSTM_API] LSTM already completed for ${ticker}, skipping error handler`);
        return;
      }
      // Only reset result if we haven't successfully parsed one yet
      if (!lstmResultParsed) {
        lstmResult = null;
      }
      lstmCompleted = true;
      clearInterval(lstmHeartbeat);
      checkCompletion();
    });

    mfiProcess.on('error', (error) => {
      console.error(`[MFI_API] MFI process error for ${ticker}:`, error);
      // Prevent duplicate processing if already completed
      if (mfiCompleted) {
        console.log(`[MFI_API] MFI already completed for ${ticker}, skipping error handler`);
        return;
      }
      // Only reset result if we haven't successfully parsed one yet
      if (!mfiResultParsed) {
        mfiResult = null;
      }
      mfiCompleted = true;
      clearInterval(mfiHeartbeat);
      checkCompletion();
    });

    // Handle unexpected process exits
    lstmProcess.on('exit', (code, signal) => {
      if (signal) {
        console.log(`[LSTM_API] LSTM process killed with signal ${signal} for ${ticker}`);
      }
      if (!lstmCompleted) {
        console.warn(`[LSTM_API] LSTM process exited unexpectedly for ${ticker} (code: ${code}, signal: ${signal})`);
        // Only reset result if we haven't successfully parsed one yet
        if (!lstmResultParsed) {
          lstmResult = null;
        }
        lstmCompleted = true;
        clearInterval(lstmHeartbeat);
        checkCompletion();
      }
    });

    mfiProcess.on('exit', (code, signal) => {
      if (signal) {
        console.log(`[MFI_API] MFI process killed with signal ${signal} for ${ticker}`);
      }
      if (!mfiCompleted) {
        console.warn(`[MFI_API] MFI process exited unexpectedly for ${ticker} (code: ${code}, signal: ${signal})`);
        // Only reset result if we haven't successfully parsed one yet
        if (!mfiResultParsed) {
          mfiResult = null;
        }
        mfiCompleted = true;
        clearInterval(mfiHeartbeat);
        checkCompletion();
      }
    });

  } catch (error) {
    console.error(`[LSTM_API] Error processing ${ticker}:`, error);
    if (!responseSent) {
      try {
        const errorResponse = {
          error: "Internal server error",
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        };
        res.write(`event: error\ndata: ${JSON.stringify(errorResponse)}\n\n`);
        responseSent = true;
        res.end();
      } catch (writeError) {
        console.error(`[LSTM_API] Error writing error response for ${ticker}:`, writeError);
      }
    }
    processing.delete(ticker);
  }
}
