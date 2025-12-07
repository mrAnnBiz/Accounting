// Cambridge PDF naming convention parser
// Format: [subject_code]_[session_year]_[paper_type]_[component].pdf
// Examples: 9706_s23_qp_32.pdf, 0452_w21_ms_12.pdf, 9706_m18_0_0_er.pdf

export interface CambridgePaper {
  subjectCode: string;
  session: string; // s, w, m
  year: string;
  paperType: string; // qp, ms, gt, er, in
  component?: string;
  fullFilename: string;
  isValid: boolean;
}

export interface ParsedComponents {
  subject: string;
  sessionYear: string;
  type: string;
  component?: string;
}

/**
 * Parse Cambridge filename format
 * Handles various formats:
 * - Standard: 9706_s23_qp_32.pdf
 * - With extra zeros: 9706_m18_0_0_er.pdf
 * - Alternative formats: 0452_m18_1_2_ms.pdf
 * - Specimen papers: 414619-2020-specimen-paper-1.pdf
 */
export function parseCambridgeFilename(filename: string): CambridgePaper {
  // Remove .pdf extension
  const name = filename.replace(/\.pdf$/, '');
  
  // Handle specimen papers (non-Cambridge format)
  if (name.includes('specimen') || name.includes('-')) {
    return {
      subjectCode: 'specimen',
      session: '',
      year: '',
      paperType: 'specimen',
      component: undefined,
      fullFilename: filename,
      isValid: false
    };
  }
  
  // Split by underscore
  const parts = name.split('_');
  
  if (parts.length < 3) {
    return {
      subjectCode: '',
      session: '',
      year: '',
      paperType: '',
      component: undefined,
      fullFilename: filename,
      isValid: false
    };
  }
  
  const subjectCode = parts[0];
  const sessionYear = parts[1];
  
  // Extract session (s/w/m) and year
  const sessionMatch = sessionYear.match(/^([swm])(\d{2})$/);
  if (!sessionMatch) {
    return {
      subjectCode,
      session: '',
      year: '',
      paperType: '',
      component: undefined,
      fullFilename: filename,
      isValid: false
    };
  }
  
  const session = sessionMatch[1];
  const year = sessionMatch[2];
  
  // Handle different formats after subject_sessionyear
  let paperType = '';
  let component = '';
  
  if (parts.length === 3) {
    // Format: 9706_s23_gt.pdf
    paperType = parts[2];
  } else if (parts.length === 4) {
    // Format: 9706_s23_qp_32.pdf
    paperType = parts[2];
    component = parts[3];
  } else if (parts.length === 5 && parts[2] === '0' && parts[3] === '0') {
    // Format: 9706_m18_0_0_er.pdf
    paperType = parts[4];
  } else if (parts.length === 5) {
    // Format: 0452_m18_1_2_ms.pdf (alternative component format)
    component = `${parts[2]}_${parts[3]}`;
    paperType = parts[4];
  } else {
    // Unknown format, try to extract what we can
    paperType = parts[parts.length - 1];
    if (parts.length > 3) {
      component = parts.slice(2, -1).join('_');
    }
  }
  
  return {
    subjectCode,
    session,
    year,
    paperType,
    component: component || undefined,
    fullFilename: filename,
    isValid: true
  };
}

/**
 * Build Cambridge filename from components
 */
export function buildCambridgeFilename(
  subjectCode: string,
  session: string,
  year: string,
  paperType: string,
  component?: string
): string {
  const sessionYear = `${session}${year}`;
  const parts = [subjectCode, sessionYear, paperType];
  
  if (component) {
    parts.push(component);
  }
  
  return `${parts.join('_')}.pdf`;
}

/**
 * Generate possible filename variations for a Cambridge paper
 * This helps when searching for papers that might have slight format differences
 */
export function generateFilenameVariations(
  subjectCode: string,
  session: string,
  year: string,
  paperType: string,
  component?: string
): string[] {
  const variations: string[] = [];
  
  // Standard format
  const standard = buildCambridgeFilename(subjectCode, session, year, paperType, component);
  variations.push(standard);
  
  // With zero padding (for older formats)
  if (component) {
    variations.push(`${subjectCode}_${session}${year}_0_0_${paperType}.pdf`);
    
    // Alternative component format (e.g., 1_2 instead of 12)
    if (component.length === 2) {
      const altComponent = `${component.charAt(0)}_${component.charAt(1)}`;
      variations.push(`${subjectCode}_${session}${year}_${altComponent}_${paperType}.pdf`);
    }
  }
  
  return variations;
}

/**
 * Parse user input to extract Cambridge paper components
 * Handles various input formats:
 * - "9706 s23 qp 32" (space-separated)
 * - "9706_s23_qp_32" (underscore-separated)
 * - "9706s23qp32" (no separators)
 * - "A Level Accounting Summer 2023 Paper 3 Question 2"
 * - "s23" or "summer 23" (session-specific)
 * - "qp 22" or "question 22" (type-specific)
 */
export function parseUserInput(input: string): ParsedComponents | null {
  const cleaned = input.toLowerCase().trim();
  
  // Try to extract components using regex patterns
  
  // Pattern 1: Direct Cambridge format (with separators)
  const directMatch = cleaned.match(/(\d{4})[_\s]*([swm])(\d{2})[_\s]*(\w+)[_\s]*(\d+)?/);
  if (directMatch) {
    return {
      subject: directMatch[1],
      sessionYear: `${directMatch[2]}${directMatch[3]}`,
      type: directMatch[4],
      component: directMatch[5] || undefined
    };
  }
  
  // Pattern 2: Session-specific searches (s23, summer 23, etc.)
  const sessionSpecificMatch = cleaned.match(/([swm])\s*(\d{2})|((summer|winter|march)\s*(\d{2,4}))/);
  if (sessionSpecificMatch) {
    let session = '';
    let year = '';
    
    if (sessionSpecificMatch[1] && sessionSpecificMatch[2]) {
      // Format: s23, w21, m19
      session = sessionSpecificMatch[1];
      year = sessionSpecificMatch[2];
    } else if (sessionSpecificMatch[3]) {
      // Format: summer 23, winter 2021, march 19
      const sessionWord = sessionSpecificMatch[4];
      const yearStr = sessionSpecificMatch[5];
      
      if (sessionWord.includes('summer')) session = 's';
      else if (sessionWord.includes('winter')) session = 'w';
      else if (sessionWord.includes('march')) session = 'm';
      
      year = yearStr.length === 4 ? yearStr.slice(-2) : yearStr;
    }
    
    if (session && year) {
      return {
        subject: '9706', // Default to A Level if not specified
        sessionYear: `${session}${year}`,
        type: 'qp', // Default to question paper
        component: undefined
      };
    }
  }
  
  // Pattern 3: Paper type with component (qp 22, question 32, mark 12)
  const typeComponentMatch = cleaned.match(/(qp|ms|question|mark|marking)\s*(\d{1,2})/);
  if (typeComponentMatch) {
    let type = 'qp';
    const typeWord = typeComponentMatch[1];
    const component = typeComponentMatch[2];
    
    if (typeWord.includes('mark')) type = 'ms';
    else if (typeWord === 'qp' || typeWord.includes('question')) type = 'qp';
    
    return {
      subject: '9706', // Default to A Level if not specified
      sessionYear: 's23', // Default to recent session
      type,
      component
    };
  }
  
  // Pattern 4: Natural language parsing with enhanced detection
  const subjectMatch = cleaned.match(/(\d{4})|(a\s*level|alevel)|(igcse|gcse)|accounting|business/);
  const sessionMatch = cleaned.match(/(summer|may\s*june|s\d{2})|(winter|oct\s*nov|october\s*november|w\d{2})|(march|feb\s*mar|february\s*march|m\d{2})/);
  const yearMatch = cleaned.match(/20(\d{2})|(\d{2})/);
  const typeMatch = cleaned.match(/(question\s*paper|question|qp)|(mark\s*scheme|marking\s*scheme|mark|ms)|(grade\s*threshold|threshold|gt)|(examiner\s*report|examiner|er)|(insert|in)/);
  const componentMatch = cleaned.match(/paper\s*(\d+)|component\s*(\d+)|\b(\d{1,2})\b/);
  
  if (subjectMatch || sessionMatch || typeMatch) {
    let subject = '9706'; // Default to A Level Accounting
    if (subjectMatch) {
      if (subjectMatch[0].length === 4) {
        subject = subjectMatch[0];
      } else if (subjectMatch[0].includes('igcse') || subjectMatch[0].includes('gcse')) {
        subject = '0452';
      }
    }
    
    let session = 's'; // Default to summer
    let year = '23'; // Default to current year
    
    if (sessionMatch) {
      const sessionStr = sessionMatch[0];
      if (sessionStr.includes('summer') || sessionStr.includes('may') || sessionStr.startsWith('s')) {
        session = 's';
      } else if (sessionStr.includes('winter') || sessionStr.includes('oct') || sessionStr.includes('november') || sessionStr.startsWith('w')) {
        session = 'w';
      } else if (sessionStr.includes('march') || sessionStr.includes('feb') || sessionStr.startsWith('m')) {
        session = 'm';
      }
      
      // Extract year from session match if present
      const sessionYearMatch = sessionStr.match(/\d{2,4}/);
      if (sessionYearMatch) {
        year = sessionYearMatch[0].length === 4 ? sessionYearMatch[0].slice(-2) : sessionYearMatch[0];
      }
    }
    
    if (yearMatch && !sessionMatch) {
      year = yearMatch[1] || yearMatch[2] || '';
      if (year.length === 4) year = year.slice(-2);
    }
    
    let type = 'qp'; // Default to question paper
    if (typeMatch) {
      const typeStr = typeMatch[0];
      if (typeStr.includes('mark') || typeStr === 'ms') type = 'ms';
      else if (typeStr.includes('grade') || typeStr.includes('threshold') || typeStr === 'gt') type = 'gt';
      else if (typeStr.includes('examiner') || typeStr === 'er') type = 'er';
      else if (typeStr.includes('insert') || typeStr === 'in') type = 'in';
    }
    
    let component = undefined;
    if (componentMatch) {
      // Get the last captured group that has a value
      component = componentMatch[1] || componentMatch[2] || componentMatch[3];
      
      // Filter out years that might be captured as components
      if (component && (component.length > 2 || parseInt(component) > 50)) {
        component = undefined;
      }
    }
    
    return {
      subject,
      sessionYear: `${session}${year}`,
      type,
      component
    };
  }
  
  return null;
}

/**
 * Get subject name from code
 */
export function getSubjectName(code: string): string {
  const subjects: Record<string, string> = {
    '9706': 'A Level Accounting',
    '0452': 'IGCSE Accounting'
  };
  
  return subjects[code] || `Subject ${code}`;
}

/**
 * Get session name
 */
export function getSessionName(session: string): string {
  const sessions: Record<string, string> = {
    's': 'Summer',
    'w': 'Winter',
    'm': 'March'
  };
  
  return sessions[session] || session.toUpperCase();
}

/**
 * Get paper type description
 */
export function getPaperTypeDescription(type: string): string {
  const types: Record<string, string> = {
    'qp': 'Question Paper',
    'ms': 'Mark Scheme',
    'gt': 'Grade Thresholds',
    'er': 'Examiner Report',
    'in': 'Insert'
  };
  
  return types[type] || type.toUpperCase();
}

/**
 * Format paper for display
 */
export function formatPaperDisplay(paper: CambridgePaper): string {
  if (!paper.isValid) {
    return paper.fullFilename;
  }
  
  const subject = getSubjectName(paper.subjectCode);
  const session = getSessionName(paper.session);
  const year = `20${paper.year}`;
  const type = getPaperTypeDescription(paper.paperType);
  const component = paper.component ? ` Component ${paper.component}` : '';
  
  return `${subject} ${session} ${year} ${type}${component}`;
}