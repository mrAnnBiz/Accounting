'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { BookOpen, FileText, Zap, BarChart3, Users, ArrowRight, Sparkles } from 'lucide-react';

// Constants for consistent spacing
const SECTION_SPACING = 'py-20 lg:py-28';
const HEADING_LG = 'text-4xl sm:text-5xl lg:text-5xl font-bold text-gray-900';
const HEADING_MD = 'text-2xl sm:text-3xl font-bold text-gray-900';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-gray-200">
        <div className="absolute inset-0 bg-grid-slate-700/[0.025] bg-grid-pattern" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
        
        <div className={`relative ${SECTION_SPACING} mx-auto px-6 sm:px-8 lg:px-12 max-w-7xl`}>
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200">
              <Sparkles size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Cambridge Accounting Platform</span>
            </div>

            <h1 className={`${HEADING_LG} bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent`}>
              Cambridge Accounting
            </h1>

            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              Master IGCSE & A-Level with 929 past papers and interactive tools
            </p>

            <div className="pt-6">
              <Link
                href="/past-papers"
                className="inline-flex items-center gap-2 px-10 py-4 bg-blue-600 text-white rounded-lg font-bold text-base hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 group"
              >
                <FileText size={20} />
                Browse Past Papers
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto px-6 sm:px-8 lg:px-12 max-w-7xl py-12 lg:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
            {[
              { value: '929+', label: 'Past Papers' },
              { value: '2 Levels', label: 'IGCSE & A-Level' },
              { value: 'iPad Ready', label: 'Apple Pencil' },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center justify-center">
                <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-2">
                  {stat.value}
                </div>
                <p className="text-gray-600 text-sm sm:text-base">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={`border-b border-gray-200 ${SECTION_SPACING}`}>
        <div className="mx-auto px-6 sm:px-8 lg:px-12 max-w-7xl">
          <h2 className={`${HEADING_LG} text-center mb-16`}>Key Features</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: FileText, title: 'Past Papers', desc: '929 papers with mark schemes' },
              { icon: BookOpen, title: 'Study Notes', desc: 'Comprehensive topic guides' },
              { icon: Zap, title: 'Annotations', desc: 'iPad Pencil support' },
              { icon: BarChart3, title: 'Progress', desc: 'Track your learning' },
              { icon: Users, title: 'Patterns', desc: 'Exam structure insights' },
              { icon: Sparkles, title: 'Smart Search', desc: 'Find by paper code' },
            ].map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className="group flex flex-col gap-4 p-6 rounded-lg bg-white border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-300"
                >
                  <Icon size={32} className="text-blue-600 group-hover:scale-110 transition-transform duration-300" />
                  <div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">{feature.title}</h3>
                    <p className="text-gray-600 text-sm">{feature.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      {/* Get Started Section */}
      <section className={`border-b border-gray-200 bg-gray-50 ${SECTION_SPACING}`}>
        <div className="mx-auto px-6 sm:px-8 lg:px-12 max-w-7xl">
          <h2 className={`${HEADING_LG} text-center mb-16`}>Get Started</h2>

          <div className="grid sm:grid-cols-4 gap-6 sm:gap-4">
            {[
              { num: '01', title: 'Search', desc: 'Find papers' },
              { num: '02', title: 'View', desc: 'Open instantly' },
              { num: '03', title: 'Annotate', desc: 'Mark with Pencil' },
              { num: '04', title: 'Learn', desc: 'Master content' },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl sm:text-5xl font-bold text-blue-200 mb-3">{step.num}</div>
                <h3 className="text-base font-bold text-gray-900 mb-1">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`border-b border-gray-200 ${SECTION_SPACING}`}>
        <div className="mx-auto px-6 sm:px-8 lg:px-12 max-w-7xl flex flex-col items-center">
          <div className="w-full max-w-2xl">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-8 sm:p-10 text-center">
              <h2 className={`${HEADING_MD} mb-4`}>Ready to start?</h2>

              <Link
                href="/past-papers"
                className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg font-bold text-base hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 group"
              >
                <FileText size={18} />
                Start Studying
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 py-8 lg:py-10">
        <div className="mx-auto px-6 sm:px-8 lg:px-12 max-w-7xl">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-sm">
                  A
                </div>
                <span className="font-bold text-gray-900 text-base">Anneruth</span>
              </div>
              <p className="text-gray-600 text-sm">Cambridge Accounting Study Platform</p>
            </div>
            <div className="flex gap-8 text-sm">
              <Link href="/past-papers" className="text-gray-600 hover:text-gray-900 transition-colors">
                Past Papers
              </Link>
              <Link href="/notes" className="text-gray-600 hover:text-gray-900 transition-colors">
                Study Notes
              </Link>
            </div>
          </div>
          <div className="border-t border-gray-200 mt-6 pt-6 text-center text-gray-500 text-xs">
            <p>© 2025 Anneruth. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
