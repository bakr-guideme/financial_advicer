import BAKRToolsNav from '@/components/BAKRToolsNav'
import BAKRFooter from '@/components/BAKRFooter'

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <BAKRToolsNav />
      <main className="flex-1">{children}</main>
      <BAKRFooter />
    </div>
  )
}
