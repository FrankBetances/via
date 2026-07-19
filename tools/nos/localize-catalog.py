#!/usr/bin/env python3
"""Localización léxica es → es-DO de los catálogos i18n (Q2.2 · Quisqueya Habla).

Aplica el glosario de variante (`tools/nos/glosario-es-do.csv`) sobre los
catálogos base `src/I18n/locales/es/*.json` y emite SOLO las claves que
cambian en `src/I18n/locales/es-DO/*.json` — el delta mínimo que exige el
fallback en cascada es-DO → es (Q1.1). Nunca toca el catálogo base.

Reglas:
  · Solo se aplican filas con estado = «aprobado» (las «propuesto» se listan
    como pendientes): ningún texto llega al catálogo sin la revisión humana
    firmada del plan (Q2.3).
  · Sustitución por palabra completa, preservando mayúscula inicial.
  · Verificación de placeholders: si una sustitución altera los `{{...}}` de
    un segmento, el script falla (round-trip sin pérdida, contrato de Q2.2).

Uso:
  python3 tools/nos/localize-catalog.py            # aplica y escribe el delta
  python3 tools/nos/localize-catalog.py --dry-run  # informe sin escribir
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
GLOSSARY = HERE / "glosario-es-do.csv"
LOCALES_ES = ROOT / "src" / "I18n" / "locales" / "es"
LOCALES_ES_DO = ROOT / "src" / "I18n" / "locales" / "es-DO"

PLACEHOLDER = re.compile(r"\{\{\s*\w+\s*\}\}")


def load_glossary() -> tuple[list[tuple[str, str]], list[str]]:
    approved: list[tuple[str, str]] = []
    pending: list[str] = []
    with open(GLOSSARY, encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            src, dst = row["es"].strip(), row["es_do"].strip()
            if not src or not dst:
                continue
            if row.get("estado", "").strip().lower() == "aprobado":
                approved.append((src, dst))
            else:
                pending.append(f"{src} → {dst} [{row.get('estado', '?')}]")
    return approved, pending


def apply_glossary(text: str, glossary: list[tuple[str, str]]) -> str:
    out = text
    for src, dst in glossary:
        def repl(m: re.Match, dst: str = dst) -> str:
            w = m.group(0)
            return dst.capitalize() if w[0].isupper() else dst
        out = re.sub(rf"(?<!\w){re.escape(src)}(?!\w)", repl, out, flags=re.IGNORECASE)
    return out


def walk(obj, glossary, path=""):
    """Recorre el catálogo y devuelve (delta, cambios) preservando estructura."""
    if isinstance(obj, str):
        new = apply_glossary(obj, glossary)
        if new != obj:
            if sorted(PLACEHOLDER.findall(new)) != sorted(PLACEHOLDER.findall(obj)):
                raise SystemExit(f"Placeholder alterado en {path}: {obj!r} → {new!r}")
            return new, [(path, obj, new)]
        return None, []
    if isinstance(obj, dict):
        delta, changes = {}, []
        for key, value in obj.items():
            sub, ch = walk(value, glossary, f"{path}.{key}" if path else key)
            if sub is not None:
                delta[key] = sub
            changes.extend(ch)
        return (delta or None), changes
    return None, []


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="informe sin escribir el delta")
    args = ap.parse_args()

    approved, pending = load_glossary()
    if pending:
        print(f"Glosario: {len(pending)} entradas PENDIENTES de firma (no se aplican):")
        for p in pending:
            print(f"  · {p}")
    if not approved:
        print("Sin entradas aprobadas: el delta es-DO queda igual (solo fallback).")
        return

    total = 0
    for es_file in sorted(LOCALES_ES.glob("*.json")):
        with open(es_file, encoding="utf-8") as fh:
            base = json.load(fh)
        delta, changes = walk(base, approved)
        print(f"\n{es_file.name}: {len(changes)} segmentos localizados")
        for path, old, new in changes:
            print(f"  {path}: {old!r} → {new!r}")
        total += len(changes)
        if args.dry_run:
            continue
        out_file = LOCALES_ES_DO / es_file.name
        existing = {}
        if out_file.exists():
            with open(out_file, encoding="utf-8") as fh:
                existing = json.load(fh)
        merged = {**existing, **(delta or {})}
        out_file.parent.mkdir(parents=True, exist_ok=True)
        with open(out_file, "w", encoding="utf-8") as fh:
            json.dump(merged, fh, ensure_ascii=False, indent=2)
            fh.write("\n")

    mode = "informe (--dry-run)" if args.dry_run else "delta escrito en locales/es-DO/"
    print(f"\n{total} segmentos · {mode}")
    if total and not args.dry_run:
        print("Recuerde: el delta requiere revisión humana firmada (Q2.3) antes de release.")


if __name__ == "__main__":
    main()
