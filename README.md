# Axxess Dealer Portal - Openserve Orders

A comprehensive dealer dashboard for managing Openserve fibre orders at Axxess. Features agent management, lead tracking, order processing, and mass import capabilities.

## Features

- **Admin Dashboard** 
  - View all leads and orders across agents
  - Manage agents (create, view, remove)
  - Manage Openserve packages
  - Return leads/orders to agents with feedback
  - Analytics and reporting

- **Agent Dashboard**
  - Add and manage personal leads
  - Convert leads to orders
  - Track order status
  - Mass import leads via CSV
  - View returned items from admin
  - Send items to admin for review

- **Authentication**
  - Secure login with Supabase Auth
  - Role-based access (Admin/Agent)
  - Protected routes

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings > API

### 2. Configure Database

1. Go to SQL Editor in your Supabase dashboard
2. Copy the contents of `supabase-schema.sql`
3. Run the SQL to create tables, policies, and default packages

### 3. Configure Application

1. Open `js/supabase-config.js`
2. Update the SUPABASE_CONFIG object at the top of the file:
   ```javascript
   const SUPABASE_CONFIG = {
       url: 'https://your-project.supabase.co',
       anonKey: 'your-anon-key-here'
   };
   ```
3. **That's it!** All dashboards will automatically use these credentials. No need to configure each dashboard separately.

### 4. Create Admin User

1. Go to Authentication > Users in Supabase dashboard
2. Click "Add User" and create your admin account
3. Run this SQL to make yourself admin:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
   ```

### 5. Deploy to Netlify

1. Push code to GitHub
2. Connect repository to Netlify
3. Deploy with default settings (no build command needed)

Or deploy directly:
1. Drag and drop the project folder to Netlify

## File Structure

```
├── index.html              # Landing page
├── login.html              # Login page
├── admin-dashboard.html    # Admin dashboard
├── agent-dashboard.html    # Agent dashboard
├── js/
│   ├── supabase-config.js  # Supabase configuration
│   ├── auth.js             # Authentication logic
│   ├── admin-dashboard.js  # Admin functionality
│   └── agent-dashboard.js  # Agent functionality
├── supabase-schema.sql     # Database schema
├── package.json            # Project metadata
└── README.md               # This file
```

## CSV Import Format

For mass importing leads, use this CSV format:

```csv
first_name,last_name,email,phone,address,package_name,notes
John,Doe,john@example.com,0821234567,123 Main St,Fibre 50Mbps,Interested in fast internet
```

**Required columns:** first_name, last_name, email, phone, address
**Optional columns:** package_name, notes

## Lead Status Flow

1. **New** - Fresh lead, not yet contacted
2. **Contacted** - Initial contact made
3. **Qualified** - Lead is qualified and interested
4. **Converted** - Lead converted to order
5. **Lost** - Lead not interested or unreachable
6. **Returned** - Returned by admin for review

## Order Status Flow

1. **Pending** - Order created, awaiting processing
2. **Processing** - Order being processed
3. **Scheduled** - Installation scheduled
4. **Completed** - Installation complete
5. **Cancelled** - Order cancelled
6. **Returned** - Returned by admin for review

## Technologies Used

- HTML5, CSS3, JavaScript (ES6+)
- Tailwind CSS (via CDN)
- Chart.js for analytics
- Supabase (PostgreSQL + Auth)

## Support

For issues or questions, contact your system administrator.

---

© 2026 Axxess. Powered by Openserve.
