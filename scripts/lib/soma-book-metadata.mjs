export const SOMA_CATEGORIES = Object.freeze([
  "Romance",
  "Thriller",
  "Sci-Fi",
  "Historical",
  "Fantasy",
  "Contemporary",
  "Urban Fantasy",
]);

const CATEGORY_BY_KEY = new Map(SOMA_CATEGORIES.map((category) => [category.toLowerCase(), category]));
CATEGORY_BY_KEY.set("science fiction", "Sci-Fi");
CATEGORY_BY_KEY.set("sci fi", "Sci-Fi");
CATEGORY_BY_KEY.set("scifi", "Sci-Fi");
CATEGORY_BY_KEY.set("urban-fantasy", "Urban Fantasy");

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeCategory(value) {
  const raw = text(value);
  if (!raw) return "";
  const key = raw.toLowerCase().replace(/_/g, "-").replace(/\s+/g, " ");
  return CATEGORY_BY_KEY.get(key) || CATEGORY_BY_KEY.get(key.replace(/-/g, " ")) || "";
}

export function normalizeTags(value) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const tags = raw
    .filter((tag) => typeof tag === "string")
    .map((tag) => tag.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  const unique = new Map();
  for (const tag of tags) if (!unique.has(tag.toLowerCase())) unique.set(tag.toLowerCase(), tag);
  return [...unique.values()];
}

export function validateStoryMetadataShape(metadata, source = "story_meta.json") {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error(`${source} must contain a JSON object.`);
  }
  for (const field of ["title", "title_original", "author", "description", "category", "translation_of_slug", "translationOfSlug"]) {
    if (metadata[field] !== undefined && typeof metadata[field] !== "string") {
      throw new Error(`${source}: ${field} must be a string when provided.`);
    }
  }
  if (metadata.tags !== undefined && !Array.isArray(metadata.tags)) {
    throw new Error(`${source}: tags must be an array of strings.`);
  }
  if (Array.isArray(metadata.tags) && metadata.tags.some((tag) => typeof tag !== "string")) {
    throw new Error(`${source}: every tag must be a string.`);
  }
}

export function assertPublicationMetadata(book, source = "book") {
  const missing = [];
  if (!text(book.title)) missing.push("title");
  if (!text(book.author)) missing.push("author");
  if (!text(book.description)) missing.push("description");
  if (!book.coverDataUrl && !book.coverUrl) missing.push("cover");
  if (book.language !== "en" && book.language !== "sw") missing.push("language (en or sw)");
  if (missing.length) throw new Error(`${source} cannot be published: missing ${missing.join(", ")}.`);

  const category = normalizeCategory(book.category);
  if (!category) {
    throw new Error(`${source} cannot be published: category must be one of ${SOMA_CATEGORIES.join(", ")}.`);
  }
  const tags = normalizeTags(book.tags);
  if (!tags.length) throw new Error(`${source} cannot be published: add at least one specific tag.`);
  if (tags.length > 12) throw new Error(`${source} cannot be published: use at most 12 tags.`);
  const invalidTag = tags.find((tag) => tag.length > 40);
  if (invalidTag) throw new Error(`${source} cannot be published: tag “${invalidTag}” exceeds 40 characters.`);
  return { category, tags };
}
