import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
import {observeGeocoder,validateLocation,type LocationEvidence} from '../src/location-check.js';
const folder='ROUND-2-ENGLISH/scan-plan';
const plan=JSON.parse(readFileSync(folder+'/expansion-plan-preview.json','utf8'));
const selected=plan.initial.filter((p:any)=>['expansion:91759','expansion:city-agua-dulce'].includes(p.id));
const browser=await chromium.launch({channel:'chrome',headless:true});
const results:any[]=[];
try{
  const page=await browser.newPage();page.on('dialog',async d=>{results.push({dialog:d.message()});await d.accept();});
  for(const center of selected){
    await page.goto('https://interactive.web.insurance.ca.gov/apex_extprd/f?p=119:1::::::',{waitUntil:'domcontentloaded',timeout:90000});
    let evidence:LocationEvidence|undefined;
    const detach=await observeGeocoder(page,e=>{evidence=e;});
    try{
      await page.selectOption('#P1_INSURANCE_TYPE','LIFE_ANU');await page.selectOption('#P1_LANGUAGES','ENGL');await page.selectOption('#P1_DISTANCE','8.0467');
      await page.locator('#P1_ZIP_CITY_STATE').fill(center.input);
      await page.locator('#runSearch').click({noWaitAfter:true});
      await page.waitForFunction(()=>!!document.querySelector('.a-IRR-pagination-label')?.textContent||document.body.innerText.includes('NO AGENTS WERE FOUND'),undefined,{timeout:75000});
      if(!evidence)throw new Error('Missing geocoder evidence');
      const offset=validateLocation(center,evidence);
      const submitted=await page.locator('#P1_CENTER').inputValue();
      const [lat,lon]=submitted.split(',').map(Number);
      if(Math.abs(lat-evidence.latitude!)>.001||Math.abs(lon-evidence.longitude!)>.001)throw new Error('Submitted-center mismatch');
      const record={input:center.input,status:'passed',offset_miles:offset,submitted_center:submitted,evidence,pagination:await page.locator('.a-IRR-pagination-label').first().textContent().catch(()=>null),checked_at:new Date().toISOString(),note:'Bounded UI search check; no producer names/records saved and agent database untouched.'};
      results.push(record);console.log(JSON.stringify(record));
    }catch(error){results.push({input:center.input,status:'failed',error:String(error)});console.log(center.input,String(error));}
    finally{detach();writeFileSync(folder+'/expansion-ui-checks.json',JSON.stringify(results,null,2));}
    await page.waitForTimeout(5000);
  }
}finally{await browser.close();}
