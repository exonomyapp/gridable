import { promises as fs } from 'fs';
import path from 'path';

export default defineEventHandler(async (event) => {
  const slug = event.context.params?.slug;
  if (!slug) {
    return { content: 'Invalid request' };
  }

  let filePath;
  if (slug === 'README.md') {
    // For the main README, look in the root of the gridable-app
    filePath = path.join(process.cwd(), 'README.md');
  } else if (slug.startsWith('upGrid/')) {
    // For upGrid docs, look in the packages directory
    const fileName = slug.replace('upGrid/', '');
    // process.cwd() is gridable-app, so we go up one level to the monorepo root
    filePath = path.join(process.cwd(), '..', 'packages', 'upGrid', 'docs', fileName);
  } else {
    // For all other docs, look in the gridable-app/docs directory
    filePath = path.join(process.cwd(), 'docs', slug);
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { content };
  } catch (error) {
    return { content: `File not found. Attempted path: ${filePath}` };
  }
});