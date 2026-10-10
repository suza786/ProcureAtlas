import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withApiErrors } from '@/lib/api-errors'
import { readWebhookBody, verifyInboundWebhook } from '@/lib/inbound-webhook'
import { inboundTenderSchema, idSchema } from '@/lib/api-validation'
import { enqueueOutbox } from '@/lib/outbox'
function configuration(name: string): Record<string, unknown> {
  try { const value: unknown=JSON.parse(process.env[name]??'{}');if(value&&typeof value==='object'&&!Array.isArray(value))return value as Record<string,unknown> }catch{}
  return {}
}
export const POST=withApiErrors(async function POST(req:NextRequest){
  const body=await readWebhookBody(req)
  const {source,eventType,eventId,signature}=verifyInboundWebhook(req.headers,body,configuration('INBOUND_WEBHOOK_SECRETS'))
  const payload:unknown=JSON.parse(body)
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return NextResponse.json({error:'Payload must be an object'},{status:400})
  if(['worldbank','adb','ungm'].includes(source))inboundTenderSchema.parse(payload)
  const binding=idSchema.safeParse(configuration('INBOUND_WEBHOOK_TENANTS')[source])
  if(!binding.success)throw new Response('Webhook source tenant is not configured',{status:503})
  const tenantId=binding.data
  if(!await db.tenant.findUnique({where:{id:tenantId},select:{id:true}}))throw new Response('Webhook source tenant is unavailable',{status:503})
  try{
    const accepted=await db.$transaction(async tx=>{
      const webhook=await tx.inboundWebhook.create({data:{tenantId,source,eventType,eventId,signature,signatureValid:true,payloadJson:body,processedStatus:'pending'}})
      const job=await enqueueOutbox(tx,tenantId,'inbound.process',{webhookId:webhook.id})
      return {webhookId:webhook.id,jobId:job.id}
    })
    return NextResponse.json({success:true,...accepted,source,eventType,signatureValid:true,status:'queued'},{status:202})
  }catch(error){
    if(error&&typeof error==='object'&&'code' in error&&error.code==='P2002')return NextResponse.json({error:'Webhook event already accepted'},{status:409})
    throw error
  }
})
