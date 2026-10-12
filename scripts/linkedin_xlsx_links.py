"""Add native hyperlinks: artifact-tool's HYPERLINK evaluator is unsupported.

Only hyperlink elements/relationships are added; artifact-tool authors the workbook.
"""
import argparse
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import xml.etree.ElementTree as E

S='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
P='http://schemas.openxmlformats.org/package/2006/relationships'
E.register_namespace('',S)
E.register_namespace('r',R)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--job',type=Path,default=Path('outputs/linkedin-pilot'))
    a=p.parse_args(); path=a.job/'approved-linkedin-pilot.xlsx'
    data=json.loads((a.job/'export.json').read_text(encoding='utf-8'))
    with ZipFile(path) as z: files={n:z.read(n) for n in z.namelist()}
    sheet_name='xl/worksheets/sheet1.xml'
    rel_name='xl/worksheets/_rels/sheet1.xml.rels'
    sheet=E.fromstring(files[sheet_name])
    rels=E.fromstring(files[rel_name]) if rel_name in files else E.Element(f'{{{P}}}Relationships')
    old=sheet.find(f'{{{S}}}hyperlinks')
    if old is not None: raise ValueError('Hyperlinks already exist; rerun builder before patching.')
    links=E.Element(f'{{{S}}}hyperlinks')
    used={r.get('Id') for r in rels}; counter=1; count=0
    for row,item in enumerate(data['rows'],7):
        m=data['results'].get(item['License_Number'],{})
        for col,url in [('B',m.get('linkedin_url')),('D',m.get('candidate_url')),('L',item['License_URL'])]:
            if not url: continue
            while f'rId{counter}' in used: counter+=1
            rid=f'rId{counter}';used.add(rid)
            E.SubElement(rels,f'{{{P}}}Relationship',{'Id':rid,'Type':R+'/hyperlink','Target':url,'TargetMode':'External'})
            E.SubElement(links,f'{{{S}}}hyperlink',{'ref':f'{col}{row}',f'{{{R}}}id':rid})
            count+=1
    # ECMA-376 order: hyperlinks after conditionalFormatting/dataValidations,
    # before print/page/drawing/table elements.
    before={'printOptions','pageMargins','pageSetup','headerFooter','rowBreaks','colBreaks','customProperties','cellWatches','ignoredErrors','smartTags','drawing','legacyDrawing','legacyDrawingHF','picture','oleObjects','controls','webPublishItems','tableParts','extLst'}
    at=next((i for i,c in enumerate(sheet) if c.tag.split('}')[-1] in before),len(sheet))
    sheet.insert(at,links)
    files[sheet_name]=E.tostring(sheet,encoding='utf-8',xml_declaration=True)
    files[rel_name]=E.tostring(rels,encoding='utf-8',xml_declaration=True)
    temp=path.with_suffix('.xlsx.tmp')
    with ZipFile(temp,'w',ZIP_DEFLATED) as z:
        for name,content in files.items():z.writestr(name,content)
    temp.replace(path)
    print(f'Added {count} native hyperlinks')

if __name__=='__main__':main()
