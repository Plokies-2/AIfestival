/**
 * Results storage utility for SpeedTraffic analysis data
 * Optimized for fine-tuning API consumption and ML model training workflows
 */

import fs from 'fs';
import path from 'path';
import { getCompanyName } from './companyLookup';

export interface AnalysisResults {
  // Metadata
  symbol: string;
  companyName: string;
  timestamp: string;
  analysisDate: string;
  
  // Service Results
  lstm?: {
    symbol: string;
    train_until: string;
    predictions: Array<{
      date: string;
      pred_prob_up: number;
      pred_prob_down: number;
      predicted_label: number;
      actual_label: number | null;
      prediction_horizon: number;
    }>;
    traffic_light: string;
    metrics: {
      accuracy?: number;
      precision?: number;
      recall?: number;
      f1_score?: number;
    };
    summary_ko?: string;
  };
  
  mfi?: {
    symbol: string;
    date: string;
    mfi_14: number;
    traffic_light: string;
    signal: string;
    summary_ko?: string;
  };
  
  bollinger?: {
    symbol: string;
    date: string;
    traffic_light: string;
    signal: string;
    summary_ko?: string;
  };
  
  rsi?: {
    symbol: string;
    date: string;
    traffic_light: string;
    signal: string;
    summary_ko?: string;
  };
  
  industry?: {
    symbol: string;
    date: string;
    traffic_light: string;
    signal: string;
    summary_ko?: string;
  };
  
  capm?: {
    symbol: string;
    date: string;
    traffic_light: string;
    signal: string;
    summary_ko?: string;
  };
  
  garch?: {
    symbol: string;
    date: string;
    traffic_light: string;
    signal: string;
    summary_ko?: string;
  };
  
  // Traffic Light Summary
  traffic_lights: {
    technical?: string;
    industry?: string;
    market?: string;
    risk?: string;
    neural?: string;
  };
  
  // Performance Summary
  overall_signal?: string;
  confidence_score?: number;
}

/**
 * Save comprehensive analysis results to JSON file
 * @param results - Complete analysis results object
 * @returns Promise<string> - Path to saved file
 */
export async function saveAnalysisResults(results: AnalysisResults): Promise<string> {
  try {
    // Ensure results directory exists
    const resultsDir = path.join(process.cwd(), 'src', 'data', 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Generate filename: SYMBOL_YYYY-MM-DD_HH-mm-ss.json
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${results.symbol}_${timestamp}.json`;
    const filepath = path.join(resultsDir, filename);
    
    // Add metadata
    const enrichedResults: AnalysisResults = {
      ...results,
      companyName: getCompanyName(results.symbol),
      timestamp: new Date().toISOString(),
      analysisDate: new Date().toISOString().split('T')[0],
    };
    
    // Write to file (overwrite if exists)
    fs.writeFileSync(filepath, JSON.stringify(enrichedResults, null, 2), 'utf8');
    
    console.log(`Analysis results saved to: ${filepath}`);
    return filepath;
    
  } catch (error) {
    console.error('Error saving analysis results:', error);
    throw error;
  }
}

/**
 * Load analysis results from JSON file
 * @param symbol - Stock symbol
 * @param timestamp - Optional timestamp, if not provided loads most recent
 * @returns Promise<AnalysisResults | null>
 */
export async function loadAnalysisResults(symbol: string, timestamp?: string): Promise<AnalysisResults | null> {
  try {
    const resultsDir = path.join(process.cwd(), 'src', 'data', 'results');
    
    if (!fs.existsSync(resultsDir)) {
      return null;
    }
    
    // Find matching files
    const files = fs.readdirSync(resultsDir)
      .filter(file => file.startsWith(`${symbol}_`) && file.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first
    
    if (files.length === 0) {
      return null;
    }
    
    // Use specific timestamp or most recent
    const targetFile = timestamp 
      ? files.find(file => file.includes(timestamp))
      : files[0];
    
    if (!targetFile) {
      return null;
    }
    
    const filepath = path.join(resultsDir, targetFile);
    const data = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(data) as AnalysisResults;
    
  } catch (error) {
    console.error('Error loading analysis results:', error);
    return null;
  }
}

/**
 * Get all analysis results for a symbol
 * @param symbol - Stock symbol
 * @returns Promise<AnalysisResults[]>
 */
export async function getAllAnalysisResults(symbol: string): Promise<AnalysisResults[]> {
  try {
    const resultsDir = path.join(process.cwd(), 'src', 'data', 'results');
    
    if (!fs.existsSync(resultsDir)) {
      return [];
    }
    
    const files = fs.readdirSync(resultsDir)
      .filter(file => file.startsWith(`${symbol}_`) && file.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first
    
    const results: AnalysisResults[] = [];
    
    for (const file of files) {
      try {
        const filepath = path.join(resultsDir, file);
        const data = fs.readFileSync(filepath, 'utf8');
        results.push(JSON.parse(data) as AnalysisResults);
      } catch (error) {
        console.error(`Error reading file ${file}:`, error);
      }
    }
    
    return results;
    
  } catch (error) {
    console.error('Error getting all analysis results:', error);
    return [];
  }
}

/**
 * Delete old analysis results, keeping only the most recent N files per symbol
 * @param symbol - Stock symbol
 * @param keepCount - Number of recent files to keep (default: 5)
 * @returns Promise<number> - Number of files deleted
 */
export async function cleanupOldResults(symbol: string, keepCount: number = 5): Promise<number> {
  try {
    const resultsDir = path.join(process.cwd(), 'src', 'data', 'results');
    
    if (!fs.existsSync(resultsDir)) {
      return 0;
    }
    
    const files = fs.readdirSync(resultsDir)
      .filter(file => file.startsWith(`${symbol}_`) && file.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first
    
    const filesToDelete = files.slice(keepCount);
    let deletedCount = 0;
    
    for (const file of filesToDelete) {
      try {
        const filepath = path.join(resultsDir, file);
        fs.unlinkSync(filepath);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting file ${file}:`, error);
      }
    }
    
    return deletedCount;
    
  } catch (error) {
    console.error('Error cleaning up old results:', error);
    return 0;
  }
}
