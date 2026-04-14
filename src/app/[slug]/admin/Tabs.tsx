type Tab = 'products' | 'categories' | 'reports' 

export default function Tabs({
  tab,
  setTab
}: {
  tab: Tab
  setTab: (t: Tab) => void
}) {
  return (
    <div className="flex gap-2 mb-6">
      {(['products', 'categories', 'reports'] as Tab[]).map(t => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`text-sm px-4 py-1.5 rounded-md transition-colors font-medium
          ${tab === t
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'}`}
        >
          {t === 'products'
            ? 'Produtos'
            : t === 'categories'
            ? 'Categorias'
            : 'Relatórios'}
        </button>
      ))}
    </div>
  )
}