'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Search, Filter, FileText, ChevronRight } from 'lucide-react';
import { parsePaperCode, buildPaperQuery, getSessionLabel } from '@/lib/pastPaperParser';

export default function PastPapersPage() {
  const [searchCode, setSearchCode] = useState('');
  const [grade, setGrade] = useState('9706');
  const [year, setYear] = useState('2025');
  const [series, setSeries] = useState('m');
  const [component, setComponent] = useState('32');
  const [docType, setDocType] = useState('QP');
  const [searchError, setSearchError] = useState('');

  const handleSearchCode = () => {
    setSearchError('');
    
    if (!searchCode.trim()) {
      setSearchError('Please enter a paper code');
      return;
    }

    const result = parsePaperCode(searchCode);
    if (!result) {
      setSearchError('Invalid paper code format. Example: 9706/32/QP/M/J/23');
      return;
    }

    // Skip showing results - navigate directly to viewer
    window.location.href = `/past-papers/viewer?paper=${result.filename}`;
  };

  const handleFilterSearch = () => {
    // Convert full year to 2-digit format (2017 -> 17)
    const yearTwoDigits = year.toString().slice(-2);
    const filename = buildPaperQuery(
      grade as '0452' | '9706',
      yearTwoDigits,
      series as 'f' | 'w' | 's' | 'm',
      component,
      docType as 'QP' | 'MS' | 'IN' | 'GT'
    );

    // Open PDF viewer with filename
    window.location.href = `/past-papers/viewer?paper=${filename}`;
  };

  const componentsForGrade = grade === '0452' ? [12, 22] : [12, 22, 32, 42];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 text-gray-600 mb-4">
            <Link href="/" className="hover:text-purple-600">Home</Link>
            <ChevronRight size={16} />
            <span className="text-gray-900 font-medium">Past Papers</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900">Past Papers Library</h1>
          <p className="text-gray-600 mt-2">Search and view past papers from Cambridge</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search by Code */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Search size={24} className="text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">Search by Paper Code</h2>
          </div>
          
          <p className="text-gray-600 mb-4">Enter code like: 9706/32/QP/M/J/23 or 0452/12/MS/F/M/23</p>
          
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="Paper code (e.g., 9706/32/INSERT/M/J/23)"
              value={searchCode}
              onChange={(e) => {
                setSearchCode(e.target.value);
                setSearchError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchCode()}
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-600 focus:outline-none"
            />
            <button
              onClick={handleSearchCode}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              Search
            </button>
          </div>

          {searchError && (
            <p className="text-red-600 mb-4">{searchError}</p>
          )}
        </div>

        {/* Filter Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <Filter size={24} className="text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">Search with Filters</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Grade */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Grade</label>
              <select
                value={grade}
                onChange={(e) => {
                  setGrade(e.target.value);
                  setComponent('12'); // Reset component
                }}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-600 focus:outline-none"
              >
                <option value="0452">IGCSE (0452)</option>
                <option value="9706">A-Level (9706)</option>
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-600 focus:outline-none"
              >
                {Array.from({ length: 10 }, (_, i) => 2025 - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Series */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Series</label>
              <select
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-600 focus:outline-none"
              >
                <option value="m">Feb/Mar (m)</option>
                <option value="w">Oct/Nov (w)</option>
                <option value="s">May/June (s)</option>
              </select>
            </div>

            {/* Component */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Component</label>
              <select
                value={component}
                onChange={(e) => setComponent(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-600 focus:outline-none"
              >
                {componentsForGrade.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Document Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-600 focus:outline-none"
              >
                <option value="QP">Question Paper</option>
                <option value="MS">Mark Scheme</option>
                {grade === '9706' && <option value="IN">Insert</option>}
                <option value="GT">Grade Threshold</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleFilterSearch}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
          >
            <FileText size={20} />
            Open Paper
          </button>
        </div>
      </div>
    </div>
  );
}
