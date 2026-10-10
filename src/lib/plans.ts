const define = (id: string, name: string, priceUSD: number, priceBDT: number, seats: number, tenders: number, pursuits: number, calls: number, tokens: number, hourly: number, burst: number) => ({
  id, name, priceUSD, priceBDT, seats, tenders, pursuits, apiCalls: calls, llmTokens: tokens,
  limits: { seatsIncluded: seats, tendersTrackedLimit: tenders, pursuitsLimit: pursuits, apiCallsLimit: calls, llmTokensLimit: tokens },
  rate: { requestsPerHour: hourly, burst },
})
export const PLANS = {
  free: define('free','Free',0,0,1,10,1,100,5000,100,20),
  solo: define('solo','Solo',49,2990,1,50,5,1000,50000,1000,50),
  professional: define('professional','Professional',149,9900,3,200,20,5000,200000,5000,100),
  bid_team: define('bid_team','Bid Team',399,29900,10,1000,100,25000,1000000,25000,200),
  intelligence: define('intelligence','Intelligence',-1,-1,1,100,10,5000,200000,1000,50),
  pursuit_pro: define('pursuit_pro','Pursuit Pro',-1,-1,3,200,20,10000,300000,5000,100),
  team: define('team','Team',-1,-1,10,500,50,25000,1000000,25000,200),
  enterprise: define('enterprise','Enterprise',-1,-1,50,10000,1000,100000,5000000,100000,500),
} as const
export type PlanId = keyof typeof PLANS
export const getPlan = (id: string) => Object.hasOwn(PLANS, id) ? PLANS[id as PlanId] : PLANS.free
