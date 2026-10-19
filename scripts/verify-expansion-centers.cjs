const fs=require('node:fs');
const {chromium}=require('playwright');
const folder='ROUND-2-ENGLISH/scan-plan';
const audit=JSON.parse(fs.readFileSync(folder+'/remaining-coverage-audit.json','utf8'));
const requests=[...audit.census_not_searched.map(p=>({key:p.zip,input:p.zip+', CA',kind:'omitted_zip',reference:p})),
 ...audit.remaining_candidates.filter(p=>p.capped_neighbors>0).map(p=>({key:p.zip,input:p.zip+', CA',kind:'remaining_postal_candidate',reference:p})),
 ...['Agua Dulce','Acton','Mount Baldy','Lebec','Tujunga','San Gabriel','Compton','Northridge','Lancaster'].map(city=>({key:'city-'+city.toLowerCase().replaceAll(' ','-'),input:city+', CA',kind:'alternate_city'}))];
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage();const results=[];
 try{
  await page.goto('https://interactive.web.insurance.ca.gov/apex_extprd/f?p=119:1::::::',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>typeof window.google?.maps?.Geocoder==='function',null,{timeout:45000});
  const radiusOptions=await page.locator('#P1_DISTANCE option').evaluateAll(options=>options.map(o=>({label:o.textContent,value:o.value})));
  for(const request of requests){
   const evidence=await page.evaluate(async input=>{
    return await new Promise(resolve=>{
     const timer=setTimeout(()=>resolve({status:'LOCAL_TIMEOUT'}),20000);
     new google.maps.Geocoder().geocode({address:input},(values,status)=>{
      clearTimeout(timer);const v=values?.[0];const component=t=>v?.address_components.find(c=>c.types.includes(t))?.short_name;
      resolve({status,formatted:v?.formatted_address,country:component('country'),state:component('administrative_area_level_1'),postal:component('postal_code'),latitude:v?.geometry.location.lat(),longitude:v?.geometry.location.lng()});
     });
    });
   },request.input);
   results.push({...request,evidence,checked_at:new Date().toISOString()});console.log(request.key,JSON.stringify(evidence));
   fs.writeFileSync(folder+'/expansion-location-verification.json',JSON.stringify({checked_at:new Date().toISOString(),method:'Read-only CDI page geocoder checks; no producer results collected or saved.',radiusOptions,results},null,2));
   if(['OVER_QUERY_LIMIT','REQUEST_DENIED'].includes(evidence.status))break;
   await page.waitForTimeout(2500);
  }
  await page.goto('https://cdicloud.insurance.ca.gov/cal/IndividualNameSearch',{waitUntil:'domcontentloaded',timeout:60000});
  const nameSearch={url:page.url(),text:(await page.locator('body').innerText()).slice(0,14000),inputs:await page.locator('input,select').evaluateAll(items=>items.map(p=>({tag:p.tagName,name:p.name,type:p.type,id:p.id,options:p.tagName==='SELECT'?[...p.options].map(o=>({label:o.textContent,value:o.value})):undefined})))};
  fs.writeFileSync(folder+'/alternate-search-inspection.json',JSON.stringify(nameSearch,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
