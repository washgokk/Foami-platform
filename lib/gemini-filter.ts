// lib/gemini-filter.ts
// Smart Categorization for Foami Marketplace Services with customizable Gemini AI or direct package clustering

export interface AICategory {
  id: string
  label: string
  service_ids: string[]
  service_names: string[]
}

export interface ServiceInput {
  id: string
  name: string
  description?: string
  price_s?: number
  price_m?: number
  price_l?: number
  image_url?: string
}

let cachedCategories: AICategory[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

export async function generateAICategories(services: ServiceInput[]): Promise<AICategory[]> {
  if (!services || services.length === 0) {
    return []
  }

  const now = Date.now()
  if (cachedCategories && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return cachedCategories
  }

  // Check if user explicitly wants AI categorization
  const useAI = process.env.USE_AI_CATEGORIES === 'true'
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

  if (useAI && apiKey) {
    try {
      const geminiResult = await callGeminiAPI(apiKey, model, services)
      if (geminiResult && geminiResult.length > 0) {
        cachedCategories = geminiResult
        cacheTimestamp = now
        return geminiResult
      }
    } catch (err) {
      console.warn('[Gemini Filter] AI call failed, using exact package clustering:', err)
    }
  }

  // Default: Direct truthful package clustering (Zero hallucinated words like ดูดฝุ่น or ขัดสี)
  const directResult = directPackageCategorizer(services)
  cachedCategories = directResult
  cacheTimestamp = now
  return directResult
}

async function callGeminiAPI(apiKey: string, model: string, services: ServiceInput[]): Promise<AICategory[] | null> {
  const serviceSummary = services.map(s => ({
    id: s.id,
    name: s.name,
    description: (s.description || '').replace(/\[Addons?:[^\]]+\]/gi, '').trim()
  }))

  const prompt = `You are a categorizer for car wash & auto detailing services.
Given these actual services offered by shops:
${JSON.stringify(serviceSummary, null, 2)}

STRICT RULES:
1. DO NOT invent or add any words that do not exist in the service names. For example, if a service is "ล้างสีธรรมดา", DO NOT add "ดูดฝุ่น" or "ขัดสี"!
2. Do not use addon items as main categories.
3. Group identical or closely matching real packages under concise Thai labels using words from the packages.
4. Output JSON: { "categories": [{ "id": "wash", "label": "ล้างสี", "service_ids": ["..."], "service_names": ["..."] }] }`

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    })

    if (!response.ok) return null
    const data = await response.json()
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) return null

    const parsed = JSON.parse(rawText)
    const categories: AICategory[] = (parsed.categories || [])
      .filter((cat: any) => cat.service_ids && Array.isArray(cat.service_ids) && cat.service_ids.length > 0)
      .map((cat: any) => ({
        id: String(cat.id || cat.label),
        label: String(cat.label),
        service_ids: cat.service_ids.map(String),
        service_names: (cat.service_names || []).map(String)
      }))

    if (categories.length > 0) return categories
  } catch (e) {
    console.warn(`[Gemini] Error with model ${model}:`, e)
  }
  return null
}

/**
 * 100% Truthful Package Categorizer
 * Extracts categories directly from actual package names in the DB.
 * No imaginary "ดูดฝุ่น", "ขัดสี" or addon items!
 */
function directPackageCategorizer(services: ServiceInput[]): AICategory[] {
  const categories: AICategory[] = []
  const seenLabels = new Set<string>()

  for (const s of services) {
    const name = (s.name || '').trim()
    if (!name) continue

    // Normalize label to high-level package tag
    let label = name
    let id = 'pkg-' + s.id.slice(0, 8)

    if (name.includes('เคลือบ')) {
      label = 'เคลือบเงา / เคลือบสี'
      id = 'coating'
    } else if (name.includes('ดีเทลลิ่ง') || name.includes('ห้องเครื่อง')) {
      label = 'ล้างรถดีเทลลิ่ง'
      id = 'detailing'
    } else if (name.includes('ล้างสี')) {
      label = 'ล้างสีธรรมดา'
      id = 'wash'
    } else if (name.includes('ซักเบาะ')) {
      label = 'ซักเบาะ / สปา'
      id = 'spa'
    } else if (name.includes('มอเตอร์ไซค์')) {
      label = 'มอเตอร์ไซค์'
      id = 'motorcycle'
    }

    if (seenLabels.has(label)) {
      const existing = categories.find(c => c.label === label)
      if (existing) {
        if (!existing.service_ids.includes(s.id)) existing.service_ids.push(s.id)
        if (!existing.service_names.includes(s.name)) existing.service_names.push(s.name)
      }
    } else {
      seenLabels.add(label)
      categories.push({
        id,
        label,
        service_ids: [s.id],
        service_names: [s.name]
      })
    }
  }

  return categories
}
