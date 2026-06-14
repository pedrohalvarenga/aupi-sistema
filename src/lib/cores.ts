// Extração de paleta a partir do logo da empresa (client-side, via canvas).
// Usada no onboarding para detectar automaticamente a identidade visual.
// Projetada para NUNCA lançar: em qualquer falha, devolve null e o chamador
// mantém as cores atuais.

const FALLBACK = { primaria: '#2F9E6E', secundaria: '#D98232' }

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => clamp(n).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase()
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s, l }
}

function escurecer(hex: string, fator: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return rgbToHex(r * fator, g * fator, b * fator)
}

function clarear(hex: string, fator: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return rgbToHex(r + (255 - r) * fator, g + (255 - g) * fator, b + (255 - b) * fator)
}

/**
 * Lê o logo e devolve a cor primária (tom dominante mais vibrante) e uma
 * secundária. Para logos preto-e-branco/monocromáticos, deriva um tom
 * neutro do próprio logo (nunca impõe a cor da Aupipet nesse caso).
 * Devolve `null` se a imagem não puder ser lida — o chamador deve manter
 * as cores atuais nesse caso.
 */
export async function extrairCoresDoArquivo(
  file: File
): Promise<{ primaria: string; secundaria: string } | null> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new window.Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('falha ao carregar imagem'))
      i.src = url
    })

    const max = 120
    const scale = Math.min(1, max / Math.max(img.width || 1, img.height || 1))
    const w = Math.max(1, Math.round((img.width || 1) * scale))
    const h = Math.max(1, Math.round((img.height || 1) * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)

    let data: Uint8ClampedArray
    try {
      data = ctx.getImageData(0, 0, w, h).data
    } catch {
      return null // canvas tainted / sem permissão
    }

    // Passe 1: buckets de matiz só com pixels vibrantes (descarta fundo/cinza)
    const buckets = Array.from({ length: 24 }, () => ({ count: 0, r: 0, g: 0, b: 0, hue: 0 }))
    // Acumuladores do passe 2 (qualquer pixel não-transparente e não-branco)
    let nR = 0, nG = 0, nB = 0, nCount = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
      if (a < 128) continue
      const { h: hue, s, l } = rgbToHsl(r, g, b)
      if (l < 0.96) { nR += r; nG += g; nB += b; nCount++ } // ignora branco puro
      if (l > 0.92 || l < 0.08 || s < 0.18) continue
      const idx = Math.min(23, Math.floor(hue / 15))
      const bk = buckets[idx]
      const peso = 1 + s
      bk.count += peso; bk.r += r * peso; bk.g += g * peso; bk.b += b * peso; bk.hue += hue * peso
    }

    const ordenados = buckets
      .filter((b) => b.count > 0)
      .map((b) => ({
        count: b.count,
        hex: rgbToHex(b.r / b.count, b.g / b.count, b.b / b.count),
        hue: b.hue / b.count,
      }))
      .sort((a, b) => b.count - a.count)

    // Logo com cores vibrantes → usa o tom dominante
    if (ordenados.length > 0) {
      const primaria = ordenados[0].hex
      const segundo = ordenados.find(
        (b) => Math.abs(b.hue - ordenados[0].hue) > 40 && Math.abs(b.hue - ordenados[0].hue) < 320
      )
      const secundaria = segundo ? segundo.hex : escurecer(primaria, 0.72)
      return { primaria, secundaria }
    }

    // Logo monocromático/P&B → deriva um tom neutro do próprio logo
    if (nCount > 0) {
      const base = rgbToHex(nR / nCount, nG / nCount, nB / nCount)
      // se o tom médio for muito claro, escurece para virar cor de UI utilizável
      const { l } = rgbToHsl(nR / nCount, nG / nCount, nB / nCount)
      const primaria = l > 0.6 ? escurecer(base, 0.5) : base
      return { primaria, secundaria: clarear(primaria, 0.35) }
    }

    return FALLBACK
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
