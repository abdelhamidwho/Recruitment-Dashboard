import { Candidate } from "./apify";
import { SearchFilters } from "./buildBooleanQuery";

export function scoreCandidate(candidate: Candidate, filters: Partial<SearchFilters>) {
  let score = 0;
  const breakdown: string[] = [];

  // Must-have skills (Weight: 5)
  const mustHave = filters.mustHave || [];
  mustHave.forEach((skill) => {
    if (candidate.skills.some(s => s.toLowerCase().includes(skill.toLowerCase())) || 
        candidate.summary?.toLowerCase().includes(skill.toLowerCase())) {
      score += 5;
      breakdown.push(`+5: Has must-have skill "${skill}"`);
    } else {
      score -= 5;
      breakdown.push(`-5: Missing must-have skill "${skill}"`);
    }
  });

  // Nice-to-have skills (Weight: 2)
  const niceToHave = filters.niceToHave || [];
  niceToHave.forEach((skill) => {
    if (candidate.skills.some(s => s.toLowerCase().includes(skill.toLowerCase())) || 
        candidate.summary?.toLowerCase().includes(skill.toLowerCase())) {
      score += 2;
      breakdown.push(`+2: Has nice-to-have skill "${skill}"`);
    }
  });

  // Years of Experience (Bonus/Penalty)
  // `totalYearsExperience` is `null`/`undefined` when a source has no experience
  // data at all (e.g. GitHub) as opposed to a genuine, real zero (e.g. a new
  // graduate). `candidate.totalYearsExperience || 0` used to conflate the two,
  // silently penalising every candidate from a source that simply doesn't report
  // experience. An absent figure is now neutral: no bonus, no penalty, and the
  // breakdown says so explicitly instead of omitting the line.
  const yoe = candidate.totalYearsExperience;
  if (yoe === null || yoe === undefined) {
    breakdown.push(`+0: Experience unknown (source does not report years of experience)`);
  } else if (filters.yearsMin && yoe < filters.yearsMin) {
    score -= 10;
    breakdown.push(`-10: Experience (${yoe}y) below minimum (${filters.yearsMin}y)`);
  } else if (filters.yearsMax && yoe > filters.yearsMax) {
    score -= 5;
    breakdown.push(`-5: Experience (${yoe}y) above maximum (${filters.yearsMax}y)`);
  } else if (yoe >= (filters.yearsMin || 0)) {
    score += 5;
    breakdown.push(`+5: Experience (${yoe}y) within range`);
  }

  // Titles
  const titles = filters.titles || [];
  if (titles.length > 0) {
    if (titles.some(t => candidate.currentTitle?.toLowerCase().includes(t.toLowerCase()))) {
      score += 5;
      breakdown.push(`+5: Current title matches target titles`);
    }
  }

  // Excluded keywords (Hard flag)
  const exclude = filters.exclude || [];
  exclude.forEach((keyword) => {
    if (candidate.summary?.toLowerCase().includes(keyword.toLowerCase()) || 
        candidate.headline?.toLowerCase().includes(keyword.toLowerCase())) {
      score -= 50;
      breakdown.push(`-50: Contains excluded keyword "${keyword}"`);
    }
  });

  return {
    score: Math.max(0, Math.min(100, 50 + score)), // Normalize roughly 0-100 starting from a base of 50
    breakdown
  };
}
