import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({find:vi.fn(),claim:vi.fn(),finish:vi.fn(),existing:vi.fn(),upsert:vi.fn(),enqueue:vi.fn(),transaction:vi.fn()}))
vi.mock('@/lib/db',()=>{const tx={inboundWebhook:{findFirst:mocks.find,updateMany:mocks.claim,update:mocks.finish},tender:{findUnique:mocks.existing,upsert:mocks.upsert},outboxJob:{create:mocks.enqueue}};return{db:{...tx,$transaction:(fn:(tx:unknown)=>unknown)=>mocks.transaction(fn,tx)}}})
import { dispatchInboundWebhook } from '@/lib/inbound-processing'
const job={id:'job1',tenantId:'tenant1',payloadJson:'{"webhookId":"inbound1"}'} as import('@prisma/client').OutboxJob
let record:{id:string;tenantId:string;source:string;signatureValid:boolean;eventId:string;payloadJson:string;processedStatus:string;createdAt:Date}
beforeEach(()=>{
  vi.resetAllMocks()
  record={id:'inbound1',tenantId:'tenant1',source:'worldbank',signatureValid:true,eventId:'event1',payloadJson:JSON.stringify({id:'external1',title:'Real tender',url:'https://example.com/tender',currency:'BDT',value:12000}),processedStatus:'pending',createdAt:new Date()}
  mocks.find.mockImplementation(async({where})=>where.tenantId===record.tenantId?{...record}:null)
  mocks.claim.mockImplementation(async({where,data})=>{if(where.tenantId!==record.tenantId||!where.processedStatus.in.includes(record.processedStatus))return{count:0};record.processedStatus=data.processedStatus;return{count:1}})
  mocks.finish.mockImplementation(async({data})=>{Object.assign(record,data);return record})
  mocks.transaction.mockImplementation(async(fn,tx)=>{const snapshot=structuredClone(record);try{return await fn(tx)}catch(error){record=snapshot;throw error}})
  mocks.upsert.mockResolvedValue({id:'tender1'});mocks.enqueue.mockResolvedValue({id:'eventjob1'})
})
describe('durable inbound processing',()=>{
  it('upserts source identity, keeps foreign-currency USD unknown, emits and marks processed atomically',async()=>{
    await dispatchInboundWebhook(job)
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({where:{sourcePortal_externalId:{sourcePortal:'worldbank',externalId:'external1'}},create:expect.objectContaining({estimatedValue:12000,currency:'BDT',valueUSD:null})}))
    expect(mocks.enqueue.mock.calls[0][0].data).toMatchObject({tenantId:'tenant1',kind:'webhook.event'})
    expect(JSON.parse(mocks.enqueue.mock.calls[0][0].data.payloadJson).eventType).toBe('tender.published')
    expect(record.processedStatus).toBe('processed')
    await dispatchInboundWebhook(job)
    expect(mocks.upsert).toHaveBeenCalledTimes(1);expect(mocks.enqueue).toHaveBeenCalledTimes(1)
  })
  it('rolls back processing claims on transient failure and safely retries once',async()=>{
    mocks.upsert.mockRejectedValueOnce(new Error('Temporary storage failure')).mockResolvedValueOnce({id:'tender1'})
    await expect(dispatchInboundWebhook(job)).rejects.toThrow('Temporary storage')
    expect(record.processedStatus).toBe('failed');expect(mocks.enqueue).not.toHaveBeenCalled()
    await dispatchInboundWebhook(job)
    expect(record.processedStatus).toBe('processed');expect(mocks.enqueue).toHaveBeenCalledTimes(1)
  })
  it('refuses foreign-tenant jobs and unauthenticated stored records',async()=>{
    await expect(dispatchInboundWebhook({...job,tenantId:'tenant2'})).rejects.toMatchObject({permanent:true})
    record.signatureValid=false
    await expect(dispatchInboundWebhook(job)).rejects.toMatchObject({permanent:true})
    expect(mocks.upsert).not.toHaveBeenCalled();expect(mocks.enqueue).not.toHaveBeenCalled()
  })
  it('keeps explicit USD zero and emits amendment when updating an existing tender',async()=>{
    record.payloadJson=JSON.stringify({reference:'ref1',title:'Updated tender',url:'https://example.com/tender',currency:'EUR',value:500,value_usd:0})
    mocks.existing.mockResolvedValue({id:'tender1'})
    await dispatchInboundWebhook(job)
    expect(mocks.upsert.mock.calls[0][0].update.valueUSD).toBe(0)
    expect(JSON.parse(mocks.enqueue.mock.calls[0][0].data.payloadJson).eventType).toBe('tender.amended')
  })
  it('marks unsupported source events ignored without fake tender creation',async()=>{
    record.source='custom'
    await dispatchInboundWebhook(job)
    expect(record.processedStatus).toBe('ignored');expect(mocks.upsert).not.toHaveBeenCalled()
  })
})
