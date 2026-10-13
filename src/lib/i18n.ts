// ProcureAtlas AI — Phase 6 i18n Translation Strings
// Phase 6 implements a lightweight i18n system (Zustand-based) with Bangla + English.
// next-intl is available for production; this approach keeps the sandbox simple.

export type Locale = 'en' | 'bn'
import { viewTranslations } from './view-translations'

export const translations: Record<Locale, Record<string, string>> = {
  en: {
    'appearance.title': 'Appearance',
    'appearance.theme': 'Theme',
    'appearance.help': 'Saved on this browser. System follows your device’s appearance.',
    'appearance.light': 'Light',
    'appearance.dark': 'Dark',
    'appearance.system': 'System',
    // Sidebar
    'nav.workspace': 'Workspace',
    'nav.intelligence': 'Intelligence',
    'nav.system': 'System',
    'nav.command': 'Command Center',
    'nav.discover': 'Discover',
    'nav.company': 'Company Brain',
    'nav.pursuits': 'Pursuits',
    'nav.compliance': 'Compliance Matrix',
    'nav.proposals': 'Proposal Studio',
    'nav.approvals': 'Approvals',
    'nav.extractions': 'LLM Review Queue',
    'nav.connectors': 'Connectors',
    'nav.audit': 'Audit Log',
    'nav.buyerIntel': 'Buyer Intelligence',
    'nav.awardIntel': 'Award Intelligence',
    'nav.competitorIntel': 'Competitor Intelligence',
    'nav.partnerFinder': 'Partner / JV Finder',
    'nav.developer': 'Developer Portal',
    'nav.webhooks': 'Webhooks',
    'nav.notifications': 'Notifications',
    'nav.financials': 'Financial Modeling',
    'nav.admin': 'Admin Console',
    'nav.billing': 'Billing & Usage',
    'nav.settings': 'Settings & API Keys',
    'nav.analytics': 'Analytics',
    'nav.markets': 'Markets',

    // Command Center
    'cc.title': 'Command Center',
    'cc.activeTenders': 'Active Tenders',
    'cc.activePursuits': 'Active Pursuits',
    'cc.pipelineValue': 'Pipeline Value',
    'cc.winRate': 'Win Rate',
    'cc.criticalAlerts': 'Critical Alerts',
    'cc.deadlines7d': 'Deadlines (7d)',
    'cc.recentAwards': 'Recent Awards',
    'cc.deadlineTimeline': 'Deadlines — Next 7 Days',
    'cc.activeAlerts': 'Active Alerts',
    'cc.pipelineDist': 'Pipeline Distribution',
    'cc.pipelineByMarket': 'Pipeline Value by Market (USD K)',
    'cc.recentPursuits': 'Recent Pursuits',
    'cc.acrossMarkets': 'Across markets',

    // Common
    'common.viewAll': 'View all',
    'common.loading': 'Loading...',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.clear': 'Clear',
    'common.export': 'Export',
    'common.cancel': 'Cancel',
    'common.create': 'Create',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.back': 'Back',
    'common.days': 'days',
    'common.estimated': 'Estimated',

    // Markets
    'markets.title': 'Expansion Markets',
    'markets.desc': 'Global procurement market catalog with connector status, legal compliance, and data residency.',
    'markets.connectorStatus': 'Connector',
    'markets.legalStatus': 'Legal',
    'markets.dataResidency': 'Data Residency',
    'markets.language': 'Language',
    'markets.currency': 'Currency',

    // Analytics
    'analytics.title': 'Advanced Analytics',
    'analytics.desc': 'Tenant-level analytics dashboard with win-rate trends, pipeline velocity, and LLM usage.',
    'analytics.winRateTrend': 'Win Rate Trend (6 months)',
    'analytics.pipelineValue': 'Pipeline Value Trend',
    'analytics.llmUsage': 'LLM Usage Trend',
    'analytics.evidenceCoverage': 'Evidence Coverage Trend',
    'analytics.bidCycleTime': 'Avg Bid Cycle Time (days)',
    'analytics.monthly': 'Monthly Snapshot',
  },

  bn: {
    'appearance.title': 'চেহারা',
    'appearance.theme': 'থিম',
    'appearance.help': 'এই ব্রাউজারে সংরক্ষিত হয়। সিস্টেম আপনার ডিভাইসের থিম অনুসরণ করে।',
    'appearance.light': 'হালকা',
    'appearance.dark': 'গাঢ়',
    'appearance.system': 'সিস্টেম',
    // Sidebar
    'nav.workspace': 'ওয়ার্কস্পেস',
    'nav.intelligence': 'ইন্টেলিজেন্স',
    'nav.system': 'সিস্টেম',
    'nav.command': 'কমান্ড সেন্টার',
    'nav.discover': 'আবিষ্কার',
    'nav.company': 'কোম্পানি ব্রেইন',
    'nav.pursuits': 'পারস্যুট',
    'nav.compliance': 'কমপ্লায়েন্স ম্যাট্রিক্স',
    'nav.proposals': 'প্রপোজাল স্টুডিও',
    'nav.approvals': 'অনুমোদন',
    'nav.extractions': 'এলএলএম রিভিউ কিউ',
    'nav.connectors': 'কানেক্টর',
    'nav.audit': 'অডিট লগ',
    'nav.buyerIntel': 'বায়ার ইন্টেলিজেন্স',
    'nav.awardIntel': 'অ্যাওয়ার্ড ইন্টেলিজেন্স',
    'nav.competitorIntel': 'প্রতিযোগী ইন্টেলিজেন্স',
    'nav.partnerFinder': 'পার্টনার / জেভি ফাইন্ডার',
    'nav.developer': 'ডেভেলপার পোর্টাল',
    'nav.webhooks': 'ওয়েবহুক',
    'nav.notifications': 'নোটিফিকেশন',
    'nav.financials': 'আর্থিক মডেলিং',
    'nav.admin': 'অ্যাডমিন কনসোল',
    'nav.billing': 'বিলিং ও ব্যবহার',
    'nav.settings': 'সেটিংস ও এপিআই কী',
    'nav.analytics': 'অ্যানালিটিক্স',
    'nav.markets': 'বাজারসমূহ',

    // Command Center
    'cc.title': 'কমান্ড সেন্টার',
    'cc.activeTenders': 'সক্রিয় টেন্ডার',
    'cc.activePursuits': 'সক্রিয় পারস্যুট',
    'cc.pipelineValue': 'পাইপলাইন মূল্য',
    'cc.winRate': 'বিজয় হার',
    'cc.criticalAlerts': 'জরুরি সতর্কতা',
    'cc.deadlines7d': 'সময়সীমা (৭দিন)',
    'cc.recentAwards': 'সাম্প্রতিক পুরস্কার',
    'cc.deadlineTimeline': 'সময়সীমা — আগামী ৭ দিন',
    'cc.activeAlerts': 'সক্রিয় সতর্কতা',
    'cc.pipelineDist': 'পাইপলাইন বিতরণ',
    'cc.pipelineByMarket': 'বাজার অনুযায়ী পাইপলাইন মূল্য (হাজার ডলার)',
    'cc.recentPursuits': 'সাম্প্রতিক পারস্যুট',
    'cc.acrossMarkets': 'বাজার জুড়ে',

    // Common
    'common.viewAll': 'সব দেখুন',
    'common.loading': 'লোড হচ্ছে...',
    'common.search': 'অনুসন্ধান',
    'common.filter': 'ফিল্টার',
    'common.clear': 'মুছুন',
    'common.export': 'রপ্তানি',
    'common.cancel': 'বাতিল',
    'common.create': 'তৈরি করুন',
    'common.save': 'সংরক্ষণ',
    'common.delete': 'মুছে ফেলুন',
    'common.back': 'পেছনে',
    'common.days': 'দিন',
    'common.estimated': 'আনুমানিক',

    // Markets
    'markets.title': 'সম্প্রসারণ বাজার',
    'markets.desc': 'গ্লোবাল প্রকিউরমেন্ট মার্কেট ক্যাটালগ — কানেক্টর স্ট্যাটাস, আইনি সম্মতি, এবং ডেটা রেসিডেন্সি সহ।',
    'markets.connectorStatus': 'কানেক্টর',
    'markets.legalStatus': 'আইনি',
    'markets.dataResidency': 'ডেটা রেসিডেন্সি',
    'markets.language': 'ভাষা',
    'markets.currency': 'মুদ্রা',

    // Analytics
    'analytics.title': 'উন্নত অ্যানালিটিক্স',
    'analytics.desc': 'টেন্যান্ট-লেভেল অ্যানালিটিক্স ড্যাশবোর্ড — বিজয় হার প্রবণতা, পাইপলাইন বেগ, এবং এলএলএম ব্যবহার সহ।',
    'analytics.winRateTrend': 'বিজয় হার প্রবণতা (৬ মাস)',
    'analytics.pipelineValue': 'পাইপলাইন মূল্য প্রবণতা',
    'analytics.llmUsage': 'এলএলএম ব্যবহার প্রবণতা',
    'analytics.evidenceCoverage': 'প্রমাণ কভারেজ প্রবণতা',
    'analytics.bidCycleTime': 'গড় বিড চক্র সময় (দিন)',
    'analytics.monthly': 'মাসিক স্ন্যাপশট',
  },
}

export function t(locale: Locale, key: string): string {
  const resolved = Object.hasOwn(translations.en, key) ? key : phraseKeys.get(key) ?? key
  return translations[locale]?.[resolved] ?? translations.en[resolved] ?? key
}

const releaseCopy: Record<string, [string, string]> = {
  'shell.demoMode': ['Demo mode', 'ডেমো মোড'], 'shell.notSignedIn': ['Not signed in', 'সাইন ইন করা নেই'],
  'shell.openMenu': ['Open module menu', 'মডিউল মেনু খুলুন'], 'shell.modules': ['Modules', 'মডিউল'],
  'shell.chooseModule': ['Choose a module', 'একটি মডিউল বেছে নিন'], 'shell.breadcrumb': ['Current location', 'বর্তমান অবস্থান'],
  'shell.switchLanguage': ['Switch language', 'ভাষা পরিবর্তন করুন'], 'shell.bidRoom': ['Bid Room', 'বিড রুম'],
  'shell.tender': ['Tender details', 'দরপত্রের বিবরণ'], 'shell.signIn': ['Sign in', 'সাইন ইন'],
  'shell.loadingModule': ['Loading module…', 'মডিউল লোড হচ্ছে…'], 'shell.skipContent': ['Skip to main content', 'মূল বিষয়বস্তুতে যান'],
  'search.placeholder': ['Search tenders, buyers, suppliers and your workspace', 'দরপত্র, ক্রেতা, সরবরাহকারী ও আপনার কর্মক্ষেত্রে খুঁজুন'],
  'search.minLength': ['Enter at least two characters', 'অন্তত দুটি অক্ষর লিখুন'], 'search.error': ['Search failed. Try again.', 'অনুসন্ধান ব্যর্থ হয়েছে। আবার চেষ্টা করুন।'],
  'search.results': ['Search results', 'অনুসন্ধানের ফলাফল'], 'search.empty': ['No results found', 'কোনো ফলাফল পাওয়া যায়নি'], 'search.retry': ['Retry search', 'আবার অনুসন্ধান করুন'],
  'search.type.tender': ['Tender', 'দরপত্র'], 'search.type.buyer': ['Buyer', 'ক্রেতা'], 'search.type.supplier': ['Supplier', 'সরবরাহকারী'],
  'search.type.award': ['Award', 'চুক্তি প্রদান'], 'search.type.company': ['Company', 'কোম্পানি'], 'search.type.pursuit': ['Pursuit', 'বিড উদ্যোগ'],
  'analytics.loadFailed': ['Could not load analytics.', 'বিশ্লেষণ লোড করা যায়নি।'],
  'analytics.observedDescription': ['Real daily observations from your tenant. Historical data appears as snapshots are collected.', 'আপনার প্রতিষ্ঠানের প্রকৃত দৈনিক পর্যবেক্ষণ। স্ন্যাপশট সংগ্রহের সঙ্গে ঐতিহাসিক তথ্য যুক্ত হবে।'],
  'analytics.dailyUtc': ['Daily observations (UTC)', 'দৈনিক পর্যবেক্ষণ (UTC)'], 'analytics.latestWindow': ['Latest reporting window', 'সর্বশেষ প্রতিবেদনের সময়সীমা'],
  'analytics.providerWindow': ['Provider usage in the last 30 days', 'গত ৩০ দিনে সেবাদাতার ব্যবহার'], 'analytics.wonValue': ['Won value', 'জয়ী চুক্তির মূল্য'],
  'analytics.calls30d': ['Provider calls (30d)', 'সেবাদাতাকে অনুরোধ (৩০ দিন)'], 'analytics.cost30d': ['Provider cost (30d)', 'সেবাদাতার খরচ (৩০ দিন)'],
  'analytics.unknown': ['Unknown', 'অজানা'], 'analytics.pendingProviderCalls': ['Unsettled provider calls', 'অসম্পন্ন হিসাবের অনুরোধ'],
  'analytics.emptyHistory': ['No observed history yet. Start the worker to collect daily snapshots.', 'এখনো পর্যবেক্ষণের ইতিহাস নেই। দৈনিক স্ন্যাপশট সংগ্রহ করতে ওয়ার্কার চালু করুন।'],
  'analytics.pipelineUsdK': ['Pipeline (USD thousands)', 'পাইপলাইন (হাজার মার্কিন ডলার)'], 'analytics.wonUsdK': ['Won (USD thousands)', 'জয়ী (হাজার মার্কিন ডলার)'],
  'analytics.providerCalls': ['Provider calls', 'সেবাদাতাকে অনুরোধ'], 'analytics.verifiedCoverage': ['Verified evidence coverage', 'যাচাইকৃত প্রমাণের পরিধি'],
  'analytics.cycleDays': ['Bid cycle days', 'বিড চক্রের দিন'], 'analytics.proposalWords': ['Proposal words', 'প্রস্তাবের শব্দ'], 'analytics.wordCount': ['Word count', 'শব্দসংখ্যা'],
  'analytics.dailySnapshots': ['Observed daily snapshots', 'পর্যবেক্ষিত দৈনিক স্ন্যাপশট'], 'analytics.dateUtc': ['Observation date (UTC)', 'পর্যবেক্ষণের তারিখ (UTC)'],
  'analytics.observedAtUtc': ['Observed at (UTC)', 'পর্যবেক্ষণের সময় (UTC)'], 'analytics.active': ['Active', 'সক্রিয়'], 'analytics.bidding': ['Bidding', 'বিড প্রস্তুতি'],
  'analytics.won': ['Won', 'জয়ী'], 'analytics.lost': ['Lost', 'হারা'], 'analytics.tokens': ['Tokens', 'টোকেন'], 'analytics.cost': ['Cost', 'খরচ'],
}
for (const [key, [en, bn]] of Object.entries(releaseCopy)) { translations.en[key] = en; translations.bn[key] = bn }
translations.en['analytics.winRateTrend'] = 'Win rate trend'
translations.bn['analytics.winRateTrend'] = 'জয়ের হারের প্রবণতা'
for (const [en, bn] of Object.entries(viewTranslations)) { translations.en[en] = en; translations.bn[en] = bn }
translations.en['shell.timeZone'] = 'Display time zone'
translations.bn['shell.timeZone'] = 'প্রদর্শনের সময় অঞ্চল'
const phraseKeys = new Map(Object.entries(translations.en).map(([key, value]) => [value, key]))
