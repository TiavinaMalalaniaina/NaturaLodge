export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatCurrency(n: number): string {
  return n.toLocaleString('fr-MG') + ' Ar';
}

// Date locale (pas toISOString — qui convertit en UTC et décale d'un jour dans un
// fuseau en avance sur UTC, ex: UTC+3 à Madagascar, puisque les dates manipulées
// dans l'app sont construites en minuit local, pas en minuit UTC).
export function dateToLocalStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayLocalStr(): string {
  return dateToLocalStr(new Date());
}

/** Ajoute `days` jours à une date "YYYY-MM-DD", en local (évite le piège UTC de `new Date(str)`). */
export function addDaysToLocalStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return dateToLocalStr(date);
}

export function nightsBetween(arrival: Date | string, departure: Date | string): number {
  const a = typeof arrival === 'string' ? new Date(arrival) : arrival;
  const b = typeof departure === 'string' ? new Date(departure) : departure;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

/** Si le départ actuel n'est plus après la nouvelle arrivée, le vide (l'utilisateur re-choisit). */
export function resetDepartureIfInvalid(newArrival: string, currentDeparture: string): string {
  if (currentDeparture && newArrival >= currentDeparture) return '';
  return currentDeparture;
}
