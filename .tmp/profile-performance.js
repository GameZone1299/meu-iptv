const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
app.commandLine.appendSwitch('disable-gpu-compositing');
const userData = path.resolve(__dirname, 'profile-userdata'); fs.mkdirSync(userData,{recursive:true}); app.setPath('userData',userData);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width:1280,height:800,show:false,webPreferences:{offscreen:true,webSecurity:false} });
  const errors=[]; win.webContents.on('console-message',(_e,l,m)=>{if(l>=2)errors.push(m.slice(0,250))});
  const oldSource=fs.readFileSync(path.resolve(__dirname,'performance-backup','www','app.js'),'utf8');
  const oldStart=oldSource.indexOf('function obterFiltrados()');
  const oldEnd=oldSource.indexOf('\\nfunction cardParaItem',oldStart);
  const oldFunction=oldSource.slice(oldStart,oldEnd);
  await win.loadFile(path.resolve(__dirname,'..','www','index.html'));
  const out=await win.webContents.executeJavaScript(`new Promise(resolve=>{const start=performance.now();const poll=()=>{if(typeof Lib!=='undefined'&&Lib.ready){const result={readyMs:Math.round(performance.now()-start),stats:libStats(),heap:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null,timing:{}};const measure=(n,f)=>{const t=performance.now();const v=f();result.timing[n]=Math.round((performance.now()-t)*10)/10;return v};measure('movies-first',()=>{scr='movies';document.querySelector('#q').value='';cat={};sortBy='name-asc';filterQuality='';advFilter={};invalidarResultadoLista();return obterFiltrados().f.length});measure('movies-cache-x20',()=>{for(let i=0;i<20;i++)obterFiltrados()});measure('movies-render-60',()=>{limit=PAGE_SIZE;renderList()});measure('movies-search',()=>{document.querySelector('#q').value='acao';invalidarResultadoLista();return obterFiltrados().f.length});measure('series-first',()=>{scr='series';cat={};invalidarResultadoLista();return obterFiltrados().f.length});resolve(result)}else if(performance.now()-start>90000)resolve({timeout:true});else setTimeout(poll,100)};poll()})`);
  console.log('PERF_JSON '+JSON.stringify({...out,errors}));
  win.destroy(); setTimeout(()=>app.quit(),50);
});
