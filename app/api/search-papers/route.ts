import { NextRequest, NextResponse } from 'next/server';
import { 
  searchPapers, 
  findExactPaper, 
  getPapersBySubject,
  getSubjectStats,
  type SearchResult 
} from '@/lib/pdf-search';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const subject = searchParams.get('subject');
  const exact = searchParams.get('exact');
  const stats = searchParams.get('stats');
  
  try {
    // Get subject statistics
    if (stats && subject) {
      const statistics = getSubjectStats(subject);
      return NextResponse.json({
        success: true,
        stats: statistics
      });
    }
    
    // Search by subject only
    if (subject && !query && !exact) {
      const results = getPapersBySubject(subject);
      return NextResponse.json({
        success: true,
        results,
        total: results.length
      });
    }
    
    // Exact paper search
    if (exact) {
      const parts = exact.split('_');
      if (parts.length >= 3) {
        const [subjectCode, sessionYear, paperType] = parts;
        const component = parts[3];
        const session = sessionYear.charAt(0);
        const year = sessionYear.slice(1);
        
        const result = findExactPaper(subjectCode, session, year, paperType, component);
        return NextResponse.json({
          success: true,
          result,
          found: !!result
        });
      }
    }
    
    // General search
    if (query) {
      const results = searchPapers(query);
      return NextResponse.json({
        success: true,
        results,
        total: results.length,
        query
      });
    }
    
    return NextResponse.json(
      { error: 'No search parameters provided' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}