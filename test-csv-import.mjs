import assert from 'node:assert/strict';
import {parseCSV,createCSVImport} from './csv-import.mjs';
const csv=['name,brand,category,variant_label,sku,cost,price,line,blurb,image',
 '"Test Tee",VEGArance,Fashion,"Black / M",TEE-BLK-M,12.50,28.00,Everyday,"A soft everyday tee.",https://example.com/tee.png',
 '"Test Tee",VEGArance,Fashion,"White / M",TEE-WHT-M,12.50,28.00,Everyday,"A soft everyday tee.",https://example.com/tee.png',
 '"Solo Mug",VEGArance,Home,Standard,MUG-1,6.00,18.00,,A sturdy mug.,'].join('\n');
const drafts=parseCSV(csv);
assert.equal(drafts.length,2);assert.equal(drafts[0].variants.length,2);assert.equal(drafts[0].prices[drafts[0].variants[0].id],28);
assert.equal(drafts[0].supplier.provider,'csv');assert.equal(drafts[1].name,'Solo Mug');
assert.throws(()=>parseCSV('name,brand\nA,B'),e=>e.status===422);
assert.throws(()=>parseCSV(csv.replace('28.00','10.00')),e=>e.status===422);
assert.throws(()=>parseCSV(csv.replace('Fashion','Toys')),e=>e.status===422);
assert.throws(()=>parseCSV(''),e=>e.status===422);
assert.equal(createCSVImport().configured,true);
console.log('PASS: CSV grouping into drafts, price-above-cost rule, header/row validation, no-key adapter.');
