/** Note sur 20 : somme des scores (partiels pour correspondances/classements) / nombre de questions, arrondie au dixième. */
export function score20(graded: { result: { score: number } }[]): number {
  if (!graded.length) return 0;
  return (
    Math.round((graded.reduce((s, g) => s + g.result.score, 0) / graded.length) * 20 * 10) / 10
  );
}
