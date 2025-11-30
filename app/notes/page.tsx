'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const NOTES_DATA = {
  IGCSE_0452: {
    level: 'IGCSE',
    code: '0452',
    sections: [
      {
        name: 'Section A: Accounting Basics',
        notes: [
          { id: 'igcse-001', title: 'What is Accounting', slug: 'what-is-accounting' },
          { id: 'igcse-002', title: 'The Accounting Equation', slug: 'accounting-equation' },
          { id: 'igcse-003', title: 'Double Entry Bookkeeping', slug: 'double-entry' },
        ],
      },
      {
        name: 'Section B: Recording Transactions',
        notes: [
          { id: 'igcse-004', title: 'Source Documents', slug: 'source-documents' },
          { id: 'igcse-005', title: 'Journals and Ledgers', slug: 'journals-ledgers' },
        ],
      },
      {
        name: 'Section C: Financial Statements',
        notes: [
          { id: 'igcse-006', title: 'Income Statement', slug: 'income-statement' },
          { id: 'igcse-007', title: 'Balance Sheet', slug: 'balance-sheet' },
        ],
      },
    ],
  },
  AL_9706: {
    level: 'A-Level',
    code: '9706',
    sections: [
      {
        name: 'Module 1: Management Accounting',
        notes: [
          { id: 'al-001', title: 'Cost Classification', slug: 'cost-classification' },
          { id: 'al-002', title: 'Cost Behavior', slug: 'cost-behavior' },
          { id: 'al-003', title: 'Costing Methods', slug: 'costing-methods' },
        ],
      },
      {
        name: 'Module 2: Financial Accounting',
        notes: [
          { id: 'al-004', title: 'IFRS Standards', slug: 'ifrs-standards' },
          { id: 'al-005', title: 'Consolidated Statements', slug: 'consolidated' },
        ],
      },
      {
        name: 'Module 3: Decision Making',
        notes: [
          { id: 'al-006', title: 'Relevant Costing', slug: 'relevant-costing' },
          { id: 'al-007', title: 'CVP Analysis', slug: 'cvp-analysis' },
        ],
      },
    ],
  },
};

export default function NotesPage() {
  const [activeLevel, setActiveLevel] = useState<'IGCSE_0452' | 'AL_9706'>('IGCSE_0452');

  const data = NOTES_DATA[activeLevel];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/" className="text-purple-600 hover:text-purple-700 mb-4 inline-block">
            ← Back Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Study Notes</h1>

          {/* Level Tabs */}
          <div className="flex gap-4">
            {['IGCSE_0452', 'AL_9706'].map((level) => (
              <button
                key={level}
                onClick={() => setActiveLevel(level as 'IGCSE_0452' | 'AL_9706')}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  activeLevel === level
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {level === 'IGCSE_0452' ? 'IGCSE (0452)' : 'A-Level (9706)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {data.sections.map((section, sIdx) => (
          <motion.div key={sIdx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{section.name}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {section.notes.map((note) => (
                <Link key={note.id} href={`/notes/${note.slug}`}>
                  <motion.div
                    whileHover={{ y: -5 }}
                    className="p-6 bg-white rounded-lg border border-purple-100 hover:shadow-lg transition-all cursor-pointer"
                  >
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{note.title}</h3>
                    <p className="text-gray-600 text-sm">Click to view full content</p>
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
