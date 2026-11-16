const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');

function readProjectId() {
  if (!fs.existsSync(envPath)) {
    throw new Error('The .env file was not found. Create it from .env.example and enter your Firebase project settings first.');
  }
  const envText = fs.readFileSync(envPath, 'utf8');
  const line = envText.split(/\r?\n/).find((item) => /^\s*EXPO_PUBLIC_FIREBASE_PROJECT_ID\s*=/.test(item));
  const projectId = line?.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  if (!projectId || /your-project-id|your_project_id/i.test(projectId)) {
    throw new Error('EXPO_PUBLIC_FIREBASE_PROJECT_ID is missing or still uses the example value in .env.');
  }
  return projectId;
}

try {
  const projectId = readProjectId();
  console.log(`Deploying Firestore indexes to Firebase project: ${projectId}`);
  console.log('This requires Firebase CLI authentication and permission to deploy indexes to this project.');
  const result = spawnSync('npx', ['--yes', 'firebase-tools@latest', 'deploy', '--only', 'firestore:indexes', '--project', projectId], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  console.log('Index configuration submitted. Wait for Firestore to finish building the collection-group indexes before retrying workspace member listing.');
} catch (error) {
  console.error(`Could not deploy Firestore indexes: ${error.message}`);
  process.exit(1);
}
