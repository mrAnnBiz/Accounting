/**
 * Initialize PDF.js worker configuration
 * This must be imported and executed BEFORE any PDF loading occurs
 */

export function initializePDFWorker() {
  if (typeof window !== 'undefined') {
    // Dynamically import PDF.js and set worker source
    try {
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    } catch (err) {
      console.warn('Failed to initialize PDF worker via require:', err);
      // Fallback for ES6 module import
      import('pdfjs-dist').then((pdfjsLib) => {
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      }).catch((err) => {
        console.error('Failed to initialize PDF worker:', err);
      });
    }
  }
}

// Execute initialization immediately when this module loads
initializePDFWorker();
