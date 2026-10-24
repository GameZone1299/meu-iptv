const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const mainConfig = path.join(root, 'capacitor.config.json');
const tvConfig = path.join(root, 'capacitor.config.tv.json');
const command = process.argv[2];

if (!['copy', 'sync'].includes(command)) {
  console.error('Uso: node scripts/cap-tv.js <copy|sync>');
  process.exit(2);
}

const original = fs.readFileSync(mainConfig);
const tv = fs.readFileSync(tvConfig);

try {
  JSON.parse(original.toString('utf8'));
  JSON.parse(tv.toString('utf8'));
} catch (error) {
  console.error('Configuração Capacitor inválida; nenhuma alteração foi feita.');
  process.exit(2);
}

try {
  fs.writeFileSync(mainConfig, tv);
  const cli = path.join(root, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor');
  const result = spawnSync(process.execPath, [cli, command, 'android'], {
    cwd: root,
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(`Falha no Capacitor TV: ${error.message}`);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(mainConfig, original);
}
