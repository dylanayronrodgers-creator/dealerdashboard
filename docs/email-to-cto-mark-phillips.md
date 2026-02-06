# Email Draft to Mark Phillips (CTO)

---

**To:** Mark Phillips (CTO)
**From:** Dylan Rodgers
**Date:** 6 February 2026
**Subject:** Axxess Dealer Dashboard - Technical Overview, Current Status & Action Plan

---

Hi Mark,

Following our ad-hoc meeting today, I wanted to provide you with a comprehensive overview of the Axxess Dealer Dashboard system, its current state, architecture, and the action items I'll be executing going forward.

## 1. System Overview

The Axxess Dealer Dashboard is a web-based portal that provides dealers, their agents, and our admin team with real-time visibility into Openserve fibre leads, orders, commissions, and performance metrics. The system replaces the previous manual process of extracting data from the Openserve UPP portal and distributing it via spreadsheets.

**Live URL:** https://steady-vacherin-437f82.netlify.app/

## 2. Current Architecture

### Tech Stack
| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) | Dashboard UI |
| **Styling** | Tailwind CSS (CDN) | Responsive design |
| **Charts** | Chart.js | Analytics & reporting |
| **Database** | Supabase (PostgreSQL) | Data storage & real-time |
| **Authentication** | Supabase Auth | User login & role management |
| **Hosting** | Netlify | Static site deployment |
| **Automation** | Puppeteer + Node.js | Openserve data scraping |
| **CSV Parsing** | csv-parse (Node.js) | Data import processing |

### Dashboard Portals
The system consists of **four distinct portals**, each with role-based access:

1. **Admin Dashboard** - Full system management (leads, orders, agents, dealers, shipping, reports, preorders, commissions, settings)
2. **Agent Dashboard** - Individual agent view (personal leads, orders, commissions, returned items, preorders)
3. **Dealer Dashboard** - Dealer network oversight (agent management, all leads/orders across their network, preorders, reports)
4. **TV Dashboard** - Read-only display board for office monitoring

### Database Schema
- **profiles** - User accounts with role-based access (admin, agent, dealer)
- **leads** - Client lead records with full lifecycle tracking
- **orders** - Converted leads with installation tracking
- **packages** - Openserve fibre packages with pricing
- **dealers** - Dealer organisations with commission rates
- **agents** - Agent profiles linked to dealers
- 23 database migrations applied to date

### Security (Current State)
- **Authentication:** Supabase Auth with email/password
- **Row-Level Security (RLS):** Implemented on all database tables
- **Role-Based Access:** Admin, Agent, Dealer roles enforced at query level
- **ID Number Protection:** South African ID numbers validated on input
- **Environment Variables:** Credentials stored in `.env` (not committed to Git)
- **Service Role Key:** Used only for server-side automation scripts

## 3. Data Flow

```
Openserve UPP Portal
        │
        ▼
Manual CSV Export (Excel) ──► Sanitised CSV
        │                          │
        ▼                          ▼
Puppeteer Automation ──────► Supabase Database
(Planned: 3x daily)              │
                                  ▼
                    ┌─────────────┼─────────────┐
                    │             │             │
              Admin Portal  Agent Portal  Dealer Portal
```

**Current Process:**
- Leads are loaded by dealer agents on the Openserve UPP portal
- Data is manually extracted as Excel, sanitised into CSV
- CSV is uploaded to the dashboard via the admin import function

**Planned Automation:**
- Puppeteer script scrapes Openserve portal automatically
- Scheduled 3x daily: **8:00 AM, 12:00 PM, 5:00 PM**
- Duplicate detection ensures no missed or repeated transactions
- Automation options: GitHub Actions (recommended), Windows Task Scheduler, or PM2

## 4. Features Delivered

### Core Features
- [x] Lead management (create, edit, convert, delete, status tracking)
- [x] Order management (conversion workflow, status tracking, installation tracking)
- [x] Agent management (registration, approval, performance tracking)
- [x] Dealer management (create, assign agents, commission tracking)
- [x] CSV mass import for leads
- [x] Role-based authentication and access control
- [x] Real-time dashboard statistics and analytics
- [x] Chart.js performance visualisations

### Recently Added
- [x] **Preorders feature** - Track future-dated installations across all portals
- [x] **Shipping & delivery tracking** - Router delivery management
- [x] **Commission tracking** - Confirmed, pending, rejected revenue breakdown
- [x] **Comprehensive user guides** - Admin, Agent, and Dealer how-to documentation
- [x] **Openserve CSV sync script** - Automated data extraction (ready for configuration)

### Pending / In Progress
- [ ] Full Openserve portal automation (selectors need configuration)
- [ ] Security audit (your action item)
- [ ] API integration for seamless data updates
- [ ] Sales funnel visualisation
- [ ] Rumertile dealer expansion
- [ ] Marketing demo video (Stephanie's action item)

## 5. My Action Items (from meeting)

### Immediate (This Week)
1. **Automate data extraction from Openserve**
   - Configure Puppeteer selectors for the Openserve UPP portal
   - Set up scheduled runs at 8 AM, 12 PM, and 5 PM
   - Implement duplicate detection and error handling
   - Deploy via GitHub Actions for reliability

2. **API integration for seamless data updates**
   - Investigate Openserve API availability as alternative to scraping
   - If API available: build direct integration
   - If no API: optimise Puppeteer automation with retry logic

### Short-Term (Next 2 Weeks)
3. **Gather dealer feedback**
   - Distribute user guides to pilot dealers
   - Collect feedback on dashboard functionality and UX
   - Document feature requests and pain points

4. **Implement feedback-driven improvements**
   - Address any critical usability issues
   - Add sales funnel visualisation if requested

### Medium-Term (Next Month)
5. **Rumertile dealer expansion**
   - Assess system readiness for additional dealer network
   - Ensure multi-dealer architecture scales appropriately

## 6. Your Action Item - Security Audit

For the security audit, here's what I recommend reviewing:

### Areas to Audit
1. **Supabase RLS Policies** - Verify row-level security on all tables
2. **Authentication Flow** - Review login, session management, role assignment
3. **Data Encryption** - ID numbers, personal information at rest and in transit
4. **API Key Management** - Anon key exposure, service role key protection
5. **CORS & Network Security** - Netlify headers, Supabase network policies
6. **Input Validation** - SQL injection, XSS prevention
7. **Audit Logging** - Track who accessed/modified what data

### Access I Can Provide
- Full GitHub repository access
- Supabase project access (read-only or admin as needed)
- Netlify deployment access
- Database schema documentation
- All migration scripts

## 7. Repository & Documentation

| Resource | Location |
|----------|----------|
| **GitHub Repo** | github.com/dylanayronrodgers-creator/dealerdashboard |
| **Live Site** | https://steady-vacherin-437f82.netlify.app/ |
| **Database** | Supabase project: xitiatikzlzcswakgevy |
| **User Guides** | /guides/ directory (Admin, Agent, Dealer) |
| **CSV Sync Docs** | OPENSERVE_CSV_SYNC_SETUP.md |
| **Schema** | /migrations/ directory (23 migration files) |
| **README** | Full setup instructions in README.md |

## 8. Attached Documentation

I've compiled a complete technical export package that includes:
- Full system architecture documentation
- Database schema and all migrations
- Security configuration details
- Automation setup guide
- User guides for all three dashboard portals

Please let me know if you need access to any of the above, or if you'd like to schedule a walkthrough of the system. Happy to demo the full platform at your convenience.

Kind regards,
**Dylan Rodgers**

---

*This email was prepared on 6 February 2026 following the ad-hoc meeting regarding the Openserve Dealer Dashboard.*
