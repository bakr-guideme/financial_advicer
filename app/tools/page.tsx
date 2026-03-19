'use client'

import Link from 'next/link'

const businessTools = [
  {
    name: 'Division 7A Loan Strategy Analyser',
    href: '/tools/div7a-analyser',
    description: 'Model Division 7A loan repayments, compare bank refinancing vs company loans, and analyse retirement planning scenarios with full tax calculations.',
    icon: '🏦',
    status: 'live' as const,
  },
  {
    name: 'Budget Builder',
    href: '/tools/budget-builder-myob',
    description: 'Upload your MYOB trial balance and general ledger exports to generate a formatted annual budget workbook with monthly projections.',
    icon: '📊',
    status: 'live' as const,
  },
  {
    name: 'Trust Distribution Analyser',
    href: '/tools/trust-distribution',
    description: 'Model trust income and capital distributions across multiple beneficiaries, analyse tax outcomes, and generate draft trust distribution minutes.',
    icon: '⚖️',
    status: 'live' as const,
  },
  {
    name: 'Super Contributions Optimiser',
    href: '/tools/super-optimiser',
    description: 'Comprehensive superannuation contributions analysis covering concessional, non-concessional, spouse, CGT, downsizer contributions and pension transfer balance caps.',
    icon: '💰',
    status: 'live' as const,
  },
]

const guideMeQuizzes = [
  {
    name: 'Estate Planning Assessment',
    href: '/guideme/estate-planning',
    description: 'A guided discovery quiz that identifies your estate planning needs across wills, powers of attorney, superannuation, trusts, and asset protection — then generates a personalised report.',
    icon: '📋',
    status: 'live' as const,
  },
  {
    name: 'Income Protection Checkup',
    href: '#',
    description: 'Assess your insurance coverage gaps across income protection, life, TPD, and trauma insurance.',
    icon: '🛡️',
    status: 'coming' as const,
  },
  {
    name: 'Business Succession Planning',
    href: '#',
    description: 'Guided assessment for business transition planning — buy/sell agreements, key person insurance, and exit strategies.',
    icon: '🏢',
    status: 'coming' as const,
  },
]

function StatusBadge({ status }: { status: 'live' | 'coming' }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Live
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      Coming Soon
    </span>
  )
}

export default function ToolsHub() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1F4E79] mb-3">
          BAKR Professional Tools
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Free calculation tools and guided assessments for accountants, financial planners, and their clients.
        </p>
      </div>

      <section className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#1F4E79] flex items-center justify-center text-white text-lg">🛠</div>
          <div>
            <h2 className="text-xl font-semibold text-[#1F4E79]">Business &amp; Tax Tools</h2>
            <p className="text-sm text-gray-500">Calculation and analysis tools for common advisory scenarios</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {businessTools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className={`group block p-6 bg-white rounded-xl border border-gray-200 transition-all duration-200 ${
                tool.status === 'live' ? 'hover:border-[#2E75B6] hover:shadow-md cursor-pointer' : 'opacity-60 cursor-default pointer-events-none'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{tool.icon}</span>
                <StatusBadge status={tool.status} />
              </div>
              <h3 className="text-lg font-semibold text-[#1F4E79] group-hover:text-[#2E75B6] transition-colors mb-2">{tool.name}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{tool.description}</p>
              {tool.status === 'live' && (
                <div className="mt-4 text-sm font-medium text-[#2E75B6] group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">Open Tool →</div>
              )}
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#2E75B6] flex items-center justify-center text-white text-lg">🧭</div>
          <div>
            <h2 className="text-xl font-semibold text-[#1F4E79]">Guide Me — Discovery Assessments</h2>
            <p className="text-sm text-gray-500">Guided quizzes that surface what you don&apos;t know you don&apos;t know</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guideMeQuizzes.map((quiz) => (
            <Link
              key={quiz.name}
              href={quiz.href}
              className={`group block p-6 bg-white rounded-xl border border-gray-200 transition-all duration-200 ${
                quiz.status === 'live' ? 'hover:border-[#2E75B6] hover:shadow-md cursor-pointer' : 'opacity-60 cursor-default pointer-events-none'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{quiz.icon}</span>
                <StatusBadge status={quiz.status} />
              </div>
              <h3 className="text-lg font-semibold text-[#1F4E79] group-hover:text-[#2E75B6] transition-colors mb-2">{quiz.name}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{quiz.description}</p>
              {quiz.status === 'live' && (
                <div className="mt-4 text-sm font-medium text-[#2E75B6] group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">Start Assessment →</div>
              )}
            </Link>
          ))}
        </div>
      </section>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
        <p className="text-sm text-[#1F4E79] font-medium mb-1">These tools are provided for educational and planning purposes only.</p>
        <p className="text-xs text-gray-500">Results should be verified by a qualified professional. Tax rates and thresholds are based on current ATO published rates and may change.</p>
      </div>
    </div>
  )
}
