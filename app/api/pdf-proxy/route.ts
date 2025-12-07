import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paper = searchParams.get('paper');

  if (!paper) {
    return NextResponse.json({ error: 'Paper parameter is required' }, { status: 400 });
  }

  try {
    // Construct the PDF URL - PDFs are stored in public/papers/
    const pdfUrl = `${request.nextUrl.origin}/papers/${encodeURIComponent(paper)}`;
    
    // Fetch the PDF file
    const response = await fetch(pdfUrl);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `PDF file not found: ${paper}` }, 
        { status: 404 }
      );
    }

    // Get the PDF content
    const pdfBuffer = await response.arrayBuffer();
    
    // Return the PDF with appropriate headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${paper}"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error fetching PDF:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PDF' }, 
      { status: 500 }
    );
  }
}