/**
 * Company Utilities Module
 * 
 * This module provides utility functions for company-related operations including:
 * - Random investment recommendation generation
 * - Company data lookup and validation
 * - Pattern matching for user responses
 * - Company name translation and formatting
 */

import { KOSPI_ENRICHED_FINAL as DATA } from '@/data/kospi_enriched_final';
import { CompanyData } from './types';
import { PATTERNS } from './config';

// ============================================================================
// Pattern Matching Utilities
// ============================================================================

/**
 * Checks if text matches positive response patterns
 */
export function isPositive(text: string): boolean {
  return PATTERNS.positive.test(text.trim());
}

/**
 * Checks if text matches negative response patterns
 */
export function isNegative(text: string): boolean {
  return PATTERNS.negative.test(text.trim());
}



// ============================================================================
// Company Data Access Functions
// ============================================================================

/**
 * Safe company name lookup
 */
export function getCompanyName(ticker: string): string {
  const company = (DATA as any)[ticker];
  return company ? company.name : ticker;
}

/**
 * Gets complete company data safely
 */
export function getCompanyData(ticker: string): CompanyData | null {
  const company = (DATA as any)[ticker];
  return company ? {
    name: company.name,
    industry: company.industry,
    description: company.description
  } : null;
}

/**
 * Checks if a ticker exists in the dataset
 */
export function isValidTicker(ticker: string): boolean {
  return ticker in DATA;
}

/**
 * Gets all available tickers
 */
export function getAllTickers(): string[] {
  return Object.keys(DATA);
}

/**
 * Gets companies by industry
 */
export function getCompaniesByIndustry(industry: string): Array<{ticker: string, data: CompanyData}> {
  const companies: Array<{ticker: string, data: CompanyData}> = [];
  
  for (const [ticker, company] of Object.entries(DATA)) {
    const comp = company as any;
    if (comp.industry === industry) {
      companies.push({
        ticker,
        data: {
          name: comp.name,
          industry: comp.industry,
          description: comp.description
        }
      });
    }
  }
  
  return companies;
}

// 랜덤 기업 추천 기능 제거됨 - RAG 기반 투자 분석만 제공

// ============================================================================
// Company Name and Description Utilities
// ============================================================================

/**
 * Formats company name with ticker for display
 */
export function formatCompanyDisplay(ticker: string, includeIndustry: boolean = false): string {
  const company = getCompanyData(ticker);
  if (!company) return ticker;
  
  const base = `${company.name} (${ticker})`;
  return includeIndustry ? `${base} - ${company.industry}` : base;
}

/**
 * Creates a formatted company list for display
 */
export function formatCompanyList(
  tickers: string[],
  numbered: boolean = true,
  includeIndustry: boolean = false
): string {
  return tickers
    .map((ticker, index) => {
      const prefix = numbered ? `${index + 1}. ` : '• ';
      return prefix + formatCompanyDisplay(ticker, includeIndustry);
    })
    .join('\n');
}

// ============================================================================
// Industry Statistics and Analysis (사용되지 않는 함수들 제거됨)
// ============================================================================

// ============================================================================
// Search and Filtering Utilities
// ============================================================================

// ============================================================================
// Search and Filtering Utilities (사용되지 않는 함수들 제거됨)
// ============================================================================

// ============================================================================
// Data Validation Utilities (사용되지 않는 함수들 제거됨)
// ============================================================================
