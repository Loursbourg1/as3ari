import { readJson, writeJson } from '../platform/platform';

const VOTES_KEY = 'as3ari.report_votes'; // Record<string, 'like' | 'dislike'>
const RATINGS_KEY = 'as3ari.report_ratings'; // Record<string, { likes: number; dislikes: number }>

export interface ReportRating {
  likes: number;
  dislikes: number;
  userVote: 'like' | 'dislike' | null;
}

/**
 * Deterministic seed for demo / baseline items so every observation
 * has an initial community consensus baseline.
 */
export function getBaseRating(reportId: string, corroboratingReports = 0): { likes: number; dislikes: number } {
  let hash = 0;
  for (let i = 0; i < reportId.length; i++) {
    hash = (hash * 31 + reportId.charCodeAt(i)) >>> 0;
  }
  const baseLikes = Math.max(1, (hash % 16) + corroboratingReports * 2 + 2);
  const baseDislikes = hash % 9 === 0 ? 1 : 0;
  return { likes: baseLikes, dislikes: baseDislikes };
}

export function getReportRating(reportId: string, corroboratingReports = 0): ReportRating {
  const votes = readJson<Record<string, 'like' | 'dislike'>>(VOTES_KEY, {});
  const ratings = readJson<Record<string, { likes: number; dislikes: number }>>(RATINGS_KEY, {});
  const base = ratings[reportId] ?? getBaseRating(reportId, corroboratingReports);
  const userVote = votes[reportId] ?? null;

  return {
    likes: base.likes,
    dislikes: base.dislikes,
    userVote,
  };
}

export function voteReport(
  reportId: string,
  voteType: 'like' | 'dislike',
  corroboratingReports = 0,
): ReportRating {
  const votes = readJson<Record<string, 'like' | 'dislike'>>(VOTES_KEY, {});
  const ratings = readJson<Record<string, { likes: number; dislikes: number }>>(RATINGS_KEY, {});
  const currentBase = ratings[reportId] ?? getBaseRating(reportId, corroboratingReports);
  const currentVote = votes[reportId] ?? null;

  let newLikes = currentBase.likes;
  let newDislikes = currentBase.dislikes;
  let newVote: 'like' | 'dislike' | null = voteType;

  if (currentVote === voteType) {
    // Clicking the same vote toggles it off
    newVote = null;
    delete votes[reportId];
    if (voteType === 'like') {
      newLikes = Math.max(0, newLikes - 1);
    } else {
      newDislikes = Math.max(0, newDislikes - 1);
    }
  } else {
    // If user previously voted the opposite, undo that vote first
    if (currentVote === 'like') {
      newLikes = Math.max(0, newLikes - 1);
    } else if (currentVote === 'dislike') {
      newDislikes = Math.max(0, newDislikes - 1);
    }

    if (voteType === 'like') {
      newLikes += 1;
    } else {
      newDislikes += 1;
    }
    votes[reportId] = voteType;
  }

  ratings[reportId] = { likes: newLikes, dislikes: newDislikes };
  writeJson(VOTES_KEY, votes);
  writeJson(RATINGS_KEY, ratings);

  return {
    likes: newLikes,
    dislikes: newDislikes,
    userVote: newVote,
  };
}

export function getAccuracyPct(likes: number, dislikes: number): number | null {
  const total = likes + dislikes;
  if (total <= 0) return null;
  return Math.round((likes / total) * 100);
}
