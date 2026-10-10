import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({find:vi.fn(),update:vi.fn(),session:vi.fn(),audit:vi.fn(),compare:vi.fn(),cookie:vi.fn(),step:vi.fn(),throttle:vi.fn(),meter:vi.fn()}))
vi.mock('@/lib/db',()=>{const tx={user:{findUnique:mocks.find,update:mocks.update},session:{create:mocks.session},auditLog:{create:mocks.audit}};return{db:{...tx,$transaction:(fn:(tx:unknown)=>unknown)=>fn(tx)}}})
vi.mock('bcryptjs',()=>({default:{compare:mocks.compare}}))
vi.mock('next/headers',()=>({cookies:vi.fn().mockImplementation(async()=>({set:mocks.cookie}))}))
vi.mock('@/lib/rate-limit',()=>({checkRateLimit:mocks.throttle}))
vi.mock('@/lib/usage-meter',()=>({meterApiRequest:mocks.meter}))
vi.mock('@/lib/account-security',()=>({decryptSecret:()=> 'secret',verifiedTotpStep:mocks.step}))
import { signIn } from '@/lib/auth'
const user={id:'user1',tenantId:'tenant1',email:'user@example.com',passwordHash:'hash',active:true,mfaEnabled:true,mfaSecret:'encrypted',mfaLastStep:9,failedLoginCount:0,lockedUntil:null}
beforeEach(()=>{vi.clearAllMocks();mocks.find.mockResolvedValue(user);mocks.compare.mockResolvedValue(true);mocks.throttle.mockResolvedValue({allowed:true});mocks.update.mockResolvedValue({...user,failedLoginCount:1})})
describe('MFA sign-in enforcement',()=>{
  it('returns a challenge without creating a session or cookie after only a valid password',async()=>{
    expect(await signIn(user.email,'correct-password')).toEqual({success:false,mfaRequired:true})
    expect(mocks.session).not.toHaveBeenCalled();expect(mocks.cookie).not.toHaveBeenCalled();expect(mocks.update).not.toHaveBeenCalled()
  })
  it('rejects invalid and replayed authenticator steps without issuing session credentials',async()=>{
    mocks.step.mockReturnValueOnce(null).mockReturnValueOnce(9)
    expect((await signIn(user.email,'correct-password',undefined,'111111')).success).toBe(false)
    expect((await signIn(user.email,'correct-password',undefined,'111111')).success).toBe(false)
    expect(mocks.session).not.toHaveBeenCalled();expect(mocks.cookie).not.toHaveBeenCalled()
  })
  it('rechecks the authenticator step inside the transaction to prevent concurrent reuse',async()=>{
    mocks.step.mockReturnValue(10)
    mocks.find.mockResolvedValueOnce(user).mockResolvedValueOnce({...user,mfaLastStep:10})
    await expect(signIn(user.email,'correct-password',undefined,'111111')).rejects.toMatchObject({status:401})
    expect(mocks.session).not.toHaveBeenCalled();expect(mocks.cookie).not.toHaveBeenCalled()
  })
  it('records a fresh verified step and creates an MFA-verified session',async()=>{
    mocks.step.mockReturnValue(10)
    expect(await signIn(user.email,'correct-password',undefined,'111111')).toEqual({success:true})
    expect(mocks.update.mock.calls[0][0].data.mfaLastStep).toBe(10)
    expect(mocks.session.mock.calls[0][0].data.mfaVerifiedAt).toBeInstanceOf(Date)
    expect(mocks.cookie).toHaveBeenCalledTimes(1)
  })
})
