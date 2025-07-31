/**
 * Company Utilities Module
 * 
 * This module provides utility functions for company-related operations including:
 * - Company data lookup and validation
 * - Pattern matching for user responses
 * - Company name formatting
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


