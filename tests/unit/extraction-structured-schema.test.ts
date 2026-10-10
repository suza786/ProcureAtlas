import { describe, expect, it } from 'vitest'
import { RequirementExtractionSchema } from '@/lib/llm'
import { bodySchemas } from '@/lib/api-validation'

const item = { category: 'financial', criterion: 'Minimum turnover', operator: '>=', threshold: 'USD 100,000',
  isMandatory: true, sourceSnippet: 'Annual turnover must be at least USD 100,000.', confidence: 0.9 }
describe('structured extraction suggestions', () => {
  it('preserves explicit structured values for human review and accepts the same edited payload', () => {
    const structured = { ...item, thresholdAmount: 100000, thresholdCurrency: 'USD', thresholdUnit: 'money', evaluationMetric: 'annual_turnover' }
    const result = RequirementExtractionSchema.parse({ items: [structured] })
    expect(result.items[0]).toEqual(structured)
    expect(bodySchemas.extraction.safeParse({ decision: 'edited', editedItems: result.items }).success).toBe(true)
    expect(result.items[0]).not.toHaveProperty('thresholdStatus')
  })
  it('does not infer a number or currency from legacy threshold text', () => {
    const result = RequirementExtractionSchema.parse({ items: [item] }).items[0]
    expect(result.threshold).toBe('USD 100,000')
    expect(result.thresholdAmount).toBeUndefined(); expect(result.thresholdCurrency).toBeUndefined()
  })
  it('preserves zero as an explicit amount', () => {
    expect(RequirementExtractionSchema.parse({ items: [{ ...item, thresholdAmount: 0 }] }).items[0].thresholdAmount).toBe(0)
  })
  it.each(['', '100000', NaN, Infinity, -1, 1e13])('rejects invalid numeric suggestions %s', thresholdAmount => {
    expect(RequirementExtractionSchema.safeParse({ items: [{ ...item, thresholdAmount }] }).success).toBe(false)
  })
  it.each(['XYZ', 'usd', '', 'US'])('rejects unsupported currency suggestions %s', thresholdCurrency => {
    expect(RequirementExtractionSchema.safeParse({ items: [{ ...item, thresholdCurrency }] }).success).toBe(false)
  })
})
