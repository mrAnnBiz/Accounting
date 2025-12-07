'use client';

import dynamic from 'next/dynamic';

const EnhancedPDFViewerScrollable = dynamic(() => import('@/components/EnhancedPDFViewerScrollable'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen">Loading PDF Viewer...</div>,
});

export default function ViewerPage() {
  return <EnhancedPDFViewerScrollable />;
}
