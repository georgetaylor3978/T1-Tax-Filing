/**
 * convert-data.js — Parse T1 tax CSV + Population CSV into data.json
 * Run: node convert-data.js
 */
const fs = require('fs');
const path = require('path');

// ── Parse CSV helper (handles quoted fields with commas) ──
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

// ── Read population ──
const popRaw = fs.readFileSync(path.join(__dirname, 'Population.csv'), 'utf-8');
const popLines = popRaw.split(/\r?\n/).filter(l => l.trim());
const popHeader = parseCSVLine(popLines[0]);
const popCanada = parseCSVLine(popLines[1]); // "Canada" row
const yearIdx2023 = popHeader.indexOf('2023');
const population2023 = parseInt(popCanada[yearIdx2023].replace(/,/g, ''), 10);
console.log('Population 2023:', population2023.toLocaleString());

// ── Read tax data ──
const taxRaw = fs.readFileSync(path.join(__dirname, 'tbl2_ac.csv'), 'utf-8');
const taxLines = taxRaw.split(/\r?\n/).filter(l => l.trim());
const headerLine = parseCSVLine(taxLines[0]);

// Bracket labels — hardcoded in column order (20 pairs starting at col 4)
const bracketLabels = [
    'Total',
    'Under $5K',
    '$5K–$10K',
    '$10K–$15K',
    '$15K–$20K',
    '$20K–$25K',
    '$25K–$30K',
    '$30K–$35K',
    '$35K–$40K',
    '$40K–$45K',
    '$45K–$50K',
    '$50K–$55K',
    '$55K–$60K',
    '$60K–$70K',
    '$70K–$80K',
    '$80K–$90K',
    '$90K–$100K',
    '$100K–$150K',
    '$150K–$250K',
    '$250K+'
];

// Parse each line item
const lineItems = {};
for (let r = 1; r < taxLines.length; r++) {
    const fields = parseCSVLine(taxLines[r]);
    if (fields.length < 5) continue;

    const lineNum = parseInt(fields[0], 10);
    const itemName = fields[1].trim();
    const year = parseInt(fields[3], 10);

    if (isNaN(lineNum)) continue;

    const brackets = {};
    for (let b = 0; b < bracketLabels.length; b++) {
        const countIdx = 4 + b * 2;
        const amountIdx = 5 + b * 2;
        const count = parseInt((fields[countIdx] || '0').replace(/,/g, ''), 10) || 0;
        const amountThousands = parseInt((fields[amountIdx] || '0').replace(/,/g, ''), 10) || 0;
        brackets[bracketLabels[b]] = {
            count: count,
            amount: amountThousands // in thousands of dollars
        };
    }

    lineItems[lineNum] = {
        num: lineNum,
        name: itemName,
        year: year,
        brackets: brackets
    };
}

console.log('Line items parsed:', Object.keys(lineItems).length);

// ── Build output ──
const output = {
    year: 2023,
    population: population2023,
    bracketLabels: bracketLabels.filter(b => b !== 'Total'),
    lineItems: lineItems
};

fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify(output, null, 2), 'utf-8');
console.log('✓ data.json written successfully');
console.log('  Population:', population2023.toLocaleString());
console.log('  Line items:', Object.keys(lineItems).length);
console.log('  Brackets:', output.bracketLabels.length);
