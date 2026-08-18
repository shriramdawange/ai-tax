import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBankCsv } from '../src/banking.js';
import { extractDocument } from '../src/document-ai.js';

test('bank CSV parses and normalizes',()=>{const x=normalizeBankCsv('Date,Description,Debit,Credit,Balance\n01/08/2026,UPI ABC,1000,,9000\n02/08/2026,Customer payment,,5000,14000');assert.equal(x.rows.length,2);assert.equal(x.rows[0].debit,1000);assert.equal(x.rows[1].credit,5000);});
test('bank CSV rejects both sides',()=>{const x=normalizeBankCsv('Date,Description,Debit,Credit\n01/08/2026,X,100,200');assert.equal(x.rows.length,0);assert.equal(x.errors.length,1);});
test('invoice extractor finds GST data',()=>{const x=extractDocument('TAX INVOICE\nInvoice No: INV-42\nInvoice Date: 01/08/2026\nGSTIN: 27ABCDE1234F1Z5\nTaxable Value: 100000\nCGST: 9000\nSGST: 9000\nGrand Total: 118000');assert.equal(x.documentType,'INVOICE');assert.equal(x.invoiceNumber,'INV-42');assert.equal(x.invoiceDate,'2026-08-01');assert.equal(x.gstin,'27ABCDE1234F1Z5');assert.equal(x.total,118000);});
