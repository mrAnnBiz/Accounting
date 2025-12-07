'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Search, Filter, FileText, ChevronRight, ExternalLink } from 'lucide-react';
import { parseUserInput } from '@/lib/cambridge-parser';
import type { SearchResult } from '@/lib/pdf-search';

export default function PastPapersPage() {
  const [searchCode, setSearchCode] = useState('');
  const [grade, setGrade] = useState('9706');
  const [year, setYear] = useState('2025');
  const [series, setSeries] = useState('s');
  const [component, setComponent] = useState('32');
  const [docType, setDocType] = useState('qp');
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearchCode = async () => {
    setSearchError('');
    setIsLoading(true);
    
    if (!searchCode.trim()) {
      setSearchError('Please enter a search term or paper code');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/search-papers?q=${encodeURIComponent(searchCode)}`);
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.results);
        if (data.results.length === 0) {
          setSearchError('No papers found matching your search');
        }
      } else {
        setSearchError('Search failed. Please try again.');
      }
    } catch (error) {
      setSearchError('Search failed. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterSearch = async () => {
    setSearchError('');
    setIsLoading(true);
    
    try {
      // Convert full year to 2-digit format (2025 -> 25)
      const yearTwoDigits = year.toString().slice(-2);
      const searchQuery = `${grade}_${series}${yearTwoDigits}_${docType}_${component}`;
      
      const response = await fetch(`/api/search-papers?exact=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data.success && data.result) {
        // Navigate directly to viewer
        window.location.href = `/past-papers/viewer?paper=${data.result.filename}`;
      } else {
        setSearchError('Paper not found. Try different filters or check if the paper exists.');
      }
    } catch (error) {
      setSearchError('Search failed. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const openPaper = (filename: string) => {
    window.location.href = `/past-papers/viewer?paper=${filename}`;
  };

  const componentsForGrade = grade === '0452' ? ['12', '22'] : ['12', '22', '32', '42'];

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
          
          <div className="text-gray-600 mb-4">
            <p className="mb-2">Try these search examples:</p>
            <ul className="text-sm space-y-1 ml-4">
              <li>• <span className="font-mono bg-gray-100 px-2 py-1 rounded">s23</span> - Summer 2023 papers only</li>
              <li>• <span className="font-mono bg-gray-100 px-2 py-1 rounded">qp 22</span> - Question papers for component 22</li>
              <li>• <span className="font-mono bg-gray-100 px-2 py-1 rounded">winter 23</span> - Winter 2023 papers only</li>
              <li>• <span className="font-mono bg-gray-100 px-2 py-1 rounded">mark 32</span> - Mark schemes for component 32</li>
            </ul>
          </div>
          
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="Search papers (e.g., s23, qp 22, summer 23, mark 32)"
              value={searchCode}
              onChange={(e) => {
                setSearchCode(e.target.value);
                setSearchError('');
                setSearchResults([]);
              }}
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSearchCode()}
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-600 focus:outline-none"
              disabled={isLoading}
            />
            <button
              onClick={handleSearchCode}
              disabled={isLoading}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searchError && (
            <p className="text-red-600 mb-4">{searchError}</p>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Search Results ({searchResults.length})
                </h3>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  Filtered & Ranked
                </span>
              </div>
              <div className="grid gap-3 max-h-96 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{result.displayName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-gray-600">{result.filename}</p>
                        {result.score >= 3 && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            Exact Match
                          </span>
                        )}
                        {result.score >= 2 && result.score < 3 && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            Good Match
                          </span>
                        )}
                        {result.score < 2 && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                            Partial Match
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => openPaper(result.filename)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                    >
                      <ExternalLink size={16} />
                      Open
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filter Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <Filter size={24} className="text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">Search with Filters</h2>
          </div>

          <div className="space-y-6">
            {/* Grade Level */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Grade Level</label>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setGrade('0452');
                    setComponent('12'); // Reset component for IGCSE
                  }}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    grade === '0452'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  IGCSE
                </button>
                <button
                  onClick={() => {
                    setGrade('9706');
                    setComponent('12'); // Reset component for A-Level
                  }}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    grade === '9706'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  A Level
                </button>
              </div>
            </div>

            {/* Subject Codes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Subject Code</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setGrade('0452')}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    grade === '0452'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  0452
                </button>
                <button
                  onClick={() => setGrade('9706')}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    grade === '9706'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  9706
                </button>
              </div>
            </div>

            {/* Series */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Series</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setSeries('s')}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    series === 's'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  May/June (s)
                </button>
                <button
                  onClick={() => setSeries('w')}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    series === 'w'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Oct/Nov (w)
                </button>
                <button
                  onClick={() => setSeries('m')}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    series === 'm'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Feb/Mar (m)
                </button>
              </div>
            </div>

            {/* Paper Types */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <label className="block text-sm font-semibold text-gray-700">Paper Type</label>
                <span className="text-xs text-gray-500">Choose the document type you need</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setDocType('qp')}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    docType === 'qp'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Question Paper"
                >
                  QP
                </button>
                <button
                  onClick={() => setDocType('ms')}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    docType === 'ms'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Mark Scheme"
                >
                  MS
                </button>
                <button
                  onClick={() => setDocType('in')}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    docType === 'in'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Insert/Source Material"
                >
                  Insert
                </button>
                <button
                  onClick={() => setDocType('gt')}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    docType === 'gt'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Grade Thresholds"
                >
                  GT
                </button>
                <button
                  onClick={() => setDocType('er')}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    docType === 'er'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Examiner Report"
                >
                  ER
                </button>
              </div>
            </div>

            {/* Paper Components */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Paper Component</label>
              <div className="flex flex-wrap gap-3">
                {componentsForGrade.map((c) => (
                  <button
                    key={c}
                    onClick={() => setComponent(c)}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      component === c
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Year Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Year</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {Array.from({ length: 10 }, (_, i) => 2025 - i).map((y) => (
                  <button
                    key={y}
                    onClick={() => setYear(y.toString())}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      year === y.toString()
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Selection Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Current Selection:</h3>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full">
                {grade === '0452' ? 'IGCSE (0452)' : 'A Level (9706)'}
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full">
                {series === 's' ? 'May/June' : series === 'w' ? 'Oct/Nov' : 'Feb/Mar'} {year}
              </span>
              <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full">
                {docType === 'qp' ? 'Question Paper' : 
                 docType === 'ms' ? 'Mark Scheme' : 
                 docType === 'in' ? 'Insert' : 
                 docType === 'gt' ? 'Grade Thresholds' : 'Examiner Report'}
              </span>
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full">
                Component {component}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Looking for: <span className="font-mono">{grade}_{series}{year.slice(-2)}_{docType}_{component}.pdf</span>
            </p>
          </div>

          <div className="mt-6">
            <button
              onClick={handleFilterSearch}
              disabled={isLoading}
              className="w-full px-6 py-4 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
            >
              <FileText size={20} />
              {isLoading ? 'Searching...' : 'Open Paper'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
