/**
 * RAG (Retrieval-Augmented Generation) Service Module
 * 
 * This module handles all RAG-related functionality including:
 * - Industry matching using embeddings and cosine similarity
 * - Company finding and matching
 * - Korean-English translation mapping
 * - Embedding generation and similarity calculations
 */

import OpenAI from 'openai';
import { getEmbeddings, cosine } from '@/lib/embeddings';
import { QUICK_ENRICHED_FINAL as DATA } from '@/data/sp500_enriched_final';
import { IndustryMatchResult, RAGServiceError, CompanyData } from './types';
import { RAG_THRESHOLDS, QUICK_TRANSLATIONS, KOREAN_COMPANY_MAPPING, OPENAI_CONFIG, PERFORMANCE_CONFIG, ENV_CONFIG } from './config';
import { classifyIndustryWithGPT, translateKoreanToEnglish } from './ai-service';

// ============================================================================
// OpenAI Client for Embeddings
// ============================================================================

const openai = new OpenAI({ 
  apiKey: ENV_CONFIG.openaiApiKey 
});

// ============================================================================
// Cached Industry List
// ============================================================================

/**
 * Performance optimization: Runtime dynamic generation to save memory
 */
const getAvailableIndustries = (() => {
  let cached: string[] | null = null;
  return () => {
    if (!cached) {
      cached = [...new Set(Object.values(DATA).map((c: any) => c.industry))];
    }
    return cached;
  };
})();

// ============================================================================
// Industry Matching Functions
// ============================================================================

/**
 * Finds the best matching industry using RAG with threshold-based classification
 */
export async function findBestIndustry(userInput: string): Promise<string | null> {
  // Performance optimization: Simple Korean keyword mapping to minimize translation API calls
  let enhancedQuery = userInput;
  
  if (/[가-힣]/.test(userInput)) {
    // Quick keyword mapping (without API calls)
    let foundTranslation = false;
    const translationParts: string[] = [];

    for (const [korean, english] of Object.entries(QUICK_TRANSLATIONS)) {
      if (userInput.includes(korean)) {
        translationParts.push(english);
        foundTranslation = true;
      }
    }

    if (foundTranslation) {
      // Combine all matched translations
      enhancedQuery = `${userInput} ${translationParts.join(' ')}`;
      console.log(`Enhanced query with Korean mappings: "${enhancedQuery}"`);
    }

    // Only call API if not mapped and input is long enough (performance optimization)
    if (!foundTranslation && userInput.length > 10) {
      try {
        const translation = await translateKoreanToEnglish(userInput);
        if (translation) {
          enhancedQuery = `${userInput} ${translation}`;
        }
      } catch (error) {
        console.error('Translation failed:', error);
      }
    }
  }

  // RAG: Generate user input embedding
  const queryEmbedding = (await openai.embeddings.create({
    model: OPENAI_CONFIG.embeddingModel,
    input: enhancedQuery
  })).data[0].embedding;

  const normalizedQuery = queryEmbedding.map((v, _, arr) => v / Math.hypot(...arr));

  // RAG: Calculate cosine similarity with pre-computed industry embeddings
  const { industries } = await getEmbeddings();

  let bestIndustry: string | null = null;
  let bestScore = -1;

  for (const industry of industries) {
    const score = cosine(industry.vec, normalizedQuery);
    if (score > bestScore) {
      bestScore = score;
      bestIndustry = industry.industry;
    }
  }

  console.log(`RAG Best match: ${bestIndustry} with score: ${bestScore.toFixed(3)}`);

  // RAG threshold check: If industry level score is too low, try company level search
  if (bestScore < RAG_THRESHOLDS.COMPANY_MIN_SCORE) {
    console.log('Industry score too low, trying company-level RAG...');

    const { companies } = await getEmbeddings();
    let bestCompanyIndustry: string | null = null;
    let bestCompanyScore = -1;

    // Performance optimization: Search only top n companies - maximum 500
    const topCompanies = companies.slice(0, PERFORMANCE_CONFIG.maxCompaniesForRAG);
    for (const company of topCompanies) {
      const score = cosine(company.vec, normalizedQuery);
      if (score > bestCompanyScore) {
        bestCompanyScore = score;
        bestCompanyIndustry = company.industry;
      }
    }

    console.log(`Company-level RAG: ${bestCompanyIndustry} with score: ${bestCompanyScore.toFixed(3)}`);

    if (bestCompanyScore > bestScore) {
      bestIndustry = bestCompanyIndustry;
      bestScore = bestCompanyScore;
    }
  }

  // RAG threshold check: If score is below threshold, classify as casual conversation
  if (bestScore < RAG_THRESHOLDS.CASUAL_CONVERSATION_THRESHOLD) {
    console.log(`⚠️ RAG score too low (${bestScore.toFixed(3)} < ${RAG_THRESHOLDS.CASUAL_CONVERSATION_THRESHOLD}), classifying as casual conversation`);

    // Try GPT classification, but if it fails, treat as casual conversation
    if (bestScore < RAG_THRESHOLDS.GPT_FALLBACK_THRESHOLD) {
      console.log('RAG scores too low, trying GPT classification...');
      const availableIndustries = getAvailableIndustries();
      const gptIndustry = await classifyIndustryWithGPT(userInput, availableIndustries);
      if (gptIndustry) {
        console.log(`GPT classification successful: ${gptIndustry}`);
        bestIndustry = gptIndustry;
        bestScore = 0.8; // Give high score when GPT classification succeeds
      } else {
        console.log('GPT classification also failed, treating as casual conversation');
        return null; // Classify as casual conversation
      }
    } else {
      console.log('Score above GPT threshold but below casual threshold, treating as casual conversation');
      return null; // Classify as casual conversation
    }
  }

  // Validate that the selected industry actually exists in DATA (use cached industry list)
  const validIndustries = getAvailableIndustries();
  if (bestIndustry && !validIndustries.includes(bestIndustry)) {
    console.log(`Selected industry "${bestIndustry}" not found in DATA.`);
    bestIndustry = validIndustries[0]; // Use first industry
  }

  // Return valid industry
  return bestIndustry;
}

// ============================================================================
// Company Finding Functions
// ============================================================================

/**
 * Searches for company in all data (for START stage)
 */
export function findCompanyInAllData(userInput: string): string | null {
  const allTickers = Object.keys(DATA);

  // 1. Direct ticker matching
  const upperInput = userInput.toUpperCase().trim();
  const directTicker = allTickers.find(ticker => ticker === upperInput);
  if (directTicker) {
    console.log(`Direct ticker match: ${userInput} -> ${directTicker}`);
    return directTicker;
  }

  // 2. Korean company name mapping table usage
  const normalizedInput = userInput.trim().toLowerCase();
  for (const [koreanName, englishNames] of Object.entries(KOREAN_COMPANY_MAPPING)) {
    if (normalizedInput.includes(koreanName)) {
      for (const ticker of allTickers) {
        const company = (DATA as any)[ticker];
        if (!company) continue;

        const companyName = company.name.toLowerCase();
        for (const englishName of englishNames) {
          if (companyName.includes(englishName)) {
            console.log(`Korean company name match: "${koreanName}" -> ${ticker} (${company.name})`);
            return ticker;
          }
        }
      }
    }
  }

  // 3. Direct English company name matching
  for (const ticker of allTickers) {
    const company = (DATA as any)[ticker];
    if (!company) continue;

    const companyName = company.name.toLowerCase();

    // Full name matching
    if (companyName.includes(normalizedInput) || normalizedInput.includes(companyName)) {
      console.log(`Full company name match: "${normalizedInput}" -> ${ticker} (${company.name})`);
      return ticker;
    }

    // Main word matching (3+ characters)
    const companyWords = companyName.split(' ').filter((word: string) => word.length > 2);
    for (const word of companyWords) {
      if (normalizedInput.includes(word) && word.length > 3) {
        console.log(`Company word match: "${word}" -> ${ticker} (${company.name})`);
        return ticker;
      }
    }
  }

  return null;
}

/**
 * Finds ticker in text from available tickers list
 */
export function findTickerInText(text: string, availableTickers: string[]): string | null {
  const normalizedInput = text.trim().toLowerCase();
  const upperInput = text.trim().toUpperCase();
  
  // 1. Direct ticker matching (case insensitive exact match)
  const directTicker = availableTickers.find(ticker => 
    ticker.toLowerCase() === normalizedInput || 
    ticker === upperInput ||
    normalizedInput.includes(ticker.toLowerCase()) ||
    upperInput.includes(ticker)
  );
  if (directTicker) {
    console.log(`Direct ticker match: "${text}" -> ${directTicker}`);
    return directTicker;
  }

  // 2. Korean company name matching
  // 2-1. Korean-English mapping table usage
  for (const [koreanName, englishNames] of Object.entries(KOREAN_COMPANY_MAPPING)) {
    if (normalizedInput.includes(koreanName.toLowerCase())) {
      for (const ticker of availableTickers) {
        const company = (DATA as any)[ticker];
        if (!company) continue;

        const companyName = company.name.toLowerCase();
        for (const englishName of englishNames) {
          if (companyName.includes(englishName)) {
            console.log(`Korean name match: "${koreanName}" -> ${ticker} (${company.name})`);
            return ticker;
          }
        }
      }
    }
  }

  // 2-2. Number matching (1, 2, 3 etc)
  const numberMatch = normalizedInput.match(/^(\d+)$/);
  if (numberMatch) {
    const index = parseInt(numberMatch[1]) - 1;
    if (index >= 0 && index < availableTickers.length) {
      console.log(`Number match: ${numberMatch[1]} -> ${availableTickers[index]}`);
      return availableTickers[index];
    }
  }

  // 2-3. Direct English company name matching (partial match included)
  for (const ticker of availableTickers) {
    const company = (DATA as any)[ticker];
    if (!company) continue;

    const companyName = company.name.toLowerCase();
    const tickerLower = ticker.toLowerCase();

    // 1. Check if company name or ticker is included in input
    const isCompanyInInput = normalizedInput.includes(companyName) || 
                           companyName.includes(normalizedInput) ||
                           upperInput.includes(ticker) ||
                           normalizedInput.includes(tickerLower);
    
    // 2. Check if input is included in company name or ticker
    const isInputInCompany = companyName.includes(normalizedInput) || 
                           tickerLower.includes(normalizedInput);

    if (isCompanyInInput || isInputInCompany) {
      console.log(`Company name/ticker match: "${text}" -> ${ticker} (${company.name})`);
      return ticker;
    }

    // General partial matching (main words of English company names)
    const companyWords = companyName.split(' ').filter((word: string) => word.length > 2);
    for (const word of companyWords) {
      if (normalizedInput.includes(word) && word.length > 3) { // Only match longer words
        console.log(`Word match: "${word}" -> ${ticker} (${company.name})`);
        return ticker;
      }
    }
  }

  return null;
}

// ============================================================================
// Industry and Company Utilities
// ============================================================================

/**
 * Gets companies in a specific industry (exactly 5 companies)
 */
export function getIndustryCompanies(industry: string): string[] {
  console.log(`Looking for companies in industry: "${industry}"`);

  const allCompanies = Object.entries(DATA);
  console.log(`Total companies in DATA: ${allCompanies.length}`);

  const matchingCompanies = allCompanies
    .filter(([ticker, company]: [string, any]) => {
      const matches = company.industry === industry;
      if (matches) {
        console.log(`Found matching company: ${company.name} (${ticker}) in ${company.industry}`);
      }
      return matches;
    })
    .slice(0, PERFORMANCE_CONFIG.maxCompaniesForDisplay) // Exactly 5 companies
    .map(([ticker, _]: [string, any]) => ticker);

  console.log(`Found ${matchingCompanies.length} companies for industry "${industry}":`, matchingCompanies);
  return matchingCompanies;
}

/**
 * Safe DATA access function
 */
export function getCompanyName(ticker: string): string {
  const company = (DATA as any)[ticker];
  return company ? company.name : ticker;
}

/**
 * Gets company data safely
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
 * Gets all available industries
 */
export function getAllAvailableIndustries(): string[] {
  return getAvailableIndustries();
}

// ============================================================================
// RAG Testing and Debugging
// ============================================================================

/**
 * RAG Threshold Testing Function (for debugging)
 */
export async function testRAGThresholds(userInput: string): Promise<{
  industry: string | null;
  isCasualConversation: boolean;
  reasoning: string;
}> {
  console.log(`🧪 Testing RAG thresholds for input: "${userInput}"`);

  const industry = await findBestIndustry(userInput);
  const isCasualConversation = industry === null;

  const reasoning = isCasualConversation
    ? `Input classified as casual conversation (RAG score below ${RAG_THRESHOLDS.CASUAL_CONVERSATION_THRESHOLD})`
    : `Input matched to industry: ${industry}`;

  console.log(`🧪 Test result: ${reasoning}`);

  return {
    industry,
    isCasualConversation,
    reasoning
  };
}
