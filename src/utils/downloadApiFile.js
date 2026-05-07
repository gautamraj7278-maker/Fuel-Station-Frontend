import api from '../services/api'

function parseFilename(contentDisposition) {
  const cd = String(contentDisposition || '')
  // RFC 5987: filename*=UTF-8''...
  const m5987 = cd.match(/filename\*=(?:UTF-8'')?([^;]+)/i)
  if (m5987 && m5987[1]) {
    try {
      return decodeURIComponent(m5987[1].trim().replace(/^"|"$/g, ''))
    } catch {
      return m5987[1].trim().replace(/^"|"$/g, '')
    }
  }
  const m = cd.match(/filename=([^;]+)/i)
  if (m && m[1]) return m[1].trim().replace(/^"|"$/g, '')
  return ''
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function downloadApiFile(path, { params, defaultFilename } = {}) {
  const res = await api.get(path, {
    params,
    responseType: 'blob',
    headers: { 'X-Suppress-Toast': '1' },
  })

  const filename = parseFilename(res.headers?.['content-disposition']) || defaultFilename || 'download'
  const blob = res.data instanceof Blob ? res.data : new Blob([res.data])
  downloadBlob(blob, filename)
}
