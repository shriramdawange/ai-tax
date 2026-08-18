import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGstDocument,classifySupply } from '../src/part3-tax.js';

test('GST validator accepts clean intra-state tax split',()=>{const r=validateGstDocument({invoiceNumber:'INV-1',supplierGstin:'27AAAAA0000A1Z5',taxableValue:10000,cgst:900,sgst:900,igst:0,cess:0});assert.equal(r.valid,true);assert.equal(r.tax,1800);});
test('GST validator rejects mixed IGST and CGST/SGST',()=>{const r=validateGstDocument({invoiceNumber:'INV-1',taxableValue:10000,cgst:900,sgst:900,igst:1800,cess:0});assert.equal(r.valid,false);});
test('supply classification uses place of supply first',()=>{assert.equal(classifySupply('27','27','29AAAAA0000A1Z5'),'INTRA_STATE');assert.equal(classifySupply('27','29','27AAAAA0000A1Z5'),'INTER_STATE');});
