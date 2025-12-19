import fs from 'fs';
import path from 'path';

// Read the current file
const filePath = 'c:\\Users\\rapha\\repos\\karrot\\app\\host\\session\\page.tsx';
const content = fs.readFileSync(filePath, 'utf8');

// Find the line with "if (!quiz) return null;"
const lines = content.split('\n');
const targetLineIndex = lines.findIndex(line => line.includes('if (!quiz) return null;'));

console.log(`Found target at line: ${targetLineIndex + 1}`);
console.log(`Total lines in file: ${lines.length}`);
