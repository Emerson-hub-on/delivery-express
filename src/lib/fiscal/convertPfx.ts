// lib/fiscal/convertPfx.ts
import { execSync } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { createSecureContext } from 'tls'

/**
 * Garante que o PFX usa criptografia moderna (AES-256 + SHA-256).
 * PFXs legados (RC2/3DES — ICP-Brasil antigos) falham no Node.js 18+ com
 * OpenSSL 3.x pois os algoritmos foram desabilitados por padrão.
 *
 * Retorna o Buffer do PFX pronto para uso — convertido se necessário.
 */
export function ensureModernPfx(pfxBuffer: Buffer, passphrase: string): Buffer {
  // Testa se já funciona
  try {
    createSecureContext({ pfx: pfxBuffer, passphrase })
    return pfxBuffer // já moderno, sem conversão
  } catch (e: any) {
    const msg = (e?.message ?? '').toLowerCase()
    // Senha errada → lança sem tentar converter
    if (msg.includes('mac') && !msg.includes('unsupported')) {
      throw new Error('Senha do certificado incorreta.')
    }
    // "unsupported pkcs12" → precisa converter
    if (!msg.includes('unsupported')) {
      throw new Error(`Certificado rejeitado: ${e.message}`)
    }
  }

  // Converte via openssl CLI (disponível em qualquer servidor Linux/macOS)
  const id      = randomBytes(8).toString('hex')
  const inPath  = join(tmpdir(), `pfx_in_${id}.pfx`)
  const pemPath = join(tmpdir(), `pfx_pem_${id}.pem`)
  const outPath = join(tmpdir(), `pfx_out_${id}.pfx`)

  try {
    writeFileSync(inPath, pfxBuffer, { mode: 0o600 })

    // Extrai cert + chave com flag -legacy (necessário para RC2/3DES)
    execSync(
      `openssl pkcs12 -in "${inPath}" -passin "pass:${passphrase}" ` +
      `-out "${pemPath}" -nodes -legacy`,
      { stdio: 'pipe' }
    )

    // Reempacota com AES-256 + SHA-256
    execSync(
      `openssl pkcs12 -export -in "${pemPath}" ` +
      `-passout "pass:${passphrase}" -out "${outPath}" ` +
      `-keypbe AES-256-CBC -certpbe AES-256-CBC -macalg SHA256`,
      { stdio: 'pipe' }
    )

    const modernPfx = readFileSync(outPath)

    // Confirma que Node.js aceita o resultado
    createSecureContext({ pfx: modernPfx, passphrase })

    return modernPfx
  } catch (e: any) {
    const msg = (e?.message ?? e?.stderr?.toString() ?? '').toLowerCase()
    if (msg.includes('mac') || msg.includes('bad decrypt')) {
      throw new Error('Senha do certificado incorreta.')
    }
    throw new Error(`Falha ao converter certificado: ${e.message ?? e}`)
  } finally {
    for (const p of [inPath, pemPath, outPath]) {
      try { unlinkSync(p) } catch {}
    }
  }
}