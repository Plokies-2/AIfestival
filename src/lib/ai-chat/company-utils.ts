/**
 * Company Utilities Module
 * 
 * This module provides utility functions for company-related operations including:
 * - Random investment recommendation generation
 * - Company data lookup and validation
 * - Pattern matching for user responses
 * - Company name translation and formatting
 */

import { QUICK_ENRICHED_FINAL as DATA } from '@/data/sp500_enriched_final';
import { RandomRecommendation, CompanyRecommendation, CompanyData } from './types';
import { PATTERNS } from './config';
import { getAllAvailableIndustries } from './rag-service';

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

/**
 * Determines response type based on user input
 */
export function getResponseType(text: string): 'positive' | 'negative' | 'neutral' {
  if (isPositive(text)) return 'positive';
  if (isNegative(text)) return 'negative';
  return 'neutral';
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
// Random Recommendation Generation
// ============================================================================

/**
 * Generates random investment recommendation (performance optimized)
 */
export function generateRandomRecommendation(): RandomRecommendation {
  const allIndustries = getAllAvailableIndustries();
  const randomIndustry = allIndustries[Math.floor(Math.random() * allIndustries.length)];

  // Efficiently collect companies in the industry
  const industryCompanies: CompanyRecommendation[] = [];

  for (const [ticker, company] of Object.entries(DATA)) {
    const comp = company as any;
    if (comp.industry === randomIndustry) {
      industryCompanies.push({
        ticker,
        name: comp.name,
        description: comp.description
      });
    }
  }

  // Fisher-Yates shuffle algorithm for performance optimization
  for (let i = industryCompanies.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [industryCompanies[i], industryCompanies[j]] = [industryCompanies[j], industryCompanies[i]];
  }

  return {
    industry: randomIndustry,
    companies: industryCompanies.slice(0, 3)
  };
}

/**
 * Generates multiple random recommendations
 */
export function generateMultipleRecommendations(count: number): RandomRecommendation[] {
  const recommendations: RandomRecommendation[] = [];
  const usedIndustries = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    let recommendation: RandomRecommendation;
    let attempts = 0;
    
    do {
      recommendation = generateRandomRecommendation();
      attempts++;
    } while (usedIndustries.has(recommendation.industry) && attempts < 10);
    
    usedIndustries.add(recommendation.industry);
    recommendations.push(recommendation);
  }
  
  return recommendations;
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

/**
 * 단순화된 기업 설명 포맷팅 (번역 제거)
 */
export function formatCompanyDescriptions(
  companies: CompanyRecommendation[]
): string {
  return companies
    .map(company => {
      // 영어 설명을 그대로 사용 (번역 제거)
      return `${company.name} (${company.ticker}): ${company.description}`;
    })
    .join('\n\n');
}

// ============================================================================
// Industry Statistics and Analysis
// ============================================================================

/**
 * Gets industry statistics
 */
export function getIndustryStats(): Record<string, number> {
  const industryCount: Record<string, number> = {};
  
  for (const company of Object.values(DATA)) {
    const comp = company as any;
    industryCount[comp.industry] = (industryCount[comp.industry] || 0) + 1;
  }
  
  return industryCount;
}

/**
 * Gets top industries by company count
 */
export function getTopIndustries(limit: number = 10): Array<{industry: string, count: number}> {
  const stats = getIndustryStats();
  
  return Object.entries(stats)
    .map(([industry, count]) => ({ industry, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Gets companies with longest descriptions (potentially most detailed)
 */
export function getCompaniesWithDetailedDescriptions(limit: number = 10): Array<{
  ticker: string;
  name: string;
  industry: string;
  descriptionLength: number;
}> {
  const companies = Object.entries(DATA)
    .map(([ticker, company]) => {
      const comp = company as any;
      return {
        ticker,
        name: comp.name,
        industry: comp.industry,
        descriptionLength: comp.description.length
      };
    })
    .sort((a, b) => b.descriptionLength - a.descriptionLength)
    .slice(0, limit);
    
  return companies;
}

// ============================================================================
// Search and Filtering Utilities
// ============================================================================

/**
 * Searches companies by partial name match
 */
export function searchCompaniesByName(query: string, limit: number = 10): Array<{
  ticker: string;
  name: string;
  industry: string;
  relevanceScore: number;
}> {
  const normalizedQuery = query.toLowerCase().trim();
  const results: Array<{
    ticker: string;
    name: string;
    industry: string;
    relevanceScore: number;
  }> = [];
  
  for (const [ticker, company] of Object.entries(DATA)) {
    const comp = company as any;
    const normalizedName = comp.name.toLowerCase();
    
    let relevanceScore = 0;
    
    // Exact match gets highest score
    if (normalizedName === normalizedQuery) {
      relevanceScore = 100;
    }
    // Starts with query gets high score
    else if (normalizedName.startsWith(normalizedQuery)) {
      relevanceScore = 80;
    }
    // Contains query gets medium score
    else if (normalizedName.includes(normalizedQuery)) {
      relevanceScore = 60;
    }
    // Word match gets lower score
    else {
      const nameWords = normalizedName.split(' ');
      const queryWords = normalizedQuery.split(' ');
      
      for (const queryWord of queryWords) {
        for (const nameWord of nameWords) {
          if (nameWord.includes(queryWord) && queryWord.length > 2) {
            relevanceScore = Math.max(relevanceScore, 40);
          }
        }
      }
    }
    
    if (relevanceScore > 0) {
      results.push({
        ticker,
        name: comp.name,
        industry: comp.industry,
        relevanceScore
      });
    }
  }
  
  return results
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

/**
 * Filters companies by industry and optional name query
 */
export function filterCompanies(
  industry?: string,
  nameQuery?: string,
  limit: number = 50
): Array<{ticker: string, data: CompanyData}> {
  let companies = Object.entries(DATA).map(([ticker, company]) => {
    const comp = company as any;
    return {
      ticker,
      data: {
        name: comp.name,
        industry: comp.industry,
        description: comp.description
      }
    };
  });
  
  // Filter by industry if specified
  if (industry) {
    companies = companies.filter(({ data }) => data.industry === industry);
  }
  
  // Filter by name query if specified
  if (nameQuery) {
    const normalizedQuery = nameQuery.toLowerCase().trim();
    companies = companies.filter(({ data }) => 
      data.name.toLowerCase().includes(normalizedQuery)
    );
  }
  
  return companies.slice(0, limit);
}

// ============================================================================
// Data Validation Utilities
// ============================================================================

/**
 * Validates company data integrity
 */
export function validateCompanyData(): {
  totalCompanies: number;
  validCompanies: number;
  invalidCompanies: string[];
  missingFields: Record<string, string[]>;
} {
  const totalCompanies = Object.keys(DATA).length;
  let validCompanies = 0;
  const invalidCompanies: string[] = [];
  const missingFields: Record<string, string[]> = {};
  
  for (const [ticker, company] of Object.entries(DATA)) {
    const comp = company as any;
    const missing: string[] = [];
    
    if (!comp.name || comp.name.trim() === '') missing.push('name');
    if (!comp.industry || comp.industry.trim() === '') missing.push('industry');
    if (!comp.description || comp.description.trim() === '') missing.push('description');
    
    if (missing.length > 0) {
      invalidCompanies.push(ticker);
      missingFields[ticker] = missing;
    } else {
      validCompanies++;
    }
  }
  
  return {
    totalCompanies,
    validCompanies,
    invalidCompanies,
    missingFields
  };
}

/**
 * Gets dataset statistics
 */
export function getDatasetStats(): {
  totalCompanies: number;
  totalIndustries: number;
  averageDescriptionLength: number;
  longestCompanyName: string;
  shortestCompanyName: string;
} {
  const companies = Object.values(DATA) as any[];
  const industries = new Set(companies.map(c => c.industry));
  
  const descriptionLengths = companies.map(c => c.description.length);
  const averageDescriptionLength = descriptionLengths.reduce((a, b) => a + b, 0) / descriptionLengths.length;
  
  const companyNames = companies.map(c => c.name);
  const longestCompanyName = companyNames.reduce((a, b) => a.length > b.length ? a : b);
  const shortestCompanyName = companyNames.reduce((a, b) => a.length < b.length ? a : b);
  
  return {
    totalCompanies: companies.length,
    totalIndustries: industries.size,
    averageDescriptionLength: Math.round(averageDescriptionLength),
    longestCompanyName,
    shortestCompanyName
  };
}
