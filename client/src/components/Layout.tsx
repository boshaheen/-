import { Link, Outlet, useLocation } from 'react-router-dom'

export default function Layout() {
  const location = useLocation()

  const navItem = (to: string, label: string) => (
    <Link
      to={to}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        location.pathname === to
          ? 'bg-amber-400 text-black'
          : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col">
      <header className="flex items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl">🐫</span>
          <span className="text-lg font-bold text-amber-300">مُقيّم الإبل الذكي</span>
        </Link>
        <nav className="flex gap-2">
          {navItem('/', 'الرئيسية')}
          {navItem('/history', 'السجل')}
        </nav>
      </header>

      <main className="flex flex-1 flex-col px-4 pb-10">
        <Outlet />
      </main>

      <footer className="px-4 py-6 text-center text-xs text-white/30">
        التقييم مبني على الذكاء الاصطناعي وهو استرشادي وليس بديلاً عن رأي خبراء المزايين
      </footer>
    </div>
  )
}
