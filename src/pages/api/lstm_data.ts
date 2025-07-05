// src/pages/api/lstm_data.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';

interface LSTMDataResponse {
  success: boolean;
  data?: {
    symbol: string;
    timestamp: string;
    prediction_data: {
      shock_level: string;
      shock_description: string;
      last_prediction: number;
      accuracy: number;
      model_type: string;
      sequence_length: number;
      prediction_count: number;
    };
    accuracy_metrics: {
      mae: number;
      mse: number;
      rmse: number;
      directional_accuracy: number;
      sign_change_points: number;
    };
    analysis: {
      explanation: string;
      detailed_results: any;
      ai_summary: string;
    };
    metadata: {
      created_at: string;
      expires_at: string;
      version: string;
    };
  };
  error?: string;
  available_symbols?: string[];
}

/**
 * API endpoint for AI chat to access LSTM prediction data
 * 
 * GET /api/lstm_data?symbol=AAPL - Get LSTM data for specific symbol
 * GET /api/lstm_data?action=list - Get list of available symbols
 * GET /api/lstm_data?symbol=AAPL&format=summary - Get AI-friendly summary
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LSTMDataResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET.'
    });
  }

  const { symbol, action, format } = req.query;

  try {
    // Handle list action - get all available symbols
    if (action === 'list') {
      const symbols = await getAvailableSymbols();
      return res.status(200).json({
        success: true,
        available_symbols: symbols
      });
    }

    // Validate symbol parameter
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Symbol parameter is required'
      });
    }

    const symbolUpper = symbol.toUpperCase();

    // Get LSTM data for symbol
    const lstmData = await getLSTMData(symbolUpper);
    
    if (!lstmData) {
      return res.status(404).json({
        success: false,
        error: `No LSTM data found for symbol ${symbolUpper}`
      });
    }

    // Handle summary format for AI consumption
    if (format === 'summary') {
      const summary = lstmData.analysis?.ai_summary || 'No summary available';
      return res.status(200).json({
        success: true,
        data: {
          ...lstmData,
          analysis: {
            ...lstmData.analysis,
            ai_summary: summary
          }
        }
      });
    }

    // Return full data
    return res.status(200).json({
      success: true,
      data: lstmData
    });

  } catch (error) {
    console.error('LSTM data API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while retrieving LSTM data'
    });
  }
}

/**
 * Get LSTM data for a specific symbol using Python data store
 */
async function getLSTMData(symbol: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), 'src', 'services', 'lstm_data_store.py');
    
    // Create a simple Python script call to get data
    const servicesPath = path.join(process.cwd(), 'src', 'services').replace(/\\/g, '/');
    const pythonCode = `
import sys
import os
sys.path.append('${servicesPath}')

try:
    from lstm_data_store import get_lstm_result
    import json

    result = get_lstm_result('${symbol}')
    if result:
        print(json.dumps(result))
    else:
        print('null')
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    print('null')
`;

    const python = spawn('python', ['-c', pythonCode], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script error:', stderr);
        resolve(null);
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        resolve(result === null ? null : result);
      } catch (error) {
        console.error('JSON parse error:', error);
        resolve(null);
      }
    });

    python.on('error', (error) => {
      console.error('Python spawn error:', error);
      resolve(null);
    });
  });
}

/**
 * Get list of available symbols with LSTM data
 */
async function getAvailableSymbols(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const servicesPath = path.join(process.cwd(), 'src', 'services').replace(/\\/g, '/');
    const pythonCode = `
import sys
import os
sys.path.append('${servicesPath}')

try:
    from lstm_data_store import get_lstm_store
    import json

    store = get_lstm_store()
    symbols = store.get_all_symbols()
    print(json.dumps(symbols))
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    print('[]')
`;

    const python = spawn('python', ['-c', pythonCode], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script error:', stderr);
        resolve([]);
        return;
      }

      try {
        const symbols = JSON.parse(stdout.trim());
        resolve(Array.isArray(symbols) ? symbols : []);
      } catch (error) {
        console.error('JSON parse error:', error);
        resolve([]);
      }
    });

    python.on('error', (error) => {
      console.error('Python spawn error:', error);
      resolve([]);
    });
  });
}
