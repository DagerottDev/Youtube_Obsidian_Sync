export function collectMarkdownFiles<TFile>(
  folder: { children: readonly unknown[] },
  isFolder: (entry: unknown) => entry is { children: readonly unknown[] },
  isMarkdownFile: (entry: unknown) => entry is TFile,
): TFile[] {
  const files: TFile[] = [];
  for (const entry of folder.children) {
    if (isFolder(entry)) {
      files.push(...collectMarkdownFiles(entry, isFolder, isMarkdownFile));
    } else if (isMarkdownFile(entry)) {
      files.push(entry);
    }
  }
  return files;
}
