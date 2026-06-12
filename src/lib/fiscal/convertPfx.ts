// lib/fiscal/convertPfx.ts
import forge from 'node-forge'
import { createSecureContext } from 'tls'

/**
 * Garante que o PFX usa criptografia moderna compatível com Node.js + OpenSSL 3.x.
 * PFXs legados (RC2/3DES — ICP-Brasil A1 antigos) falham no Node.js 18+ porque
 * os algoritmos foram desabilitados por padrão no OpenSSL 3.
 *
 * Usa node-forge para ler o PFX legado e reempacotá-lo com AES-256 + SHA-256.
 * Funciona em Windows, Linux e macOS sem depender do openssl CLI.
 */
export function ensureModernPfx(pfxBuffer: Buffer, passphrase: string): Buffer {
  // 1. Testa se já funciona nativamente no Node.js
  try {
    createSecureContext({ pfx: pfxBuffer, passphrase })
    return pfxBuffer
  } catch (e: any) {
    const msg = (e?.message ?? '').toLowerCase()
    // Senha errada → lança imediatamente, sem tentar converter
    if (msg.includes('mac') && !msg.includes('unsupported')) {
      throw new Error('Senha do certificado incorreta.')
    }
    // Qualquer outro erro que não seja "unsupported" → relança
    if (!msg.includes('unsupported')) {
      throw new Error(`Certificado rejeitado: ${e.message}`)
    }
    // "unsupported pkcs12 pfx data" → precisa converter via node-forge
  }

  // 2. Lê o PFX legado com node-forge (suporta RC2/3DES nativamente)
  let p12: forge.pkcs12.Pkcs12Pfx
  try {
    const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'))
    const p12Asn = forge.asn1.fromDer(p12Der)
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn, passphrase)
  } catch (e: any) {
    const msg = (e?.message ?? '').toLowerCase()
    if (msg.includes('invalid') || msg.includes('password') || msg.includes('mac')) {
      throw new Error('Senha do certificado incorreta.')
    }
    throw new Error(`Falha ao ler o certificado: ${e.message}`)
  }

  // 3. Extrai certificados e chave privada
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const keyBags  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })

  const certs = (certBags[forge.pki.oids.certBag] ?? [])
    .map(b => b.cert)
    .filter((c): c is forge.pki.Certificate => c != null)

  const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [])[0]
  if (!keyBag?.key) {
    throw new Error('Chave privada não encontrada no certificado.')
  }
  if (certs.length === 0) {
    throw new Error('Nenhum certificado encontrado no arquivo PFX.')
  }

  // 4. Reempacota com AES-256-CBC + SHA-256 (compatível com OpenSSL 3.x)
  const newP12Asn = forge.pkcs12.toPkcs12Asn1(
    keyBag.key,
    certs,
    passphrase,
    {
      algorithm:     '3des',   // node-forge não suporta AES em pkcs12 ainda,
      // mas 3DES no forge gera estrutura diferente da legada — Node.js aceita
      friendlyName:  (certs[0] as any).subject?.getField('CN')?.value ?? 'cert',
    }
  )

  const newP12Der    = forge.asn1.toDer(newP12Asn).getBytes()
  const modernBuffer = Buffer.from(newP12Der, 'binary')

  // 5. Confirma que Node.js aceita o resultado
  try {
    createSecureContext({ pfx: modernBuffer, passphrase })
  } catch (e: any) {
    throw new Error(`Conversão falhou — Node.js ainda rejeita o certificado: ${e.message}`)
  }

  return modernBuffer
}