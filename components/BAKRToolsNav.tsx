'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'

const toolLinks = [
  { name: 'Division 7A Analyser', href: '/tools/div7a-analyser' },
  { name: 'Budget Builder', href: '/tools/budget-builder-myob' },
  { name: 'Trust Distribution', href: '/tools/trust-distribution' },
  { name: 'Super Optimiser', href: '/tools/super-optimiser' },
]

const quizLinks = [
  { name: 'Estate Planning', href: '/guideme/estate-planning' },
]

export default function BAKRToolsNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false)
  const [quizDropdownOpen, setQuizDropdownOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex-shrink-0">
            <Image
              src="https://res.cloudinary.com/dmz8tsndt/image/upload/v1755063722/BAKR_New_Logo-01_fldmxk.svg"
              alt="BAKR"
              width={120}
              height={48}
              className="h-10 w-auto"
            />
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link href="/tools" className="px-3 py-2 text-sm font-medium text-[#1F4E79] hover:bg-[#F8F6EC] rounded-md transition-colors">
              All Tools
            </Link>

            <div className="relative">
              <button
                onClick={() => { setToolsDropdownOpen(!toolsDropdownOpen); setQuizDropdownOpen(false) }}
                onBlur={() => setTimeout(() => setToolsDropdownOpen(false), 150)}
                className="px-3 py-2 text-sm font-medium text-[#1F4E79] hover:bg-[#F8F6EC] rounded-md transition-colors flex items-center gap-1"
              >
                Business Tools
                <svg className={`w-4 h-4 transition-transform ${toolsDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {toolsDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {toolLinks.map((tool) => (
                    <Link key={tool.href} href={tool.href} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F8F6EC] hover:text-[#1F4E79] transition-colors">
                      {tool.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => { setQuizDropdownOpen(!quizDropdownOpen); setToolsDropdownOpen(false) }}
                onBlur={() => setTimeout(() => setQuizDropdownOpen(false), 150)}
                className="px-3 py-2 text-sm font-medium text-[#1F4E79] hover:bg-[#F8F6EC] rounded-md transition-colors flex items-center gap-1"
              >
                Guide Me
                <svg className={`w-4 h-4 transition-transform ${quizDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {quizDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {quizLinks.map((quiz) => (
                    <Link key={quiz.href} href={quiz.href} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F8F6EC] hover:text-[#1F4E79] transition-colors">
                      {quiz.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link href="/" className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-[#1F4E79] hover:bg-[#F8F6EC] rounded-md transition-colors">
              Home
            </Link>
          </div>

          <button className="md:hidden p-2 text-[#1F4E79] rounded-md hover:bg-[#F8F6EC]" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            <Link href="/tools" className="block px-3 py-2 text-sm font-medium text-[#1F4E79] hover:bg-[#F8F6EC] rounded-md" onClick={() => setMobileMenuOpen(false)}>All Tools</Link>
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Business Tools</div>
            {toolLinks.map((tool) => (
              <Link key={tool.href} href={tool.href} className="block px-3 py-2 pl-6 text-sm text-gray-700 hover:bg-[#F8F6EC] rounded-md" onClick={() => setMobileMenuOpen(false)}>{tool.name}</Link>
            ))}
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Guide Me</div>
            {quizLinks.map((quiz) => (
              <Link key={quiz.href} href={quiz.href} className="block px-3 py-2 pl-6 text-sm text-gray-700 hover:bg-[#F8F6EC] rounded-md" onClick={() => setMobileMenuOpen(false)}>{quiz.name}</Link>
            ))}
            <div className="border-t border-gray-100 mt-2 pt-2">
              <Link href="/" className="block px-3 py-2 text-sm text-gray-500 hover:bg-[#F8F6EC] rounded-md" onClick={() => setMobileMenuOpen(false)}>← Back to Home</Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
