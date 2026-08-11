// Données partagées des demandes, réutilisées par le rendu HTML des emails
// et par la pièce jointe PDF récapitulative.

export interface RequestDataPair {
  label: string;
  value: string;
}

// Nom affiché : prénom seul quand il est identique au nom (évite « akonate akonate »)
export function displayName(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.trim() || '';
  const last = lastName?.trim() || '';
  if (!first && !last) return '';
  if (!last || first.toLowerCase() === last.toLowerCase()) return first || last;
  return `${first} ${last}`;
}

// Paires label/valeur des informations saisies par l'utilisateur
export function requestDataPairs(request: any): RequestDataPair[] {
  const data = request.data && typeof request.data === 'object' ? request.data : {};
  const fields = Array.isArray(request.type?.fields) ? request.type.fields : [];
  const pairs: RequestDataPair[] = [];

  const requesterName = request.requester
    ? displayName(request.requester.firstName, request.requester.lastName)
    : (request.requesterName || 'Utilisateur');
  const requesterEmail = request.requesterEmail || request.requester?.email || '';
  pairs.push({
    label: 'Demandeur',
    value: requesterEmail ? `${requesterName} (${requesterEmail})` : requesterName,
  });
  pairs.push({ label: 'Type de demande', value: request.type?.name || 'Demande' });

  for (const f of fields) {
    const value = data[f.key];
    if (f?.key && value !== undefined && value !== '') {
      pairs.push({ label: f.label || f.key, value: String(value) });
    }
  }
  for (const [key, value] of Object.entries(data)) {
    if (!fields.some((f: any) => f.key === key)) {
      pairs.push({ label: key, value: String(value) });
    }
  }

  if (request.details) pairs.push({ label: 'Détails', value: String(request.details) });
  pairs.push({ label: 'Date de soumission', value: new Date(request.createdAt).toLocaleString('fr-FR') });

  const decider = request.decidedBy;
  const deciderName = request.decidedByName || (decider ? displayName(decider.firstName, decider.lastName) : '');
  const deciderEmail = request.decidedByEmail || decider?.email || '';
  if (request.decidedAt && deciderName) {
    pairs.push({
      label: 'Décidé par',
      value: deciderEmail ? `${deciderName} (${deciderEmail})` : deciderName,
    });
  }
  return pairs;
}

// Identifiant court dérivé du jeton de décision (référence de la demande)
export function requestSlug(request: { decisionToken: string }): string {
  return request.decisionToken.replace(/-/g, '').slice(-8).toUpperCase();
}

// Nom de fichier base de la pièce jointe : Demande_<réf>_<type>
export function attachmentBaseName(request: any): string {
  const typeSlug = (request.type?.name || 'demande')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .slice(0, 40);
  return `Demande_${requestSlug(request)}_${typeSlug}`;
}