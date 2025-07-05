import { NextApiRequest, NextApiResponse } from 'next';
import { saveAnalysisResults, AnalysisResults } from '../../utils/resultsStorage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const results: AnalysisResults = req.body;
    
    if (!results.symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const filepath = await saveAnalysisResults(results);
    
    res.status(200).json({ 
      success: true, 
      message: 'Analysis results saved successfully',
      filepath 
    });
    
  } catch (error) {
    console.error('Error saving analysis results:', error);
    res.status(500).json({ 
      error: 'Failed to save analysis results',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
