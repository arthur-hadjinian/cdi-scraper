import type { Page } from 'playwright';
import { milesBetween } from './grid.js';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const zipcodes=createRequire(import.meta.url)('zipcodes');
const overrides=JSON.parse(readFileSync(new URL('../docs/search-location-overrides.json',import.meta.url),'utf8')) as Record<string,{latitude?:number;longitude?:number;inputs:string[]}>;
export function locationReference(zip:string):{latitude:number;longitude:number} {
  const original=zipcodes.lookup(zip);
  if(!original)throw new Error(`Unknown ZIP ${zip}`);
  const override=overrides[zip];
  return {latitude:override?.latitude ?? original.latitude,longitude:override?.longitude ?? original.longitude};
}

export type LocationEvidence = { status: string; country?: string; state?: string; postal?: string; latitude?: number; longitude?: number; formatted?: string };
export function qualifiedZip(zip: string): string {
  if (!/^\d{5}$/.test(zip)) throw new Error('Invalid search ZIP');
  return `${zip}, CA`;
}
export function locationInputs(zip:string):string[] {
  if(overrides[zip])return overrides[zip].inputs;
  const expected=zipcodes.lookup(zip);
  if(!expected)throw new Error(`Unknown ZIP ${zip}`);
  const nearest=zipcodes.radius(zip,3).filter((x:string)=>x!==zip).map((x:string)=>zipcodes.lookup(x)).filter((x:any)=>x?.state==='CA')
    .sort((a:any,b:any)=>milesBetween(expected,a)-milesBetween(expected,b))[0];
  // Unique/company/PO-box ZIPs may have no physical geocoding result. Use only
  // a nearby California search center, and validate its actual coordinates.
  return [...new Set([qualifiedZip(zip),...(nearest?[qualifiedZip(nearest.zip),`${nearest.city}, CA`]:[`${expected.city}, CA`])])];
}
export function validateLocation(expected: {latitude:number;longitude:number}, evidence: LocationEvidence): number {
  if (evidence.status !== 'OK') throw new Error(`Geocoding failed: ${evidence.status}`);
  if (evidence.country !== 'US' || evidence.state !== 'CA') throw new Error(`Location mismatch: resolved outside California (${evidence.formatted || evidence.country})`);
  if (!Number.isFinite(evidence.latitude) || !Number.isFinite(evidence.longitude)) throw new Error('Missing geocoded coordinates');
  const distance = milesBetween(expected, {latitude:evidence.latitude!, longitude:evidence.longitude!});
  if (distance > 5) throw new Error(`Location mismatch: center is ${distance.toFixed(1)} miles from intended ZIP`);
  return distance;
}
const dialogErrors = new WeakMap<Page, string>();
export function recordSiteDialog(page: Page, message: string): void {
  if (/geocoding has failed|web service|access denied|captcha|verify you are human/i.test(message)) dialogErrors.set(page,message);
}
export function clearSiteError(page: Page): void { dialogErrors.delete(page); }
export function assertSiteDialog(page: Page): void {
  const error=dialogErrors.get(page);
  if (error) throw new Error(`Site search error: ${error}`);
}
export async function observeGeocoder(page: Page, onEvidence: (evidence:LocationEvidence)=>void): Promise<()=>void> {
  await page.waitForFunction(() => typeof (window as any).google?.maps?.Geocoder === 'function', undefined, {timeout:30000});
  const listener=(message: import('playwright').ConsoleMessage)=> {
    if (message.text().startsWith('__CDI_LOCATION__')) onEvidence(JSON.parse(message.text().slice('__CDI_LOCATION__'.length)));
  };
  page.on('console',listener);
  // Keep browser callbacks free of helpers injected by the TypeScript loader.
  await page.evaluate(new Function(`
    const root=window;
    if(root.__cdiLocationObserver) return;
    root.__cdiLocationObserver=true;
    const proto=root.google.maps.Geocoder.prototype;
    const original=proto.geocode;
    proto.geocode=function(request,callback) {
      if(typeof callback!=='function') return original.call(this,request,callback);
      return original.call(this,request,(results,status)=>{
        const result=results?.[0];
        const component=(type)=>result?.address_components?.find((x)=>x.types.includes(type))?.short_name;
        console.log('__CDI_LOCATION__'+JSON.stringify({status,country:component('country'),state:component('administrative_area_level_1'),postal:component('postal_code'),formatted:result?.formatted_address,latitude:result?.geometry?.location?.lat(),longitude:result?.geometry?.location?.lng()}));
        callback(results,status);
      });
    };
  `) as ()=>void);
  return ()=>{page.off('console',listener);};
}
