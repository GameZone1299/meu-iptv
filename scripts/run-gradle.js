const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const project = process.argv[2];
const tasks = process.argv.slice(3);
const validProjects = new Set(['android', 'android-tv']);

if (!validProjects.has(project) || tasks.length === 0) {
  console.error('Uso: node scripts/run-gradle.js <android|android-tv> <task...>');
  process.exit(2);
}

const wrapper = path.join(root, project, 'gradlew.bat');
const result = spawnSync(wrapper, tasks, {
  cwd: path.join(root, project),
  stdio: 'inherit',
  shell: true
});

if (result.error) {
  console.error(`Falha ao iniciar Gradle: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
