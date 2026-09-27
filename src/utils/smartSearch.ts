import {
  ACUnitLocation,
  ACMaintenanceLog,
  resolveFloorFromUnit,
  normalizeACCategory,
} from "../types";

export interface SmartUnitMatch<T = ACUnitLocation> {
  item: T;
  unit: ACUnitLocation;
  score: number;
  matchType: "exact" | "number" | "substring" | "tokens" | "similar";
}

function compactStr(str: string): string {
  return str.toLowerCase().replace(/[\s\-_./(),:;]+/g, "");
}

function expandTokenSynonyms(token: string): string[] {
  const t = token.toLowerCase();
  if (t === "km" || t === "kmr" || t === "rm" || t === "room") {
    return [t, "kamar"];
  }
  if (t === "krd" || t === "kdr" || t === "corridor") {
    return [t, "koridor"];
  }
  if (t === "lt" || t === "fl" || t === "floor") {
    return [t, "lantai"];
  }
  if (t === "bs" || t === "b1" || t === "b2") {
    return [t, "basement"];
  }
  if (t === "caffe" || t === "cafe" || t === "kafe") {
    return ["caffe", "cafe", "kafe"];
  }
  return [t];
}

// Compute simple edit distance for typo tolerance on short words/numbers
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > 2) return 99;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Menghitung skor kecocokan & persamaan (similarity) antara unit AC dengan kata kunci pencarian.
 * Mendukung pencarian hanya dengan menulis nomor kamar (misal: "502", "02", "1201b"),
 * pencarian multi-kata tidak berurutan (misal: "koridor 906", "lift 9"), maupun typo ringan.
 */
export function scoreUnitSmartMatch(
  unit: ACUnitLocation,
  rawQuery: string
): { score: number; matchType: "exact" | "number" | "substring" | "tokens" | "similar" | "none" } {
  const q = rawQuery.toLowerCase().trim();
  if (!q) return { score: 1, matchType: "exact" };

  const qCompact = compactStr(q);
  const floor = resolveFloorFromUnit(unit);
  const cat = normalizeACCategory(unit.category);

  const nameLower = (unit.name || "").toLowerCase().trim();
  const codeLower = (unit.code || "").toLowerCase().trim();
  const floorLower = floor.toLowerCase();
  const catLower = `${cat} ${unit.category || ""}`.toLowerCase();
  const notesLower = (unit.notes || "").toLowerCase();

  const nameCompact = compactStr(nameLower);
  const codeCompact = compactStr(codeLower);
  const fullText = `${nameLower} ${codeLower} ${floorLower} ${catLower} ${notesLower}`;
  const fullCompact = compactStr(fullText);

  // 1. Exact full match on name or code
  if (nameLower === q || nameCompact === qCompact || (codeCompact && codeCompact === qCompact)) {
    return { score: 1000, matchType: "exact" };
  }
  if (nameCompact === `kamar${qCompact}` || nameCompact === `km${qCompact}`) {
    return { score: 995, matchType: "exact" };
  }

  // Extract numeric parts from query and unit
  const qNumWithSuffixMatch = qCompact.match(/^(\d+)([a-z])?$/);
  const qPureDigits = q.replace(/\D+/g, "");
  const unitAlphaNumTokens: string[] =
    `${nameLower} ${codeLower}`.match(/\d+\s*[a-z]?/gi)?.map((s) => compactStr(s)) || [];
  const unitDigitsList: string[] = `${nameLower} ${codeLower}`.match(/\d+/g) || [];

  // 2. If user typed a room number or number+letter (e.g. "502", "1201b", "06", "307")
  if (qNumWithSuffixMatch) {
    const qDigits = qNumWithSuffixMatch[1];
    const qSuffix = qNumWithSuffixMatch[2] || "";
    const qCombined = `${qDigits}${qSuffix}`;

    // Exact match on room number + suffix (e.g. "1201b" -> "Kamar 1201 B")
    if (unitAlphaNumTokens.includes(qCombined)) {
      const isKamar = nameLower.startsWith("kamar");
      return { score: isKamar ? 990 : 965, matchType: "exact" };
    }

    // Exact match on digits (e.g. "502" -> "Kamar 502", "1201" -> "Kamar 1201 A" & "Kamar 1201 B")
    if (!qSuffix && unitDigitsList.includes(qDigits)) {
      const isKamar = nameLower.startsWith("kamar");
      return { score: isKamar ? 985 : 955, matchType: "number" };
    }

    // Prefix match on room number (e.g. "50" -> "501", "502"... or "120" -> "1201", "1202")
    if (unitDigitsList.some((un) => un.startsWith(qDigits))) {
      const isKamar = nameLower.startsWith("kamar");
      return { score: isKamar ? 910 : 880, matchType: "number" };
    }

    // Suffix match on room number (e.g. "02" -> "502", "602", "1202", or "502" -> "1502")
    if (qDigits.length >= 2 && unitDigitsList.some((un) => un.endsWith(qDigits))) {
      const isKamar = nameLower.startsWith("kamar");
      return { score: isKamar ? 870 : 840, matchType: "number" };
    }

    // Substring inside room number (e.g. "20" -> "1201", "1202", "720")
    if (unitDigitsList.some((un) => un.includes(qDigits))) {
      const isKamar = nameLower.startsWith("kamar");
      return { score: isKamar ? 830 : 800, matchType: "number" };
    }

    // Persamaan Nomor Kamar (Similar Room Numbers):
    // Jika user mengetik 3 atau 4 digit (misal "502" atau "504"):
    // - Kamar lain dengan akhiran nomor urut kamar yang sama (misal akhiran "02": 302, 602, 702, 802, 902, 1002, 1102, 1202)
    // - Kamar tetangga terdekat di lantai yang sama (misal 501, 503 untuk input 502/504)
    if (qDigits.length >= 3) {
      const roomSuffix2 = qDigits.slice(-2); // e.g. "02" from "502"
      const qNumVal = parseInt(qDigits, 10);

      for (const un of unitDigitsList) {
        const uNumVal = parseInt(un, 10);
        // Tetangga nomor kamar terdekat di lantai yang sama (±1 atau ±2, misal ketik 502 muncul juga persamaan 501, 503)
        if (!isNaN(qNumVal) && !isNaN(uNumVal) && Math.abs(qNumVal - uNumVal) <= 2) {
          return {
            score: 460 - Math.abs(qNumVal - uNumVal) * 20,
            matchType: "similar",
          };
        }
        // Akhiran nomor kamar yang sama di lantai lain (misal ketik 502 -> persamaan 302, 602, 702, 1202)
        if (un.length >= 3 && un.slice(-2) === roomSuffix2) {
          return {
            score: 410,
            matchType: "similar",
          };
        }
      }
    }
  }

  // 3. Direct substring or compact substring match (e.g. "kamar 502", "kamar502", "mrv1202a")
  if (nameLower.startsWith(q) || nameCompact.startsWith(qCompact)) {
    return { score: 890, matchType: "substring" };
  }
  if (nameLower.includes(q) || nameCompact.includes(qCompact)) {
    return { score: 820, matchType: "substring" };
  }
  if (codeLower.includes(q) || (codeCompact && codeCompact.includes(qCompact))) {
    return { score: 780, matchType: "substring" };
  }

  // Check if query has digits embedded with words (e.g., "kamar 502", "km 1201b")
  if (qPureDigits.length >= 2 && unitDigitsList.includes(qPureDigits)) {
    return { score: 850, matchType: "number" };
  }

  // 4. Multi-token smart match across name + code + floor + category + notes
  // Contoh: "koridor 906" cocok dengan "Koridor Depan 906", "lift 9" cocok dengan "Koridor Depan Lift" di "Lantai 9"
  const rawTokens = q.split(/[\s\-_./(),]+/).filter(Boolean);
  if (rawTokens.length > 0) {
    let allTokensMatched = true;
    let matchedCount = 0;

    for (const token of rawTokens) {
      const synonyms = expandTokenSynonyms(token);
      const tokenCompact = compactStr(token);
      const matched =
        synonyms.some((syn) => fullText.includes(syn) || fullCompact.includes(compactStr(syn))) ||
        (tokenCompact.length >= 2 && fullCompact.includes(tokenCompact));

      if (matched) {
        matchedCount++;
      } else {
        allTokensMatched = false;
      }
    }

    if (allTokensMatched) {
      return { score: 740 + Math.min(rawTokens.length * 10, 40), matchType: "tokens" };
    }

    // Partial token match if user typed multiple words and at least the main number/keyword matched
    if (rawTokens.length >= 2 && matchedCount >= rawTokens.length - 1) {
      if (qPureDigits.length >= 2 && unitDigitsList.some((un) => un.includes(qPureDigits))) {
        return { score: 650, matchType: "tokens" };
      }
    }
  }

  // 5. Fuzzy / Typo tolerance on words in name or code (e.g. "kordor", "meting", "genset")
  const unitWords = `${nameLower} ${codeLower} ${floorLower}`.split(/[\s\-_./(),]+/).filter((w) => w.length >= 3);
  for (const token of rawTokens) {
    if (token.length >= 3) {
      for (const uw of unitWords) {
        if (uw.startsWith(token) || token.startsWith(uw)) {
          return { score: 520, matchType: "similar" };
        }
        const dist = editDistance(token, uw);
        if (dist <= 1 || (token.length >= 5 && dist <= 2)) {
          return { score: 480 - dist * 30, matchType: "similar" };
        }
      }
    }
  }

  // Also check if query has a 3-digit room number inside a phrase like "kamar 504" where 504 doesn't exist
  if (qPureDigits.length >= 3) {
    const roomSuffix2 = qPureDigits.slice(-2);
    const qNumVal = parseInt(qPureDigits, 10);
    for (const un of unitDigitsList) {
      const uNumVal = parseInt(un, 10);
      if (!isNaN(qNumVal) && !isNaN(uNumVal) && Math.abs(qNumVal - uNumVal) <= 2) {
        return { score: 430 - Math.abs(qNumVal - uNumVal) * 20, matchType: "similar" };
      }
      if (un.length >= 3 && un.slice(-2) === roomSuffix2) {
        return { score: 390, matchType: "similar" };
      }
    }
  }

  return { score: 0, matchType: "none" };
}

/**
 * Mengambil daftar saran persamaan kamar/unit ("Persamaan untuk diklik")
 * yang diurutkan dari yang paling akurat diikuti kamar/unit yang serupa.
 */
export function getSmartUnitSuggestions<T>(
  items: T[],
  getUnit: (item: T) => ACUnitLocation,
  rawQuery: string,
  maxSuggestions: number = 8
): SmartUnitMatch<T>[] {
  const q = rawQuery.trim();
  if (!q) return [];

  const matches: SmartUnitMatch<T>[] = [];
  for (const item of items) {
    const unit = getUnit(item);
    const { score, matchType } = scoreUnitSmartMatch(unit, q);
    if (score > 0 && matchType !== "none") {
      matches.push({ item, unit, score, matchType });
    }
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.unit.order || 0) - (b.unit.order || 0);
  });

  return matches.slice(0, maxSuggestions);
}

/**
 * Memfilter dan mengurutkan daftar unit berdasarkan pencarian pintar.
 * Jika ada hasil yang cocok langsung (score >= 500), tampilkan hasil tersebut
 * ditambah persamaan terdekat jika hasil langsung sedikit.
 * Jika tidak ada hasil langsung (misal salah ketik nomor kamar), otomatis tampilkan persamaan terdekat.
 */
export function smartFilterAndSortUnits<T>(
  items: T[],
  getUnit: (item: T) => ACUnitLocation,
  rawQuery: string
): T[] {
  const q = rawQuery.trim();
  if (!q) return items;

  const scored: SmartUnitMatch<T>[] = [];
  for (const item of items) {
    const unit = getUnit(item);
    const { score, matchType } = scoreUnitSmartMatch(unit, q);
    if (score > 0 && matchType !== "none") {
      scored.push({ item, unit, score, matchType });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.unit.order || 0) - (b.unit.order || 0);
  });

  const strongMatches = scored.filter((m) => m.score >= 500);
  // Jika pengguna sudah memilih/mengetik nama lengkap persis (score >= 990) dan hanya ada sedikit yang cocok persis,
  // tampilkan yang cocok langsung namun tetap sertakan persamaan jika user baru mengetik angka saja
  const isPureNumberQuery = /^\d+[a-z]?$/i.test(compactStr(q));
  if (strongMatches.length > 0 && !isPureNumberQuery) {
    return strongMatches.map((m) => m.item);
  }

  // Jika pengguna mengetik nomor kamar saja (misal "502") atau kata kunci yang punya persamaan,
  // sertakan juga persamaan terdekat di bawah hasil utama agar mudah diklik
  if (strongMatches.length >= 6) {
    return strongMatches.map((m) => m.item);
  }

  return scored.slice(0, Math.max(strongMatches.length, 10)).map((m) => m.item);
}

/**
 * Pencarian pintar untuk log riwayat perawatan AC (ACHistoryView)
 */
export function scoreLogSmartMatch(log: ACMaintenanceLog, rawQuery: string): number {
  const q = rawQuery.toLowerCase().trim();
  if (!q) return 1;

  const pseudoUnit: ACUnitLocation = {
    id: log.unit_id || log.log_id,
    name: log.unit_name || "",
    category: normalizeACCategory(log.category),
    notes: `${log.user_name || ""} ${log.notes || ""}`,
  };

  const unitMatch = scoreUnitSmartMatch(pseudoUnit, rawQuery);
  if (unitMatch.score > 0) return unitMatch.score;

  const userLower = (log.user_name || "").toLowerCase();
  const notesLower = (log.notes || "").toLowerCase();
  if (userLower.includes(q) || notesLower.includes(q)) {
    return 600;
  }

  return 0;
}
