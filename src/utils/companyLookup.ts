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

/**
 * Convert company name to ticker symbol
 * @param companyName - Company name to convert (e.g., "삼성전자")
 * @returns Ticker symbol if found, or original input if not found
 */
export function getTickerFromCompanyName(companyName: string): string {
  const trimmedName = companyName.trim();

  // 정확한 이름 매칭 먼저 시도
  for (const [ticker, company] of Object.entries(QUICK_ENRICHED_FINAL)) {
    if (company.name === trimmedName) {
      return ticker;
    }
  }

  // 부분 매칭 시도 (첫 번째 매칭 결과 반환)
  const matches = searchCompaniesByName(trimmedName);
  if (matches.length > 0) {
    return matches[0];
  }

  // 매칭되지 않으면 원본 반환
  return companyName;
}

/**
 * Convert ticker to Yahoo Finance format for Korean stocks
 * @param ticker - KOSPI ticker (e.g., "005930")
 * @returns Yahoo Finance ticker (e.g., "005930.KS")
 */
export function getYahooFinanceTicker(ticker: string): string {
  // 이미 .KS가 붙어있으면 그대로 반환
  if (ticker.endsWith('.KS')) {
    return ticker;
  }

  // 지수 심볼은 그대로 반환 (^KS11, ^IXIC 등)
  if (ticker.startsWith('^')) {
    return ticker;
  }

  // KOSPI 티커인지 확인
  if (isValidTicker(ticker)) {
    return `${ticker}.KS`;
  }

  // 6자리 숫자면 한국 주식으로 간주
  if (/^\d{6}$/.test(ticker)) {
    return `${ticker}.KS`;
  }

  // 그 외는 그대로 반환
  return ticker;
}
