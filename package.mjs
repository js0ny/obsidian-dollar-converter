import { copyFile, mkdir } from 'node:fs/promises';

const target = new URL('./target/', import.meta.url);
await mkdir(target, { recursive: true });
await Promise.all(['manifest.json', 'main.js'].map(file =>
	copyFile(new URL(file, import.meta.url), new URL(file, target)),
));
