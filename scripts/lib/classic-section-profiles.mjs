import { createHash } from 'node:crypto';

const entries = new Map([
  ['The Count of Monte Cristo', {
    sha256: '6b6618196b7b8efd31efae556ae1ee6a0822f3e546eed2c3cf8dcd99c2978bcf',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^Chapter\s+\d+\./i] },
  }],
  ['The Republic', {
    sha256: 'a648194fda28b6fd307e39889434832fc8a5f9b01110c7833eb9f385c6777ef1',
    profile: {
      exclusiveBoundaries: true,
      boundaryPatterns: [/^BOOK\s+[IVXLCDM]+\./i],
      displayTitle(candidate) {
        const roman = /^BOOK\s+([IVXLCDM]+)\./i.exec(candidate.title)?.[1];
        return candidate.level === undefined && roman ? `Analysis — Book ${roman}` : candidate.title;
      },
    },
  }],
  ['Thus Spake Zarathustra', {
    sha256: 'd18d561c8618726f2dbcd07e015630ffc16957074467e5a42130b59bf1da9c81',
    profile: {
      exclusiveBoundaries: true,
      boundaryLevels: [2],
      boundaryPatterns: [/^(?:ZARATHUSTRA’S PROLOGUE|[IVXLCDM]+\.\s+.+)/i],
      startPattern: /PROLOGUE/i,
      endPattern: /^APPENDIX/i,
    },
  }],
  ['Leviathan', {
    sha256: '5ad29939c9175b5c698a2cd476454f4f7070cf06ff1aa6d402ee4a3a72e91695',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^(?:THE INTRODUCTION|CHAPTER\s+[IVXLCDM]+\.|A REVIEW,? AND CONCLUSION)/i], startPattern: /^THE INTRODUCTION$/i },
  }],
  ['Don Quixote', {
    sha256: '95fcf0502fc815c2b449cd654f3fb1a37f317955e4b4c5030b68824ee89d6766',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^CHAPTER\s+[IVXLCDM]+\./i] },
  }],
  ["Grimms' Fairy Tales", {
    sha256: '865c43c9c93bb24dbe0bffb4a13dd4034f44b51eb81ff3ce1c387535c8e9339f',
    profile: { exclusiveBoundaries: true, boundaryLevels: [1], boundaryPatterns: [/^[A-Z0-9][A-Z0-9 ’'.,;:\[\]-]+$/], startPattern: /^THE GOLDEN BIRD$/ },
  }],
  ['Little Women', {
    sha256: 'df38b52227de932039aedaa21d645852f906121cc243cd3864403638d2b92d6b',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^CHAPTER\s+[A-Z-]+(?:\s+.+)?$/] },
  }],
  ["Tess of the d'Urbervilles", {
    sha256: 'eddf3551e996a5359aa9d396a21d104a2851daef34284fc45d15db4fa5724834',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^[IVXLCDM]+$/], startPattern: /^I$/ },
  }],
  ['The Blue Fairy Book', {
    sha256: '7b495921217c48a20db7f3e3726b7b558ba4111a10f567dfabe38afe62df50fd',
    profile: { exclusiveBoundaries: true, boundaryLevels: [1], boundaryPatterns: [/^[A-Z0-9][A-Z0-9 ’'.,;:\[\]-]+$/], startPattern: /^THE BRONZE RING$/ },
  }],
  ['The Works of Edgar Allan Poe - Volume 2', {
    sha256: 'f913a714f2c17e32c5fa8a730515c30b9f49a49b391ff1b51d5c759a0736becf',
    profile: {
      exclusiveBoundaries: true,
      boundaryLevels: [2],
      boundaryPatterns: [/^[A-Z0-9][A-Z0-9 ’'.,;—-]+$/],
      startPattern: /^THE PURLOINED LETTER$/,
      endPattern: /^NOTES TO THE SECOND VOLUME$/,
    },
  }],
  ['Treasure Island', {
    sha256: '69c3e63536cbf2acc3a7c2f2693d643c3ea37dad95326fd824c0c26fd7a64ba8',
    profile: {
      displayTitle(candidate, index) {
        if (index === 16 && /^XXVII\s+Narrative Continued by the Doctor:/i.test(candidate.title)) {
          return candidate.title.replace(/^XXVII\b/i, 'XVII');
        }
        return candidate.title;
      },
    },
  }],
  ['The Great Gatsby', {
    sha256: '3ab388849aa485133543f8d559a6454ace6c10c7ee90c883e8c2e121b65836f7',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^[IVXLCDM]+$/] },
  }],
  ['The Turn of the Screw', {
    sha256: '25745e4cb7748095d32b1a7a1e1aa11c65b291e1ad61245234e72e113fd633c8',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^[IVXLCDM]+$/] },
  }],
  ['The War of the Worlds', {
    sha256: '6dc21da4e018e3f7b947cd0709bb7a8f5c4b37f811c5ae0a8f3357f825634b06',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^[IVXLCDM]+\.\s+.+/] },
  }],
  ['The Jungle Book', {
    sha256: '672e457f36e828e88b8fbc997ff4f322327def7f0054254f2ab362f53bb0bc41',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^(?:Mowgli’s Brothers|Kaa’s Hunting|“Tiger! Tiger!”|The White Seal|“Rikki-Tikki-Tavi”|Toomai of the Elephants|Her Majesty’s Servants)$/] },
  }],
  ['Siddhartha', {
    sha256: '985f29ac9c8ea1e989c6def37f1c409ae81303fae128aed2d41664cd561b73c6',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^(?:THE SON OF THE BRAHMAN|WITH THE SAMANAS|GOTAMA|AWAKENING|KAMALA|WITH THE CHILDLIKE PEOPLE|SANSARA|BY THE RIVER|THE FERRYMAN|THE SON|OM|GOVINDA)$/] },
  }],
  ['The Iliad', {
    sha256: '56b30b8004e3e471a81ac03a8b6643f60da6f8053772c15d2bb77fb2ab8266e6',
    profile: { exclusiveBoundaries: true, boundaryLevels: [1], boundaryPatterns: [/^BOOK\s+[IVXLCDM]+\.$/], startPattern: /^BOOK I\.$/ },
  }],
  ['The Works of Edgar Allan Poe - Volume 1', {
    sha256: '3a085338885309719809976c87eaa08e9cd00c82a89e2c538189587d00852a64',
    profile: {
      exclusiveBoundaries: true,
      boundaryLevels: [2],
      boundaryPatterns: [/^(?:EDGAR ALLAN POE AN APPRECIATION|EDGAR ALLAN POE|TO HELEN|DEATH OF EDGAR A\. POE|THE UNPARALLELED ADVENTURES OF ONE HANS PFAAL \(\*1\)|THE GOLD-BUG|FOUR BEASTS IN ONE—THE HOMO-CAMELEOPARD|THE MURDERS IN THE RUE MORGUE|THE MYSTERY OF MARIE ROGET\.\(\*1\)|THE BALLOON-HOAX|MS\. FOUND IN A BOTTLE|THE OVAL PORTRAIT)$/],
    },
  }],
  ['Heart of Darkness', {
    sha256: 'a2188dc4a4eab3ab08af97734138b44935ffedfe904b34bece180df6c5bb679c',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^[IVXLCDM]+$/] },
  }],
  ['Metamorphosis', {
    sha256: '40a5b0fe4c8c7b9c4f078415c3617d72f13a026c5ac5dbfdc618165950e31c6c',
    profile: { exclusiveBoundaries: true, boundaryLevels: [1], boundaryPatterns: [/^[IVXLCDM]+$/] },
  }],
  ['The Awakening', {
    sha256: '8dd04f9a5cbbf2f90c402dd90b5bb530948b5bb4a2e3bda1d2138193acf42c41',
    profile: {
      exclusiveBoundaries: true,
      boundaryLevels: [1, 2],
      boundaryPatterns: [/^(?:[IVXLCDM]+|BEYOND THE BAYOU|MA’AME PÉLAGIE|DÉSIRÉE’S BABY|A RESPECTABLE WOMAN|THE KISS|A PAIR OF SILK STOCKINGS|THE LOCKET|A REFLECTION)$/],
      boundaryFilter(candidate, { source }) {
        if (!/^[IVXLCDM]+$/.test(candidate.title)) return true;
        return candidate.start < source.indexOf('\n# BEYOND THE BAYOU');
      },
    },
  }],
  ['Beowulf', {
    sha256: '6563ef5d1f7e8a92af7832742f5c37dad9664941879039f3637df6ed67c539a4',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^[IVXLCDM]+\.$/], startPattern: /^I\.$/, endPattern: /^ADDENDA\.?$/ },
  }],
  ['Crime and Punishment', {
    sha256: '955c826dd423169cc77ef0da7987fb8dadb701ce72a205a7c2ca7346fa1decda',
    profile: { exclusiveBoundaries: true, boundaryLevels: [3], boundaryPatterns: [/^(?:CHAPTER\s+[IVXLCDM]+|[IVXLCDM]+)$/] },
  }],
  ['The Yellow Fairy Book', {
    sha256: '0a35ccf9f87ed2de60fc340fc69425669e38a78474fed3f1da9f01d454577bf5',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/.+/], startPattern: /^THE CAT AND THE MOUSE IN PARTNERSHIP$/ },
  }],
  ['The Red Fairy Book', {
    sha256: 'e680b5f336a67289a9bb32b4783b0acc40dc5ab840b0be8e6f7fd605f8fbf362',
    profile: {
      exclusiveBoundaries: true,
      boundaryLevels: [2],
      boundaryPatterns: [/.+/],
      startPattern: /^THE TWELVE DANCING PRINCESSES$/,
      boundaryFilter(candidate) {
        return !/^(?:JACK SELLS THE COW|WONDERFUL GROWTH OF THE BEANSTALK|THE HEN THAT LAYS GOLDEN EGGS\.|‘MASTER! MASTER!’|THE GIANT BREAKS HIS NECK\.)$/.test(candidate.title);
      },
    },
  }],
  ['The House of the Seven Gables', {
    sha256: '8877d129dd15ade9aada83a6236b15e1d46113cf9c85350ce01b4407ee2d3142',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^[IVXLCDM]+\.\s+.+/] },
  }],
  ['David Copperfield', {
    sha256: '00ed9042ebfe20613de251551d7fa7e9a5457b7b45f25d9d5517783b7c3aa1c7',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^CHAPTER\s+\d+\./i] },
  }],
  ['Dracula', {
    sha256: '5a8942d6b536613732f7ac67a308d7f846c8e22d6d2ece79f98cca48b35f34f7',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^CHAPTER\s+[IVXLCDM]+$/i] },
  }],
  ["Gulliver's Travels", {
    sha256: '63d3f6da83a6b7dde87ddb8626440c5c752ad1ce4781829dc2293e7f25717b9c',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^CHAPTER\s+[IVXLCDM]+\.$/i], endPattern: /^FOOTNOTES:?$/i },
  }],
  ['Middlemarch', {
    sha256: 'bc1f276ebd32ec3b9ab26fe8897c528f3dacf5b4903319ed1167280c839c65f5',
    profile: {
      exclusiveBoundaries: true,
      boundaryLevels: [1, 2],
      boundaryPatterns: [/^(?:PRELUDE\.|FINALE\.|CHAPTER\s+[IVXLCDM]+\.)$/i],
      boundaryFilter(candidate, { source }) {
        return candidate.start >= source.lastIndexOf('\n# PRELUDE.\n');
      },
    },
  }],
  ['Moby-Dick', {
    sha256: '002138924d75c68854a7f865f00a109dc4b315000d036ea6ea1b78e7089be74a',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^(?:CHAPTER\s+\d+\.\s+.+|Epilogue)$/i] },
  }],
  ['Northanger Abbey', {
    sha256: '3859eb79cee7c539ccc49d07e303c7b20c30ec213de4f2e3c0b2f9e01b2255e2',
    profile: {
      exclusiveBoundaries: true,
      boundaryLevels: [2],
      boundaryPatterns: [/^CHAPTER\s+\d+$/i],
      boundaryFilter(candidate, { source }) {
        return candidate.start >= source.lastIndexOf('\n## CHAPTER 1\n');
      },
    },
  }],
  ['The Picture of Dorian Gray', {
    sha256: '1cf63a38b4e9e1644c5409b49ffe7e533519dc76b92121a8169cfc4363527526',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^CHAPTER\s+[IVXLCDM]+\.$/i] },
  }],
  ['The King in Yellow', {
    sha256: '493c6eb201a53f868a1e57a07a93a978fb2c7bf5078faef5c241386243d666ba',
    profile: {
      exclusiveBoundaries: true,
      boundaryLevels: [2],
      boundaryPatterns: [/^(?:THE REPAIRER OF REPUTATIONS|THE MASK|IN THE COURT OF THE DRAGON|THE YELLOW SIGN|THE DEMOISELLE D’YS|THE PROPHETS’ PARADISE|THE STREET OF THE FOUR WINDS|THE STREET OF THE FIRST SHELL|THE STREET OF OUR LADY OF THE FIELDS|RUE BARRÉE)$/],
      boundaryFilter(candidate, { source }) {
        return candidate.start >= source.lastIndexOf('\n## THE REPAIRER OF REPUTATIONS\n');
      },
    },
  }],
  ['Oliver Twist', {
    sha256: '88f9f6a9c350a59960c6b4cd1ff1c88de5528812ac56cf003bf88323ca0c866a',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^CHAPTER\s+[IVXLCDM]+\./i] },
  }],
  ['The Phantom of the Opera', {
    sha256: '5f838416d9c934af0acaca8b8454db48b97bbda7c6080472029808ffa3277af2',
    profile: { exclusiveBoundaries: true, boundaryLevels: [2], boundaryPatterns: [/^(?:Prologue|Chapter\s+[IVXLCDM]+\s+.+|Epilogue\.)$/i] },
  }],
  ['The Moonstone', {
    sha256: '71405d5e8f221462ed3da2ba27dbf836840acb8fb25af1df3287b057cb76d585',
    profile: {
      exclusiveBoundaries: true,
      boundaryLevels: [2, 3],
      boundaryPatterns: [/^CHAPTER\s+[IVXLCDM]+$/i, /^[IVXLCDM]+$/, /^(?:FOURTH|SEVENTH|EIGHTH) NARRATIVE\.$/],
      startPattern: /^I$/,
      endPattern: /^FINIS$/,
    },
  }],
  ['The Woman in White', {
    sha256: 'debd0277ec4c99b1f1978f357edc4bde4a94d1638016d8cb517fa83f1cf05f6e',
    profile: {
      exclusiveBoundaries: true,
      boundaryPatterns: [/^[IVXLCDM]+$/, /^THE STORY (?:BEGUN|CONTINUED|CONCLUDED)\b/i, /^[1-5]\. THE NARRATIVE\b/i],
      startPattern: /^THE STORY BEGUN BY WALTER HARTRIGHT$/,
      boundaryFilter(candidate, { source }) {
        return candidate.start >= source.indexOf('\n## THE STORY BEGUN BY WALTER HARTRIGHT\n');
      },
    },
  }],
  ['Les Misérables', {
    sha256: 'ff3bfbd837dd330e2c2b0c0b59d97c08818eea1a84a43e0c4bcec8e019fb677c',
    profile: { exclusiveBoundaries: true, boundaryLevels: [3], boundaryPatterns: [/^CHAPTER\s+[IVXLCDM]+(?:—|$)/i] },
  }],
]);

export function profileForClassic(title, source) {
  const entry = entries.get(title);
  if (!entry) return null;
  const sha256 = createHash('sha256').update(source).digest('hex');
  if (sha256 !== entry.sha256) throw new Error(`${title}: source changed; review its section profile before importing (${sha256}).`);
  return { ...entry.profile, sourceSha256: sha256 };
}
