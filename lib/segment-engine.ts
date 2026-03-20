// Shared Segment Evaluation Engine
// Used by both CRM and Promotions modules to calculate audience matches dynamically.

export function evaluateSegmentMatch(customer: any, conditions: any[]) {
    if (!conditions || conditions.length === 0) return true;

    return conditions.every(cond => {
        const val = cond.value;
        const target = customer[cond.metric];
        
        // Boolean Handle
        if (['is_profile_complete', 'hasDiscountUsage'].includes(cond.metric)) {
            const targetBool = !!target;
            const valBool = val === 'true';
            return cond.operator === '===' ? targetBool === valBool : targetBool !== valBool;
        }

        if (target === undefined || target === null) {
            // For numeric/date nulls, fail unless specifically checking for != empty
            if (cond.operator === '!=' && val === '') return true;
            return false;
        }

        // Handle Array match (Interests / Addons / ServicesUsed)
        if (['interests', 'addons', 'servicesUsed'].includes(cond.metric) && Array.isArray(target)) {
            const isIncluded = target.some(a => String(a).toLowerCase() === String(val).toLowerCase());
            return cond.operator === '===' ? isIncluded : !isIncluded;
        }

        // Handle categorical string comparisons
        if (['gender', 'vehicle_brand', 'vehicle_size', 'segment', 'occupation', 'lastBranchId'].includes(cond.metric)) {
            const isMatch = String(target).toLowerCase() === String(val).toLowerCase();
            return cond.operator === '===' ? isMatch : !isMatch;
        }

        // Handle numeric comparisons
        const numVal = Number(val);
        const numTarget = Number(target);
        if (cond.operator === '>=') return numTarget >= numVal;
        if (cond.operator === '<=') return numTarget <= numVal;
        if (cond.operator === '===') return numTarget === numVal;
        if (cond.operator === '!=') return numTarget !== numVal;
        return false;
    });
}
