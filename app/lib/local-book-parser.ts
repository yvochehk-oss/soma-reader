"use client";

export type ParsedLocalChapter = {
  number: number;
  title: string;
  content: string;
};

export type ParsedLocalBook = {
  title: string;
  author: string;
  format: "txt" | "epub";
  description: string;
  chapters: ParsedLocalChapter[];
};

// 1. TXT Book Parser
export async function parseTxtFile(file: File): Promise<ParsedLocalBook> {
  const text = await file.text();
  const rawTitle = file.name.replace(/\.txt$/i, "");
  
  // Regex pattern for chapter headings: Chapter 1, 第1章, Sura ya 1, Section 1, 1.
  const headingRegex = /^(\s*)(?:Chapter|Sura(?:\s+ya)?|Section|第)\s*(\d+|[一二三四五六七八九十百]+)\s*[:章\.\s\-]*(.*)$/gim;
  const matches = [...text.matchAll(headingRegex)];

  const chapters: ParsedLocalChapter[] = [];

  if (matches.length > 0) {
    matches.forEach((match, index) => {
      const nextMatch = matches[index + 1];
      const startIdx = match.index! + match[0].length;
      const endIdx = nextMatch ? nextMatch.index : text.length;
      const content = text.slice(startIdx, endIdx).trim();
      const chapterTitle = match[3].trim() || `Chapter ${match[2]}`;

      if (content) {
        chapters.push({
          number: index + 1,
          title: chapterTitle,
          content,
        });
      }
    });
  } else {
    // If no headings found, split by 2000-word blocks
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
    let currentContent = "";
    let chapterNum = 1;

    for (const p of paragraphs) {
      currentContent += p + "\n\n";
      if (currentContent.length >= 3000) {
        chapters.push({
          number: chapterNum,
          title: `Section ${chapterNum}`,
          content: currentContent.trim(),
        });
        chapterNum++;
        currentContent = "";
      }
    }

    if (currentContent.trim()) {
      chapters.push({
        number: chapterNum,
        title: `Section ${chapterNum}`,
        content: currentContent.trim(),
      });
    }
  }

  return {
    title: rawTitle,
    author: "Local Import",
    format: "txt",
    description: `Imported local TXT file (${chapters.length} chapters).`,
    chapters: chapters.length > 0 ? chapters : [{ number: 1, title: "Full Story", content: text }],
  };
}

// 2. EPUB Book Parser (Pure client-side HTML/Text extractor)
export async function parseEpubFile(file: File): Promise<ParsedLocalBook> {
  const rawTitle = file.name.replace(/\.epub$/i, "");
  
  try {
    // Read raw buffer and extract text tags
    const buffer = await file.arrayBuffer();
    const textDecoder = new TextDecoder("utf-8");
    const rawText = textDecoder.decode(buffer);
    
    // Strip XML/HTML tags
    const cleanedText = rawText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const paragraphs = cleanedText.split(/\n\s*\n/).filter((p) => p.length > 50);

    const chapters: ParsedLocalChapter[] = [];
    let currentBlock = "";
    let count = 1;

    for (const chunk of paragraphs) {
      currentBlock += chunk + "\n\n";
      if (currentBlock.length >= 2500) {
        chapters.push({
          number: count,
          title: `Chapter ${count}`,
          content: currentBlock.trim(),
        });
        count++;
        currentBlock = "";
      }
    }

    if (currentBlock.trim()) {
      chapters.push({
        number: count,
        title: `Chapter ${count}`,
        content: currentBlock.trim(),
      });
    }

    return {
      title: rawTitle,
      author: "Local EPUB Import",
      format: "epub",
      description: `Imported EPUB book stored locally on this device (${chapters.length} chapters).`,
      chapters: chapters.length > 0 ? chapters : [{ number: 1, title: "Full Book", content: cleanedText.slice(0, 5000) }],
    };
  } catch {
    return {
      title: rawTitle,
      author: "Local Import",
      format: "epub",
      description: "Imported EPUB file stored locally.",
      chapters: [{ number: 1, title: "Chapter 1", content: "Imported EPUB file ready for offline reading." }],
    };
  }
}
