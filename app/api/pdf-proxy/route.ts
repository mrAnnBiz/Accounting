import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paper = searchParams.get('paper');

  if (!paper) {
    return NextResponse.json({ error: 'Paper parameter is required' }, { status: 400 });
  }

  // Sanitize the filename to prevent directory traversal
  const sanitizedPaper = path.basename(paper);
  if (!sanitizedPaper.endsWith('.pdf')) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
  }

  try {
    // For development and production, redirect to static file
    const staticPdfUrl = `/papers/${encodeURIComponent(sanitizedPaper)}`;
    
    // Check if we're in development or if the file should be served statically
    if (process.env.NODE_ENV === 'development') {
      // In development, try to read the file directly
      const papersDir = path.join(process.cwd(), 'public', 'papers');
      const filePath = path.join(papersDir, sanitizedPaper);
      
      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          { error: `PDF file not found: ${sanitizedPaper}` }, 
          { status: 404 }
        );
      }

      const pdfBuffer = fs.readFileSync(filePath);
      
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${sanitizedPaper}"`,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } else {
      // In production on Vercel, redirect to the static file
      return NextResponse.redirect(new URL(staticPdfUrl, request.url));
    }
  } catch (error) {
    console.error('Error serving PDF:', error);
    return NextResponse.json(
      { error: 'Failed to serve PDF' }, 
      { status: 500 }
    );
  }
}