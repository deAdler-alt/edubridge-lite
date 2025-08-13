export async function extractFromUrl(url) {
  const r = await fetch(`/api/extract?url=${encodeURIComponent(url)}`, {
    method: 'GET',
    headers: { 'accept': 'application/json' }
  })
  let data = null
  try {
    data = await r.json()
  } catch {
    throw new Error('Invalid response')
  }
  if (!data.ok) {
    throw new Error(data.error || 'Extraction failed')
  }
  return data // { ok:true, title, text }
}
