#!/usr/bin/env node
"use strict";

/**
 * Vérifie la cohérence de fichiers JSON i18next.
 *
 * Vérifications :
 * - JSON valides et racine de type objet ;
 * - clés manquantes ou supplémentaires par rapport à la langue de référence ;
 * - différences de types (string, object, array, etc.) ;
 * - variables d'interpolation i18next manquantes ou supplémentaires ;
 * - valeurs de traduction vides.
 *
 * Usage :
 *   node scripts/check-i18n.cjs src/locales fr.json
 *
 * Le premier argument est le dossier contenant les fichiers JSON de langue.
 * Le second argument est le fichier de référence (fr.json par défaut).
 */

const fs = require("node:fs");
const path = require("node:path");

const localeDirectory = path.resolve(process.cwd(), process.argv[2] || "src/locales");
const referenceFileName = process.argv[3] || "fr.json";
const referencePath = path.join(localeDirectory, referenceFileName);

let errorCount = 0;
let warningCount = 0;

function error(message) {
  errorCount += 1;
  console.error(`  ERREUR  ${message}`);
}

function warning(message) {
  warningCount += 1;
  console.warn(`  AVERT.  ${message}`);
}

function getType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value === "object" ? "object" : typeof value;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readLocale(filePath) {
  let text;

  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (cause) {
    error(`Impossible de lire « ${filePath} » : ${cause.message}`);
    return null;
  }

  try {
    const parsed = JSON.parse(text);

    if (!isPlainObject(parsed)) {
      error(`« ${path.basename(filePath)} » doit avoir un objet JSON à la racine.`);
      return null;
    }

    return parsed;
  } catch (cause) {
    error(`JSON invalide dans « ${path.basename(filePath)} » : ${cause.message}`);
    return null;
  }
}

function formatPath(parts) {
  return parts.length ? parts.join(".") : "<racine>";
}

function getPlaceholders(value) {
  // Accepte notamment {{name}}, {{ count }} et {{- value}}.
  // L'option de formatage i18next, par exemple {{count, number}}, est tolérée.
  const pattern = /{{\s*-?\s*([\w.-]+)(?:\s*,\s*[^{}]+)?\s*}}/g;
  const placeholders = new Set();
  let match;

  while ((match = pattern.exec(value)) !== null) {
    placeholders.add(match[1]);
  }

  return placeholders;
}

function comparePlaceholders(referenceValue, translatedValue, localeName, keyPath) {
  const referencePlaceholders = getPlaceholders(referenceValue);
  const translatedPlaceholders = getPlaceholders(translatedValue);

  const missing = [...referencePlaceholders].filter((name) => !translatedPlaceholders.has(name));
  const extra = [...translatedPlaceholders].filter((name) => !referencePlaceholders.has(name));

  if (missing.length > 0) {
    error(
      `${localeName} — « ${keyPath} » : variable(s) d'interpolation manquante(s) : ${missing
        .map((name) => `{{${name}}}`)
        .join(", ")}.`,
    );
  }

  if (extra.length > 0) {
    error(
      `${localeName} — « ${keyPath} » : variable(s) d'interpolation supplémentaire(s) : ${extra
        .map((name) => `{{${name}}}`)
        .join(", ")}.`,
    );
  }
}

function checkEmptyValues(value, localeName, parts = []) {
  if (typeof value === "string") {
    if (value.trim().length === 0) {
      error(`${localeName} — traduction vide pour « ${formatPath(parts)} ».`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => checkEmptyValues(item, localeName, [...parts, `[${index}]`]));
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      checkEmptyValues(child, localeName, [...parts, key]);
    }
  }
}

function compareValues(referenceValue, translatedValue, localeName, parts = []) {
  const keyPath = formatPath(parts);
  const referenceType = getType(referenceValue);
  const translatedType = getType(translatedValue);

  if (referenceType !== translatedType) {
    error(
      `${localeName} — « ${keyPath} » : type différent (référence : ${referenceType}, traduction : ${translatedType}).`,
    );
    return;
  }

  if (isPlainObject(referenceValue)) {
    const referenceKeys = Object.keys(referenceValue);
    const translatedKeys = Object.keys(translatedValue);

    for (const key of referenceKeys) {
      if (!Object.prototype.hasOwnProperty.call(translatedValue, key)) {
        error(`${localeName} — clé manquante « ${formatPath([...parts, key])} ».`);
        continue;
      }

      compareValues(referenceValue[key], translatedValue[key], localeName, [...parts, key]);
    }

    for (const key of translatedKeys) {
      if (!Object.prototype.hasOwnProperty.call(referenceValue, key)) {
        warning(`${localeName} — clé absente de la référence « ${formatPath([...parts, key])} ».`);
      }
    }

    return;
  }

  if (Array.isArray(referenceValue)) {
    if (translatedValue.length < referenceValue.length) {
      error(
        `${localeName} — « ${keyPath} » : le tableau contient ${translatedValue.length} élément(s), contre ${referenceValue.length} dans la référence.`,
      );
    } else if (translatedValue.length > referenceValue.length) {
      warning(
        `${localeName} — « ${keyPath} » : le tableau contient ${translatedValue.length - referenceValue.length} élément(s) supplémentaire(s).`,
      );
    }

    const commonLength = Math.min(referenceValue.length, translatedValue.length);
    for (let index = 0; index < commonLength; index += 1) {
      compareValues(referenceValue[index], translatedValue[index], localeName, [...parts, `[${index}]`]);
    }

    return;
  }

  if (typeof referenceValue === "string") {
    comparePlaceholders(referenceValue, translatedValue, localeName, keyPath);
  }
}

function main() {
  if (!fs.existsSync(localeDirectory) || !fs.statSync(localeDirectory).isDirectory()) {
    console.error(`Dossier de langues introuvable : ${localeDirectory}`);
    console.error("Usage : node scripts/check-i18n.cjs <dossier-des-langues> [fichier-reference.json]");
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(referencePath)) {
    console.error(`Fichier de référence introuvable : ${referencePath}`);
    console.error("Indique le nom du fichier de référence en second argument, par exemple fr.json.");
    process.exitCode = 1;
    return;
  }

  const jsonFiles = fs
    .readdirSync(localeDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  const otherFiles = jsonFiles.filter((name) => name !== referenceFileName);

  if (otherFiles.length === 0) {
    console.error(`Aucun autre fichier JSON à comparer avec ${referenceFileName} dans ${localeDirectory}.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Vérification des traductions : ${path.relative(process.cwd(), localeDirectory) || "."}`);
  console.log(`Langue de référence : ${referenceFileName}\n`);

  const reference = readLocale(referencePath);
  if (reference === null) {
    process.exitCode = 1;
    return;
  }

  checkEmptyValues(reference, referenceFileName);

  let comparedCount = 0;

  for (const fileName of otherFiles) {
    const filePath = path.join(localeDirectory, fileName);
    const translated = readLocale(filePath);

    if (translated === null) continue;

    comparedCount += 1;
    console.log(`\nComparaison : ${referenceFileName} → ${fileName}`);
    checkEmptyValues(translated, fileName);
    compareValues(reference, translated, fileName);
  }

  console.log("\n--- Résultat ---");
  console.log(`Fichiers de langue comparés : ${comparedCount}`);
  console.log(`Erreurs : ${errorCount}`);
  console.log(`Avertissements : ${warningCount}`);

  if (errorCount > 0) {
    console.error("\nÉchec : corrige les erreurs de cohérence avant de valider les traductions.");
    process.exitCode = 1;
  } else {
    console.log("\nSuccès : aucune erreur de cohérence détectée.");
    if (warningCount > 0) {
      console.log("Consulte les avertissements pour les clés supplémentaires.");
    }
  }
}

main();
