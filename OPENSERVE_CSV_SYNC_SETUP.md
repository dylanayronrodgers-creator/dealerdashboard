# Openserve CSV Sync - Setup Guide

## 🎯 Overview

Automated solution to download order status CSV from Openserve portal and sync with your Supabase database.

**No API needed!** Uses browser automation to login, download CSV, parse data, and update your database.

---

## 📋 What It Does

1. **Logs into Openserve portal** with your credentials
2. **Downloads the CSV/Excel file** automatically
3. **Parses the data** and extracts order information
4. **Updates your Supabase database** with latest statuses
5. **Runs automatically** every 2 hours (configurable)

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs:
- `puppeteer` - Browser automation
- `csv-parse` - CSV parsing
- `dotenv` - Environment variables

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Openserve Portal Credentials
OPENSERVE_PORTAL_URL=https://openserve-portal-url.com
OPENSERVE_USERNAME=your-username
OPENSERVE_PASSWORD=your-password
```

### 3. Customize CSV Mapping

Open `scripts/openserve-csv-sync.js` and update the `mapCSVRecord()` function to match your CSV columns:

```javascript
function mapCSVRecord(record) {
    return {
        order_number: record['Order Number'],      // ← Adjust column name
        status: record['Status'],                  // ← Adjust column name
        client_name: record['Client Name'],        // ← Adjust column name
        address: record['Address'],                // ← Adjust column name
        install_date: record['Install Date'],      // ← Adjust column name
        account_number: record['Account Number'],  // ← Adjust column name
        package_type: record['Package'],           // ← Adjust column name
        notes: record['Notes']                     // ← Adjust column name
    };
}
```

### 4. Update Portal Selectors

In `downloadOpenserveCSV()`, update these selectors to match the actual Openserve portal:

```javascript
// Login page selectors
await page.type('input[name="username"]', OPENSERVE_USERNAME);  // ← Update selector
await page.type('input[name="password"]', OPENSERVE_PASSWORD);  // ← Update selector
await page.click('button[type="submit"]');                      // ← Update selector

// Download button selector
const downloadSelectors = [
    'button:contains("Download")',    // ← Add actual button selector
    '.download-csv-button',           // ← Add actual button class
    '#export-orders'                  // ← Add actual button ID
];
```

### 5. Test Manually

```bash
npm run sync-openserve
```

You should see:
```
🚀 Starting Openserve CSV download...
📝 Logging in to Openserve portal...
✅ Logged in successfully
📊 Navigating to orders page...
⬇️ Downloading CSV...
✅ Downloaded: orders_2026-02-04.csv
📖 Parsing CSV file...
✅ Parsed 150 records
💾 Updating database...
✅ Updated order ORD-12345: Completed
...
📊 Sync Summary:
   ✅ Updated: 145
   ⚠️ Not Found: 3
   ❌ Errors: 2
✅ Sync completed in 12.34s
```

---

## ⚙️ Automated Sync Options

### Option 1: GitHub Actions (Recommended - Free!)

Already configured in `.github/workflows/sync-openserve.yml`

**Setup:**

1. Go to your GitHub repository → Settings → Secrets and variables → Actions
2. Add these secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `OPENSERVE_PORTAL_URL`
   - `OPENSERVE_USERNAME`
   - `OPENSERVE_PASSWORD`

3. Push to GitHub:
```bash
git add .
git commit -m "Add Openserve CSV sync automation"
git push
```

4. The workflow will run:
   - **Automatically** every 2 hours
   - **Manually** via Actions tab → "Sync Openserve Orders" → Run workflow

### Option 2: Cron Job (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add this line (runs every 2 hours)
0 */2 * * * cd /path/to/project && npm run sync-openserve >> /var/log/openserve-sync.log 2>&1
```

### Option 3: Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily, repeat every 2 hours
4. Action: Start a program
   - Program: `node`
   - Arguments: `C:\path\to\project\scripts\openserve-csv-sync.js`
   - Start in: `C:\path\to\project`

### Option 4: PM2 (Node.js Process Manager)

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'openserve-sync',
    script: 'scripts/openserve-csv-sync.js',
    cron_restart: '0 */2 * * *',  // Every 2 hours
    autorestart: false
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Enable on system boot
```

---

## 🔧 Customization

### Change Sync Frequency

**GitHub Actions:**
Edit `.github/workflows/sync-openserve.yml`:
```yaml
schedule:
  - cron: '0 */2 * * *'  # Every 2 hours
  - cron: '0 9 * * *'    # Daily at 9 AM
  - cron: '0 */4 * * *'  # Every 4 hours
```

### Add More Fields

Update `mapCSVRecord()` and your Supabase table:

```javascript
function mapCSVRecord(record) {
    return {
        // ... existing fields
        technician_name: record['Technician'],
        installation_type: record['Installation Type'],
        router_serial: record['Router Serial Number']
    };
}
```

### Filter Records

Add filtering in `updateDatabase()`:

```javascript
for (const record of records) {
    const mapped = mapCSVRecord(record);
    
    // Only process active orders
    if (mapped.status === 'Cancelled') continue;
    
    // Only process recent orders
    const orderDate = new Date(mapped.install_date);
    if (orderDate < new Date('2026-01-01')) continue;
    
    // ... update database
}
```

---

## 🐛 Troubleshooting

### "Could not find download button"

**Solution:** Inspect the Openserve portal and update selectors in `downloadOpenserveCSV()`:

```javascript
// Use browser DevTools to find the actual selector
const downloadButton = await page.$('button.your-actual-class');
```

### "Login failed"

**Possible causes:**
- Wrong credentials
- Portal has CAPTCHA
- Portal uses 2FA
- Selectors don't match

**Solution:** Run with `headless: false` to see what's happening:

```javascript
const browser = await puppeteer.launch({
    headless: false,  // Show browser
    slowMo: 100       // Slow down actions
});
```

### "Order not found in database"

**Cause:** Order number in CSV doesn't match database

**Solution:** Check order number format:
```javascript
// Add logging
console.log('CSV order:', mapped.order_number);
console.log('Database orders:', leads.map(l => l.order_number));
```

### CSV columns don't match

**Solution:** Download CSV manually first, check column names, update `mapCSVRecord()`:

```javascript
// Print all column names
console.log('CSV Columns:', Object.keys(records[0]));
```

---

## 📊 Monitoring

### View Logs

**GitHub Actions:**
- Go to Actions tab
- Click on latest "Sync Openserve Orders" run
- View logs

**Local:**
```bash
# View last sync
npm run sync-openserve

# Save to log file
npm run sync-openserve >> sync.log 2>&1
```

### Database Migration

Add `last_synced_at` column to track sync times:

```sql
ALTER TABLE leads 
ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE;
```

### Create Sync History Table

```sql
CREATE TABLE openserve_sync_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    records_processed INTEGER,
    records_updated INTEGER,
    records_not_found INTEGER,
    errors INTEGER,
    duration_seconds NUMERIC,
    csv_filename TEXT,
    status TEXT
);
```

Update script to log history:

```javascript
// After sync completes
await supabase.from('openserve_sync_history').insert({
    records_processed: records.length,
    records_updated: results.updated,
    records_not_found: results.notFound,
    errors: results.errors,
    duration_seconds: duration,
    csv_filename: path.basename(csvFile),
    status: 'success'
});
```

---

## 🔒 Security

### Protect Credentials

✅ **DO:**
- Use environment variables
- Add `.env` to `.gitignore`
- Use GitHub Secrets for Actions
- Use service role key (not anon key)

❌ **DON'T:**
- Commit credentials to Git
- Share `.env` file
- Use personal passwords in shared repos

### Secure Supabase

Enable Row Level Security (RLS):

```sql
-- Only allow service role to update
CREATE POLICY "Service role can update leads"
ON leads FOR UPDATE
TO service_role
USING (true);
```

---

## 📈 Next Steps

1. **Test the sync** - Run manually first
2. **Verify mappings** - Check CSV columns match
3. **Set up automation** - Choose GitHub Actions or cron
4. **Monitor results** - Check logs and database
5. **Customize as needed** - Add fields, filters, etc.

---

## 💡 Tips

- **Start with manual runs** to debug issues
- **Use headless: false** during development
- **Keep CSV files** for debugging (last 5 kept automatically)
- **Add notifications** - Send email/Slack on sync completion
- **Handle duplicates** - Use `ON CONFLICT` in Supabase
- **Validate data** - Check for missing/invalid values

---

## 🆘 Need Help?

Common issues and solutions documented above. If you need to customize further:

1. Share a sample CSV (blur sensitive data)
2. Share screenshot of Openserve portal
3. Share any error messages from logs

The script is fully functional and ready to use! Just need to configure the selectors for your specific Openserve portal.
