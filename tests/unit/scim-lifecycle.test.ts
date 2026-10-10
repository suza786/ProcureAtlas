import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({config:vi.fn(),user:vi.fn(),update:vi.fn(),sessions:vi.fn(),keys:vi.fn(),tokens:vi.fn(),audit:vi.fn(),quota:vi.fn(),meter:vi.fn()}))
vi.mock('@/lib/db',()=>{const tx={user:{findFirst:mocks.user,update:mocks.update},session:{updateMany:mocks.sessions},apiKey:{updateMany:mocks.keys},accountToken:{updateMany:mocks.tokens},auditLog:{create:mocks.audit}};return{db:{...tx,scimConfig:{findUnique:mocks.config},$transaction:(fn:(tx:unknown)=>unknown)=>fn(tx)}}})
vi.mock('@/lib/usage-meter',()=>({meterApiRequest:mocks.meter,assertSeatQuota:mocks.quota}))
import { GET, DELETE, PATCH, PUT } from '@/app/api/scim/Users/[id]/route'
const current={id:'user1',tenantId:'tenant1',email:'user@example.com',name:'User',active:true,role:'contributor'}
const context={params:Promise.resolve({id:'user1'})}
function request(method:string,body?:unknown,tenant='tenant1',bearer='scim-secret') {return new Request(`http://localhost/api/scim/Users/user1?tenantId=${tenant}`,{method,headers:{authorization:`Bearer ${bearer}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})}
beforeEach(()=>{vi.clearAllMocks();mocks.config.mockImplementation(async({where})=>({isActive:true,userProvisioningEnabled:true,bearerToken:where.tenantId==='tenant1'?'scim-secret':'other-secret'}));mocks.user.mockImplementation(async({where})=>where.tenantId===current.tenantId?current:null);mocks.update.mockImplementation(async({data})=>({...current,...data}))})
describe('SCIM tenant and credential lifecycle',()=>{
  it('rejects a tenant bearer used against another tenant',async()=>{
    expect((await GET(request('GET',undefined,'tenant2'),context)).status).toBe(401)
    expect(mocks.user).not.toHaveBeenCalled()
  })
  it('does not expose users belonging to another tenant',async()=>{
    expect((await GET(request('GET',undefined,'tenant2','other-secret'),context)).status).toBe(404)
    expect(mocks.user).toHaveBeenCalledWith({where:{id:'user1',tenantId:'tenant2'}})
  })
  it('deactivates a user and revokes sessions, keys and account links together',async()=>{
    expect((await DELETE(request('DELETE'),context)).status).toBe(204)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({where:{id:'user1'},data:expect.objectContaining({active:false})}))
    expect(mocks.sessions).toHaveBeenCalledWith(expect.objectContaining({where:{userId:'user1',revokedAt:null}}))
    expect(mocks.keys).toHaveBeenCalledWith(expect.objectContaining({where:{userId:'user1',revokedAt:null}}))
    expect(mocks.tokens).toHaveBeenCalledWith(expect.objectContaining({where:{userId:'user1',usedAt:null}}))
    expect(mocks.audit.mock.calls[0][0].data).toMatchObject({tenantId:'tenant1',actorType:'scim'})
  })
  it('protects owner accounts from bearer-driven changes or deactivation',async()=>{
    mocks.user.mockResolvedValue({...current,role:'owner'})
    expect((await DELETE(request('DELETE'),context)).status).toBe(403)
    expect((await PATCH(request('PATCH',{Operations:[{op:'replace',path:'displayName',value:'Changed'}]}),context)).status).toBe(403)
    expect(mocks.update).not.toHaveBeenCalled();expect(mocks.sessions).not.toHaveBeenCalled()
  })
  it('revokes credentials on email replacement, rejects tenantId injection',async()=>{
    expect((await PATCH(request('PATCH',{Operations:[{op:'replace',path:'userName',value:'new@example.com'}]}),context)).status).toBe(200)
    expect(mocks.keys).toHaveBeenCalledTimes(1)
    expect((await PUT(request('PUT',{tenantId:'tenant2',active:false}),context)).status).toBe(400)
    expect(mocks.update).toHaveBeenCalledTimes(1)
  })
  it('checks seat capacity before reactivating an account',async()=>{
    mocks.user.mockResolvedValue({...current,active:false});mocks.quota.mockRejectedValue(new Response('Seat limit',{status:429}))
    expect((await PUT(request('PUT',{active:true}),context)).status).toBe(429)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
