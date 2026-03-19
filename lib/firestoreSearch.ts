import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export interface SearchResult {
  title: string;
  key: string[];
  description: string;
  documentNumber: string;
  mostUsefulFor: string[];
  id: string | number;
  category: string[];
}

const STOP_WORDS = new Set([
  "the","and","for","are","but","not","you","all","can","had","her","was",
  "one","our","out","has","his","how","its","may","new","now","old","see",
  "way","who","did","get","let","say","she","too","use","than","them",
  "then","they","this","will","with","from","have","been","each","make",
  "like","just","over","such","take","year","into","some","could","would",
  "what","about","which","when","their","there","these","other","after",
  "being","where","does","that","very","your","also","back","come","first",
  "give","only","same","should","still","most","during","before","going",
  "want","need","know","think","really","because","through","after","before",
  "while","about","doing","getting","looking","moving","starting","been",
]);

function scoreDocument(data: Record<string, unknown>, queryWords: string[]): number {
  if (!queryWords.length) return 0;
  let score = 0;

  const str = (v: unknown): string => (typeof v === "string" ? v : "").toLowerCase();
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => str(x)) : [];

  const title = str(data.title);
  const description = str(data.description);
  const keywords = arr(data.keywords);
  const usefulFor = str(data.usefulFor);
  const dsContent = str(data.dsContent);

  const hgm = (data.helpGuideMe || {}) as Record<string, unknown>;
  const triggerPhrases = arr(hgm.triggerPhrases);
  const laypersonTitle = str(hgm.laypersonTitle);
  const humanMoments = arr(data.humanMoments);
  const situations = arr(data.suitabilityPairs).length
    ? (data.suitabilityPairs as Array<Record<string, unknown>>).map(
        (p) => `${str(p.situation)} ${str(p.need)}`
      )
    : [];

  for (const word of queryWords) {
    if (title.includes(word)) score += 5;
    if (keywords.some((k) => k.includes(word))) score += 3;
    if (triggerPhrases.some((t) => t.includes(word))) score += 3;
    if (laypersonTitle.includes(word)) score += 3;
    if (humanMoments.some((h) => h.includes(word))) score += 2;
    if (situations.some((s) => s.includes(word))) score += 2;
    if (description.includes(word)) score += 1;
    if (usefulFor.includes(word)) score += 1;
    if (dsContent.includes(word)) score += 1;
  }

  return score;
}

export async function searchFirestoreDocuments(
  query: string
): Promise<SearchResult[]> {
  
  const colRef = collection(db, "BAKR_documents_with_refs");
  console.log("[BAKR Search] Querying Firestore collection BAKR_documents_with_refs...");
  const snapshot = await getDocs(colRef);
  console.log("[BAKR Search] Documents found in collection:", snapshot.size);
  console.log("[BAKR Search] Query words:", queryWords);

  // Extract meaningful query words
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter((w) => !STOP_WORDS.has(w));

  if (queryWords.length === 0) return [];

  // Score each document
  const scored: { data: Record<string, unknown>; score: number; id: string }[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    const score = scoreDocument(data, queryWords);
    if (score > 0) {
      scored.push({ data, score, id: doc.id });
    }
  });

  console.log("[BAKR Search] Documents with score > 0:", scored.length);
  if (scored.length > 0) console.log("[BAKR Search] Top 3:", scored.slice(0,3).map(s => ({ title: s.data.title, score: s.score })));
  scored.sort((a, b) => b.score - a.score);

  // Group by documentNumber
  const groups = new Map<string, typeof scored>();
  for (const item of scored) {
    const num = String(item.data.documentNumber || item.id);
    if (!groups.has(num)) groups.set(num, []);
    groups.get(num)!.push(item);
  }

  // Convert to SearchResult (GroupedDocument) format
  const expectedCategories = ["ML", "CL", "DK", "FF", "AE"];
  const results: SearchResult[] = [];

  const sortedGroups = Array.from(groups.entries())
    .sort(
      (a, b) =>
        Math.max(...b[1].map((d) => d.score)) -
        Math.max(...a[1].map((d) => d.score))
    )
    .slice(0, 15);

  for (const [docNum, docs] of sortedGroups) {
    const best =
      docs.find((d) => String(d.data.category) === "AE") ||
      docs.find((d) => String(d.data.category) === "ML") ||
      docs[0];

    const categoryArray: string[] = [];
    const keyArray: string[] = [];

    for (const cat of expectedCategories) {
      const variant = docs.find((d) => String(d.data.category) === cat);
      categoryArray.push(variant ? cat : "");
      keyArray.push(variant ? String(variant.data.key || variant.id) : "");
    }

    results.push({
      title: String(best.data.title || `Document ${docNum}`),
      key: keyArray,
      description: String(best.data.description || ""),
      documentNumber: docNum,
      mostUsefulFor: Array.isArray(best.data.mostUsefulFor)
        ? best.data.mostUsefulFor.map(String)
        : [],
      id: best.id,
      category: categoryArray,
    });
  }

  return results;
}
