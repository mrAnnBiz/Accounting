'use client';

import Link from 'next/link';

interface NavbarProps {
  currentPage?: number;
  totalPages?: number;
}

export default function Navbar({ currentPage, totalPages }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
      <div className="w-full h-16 flex items-center">
        <div className="mx-auto px-6 sm:px-8 lg:px-12 max-w-7xl w-full flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg group-hover:shadow-lg group-hover:shadow-blue-400/30 transition-all duration-300">
              A
            </div>
            <span className="hidden sm:inline font-bold text-gray-900 text-lg">Anneruth</span>
          </Link>
          <div className="flex gap-8 items-center">
            <Link href="/notes" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-300">
              Study Notes
            </Link>
            <Link href="/past-papers" className="text-gray-600 hover:text-blue-600 font-medium transition-colors duration-300">
              Past Papers
            </Link>
            {currentPage && totalPages && (
              <div className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm">
                Page {currentPage} / {totalPages}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
