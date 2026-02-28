const puppeteer = require('puppeteer');

(async () => {
    let browser;
    try {
        console.log('🚀 Starting Document Anomalies E2E Testing...');

        // Launch browser
        browser = await puppeteer.launch({
            headless: "new" // Running in background
        });
        const page = await browser.newPage();

        // Random credentials
        const rnd = Math.floor(Math.random() * 1000000);
        const email = `test_anomaly_${rnd}@example.com`;
        const password = 'Password123!';
        const name = `Anomaly Test User ${rnd}`;

        console.log('👤 Registering temporary test user...');
        await page.goto('http://localhost:5173/register');
        await page.waitForSelector('input[name="name"]', { visible: true });

        await page.type('input[name="name"]', name);
        await page.type('input[name="email"]', email);
        await page.type('input[name="password"]', password);
        await page.type('input[name="confirmPassword"]', password);
        await page.click('button[type="submit"]');

        // Wait until we reach dashboard
        console.log('⏳ Waiting for dashboard...');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        if (!page.url().includes('/docs')) {
            await page.goto('http://localhost:5173/docs');
        }

        console.log('📝 Creating a new document...');
        await page.waitForSelector('button', { visible: true });

        // Auto-accept alert if triggered somehow
        page.on('dialog', async dialog => {
            await dialog.accept();
        });

        const docInputSelector = 'input[placeholder="New document title"]';
        await page.waitForSelector(docInputSelector, { visible: true });
        await page.type(docInputSelector, `Test Anomaly Doc ${rnd}`);

        // Find the "Create" button
        const buttons = await page.$$('button[type="submit"]');
        for (const btn of buttons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text.includes('Create') || text.includes('New Document')) {
                await btn.click();
                break;
            }
        }

        // Wait to navigate to the Editor
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        const editorUrl = page.url();
        console.log(`📄 Editor opened safely: ${editorUrl}`);

        // Wait for TipTap editor content editable area
        await page.waitForSelector('.ProseMirror', { visible: true });

        // Wait an extra 2 seconds to ensure Y.js and Socket.IO are fully connected
        await new Promise(r => setTimeout(r, 2000));

        const testText = `ANOMALY_TEST_DATA_${rnd}`;
        console.log(`✍️ Typing test data into document: "${testText}"`);

        await page.focus('.ProseMirror');
        await page.keyboard.type(testText);

        // Test Auto-Save UI Glitch & Timer
        console.log('⏳ Waiting 12 seconds to ensure auto-save triggers...');
        await new Promise(r => setTimeout(r, 12000));

        // Refresh simulation (Test for completely vanished, or duplicated data on load)
        console.log('🔄 Simulating page refresh (checking persistence & duplication)...');
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForSelector('.ProseMirror', { visible: true });
        await new Promise(r => setTimeout(r, 3000)); // wait for socket & y.js to sync contents

        let content = await page.evaluate(() => document.querySelector('.ProseMirror').innerText);

        // Check 1: Data vanished?
        if (!content.includes(testText)) {
            throw new Error(`TEST FAILED: Data vanished! Expected to find "${testText}" but it was missing.`);
        }

        // Check 2: Data duplicated?
        const occurrences = content.split(testText).length - 1;
        if (occurrences > 1) {
            throw new Error(`TEST FAILED: Data duplicated! Found "${testText}" ${occurrences} times instead of 1.`);
        }

        console.log('✅ Persistence and Duplication passed: Data retrieved perfectly once.');

        // Test Deletion Reverting
        console.log('🗑️ Deleting all text...');

        // Select all and delete (Ctrl+A then Backspace)
        await page.focus('.ProseMirror');
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');

        console.log('⏳ Waiting 12 seconds for auto-save of deletion...');
        await new Promise(r => setTimeout(r, 12000));

        console.log('🔄 Simulating another refresh to verify deletion persistence...');
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForSelector('.ProseMirror', { visible: true });
        await new Promise(r => setTimeout(r, 3000)); // wait for socket & y.js

        content = await page.evaluate(() => document.querySelector('.ProseMirror').innerText);

        // Check 3: Deleted data came back?
        if (content.includes(testText)) {
            throw new Error(`TEST FAILED: Deleted data came back after refresh! Found "${testText}" despite deleting it.`);
        }

        console.log('✅ Deletion persistence passed: Deleted data stayed deleted.');

        console.log('🎉 ALL ANOMALY TESTS PASSED SUCCESSFULLY! The root causes are fixed.');

    } catch (error) {
        console.error(`\n❌ TEST FAILED: ${error.message}`);
        process.exitCode = 1;
    } finally {
        if (browser) await browser.close();
    }
})();
