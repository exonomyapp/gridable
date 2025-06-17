import { promises as fs } from 'fs';
import path from 'path';
import { marked } from 'marked';

export default defineEventHandler(async (event) => {
  const filePath = path.join(process.cwd(), 'README.md');
  const markdownContent = await fs.readFile(filePath, 'utf-8');
  const htmlContent = await marked(markdownContent);
  return { content: htmlContent };
});