'use client';

import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('@/components/PDFViewerOptimized'), {
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center">Loading...</div>,
});

export default function PastPapersViewer() {
  return <PDFViewer />;
}
