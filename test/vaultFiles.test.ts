import { describe, expect, it } from 'vitest';
import { collectMarkdownFiles } from '../src/vaultFiles';

interface TestFile {
  path: string;
  extension: string;
}

interface TestFolder {
  children: unknown[];
}

function isTestFolder(entry: unknown): entry is TestFolder {
  return typeof entry === 'object' && entry !== null && 'children' in entry && Array.isArray(entry.children);
}

function isMarkdownFile(entry: unknown): entry is TestFile {
  return typeof entry === 'object'
    && entry !== null
    && 'extension' in entry
    && entry.extension === 'md'
    && 'path' in entry;
}

describe('collectMarkdownFiles', () => {
  it('returns Markdown files recursively from the selected folder only', () => {
    const rootMarkdown = { path: 'YouTube/Index.md', extension: 'md' };
    const nestedMarkdown = { path: 'YouTube/Courses/video.md', extension: 'md' };
    const attachment = { path: 'YouTube/Courses/thumbnail.png', extension: 'png' };
    const folder: TestFolder = {
      children: [
        rootMarkdown,
        {
          children: [nestedMarkdown, attachment],
        },
      ],
    };
    const vaultRoot: TestFolder = {
      children: [folder, { path: 'Private/note.md', extension: 'md' }],
    };
    const selectedFolder = vaultRoot.children[0] as TestFolder;

    expect(collectMarkdownFiles(selectedFolder, isTestFolder, isMarkdownFile)).toEqual([
      rootMarkdown,
      nestedMarkdown,
    ]);
  });
});
