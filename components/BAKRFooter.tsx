import Link from 'next/link'

export default function BAKRFooter() {
  return (
    <footer className="bg-[#1F4E79] text-white py-8 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <p className="text-sm font-medium">BAKR — Business &amp; Accountants Knowledge Resource</p>
            <p className="text-xs text-blue-200 mt-1">Professional financial tools and education</p>
          </div>
          <div className="flex gap-6 text-sm text-blue-200">
            <Link href="/tools" className="hover:text-white transition-colors">Tools</Link>
            <Link href="/guideme/estate-planning" className="hover:text-white transition-colors">Guide Me</Link>
            <Link href="/privacypage" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
          </div>
        </div>
        <div className="border-t border-blue-800 mt-6 pt-4 text-center text-xs text-blue-300">
          © {new Date().getFullYear()} BAKR. All rights reserved. This information is general in nature and does not constitute financial advice.
        </div>
      </div>
    </footer>
  )
}
