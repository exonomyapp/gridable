import { promises as fs } from 'fs';
import path from 'path';

export default defineEventHandler(async (event) => {
  const slug = event.context.params?.slug;
  if (!slug) {
    return { content: 'Invalid request' };
  }

  let filePath;
  if (slug === 'README.md') {
    filePath = path.join(process.cwd(), 'README.md');
  } else {
    filePath = path.join(process.cwd(), 'docs', slug);
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { content };
  } catch (error) {
    return { content: 'File not found' };
  }
});