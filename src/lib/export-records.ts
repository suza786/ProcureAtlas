import { db } from './db'

export async function* cursorRecords<T extends { id: string }>(fetchPage: (cursor: string | undefined) => Promise<T[]>): AsyncGenerator<T> {
  let cursor: string | undefined
  for (;;) {
    const page = await fetchPage(cursor)
    if (!page.length) return
    for (const row of page) yield row
    const next = page[page.length - 1].id
    if (next === cursor) throw new Error('Export cursor did not advance')
    cursor = next
  }
}

export async function* exportRecords(exportType: string, tenantId: string): AsyncGenerator<Record<string, unknown>> {
  const page = (cursor: string | undefined) => ({ take: 250, orderBy: { id: 'asc' as const }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) })
  const companyWhere = { company: { tenantId } }
  const sources = {
    tenders: () => cursorRecords(cursor => db.tender.findMany({ ...page(cursor), where: { status: 'active' }, select: { id: true, title: true, market: true, sector: true, country: true, valueUSD: true, submissionDeadline: true, status: true, sourcePortal: true, sourceUrl: true } })),
    awards: () => cursorRecords(cursor => db.award.findMany({ ...page(cursor), include: { supplier: { select: { name: true } }, tender: { select: { title: true } } } })),
    pursuits: () => cursorRecords(cursor => db.pursuit.findMany({ ...page(cursor), where: { tenantId } })),
    evidence: () => cursorRecords(cursor => db.evidence.findMany({ ...page(cursor), where: companyWhere })),
    audit_log: () => cursorRecords(cursor => db.auditLog.findMany({ ...page(cursor), where: { tenantId } })),
    companies: () => cursorRecords(cursor => db.company.findMany({ ...page(cursor), where: { tenantId } })),
    certifications: () => cursorRecords(cursor => db.certification.findMany({ ...page(cursor), where: companyWhere })),
    project_references: () => cursorRecords(cursor => db.projectReference.findMany({ ...page(cursor), where: companyWhere })),
    employees: () => cursorRecords(cursor => db.employee.findMany({ ...page(cursor), where: companyWhere })),
    proposals: () => cursorRecords(cursor => db.proposal.findMany({ ...page(cursor), where: { tenantId } })),
    capabilities: () => cursorRecords(cursor => db.capabilityFact.findMany({ ...page(cursor), where: { tenantId } })),
    supplier_annotations: () => cursorRecords(cursor => db.tenantSupplierAnnotation.findMany({ ...page(cursor), where: { tenantId } })),
  }
  if (exportType === 'full_backup') {
    for (const kind of ['companies', 'pursuits', 'evidence', 'certifications', 'project_references', 'employees', 'proposals', 'audit_log', 'capabilities', 'supplier_annotations'] as const) {
      for await (const record of sources[kind]()) yield { entityType: kind, record }
    }
  } else {
    const source = sources[exportType as keyof typeof sources]
    if (!source) throw new Error('Unsupported export type')
    for await (const record of source()) yield record
  }
}
