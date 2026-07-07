# Foami Platform 2.0 — Technical Blueprint

> **Decisions confirmed:**
> - Platform Fee: **20%** (configurable via `app_settings`)
> - Auth: Email + Password (shop owners & platform admin)
> - Payment: Stripe Connect (Destination Charges) — funds held in Platform wallet, shops request withdrawal
> - Domain: ใช้ `foami-wash-and-delivery.vercel.app` ไปก่อน + Custom domain ทีหลัง

---

## 1. Tech Stack

```mermaid
graph TB
    subgraph "🌐 Client Layer"
        A1["🗺️ Marketplace\nfoami.app/\n(Next.js App Router)"]
        A2["🏪 Foami Store\nfoami.app/store/\n(LINE LIFF + Web)"]
        A3["🏬 Partner Shop\nshop.foami.app/[shopId]\n(Web PWA)"]
        A4["👑 Platform Admin\nadmin.foami.app\n(Internal Dashboard)"]
        A5["📱 Staff App\n/staff\n(PWA)"]
    end

    subgraph "🔀 Routing Layer"
        B1["Next.js middleware.ts\nSubdomain Router\n(hostname detection)"]
    end

    subgraph "⚙️ API Layer — Next.js Route Handlers"
        C1["/api/platform/*\nShop management\nPlan management\nInvitation codes"]
        C2["/api/bookings/*\nCreate/Edit/Cancel\nAuto-assign cron"]
        C3["/api/stripe/*\nCreate Intent\nWebhook\nConnect Payouts"]
        C4["/api/auth/*\nEmail Login\nSession JWT\nLINE OAuth"]
        C5["/api/chat/*\nReal-time Messages"]
        C6["/api/push/*\nWebPush notifications"]
        C7["/api/line/*\nLINE Messaging API"]
        C8["/api/schedules/*\nStaff schedule CRUD"]
        C9["/api/discount/*\nValidate + Apply"]
    end

    subgraph "🔐 Auth & Security"
        D1["JWT Middleware\n(per-request validation)"]
        D2["Supabase Auth\n(Email/Password)"]
        D3["LINE LIFF\n(Customer OAuth)"]
        D4["Rate Limiter\nUpstash Redis"]
    end

    subgraph "🗄️ Database Layer"
        E1["Supabase PostgreSQL\nMulti-tenant Schema\nRow Level Security"]
        E2["Supabase Realtime\n(Chat websockets)"]
        E3["Supabase Storage\n- job-photos bucket\n- slips bucket\n- shop-assets bucket"]
    end

    subgraph "💳 Payment Layer"
        F1["Stripe Platform Account\n(Destination Charges)"]
        F2["Stripe Connect\n(Shop Connected Accounts)"]
        F3["Platform Wallet\n(Escrow in DB)\nshop_wallets table"]
    end

    subgraph "📡 Notification Layer"
        G1["LINE Messaging API\n(Push + Rich Messages)"]
        G2["Web Push API\n(VAPID Keys)"]
    end

    subgraph "☁️ Infrastructure"
        H1["Vercel\n(Deploy + Edge)"]
        H2["Vercel Cron Jobs\n(Auto-assign every 15min)"]
        H3["Upstash Redis\n(Rate limiting + Cache)"]
    end

    A1 & A2 & A3 & A4 & A5 --> B1
    B1 --> C1 & C2 & C3 & C4 & C5
    C1 & C2 & C3 & C4 --> D1
    D1 --> D2 & D3
    D1 --> D4
    C2 & C4 & C5 & C8 & C9 --> E1
    C5 --> E2
    C3 --> F1 --> F2 --> F3
    C6 --> G2
    C7 --> G1
    H2 --> C2
```

---

## 2. Database ERD — Full Multi-Tenant Schema

### 2.1 Platform Level Tables

```mermaid
erDiagram
    PLATFORM_PLANS {
        uuid id PK
        text name "starter|growth|pro|enterprise"
        int price_monthly_thb
        int price_yearly_thb
        int max_staff
        int max_branches
        jsonb features "CRM, analytics, API, etc."
        bool is_active
        timestamptz created_at
    }

    SHOPS {
        uuid id PK
        text name
        text slug "unique, URL-safe"
        text type "wash|detailing|mechanic|etc."
        uuid owner_id FK "→ auth.users"
        uuid plan_id FK "→ platform_plans"
        timestamptz plan_expires_at
        text stripe_account_id "Stripe Connect"
        text line_channel_token
        text line_liff_id
        text phone
        text email
        text logo_url
        text address
        float lat
        float lng
        bool is_active
        bool is_verified
        bool is_marketplace_listed
        float platform_fee_pct "default 0.20"
        timestamptz created_at
    }

    SHOP_WALLETS {
        uuid id PK
        uuid shop_id FK "→ shops"
        numeric balance_thb "Available to withdraw"
        numeric pending_thb "In-flight / holding"
        numeric total_earned_thb "All time"
        numeric total_withdrawn_thb "All time"
        timestamptz updated_at
    }

    WITHDRAWAL_REQUESTS {
        uuid id PK
        uuid shop_id FK "→ shops"
        numeric amount_thb
        text bank_name
        text account_number
        text account_name
        text status "pending|approved|rejected|completed"
        text admin_note
        uuid approved_by FK "→ auth.users"
        timestamptz created_at
        timestamptz resolved_at
    }

    SHOP_INVITATIONS {
        uuid id PK
        uuid created_by FK "→ auth.users (platform admin)"
        text code "unique 8-char code"
        text email "invited email"
        uuid shop_id FK "→ shops (if already created)"
        bool is_used
        timestamptz expires_at
        timestamptz used_at
        timestamptz created_at
    }

    PLATFORM_ADMINS {
        uuid id PK "= auth.users.id"
        text full_name
        text email
        text role "super_admin|support|finance"
        bool is_active
        timestamptz created_at
    }

    PLATFORM_PLANS ||--o{ SHOPS : "used by"
    SHOPS ||--|| SHOP_WALLETS : "has"
    SHOPS ||--o{ WITHDRAWAL_REQUESTS : "requests"
    SHOPS ||--o{ SHOP_INVITATIONS : "invited via"
```

### 2.2 Shop Level Tables (each scoped by shop_id)

```mermaid
erDiagram
    SHOPS ||--o{ BRANCHES : "has"
    SHOPS ||--o{ STAFF : "employs"
    SHOPS ||--o{ SERVICES : "offers"
    SHOPS ||--o{ SERVICE_ADDONS : "offers"
    SHOPS ||--o{ DISCOUNT_CODES : "owns"
    SHOPS ||--o{ BOOKINGS : "receives"

    BRANCHES {
        uuid id PK
        uuid shop_id FK
        text name
        text address
        float lat
        float lng
        text slug
        bool is_active
        float labor_cost_per_job
        float vehicle_rental_per_job
        float fuel_cost_per_job
        float max_capital_per_job
        text out_of_zone_type "per_km|flat_rate"
        float out_of_zone_fee
        float max_out_of_zone_km
        uuid price_group_id FK
        timestamptz created_at
    }

    ZONES {
        uuid id PK
        uuid shop_id FK
        uuid branch_id FK
        text name
        text description
        float extra_fee
        jsonb polygon_coords
        text color
        bool is_active
    }

    STAFF {
        uuid id PK "= auth.users.id"
        uuid shop_id FK
        uuid branch_id FK
        text full_name
        text phone
        text email
        text line_user_id
        text role "shop_admin|staff"
        text image_url
        text bank_name
        text bank_account_number
        text promptpay_number
        bool is_active
        timestamptz created_at
    }

    SERVICES {
        uuid id PK
        uuid shop_id FK
        text name
        text description
        text image_url
        float price_s
        float price_m
        float price_l
        jsonb branch_settings "per-branch price/active override"
        bool is_active
        bool is_addon_required
        int sort_order
        timestamptz created_at
    }

    SERVICE_ADDONS {
        uuid id PK
        uuid shop_id FK
        text name
        text description
        float price
        text pricing_type "free|fixed|notify_later"
        jsonb sub_options
        text image_url
        jsonb branch_settings
        bool is_active
        int sort_order
    }

    CC_PRICE_GROUPS {
        uuid id PK
        uuid shop_id FK
        text name
        uuid[] branch_ids
        uuid[] service_ids
        jsonb prices "S/M/L price overrides"
        bool is_active
        timestamptz created_at
    }

    BRANCHES ||--o{ ZONES : "has"
    BRANCHES ||--o{ STAFF : "assigned to"
    SERVICES ||--o{ SERVICE_ADDONS : "can have"
    CC_PRICE_GROUPS ||--|| BRANCHES : "applies to"
```

### 2.3 Customer & Booking Tables

```mermaid
erDiagram
    CUSTOMER_ACCOUNTS {
        uuid id PK
        text email "nullable (LINE-only may not have)"
        text phone
        text full_name
        text line_user_id "unique, nullable"
        text auth_provider "line|email|google"
        bool is_email_verified
        jsonb saved_vehicles
        jsonb saved_locations
        text gender
        date birthdate
        text occupation
        jsonb interests
        bool is_profile_complete
        timestamptz created_at
    }

    SHOP_CUSTOMER_PROFILES {
        uuid id PK
        uuid shop_id FK
        uuid customer_account_id FK
        bool reward_claimed
        int total_visits
        float total_spent
        timestamptz last_visit_at
        timestamptz created_at
    }

    BOOKINGS {
        uuid id PK "format: BK-YYMMDD-XXXXXX"
        uuid shop_id FK
        uuid branch_id FK
        uuid customer_account_id FK
        uuid staff_id FK
        uuid service_id FK
        uuid zone_id FK
        jsonb addon_ids
        jsonb vehicle_data "brand, model, color, plate, size"
        float pickup_lat
        float pickup_lng
        text pickup_address
        float delivery_lat
        float delivery_lng
        text delivery_address
        date scheduled_date
        time scheduled_time
        float extra_fee
        float base_price
        float total_price
        float platform_fee_amount "20% of total"
        float shop_net_amount "80% of total"
        text discount_code
        float discount_amount
        text payment_method "stripe|transfer"
        text payment_status "pending|paid|refunded"
        text stripe_payment_intent_id
        text slip_url
        text status "pending|confirmed|picking_up|washing|delivering|completed|cancelled"
        bool auto_assigned
        int rating
        text review_comment
        jsonb vehicle_photos
        text customer_note
        float travel_surcharge
        float different_spot_fee
        float additional_price
        text additional_price_note
        bool is_additional_paid
        float labor_cost
        float capital_cost
        float rental_cost
        float fuel_cost
        float staff_extra_payout
        uuid payout_id FK
        bool reminder_sent
        int reschedule_count
        timestamptz created_at
        timestamptz updated_at
    }

    JOB_PHOTOS {
        uuid id PK
        uuid booking_id FK
        uuid shop_id FK
        text type "before|after"
        jsonb photo_urls
        timestamptz uploaded_at
    }

    BOOKING_MESSAGES {
        uuid id PK
        uuid booking_id FK
        uuid shop_id FK
        text sender_type "customer|staff|admin"
        uuid sender_id
        text sender_name
        text message
        text image_url
        bool is_read
        timestamptz created_at
    }

    STAFF_SCHEDULES {
        uuid id PK
        uuid shop_id FK
        uuid staff_id FK
        uuid zone_id FK
        uuid booking_id FK "null if not booked"
        date date
        time time_slot
        text work_type "in_zone|cross_zone|out_of_zone"
        bool is_booked
        timestamptz created_at
    }

    STAFF_PAYOUTS {
        uuid id PK
        uuid shop_id FK
        uuid staff_id FK
        float amount
        float extra_costs
        text slip_url
        date start_date
        date end_date
        jsonb booking_ids
        text notes
        text status "completed"
        timestamptz created_at
    }

    DISCOUNT_CODES {
        uuid id PK
        uuid shop_id FK
        text code "unique per shop"
        text discount_type "percent|fixed"
        float discount_value
        float max_discount_amount
        int max_uses
        int max_uses_per_customer
        int used_count
        text usage_type "permanent|date_range|specific_days"
        date valid_from
        date valid_until
        text[] valid_days
        uuid[] allowed_branch_ids
        uuid[] allowed_zone_ids
        text target_segment "JSON segment rule"
        bool is_active
        timestamptz created_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid shop_id FK
        uuid actor_id FK "staff/admin who did action"
        text actor_name
        text actor_role
        text action_type "CREATE|UPDATE|DELETE|TOGGLE_STATUS|PAYOUT|EXPORT"
        text entity_type "booking|staff|service|etc."
        text entity_id
        jsonb old_data
        jsonb new_data
        text description
        text ip_address
        text user_agent
        timestamptz created_at
    }

    CRM_SEGMENTS {
        uuid id PK
        uuid shop_id FK
        text name
        jsonb conditions
        int matched_count
        timestamptz created_at
        timestamptz updated_at
    }

    APP_SETTINGS {
        text key PK "scoped: shop_id:key or platform:key"
        uuid shop_id FK "null = platform-wide"
        jsonb value
        timestamptz updated_at
    }

    MARKETPLACE_LISTINGS {
        uuid id PK
        uuid shop_id FK
        text description
        text[] categories
        text[] tags
        jsonb featured_photos
        float avg_rating
        int review_count
        int booking_count
        bool is_featured
        timestamptz updated_at
    }

    SHOP_REVIEWS {
        uuid id PK
        uuid shop_id FK
        uuid booking_id FK
        uuid customer_account_id FK
        int rating
        text comment
        bool is_visible
        timestamptz created_at
    }

    CUSTOMER_ACCOUNTS ||--o{ SHOP_CUSTOMER_PROFILES : "has profile at"
    CUSTOMER_ACCOUNTS ||--o{ BOOKINGS : "makes"
    BOOKINGS ||--o{ JOB_PHOTOS : "has"
    BOOKINGS ||--o{ BOOKING_MESSAGES : "has"
    STAFF ||--o{ STAFF_SCHEDULES : "has"
    STAFF ||--o{ STAFF_PAYOUTS : "receives"
    SHOPS ||--|| MARKETPLACE_LISTINGS : "has"
    SHOPS ||--o{ SHOP_REVIEWS : "receives"
```

### 2.4 Payment / Wallet Flow Tables

```mermaid
erDiagram
    PAYMENT_TRANSACTIONS {
        uuid id PK
        uuid shop_id FK
        uuid booking_id FK
        text stripe_payment_intent_id
        text stripe_charge_id
        float gross_amount "Total customer paid"
        float platform_fee "20%"
        float stripe_fee "~1.5%"
        float net_to_shop "gross - platform_fee - stripe_fee"
        text status "created|succeeded|failed|refunded"
        text type "booking|additional|refund"
        timestamptz created_at
    }

    SHOP_WALLETS {
        uuid id PK
        uuid shop_id FK
        numeric balance_thb
        numeric pending_thb
        numeric total_earned_thb
        numeric total_withdrawn_thb
    }

    WALLET_LEDGER {
        uuid id PK
        uuid shop_id FK
        uuid shop_wallet_id FK
        uuid payment_transaction_id FK
        uuid withdrawal_request_id FK
        text type "credit|debit"
        numeric amount
        text description
        numeric balance_after
        timestamptz created_at
    }

    WITHDRAWAL_REQUESTS {
        uuid id PK
        uuid shop_id FK
        numeric amount_thb
        text bank_name
        text account_number
        text account_name
        text status "pending|approved|completed|rejected"
        timestamptz created_at
        timestamptz resolved_at
    }

    PAYMENT_TRANSACTIONS ||--|{ WALLET_LEDGER : "records in"
    SHOP_WALLETS ||--|{ WALLET_LEDGER : "tracked by"
    SHOP_WALLETS ||--o{ WITHDRAWAL_REQUESTS : "sources"
```

---

## 3. Workflow Diagrams

### 3.1 Customer Booking Flow (Marketplace → Partner Shop)

```mermaid
sequenceDiagram
    actor C as Customer
    participant M as Marketplace (foami.app)
    participant S as Shop Page (shop.foami.app/shopId)
    participant API as API Routes
    participant DB as Supabase
    participant STR as Stripe
    participant LINE as LINE Bot
    participant PUSH as Web Push

    C->>M: เปิด foami.app (แผนที่)
    M->>DB: GET marketplace_listings (active shops)
    DB-->>M: shops + ratings + positions
    M-->>C: แสดงร้านบนแผนที่

    C->>M: เลือกร้าน / กดจอง
    M->>S: redirect → shop.foami.app/shopId/book

    Note over S,DB: ดึงข้อมูลร้าน
    S->>DB: GET services, addons, branches, zones (scoped by shop_id)
    DB-->>S: shop data

    C->>S: เลือก Package + Addon
    C->>S: ปักหมุด Location (MapPicker)
    C->>S: เลือกวัน-เวลา

    S->>API: POST /api/availability?shop_id=&zone_id=&date=&time=
    API->>DB: check staff_schedules (is_booked=false)
    DB-->>API: available slots
    API-->>S: show available times

    C->>S: กดยืนยัน + เลือก Payment

    alt Payment via Stripe
        S->>API: POST /api/stripe/create-intent {amount, shop_id}
        API->>STR: stripe.paymentIntents.create (destination charge)
        STR-->>API: client_secret
        API-->>S: client_secret
        S-->>C: Stripe Payment UI
        C->>STR: กรอกบัตร + ยืนยัน
        STR->>API: Webhook: payment_intent.succeeded
        API->>DB: bookings.payment_status = 'paid'
        API->>DB: payment_transactions.insert (gross, fee, net)
        API->>DB: shop_wallets.pending_thb += net_to_shop
        API->>DB: wallet_ledger.insert (credit, pending)
    else Payment via Bank Transfer
        C->>S: อัปโหลดสลิป
        S->>API: POST /api/storage/slip
        API->>DB: bookings.slip_url = url, payment_status = 'pending'
        Note over API: Admin ตรวจสลิปและ confirm ทีหลัง
    end

    API->>DB: bookings.insert {shop_id, status: 'pending'}
    API->>DB: staff_schedules.is_booked = true (ถ้า pre-assign)

    API->>LINE: notify staff (new job)
    API->>PUSH: notify staff (web push)
    API-->>S: { booking_id, success }
    S-->>C: 🎉 จองสำเร็จ
```

### 3.2 Partner Shop Onboarding Flow

```mermaid
flowchart TD
    A["👑 Platform Admin (โนฟท)\nadmin.foami.app"] -->|"1. สร้าง Invitation Code\nPOST /api/platform/invitations"| B["shop_invitations table\ncode: 'FOAMI-XXXX'\nemail: shop@email.com\nexpires: 7 วัน"]

    B -->|"2. ส่ง Code ให้ร้าน\n(Email / LINE / แชท)"| C["📧 ร้านพาร์ทเนอร์ได้รับ Code"]

    C -->|"3. ไปที่ foami.app/register"| D["Registration Page"]
    D -->|"4. กรอก Email + Password\n+ ใส่ Invitation Code"| E{{"ตรวจสอบ Code\nvalid & not expired?"}}

    E -->|No| F["❌ Error: Code ไม่ถูกต้อง"]
    E -->|Yes| G["5. สร้าง auth.users record\nสร้าง shops record\nplan = 'starter' (ฟรี)"]

    G -->|"6. Setup Stripe Connect\n(ถ้าต้องรับเงิน)"| H["Stripe Connect Onboarding\nstripe.com/connect/onboarding"]
    H --> I["shops.stripe_account_id บันทึก"]

    G -->|"7. Shop Setup Wizard"| J["Shop Setup Steps"]
    J --> J1["📝 ข้อมูลร้าน\n(ชื่อ, ที่อยู่, โลโก้)"]
    J1 --> J2["🗺️ สร้าง Branch + Zones\n(วาด polygon บนแผนที่)"]
    J2 --> J3["💼 เพิ่ม Services + Addons\n(ตั้งราคา S/M/L)"]
    J3 --> J4["👤 เพิ่ม Staff\n(Email invite หรือ manual)"]
    J4 --> J5["📅 ตั้ง Schedule ล่วงหน้า"]

    J5 --> K["✅ ร้านพร้อมใช้งาน"]
    K --> K1["🏪 shop.foami.app/shopId\n(ลูกค้าจองได้)"]
    K --> K2["📊 shop admin dashboard\n(จัดการร้าน)"]
    K --> K3["🗺️ Listed บน Marketplace\n(ถ้า Plan = Growth+)"]
```

### 3.3 Payment Settlement Flow (Platform Wallet Model)

```mermaid
sequenceDiagram
    actor C as ลูกค้า
    participant STR as Stripe
    participant API as Platform API
    participant W as Shop Wallet (DB)
    participant SA as Shop Admin

    C->>STR: ชำระเงิน ฿200

    Note over STR,API: Destination Charge
    STR->>STR: Platform เก็บ: ฿200 - Stripe fee (≈฿3.20)
    STR->>STR: = ฿196.80 เข้า Platform account

    STR->>API: Webhook: payment_intent.succeeded
    API->>W: คำนวณ
    Note over API,W: Platform Fee 20% = ฿40<br/>Stripe Fee ≈ ฿3.20<br/>Shop Net = ฿156.80

    API->>W: shop_wallets.pending += 156.80
    API->>W: wallet_ledger (credit, pending)
    Note over W: สถานะ "pending" จนกว่างานเสร็จ

    Note over API: เมื่อ Booking = 'completed'
    API->>W: pending → balance (released)
    API->>W: wallet_ledger (credit, balance)
    W-->>SA: balance_thb แสดงใน Dashboard

    SA->>API: POST /api/platform/withdrawals\n{amount: 500, bank_account: "..."}
    API->>W: ตรวจสอบ balance >= amount
    API->>W: withdrawal_requests.insert (pending)

    Note over API: Platform Admin approve
    API->>W: balance -= 500
    API->>W: total_withdrawn += 500
    API->>W: wallet_ledger (debit)
    API-->>SA: โอนเงินเข้าบัญชี ฿500 ✅
```

### 3.4 Staff Job Workflow

```mermaid
stateDiagram-v2
    [*] --> pending: ลูกค้าจองสำเร็จ\n(payment_status=paid)

    pending --> confirmed: Auto-assign Cron (ทุก 15 นาที)\nหรือ Admin assign manual

    confirmed --> picking_up: Staff กด "ออกไปรับรถ"\n→ แจ้งลูกค้า LINE + Push

    picking_up --> washing: Staff กด "เริ่มล้าง"\n+ ถ่ายรูป before\n→ แจ้งลูกค้า

    washing --> delivering: Staff กด "ล้างเสร็จ นำรถกลับ"\n+ ถ่ายรูป after\n→ แจ้งลูกค้า

    delivering --> completed: Staff กด "ส่งรถแล้ว"\n→ แจ้งลูกค้า "ให้คะแนน"\n→ Shop Wallet released

    pending --> cancelled: Admin/ลูกค้ายกเลิก\n→ คืนเงิน (Stripe Refund)
    confirmed --> cancelled: Admin/ลูกค้ายกเลิก

    completed --> [*]: ลูกค้าให้ Rating + Review
```

### 3.5 Platform Admin Workflow

```mermaid
flowchart LR
    subgraph "admin.foami.app — Platform Dashboard"
        A["🏠 Overview\n- Total shops\n- Total revenue\n- Platform fees earned\n- Active bookings"]

        B["🏪 Shop Management\n- List all shops\n- Verify/suspend shops\n- Change plan\n- View shop metrics"]

        C["🎫 Invitations\n- Generate codes\n- View used/unused\n- Set plan & expiry"]

        D["💰 Finance\n- Platform wallet\n- Withdrawal requests\n- Approve/reject\n- Fee adjustments per shop"]

        E["📊 Analytics\n- Revenue by shop\n- Top performing shops\n- Platform growth\n- Churn metrics"]

        F["⚙️ Platform Settings\n- Default fee % per shop\n- Plan features config\n- Global notifications\n- Maintenance mode"]
    end

    G["👑 Super Admin (โนฟท)"] --> A & B & C & D & E & F
```

### 3.6 Marketplace Discovery Flow

```mermaid
flowchart TD
    C["🧑 ลูกค้าเปิด foami.app"] --> M["🗺️ Marketplace Map\n(Leaflet.js)"]

    M --> F["Filter Bar"]
    F --> F1["📍 ระยะทาง (radius)"]
    F --> F2["🏷️ ประเภทบริการ"]
    F --> F3["⭐ Rating ขั้นต่ำ"]
    F --> F4["💰 ราคา range"]

    M --> DB[("marketplace_listings\n+ shops\n+ shop_reviews")]
    DB --> PINS["📍 Shop pins บนแผนที่"]

    PINS --> CARD["Shop Card Popup\n- ชื่อร้าน + โลโก้\n- Rating ⭐ (avg)\n- ระยะทาง\n- ราคาเริ่มต้น\n- 'จองเลย' button"]

    CARD -->|"กด จองเลย"| SHOP["shop.foami.app/[shopId]/book"]
    CARD -->|"กด ดูร้าน"| PROFILE["shop.foami.app/[shopId]\n(Shop Profile Page)"]

    PROFILE --> P1["📸 Photos gallery"]
    PROFILE --> P2["📋 Services + Prices"]
    PROFILE --> P3["⭐ Reviews"]
    PROFILE --> P4["📅 Book Now → /book"]
```

---

## 4. API Route Map (Complete)

| Method | Route | Auth Required | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Email + Password login (returns JWT) |
| POST | `/api/auth/line` | None | LINE OAuth callback |
| POST | `/api/auth/logout` | JWT | Logout |
| GET | `/api/platform/shops` | Platform Admin | List all shops |
| POST | `/api/platform/shops` | Platform Admin | Create shop |
| PATCH | `/api/platform/shops/[id]` | Platform Admin | Update shop (plan, status) |
| POST | `/api/platform/invitations` | Platform Admin | Generate invitation code |
| GET | `/api/platform/invitations` | Platform Admin | List invitations |
| GET | `/api/platform/withdrawals` | Platform Admin | Pending withdrawal requests |
| PATCH | `/api/platform/withdrawals/[id]` | Platform Admin | Approve/Reject withdrawal |
| GET | `/api/marketplace/shops` | None | Public: list marketplace shops |
| GET | `/api/marketplace/shops/[slug]` | None | Public: shop profile |
| POST | `/api/bookings` | Customer JWT | Create booking |
| GET | `/api/bookings` | Shop JWT | List bookings (scoped by shop_id) |
| PATCH | `/api/bookings/[id]` | Shop JWT | Update booking status |
| PUT | `/api/bookings/manual/edit` | Shop JWT | Admin edit booking |
| POST | `/api/stripe/create-intent` | Customer JWT | Create Stripe payment intent |
| POST | `/api/stripe/webhook` | Stripe Sig | Handle payment events |
| POST | `/api/stripe/refund` | Shop Admin JWT | Refund payment |
| GET | `/api/availability` | Customer JWT | Check staff availability |
| GET | `/api/schedules` | Shop JWT | Get staff schedules |
| POST | `/api/schedules` | Shop JWT | Create schedule slots |
| DELETE | `/api/schedules/[id]` | Shop JWT | Delete schedule |
| POST | `/api/discount/validate` | None (rate limited) | Validate discount code |
| GET | `/api/chat` | JWT | Get messages for booking |
| POST | `/api/chat` | JWT | Send message |
| POST | `/api/payouts` | Shop Admin JWT | Record staff payout |
| POST | `/api/push/subscribe` | JWT | Register push subscription |
| GET | `/api/cron/auto-assign` | Cron Secret | Auto-assign staff (every 15min) |
| GET | `/api/cron/reminders` | Cron Secret | Send job reminders |

---

## 5. Security Architecture

```mermaid
flowchart TD
    subgraph "Request Flow"
        REQ["Incoming Request"] --> MW["middleware.ts"]
        MW --> RD["Subdomain Router\n(marketplace/shop/admin)"]
        MW --> RL["Rate Limiter\n(Upstash Redis)"]
        RL -->|"Too many requests"| E429["429 Too Many Requests"]
        RD --> JV["JWT Validator"]
        JV -->|"Invalid token"| E401["401 Unauthorized"]
        JV -->|"Valid"| SC["Scope Check\n(shop_id in JWT matches resource?)"]
        SC -->|"Wrong shop"| E403["403 Forbidden"]
        SC -->|"OK"| API["API Route Handler"]
    end

    subgraph "RLS Policies (Supabase)"
        API --> SB["Supabase Client"]
        SB --> RLS["Row Level Security\n(PostgreSQL)"]
        RLS --> P1["shops: owner_id = auth.uid()"]
        RLS --> P2["bookings: shop_id = auth.jwt() → shop_id"]
        RLS --> P3["staff: shop_id = auth.jwt() → shop_id"]
        RLS --> P4["Platform admin: role = 'platform_admin'"]
    end

    subgraph "JWT Payload Structure"
        JWT["JWT Token contains:\n{\n  sub: user_id,\n  role: 'shop_admin'|'staff'|'customer'|'platform_admin',\n  shop_id: 'uuid' (null for platform admins),\n  plan: 'starter|growth|pro|enterprise',\n  features: {...}\n}"]
    end
```

---

## 6. Plan Feature Gating (Code-level)

```typescript
// lib/plan-gates.ts
export const PLAN_FEATURES = {
  starter:    { crm: false,    rfm: false,    push: false,   line_notify: false,  audit: false,  api: false },
  growth:     { crm: true,     rfm: false,    push: true,    line_notify: true,   audit: false,  api: false },
  pro:        { crm: true,     rfm: true,     push: true,    line_notify: true,   audit: true,   api: false },
  enterprise: { crm: true,     rfm: true,     push: true,    line_notify: true,   audit: true,   api: true  },
}

// Usage in API route:
export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!hasFeature(session.plan, 'rfm')) {
    return NextResponse.json({ error: 'Feature requires Pro plan' }, { status: 403 })
  }
  // ... rest of handler
}
```

---

## 7. Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth
JWT_SECRET=                        # 256-bit secret for signing tokens
NEXTAUTH_SECRET=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# LINE
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
NEXT_PUBLIC_LINE_LIFF_ID=

# Platform
NEXT_PUBLIC_APP_URL=               # https://foami-wash-and-delivery.vercel.app
NEXT_PUBLIC_PLATFORM_FEE=0.20      # 20% (configurable)
CRON_SECRET=                       # Random 32-char string (NO hardcoded fallback!)

# Upstash Redis (Rate limiting)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```
