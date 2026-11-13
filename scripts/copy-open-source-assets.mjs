import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const source=path.join(root,'node_modules','echarts','dist','echarts.min.js');
const target=path.join(root,'apps','web','vendor','echarts.min.js');
if(existsSync(source)){
  mkdirSync(path.dirname(target),{recursive:true});
  copyFileSync(source,target);
}else if(process.env.CI==='true'){
  throw Error('ECharts local bundle missing. Install npm dependencies first.');
}
