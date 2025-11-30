'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            📚 AnneRuth
          </h1>
          <div className="flex gap-4">
            <Link href="/notes" className="text-gray-700 hover:text-purple-600 font-medium">
              Notes
            </Link>
            <Link href="/past-papers" className="text-gray-700 hover:text-purple-600 font-medium">
              Past Papers
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center"
      >
        <h2 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6">
          Accounting Notes for{' '}
          <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            IGCSE & A Levels
          </span>
        </h2>
        <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
          Cambridge exam preparation resources for IGCSE (0452) and A-Level (9706) Accounting
        </p>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto mb-12">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-6 py-3 rounded-lg border-2 border-purple-300 focus:border-purple-600 focus:outline-none text-gray-900 placeholder-gray-500"
          />
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/notes"
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
          >
            Browse Notes
          </Link>
          <Link
            href="/past-papers"
            className="px-8 py-3 border-2 border-purple-600 text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-all"
          >
            Past Papers
          </Link>
        </div>
      </motion.section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid md:grid-cols-3 gap-8">
        {[
          { icon: '📖', title: 'Comprehensive Notes', desc: 'Organized by topic and level' },
          { icon: '📝', title: 'Past Papers', desc: 'Access exam papers and mark schemes' },
          { icon: '✏️', title: 'Annotations', desc: 'Draw and annotate on papers' },
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.2 }}
            className="p-6 bg-white rounded-lg border border-purple-100 hover:shadow-lg transition-all"
          >
            <p className="text-4xl mb-3">{feature.icon}</p>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
            <p className="text-gray-600">{feature.desc}</p>
          </motion.div>
        ))}
      </section>
    </div>
  );
}