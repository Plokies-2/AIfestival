/**
 * Company name lookup utility for KOSPI companies
 * Provides functions to get company names from ticker symbols
 */

import { KOSPI_ENRICHED_FINAL as QUICK_ENRICHED_FINAL } from '../data/kospi_enriched_final';

export interface CompanyInfo {
  name: string;
  description: string;
  industry: string;
}

/**
 * Get company name from ticker symbol
 * @param ticker - Stock ticker symbol (e.g., "AAPL")
 * @returns Company name or ticker if not found
 */
export function getCompanyName(ticker: string): string {
  const upperTicker = ticker.toUpperCase();
  const company = (QUICK_ENRICHED_FINAL as any)[upperTicker];
  return company?.name || ticker;
}

/**
 * Get full company information from ticker symbol
 * @param ticker - Stock ticker symbol (e.g., "AAPL")
 * @returns Company information object or null if not found
 */
export function getCompanyInfo(ticker: string): CompanyInfo | null {
  const upperTicker = ticker.toUpperCase();
  const company = (QUICK_ENRICHED_FINAL as any)[upperTicker];
  return company || null;
}

/**
 * Check if a ticker exists in the KOSPI data
 * @param ticker - Stock ticker symbol
 * @returns true if ticker exists, false otherwise
 */
export function isValidTicker(ticker: string): boolean {
  const upperTicker = ticker.toUpperCase();
  return upperTicker in QUICK_ENRICHED_FINAL;
}

/**
 * Get all available tickers
 * @returns Array of all ticker symbols
 */
export function getAllTickers(): string[] {
  return Object.keys(QUICK_ENRICHED_FINAL);
}

/**
 * Search companies by name (case-insensitive partial match)
 * @param searchTerm - Search term to match against company names
 * @returns Array of matching ticker symbols
 */
export function searchCompaniesByName(searchTerm: string): string[] {
  const lowerSearchTerm = searchTerm.toLowerCase();
  const matches: string[] = [];
  
  for (const [ticker, company] of Object.entries(QUICK_ENRICHED_FINAL)) {
    if (company.name.toLowerCase().includes(lowerSearchTerm)) {
      matches.push(ticker);
    }
  }
  
  return matches;
}
