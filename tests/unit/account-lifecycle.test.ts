import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
const mocks=vi.hoisted(()=>({tokenFind:vi.fn(),tokenCreate:vi.fn(),tokenUpdate:vi.fn(),userFind:vi.fn(),userFirst:vi.fn(),userCreate:vi.fn(),userUpdate:vi.fn(),sessionUpdate:vi.fn(),keyUpdate:vi.fn(),audit:vi.fn(),jobCreate:vi.fn(),quota:vi.fn()}))
vi.mock('@/lib/db',()=>{const tx={accountToken:{findUnique:mocks.tokenFind,create:mocks.tokenCreate,updateMany:mocks.tokenUpdate},user:{findUnique:mocks.userFind,findFirst:mocks.userFirst,create:mocks.userCreate,update:mocks.userUpdate},session:{updateMany:mocks.sessionUpdate},apiKey:{updateMany:mocks.keyUpdate},auditLog:{create:mocks.audit},outboxJob:{create:mocks.jobCreate}};return {db:{$transaction:(fn:(tx:unknown)=>unknown)=>fn(tx)}}})
vi.mock('@/lib/usage-meter',()=>({assertSeatQuota:mocks.quota}))
vi.mock('bcryptjs',()=>({default:{hash:vi.fn().mockResolvedValue('hashed-password')}}))
import { issueAccountToken, inviteUser, requestRecovery, redeemAccountToken } from '@/lib/account-lifecycle'
import { decryptSecret } from '@/lib/account-security'
const user={id:'user1',tenantId:'tenant1',email:'user@example.com',active:true}
const raw='a'.repeat(64)
const credential={id:'token1',userId:'user1',tenantId:'tenant1',kind:'recovery',tokenHash:createHash('sha256').update(raw).digest('hex'),usedAt:null,expiresAt:new Date(Date.now()+60_000)}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('APP_ORIGIN','https://app.example.com');vi.stubEnv('RESEND_API_KEY','test');vi.stubEnv('ACCOUNT_EMAIL_FROM','account@example.com');vi.stubEnv('APP_ENCRYPTION_KEY',Buffer.alloc(32,1).toString('base64'));mocks.tokenUpdate.mockResolvedValue({count:1});mocks.userFirst.mockResolvedValue(user)})
afterEach(()=>vi.unstubAllEnvs())
describe('account invitation and recovery',()=>{
  it('stores only a token hash and encrypted email in the mutation transaction',async()=>{
    const tx={accountToken:{updateMany:mocks.tokenUpdate,create:mocks.tokenCreate},outboxJob:{create:mocks.jobCreate}}
    await issueAccountToken(tx as never,user,'invite')
    const stored=mocks.tokenCreate.mock.calls[0][0].data
    const envelope=JSON.parse(mocks.jobCreate.mock.calls[0][0].data.payloadJson)
    const email=JSON.parse(decryptSecret(envelope.encrypted))
    const token=/accountToken=([a-f0-9]{64})/.exec(email.text)![1]
    expect(stored.tokenHash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(JSON.stringify(stored)).not.toContain(token)
    expect(JSON.stringify(envelope)).not.toContain(token)
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now()+47*3600_000)
    expect(mocks.jobCreate.mock.calls[0][0].data).toMatchObject({tenantId:'tenant1',kind:'email.send'})
  })
  it('claims a valid credential once and revokes sessions, API keys and other account links',async()=>{
    mocks.tokenFind.mockResolvedValue({...credential})
    await redeemAccountToken(raw,'new-long-password')
    expect(mocks.userFirst).toHaveBeenCalledWith({where:{id:'user1',tenantId:'tenant1',active:true}})
    expect(mocks.tokenUpdate.mock.calls[0][0]).toMatchObject({where:{id:'token1',usedAt:null},data:{usedAt:expect.any(Date)}})
    expect(mocks.sessionUpdate).toHaveBeenCalledWith(expect.objectContaining({where:{userId:'user1',revokedAt:null}}))
    expect(mocks.keyUpdate).toHaveBeenCalledWith(expect.objectContaining({where:{userId:'user1',revokedAt:null}}))
    expect(mocks.userUpdate.mock.calls[0][0].data).toMatchObject({passwordHash:'hashed-password',failedLoginCount:0,lockedUntil:null})
    mocks.tokenFind.mockResolvedValue({...credential,usedAt:new Date()})
    await expect(redeemAccountToken(raw,'another-long-password')).rejects.toMatchObject({status:400})
    expect(mocks.userUpdate).toHaveBeenCalledTimes(1)
  })
  it.each([{expiresAt:new Date(0)},{usedAt:new Date()},{kind:'mfa_setup'}])('rejects expired, used and incorrect-kind credentials before writes: %o',async overrides=>{
    mocks.tokenFind.mockResolvedValue({...credential,...overrides})
    await expect(redeemAccountToken(raw,'new-long-password')).rejects.toMatchObject({status:400})
    expect(mocks.userUpdate).not.toHaveBeenCalled();expect(mocks.sessionUpdate).not.toHaveBeenCalled()
  })
  it('rejects a lost concurrent token claim and a mismatched/deactivated tenant user',async()=>{
    mocks.tokenFind.mockResolvedValue({...credential});mocks.tokenUpdate.mockResolvedValue({count:0})
    await expect(redeemAccountToken(raw,'new-long-password')).rejects.toMatchObject({status:409})
    expect(mocks.userUpdate).not.toHaveBeenCalled()
    mocks.userFirst.mockResolvedValue(null)
    await expect(redeemAccountToken(raw,'new-long-password')).rejects.toMatchObject({status:400})
  })
  it('does not issue recovery credentials for inactive or missing accounts',async()=>{
    mocks.userFind.mockResolvedValueOnce(null).mockResolvedValueOnce({...user,active:false})
    await requestRecovery('unknown@example.com');await requestRecovery(user.email)
    expect(mocks.tokenCreate).not.toHaveBeenCalled();expect(mocks.jobCreate).not.toHaveBeenCalled()
  })
  it('checks invitation seat limits before creating a tenant user',async()=>{
    mocks.quota.mockRejectedValue(new Response('Seat limit reached',{status:429}))
    await expect(inviteUser('tenant1',user.email,'User','viewer')).rejects.toMatchObject({status:429})
    expect(mocks.userCreate).not.toHaveBeenCalled()
  })
})
