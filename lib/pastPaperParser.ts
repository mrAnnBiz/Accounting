// Parses Cambridge paper codes like "9706/32/INSERT/M/J/25"

export interface ParsedPaperCode {
  syllabus: '0452' | '9706';
  component: string;
  type: 'QP' | 'MS' | 'IN' | 'GT';
  session: 'f' | 'w' | 's' | 'm';
  year: string;
  filename: string;
  curriculum: string;
}

export function parsePaperCode(code: string): ParsedPaperCode | null {
  try {
    const parts = code.trim().split('/');
    if (parts.length < 4) return null;

    const [syllabus, component, typeRaw, ...dateParts] = parts;
    
    // Validate syllabus
    if (!['0452', '9706'].includes(syllabus)) return null;
    
    // Parse type
    const typeMap: Record<string, 'QP' | 'MS' | 'IN' | 'GT'> = {
      'QP': 'QP',
      'QUESTION': 'QP',
      'MS': 'MS',
      'MARKSCHEME': 'MS',
      'MARK': 'MS',
      'INSERT': 'IN',
      'IN': 'IN',
      'GT': 'GT',
      'GRADE': 'GT',
    };
    
    const type = typeMap[typeRaw.toUpperCase()] || null;
    if (!type) return null;

    // Parse date
    let session: 'f' | 'w' | 's' | 'm' = 's';
    let year = '25';

    if (dateParts.length >= 2) {
      const month = dateParts[0].toUpperCase();

      // Map month codes
      if (['F', 'FEB', 'FEBRUARY', 'MARCH', 'MAR'].includes(month)) {
        session = 'm';
      } else if (['O', 'OCT', 'OCTOBER', 'NOV', 'NOVEMBER'].includes(month)) {
        session = 'w';
      } else if (['M', 'MAY', 'JUNE', 'J', 'JUN'].includes(month)) {
        session = 's';
      }

      // Extract year
      if (dateParts.length >= 3) {
        year = dateParts[2];
      }
    }

    // Build filename
    const filename = `${syllabus}-${session}${year}-${type.toLowerCase()}-${component}.pdf`;

    return {
      syllabus: syllabus as '0452' | '9706',
      component,
      type,
      session,
      year,
      filename,
      curriculum: syllabus === '0452' ? 'IGCSE' : 'A-Level',
    };
  } catch {
    return null;
  }
}

export function buildPaperQuery(
  syllabus: '0452' | '9706',
  year: string,
  series: 'f' | 'w' | 's' | 'm',
  component: string,
  type: 'QP' | 'MS' | 'IN' | 'GT'
): string {
  const typeMap = { QP: 'qp', MS: 'ms', IN: 'in', GT: 'gt' };
  return `${syllabus}-${series}${year}-${typeMap[type]}-${component}.pdf`;
}

export function getSessionLabel(session: 'f' | 'w' | 's' | 'm'): string {
  const labels = {
    f: 'Feb/Mar',
    m: 'Feb/Mar',
    w: 'Oct/Nov',
    s: 'May/June',
  };
  return labels[session];
}
