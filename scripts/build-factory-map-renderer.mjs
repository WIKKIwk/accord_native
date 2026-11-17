import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
const result = await build({ entryPoints:['assets/factory-map/source/factory-map-renderer.js'],bundle:true,format:'iife',globalName:'FactoryMapRenderer',target:['es2020'],minify:true,write:false,legalComments:'inline' });
await writeFile('src/admin/factoryMapRendererBundle.ts',`// Generated from the unmodified V2 renderer by scripts/build-factory-map-renderer.mjs.\nexport const factoryMapRenderer = ${JSON.stringify(result.outputFiles[0].text)};\n`);
