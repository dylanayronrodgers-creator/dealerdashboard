# Axxess Dealer Dashboard - Technical Export
### Prepared for: Mark Phillips (CTO)
### Prepared by: Dylan Rodgers
### Date: 6 February 2026

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Technology Stack](#2-technology-stack)
3. [Database Schema](#3-database-schema)
4. [Authentication & Security](#4-authentication--security)
5. [Dashboard Portals](#5-dashboard-portals)
6. [Data Flow & Automation](#6-data-flow--automation)
7. [Deployment & Infrastructure](#7-deployment--infrastructure)
8. [File Structure](#8-file-structure)
9. [Feature Inventory](#9-feature-inventory)
10. [Migration History](#10-migration-history)
11. [API & Integration Points](#11-api--integration-points)
12. [Roadmap & Action Items](#12-roadmap--action-items)

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Netlify)                       │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  Admin    │  │  Agent   │  │  Dealer  │  │  TV Display  │   │
│  │Dashboard  │  │Dashboard │  │Dashboard │  │  Dashboard   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│       │              │              │               │           │
│       └──────────────┼──────────────┼───────────────┘           │
│                      │              │                           │
│              ┌───────┴──────────────┴───────┐                   │
│              │    supabase-config.js        │                   │
│              │    (Centralised Config)      │                   │
│              └──────────────┬───────────────┘                   │
└─────────────────────────────┼───────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE (Backend)                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Auth         │  │  PostgreSQL  │  │  Row-Level Security  │  │
│  │  (Email/Pass) │  │  Database    │  │  (RLS Policies)      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  Project ID: xitiatikzlzcswakgevy                              │
│  Region: Supabase Cloud                                        │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Service Role Key
                              │
┌─────────────────────────────────────────────────────────────────┐
│                   AUTOMATION (Node.js)                          │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  Puppeteer        │  │  CSV Parser       │                   │
│  │  (Browser Scrape) │  │  (Data Transform) │                   │
│  └────────┬─────────┘  └────────┬─────────┘                    │
│           │                      │                              │
│           ▼                      ▼                              │
│  ┌──────────────────────────────────────────┐                   │
│  │  openserve-csv-sync.js                   │                   │
│  │  Schedule: 8AM, 12PM, 5PM                │                   │
│  └──────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| HTML5 | - | Page structure |
| CSS3 | - | Base styling |
| JavaScript | ES6+ | Application logic |
| Tailwind CSS | CDN (latest) | Utility-first CSS framework |
| Chart.js | CDN (latest) | Data visualisation charts |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Supabase | Cloud | Database, Auth, Real-time |
| PostgreSQL | 15+ (Supabase) | Relational database |
| Row-Level Security | Native | Data access control |

### Automation
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 18+ | Runtime for automation scripts |
| Puppeteer | ^21.0.0 | Browser automation for Openserve scraping |
| csv-parse | ^5.5.0 | CSV file parsing |
| dotenv | ^16.3.0 | Environment variable management |

### DevOps
| Technology | Version | Purpose |
|-----------|---------|---------|
| Netlify | Cloud | Static site hosting & CDN |
| GitHub | Cloud | Source control |
| GitHub Actions | - | Scheduled automation (planned) |
| Vite | ^5.0.0 | Development server & build tool |

---

## 3. Database Schema

### Core Tables

#### `profiles`
Stores user accounts linked to Supabase Auth.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Links to auth.users |
| email | TEXT | User email |
| full_name | TEXT | Display name |
| role | TEXT | admin, agent, dealer |
| phone | TEXT | Contact number |
| dealer_id | UUID (FK) | Links to dealers table |
| avatar_url | TEXT | Profile image |
| is_approved | BOOLEAN | Agent approval status |
| created_at | TIMESTAMPTZ | Registration date |

#### `leads`
Core business entity - tracks all client leads.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Unique identifier |
| first_name | TEXT | Client first name |
| last_name | TEXT | Client last name |
| full_name | TEXT | Combined name |
| email | TEXT | Client email |
| phone | TEXT | Client phone |
| address | TEXT | Installation address |
| id_number | TEXT | SA ID number |
| passport_number | TEXT | Passport (non-SA) |
| status | TEXT | new/contacted/qualified/converted/lost/returned |
| agent_id | UUID (FK) | Assigned agent |
| dealer_id | UUID (FK) | Assigned dealer |
| package_id | UUID (FK) | Selected package |
| order_number | TEXT | Openserve order number |
| service_id | TEXT | Openserve service ID |
| account_number | TEXT | Client account number |
| commission_amount | NUMERIC | Calculated commission |
| commission_status | TEXT | pending/confirmed/paid/rejected |
| order_status | TEXT | processing/scheduled/completed/cancelled |
| is_preorder | BOOLEAN | Future-dated installation flag |
| delivery_requested | BOOLEAN | Router delivery status |
| delivery_requested_at | TIMESTAMPTZ | Delivery request timestamp |
| notes | TEXT | Additional notes |
| created_at | TIMESTAMPTZ | Lead creation date |

#### `orders`
Converted leads with installation tracking.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Unique identifier |
| lead_id | UUID (FK) | Source lead |
| agent_id | UUID (FK) | Converting agent |
| dealer_id | UUID (FK) | Associated dealer |
| order_number | TEXT | Openserve order number |
| service_id | TEXT | Service identifier |
| account_number | TEXT | Client account |
| client_name | TEXT | Client name |
| package_id | UUID (FK) | Package selected |
| status | TEXT | pending/processing/scheduled/completed/cancelled |
| commission_amount | NUMERIC | Commission value |
| created_at | TIMESTAMPTZ | Order creation date |

#### `packages`
Openserve fibre packages.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Unique identifier |
| name | TEXT | Package name (e.g. "Fibre 50Mbps") |
| speed | TEXT | Speed tier |
| price | NUMERIC | Monthly price |
| dealer_commission | NUMERIC | Commission per install |
| is_active | BOOLEAN | Available for selection |

#### `dealers`
Dealer organisations.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Unique identifier |
| name | TEXT | Dealer company name |
| contact_email | TEXT | Primary contact |
| contact_phone | TEXT | Phone number |
| commission_rate | NUMERIC | Default commission % |
| logo_url | TEXT | Dealer branding |
| created_at | TIMESTAMPTZ | Registration date |

---

## 4. Authentication & Security

### Authentication
- **Provider:** Supabase Auth (email/password)
- **Session Management:** JWT tokens with automatic refresh
- **Role Assignment:** Set in `profiles.role` column
- **Login Flow:** `login.html` → Supabase Auth → Role-based redirect

### Row-Level Security (RLS)
All tables have RLS enabled with policies:
- **Admins:** Full read/write access to all records
- **Agents:** Read/write only their own leads and orders
- **Dealers:** Read access to leads/orders from their agent network
- **TV Dashboard:** Public read-only access (limited columns)

### Data Protection
- **ID Numbers:** Validated using SA ID checksum algorithm on input
- **Credentials:** Stored in `.env` file (excluded from Git via `.gitignore`)
- **Service Key:** Used only in server-side Node.js scripts, never exposed to frontend
- **Anon Key:** Used in frontend with RLS providing access control
- **HTTPS:** Enforced via Netlify and Supabase

### Areas Requiring Security Audit (Mark's Action Item)
1. RLS policy completeness verification
2. ID number encryption at rest (currently stored as plain text)
3. API key rotation policy
4. Session timeout configuration
5. Input sanitisation review (XSS/injection)
6. CORS policy review
7. Audit logging implementation
8. Data retention policy

---

## 5. Dashboard Portals

### Admin Dashboard (`admin-dashboard.html`)
**Access:** Admin role only
**Features:**
- Overview with real-time stats (total leads, orders, agents, dealers, conversion rate, commission)
- Revenue breakdown (confirmed, pending, rejected)
- Lead management (CRUD, status updates, convert to order, bulk import)
- Order management (view, edit status, track installation)
- Agent management (approve, edit, deactivate)
- Dealer management (create, edit, assign agents)
- Preorders section (filter, export, remove flag)
- Shipping & delivery tracking (mark deliveries, bulk actions)
- Reports with Chart.js visualisations
- Settings (packages, system configuration)
- Global search across all leads

### Agent Dashboard (`agent-dashboard.html`)
**Access:** Approved agents only
**Features:**
- Personal performance overview
- My Leads (view, update status, convert)
- My Orders (track status)
- My Preorders (view preorder leads)
- Commissions (earnings breakdown)
- Returned Items (items returned by admin for correction)
- Reports (personal performance charts)

### Dealer Dashboard (`dealer-dashboard.html`)
**Access:** Dealer role only
**Features:**
- Network overview (all agents, leads, orders)
- My Agents (performance tracking per agent)
- All Leads (across entire agent network)
- Orders (all converted leads)
- Preorders (network-wide preorder tracking)
- Reports (dealership performance analytics)
- Data export (CSV download)

### TV Dashboard (`tv-dashboard.html`)
**Access:** Public (read-only, limited data)
**Features:**
- Real-time display of lead/order counts
- Designed for office TV/monitor display

---

## 6. Data Flow & Automation

### Current Manual Process
1. Agents load leads on Openserve UPP portal
2. Admin exports data as Excel from Openserve
3. Data is sanitised and formatted as CSV
4. CSV is uploaded via admin dashboard import function
5. Dashboard displays data to all portal users

### Planned Automated Process
1. **Puppeteer script** logs into Openserve portal
2. **Downloads CSV** automatically
3. **Parses and maps** CSV columns to database fields
4. **Updates Supabase** with new/changed records
5. **Duplicate detection** prevents repeated entries
6. **Scheduled execution:** 8:00 AM, 12:00 PM, 5:00 PM daily

### Automation Script
- **File:** `scripts/openserve-csv-sync.js`
- **Config:** `.env` file with Openserve credentials
- **Documentation:** `OPENSERVE_CSV_SYNC_SETUP.md`
- **Status:** Script built, requires Openserve portal selector configuration

### Deployment Options for Automation
| Option | Pros | Cons |
|--------|------|------|
| GitHub Actions | Free, reliable, no server needed | 6-hour minimum cron interval on free tier |
| Windows Task Scheduler | Runs locally, flexible scheduling | Requires always-on machine |
| PM2 (Node.js) | Process management, auto-restart | Requires server |
| Cloud Function | Serverless, scalable | Additional cost |

---

## 7. Deployment & Infrastructure

### Hosting
- **Platform:** Netlify (free tier)
- **URL:** https://steady-vacherin-437f82.netlify.app/
- **Deployment:** Auto-deploy from GitHub `main` branch
- **Build:** No build step required (static HTML/JS)
- **Config:** `netlify.toml` with SPA redirect rules

### Database
- **Platform:** Supabase Cloud
- **Project:** `xitiatikzlzcswakgevy`
- **Database:** PostgreSQL 15+
- **Region:** Supabase default
- **Backups:** Supabase automatic daily backups

### Source Control
- **Platform:** GitHub
- **Repository:** `dylanayronrodgers-creator/dealerdashboard`
- **Branch:** `main`
- **CI/CD:** Netlify auto-deploy on push

---

## 8. File Structure

```
axxess-dealer-dashboard/
├── index.html                    # Landing page
├── login.html                    # Authentication page
├── admin-dashboard.html          # Admin portal
├── agent-dashboard.html          # Agent portal
├── dealer-dashboard.html         # Dealer portal
├── tv-dashboard.html             # TV display dashboard
├── openserve-dashboard.html      # Openserve data view
├── setup.html                    # Initial setup wizard
├── fix-dealer-profile.html       # Dealer profile repair tool
├── fix-missing-orders.html       # Order repair tool
├── debug-missing-orders.html     # Debug utility
│
├── js/
│   ├── supabase-config.js        # Centralised Supabase config
│   ├── auth.js                   # Authentication logic
│   ├── admin-dashboard.js        # Admin functionality (~4000 lines)
│   ├── agent-dashboard.js        # Agent functionality
│   ├── dealer-dashboard.js       # Dealer functionality
│   ├── openserve-dashboard.js    # Openserve data logic
│   ├── preorders.js              # Admin preorders module
│   ├── agent-preorders.js        # Agent preorders module
│   └── dealer-preorders.js       # Dealer preorders module
│
├── scripts/
│   ├── openserve-csv-sync.js     # Automated Openserve scraper
│   └── test-openserve-login.js   # Login test utility
│
├── migrations/                   # 23 SQL migration files
│   ├── schema.sql                # Base schema
│   ├── complete_schema.sql       # Full schema reference
│   └── ... (21 incremental migrations)
│
├── guides/                       # User documentation
│   ├── index.html                # Guide hub
│   ├── admin-dashboard-guide.html
│   ├── agent-dashboard-guide.html
│   └── dealer-dashboard-guide.html
│
├── docs/                         # Technical documentation
│   ├── email-to-cto-mark-phillips.md
│   └── technical-export-for-cto.md
│
├── package.json                  # Node.js dependencies
├── netlify.toml                  # Netlify configuration
├── README.md                     # Setup instructions
├── OPENSERVE_CSV_SYNC_SETUP.md   # Automation guide
└── AZURE_AD_B2C_LOGIN_GUIDE.md   # Azure AD integration guide
```

---

## 9. Feature Inventory

### Completed Features
| Feature | Portal(s) | Status |
|---------|-----------|--------|
| User authentication (email/password) | All | ✅ Live |
| Role-based access control | All | ✅ Live |
| Lead CRUD operations | Admin | ✅ Live |
| Lead status workflow | Admin, Agent | ✅ Live |
| Order conversion workflow | Admin, Agent | ✅ Live |
| Order status tracking | All | ✅ Live |
| Agent management & approval | Admin | ✅ Live |
| Dealer management | Admin | ✅ Live |
| CSV mass import | Admin | ✅ Live |
| Dashboard statistics | All | ✅ Live |
| Chart.js analytics | Admin, Agent, Dealer | ✅ Live |
| Commission tracking | All | ✅ Live |
| Preorders feature | All | ✅ Live |
| Shipping/delivery tracking | Admin | ✅ Live |
| Return items workflow | Admin, Agent | ✅ Live |
| Global search | Admin | ✅ Live |
| Data export (CSV) | All | ✅ Live |
| TV display dashboard | TV | ✅ Live |
| User guides | Documentation | ✅ Live |
| SA ID validation | Admin, Agent | ✅ Live |

### Planned Features
| Feature | Priority | Timeline |
|---------|----------|----------|
| Openserve automation (3x daily) | High | This week |
| API integration (if available) | High | This week |
| Security audit remediation | High | Pending audit |
| Sales funnel visualisation | Medium | 2-4 weeks |
| Rumertile dealer expansion | Medium | 1 month |
| Marketing demo video | Low | TBD (Stephanie) |
| Push notifications | Low | Future |
| Mobile-responsive optimisation | Low | Future |

---

## 10. Migration History

| # | Migration File | Description |
|---|---------------|-------------|
| 1 | schema.sql | Base database schema |
| 2 | complete_schema.sql | Full schema reference |
| 3 | complete_setup.sql | Initial setup with seed data |
| 4 | add_lead_name_columns.sql | Split name into first/last |
| 5 | add_order_number_column.sql | Openserve order tracking |
| 6 | add_id_number_column.sql | SA ID number field |
| 7 | add_passport_number.sql | Passport for non-SA clients |
| 8 | add_dealers_and_improvements.sql | Dealer system |
| 9 | add_dealer_to_orders.sql | Link orders to dealers |
| 10 | add_dealer_logo.sql | Dealer branding |
| 11 | add_commission_and_revenue.sql | Commission tracking |
| 12 | add_order_tracking_fields.sql | Extended order fields |
| 13 | add_delivery_tracking.sql | Shipping management |
| 14 | add_preorder_field.sql | Preorder feature |
| 15 | replace_isp_leadtype_with_serviceid_accountnumber.sql | Field restructure |
| 16 | leads_csv_columns.sql | CSV import mapping |
| 17 | update_leads_for_csv.sql | CSV field updates |
| 18 | fix_leads_table_complete.sql | Table repairs |
| 19 | fix_handle_new_user_trigger.sql | Auth trigger fix |
| 20 | fix_profiles_role_check.sql | Role validation |
| 21 | fix_rls_now.sql | RLS policy updates |
| 22 | fix_rls_recursion.sql | RLS recursion fix |
| 23 | allow_public_read_for_tv_dashboard.sql | TV dashboard access |

---

## 11. API & Integration Points

### Supabase Client API
- **Anon Key:** Used in frontend for authenticated requests
- **Service Role Key:** Used in automation scripts (full access)
- **Real-time:** Available but not currently utilised (future enhancement)

### Openserve Integration
- **Current:** Manual CSV export → import
- **Planned:** Puppeteer automation with scheduled scraping
- **Future:** Direct API if Openserve provides one

### Netlify
- **Auto-deploy:** Triggered on GitHub push to `main`
- **Custom domain:** Can be configured via Netlify DNS

---

## 12. Roadmap & Action Items

### Phase 1: Automation (This Week) - Dylan
- [ ] Configure Openserve portal selectors in Puppeteer script
- [ ] Test automated login and CSV download
- [ ] Set up scheduled execution (8 AM, 12 PM, 5 PM)
- [ ] Deploy automation via GitHub Actions
- [ ] Implement error notifications

### Phase 2: Security Audit (Next 2 Weeks) - Mark
- [ ] Review RLS policies on all tables
- [ ] Assess ID number encryption requirements
- [ ] Review API key management
- [ ] Test authentication edge cases
- [ ] Document findings and remediation plan

### Phase 3: Dealer Feedback (Next 2 Weeks) - Dylan
- [ ] Distribute guides to pilot dealers
- [ ] Collect structured feedback
- [ ] Prioritise enhancement requests
- [ ] Implement critical fixes

### Phase 4: Enhancements (Month 2) - Dylan
- [ ] Sales funnel visualisation
- [ ] Rumertile dealer onboarding
- [ ] Performance optimisation
- [ ] Mobile responsiveness improvements

### Phase 5: Marketing (TBD) - Stephanie
- [ ] Record dashboard demo video
- [ ] Create dealer onboarding materials
- [ ] Prepare presentation for dealer rollout

---

*Document prepared by Dylan Rodgers | 6 February 2026*
*Axxess Dealer Portal - Powered by Openserve*
