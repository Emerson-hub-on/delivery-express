import { type NfEntrada, type Evento, STATUS_LABEL, STATUS_COLOR } from './types'

export function NotaCard({
  nota,
  excluindo,
  onManifestar,
  onExcluir,
}: {
  nota: NfEntrada
  excluindo: string | null
  onManifestar: (chave: string, evento: Evento) => void
  onExcluir: (chave: string) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">

      {/* Número + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 text-sm">Nº {nota.numero} / {nota.serie}</p>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate" title={nota.chave}>
            {nota.chave}
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[nota.status]}`}>
          {STATUS_LABEL[nota.status]}
        </span>
      </div>

      {/* Emitente */}
      <div>
        <p className="text-sm text-gray-700 font-medium truncate">{nota.emitente_razao}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {nota.emitente_cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
        </p>
      </div>

      {/* Data + valor */}
      <div className="flex items-center justify-between">
        <span className="text-gray-500 text-xs">
          {new Date(nota.data_emissao).toLocaleDateString('pt-BR')}
        </span>
        <span className="font-semibold text-gray-800 text-sm">
          R$ {nota.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-50">
        {nota.status === 'pendente' && (
          <>
            <button onClick={() => onManifestar(nota.chave, 'ciencia')}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
              Ciência
            </button>
            <button onClick={() => onManifestar(nota.chave, 'confirmacao')}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
              Confirmar
            </button>
            <button onClick={() => onManifestar(nota.chave, 'recusa')}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
              Recusar
            </button>
            <button onClick={() => onManifestar(nota.chave, 'cancelamento')}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors">
              Cancelar
            </button>
          </>
        )}
        {nota.status === 'confirmada' && (
          <button onClick={() => onManifestar(nota.chave, 'cancelamento')}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors">
            Cancelar
          </button>
        )}
        {(nota.status === 'recusada' || nota.status === 'cancelada') && (
          <button onClick={() => onManifestar(nota.chave, 'reabrir')}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition-colors">
            Reabrir
          </button>
        )}
        {nota.xml_url && (
          <a href={nota.xml_url} target="_blank" rel="noopener noreferrer"
            className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
            XML
          </a>
        )}
        <button
          onClick={() => onExcluir(nota.chave)}
          disabled={excluindo === nota.chave}
          title="Excluir nota permanentemente"
          className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100
            transition-colors disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
        >
          {excluindo === nota.chave ? '...' : 'Excluir'}
        </button>
      </div>
    </div>
  )
}
