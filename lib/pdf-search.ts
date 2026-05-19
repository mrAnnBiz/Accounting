import fs from 'fs';
import path from 'path';
import {
  parseCambridgeFilename,
  parseUserInput,
  generateFilenameVariations,
  formatPaperDisplay,
  type CambridgePaper,
  type ParsedComponents
} from './cambridge-parser';

export interface SearchResult {
  filename: string;
  paper: CambridgePaper;
  displayName: string;
  score: number; // Relevance score
}

// Pre-generated list of PDF files to avoid filesystem reads in serverless functions
import { papersIndex } from './papers-index';

/**
 * Get all PDF files from the pre-generated index
 */
export function getAllPDFs(): string[] {
  return papersIndex.sort();
}

/**
 * Extract search filters from query string
 */
function extractSearchFilters(query: string) {
  const filters = {
    sessions: [] as string[],
    paperTypes: [] as string[],
    components: [] as string[],
    years: [] as string[],
    subjects: [] as string[],
    excludeSessions: [] as string[],
    excludePaperTypes: [] as string[],
    excludeComponents: [] as string[]
  };
  
  const lowerQuery = query.toLowerCase();
  
  // Extract sessions
  if (lowerQuery.match(/\b(s23|s\s*23|summer\s*23|summer\s*2023|may\s*june\s*23|may\s*june\s*2023)\b/)) {
    filters.sessions.push('s');
    filters.years.push('23');
    filters.excludeSessions.push('w', 'm');
  } else if (lowerQuery.match(/\b(w23|w\s*23|winter\s*23|winter\s*2023|oct\s*nov\s*23|oct\s*nov\s*2023|october\s*november\s*23)\b/)) {
    filters.sessions.push('w');
    filters.years.push('23');
    filters.excludeSessions.push('s', 'm');
  } else if (lowerQuery.match(/\b(m23|m\s*23|march\s*23|march\s*2023|feb\s*mar\s*23|february\s*march\s*23)\b/)) {
    filters.sessions.push('m');
    filters.years.push('23');
    filters.excludeSessions.push('s', 'w');
  } else {
    // Check for general session terms
    if (lowerQuery.match(/\b(summer|may\s*june|s\d{2})\b/)) {
      filters.sessions.push('s');
      filters.excludeSessions.push('w', 'm');
    }
    if (lowerQuery.match(/\b(winter|oct\s*nov|october\s*november|w\d{2})\b/)) {
      filters.sessions.push('w');
      filters.excludeSessions.push('s', 'm');
    }
    if (lowerQuery.match(/\b(march|feb\s*mar|february\s*march|m\d{2})\b/)) {
      filters.sessions.push('m');
      filters.excludeSessions.push('s', 'w');
    }
  }
  
  // Extract paper types with exclusions
  if (lowerQuery.match(/\b(qp\s*\d+|question\s*\d+|question\s*paper\s*\d+)\b/)) {
    filters.paperTypes.push('qp');
    filters.excludePaperTypes.push('ms', 'gt', 'er', 'in');
  } else if (lowerQuery.match(/\b(ms\s*\d+|mark\s*\d+|mark\s*scheme\s*\d+|marking\s*scheme\s*\d+)\b/)) {
    filters.paperTypes.push('ms');
    filters.excludePaperTypes.push('qp', 'gt', 'er', 'in');
  } else {
    // Check for general paper type terms
    if (lowerQuery.match(/\b(qp|question\s*paper|question)\b/)) {
      filters.paperTypes.push('qp');
      filters.excludePaperTypes.push('ms', 'gt', 'er', 'in');
    }
    if (lowerQuery.match(/\b(ms|mark\s*scheme|marking\s*scheme|mark)\b/)) {
      filters.paperTypes.push('ms');
      filters.excludePaperTypes.push('qp', 'gt', 'er', 'in');
    }
    if (lowerQuery.match(/\b(gt|grade\s*threshold|threshold)\b/)) {
      filters.paperTypes.push('gt');
      filters.excludePaperTypes.push('qp', 'ms', 'er', 'in');
    }
    if (lowerQuery.match(/\b(er|examiner\s*report|examiner)\b/)) {
      filters.paperTypes.push('er');
      filters.excludePaperTypes.push('qp', 'ms', 'gt', 'in');
    }
    if (lowerQuery.match(/\b(in|insert)\b/)) {
      filters.paperTypes.push('in');
      filters.excludePaperTypes.push('qp', 'ms', 'gt', 'er');
    }
  }
  
  // Extract specific components
  const componentMatches = lowerQuery.match(/\b(qp|ms|question|mark)\s*(\d+)\b/g);
  if (componentMatches) {
    componentMatches.forEach(match => {
      const componentNum = match.match(/\d+/)?.[0];
      if (componentNum) {
        filters.components.push(componentNum);
        // Exclude other common components
        const allComponents = ['11', '12', '13', '21', '22', '23', '31', '32', '33', '41', '42', '43'];
        filters.excludeComponents.push(...allComponents.filter(c => c !== componentNum && c !== `${componentNum}1` && c !== `${componentNum}2` && c !== `${componentNum}3`));
      }
    });
  }
  
  // Extract years
  const yearMatches = lowerQuery.match(/\b(20\d{2}|\d{2})\b/g);
  if (yearMatches) {
    yearMatches.forEach(year => {
      const shortYear = year.length === 4 ? year.slice(-2) : year;
      filters.years.push(shortYear);
    });
  }
  
  // Extract subject codes
  if (lowerQuery.match(/\b9706\b/)) filters.subjects.push('9706');
  if (lowerQuery.match(/\b0452\b/)) filters.subjects.push('0452');
  if (lowerQuery.match(/\b(a\s*level|alevel)\b/)) filters.subjects.push('9706');
  if (lowerQuery.match(/\b(igcse|gcse)\b/)) filters.subjects.push('0452');
  
  return filters;
}

/**
 * Search for Cambridge papers by user input with enhanced filtering
 */
export function searchPapers(query: string): SearchResult[] {
  const allPDFs = getAllPDFs();
  const results: SearchResult[] = [];
  
  // Extract filters from query
  const filters = extractSearchFilters(query);
  
  // Parse user input for structured search
  const parsed = parseUserInput(query);
  
  // Search through all PDFs
  for (const filename of allPDFs) {
    const paper = parseCambridgeFilename(filename);
    
    if (!paper.isValid) continue;
    
    let score = 0;
    let excluded = false;
    
    // Apply exclusion filters first
    if (filters.excludeSessions.length > 0 && filters.excludeSessions.includes(paper.session)) {
      excluded = true;
    }
    if (filters.excludePaperTypes.length > 0 && filters.excludePaperTypes.includes(paper.paperType)) {
      excluded = true;
    }
    if (filters.excludeComponents.length > 0 && paper.component && 
        filters.excludeComponents.some(exc => paper.component?.includes(exc))) {
      excluded = true;
    }
    
    if (excluded) continue;
    
    // Apply inclusion filters with scoring
    if (filters.subjects.length > 0) {
      if (filters.subjects.includes(paper.subjectCode)) {
        score += 3;
      } else {
        continue; // Skip if subject doesn't match when specified
      }
    }
    
    if (filters.sessions.length > 0) {
      if (filters.sessions.includes(paper.session)) {
        score += 3;
      } else {
        continue; // Skip if session doesn't match when specified
      }
    }
    
    if (filters.paperTypes.length > 0) {
      if (filters.paperTypes.includes(paper.paperType)) {
        score += 3;
      } else {
        continue; // Skip if paper type doesn't match when specified
      }
    }
    
    if (filters.years.length > 0) {
      if (filters.years.includes(paper.year)) {
        score += 2;
      } else {
        continue; // Skip if year doesn't match when specified
      }
    }
    
    if (filters.components.length > 0) {
      if (paper.component && filters.components.some(comp => paper.component?.includes(comp))) {
        score += 2;
      } else if (paper.component) {
        continue; // Skip if component doesn't match when specified
      }
    }
    
    // Fallback to structured parsing if no specific filters matched
    if (score === 0 && parsed) {
      // Check subject match
      if (paper.subjectCode === parsed.subject) {
        score += 3;
      }
      
      // Check session and year match
      if (paper.session === parsed.sessionYear.charAt(0) && 
          paper.year === parsed.sessionYear.slice(1)) {
        score += 2;
      }
      
      // Check paper type match
      if (paper.paperType === parsed.type) {
        score += 2;
      }
      
      // Check component match
      if (parsed.component && paper.component) {
        if (paper.component === parsed.component) {
          score += 1;
        } else if (paper.component.includes(parsed.component) || 
                   parsed.component.includes(paper.component)) {
          score += 0.5;
        }
      } else if (!parsed.component && !paper.component) {
        score += 0.5;
      }
    }
    
    // Fallback text search if no structured matches
    if (score === 0 && !parsed) {
      if (filename.toLowerCase().includes(query.toLowerCase())) {
        score = 0.3;
      }
    }
    
    // Add to results if there's any match
    if (score > 0) {
      results.push({
        filename,
        paper,
        displayName: formatPaperDisplay(paper),
        score
      });
    }
  }
  
  // Sort by score (descending) and return top results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

/**
 * Find a specific paper by exact Cambridge format
 */
export function findExactPaper(
  subjectCode: string,
  session: string,
  year: string,
  paperType: string,
  component?: string
): SearchResult | null {
  const variations = generateFilenameVariations(
    subjectCode, 
    session, 
    year, 
    paperType, 
    component
  );
  
  const allPDFs = getAllPDFs();
  
  for (const variation of variations) {
    if (allPDFs.includes(variation)) {
      const paper = parseCambridgeFilename(variation);
      return {
        filename: variation,
        paper,
        displayName: formatPaperDisplay(paper),
        score: 1.0
      };
    }
  }
  
  return null;
}

/**
 * Get papers by subject
 */
export function getPapersBySubject(subjectCode: string): SearchResult[] {
  const allPDFs = getAllPDFs();
  const results: SearchResult[] = [];
  
  for (const filename of allPDFs) {
    const paper = parseCambridgeFilename(filename);
    
    if (paper.isValid && paper.subjectCode === subjectCode) {
      results.push({
        filename,
        paper,
        displayName: formatPaperDisplay(paper),
        score: 1.0
      });
    }
  }
  
  // Sort by year (newest first), then by session, then by type
  return results.sort((a, b) => {
    if (a.paper.year !== b.paper.year) {
      return parseInt(b.paper.year) - parseInt(a.paper.year);
    }
    
    if (a.paper.session !== b.paper.session) {
      const sessionOrder = { 's': 1, 'w': 2, 'm': 3 };
      return (sessionOrder[a.paper.session as keyof typeof sessionOrder] || 0) - 
             (sessionOrder[b.paper.session as keyof typeof sessionOrder] || 0);
    }
    
    if (a.paper.paperType !== b.paper.paperType) {
      const typeOrder = { 'qp': 1, 'ms': 2, 'gt': 3, 'er': 4, 'in': 5 };
      return (typeOrder[a.paper.paperType as keyof typeof typeOrder] || 0) - 
             (typeOrder[b.paper.paperType as keyof typeof typeOrder] || 0);
    }
    
    return (a.paper.component || '').localeCompare(b.paper.component || '');
  });
}

/**
 * Get available years for a subject
 */
export function getAvailableYears(subjectCode: string): string[] {
  const papers = getPapersBySubject(subjectCode);
  const years = new Set<string>();
  
  papers.forEach(result => {
    if (result.paper.year) {
      years.add(`20${result.paper.year}`);
    }
  });
  
  return Array.from(years).sort().reverse();
}

/**
 * Get available sessions for a subject and year
 */
export function getAvailableSessions(subjectCode: string, year: string): string[] {
  const shortYear = year.slice(-2);
  const papers = getPapersBySubject(subjectCode);
  const sessions = new Set<string>();
  
  papers.forEach(result => {
    if (result.paper.year === shortYear) {
      sessions.add(result.paper.session);
    }
  });
  
  return Array.from(sessions).sort();
}

/**
 * Get subject statistics
 */
export function getSubjectStats(subjectCode: string): {
  totalPapers: number;
  years: string[];
  sessions: string[];
  paperTypes: string[];
} {
  const papers = getPapersBySubject(subjectCode);
  const years = new Set<string>();
  const sessions = new Set<string>();
  const paperTypes = new Set<string>();
  
  papers.forEach(result => {
    if (result.paper.year) years.add(`20${result.paper.year}`);
    if (result.paper.session) sessions.add(result.paper.session);
    if (result.paper.paperType) paperTypes.add(result.paper.paperType);
  });
  
  return {
    totalPapers: papers.length,
    years: Array.from(years).sort().reverse(),
    sessions: Array.from(sessions).sort(),
    paperTypes: Array.from(paperTypes).sort()
  };
}