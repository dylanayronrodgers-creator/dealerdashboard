// Openserve Portal - Automated CSV Download & Import
// Downloads order status CSV and updates Supabase database

require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const OPENSERVE_URL = 'https://partners.openserve.co.za';
const OPENSERVE_LOGIN_URL = 'https://openserveapp.b2clogin.com/efb1320a-d627-4304-b0ca-2e84b7039c2e/b2c_1_signin1_upp/oauth2/v2.0/authorize';
const OPENSERVE_USERNAME = process.env.OPENSERVE_USERNAME;
const OPENSERVE_PASSWORD = process.env.OPENSERVE_PASSWORD;
const DOWNLOAD_PATH = path.join(__dirname, '../downloads');

// Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_PATH)) {
    fs.mkdirSync(DOWNLOAD_PATH, { recursive: true });
}

/**
 * Download CSV from Openserve portal
 */
async function downloadOpenserveCSV() {
    console.log('🚀 Starting Openserve CSV download...');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        // Set download behavior
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: DOWNLOAD_PATH
        });
        
        // 1. Navigate to main portal (will redirect to Azure AD B2C login)
        console.log('📝 Navigating to Openserve portal...');
        await page.goto(OPENSERVE_URL, { waitUntil: 'networkidle2' });
        
        // Wait for redirect to Azure AD B2C login page
        await page.waitForTimeout(2000);
        
        // 2. Handle Azure AD B2C login form
        console.log('🔐 Filling Azure AD B2C login form...');
        
        // Wait for email input (Azure AD B2C uses specific IDs)
        await page.waitForSelector('#signInName, #email, input[type="email"]', { timeout: 15000 });
        await page.type('#signInName, #email, input[type="email"]', OPENSERVE_USERNAME);
        
        // Wait for password input
        await page.waitForSelector('#password, input[type="password"]', { timeout: 5000 });
        await page.type('#password, input[type="password"]', OPENSERVE_PASSWORD);
        
        // 3. Submit login and wait for redirect back to portal
        console.log('🚀 Submitting login...');
        await Promise.all([
            page.click('#next, button[type="submit"], .buttons button'),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
        ]);
        
        console.log('✅ Logged in successfully');
        
        // Wait for portal to fully load after OAuth redirect
        await page.waitForTimeout(3000);
        
        // 4. Navigate to orders/reports page
        console.log('📊 Navigating to orders page...');
        // Try common paths for orders/reports
        const ordersPaths = [
            '/orders',
            '/reports',
            '/dashboard/orders',
            '/partner/orders'
        ];
        
        let ordersPageFound = false;
        for (const path of ordersPaths) {
            try {
                await page.goto(`${OPENSERVE_URL}${path}`, { waitUntil: 'networkidle2', timeout: 10000 });
                // Check if page loaded successfully (not 404)
                const title = await page.title();
                if (!title.toLowerCase().includes('not found') && !title.toLowerCase().includes('404')) {
                    console.log(`✅ Found orders page at: ${path}`);
                    ordersPageFound = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!ordersPageFound) {
            console.warn('⚠️ Could not find orders page automatically. Using main portal page.');
            await page.goto(OPENSERVE_URL, { waitUntil: 'networkidle2' });
        }
        
        // Wait a moment for page to load
        await page.waitForTimeout(2000);
        
        // 5. Click download/export button
        console.log('⬇️ Looking for download/export button...');
        
        // Wait for page to fully load
        await page.waitForTimeout(2000);
        
        // Try multiple possible selectors for download button
        const downloadSelectors = [
            // Text-based selectors
            'button:has-text("Download")',
            'button:has-text("Export")',
            'button:has-text("CSV")',
            'button:has-text("Excel")',
            'a:has-text("Download")',
            'a:has-text("Export")',
            // Class-based selectors
            '.download-button',
            '.export-button',
            '.btn-download',
            '.btn-export',
            // ID-based selectors
            '#download-csv',
            '#export-csv',
            '#download',
            '#export',
            // Icon-based (common patterns)
            'button[title*="Download"]',
            'button[title*="Export"]',
            'button[aria-label*="Download"]',
            'button[aria-label*="Export"]'
        ];
        
        let downloaded = false;
        
        // First, try to find and click the button
        for (const selector of downloadSelectors) {
            try {
                const elements = await page.$$(selector);
                if (elements.length > 0) {
                    console.log(`✅ Found download button with selector: ${selector}`);
                    await elements[0].click();
                    downloaded = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!downloaded) {
            // If no button found, take a screenshot for debugging
            const screenshotPath = path.join(DOWNLOAD_PATH, 'debug-screenshot.png');
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 Screenshot saved to: ${screenshotPath}`);
            
            // Also save the page HTML for inspection
            const html = await page.content();
            const htmlPath = path.join(DOWNLOAD_PATH, 'debug-page.html');
            fs.writeFileSync(htmlPath, html);
            console.log(`📄 Page HTML saved to: ${htmlPath}`);
            
            throw new Error('Could not find download button. Check debug-screenshot.png and debug-page.html in downloads folder.');
        }
        
        // Wait for download to complete
        console.log('⏳ Waiting for download to complete...');
        await page.waitForTimeout(5000);
        
        // Find the downloaded file
        const files = fs.readdirSync(DOWNLOAD_PATH)
            .filter(f => f.endsWith('.csv') || f.endsWith('.xlsx'))
            .map(f => ({
                name: f,
                time: fs.statSync(path.join(DOWNLOAD_PATH, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);
        
        if (files.length === 0) {
            throw new Error('No CSV file found in downloads folder');
        }
        
        const csvFile = path.join(DOWNLOAD_PATH, files[0].name);
        console.log(`✅ Downloaded: ${files[0].name}`);
        
        return csvFile;
        
    } catch (error) {
        console.error('❌ Error downloading CSV:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

/**
 * Parse CSV file and extract order data
 */
function parseCSV(filePath) {
    console.log('📖 Parsing CSV file...');
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });
    
    console.log(`✅ Parsed ${records.length} records`);
    return records;
}

/**
 * Map CSV columns to database fields
 * Adjust these mappings based on actual CSV structure
 */
function mapCSVRecord(record) {
    return {
        order_number: record['Order Number'] || record['OrderNumber'] || record['order_number'],
        status: record['Status'] || record['Order Status'] || record['status'],
        client_name: record['Client Name'] || record['Customer Name'] || record['client_name'],
        address: record['Address'] || record['Installation Address'] || record['address'],
        install_date: record['Install Date'] || record['Installation Date'] || record['install_date'],
        account_number: record['Account Number'] || record['AccountNumber'] || record['account_number'],
        package_type: record['Package'] || record['Product'] || record['package'],
        notes: record['Notes'] || record['Comments'] || record['notes']
    };
}

/**
 * Update Supabase database with CSV data
 */
async function updateDatabase(records) {
    console.log('💾 Updating database...');
    
    let updated = 0;
    let notFound = 0;
    let errors = 0;
    
    for (const record of records) {
        try {
            const mapped = mapCSVRecord(record);
            
            if (!mapped.order_number) {
                console.warn('⚠️ Skipping record without order number:', record);
                continue;
            }
            
            // Update lead with order status
            const { data, error } = await supabase
                .from('leads')
                .update({
                    order_status: mapped.status,
                    account_number: mapped.account_number || null,
                    install_date: mapped.install_date || null,
                    notes: mapped.notes || null,
                    last_synced_at: new Date().toISOString()
                })
                .eq('order_number', mapped.order_number)
                .select();
            
            if (error) {
                console.error(`❌ Error updating ${mapped.order_number}:`, error.message);
                errors++;
            } else if (data && data.length > 0) {
                console.log(`✅ Updated order ${mapped.order_number}: ${mapped.status}`);
                updated++;
            } else {
                console.warn(`⚠️ Order not found in database: ${mapped.order_number}`);
                notFound++;
            }
            
        } catch (error) {
            console.error('❌ Error processing record:', error.message);
            errors++;
        }
    }
    
    console.log('\n📊 Sync Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⚠️ Not Found: ${notFound}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📝 Total Processed: ${records.length}`);
    
    return { updated, notFound, errors };
}

/**
 * Main sync function
 */
async function syncOpenserveOrders() {
    const startTime = Date.now();
    console.log('\n🔄 Starting Openserve sync...');
    console.log(`⏰ ${new Date().toLocaleString()}\n`);
    
    try {
        // 1. Download CSV
        const csvFile = await downloadOpenserveCSV();
        
        // 2. Parse CSV
        const records = parseCSV(csvFile);
        
        // 3. Update database
        const results = await updateDatabase(records);
        
        // 4. Clean up old CSV files (keep last 5)
        const files = fs.readdirSync(DOWNLOAD_PATH)
            .filter(f => f.endsWith('.csv'))
            .map(f => ({
                name: f,
                path: path.join(DOWNLOAD_PATH, f),
                time: fs.statSync(path.join(DOWNLOAD_PATH, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);
        
        // Delete old files
        files.slice(5).forEach(f => {
            fs.unlinkSync(f.path);
            console.log(`🗑️ Deleted old file: ${f.name}`);
        });
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✅ Sync completed in ${duration}s`);
        
        return results;
        
    } catch (error) {
        console.error('\n❌ Sync failed:', error.message);
        console.error(error.stack);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    syncOpenserveOrders()
        .then(() => {
            console.log('\n✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Script failed:', error.message);
            process.exit(1);
        });
}

module.exports = { syncOpenserveOrders, downloadOpenserveCSV, parseCSV, updateDatabase };
