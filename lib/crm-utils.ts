export interface RFMData {
    daysSinceLast: number;
    totalVisits: number;
    totalSpent: number;
}

export interface CRMConfig {
    recency: { r5: number; r4: number; r3: number; r2: number };
    frequency: { f5: number; f4: number; f3: number; f2: number };
    monetary: { m5: number; m4: number; m3: number; m2: number };
    segments: {
        vip: { f: number; m: number; r: number };
        loyal: { f: number; r: number };
        churnRisk: { f: number; r: number };
        lost: { f: number; r: number };
        new: { r: number; f: number };
        bigSpender: { m: number; f: number };
        promising: number;
        inactive: number;
    };
}

export const DEFAULT_CRM_CONFIG: CRMConfig = {
    recency: { r5: 7, r4: 15, r3: 30, r2: 60 },
    frequency: { f5: 10, f4: 5, f3: 3, f2: 2 },
    monetary: { m5: 5000, m4: 2500, m3: 1000, m2: 500 },
    segments: {
        vip: { f: 4, m: 4, r: 3 },
        loyal: { f: 3, r: 3 },
        churnRisk: { f: 2, r: 2 },
        lost: { f: 3, r: 1 },
        new: { r: 4, f: 2 },
        bigSpender: { m: 4, f: 2 },
        promising: 3.5,
        inactive: 1.5
    }
}

export function getRFMScore(daysSinceLast: number, totalVisits: number, totalSpent: number, config: CRMConfig = DEFAULT_CRM_CONFIG) {
    const { recency: r, frequency: f, monetary: m } = config;
    
    let scoreR = 1;
    if (daysSinceLast <= r.r5) scoreR = 5;
    else if (daysSinceLast <= r.r4) scoreR = 4;
    else if (daysSinceLast <= r.r3) scoreR = 3;
    else if (daysSinceLast <= r.r2) scoreR = 2;

    let scoreF = 1;
    if (totalVisits >= f.f5) scoreF = 5;
    else if (totalVisits >= f.f4) scoreF = 4;
    else if (totalVisits >= f.f3) scoreF = 3;
    else if (totalVisits >= f.f2) scoreF = 2;

    let scoreM = 1;
    if (totalSpent >= m.m5) scoreM = 5;
    else if (totalSpent >= m.m4) scoreM = 4;
    else if (totalSpent >= m.m3) scoreM = 3;
    else if (totalSpent >= m.m2) scoreM = 2;

    return { R: scoreR, F: scoreF, M: scoreM };
}

export function segmentCustomer(rfm: { R: number, F: number, M: number }, config: CRMConfig = DEFAULT_CRM_CONFIG) {
    const { R, F, M } = rfm;
    const { segments: s } = config;
    const avgScore = (R + F + M) / 3;

    if (F >= s.vip.f && M >= s.vip.m && R >= s.vip.r) return 'VIP';
    if (F >= s.loyal.f && R >= s.loyal.r) return 'Loyal';
    if (F >= s.churnRisk.f && R <= s.churnRisk.r) return 'Churn Risk';
    if (F >= s.lost.f && R === s.lost.r) return 'Lost Customer';
    if (R >= s.new.r && F <= s.new.f) return 'New';
    if (M >= s.bigSpender.m && F <= s.bigSpender.f) return 'Big Ticket (Rare)';
    if (avgScore >= s.promising) return 'Promising';
    if (avgScore <= s.inactive) return 'Inactive';

    return 'Regular';
}
