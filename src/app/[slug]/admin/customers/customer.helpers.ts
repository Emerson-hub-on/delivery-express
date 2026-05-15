import { Customer } from '@/types/customer'

export function maskPhone(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/^(\d{2})(\d)/,        '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/,   '$1-$2')
}

export function maskCpf(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4')
    .replace(/-$/, '')
}

export function maskCnpj(v: string) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5')
    .replace(/-$/, '')
}

export function displayDoc(c: Pick<Customer, 'pessoa_tipo' | 'cpf' | 'cnpj'>) {
  if (c.pessoa_tipo === 'juridica') return c.cnpj ? maskCnpj(c.cnpj) : '—'
  return c.cpf ? maskCpf(c.cpf) : '—'
}