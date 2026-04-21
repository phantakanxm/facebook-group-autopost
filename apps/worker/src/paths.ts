import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAppPaths } from '@app/shared/paths';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

export const paths = resolveAppPaths({ repoRoot });
