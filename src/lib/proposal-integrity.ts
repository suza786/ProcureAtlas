export function evidenceIdsFromJson(json: string | null): string[] {
  const value = JSON.parse(json ?? '[]')
  if (!Array.isArray(value) || value.length > 100 || value.some(id => typeof id !== 'string' || !id)) {
    throw new Response('Stored evidence references are invalid; review this section', { status: 409 })
  }
  return [...new Set(value)]
}

/** Citation validation cannot prove prose true. All generated text still needs human approval. */
export function groundedDraft(content: string, citations: string[], allowed: Set<string>) {
  const evidenceIds = [...new Set(citations)]
  const inline = [...content.matchAll(/\[evidence:([a-zA-Z0-9_-]+)\]/g)].map(match => match[1])
  if (evidenceIds.some(id => !allowed.has(id)) || inline.some(id => !allowed.has(id) || !evidenceIds.includes(id)) ||
      evidenceIds.some(id => !inline.includes(id))) throw new Error('Draft citations must be approved IDs used inline as [evidence:ID]')
  return { evidenceIds, wordCount: content.trim().split(/\s+/).filter(Boolean).length,
    hasGaps: evidenceIds.length === 0 || /\[(?:gap|missing evidence)[^\]]*\]/i.test(content), reviewRequired: true }
}
