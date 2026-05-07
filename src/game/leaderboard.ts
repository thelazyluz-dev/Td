export interface ScoreEntry {
  wave: number;
  gold: number;
  date: string;
}

const KEY = 'bugoff_scores_v1';

export function saveScore(wave: number, gold: number): void {
  const list = getScores();
  list.push({ wave, gold, date: new Date().toLocaleDateString('he-IL') });
  list.sort((a, b) => b.wave - a.wave || b.gold - a.gold);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10)));
}

export function getScores(): ScoreEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}
