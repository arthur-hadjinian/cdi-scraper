import json
from pathlib import Path
from shutil import copy2

job=Path('outputs/linkedin-pilot')
for name in ['research.json','queue.sqlite3']:
    target=job/(name.replace('.json','-initial.json').replace('.sqlite3','-before-revisit.sqlite3'))
    if not target.exists(): copy2(job/name,target)
r=json.loads((job/'research.json').read_text(encoding='utf-8'))
notes={
8: ('Insurance biography found in Stevenson Ranch; no individual LinkedIn URL tied to the source business contact.', ['https://www.elsuplemento.com/mega/sumario/perfil/cicchiello']),
12: ('WFG search result confirms license 4418402 and North Hollywood business address. No matching individual LinkedIn profile found.', ['https://agents.worldfinancialgroup.com/Abigail-Sefa-Boakye-C8U19']),
14: ('Aflac professional listing names Abner Cordova in Culver City. No corroborated individual LinkedIn profile found.', ['https://www.alignable.com/culver-city-ca/aflac-insurance-agent']),
22: ('Tax-preparer listing matches name and 9062 Woodman Ave, Arleta business address. No corroborated individual LinkedIn URL found.', ['https://taxrpo.com/preparer/ada-torres-arleta-ca/']),
24: ('Seven Arts Insurance Solutions business listing matches name, agency and Beverly Hills office. No individual LinkedIn URL found.', ['https://www.bizprofile.net/ca/beverly-hills/seven-arts-insurance-solutions']),
26: ('Adam M. Magsig appears in a Valley Village professional record. LinkedIn result is Matt Magsig; no verified name/identity link. No profile selected.', ['https://files.brokercheck.finra.org/individual/individual_4448423.pdf']),
29: ('Notary listing matches name and exact Sherman Oaks business address. Editor LinkedIn candidate remains unlinked to that business identity; keep uncertain.', ['https://find-notary.com/en/notaries/adam-pineless-sherman-oaks-ca-91423','https://notary.snapdocs.com/notary-public/california/sherman-oaks/adam-pineless']),
39: ('CPA website matches name and exact Northridge business address. LinkedIn directory lists the name in Los Angeles, but no individual profile URL was recovered.', ['https://www.abarncpa.com/','https://at.linkedin.com/pub/dir/%2B/Barnuevo/us-0-United-States']),
41: ('Existing Athans Enterprises candidate remains plausible by name/location; no independent insurance/contact corroboration found.', []),
42: ('Existing PHP Houston candidate remains uncertain against the source Pasadena location; no direct contact/license link found.', []),
43: ('NYL LinkedIn candidate shows Glendale/Los Angeles insurance context; Sacramento source mailing address and direct identity/contact link remain unresolved.', []),
48: ('LinkedIn directory lists Daniyelyan in Los Angeles County at J. Paul Getty Trust. No individual URL or connection to this WFG producer was recovered.', ['https://www.linkedin.com/pub/dir/%2B/Daniyelyan']),
49: ('Name, Costa Mesa and insurance context match AAA profile. Source lists WFG; license/phone link is unconfirmed. Two profile URLs surfaced; candidate only.', ['https://www.linkedin.com/in/adriana-placinta-norman','https://www.linkedin.com/in/adriana-placinta-norman-98403256','https://gt.linkedin.com/company/aaa-auto-club-enterprises']),
}
queries={12:['Abigail Sefa-Boakye WFG 4418402 LinkedIn'],26:['Adam Magsig PGIM LinkedIn','Adam Magsig Matt Magsig PGIM LinkedIn'],39:['Adeline Barnuevo CPA 9036 Reseda LinkedIn'],49:['Adriana Norman Costa Mesa AAA LinkedIn','site:linkedin.com/in/ "Adriana" "Norman" "Costa Mesa"']}
for row in r:
    if row['status']=='Strong match': continue
    ordinal=row['ordinal']
    row['revisited_on']='2026-10-10'
    row['revisit_outcome']='No additional corroborated profile' if ordinal!=49 else 'New uncertain candidate'
    row['query_log_note']='Initial queries plus recoverable second-pass queries only; complete second-pass query log unavailable. Not a total search/cost count.'
    row['queries'].extend(queries.get(ordinal,[]))
    if ordinal in notes:
        evidence,sources=notes[ordinal]
        row['evidence']='Second pass: '+evidence
        row['sources']=list(dict.fromkeys(row['sources']+sources))
    else:
        row['evidence']=row['evidence']+' Second pass: no additional corroborated individual profile.'
    if ordinal==49:
        row['status']='Possible match'
        row['candidate_url']='https://www.linkedin.com/in/adriana-placinta-norman'
    row['checked_on']='2026-10-10'
(job/'research.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')
(job/'revisit-audit.json').write_text(json.dumps({'date':'2026-10-10','revisited_ordinals':[x['ordinal'] for x in r if x.get('revisited_on')],'recoverable_actual_queries':queries,'log_limitation':'Full second-pass query log unavailable; do not infer search totals or billing from this subset.','outcome':'7 strong, 5 possible, 38 unresolved; one new candidate, no new strong match.'},indent=2),encoding='utf-8')
print('Saved 43 revisited decisions')
