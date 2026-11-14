// Real Chromium layout/interaction tests, with isolated test-only API fixtures.
// These never modify production rows or assert that mocked NAV proves live access.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const base=process.env.TEST_URL || 'http://localhost:3000';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const workspace='00000000-0000-4000-8000-000000000001';
const fixtureExpense={id:'00000000-0000-4000-8000-000000000002',amount_cents:'125050',category:'food',note:'Lunch with a long note to verify wrapping on small phones',spent_on:'2026-11-01',created_at:'2026-11-01T12:00:00Z'};
const fixtureInvestment={id:'00000000-0000-4000-8000-000000000003',amount_cents:'500000',kind:'contribution',units:'25',invested_on:'2026-10-01',note:'Monthly investment'};
let checks=0;
try{
  for(const width of [320,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      let body;
      if(path==='/api/health')body={database:'connected',schema:'ready',realtime:false};
      else if(path==='/api/workspaces')body={workspaces:[{id:workspace,name:'Personal'}]};
      else if(path==='/api/expenses')body={expenses:[fixtureExpense]};
      else if(path==='/api/investments')body={investments:[fixtureInvestment]};
      else if(path==='/api/fund')body={scheme_code:105758,name:'HDFC Mid Cap Fund Regular Growth',nav:210,nav_date:'2026-11-13',source:'TEST FIXTURE',fetched_at:'2026-11-14T10:00:00Z'};
      else if(path==='/api/fund/history')body={points:[{date:'2026-10-01',nav:200},{date:'2026-11-13',nav:210}]};
      else return route.fulfill({status:404,json:{error:'Unexpected fixture route'}});
      return route.fulfill({json:body});
    });
    await page.goto(base,{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'Watch your portfolio grow'}).waitFor();
    await page.getByText(fixtureExpense.note,{exact:true}).waitFor();
    const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:window.innerWidth}));
    assert(overflow.page<=overflow.viewport+1,`Horizontal overflow at ${width}px: ${JSON.stringify(overflow)}`);checks++;
    await page.getByRole('button',{name:'Add expense',exact:true}).click();
    assert(await page.locator('dialog[open]').isVisible());checks++;
    const amount=page.getByRole('textbox',{name:'Amount',exact:true});await amount.fill('250.50');
    if(width<600){assert(Number(await amount.evaluate(el=>getComputedStyle(el).fontSize.replace('px','')))>=16);checks++;}
    await page.locator('dialog[open]').getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('button',{name:'Add investment',exact:true}).click();
    assert(await page.locator('dialog[open]').isVisible());checks++;
    const dialogBounds=await page.locator('dialog[open]').boundingBox();assert(dialogBounds.x>=0&&dialogBounds.x+dialogBounds.width<=width+1);checks++;
    await page.locator('dialog[open]').getByRole('button',{name:'Close',exact:true}).click();
    if(width<600){
      const nav=page.getByRole('navigation',{name:'Main navigation'});
      assert.equal(await nav.evaluate(el=>getComputedStyle(el).position),'fixed');checks++;
      const button=nav.getByRole('button',{name:'Investment portfolio'});const bounds=await button.boundingBox();assert(bounds.height>=44);checks++;
      await button.click();
      await page.waitForFunction(()=>document.querySelector('nav button[aria-label="Investment portfolio"]')?.getAttribute('aria-current')==='location');
      assert.equal(await button.getAttribute('aria-current'),'location');checks++;
      const tableWidth=await page.locator('#transactions table').evaluate(el=>el.getBoundingClientRect().width);assert(tableWidth<=width);checks++;
    }
    const themeButton=page.getByRole('button',{name:'Switch to dark mode'});await themeButton.click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');checks++;
    assert.deepEqual(errors,[],`Client errors at ${width}px`);checks++;
    await mkdir('test-results',{recursive:true});
    await page.screenshot({path:`test-results/penny-${width}px.png`,fullPage:true});
    console.log(`PASS ${width}px: no overflow, dialogs, controls, portfolio, theme${width<600?', bottom navigation and card layout':''}`);
    await context.close();
  }
  console.log(`PASS ${checks} browser assertions across phone, tablet, and desktop viewports.`);
} finally {await browser.close();}
