import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
 try{
  const reqPath=new URL(req.url,'http://localhost').pathname;
  const resolved=path.resolve(root,'.'+(reqPath==='/'?'/index.html':reqPath));
  if(!resolved.startsWith(root+path.sep)&&resolved!==root)throw Error('Forbidden');
  const data=await readFile(resolved);
  res.writeHead(200,{'Content-Type':mime[path.extname(resolved)]||'application/octet-stream','Cache-Control':'no-cache'});
  res.end(data);
 }catch {res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({serviceWorkers:'allow'});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 // Cloud client is not needed for local UI tests. Avoid relying on an external CDN.
 await page.route('https://esm.sh/**',route=>route.abort());
 await page.goto('http://127.0.0.1:'+port+'/#home');
 await page.getByText('바로 공부 시작').waitFor();
 await page.locator('#homeSubject').selectOption('수학');
 await page.locator('[data-action="focus-quick-start"]').click();
 await page.waitForURL('**/#focus');
 await page.locator('#timerDisplay').waitFor();
 await page.waitForTimeout(1250);
 await page.locator('[data-action="timer-stop"]').click();
 await page.locator('.session-row').first().waitFor();
 assert.match(await page.locator('.session-row').first().textContent(),/수학/);
 await page.locator('a[data-nav="settings"]').first().click();
 await page.waitForURL('**/#settings');
 await page.locator('#prefsForm [name=theme]').selectOption('violet');
 await page.locator('#prefsForm [name=dailyGoal]').fill('120');
 await page.locator('#prefsForm [name=examDate]').fill('2026-11-19');
 await page.locator('#prefsForm button[type=submit]').click();
 const current=await page.evaluate(()=>JSON.parse(localStorage.getItem('focus.personal.v1')));
 assert.equal(current.preferences.theme,'violet');
 assert.equal(current.preferences.examDate,'2026-11-19');
 assert.equal(current.sessions.length,1);
 await page.reload();
 await page.locator('#prefsForm [name=theme]').waitFor();
 assert.equal(await page.locator('#prefsForm [name=theme]').inputValue(),'violet');
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#prefsForm [name=theme]').waitFor({timeout:15000});
 assert.equal(await page.locator('#prefsForm [name=theme]').inputValue(),'violet');
 assert.deepEqual(errors,[],'Browser JavaScript errors: '+errors.join('; '));
 console.log('Browser smoke tests passed: home start, timer save, preferences, reload, offline shell.');
 await context.close();
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
