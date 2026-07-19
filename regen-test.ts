import 'dotenv/config';
import { generateContent, buildHTML } from './regenerar-pages';
import fs from 'fs';
import path from 'path';

const slugs = [
  'barbearia-do-norte',
  'crossfit-zona-norte',
  'clinica-sorriso-pleno',
  'cantina-da-nonna',
  'devflow-sistemas',
  'alma-centro-estudos-visuais'
];

const data = JSON.parse(fs.readFileSync('./data/diagnosticos_2026-05-28.json', 'utf-8'));

(async () => {
  for (const diag of data) {
    if (!slugs.includes(diag.slug)) continue;
    console.log(`Gerando: ${diag.nome}...`);
    const content = await generateContent(diag);
    const html = buildHTML(diag, content);
    const dir = path.join('./pages', diag.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    console.log(`✓ ${diag.slug}`);
  }
  console.log('Concluído.');
})();
