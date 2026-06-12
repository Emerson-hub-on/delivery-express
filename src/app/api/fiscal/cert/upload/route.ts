// app/api/fiscal/cert/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ensureModernPfx } from '@/lib/fiscal/convertPfx'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { companyId, pfxBase64, senha, campo } = await req.json()
    // campo: 'cert_pfx_base64' | 'cert_cpf_pfx_base64'
    // senha: 'cert_senha'      | 'cert_cpf_senha'

    if (!companyId || !pfxBase64 || !senha || !campo) {
      return NextResponse.json(
        { message: 'Parâmetros obrigatórios: companyId, pfxBase64, senha, campo' },
        { status: 400 }
      )
    }

    // Limpa o base64 (remove prefixo data:..., espaços, etc.)
    let b64Clean = pfxBase64.replace(/\s+/g, '')
    if (b64Clean.includes(',')) b64Clean = b64Clean.split(',')[1] ?? b64Clean
    b64Clean = b64Clean.replace(/[^A-Za-z0-9+/=]/g, '')

    const pfxBuffer = Buffer.from(b64Clean, 'base64')

    if (pfxBuffer.length < 4 || pfxBuffer[0] !== 0x30) {
      return NextResponse.json(
        { message: 'Arquivo inválido: não é um PFX/PKCS#12 válido.' },
        { status: 400 }
      )
    }

    // Converte legado → moderno (ou valida se já for moderno)
    let modernBuffer: Buffer
    try {
      modernBuffer = ensureModernPfx(pfxBuffer, senha)
    } catch (e: any) {
      return NextResponse.json({ message: e.message }, { status: 400 })
    }

    const modernBase64 = modernBuffer.toString('base64')

    // Salva apenas o campo do certificado (não sobrescreve o resto do form)
    const campoDeSenha = campo === 'cert_pfx_base64' ? 'cert_senha' : 'cert_cpf_senha'
    const { error } = await supabaseAdmin
      .from('fiscal_configs')
      .update({ [campo]: modernBase64, [campoDeSenha]: senha })
      .eq('company_id', companyId)

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, convertido: modernBuffer !== pfxBuffer })
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? 'Erro interno' },
      { status: 500 }
    )
  }
}