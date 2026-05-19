import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paper = searchParams.get('paper');

  if (!paper) {
    return NextResponse.json({ error: 'Paper parameter is required' }, { status: 400 });
  }

  // Sanitize the filename to prevent directory traversal
  const sanitizedPaper = paper.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!sanitizedPaper.endsWith('.pdf')) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
  }

  try {
    // Always try to fetch from the static files first
    const staticPdfUrl = `${request.nextUrl.origin}/papers/${encodeURIComponent(sanitizedPaper)}`;
    
    console.log('Fetching PDF from:', staticPdfUrl);
    
    // Fetch the PDF file from static assets
    const response = await fetch(staticPdfUrl, {
      // Add headers to ensure we get the file
      headers: {
        'Accept': 'application/pdf,*/*',
        'User-Agent': 'PDF-Proxy/1.0',
      },
    });
    
    console.log('Static file response status:', response.status);
    console.log('Static file response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      console.error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { 
          error: `PDF file not found: ${sanitizedPaper}`, 
          status: response.status,
          url: staticPdfUrl 
        }, 
        { status: 404 }
      );
    }

    // Get the PDF content as ArrayBuffer
    const pdfBuffer = await response.arrayBuffer();
    console.log('PDF buffer size:', pdfBuffer.byteLength);
    
    // Return the PDF with proper headers for PDF.js compatibility
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${sanitizedPaper}"`,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Length': pdfBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Error serving PDF:', error);
    return NextResponse.json(
      { error: 'Failed to serve PDF', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}