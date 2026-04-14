#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import https from 'https';

const WORKER_URL = 'https://still-haze-bb4e.bryanhkwan.workers.dev';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const { statusCode } = res;
      if (statusCode !== 200) {
        res.resume();
        reject(new Error('Request Failed. Status Code: ' + statusCode));
        return;
      }
      res.setEncoding('utf8');
      let raw = '';
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatCurrency(n) {
  return n;
}

(async function main() {
  try {
    const rosterUrl = `${WORKER_URL}/api/roster?team=Toledo&year=2025`;
    console.log('Fetching roster from', rosterUrl);
    const roster = await fetchJson(rosterUrl);
    console.log(`Fetched ${Array.isArray(roster) ? roster.length : 0} roster entries`);

    const header = [
      'Last Name',
      'First Name',
      'Position',
      'Year',
      'On/Off Campus',
      'Rev Share $',
      'Contract Length (6 months vs 12 months)',
      'Stipend',
      'Total Compensation',
      'Total Budget',
    ];

    const rows = [header];
    let totalCompSum = 0;

    for (const p of roster) {
      const firstName = (p.first_name || p.firstName || (p.player || '').split(' ')[0] || '').toString().trim();
      const lastName = (p.last_name || p.lastName || (p.player || '').split(' ').slice(-1)[0] || '').toString().trim();
      const position = (p.position || p.pos || '').toString().trim();
      const year = (p.year || p.class || '').toString().trim();

      // Campus
      const campus = Math.random() < 0.85 ? 'On Campus' : 'Off Campus';

      // Rev share sizing by position
      const posKey = (position || '').toUpperCase();
      let revShare = 0;
      if (posKey === 'QB') revShare = randInt(30000, 200000);
      else if (['RB','WR','TE'].includes(posKey)) revShare = randInt(15000, 150000);
      else if (['CB','S','LB','DE','DT','DL','OL','DB'].includes(posKey)) revShare = randInt(2000, 70000);
      else revShare = randInt(0, 10000);

      // Stipend (annualized, smaller than rev-share)
      const stipend = randInt(500, 12000);

      const contractLength = Math.random() < 0.8 ? 12 : 6;
      const totalComp = revShare + stipend;
      totalCompSum += totalComp;

      rows.push([
        lastName,
        firstName,
        position,
        year,
        campus,
        revShare,
        contractLength,
        stipend,
        totalComp,
        null,
      ]);
    }

    // Add a blank row then Total Budget row (parser will pick first non-empty value in Total Budget column)
    const estimatedBudget = Math.ceil(totalCompSum * 1.2 / 1000) * 1000; // +20% rounding to nearest 1k
    rows.push(new Array(header.length).fill(null));
    const totalBudgetRow = new Array(header.length).fill(null);
    totalBudgetRow[header.length - 1] = estimatedBudget;
    rows.push(totalBudgetRow);

    // Write XLSX via xlsx package
    console.log('Writing sample.xlsx (' + roster.length + ' players, estimated budget ' + estimatedBudget + ')');
    const xlsxModule = await import('xlsx');
    const XLSX = xlsxModule.default || xlsxModule;
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const outPath = path.resolve(process.cwd(), 'sample.xlsx');
    XLSX.writeFile(wb, outPath);
    console.log('Wrote', outPath);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
