"""Compose named catalog artwork from existing representative AI brand imagery.

No image-generation API is called. Rebuild: python3 prepare-product-art.py.
"""
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT=Path(__file__).parent
script="const fs=require('fs'),vm=require('vm');const c={};vm.createContext(c);vm.runInContext(fs.readFileSync('products.js','utf8')+';globalThis.catalog=PRODUCTS',c);process.stdout.write(JSON.stringify(c.catalog));"
products=json.loads(subprocess.check_output(['node','-e',script],cwd=ROOT,text=True))
output=ROOT/'images'/'products'
output.mkdir(parents=True,exist_ok=True)
serif=ROOT/'fonts'/'nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.ttf'
sans=ROOT/'fonts'/'92zPtBhPNqw79Ij1E865zBUv7myjJQVG.ttf'
manifest={}
for index,product in enumerate(products,1):
    slug='-'.join(__import__('re').findall(r'[a-z0-9]+',product['brand'].lower()))
    source=ROOT/'images'/f'brand-{slug}.webp'
    canvas=Image.new('RGB',(768,960),'#f4f0e7')
    draw=ImageDraw.Draw(canvas)
    small=ImageFont.truetype(str(sans),16)
    brandfont=ImageFont.truetype(str(sans),17)
    titlefont=ImageFont.truetype(str(serif),32)
    draw.text((40,24),'VEGARANCE',font=small,fill='#394336')
    number=f'NO. {index:03}'
    draw.text((728-draw.textlength(number,font=small),24),number,font=small,fill='#787466')
    photo=Image.open(source).convert('RGB')
    photo=ImageOps.fit(photo,(688,636),method=Image.Resampling.LANCZOS,centering=(.5,.48))
    canvas.paste(photo,(40,66))
    draw.line((40,732,728,732),fill='#c6b999',width=1)
    draw.text((40,755),product['brand'].upper(),font=brandfont,fill='#827044')
    title=product['name']
    if title.lower().startswith(product['brand'].lower()+' '):title=title[len(product['brand'])+1:]
    lines=[];line=''
    for word in title.split():
        candidate=(line+' '+word).strip()
        if draw.textlength(candidate,font=titlefont)>685 and line:
            lines.append(line);line=word
        else:line=candidate
    if line:lines.append(line)
    if len(lines)>3:
        titlefont=ImageFont.truetype(str(serif),26)
        lines=[];line=''
        for word in title.split():
            candidate=(line+' '+word).strip()
            if draw.textlength(candidate,font=titlefont)>685 and line:lines.append(line);line=word
            else:line=candidate
        if line:lines.append(line)
    for row,text in enumerate(lines):draw.text((40,790+row*39),text,font=titlefont,fill='#203528')
    draw.text((40,923),'3 ML  /  5 ML  /  10 ML',font=small,fill='#5e6859')
    note='REPRESENTATIVE ARTWORK'
    draw.text((728-draw.textlength(note,font=small),923),note,font=small,fill='#7f796a')
    target=output/(product['id']+'.webp')
    canvas.resize((560,700),Image.Resampling.LANCZOS).save(target,'WEBP',quality=83,method=6)
    manifest[product['id']]='images/products/'+target.name
(ROOT/'product-images.js').write_text('/* Product-specific compositions of existing representative AI artwork. */\nconst PRODUCT_IMAGES = '+json.dumps(manifest,indent=2)+';\n')
print(f'Created {len(manifest)} named product artworks; no generation API used.')
