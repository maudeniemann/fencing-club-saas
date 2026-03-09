// Targeted popover scraper — fetches booking details for a sample of private lessons
// Uses the correct relative URL path: /Scheduling/Reservation/PrivateReservationDetails/{uuid}

import { chromium, type Page, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://dynamo-fencing.mylessonschedule.com';
const LOGIN_EMAIL = 'lukaseichhorn82@gmail.com';
const LOGIN_PASSWORD = 'Lukas77fencing!';
const DATA_DIR = path.join(__dirname, 'data');

interface CalendarEvent {
  date: string;
  text: string;
  start_time: string;
  end_time: string;
  student_name: string;
  popover_ref: string;
  instructor_or_location: string;
  year: number;
  css_classes: string;
  details?: string;
}

function saveJSON(filename: string, data: unknown) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
  console.log(`  Saved ${filename}`);
}

async function login(page: Page): Promise<boolean> {
  console.log('Navigating to login page...');
  await page.goto(`${BASE_URL}/Identity/Account/Login`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  const emailEl = await page.$('input[name="Input.Email"]');
  const passEl = await page.$('input[name="Input.Password"]');
  if (!emailEl || !passEl) {
    console.error('Login form not found');
    return false;
  }
  await emailEl.fill(LOGIN_EMAIL);
  await passEl.fill(LOGIN_PASSWORD);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL(
      (url) => !url.toString().includes('/Login') && !url.toString().includes('/Account'),
      { timeout: 15000 }
    );
    console.log(`  Logged in! → ${page.url()}`);
    await page.waitForTimeout(2000);
    return true;
  } catch {
    console.error('Login failed');
    return false;
  }
}

async function main() {
  console.log('=== TARGETED POPOVER SCRAPER ===\n');

  // Load existing calendar events
  const rawPath = path.join(DATA_DIR, 'calendar-events-raw.json');
  if (!fs.existsSync(rawPath)) {
    console.error('calendar-events-raw.json not found. Run full scraper first.');
    process.exit(1);
  }
  const allEvents: CalendarEvent[] = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
  const privateLessons = allEvents.filter(
    (ev) => ev.start_time && ev.student_name && ev.popover_ref &&
            ev.css_classes.includes('remote-popover-private')
  );
  console.log(`Loaded ${allEvents.length} events, ${privateLessons.length} private lessons with popover refs\n`);

  // Sample: take up to 200 events (spread across different instructors)
  const byInstructor = new Map<string, CalendarEvent[]>();
  for (const ev of privateLessons) {
    const key = ev.instructor_or_location;
    if (!byInstructor.has(key)) byInstructor.set(key, []);
    byInstructor.get(key)!.push(ev);
  }

  const sample: CalendarEvent[] = [];
  const MAX_TOTAL = 200;
  const perInstructor = Math.max(10, Math.floor(MAX_TOTAL / byInstructor.size));
  for (const [instructor, events] of byInstructor) {
    // Take evenly spaced samples
    const step = Math.max(1, Math.floor(events.length / perInstructor));
    let count = 0;
    for (let i = 0; i < events.length && count < perInstructor; i += step) {
      sample.push(events[i]);
      count++;
    }
  }
  console.log(`Sampling ${sample.length} events across ${byInstructor.size} instructors\n`);

  // Launch browser and login
  const browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    const loggedIn = await login(page);
    if (!loggedIn) {
      console.error('Login failed.');
      process.exit(1);
    }

    // First, navigate to the InstructorReservations page to establish session context
    await page.goto(`${BASE_URL}/Scheduling/InstructorReservations`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // Fetch popover details using the correct relative path
    console.log('\n=== FETCHING POPOVER DETAILS ===\n');
    let successCount = 0;
    let failCount = 0;
    const results: Array<{ popover_ref: string; instructor: string; student: string; date: string; details: string }> = [];

    for (let i = 0; i < sample.length; i++) {
      const ev = sample[i];

      // Correct URL: relative to /Scheduling/ base path
      const popoverUrl = `${BASE_URL}/Scheduling/Reservation/PrivateReservationDetails/${ev.popover_ref}`;

      try {
        const response = await page.request.get(popoverUrl, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });

        if (response.ok()) {
          const details = await response.text();
          const isFullPage = details.includes('<!DOCTYPE html>') || details.includes('<html');

          if (!isFullPage && details.trim().length > 0) {
            results.push({
              popover_ref: ev.popover_ref,
              instructor: ev.instructor_or_location,
              student: ev.student_name,
              date: ev.date,
              details,
            });
            successCount++;
          } else if (isFullPage) {
            // Try without the /Scheduling/ prefix as fallback
            const fallbackUrl = `${BASE_URL}/Reservation/PrivateReservationDetails/${ev.popover_ref}`;
            const fallbackResponse = await page.request.get(fallbackUrl, {
              headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (fallbackResponse.ok()) {
              const fallbackDetails = await fallbackResponse.text();
              const isFP = fallbackDetails.includes('<!DOCTYPE html>') || fallbackDetails.includes('<html');
              if (!isFP && fallbackDetails.trim().length > 0) {
                results.push({
                  popover_ref: ev.popover_ref,
                  instructor: ev.instructor_or_location,
                  student: ev.student_name,
                  date: ev.date,
                  details: fallbackDetails,
                });
                successCount++;
              } else {
                failCount++;
              }
            } else {
              failCount++;
            }
          } else {
            failCount++;
          }
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }

      if ((i + 1) % 20 === 0) {
        console.log(`  Progress: ${i + 1}/${sample.length} (${successCount} success, ${failCount} fail)`);
      }

      // If first 20 all fail, try click-based approach instead
      if (i === 19 && successCount === 0) {
        console.log('\n  Direct URL approach failed. Trying click-based popover extraction...');
        break;
      }
    }

    console.log(`\n  Final: ${successCount} popover details fetched, ${failCount} failed`);

    // If URL approach failed, try click-based approach
    if (successCount === 0) {
      console.log('\n=== CLICK-BASED POPOVER EXTRACTION ===\n');

      // Navigate to a recent year for Lukas
      await page.goto(
        `${BASE_URL}/Scheduling/InstructorReservations?InstructorId=aef9a381-90d4-402d-82ca-4546aa313b7d&Year=2025&CompetitionRegion=3`,
        { waitUntil: 'domcontentloaded', timeout: 30000 }
      );
      await page.waitForTimeout(3000);

      // Click on private lesson events and extract popover content
      const privateButtons = await page.$$('a.remote-popover-private.button');
      console.log(`  Found ${privateButtons.length} private lesson events on page`);

      const clickSample = Math.min(50, privateButtons.length);
      for (let i = 0; i < clickSample; i++) {
        try {
          await privateButtons[i].click();
          // Wait for popover to appear
          await page.waitForSelector('.popover-body', { timeout: 5000 });
          await page.waitForTimeout(1000); // Wait for AJAX content to load

          const popoverContent = await page.$eval('.popover-body', (el) => el.innerHTML);
          if (popoverContent && popoverContent.trim().length > 10) {
            const ref = await privateButtons[i].getAttribute('data-remote-ref');
            results.push({
              popover_ref: ref || '',
              instructor: 'Lukas Eichhorn',
              student: '',
              date: '',
              details: popoverContent,
            });
            successCount++;
          }

          // Close popover by clicking elsewhere
          await page.click('body', { position: { x: 10, y: 10 } });
          await page.waitForTimeout(500);
        } catch {
          // Popover didn't appear, continue
        }

        if ((i + 1) % 10 === 0) {
          console.log(`  Click progress: ${i + 1}/${clickSample} (${successCount} extracted)`);
        }
      }
    }

    // Save results
    saveJSON('popover-details.json', results);
    console.log(`\n  Total popover details extracted: ${results.length}`);

    // Analyze for pricing
    const pricesFound: string[] = [];
    for (const r of results) {
      const priceMatch = r.details.match(/\$\s*([\d,]+(?:\.\d{2})?)/g);
      if (priceMatch) {
        pricesFound.push(...priceMatch);
      }
    }
    if (pricesFound.length > 0) {
      console.log(`\n  PRICING DATA FOUND: ${pricesFound.length} price references`);
      console.log(`  Sample prices: ${[...new Set(pricesFound)].slice(0, 10).join(', ')}`);
      saveJSON('popover-prices.json', [...new Set(pricesFound)]);
    } else {
      console.log('\n  No pricing data found in popover details.');
      if (results.length > 0) {
        console.log('  Sample popover content (first 500 chars):');
        console.log('  ' + results[0].details.substring(0, 500));
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
