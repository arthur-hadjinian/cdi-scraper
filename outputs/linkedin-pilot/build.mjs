import fs from 'node:fs/promises';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';
const dir='outputs/linkedin-pilot';
console.log('Reading saved research');
const data=JSON.parse(await fs.readFile(`${dir}/export.json`,'utf8'));
const w=Workbook.create();
const s=w.worksheets.add('Passed - LinkedIn');
const letters=n=>{let a='';while(n){n--;a=String.fromCharCode(65+n%26)+a;n=Math.floor(n/26)}return a};
const extra=['LinkedIn URL','LinkedIn match','Possible LinkedIn URL','Match evidence','Evidence sources','LinkedIn checked','Recorded searches'];
const headers=[data.headers[0],...extra,...data.headers.slice(1)];
const last=letters(headers.length), end=data.rows.length+6;
const rows=data.rows.map(r=>{const m=data.results[r.License_Number];return [r.Name,m?.linkedin_url||null,m?.status||'Not researched',m?.candidate_url||null,m?.evidence||null,m?.sources.join('\n')||null,m?new Date(`${m.checked_on}T12:00:00Z`):null,m?.queries.length??null,...data.headers.slice(1).map(h=>r[h]??null)];});
console.log('Writing approved source rows',rows.length);
s.getRange(`A6:${last}6`).values=[headers];
s.getRange(`A7:${last}${end}`).values=rows;
s.getRange(`A6:${last}${end}`).format.font={name:'Arial',size:10,color:'#243B53'};
s.getRange(`A6:${last}${end}`).format.verticalAlignment='center';
s.getRange(`A6:${last}${end}`).format.rowHeight=30;
s.getRange(`A6:${last}${end}`).format.columnWidth=20;
s.getRange('A2').values=[['LinkedIn research pilot']];
s.getRange('A2').format.font={name:'Arial',size:16,bold:true,color:'#243B53'};
s.getRange('A3').values=[['Optional LinkedIn enrichment. Master rows marked Yes; original screening retained. Missing LinkedIn does not disqualify a lead.']];
s.getRange('A3').format.font={name:'Arial',size:10,color:'#52606D'};
const counts=Object.values(data.results).reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
s.getRange('A4').values=[[`${Object.keys(data.results).length} researched: ${counts['Strong match']||0} strong matches, ${counts['Possible match']||0} possible matches, ${counts['Not found']||0} not found within the search budget. Remaining rows are not researched.`]];
s.getRange('A4').format.font={name:'Arial',size:10,color:'#52606D'};
const table=s.tables.add(`A6:${last}${end}`,true,'LinkedInResearch');
table.showFilterButton=true;
s.getRange(`A6:${last}6`).format={fill:'#243B53',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,rowHeight:34,horizontalAlignment:'center',verticalAlignment:'center'};
const widths={A:29,B:55,C:20,D:55,E:74,F:60,G:18,H:12};
for(const [col,width] of Object.entries(widths))s.getRange(`${col}6:${col}${end}`).format.columnWidth=width;
for(const col of ['B','D','E','F'])s.getRange(`${col}7:${col}56`).format.wrapText=true;
s.getRange('A7:AO56').format.rowHeight=114;
s.getRange('H5').values=[['Partial query log']];
s.getRange('H5').format.font={name:'Arial',size:9,color:'#52606D'};
s.getRange(`G7:G${end}`).setNumberFormat('mm/dd/yy');
s.getRange(`H7:H${end}`).setNumberFormat('0');
s.getRange(`C7:C${end}`).conditionalFormats.add('containsText',{text:'Possible match',format:{fill:'#FFF3CD',font:{color:'#795500'}}});
s.getRange(`C7:C${end}`).conditionalFormats.add('containsText',{text:'Not found',format:{fill:'#F0F2F4',font:{color:'#52606D'}}});
for(let i=0;i<data.headers.length;i++){
  const c=i===0?1:i+8, col=letters(c),h=data.headers[i];
  if(i>0)s.getRange(`${col}6:${col}${end}`).format.columnWidth=/Assessment|Details|Organizations|Insurers/.test(h)?55:/Address/.test(h)?36:/URL/.test(h)?45:20;
  if(h==='License_Number'||h==='Source_ZIPs')s.getRange(`${col}7:${col}${end}`).setNumberFormat('@');
  if(h==='License_URL'){
    s.getRange(`${col}7:${col}${end}`).format.font.color='#0563C1';
  }
  if(h==='Years_Since_Life_Issue')s.getRange(`${col}7:${col}${end}`).setNumberFormat('0.00');
}
for(const [i,r] of data.rows.entries()){
 const m=data.results[r.License_Number]; if(!m)continue;
 for(const [col,url] of [['B',m.linkedin_url],['D',m.candidate_url]])if(url){s.getRange(`${col}${i+7}`).format.font.color='#0563C1';}
}
s.showGridLines=false;
s.freezePanes.freezeRows(6);s.freezePanes.freezeColumns(1);
s.tabColor='#243B53';
console.log('Recalculating');w.recalculate();
console.log((await w.inspect({kind:'table',range:"'Passed - LinkedIn'!A6:D10",include:'values,formulas',tableMaxRows:5,tableMaxCols:4,maxChars:2200})).ndjson);
console.log((await w.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#SPILL!',options:{useRegex:true,maxResults:15},summary:'Formula errors',maxChars:1500})).ndjson);
console.log('Rendering');
for(const [name,range] of [['preview','A6:E11'],['possible-preview','A53:F56']]){
 const image=await w.render({sheetName:s.name,range,scale:1.25});
 await fs.writeFile(`${dir}/${name}.png`,new Uint8Array(await image.arrayBuffer()));
}
console.log('Exporting');
await (await SpreadsheetFile.exportXlsx(w)).save(`${dir}/approved-linkedin-pilot.xlsx`);
console.log('Saved approved-linkedin-pilot.xlsx');
