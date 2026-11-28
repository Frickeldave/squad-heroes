---
name: humanizer
description: Routes prose through the Humanizer rules for the exact selected language.
---

# Humanizer

Use this skill when writing, rewriting, or reviewing user-facing or
developer-facing prose. It is not required for code-only output.

## Language routing

Select exactly one localized rules file:

- `de` or `de-DE` → load `.github/skills/humanizer/de-DE.md`.
- `en` or `en-US` → load `.github/skills/humanizer/en-US.md`.

Normalize only the pairs above. Apply only the selected file, including for
reviews. Do not combine or sample rules from both localized files.

## Fallback and errors

If the language is missing, ambiguous, or outside those two exact normalized
choices, stop before drafting prose and report that a supported language
selection is required. Do not guess from the apparent language of the request,
fall back to another locale, or silently mix files. When the selected localized
file is unavailable, report the missing file and stop the prose operation.

The entry point provides routing only. All communication, style, factual,
review, and quality rules live in the selected localized file.
