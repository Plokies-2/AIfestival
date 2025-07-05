import { NextApiRequest, NextApiResponse } from 'next';

// Staged execution API for SpeedTraffic component
// Phase 1: Fast services (Technical, Industry, Market, Volatility)
// Phase 2: LSTM service (Neural Network Prediction)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol, stage } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  if (!stage || (stage !== 'phase1' && stage !== 'phase2')) {
    return res.status(400).json({ error: 'Stage must be either "phase1" or "phase2"' });
  }

  const ticker = symbol.toUpperCase();

  try {
    // Delegate to the main API with stage parameter
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/lstm_prediction_simple?symbol=${ticker}&stage=${stage}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    res.status(200).json(result);

  } catch (error) {
    console.error(`[SPEEDTRAFFIC_STAGED] Error for ${ticker} stage ${stage}:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      error: 'Staged prediction failed',
      message: errorMessage,
      stage: stage,
      timestamp: new Date().toISOString()
    });
  }
}
