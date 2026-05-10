# Voix intégrée Hermes vs VerbalCoding

<!-- readme-glow-up:intro -->
<p align="center">
  <a href="../../README.fr.md">README</a> ·
  <a href="README.fr.md">Accueil docs</a> ·
  <a href="USAGE.fr.md">Utilisation</a> ·
  <a href="CONFIGURATION.fr.md">Configuration</a> ·
  <a href="TROUBLESHOOTING.fr.md">Dépannage</a>
</p>

> Hermes prend déjà en charge les salons vocaux Discord. VerbalCoding ne remplace pas cette boucle de base : il ajoute une couche de workflow pour travailler avec des agents de code comme lors d’un appel.
<!-- /readme-glow-up:intro -->

## Ce que Hermes fait déjà

Le gateway Discord de Hermes Agent inclut la prise en charge des salons vocaux. Une fois le bot dans le serveur, `/voice join` ou `/voice channel` le fait rejoindre le VC où vous vous trouvez. Hermes peut ensuite transcrire via Whisper/STT et répondre en TTS avec Edge TTS, ElevenLabs, OpenAI ou un autre provider configuré.

Pour une conversation vocale simple, cette boucle suffit déjà :

```text
Discord VC → Hermes STT → Hermes agent → TTS → Discord VC playback
```

## Ce que VerbalCoding ajoute

| Domaine | Voix intégrée Hermes | VerbalCoding |
|---|---|---|
| Objectif | Conversation Hermes générale dans un VC | Workflow type appel téléphonique avec agents CLI de code |
| Commandes | `/voice join`, `/voice channel`, `/voice leave`, `/voice tts` | `vc setup`, `vc start`, `!join`, `!ask`, `!session`, `!verbose`, `!latency`, commandes multi-instance |
| Backend | Hermes Agent | Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw ou commande personnalisée |
| Sessions | Session gateway Hermes normale | Routage projet/session, liaison de salons vocaux, contexte partagé voix + `!ask` quand le backend le permet |
| UX vocale | STT + TTS de base | Fenêtres d’énoncé réglées, préréglages de langue, nettoyage de transcription, miroir texte, tests de voix |
| Interruption | Lecture vocale de base | Règles de barge-in qui arrêtent la lecture sans tuer par erreur une tâche agent active |
| Tâches longues | Réponse agent générique | Annonces de progression/état, résumés verbose des outils, suppression des diffs/logs en TTS |
| Opérations | Configuration du gateway Hermes | `vc doctor`, diagnostics redactés, métriques de latence, guide Docker UDP, salons/processus par projet |

## Quand choisir quoi

Choisissez **la voix intégrée Hermes** si vous voulez seulement parler, transcrire, répondre et réécouter dans un salon vocal.

Choisissez **VerbalCoding** si vous avez besoin d’un contexte projet partagé entre voix et texte, de plusieurs backends CLI, de préréglages coréen/anglais, d’interruptions sûres pendant les longues tâches, de progression vocale, de métriques de latence et d’outils d’exploitation.

## Positionnement honnête

VerbalCoding ne doit pas être présenté comme “l’ajout de la voix Discord à Hermes depuis zéro”. Hermes fournit déjà cette base. La description juste : VerbalCoding est une couche de workflow vocal Discord pour agents CLI de code, capable d’utiliser Hermes comme backend par défaut et d’ajouter routage projet, sémantique d’interruption, UX de progression, diagnostics et changement de backend.
