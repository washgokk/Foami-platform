import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const isValidUrl = (url: string) => {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && url.length > 20
  } catch {
    return false
  }
}

// ─── Chainable local mock ────────────────────────────────────────
// Intercepts queries to read/write from localStorage if mock is enabled
interface Filter {
    col: string;
    op: string;
    val: any;
}

class CreateLocalMockQueryBuilder {
    private table: string;
    private isLocalMock: boolean | 'empty';
    private action: 'select' | 'insert' | 'update' | 'delete' | null = null;
    private payload: any = null;
    private filters: Filter[] = [];
    private selectStr: string = '*';
    private limitNum: number | null = null;
    private orderCol: string | null = null;
    private orderAsc: boolean = true;
    private isSingle: boolean = false;
    private insertData: any = null;
    private updateData: any = null;

    constructor(table: string, isLocalMock: boolean | 'empty') {
        this.table = table;
        this.isLocalMock = isLocalMock;
    }

    select(columns: string = '*') {
        if (!this.action) this.action = 'select';
        this.selectStr = columns;
        return this;
    }

    insert(data: any) {
        this.action = 'insert';
        this.payload = data;
        return this;
    }

    update(data: any) {
        this.action = 'update';
        this.payload = data;
        return this;
    }

    upsert(data: any) {
        this.action = 'insert'; // Upsert is treated as insert for mock
        this.payload = data;
        return this;
    }

    delete() {
        this.action = 'delete';
        return this;
    }

    eq(col: string, val: any) { this.filters.push({ col, op: 'eq', val }); return this; }
    neq(col: string, val: any) { this.filters.push({ col, op: 'neq', val }); return this; }
    not(col: string, op: string, val: any) { this.filters.push({ col, op: 'not', val: val }); return this; }
    is(col: string, val: any) { this.filters.push({ col, op: 'is', val }); return this; }
    in(col: string, vals: any[]) { this.filters.push({ col, op: 'in', val: vals }); return this; }
    gte(col: string, val: any) { this.filters.push({ col, op: 'gte', val }); return this; }
    lte(col: string, val: any) { this.filters.push({ col, op: 'lte', val }); return this; }
    gt(col: string, val: any) { this.filters.push({ col, op: 'gt', val }); return this; }
    lt(col: string, val: any) { this.filters.push({ col, op: 'lt', val }); return this; }

    order(col: string, opts?: { ascending?: boolean }) {
        this.orderCol = col;
        this.orderAsc = opts?.ascending !== false;
        return this;
    }

    limit(num: number) {
        this.limitNum = num;
        return this;
    }

    // Ignore unsupported advanced filters for mock
    like() { return this; }
    ilike() { return this; }
    or() { return this; }
    range() { return this; }
    filter() { return this; }
    match() { return this; }

    single() {
        this.isSingle = true;
        return this;
    }

    maybeSingle() {
        this.isSingle = true;
        return this;
    }

    execute(): Promise<{ data: any | null, error: any }> {
        let data: any[] = [];
        if (this.isLocalMock !== 'empty') {
            try {
                // Migration from old mock db if present
                if (this.table === 'services' && !localStorage.getItem('foami_mock_db_services')) {
                    const oldDb = JSON.parse(localStorage.getItem('foami_mock_db') || '{}')
                    if (oldDb.services) localStorage.setItem('foami_mock_db_services', JSON.stringify(oldDb.services))
                }
                if (this.table === 'zones' && !localStorage.getItem('foami_mock_db_zones')) {
                    const oldDb = JSON.parse(localStorage.getItem('foami_mock_db') || '{}')
                    if (oldDb.zones) localStorage.setItem('foami_mock_db_zones', JSON.stringify(oldDb.zones))
                }
                if (this.table === 'staff_payouts' && !localStorage.getItem('foami_mock_db_staff_payouts')) {
                    localStorage.setItem('foami_mock_db_staff_payouts', '[]')
                }

                data = JSON.parse(localStorage.getItem('foami_mock_db_' + this.table) || '[]');
                if (!Array.isArray(data)) data = [];
            } catch (e) { }
        }

        if (this.action === 'select') {
            let result = [...data];

            // AUTO-SEED: Give empty zones a default 4-point square polygon for testing
            if (this.table === 'zones') {
                let injected = false
                result.forEach(z => {
                    if (!z.polygon_coords || z.polygon_coords.length < 3) {
                        z.polygon_coords = [
                            [16.4500, 102.8200],
                            [16.4500, 102.8450],
                            [16.4350, 102.8450],
                            [16.4350, 102.8200]
                        ]
                        injected = true
                    }
                })
                if (injected) localStorage.setItem('foami_mock_db_zones', JSON.stringify(result))
            }

            if (this.filters.length > 0) {
                result = result.filter(row => {
                    return this.filters.every(f => {
                        const val = row[f.col];
                        switch (f.op) {
                            case 'eq': return val === f.val;
                            case 'neq': return val !== f.val;
                            case 'is':
                                if (f.val === null) return val === null || val === undefined;
                                return val === f.val;
                            case 'in':
                                if (!Array.isArray(f.val)) return false;
                                return f.val.includes(val);
                            case 'not':
                                // Handle specific status in filter like .not('status', 'in', '(completed,cancelled)')
                                if (typeof f.val === 'string' && (f.val.startsWith('(coord,') || f.val.startsWith('('))) {
                                    const vals = f.val.slice(1, -1).split(',').map((s: string) => s.trim());
                                    return !vals.includes(val);
                                }
                                return val !== f.val;
                            case 'gte': return val >= f.val;
                            case 'lte': return val <= f.val;
                            case 'gt': return val > f.val;
                            case 'lt': return val < f.val;
                            default: return val === f.val;
                        }
                    });
                });
            }

            if (this.orderCol) {
                result.sort((a, b) => {
                    const valA = a[this.orderCol!], valB = b[this.orderCol!];
                    if (valA < valB) return this.orderAsc ? -1 : 1;
                    if (valA > valB) return this.orderAsc ? 1 : -1;
                    return 0;
                });
            }

            if (this.limitNum !== null) {
                result = result.slice(0, this.limitNum);
            }

            if (this.isSingle) {
                return Promise.resolve({ data: result[0] || null, error: null });
            }
            return Promise.resolve({ data: result, error: null });
        }
        if (this.action === 'insert') {
            const newRows = Array.isArray(this.payload) ? this.payload : [this.payload];
            const toAdd = newRows.map(r => ({ id: r.id || Date.now().toString() + Math.random(), ...r, created_at: new Date().toISOString() }));
            data.push(...toAdd);
            localStorage.setItem('foami_mock_db_' + this.table, JSON.stringify(data));
            // Real supabase returns an array for .select()/.insert() unless .maybeSingle is used
            const result = this.isSingle ? toAdd[0] || null : toAdd;
            return Promise.resolve({ data: result, error: null });
        }
        if (this.action === 'update') {
            let updatedRows: any[] = [];
            data = data.map(r => {
                let match = true;
                for (const f of this.filters) {
                    // For update, only 'eq' filter is typically used for matching
                    if (f.op === 'eq' && r[f.col] !== f.val) match = false;
                    // Other filter types are ignored for matching update target for simplicity
                }
                if (match) {
                    const updated = { ...r, ...this.payload };
                    updatedRows.push(updated);
                    return updated;
                }
                return r;
            });
            localStorage.setItem('foami_mock_db_' + this.table, JSON.stringify(data));
            const result = this.isSingle ? updatedRows[0] || null : updatedRows;
            return Promise.resolve({ data: result, error: null });
        }
        if (this.action === 'delete') {
            data = data.filter(r => {
                let match = true;
                for (const f of this.filters) {
                    // For delete, only 'eq' filter is typically used for matching
                    if (f.op === 'eq' && r[f.col] !== f.val) match = false;
                    // Other filter types are ignored for matching delete target for simplicity
                }
                return !match;
            });
            localStorage.setItem('foami_mock_db_' + this.table, JSON.stringify(data));
            return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: data, error: null });
    }

    then(resolve: any, reject: any) {
        return this.execute().then(resolve).catch(reject);
    }

    catch(reject: any) {
        return this.execute().catch(reject);
    }
}

// Storage mock
function createMockStorage() {
  const BUCKET_URL = 'https://placeholder.storage/placeholder-bucket'
  return {
    from: (_bucket: string) => ({
      upload: () => Promise.resolve({ data: { path: 'mock/path.jpg' }, error: null }),
      getPublicUrl: (_path: string) => ({ data: { publicUrl: `${BUCKET_URL}/mock.jpg` } }),
      list: () => Promise.resolve({ data: [], error: null }),
      remove: () => Promise.resolve({ data: [], error: null }),
    }),
  }
}

// Auth admin mock
function createMockAuthAdmin() {
  return {
    createUser: () => Promise.resolve({ data: { user: { id: 'mock-id' } }, error: null }),
    deleteUser: () => Promise.resolve({ data: null, error: null }),
    listUsers: () => Promise.resolve({ data: { users: [] }, error: null }),
  }
}

function createMockSupabaseClient(isLocalMock: boolean | 'empty' = false): SupabaseClient {
  const mockClient: any = {
    // If local mock is enabled, use the localStorage interceptor. If 'empty', pass it down so it never reads localStorage.
    from: (table: string) => new CreateLocalMockQueryBuilder(table, isLocalMock),
    rpc: () => Promise.resolve({ data: null, error: null }),
    storage: createMockStorage(),
    auth: {
                signInWithPassword: async ({ email }: { email: string }) => {
                    if (email) {
                        const staffs = JSON.parse(localStorage.getItem('foami_mock_db_staff') || '[]')
                        const staff = staffs.find((s: any) => s.email === email)
                        if (staff) {
                            return { data: { user: staff, session: { access_token: 'mock_token' } }, error: null }
                        }
                    }
                    return { data: { user: null, session: null }, error: { message: 'Invalid credentials' } }
                },
      signOut: () => Promise.resolve({ error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      admin: createMockAuthAdmin(),
    },
    channel: () => ({
      on: () => ({ subscribe: () => { } }),
    }),
    removeChannel: () => { },
  }
  return mockClient as SupabaseClient
}

// ─── Actual exports ────────────────────────────────────────────

let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const isMockDbEnabled = typeof window !== 'undefined' && localStorage.getItem('foami_mock_db_enabled') === 'true'

    if (isMockDbEnabled) {
      _supabase = createMockSupabaseClient(true)
    } else {
      // If Mock DB is OFF, use the real URL. If the real URL is missing/invalid, 
      // return a dummy client that returns empty data, instead of reading localStorage.
      _supabase = isValidUrl(SUPABASE_URL)
        ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : createMockSupabaseClient('empty')
    }
  }
  return _supabase
}

// SupabaseClient Proxy that lazily initializes
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop]
  },
})

export function createServiceClient(): SupabaseClient {
  if (!isValidUrl(SUPABASE_URL)) return createMockSupabaseClient(false)
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}
