const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { webSecurity: false, autoplayPolicy: 'no-user-gesture-required' }
  });
  const started = Date.now();
  const errors = [];
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) errors.push(message);
  });
  win.webContents.on('render-process-gone', (_event, details) => errors.push(`renderer-gone:${details.reason}`));
  await win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  const loadMs = Date.now() - started;
  const result = await win.webContents.executeJavaScript(`new Promise(resolve => {
    const began=performance.now();
    const check=()=>{
      if (window.Lib && Lib.ready) resolve({ready:true,readyMs:Math.round(performance.now()-began),stats:libStats(),heap:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null});
      else if(performance.now()-began>90000)resolve({ready:false,timeout:true});
      else setTimeout(check,100);
    };check();
  })`);
  console.log(JSON.stringify({loadMs,...result,errors}));
  win.destroy();
  app.quit();
});
