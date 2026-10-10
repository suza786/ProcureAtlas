import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from './db'
import type { ThresholdRequirement } from './requirement-evaluation'

export interface EvaluatableRequirement extends ThresholdRequirement {
  id?: string
  criterion: string
  category: string
  isMandatory: boolean
}

const reviewedRequirements = z.array(z.object({
  criterion: z.string(), category: z.string(), isMandatory: z.boolean(),
  evaluationMetric: z.string().nullable().optional(), thresholdStatus: z.string().optional(),
  thresholdAmount: z.number().finite().nullable().optional(), thresholdCurrency: z.string().nullable().optional(),
  thresholdUnit: z.string().nullable().optional(), operator: z.string().nullable().optional(),
}))

/** Private review overlays never alter canonical rows or remove mandatory gates. */
export async function loadTenantEvaluationRequirements(tenantId: string, tenderId: string,
  canonical: EvaluatableRequirement[], client: Pick<Prisma.TransactionClient, 'tenantRequirementReview'> = db
): Promise<EvaluatableRequirement[]> {
  const review = await client.tenantRequirementReview.findFirst({
    where: { tenantId, tenderId, extraction: { reviewStatus: { in: ['approved', 'edited'] } } },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  })
  if (!review) return canonical
  let privateRequirements: z.infer<typeof reviewedRequirements>
  try {
    const parsed = reviewedRequirements.safeParse(JSON.parse(review.itemsJson))
    if (!parsed.success) return canonical
    privateRequirements = parsed.data
  } catch { return canonical }
  const evaluated = canonical.map(requirement => {
    const matches = privateRequirements.filter(item => item.criterion === requirement.criterion && item.category === requirement.category)
    if (matches.length !== 1) return requirement
    return { ...requirement, ...matches[0], isMandatory: requirement.isMandatory || matches[0].isMandatory }
  })
  const extras = privateRequirements.flatMap((item, index) => canonical.some(requirement =>
    item.criterion === requirement.criterion && item.category === requirement.category) ? [] :
    [{ ...item, id: `tenant-review:${review.id}:${index}` }])
  return [...evaluated, ...extras]
}
