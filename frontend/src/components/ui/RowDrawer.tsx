/**
 * RowDrawer — reproduit fidèlement le formulaire Word FRM-IAM-002
 * "Formulaire de demande d'accès"
 *
 * Structure :
 *   [En-tête]  Titre + Référence / Date / N°
 *   [Section 1] Service ou site demandeur
 *   [Section 2] Création d'un nouveau compte utilisateur
 *   [Section 3] Accès et applications demandés
 *   [Section 4] Validation service sécurité (pré-rempli "Favorable")
 */

import { useEffect, useState, useRef } from 'react';
import {
  X, Edit2, Check, Trash2, Loader2, Printer,
} from 'lucide-react';
import type { Column, Row } from '../../types';

// ─── Palette du formulaire Word ───────────────────────────────────────────────
const BLUE_DARK  = '#2E5FA3';   // titre principal (adapté dark mode)
const BLUE_HDR   = '#1e3a6e';   // fond en-têtes de section (BDD7EE adapté dark)
const BLUE_SUB   = '#1a2f55';   // sous-catégorie (DEEBF7 adapté dark)
const BORDER_CLR = '#334155';   // couleur bordures tableau

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Cherche une valeur de colonne par fragment de nom (insensible à la casse) */
function findVal(
  values: Record<string, any>,
  columns: Column[],
  ...fragments: string[]
): { col: Column | null; val: any } {
  for (const frag of fragments) {
    const col = columns.find((c) =>
      c.name.toLowerCase().includes(frag.toLowerCase())
    );
    if (col) return { col, val: values[col.id] ?? '' };
  }
  return { col: null, val: '' };
}

/** Génère la date du jour au format français */
function todayFR() {
  return new Date().toLocaleDateString('fr-FR');
}

// ─── Composant champ inline ──────────────────────────────────────────────────
function InlineField({
  label,
  col,
  value,
  editing,
  onChange,
  placeholder = '________________________________',
  type = 'text',
  className = '',
  wide = false,
}: {
  label: string;
  col: Column | null;
  value: any;
  editing: boolean;
  onChange: (v: any) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  wide?: boolean;
}) {
  const display = value !== null && value !== undefined && value !== ''
    ? String(value)
    : '';

  const inputCls = [
    'bg-transparent border-0 border-b border-dashed outline-none text-sm transition-colors',
    editing
      ? 'border-blue-400 focus:border-blue-300 text-white'
      : 'border-slate-500 text-slate-200 cursor-default',
    wide ? 'w-full' : 'flex-1 min-w-0',
  ].join(' ');

  return (
    <div className={`flex items-baseline gap-1 ${className}`}>
      <span className="text-xs font-medium whitespace-nowrap shrink-0" style={{ color: '#94a3b8' }}>
        {label} :
      </span>
      {editing && col ? (
        col.type === 'LONG_TEXT' ? (
          <textarea
            className={`${inputCls} resize-none`}
            style={{ minHeight: 40 }}
            value={display}
            onChange={(e) => onChange(e.target.value)}
            readOnly={!editing}
          />
        ) : col.type === 'DATE' ? (
          <input type="date" className={inputCls} value={display}
            onChange={(e) => onChange(e.target.value)} />
        ) : col.type === 'DROPDOWN' ? (
          <select
            className={`${inputCls} bg-transparent`}
            style={{ backgroundColor: 'transparent' }}
            value={display}
            onChange={(e) => onChange(e.target.value)}>
            <option value="">—</option>
            {(col.options as string[] || []).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            className={inputCls}
            value={display}
            placeholder={editing ? '' : placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      ) : (
        <span className="text-sm border-b border-dashed border-slate-500 flex-1 min-w-0 text-slate-200 pb-px">
          {display || <span className="opacity-30">{placeholder}</span>}
        </span>
      )}
    </div>
  );
}

/** Champ Oui/Non (checkbox style word) */
function YesNoField({
  label,
  col,
  value,
  editing,
  onChange,
  extraLabel,
  extraCol,
  extraVal,
  onExtraChange,
}: {
  label: string;
  col: Column | null;
  value: any;
  editing: boolean;
  onChange: (v: any) => void;
  extraLabel?: string;
  extraCol?: Column | null;
  extraVal?: any;
  onExtraChange?: (v: any) => void;
}) {
  const isYes = value === true || value === 'true';
  const isNo  = value === false || value === 'false';

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <button
          disabled={!editing}
          onClick={() => onChange(isYes ? '' : true)}
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: isYes ? '#60a5fa' : '#94a3b8' }}>
          <span className={`size-4 rounded-sm border-2 flex items-center justify-center text-xs ${isYes ? 'border-blue-400 bg-blue-400/20' : 'border-slate-500'}`}>
            {isYes && '✓'}
          </span>
          Oui
        </button>
        <button
          disabled={!editing}
          onClick={() => onChange(isNo ? '' : false)}
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: isNo ? '#f87171' : '#94a3b8' }}>
          <span className={`size-4 rounded-sm border-2 flex items-center justify-center text-xs ${isNo ? 'border-red-400 bg-red-400/20' : 'border-slate-500'}`}>
            {isNo && '✓'}
          </span>
          Non
        </button>
      </div>
      {extraLabel && extraCol && onExtraChange && (
        <InlineField
          label={extraLabel}
          col={extraCol}
          value={extraVal ?? ''}
          editing={editing}
          onChange={onExtraChange}
          className="flex-1"
        />
      )}
    </div>
  );
}

// ─── En-tête de section (fond bleu) ──────────────────────────────────────────
function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <div
      className="px-3 py-2 text-xs font-bold uppercase tracking-wide col-span-full"
      style={{ backgroundColor: BLUE_HDR, color: '#bfdbfe', borderBottom: `1px solid ${BORDER_CLR}` }}>
      {number}. {title}
    </div>
  );
}

// ─── Ligne de tableau (2 colonnes) ───────────────────────────────────────────
function Row2({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2" style={{ borderBottom: `1px solid ${BORDER_CLR}` }}>
      <div className="px-3 py-2.5" style={{ borderRight: `1px solid ${BORDER_CLR}` }}>{left}</div>
      <div className="px-3 py-2.5">{right}</div>
    </div>
  );
}

// ─── Ligne de tableau accès (4 colonnes) ─────────────────────────────────────
function Row4({
  appName,
  yesNo,
  accessLevel,
  profile,
  isSubHeader = false,
}: {
  appName: string;
  yesNo: React.ReactNode;
  accessLevel?: React.ReactNode;
  profile?: React.ReactNode;
  isSubHeader?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-[140px_1fr_1fr_1fr]"
      style={{ borderBottom: `1px solid ${BORDER_CLR}` }}>
      <div
        className="px-3 py-2 text-xs font-semibold flex items-center"
        style={{
          borderRight: `1px solid ${BORDER_CLR}`,
          backgroundColor: isSubHeader ? BLUE_SUB : 'transparent',
          color: isSubHeader ? '#93c5fd' : '#e2e8f0',
        }}>
        {appName}
      </div>
      <div className="px-3 py-2" style={{ borderRight: `1px solid ${BORDER_CLR}` }}>{yesNo}</div>
      <div className="px-3 py-2" style={{ borderRight: `1px solid ${BORDER_CLR}` }}>{accessLevel}</div>
      <div className="px-3 py-2">{profile}</div>
    </div>
  );
}

// ─── Formulaire complet ───────────────────────────────────────────────────────
function WordForm({
  columns,
  values,
  editing,
  onChange,
  row,
}: {
  columns: Column[];
  values: Record<string, any>;
  editing: boolean;
  onChange: (id: string, val: any) => void;
  row: Row | null;
}) {
  const v = (col: Column | null) => (col ? values[col.id] ?? '' : '');
  const set = (col: Column | null) => (val: any) => {
    if (col) onChange(col.id, val);
  };

  // ── Section 1 ──
  const service    = findVal(values, columns, 'service', 'site');
  const nomPrenom  = findVal(values, columns, 'nom', 'prénom', 'prenom', 'agent');
  const identifiant= findVal(values, columns, 'identifiant', 'login', 'user');
  const fonction   = findVal(values, columns, 'fonction', 'poste');
  const email      = findVal(values, columns, 'email', 'mail', 'adresse');

  // ── Section 2 ──
  const nomCompte  = findVal(values, columns, 'nouveau', 'compte');
  const fonctComp  = findVal(values, columns, 'fonction');
  const position   = findVal(values, columns, 'position', 'hiérarch', 'niveau', 'grade');
  const emailComp  = findVal(values, columns, 'email', 'mail');
  const identDSI   = findVal(values, columns, 'identifiant', 'dsi');
  const matricule  = findVal(values, columns, 'matricule');

  // ── Section 3 — Applications ──
  const officeApp   = findVal(values, columns, 'office', 'bureautique', 'suite');
  const office365   = findVal(values, columns, '365', 'onedrive', 'teams');
  const cyrusYN     = findVal(values, columns, 'cyrus');
  const cyrusNiv    = findVal(values, columns, 'cyrus niveau', 'cyrus_niveau');
  const cyrusProfil = findVal(values, columns, 'cyrus profil', 'cyrus_profil');
  const astenYN     = findVal(values, columns, 'asten');
  const astenNiv    = findVal(values, columns, 'asten niveau', 'asten_niv');
  const astenProfil = findVal(values, columns, 'asten profil', 'asten_prof');
  const gpvYN       = findVal(values, columns, 'gpv');
  const gpvNiv      = findVal(values, columns, 'gpv niveau', 'gpv_niv');
  const gpvProfil   = findVal(values, columns, 'gpv profil', 'gpv_prof');
  const legendYN    = findVal(values, columns, 'legend');
  const legendNiv   = findVal(values, columns, 'legend niveau', 'legend_niv');
  const legendProf  = findVal(values, columns, 'legend profil', 'legend_prof');
  const probiYN     = findVal(values, columns, 'probi');
  const probiNiv    = findVal(values, columns, 'probi niveau', 'probi_niv');
  const probiProf   = findVal(values, columns, 'probi profil', 'probi_prof');
  const protransYN  = findVal(values, columns, 'protrans');
  const protransNiv = findVal(values, columns, 'protrans niveau', 'protrans_niv');
  const protransProf= findVal(values, columns, 'protrans profil', 'protrans_prof');
  const vpnYN       = findVal(values, columns, 'vpn');
  const vpnJustif   = findVal(values, columns, 'vpn just', 'justif');
  const caisseYN    = findVal(values, columns, 'caisse', 'code caisse');
  const dossiers    = findVal(values, columns, 'dossier', 'partag');

  // ── Section 4 ──
  const secNom      = findVal(values, columns, 'sécurité nom', 'valid nom', 'responsable sécurité', 'responsable');
  const secFonction = findVal(values, columns, 'sécurité fonc', 'valid fonc', 'fonction valid');
  const secAvis     = findVal(values, columns, 'avis', 'statut', 'accord', 'décision', 'approbation');
  // Date de validation : cherche en priorité colonnes DATE dont le nom contient date
  const secDate = (() => {
    const patterns = ['date valid', 'date accord', 'date appro', 'date sécur', 'date final'];
    // Try named patterns first
    for (const p of patterns) {
      const col = columns.find((c) => c.name.toLowerCase().includes(p.toLowerCase()));
      if (col) return { col, val: values[col.id] ?? '' };
    }
    // Fallback: any DATE/DATE_TIME column not already used by other fields
    const usedIds = new Set(
      [service, nomPrenom, identifiant, fonction, email,
       nomCompte, fonctComp, position, emailComp, identDSI, matricule,
       secNom, secFonction, secAvis]
        .map((f) => f.col?.id)
        .filter(Boolean)
    );
    const dateCols = columns.filter(
      (c) => (c.type === 'DATE' || c.type === 'DATE_TIME') && !usedIds.has(c.id)
    );
    if (dateCols.length > 0) {
      const col = dateCols[0];
      return { col, val: values[col.id] ?? '' };
    }
    return { col: null, val: '' };
  })();

  // Numéro de demande auto
  const demandNum = row ? `#${String(row.order + 1).padStart(4, '0')}` : 'AUTO';
  const dateCreation = row
    ? new Date(row.createdAt).toLocaleDateString('fr-FR')
    : todayFR();

  return (
    <div
      className="text-sm font-sans"
      style={{ color: '#e2e8f0' }}>

      {/* ═══════════════ EN-TÊTE ═══════════════ */}
      <div
        className="px-4 py-3 text-center font-bold text-sm uppercase tracking-widest"
        style={{ backgroundColor: BLUE_DARK, color: '#bfdbfe', borderBottom: `2px solid ${BORDER_CLR}` }}>
        FORMULAIRE DE DEMANDE D'ACCÈS
      </div>
      <div
        className="px-4 py-2 flex flex-wrap items-center gap-4 text-xs"
        style={{ backgroundColor: '#0f172a', borderBottom: `1px solid ${BORDER_CLR}`, color: '#94a3b8' }}>
        <span>Réf : <strong className="text-slate-200">FRM-IAM-002</strong></span>
        <span>Date : <strong className="text-slate-200">{dateCreation}</strong></span>
        <span>N° : <strong className="text-slate-200">{demandNum}</strong></span>
      </div>

      {/* ═══════════════ SECTION 1 ═══════════════ */}
      <div style={{ border: `1px solid ${BORDER_CLR}`, borderTop: 'none' }}>
        <SectionHeader number={1} title="SERVICE OU SITE DEMANDEUR" />
        <Row2
          left={<InlineField label="Service ou Site" col={service.col} value={v(service.col)} editing={editing} onChange={set(service.col)} wide />}
          right={<InlineField label="Nom & Prénoms" col={nomPrenom.col} value={v(nomPrenom.col)} editing={editing} onChange={set(nomPrenom.col)} wide />}
        />
        <Row2
          left={<InlineField label="Identifiant" col={identifiant.col} value={v(identifiant.col)} editing={editing} onChange={set(identifiant.col)} wide />}
          right={<InlineField label="Fonction" col={fonction.col} value={v(fonction.col)} editing={editing} onChange={set(fonction.col)} wide />}
        />
        <Row2
          left={<InlineField label="Adresse Email" col={email.col} value={v(email.col)} editing={editing} onChange={set(email.col)} type="email" wide />}
          right={
            <div>
              <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>Signature :</span>
              <div className="h-8 mt-1 border-b border-dashed border-slate-600" />
            </div>
          }
        />
      </div>

      {/* ═══════════════ SECTION 2 ═══════════════ */}
      <div style={{ border: `1px solid ${BORDER_CLR}`, borderTop: 'none' }}>
        <SectionHeader number={2} title="CRÉATION D'UN NOUVEAU COMPTE UTILISATEUR" />
        <Row2
          left={<InlineField label="Nom & Prénoms" col={nomCompte.col} value={v(nomCompte.col)} editing={editing} onChange={set(nomCompte.col)} wide />}
          right={<InlineField label="Fonction" col={fonctComp.col} value={v(fonctComp.col)} editing={editing} onChange={set(fonctComp.col)} wide />}
        />
        <Row2
          left={<InlineField label="Position hiérarchique" col={position.col} value={v(position.col)} editing={editing} onChange={set(position.col)} wide />}
          right={<InlineField label="Adresse Email" col={emailComp.col} value={v(emailComp.col)} editing={editing} onChange={set(emailComp.col)} type="email" wide />}
        />
        <Row2
          left={
            <div>
              <InlineField label="Identifiant" col={identDSI.col} value={v(identDSI.col)} editing={editing} onChange={set(identDSI.col)} wide />
              <p className="text-xs mt-1 italic" style={{ color: '#64748b' }}>(Section réservée à la DSI)</p>
            </div>
          }
          right={<InlineField label="Matricule" col={matricule.col} value={v(matricule.col)} editing={editing} onChange={set(matricule.col)} wide />}
        />
      </div>

      {/* ═══════════════ SECTION 3 ═══════════════ */}
      <div style={{ border: `1px solid ${BORDER_CLR}`, borderTop: 'none' }}>
        <SectionHeader number={3} title="ACCÈS ET APPLICATIONS DEMANDÉS" />

        {/* En-têtes colonnes */}
        <div
          className="grid grid-cols-[140px_1fr_1fr_1fr] text-xs font-semibold"
          style={{ backgroundColor: BLUE_SUB, borderBottom: `1px solid ${BORDER_CLR}`, color: '#93c5fd' }}>
          <div className="px-3 py-1.5" style={{ borderRight: `1px solid ${BORDER_CLR}` }}>Application</div>
          <div className="px-3 py-1.5" style={{ borderRight: `1px solid ${BORDER_CLR}` }}>Accès ?</div>
          <div className="px-3 py-1.5" style={{ borderRight: `1px solid ${BORDER_CLR}` }}>Niveau d'accès</div>
          <div className="px-3 py-1.5">Profil témoin</div>
        </div>

        {/* Suite bureautique */}
        <Row4
          appName="SUITE BUREAUTIQUE"
          isSubHeader
          yesNo={
            <div className="space-y-1">
              {[
                { k: 'office', label: 'Office (Word, Excel…)', col: officeApp.col },
                { k: '365',    label: 'Office 365 / Teams',   col: office365.col },
              ].map(({ k, label, col }) => (
                <button
                  key={k}
                  disabled={!editing}
                  onClick={() => col && onChange(col.id, !values[col.id])}
                  className="flex items-center gap-1.5 text-xs transition-colors w-full text-left"
                  style={{ color: (col && values[col.id]) ? '#60a5fa' : '#94a3b8' }}>
                  <span className={`size-3.5 rounded-sm border flex items-center justify-center text-[9px] shrink-0 ${col && values[col.id] ? 'border-blue-400 bg-blue-400/20' : 'border-slate-500'}`}>
                    {col && values[col.id] && '✓'}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          }
          accessLevel={null}
          profile={null}
        />

        {/* Applications métier */}
        {[
          { name: 'CYRUS',    yn: cyrusYN,    niv: cyrusNiv,    prof: cyrusProfil },
          { name: 'ASTEN',    yn: astenYN,    niv: astenNiv,    prof: astenProfil },
          { name: 'GPV',      yn: gpvYN,      niv: gpvNiv,      prof: gpvProfil },
          { name: 'LEGEND',   yn: legendYN,   niv: legendNiv,   prof: legendProf },
          { name: 'PROBI',    yn: probiYN,    niv: probiNiv,    prof: probiProf },
          { name: 'PROTRANS', yn: protransYN, niv: protransNiv, prof: protransProf },
        ].map(({ name, yn, niv, prof }) => (
          <Row4
            key={name}
            appName={name}
            yesNo={
              <YesNoField
                label=""
                col={yn.col}
                value={v(yn.col)}
                editing={editing}
                onChange={set(yn.col)}
              />
            }
            accessLevel={
              niv.col
                ? <InlineField label="Niveau" col={niv.col} value={v(niv.col)} editing={editing} onChange={set(niv.col)} wide />
                : <span className="text-xs text-slate-500">Niveau d'accès : ___________</span>
            }
            profile={
              prof.col
                ? <InlineField label="Profil" col={prof.col} value={v(prof.col)} editing={editing} onChange={set(prof.col)} wide />
                : <span className="text-xs text-slate-500">Profil témoin : ___________</span>
            }
          />
        ))}

        {/* VPN */}
        <div
          className="grid grid-cols-[140px_1fr]"
          style={{ borderBottom: `1px solid ${BORDER_CLR}` }}>
          <div className="px-3 py-2 text-xs font-semibold flex items-center"
            style={{ borderRight: `1px solid ${BORDER_CLR}`, color: '#e2e8f0' }}>
            ACCÈS PAR VPN
          </div>
          <div className="px-3 py-2 flex items-center gap-4 flex-wrap">
            <YesNoField label="" col={vpnYN.col} value={v(vpnYN.col)} editing={editing} onChange={set(vpnYN.col)} />
            <InlineField label="Justification" col={vpnJustif.col} value={v(vpnJustif.col)} editing={editing} onChange={set(vpnJustif.col)} className="flex-1" />
          </div>
        </div>

        {/* Code caisse */}
        <div
          className="grid grid-cols-[140px_1fr]"
          style={{ borderBottom: `1px solid ${BORDER_CLR}` }}>
          <div className="px-3 py-2 text-xs font-semibold flex items-center"
            style={{ borderRight: `1px solid ${BORDER_CLR}`, color: '#e2e8f0' }}>
            CODE CAISSE
          </div>
          <div className="px-3 py-2">
            <YesNoField label="" col={caisseYN.col} value={v(caisseYN.col)} editing={editing} onChange={set(caisseYN.col)} />
          </div>
        </div>

        {/* Dossiers partagés */}
        <div style={{ borderBottom: `1px solid ${BORDER_CLR}` }}>
          <div className="px-3 py-2">
            <p className="text-xs font-semibold mb-2" style={{ color: '#93c5fd' }}>
              ACCÈS DOSSIERS PARTAGÉS (merci de les lister) :
            </p>
            {dossiers.col && editing ? (
              <textarea
                className="w-full bg-transparent border border-dashed border-blue-400/40 rounded px-2 py-1 text-sm outline-none resize-none"
                style={{ color: '#e2e8f0', minHeight: 60 }}
                value={v(dossiers.col)}
                onChange={(e) => set(dossiers.col)(e.target.value)}
                placeholder="1. ___________&#10;2. ___________&#10;3. ___________"
              />
            ) : (
              <div className="text-sm whitespace-pre-wrap" style={{ color: dossiers.val ? '#e2e8f0' : '#475569', minHeight: 40 }}>
                {dossiers.val || '1. ___________\n2. ___________\n3. ___________'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════ SECTION 4 ═══════════════ */}
      <div style={{ border: `1px solid ${BORDER_CLR}`, borderTop: 'none' }}>
        <SectionHeader number={4} title="VALIDATION SERVICE SÉCURITÉ" />

        {/* Note : puisque la ligne est créée après accord sécurité, on pré-affiche "Favorable" */}
        <div
          className="px-3 py-1.5 text-xs italic flex items-center gap-2"
          style={{ backgroundColor: '#0f2a1a', color: '#4ade80', borderBottom: `1px solid ${BORDER_CLR}` }}>
          <Check className="size-3.5 shrink-0" />
          Accord sécurité confirmé — cette demande a été approuvée avant saisie
        </div>

        <Row2
          left={<InlineField label="Nom & Prénoms" col={secNom.col} value={v(secNom.col)} editing={editing} onChange={set(secNom.col)} wide />}
          right={<InlineField label="Fonction" col={secFonction.col} value={v(secFonction.col)} editing={editing} onChange={set(secFonction.col)} wide />}
        />
        <Row2
          left={
            <div className="space-y-2">
              {/* Avis toujours Favorable puisque la ligne existe */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>Avis :</span>
                <button
                  disabled={!editing}
                  onClick={() => { if (secAvis.col) onChange(secAvis.col.id, 'Favorable'); }}
                  className="flex items-center gap-1.5 text-sm"
                  style={{ color: (!secAvis.val || secAvis.val === 'Favorable') ? '#4ade80' : '#94a3b8' }}>
                  <span className={`size-4 rounded-sm border-2 flex items-center justify-center text-xs ${(!secAvis.val || secAvis.val === 'Favorable') ? 'border-green-400 bg-green-400/20' : 'border-slate-500'}`}>
                    {(!secAvis.val || secAvis.val === 'Favorable') && '✓'}
                  </span>
                  Favorable
                </button>
                <button
                  disabled={!editing}
                  onClick={() => { if (secAvis.col) onChange(secAvis.col.id, 'Défavorable'); }}
                  className="flex items-center gap-1.5 text-sm"
                  style={{ color: secAvis.val === 'Défavorable' ? '#f87171' : '#94a3b8' }}>
                  <span className={`size-4 rounded-sm border-2 flex items-center justify-center text-xs ${secAvis.val === 'Défavorable' ? 'border-red-400 bg-red-400/20' : 'border-slate-500'}`}>
                    {secAvis.val === 'Défavorable' && '✓'}
                  </span>
                  Défavorable
                </button>
              </div>
              <InlineField
                label="Date"
                col={secDate.col}
                value={v(secDate.col) || dateCreation}
                editing={editing}
                onChange={set(secDate.col)}
                type="date"
                wide
              />
            </div>
          }
          right={
            <div>
              <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>Signature & cachet :</span>
              <div className="h-12 mt-1 border border-dashed rounded" style={{ borderColor: '#334155' }} />
            </div>
          }
        />
      </div>
    </div>
  );
}

// ─── Drawer principal ─────────────────────────────────────────────────────────
interface RowDrawerProps {
  open: boolean;
  mode: 'create' | 'edit' | null;
  columns: Column[];
  row: Row | null;
  values: Record<string, any>;
  onValuesChange: (values: Record<string, any>) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
  isPending: boolean;
  isDeleting: boolean;
}

export default function RowDrawer({
  open, mode, columns, row, values,
  onValuesChange, onSave, onDelete, onClose, isPending, isDeleting,
}: RowDrawerProps) {
  const [editing, setEditing] = useState(false);

  // Reset edit mode whenever drawer opens or switches between create/edit
  useEffect(() => {
    if (open) {
      setEditing(mode === 'create');
    }
  }, [open, mode, row]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleChange = (colId: string, val: any) => {
    onValuesChange({ ...values, [colId]: val });
  };

  const isCreate = mode === 'create';

  return (
    <>
      {/* Fond */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out"
        style={{
          width: 'min(700px, 96vw)',
          backgroundColor: '#0f172a',
          borderLeft: '1px solid #1e293b',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
        }}>

        {/* ── Barre supérieure ── */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155' }}>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ backgroundColor: isCreate ? '#3b82f6' : '#22c55e' }} />
            <span className="text-sm font-semibold text-slate-200">
              {isCreate ? 'Nouvelle demande d\'accès' : 'Demande d\'accès'}
            </span>
            {row && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                #{String(row.order + 1).padStart(4, '0')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Bouton imprimer */}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
              style={{ borderColor: '#334155', color: '#94a3b8' }}
              title="Imprimer / Exporter PDF">
              <Printer className="size-3.5" />
              Imprimer
            </button>

            {/* Basculer édition (mode edit seulement) */}
            {mode === 'edit' && (
              <button
                onClick={() => setEditing(!editing)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                style={{
                  borderColor: editing ? '#3b82f6' : '#334155',
                  backgroundColor: editing ? 'rgba(59,130,246,0.1)' : 'transparent',
                  color: editing ? '#60a5fa' : '#94a3b8',
                }}>
                <Edit2 className="size-3.5" />
                {editing ? 'Modification...' : 'Modifier'}
              </button>
            )}

            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/5">
              <X className="size-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* ── Corps — formulaire ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <WordForm
              columns={columns}
              values={values}
              editing={editing || isCreate}
              onChange={handleChange}
              row={row}
            />
          </div>
        </div>

        {/* ── Pied ── */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ backgroundColor: '#1e293b', borderTop: '1px solid #334155' }}>
          <div>
            {mode === 'edit' && (
              <button
                onClick={onDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: '#f87171' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                Supprimer
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-sm border transition-all"
              style={{ borderColor: '#334155', color: '#94a3b8' }}>
              Fermer
            </button>
            {(editing || isCreate) && (
              <button
                onClick={onSave}
                disabled={isPending}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{ backgroundColor: '#2563eb', color: 'white' }}>
                {isPending
                  ? <Loader2 className="size-4 animate-spin" />
                  : <Check className="size-4" />}
                {isCreate ? 'Enregistrer la demande' : 'Sauvegarder'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
