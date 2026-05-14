# Project Memory

## Core
SFX uses Web Audio + WAV data-URI fallback in src/lib/sfx.ts. Do not remove the fallback path or the userActivation gesture handling — required for iOS/Safari.

## Memories
- [SFX setup](mem://features/sfx) — Audio unlock + fallback beep mechanism that finally works