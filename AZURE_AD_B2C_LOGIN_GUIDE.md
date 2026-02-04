# Openserve Portal - Azure AD B2C Login Setup

## 🔐 Authentication Details

Openserve uses **Azure AD B2C OAuth 2.0** authentication, not a simple username/password form.

**Portal URL:** `https://partners.openserve.co.za`  
**Login URL:** `https://openserveapp.b2clogin.com/efb1320a-d627-4304-b0ca-2e84b7039c2e/b2c_1_signin1_upp/oauth2/v2.0/authorize`

---

## 🧪 Testing the Login Flow

### Step 1: Configure Credentials

Create `.env` file:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

OPENSERVE_USERNAME=your-email@example.com
OPENSERVE_PASSWORD=your-password
```

### Step 2: Run Test Script

```bash
npm run test-login
```

This will:
1. Open a **visible browser** (not headless)
2. Navigate to Openserve portal
3. Wait for Azure AD B2C redirect
4. Find and fill email field
5. Find and fill password field
6. Find and click submit button
7. Wait for redirect back to portal
8. Take screenshots for debugging

**Watch the browser** to see what happens at each step.

### Step 3: Inspect Results

The script will:
- **Print all form fields** it finds
- **Print all buttons** it finds
- **Take screenshots** at key points
- **Pause** so you can inspect the page

Check `downloads/` folder for:
- `logged-in.png` - Screenshot after successful login
- `error-screenshot.png` - Screenshot if login fails
- `debug-screenshot.png` - Screenshot from main sync script

---

## 🔧 Common Issues & Solutions

### Issue 1: "Could not find email field"

**Cause:** Azure AD B2C uses different field IDs/names

**Solution:** The test script will print all input fields. Update selectors in `openserve-csv-sync.js`:

```javascript
// Line ~61
await page.waitForSelector('#actual-field-id', { timeout: 15000 });
await page.type('#actual-field-id', OPENSERVE_USERNAME);
```

### Issue 2: "Could not find submit button"

**Cause:** Button selector doesn't match

**Solution:** Test script prints all buttons. Update selector:

```javascript
// Line ~71
await page.click('#actual-button-id');
```

### Issue 3: Login redirects but fails

**Possible causes:**
- **2FA/MFA enabled** - Script can't handle 2FA automatically
- **CAPTCHA** - Script can't solve CAPTCHAs
- **Session/cookie issues** - May need to handle cookies differently

**Solutions:**
- **Disable 2FA** for automation account (if possible)
- **Use a dedicated automation account** without 2FA
- **Contact Openserve** to ask about API access or automation-friendly login

### Issue 4: "Navigation timeout"

**Cause:** Page takes too long to load

**Solution:** Increase timeout:

```javascript
await page.waitForNavigation({ 
    waitUntil: 'networkidle2', 
    timeout: 60000  // Increase to 60 seconds
});
```

---

## 📋 What to Check After Test

### ✅ Successful Login Checklist

After running `npm run test-login`, verify:

1. **Browser opens** and navigates to portal
2. **Redirects to Azure AD B2C** login page
3. **Email field is filled** with your username
4. **Password field is filled** (shows dots/asterisks)
5. **Submit button is clicked** automatically
6. **Redirects back to portal** (URL shows `partners.openserve.co.za`)
7. **Screenshot shows logged-in page** with your account info

### ❌ If Login Fails

Check console output for:
- Which fields were found/not found
- Which buttons were found/not found
- Error messages
- Final URL (should be `partners.openserve.co.za`)

---

## 🎯 Next Steps After Successful Login

Once login works, you need to find the CSV download button:

### Step 1: Manually Login and Find Download

1. Login to `https://partners.openserve.co.za`
2. Navigate to orders/reports page
3. **Right-click the download button** → Inspect
4. Note the button's:
   - **ID** (e.g., `id="export-csv"`)
   - **Class** (e.g., `class="btn-download"`)
   - **Text** (e.g., "Download CSV")
   - **Parent elements**

### Step 2: Update Script with Correct Selector

Edit `scripts/openserve-csv-sync.js` around line ~121:

```javascript
const downloadSelectors = [
    '#your-actual-button-id',        // ← Add actual ID
    '.your-actual-button-class',     // ← Add actual class
    'button:has-text("Actual Text")'  // ← Add actual text
];
```

### Step 3: Find Orders Page Path

While logged in, check the URL of the orders page:
- Is it `/orders`?
- Is it `/reports`?
- Is it `/dashboard/orders`?
- Something else?

Update `scripts/openserve-csv-sync.js` around line ~83:

```javascript
const ordersPaths = [
    '/your-actual-orders-path',  // ← Add actual path
    '/orders',
    '/reports'
];
```

---

## 🔍 Debugging Tips

### Enable Verbose Logging

Run with visible browser:

```javascript
// In openserve-csv-sync.js, line ~35
const browser = await puppeteer.launch({
    headless: false,  // Show browser
    slowMo: 100,      // Slow down actions
    devtools: true    // Open DevTools
});
```

### Save Page HTML for Inspection

The script automatically saves HTML when download button not found:

```bash
# Check these files:
downloads/debug-screenshot.png
downloads/debug-page.html
```

Open `debug-page.html` in browser and search for download button.

### Check Network Requests

Add network logging:

```javascript
page.on('response', response => {
    if (response.url().includes('.csv') || response.url().includes('download')) {
        console.log('📥 Download URL:', response.url());
    }
});
```

---

## 🚨 Important Notes

### Azure AD B2C Limitations

- **Cannot bypass 2FA** - If account has 2FA, automation won't work
- **Cannot solve CAPTCHA** - If portal has CAPTCHA, automation won't work
- **Session expires** - May need to re-login periodically

### Recommended Approach

1. **Create dedicated automation account** without 2FA
2. **Contact Openserve support** - Ask if they have:
   - API access for partners
   - Automation-friendly login method
   - Scheduled email reports (easier than scraping)

### Alternative: Manual CSV Upload

If automation is too complex:

1. **Manually download CSV** from portal
2. **Upload to dashboard** via new "Import CSV" feature
3. **Dashboard parses and updates** database

Would you like me to build a CSV upload feature instead?

---

## 📞 Need Help?

Run the test script and share:
1. **Console output** (copy all text)
2. **Screenshots** from `downloads/` folder
3. **Any error messages**

I'll help debug and update the selectors!
