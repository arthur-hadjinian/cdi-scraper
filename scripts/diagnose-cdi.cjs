const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = path.resolve('ROUND-2-ENGLISH/logs/diagnostic-20261013');
fs.mkdirSync(out, {recursive:true});
(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 const page = await browser.newPage();
 page.setDefaultNavigationTimeout(90000);
 const events=[];
 const started=Date.now();
 const record=(kind,value)=> {events.push({seconds:Math.round((Date.now()-started)/1000),kind,value});console.log(kind,JSON.stringify(value));};
 page.on('dialog',async d=>{record('dialog',d.message());await d.accept();});
 page.on('pageerror',e=>record('pageerror',e.message));
 page.on('console',m=>{if(m.text().startsWith('GEOCODER_DIAGNOSTIC'))record('geocoder',m.text());});
 page.on('requestfailed',r=>record('requestfailed',{url:r.url().split('?')[0],error:r.failure()?.errorText}));
 page.on('response',async r=>{
  if (['xhr','fetch'].includes(r.request().resourceType()) || /GeocodeService/.test(r.url()) || r.status()>=400) {
   const body=await r.text().catch(()=> '');
   const summary=body.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
   record('response',{url:r.url().split('?')[0],status:r.status(),snippet:summary.slice(0,650)});
  }
 });
 try {
 await page.goto('https://interactive.web.insurance.ca.gov/apex_extprd/f?p=119:1::::::',{waitUntil:'domcontentloaded'});
 for(const zip of ['90210, CA','91399, CA']) {
  if(zip!=='91506') await page.goto('https://interactive.web.insurance.ca.gov/apex_extprd/f?p=119:1::::::',{waitUntil:'domcontentloaded'});
  await page.selectOption('#P1_INSURANCE_TYPE','LIFE_ANU');
  await page.selectOption('#P1_LANGUAGES','ENGL');
  await page.selectOption('#P1_DISTANCE','8.0467');
  await page.locator('#P1_ZIP_CITY_STATE').fill(zip);
  await page.waitForFunction(()=> typeof window.google?.maps?.Geocoder === 'function');
  await page.evaluate(()=> {
    const proto=google.maps.Geocoder.prototype;
    const original=proto.geocode;
    proto.geocode=function(request,callback) {
      return original.call(this,request,(results,status)=> {
        console.log('GEOCODER_DIAGNOSTIC '+JSON.stringify({address:request.address,status,resultCount:results?.length||0,formatted:results?.[0]?.formatted_address,latitude:results?.[0]?.geometry?.location?.lat(),longitude:results?.[0]?.geometry?.location?.lng()}));
        if(callback)callback(results,status);
      });
    };
  });
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{document.documentElement.dataset.cdiWait='1';});
  record('search',zip);
  await page.locator('#runSearch').click({noWaitAfter:true});
  let snapshot={};
  for(let i=0;i<18;i++) {
   await page.waitForTimeout(5000);
   snapshot=await page.evaluate(()=>({marker:document.documentElement.dataset.cdiWait||'',pagination:document.querySelector('.a-IRR-pagination-label')?.textContent||'',agentLinks:[...document.querySelectorAll('a')].filter(a=>a.textContent.includes('Check A License')).length,alert:document.querySelector('.t-Alert-content')?.textContent||'',text:document.body.innerText.slice(-2200)})).catch(()=>({navigating:true}));
   if(snapshot.pagination||snapshot.alert||events.some(e=>e.kind==='dialog'&&e.seconds>Math.round((Date.now()-started)/1000)-6))break;
  }
  record('snapshot',{zip,...snapshot});
  fs.writeFileSync(path.join(out,zip+'.html'),await page.content());
 }
 fs.writeFileSync(path.join(out,'events.json'),JSON.stringify(events,null,2));
 } finally { fs.writeFileSync(path.join(out,'events.json'),JSON.stringify(events,null,2)); await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
