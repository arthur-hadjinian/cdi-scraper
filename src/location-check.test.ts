import test from 'node:test';
import assert from 'node:assert/strict';
import {qualifiedZip,validateLocation,locationInputs,locationReference} from './location-check.js';
const expected={latitude:34.09,longitude:-118.4};
test('qualify ZIPs and reject malformed inputs',()=>{
 assert.equal(qualifiedZip('90210'),'90210, CA');
 assert.throws(()=>qualifiedZip('France'));
});
test('reject foreign, wrong state, distant and missing centers',()=>{
 for(const e of [{status:'ZERO_RESULTS'},{status:'OK',country:'FR',state:'IDF',latitude:48,longitude:2},{status:'OK',country:'US',state:'NV',latitude:34.09,longitude:-118.4},{status:'OK',country:'US',state:'CA',latitude:38,longitude:-122},{status:'OK',country:'US',state:'CA'}]) assert.throws(()=>validateLocation(expected,e));
});
test('accept California center close to intended ZIP',()=>{
 assert.ok(validateLocation(expected,{status:'OK',country:'US',state:'CA',latitude:34.103,longitude:-118.410})<2);
});
test('company ZIP fallback remains nearby and state qualified',()=>{
 const inputs=locationInputs('91399');
 assert.equal(inputs[0],'91399, CA');
 assert.equal(inputs[1],'91364, CA');
 assert.equal(inputs[2],'Woodland Hills, CA');
});
test('final recovery inputs retain strict validation against documented references',()=>{
 assert.equal(locationInputs('90101')[0],'90040, CA');
 assert.deepEqual(locationReference('93031'),{latitude:34.1975,longitude:-119.1763});
 assert.ok(validateLocation(locationReference('93031'),{status:'OK',country:'US',state:'CA',latitude:34.21,longitude:-119.18})<2);
 assert.throws(()=>validateLocation(locationReference('93031'),{status:'OK',country:'US',state:'CA',latitude:34.0324,longitude:-119.1343}));
});
