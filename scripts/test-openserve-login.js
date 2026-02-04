// Test script to debug Openserve Azure AD B2C login
// Run with: node scripts/test-openserve-login.js

require('dotenv').config();
const puppeteer = require('puppeteer');

const OPENSERVE_URL = 'https://partners.openserve.co.za';
const OPENSERVE_USERNAME = process.env.OPENSERVE_USERNAME;
const OPENSERVE_PASSWORD = process.env.OPENSERVE_PASSWORD;

async function testLogin() {
    console.log('🧪 Testing Openserve login flow...\n');
    
    const browser = await puppeteer.launch({
        headless: false,  // Show browser for debugging
        slowMo: 100,      // Slow down actions
        args: ['--start-maximized']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    try {
        // 1. Navigate to portal
        console.log('📝 Step 1: Navigating to Openserve portal...');
        await page.goto(OPENSERVE_URL, { waitUntil: 'networkidle2' });
        console.log('   Current URL:', page.url());
        
        // Wait for redirect to Azure AD B2C
        await page.waitForTimeout(3000);
        console.log('   After redirect:', page.url());
        
        // 2. Find and fill email field
        console.log('\n🔐 Step 2: Looking for email field...');
        
        // Try different selectors
        const emailSelectors = ['#signInName', '#email', 'input[type="email"]', 'input[name="loginfmt"]'];
        let emailField = null;
        
        for (const selector of emailSelectors) {
            try {
                emailField = await page.$(selector);
                if (emailField) {
                    console.log(`   ✅ Found email field: ${selector}`);
                    await page.type(selector, OPENSERVE_USERNAME);
                    console.log(`   ✅ Entered email: ${OPENSERVE_USERNAME}`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!emailField) {
            console.log('   ❌ Could not find email field');
            console.log('   Available input fields:');
            const inputs = await page.$$('input');
            for (let i = 0; i < inputs.length; i++) {
                const type = await inputs[i].evaluate(el => el.type);
                const id = await inputs[i].evaluate(el => el.id);
                const name = await inputs[i].evaluate(el => el.name);
                console.log(`     - Input ${i}: type="${type}", id="${id}", name="${name}"`);
            }
        }
        
        await page.waitForTimeout(1000);
        
        // 3. Find and fill password field
        console.log('\n🔑 Step 3: Looking for password field...');
        
        const passwordSelectors = ['#password', 'input[type="password"]', 'input[name="passwd"]'];
        let passwordField = null;
        
        for (const selector of passwordSelectors) {
            try {
                passwordField = await page.$(selector);
                if (passwordField) {
                    console.log(`   ✅ Found password field: ${selector}`);
                    await page.type(selector, OPENSERVE_PASSWORD);
                    console.log('   ✅ Entered password');
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!passwordField) {
            console.log('   ❌ Could not find password field');
        }
        
        await page.waitForTimeout(1000);
        
        // 4. Find and click submit button
        console.log('\n🚀 Step 4: Looking for submit button...');
        
        const submitSelectors = [
            '#next',
            'button[type="submit"]',
            'input[type="submit"]',
            '.buttons button',
            'button:has-text("Sign in")',
            'button:has-text("Next")'
        ];
        
        let submitButton = null;
        
        for (const selector of submitSelectors) {
            try {
                submitButton = await page.$(selector);
                if (submitButton) {
                    console.log(`   ✅ Found submit button: ${selector}`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!submitButton) {
            console.log('   ❌ Could not find submit button');
            console.log('   Available buttons:');
            const buttons = await page.$$('button');
            for (let i = 0; i < buttons.length; i++) {
                const text = await buttons[i].evaluate(el => el.textContent);
                const id = await buttons[i].evaluate(el => el.id);
                const className = await buttons[i].evaluate(el => el.className);
                console.log(`     - Button ${i}: text="${text.trim()}", id="${id}", class="${className}"`);
            }
        }
        
        console.log('\n⏸️  Pausing for 10 seconds so you can inspect the page...');
        console.log('   Check if login form is visible and fields are filled correctly.');
        await page.waitForTimeout(10000);
        
        if (submitButton) {
            console.log('\n🎯 Step 5: Clicking submit button...');
            await submitButton.click();
            
            console.log('   ⏳ Waiting for navigation...');
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
            
            console.log('   ✅ Navigation complete');
            console.log('   Final URL:', page.url());
            
            // Check if we're back at the portal
            if (page.url().includes('partners.openserve.co.za')) {
                console.log('\n✅ SUCCESS! Logged in to Openserve portal');
                
                // Take screenshot of logged-in page
                await page.screenshot({ path: 'downloads/logged-in.png', fullPage: true });
                console.log('   📸 Screenshot saved: downloads/logged-in.png');
                
                // Wait to inspect
                console.log('\n⏸️  Pausing for 15 seconds to inspect logged-in page...');
                await page.waitForTimeout(15000);
            } else {
                console.log('\n⚠️  Login may have failed - not on expected URL');
            }
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        
        // Take screenshot on error
        await page.screenshot({ path: 'downloads/error-screenshot.png', fullPage: true });
        console.log('📸 Error screenshot saved: downloads/error-screenshot.png');
    } finally {
        console.log('\n🏁 Test complete. Browser will close in 5 seconds...');
        await page.waitForTimeout(5000);
        await browser.close();
    }
}

// Run test
testLogin()
    .then(() => {
        console.log('\n✅ Test script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test script failed:', error.message);
        process.exit(1);
    });
