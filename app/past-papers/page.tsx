'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function PastPapersPage() {
  const [grade, setGrade] = useState('IGCSE');
  const [year, setYear] = useState('2025');
  const [series, setSeries] = useState('s');
  const [component, setComponent] = useState('12');
  const [docType, setDocType] = useState('qp');

  const generateURL = () => {
    const curriculum = grade === 'IGCSE' ? 'cambridge-igcse' : 'cambridge-international-a-level';
    const code = grade === 'IGCSE' ? '0452' : '9706';
    const url = `https://bestexamhelp.com/exam/${curriculum}/accounting-${code}/${year}/${code}-${series}${year.slice(-2)}-${docType}-${component}.php`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/" className="text-purple-600 hover:text-purple-700 mb-4 inline-block">
            ← Back Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">Past Papers</h1>
        </div>
      </div>

      {/* URL Builder */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-lg border border-purple-100 shadow-lg"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Find Your Papers</h2>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Grade */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Grade</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-4 py-2 border-2 border-purple-300 rounded-lg focus:border-purple-600 focus:outline-none"
              >
                <option>IGCSE</option>
                <option>A-Level</option>
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-4 py-2 border-2 border-purple-300 rounded-lg focus:border-purple-600 focus:outline-none"
              >
                {Array.from({ length: 10 }, (_, i) => 2025 - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Series */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Series</label>
              <select
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                className="w-full px-4 py-2 border-2 border-purple-300 rounded-lg focus:border-purple-600 focus:outline-none"
              >
                <option value="f">Feb/Mar (f)</option>
                <option value="w">Oct/Nov (w)</option>
                <option value="s">May/Jun (s)</option>
              </select>
            </div>

            {/* Component */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Component</label>
              <select
                value={component}
                onChange={(e) => setComponent(e.target.value)}
                className="w-full px-4 py-2 border-2 border-purple-300 rounded-lg focus:border-purple-600 focus:outline-none"
              >
                {grade === 'IGCSE' ? (
                  <>
                    <option value="12">Component 1/2</option>
                    <option value="22">Component 2/2</option>
                  </>
                ) : (
                  <>
                    <option value="12">Component 1/2 (AS)</option>
                    <option value="22">Component 2/2 (AS)</option>
                    <option value="32">Component 3/2 (A-Level)</option>
                    <option value="42">Component 4/2 (A-Level)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Document Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Document Type</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'qp', label: 'Question Paper' },
                { value: 'ms', label: 'Mark Scheme' },
                { value: 'in', label: 'Insert' },
                { value: 'gt', label: 'Grade Threshold' },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setDocType(type.value)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    docType === type.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateURL}
            className="w-full mt-8 px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
          >
            Open Paper →
          </button>
        </motion.div>
      </div>
    </div>
  );
}
