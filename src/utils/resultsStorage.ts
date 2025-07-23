/**
 * Results storage utility for SpeedTraffic analysis data
 * JSON 저장 기능이 제거되어 현재는 타입 정의만 제공
 */

// JSON 저장 관련 import 제거됨
// import fs from 'fs';
// import path from 'path';
// import { getCompanyName } from './companyLookup';

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

// JSON 저장 기능 제거됨 - saveAnalysisResults 함수 삭제

// JSON 로드 기능 제거됨 - loadAnalysisResults 함수 삭제

// JSON 관련 기능 제거됨 - getAllAnalysisResults 함수 삭제

// JSON 관련 기능 제거됨 - cleanupOldResults 함수 삭제
