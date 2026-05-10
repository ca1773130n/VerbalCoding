# Configuration de VerbalCoding


## Flux setup actuel

```bash
npm install -g verbalcoding@latest
vc setup --yes
vc setup token
vc setup channels "General,Team Voice"
vc doctor
vc start
```

Ne modifiez pas `.env` à la main : utilisez `vc setup token` pour enregistrer `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID`, et `vc setup channels` pour `AUTO_JOIN_VOICE_CHANNELS`. Si Docker affiche `Cannot perform IP discovery - socket closed`, utilisez `network_mode: "host"` avec Compose sous Linux et supprimez `ports:`.

## Assistant de configuration

La configuration du bot/de l'application Discord n'est volontairement pas réexpliquée depuis zéro ici. Utilisez ces guides amont pour les étapes côté Discord, puis revenez à la configuration de VerbalCoding :

- Guide de messagerie Discord de Hermes Agent : <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Vue d'ensemble officielle des bots Discord : <https://docs.discord.com/developers/bots/overview>
- Démarrage rapide officiel Discord : <https://docs.discord.com/developers/quick-start/getting-started>

```bash
./scripts/install.sh
```

L'installateur demande le jeton Discord, les utilisateurs autorisés, les noms de salons vocaux à rejoindre automatiquement, le salon/fil de transcription, le backend de harnais CLI, la langue vocale par défaut, les paramètres TTS et le comportement du mot de réveil. Il écrit `.env` avec le mode `0600` ; `.env` est ignoré par git. Il lie aussi la commande shell courte `vc`.

Si vous avez seulement besoin de la commande shell après une installation manuelle :

```bash
npm link
```

## Backends d'agents pris en charge

Définissez `AGENT_BACKEND` dans `.env`.

| Backend | Commande par défaut | Notes |
|---|---|---|
| `hermes` | `hermes chat -Q -q` | Par défaut. Préserve le comportement de reprise `.verbalcoding-session`. |
| `claude-code` / `claude` | `claude -p` | Remplacer avec `CLAUDE_COMMAND` ou `AGENT_COMMAND`. |
| `codex` | `codex exec` | Remplacer avec `CODEX_COMMAND` ou `AGENT_COMMAND`. |
| `gemini` | `gemini -p` | Remplacer avec `GEMINI_COMMAND` ou `AGENT_COMMAND`. |
| `opencode` | `opencode run` | Remplacer avec `OPENCODE_COMMAND` ou `AGENT_COMMAND`. |
| `openclaw` | `openclaw run` | Remplacer avec `OPENCLAW_COMMAND` ou `AGENT_COMMAND`. |
| `custom` | `AGENT_COMMAND` requis | Le prompt est ajouté comme dernier argument argv. |

Remplacements génériques :

```bash
AGENT_BACKEND=custom
AGENT_LABEL="My Harness"
AGENT_COMMAND="my-harness run --non-interactive"
AGENT_TASK_TIMEOUT_MS=0
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_VERBOSE_PROGRESS=0
UTTERANCE_IDLE_MS=4500
LATENCY_LOG_PATH=./.logs/latency.jsonl
```

## Contrat des adaptateurs d'agent

La passerelle vocale parle à chaque backend via un seul contrat d'adaptateur :

- `run({ text }, signal, plan)` renvoie le statut, le texte de réponse finale, le libellé du backend, le temps écoulé et des métadonnées de session facultatives.
- `ask(text, signal, plan)` est le raccourci de compatibilité qui renvoie seulement le texte de réponse finale.
- `capabilities` déclare si le backend prend en charge la reprise de session, la progression en streaming et l'annulation.
- Hermes est l'adaptateur de référence : reprise, streaming de progression détaillée, annulation et récupération de la réponse finale depuis les fichiers de session Hermes.

Les nouveaux backends doivent implémenter le même contrat et garder le comportement voix/STT/TTS hors de l'adaptateur.

## Exemple `.env`

```bash
DISCORD_BOT_TOKEN="***"
DISCORD_ALLOWED_USERS="123456789012345678"
AUTO_JOIN_VOICE_CHANNELS="일반,General,general"
TRANSCRIPT_CHANNEL_ID="123456789012345678"

AGENT_BACKEND="hermes"
STT_ENGINE="whisper_cpp"
WHISPER_CPP_BIN="whisper-cli"
WHISPER_CPP_MODEL="./models/ggml-small-q5_1.bin"

TTS_BACKEND="edge"
TTS_VOICE_TYPE="korean_female"
TTS_VOICE="ko-KR-SunHiNeural"
TTS_RATE="+10%"
TTS_MAX_CHARS="495"
TTS_VOLUME="1.0"

REQUIRE_WAKE_WORD="0"
MIN_UTTERANCE_SECONDS="1.0"
UTTERANCE_IDLE_MS="4500"
HERMES_TASK_TIMEOUT_MS="0"
HERMES_CHAT_TIMEOUT_MS="45000"
AGENT_VERBOSE_PROGRESS="0"
LATENCY_LOG_PATH="./.logs/latency.jsonl"
```

## Sélection de la voix TTS

Les préréglages de langue et la sélection de voix sont séparés :

- `vc language ko|en|auto` change la langue STT, la langue de progression et la voix par défaut pour cette langue.
- Les commandes vocales en direct comme “남자 한국어 목소리로 바꿔”, “여자 한국어 목소리로 바꿔”, `change voice to Korean female` et `switch speaker to English` ne changent que le locuteur/type de voix.
- `!voice-test <text>` joue un court échantillon avec le backend et la voix actuellement sélectionnés.

La sélection de voix est stockée par défaut dans `config/tts-voices.json`. Remplacez le chemin avec `TTS_VOICE_CONFIG`. La passerelle en cours d'exécution relit/applique la sélection de voix avant la synthèse, donc les commandes vocales prennent effet sans redémarrage complet.

Catalogue Edge par défaut :

| `TTS_VOICE_TYPE` | `TTS_VOICE` | Langue |
|---|---|---|
| `korean_male` | `ko-KR-InJoonNeural` | Coréen |
| `korean_female` | `ko-KR-SunHiNeural` | Coréen |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` | Coréen |
| `english_male` | `en-US-GuyNeural` | Anglais |
| `english_female` | `en-US-AriaNeural` | Anglais |

Remplacement manuel persistant :

```bash
TTS_BACKEND="edge"
TTS_VOICE_TYPE="korean_male"
TTS_VOICE="ko-KR-InJoonNeural"
TTS_VOICE_CONFIG="config/tts-voices.json"
```

Pour OpenVoice, SpeechSwift ou Supertonic, conservez les paramètres de voix/référence propres au backend dans les sections ci-dessous ; le même fichier de catalogue de voix peut tout de même suivre le type de voix actif.

Options vocales propres au backend :

| Backend | Paramètres | Choix de voix |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | Types intégrés ci-dessus, plus toute voix renvoyée par `edge-tts --list-voices` |
| Supertonic | `SUPERTONIC_VOICE`, `SUPERTONIC_LANGUAGE` | `M1`–`M5`, `F1`–`F5` ; langue `ko`, `en`, `es`, `pt`, `fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE`, `OPENVOICE_LANGUAGE` | WAV de référence autorisé fourni par l'utilisateur ; style par défaut `default` |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER`, `SPEECHSWIFT_MODEL_ID` | Voix par échantillon de référence pour CosyVoice, ou IDs locuteur/modèle pris en charge par le backend |

## Segmentation des énonciations

`UTTERANCE_IDLE_MS` contrôle combien de temps la passerelle attend après un segment de parole avant de décider que l'utilisateur a terminé et de démarrer le STT. La valeur par défaut est `4500` ms afin de préserver les longues instructions parlées avec pauses naturelles. Les valeurs plus basses semblent plus rapides pour les commandes courtes mais peuvent couper une longue dictée ; les valeurs plus hautes sont plus sûres pour une parole réfléchie.

```bash
UTTERANCE_IDLE_MS="4500"  # balanced default
UTTERANCE_IDLE_MS="6000"  # safer for long dictation with pauses
```

## Serveur MCP

VerbalCoding fournit un serveur MCP stdio afin que Hermes Agent ou tout client MCP puisse contrôler la passerelle via des outils au lieu de s'appuyer sur des skills ou des commandes shell libres.

Exemple de configuration Hermes :

```yaml
mcp_servers:
  verbalcoding:
    command: "node"
    args: ["/path/to/VerbalCoding/scripts/mcp-server.mjs"]
    timeout: 120
    connect_timeout: 30
```

Outils MCP exposés :

| Outil | Objectif |
|---|---|
| `status` | Signaler l'état passerelle/config sans secrets |
| `doctor` | Exécuter le contrôle doctor expurgé |
| `set_auto_restart` | Activer/désactiver le redémarrage automatique du bot vocal au moment des commits |
| `set_language` | Mettre à jour ensemble les langues STT/progression/TTS |
| `start`, `stop`, `restart` | Contrôler la passerelle vocale Discord |

## TTS OpenVoice facultatif

Edge TTS reste la valeur par défaut et le fallback. Pour essayer le clonage vocal local avec OpenVoice V2 :

```bash
./scripts/setup_openvoice.sh
# Download checkpoints_v2_0417.zip from OpenVoice docs and extract under vendor/OpenVoice/checkpoints_v2/
mkdir -p voice-samples
# Put a permitted reference sample at voice-samples/user-reference.wav,
# or capture one from Discord with !voice-clone capture.
python3 integrations/openvoice/synth.py --openvoice-dir vendor/OpenVoice --ref-audio voice-samples/user-reference.wav --text '안녕하세요. 버벌코딩 목소리 복제 테스트입니다.' --output /tmp/verbalcoding-openvoice-smoke.wav
```

Définissez ensuite :

```bash
TTS_BACKEND="openvoice"
OPENVOICE_REF_AUDIO="./voice-samples/user-reference.wav"
OPENVOICE_PROGRESS="0"
```

Clonez uniquement des voix que vous possédez ou que vous avez l'autorisation d'utiliser. Si OpenVoice échoue ou expire, VerbalCoding revient à Edge TTS.

## TTS Supertonic facultatif

```bash
./scripts/setup_supertonic.sh
supertonic tts '안녕하세요. 수퍼토닉 테스트입니다.' --lang ko --voice M1 --steps 2 --speed 1.0 -o /tmp/verbalcoding-supertonic.wav
```

Définissez ensuite :

```bash
TTS_BACKEND="supertonic"
SUPERTONIC_COMMAND="./.venv-supertonic/bin/supertonic"
SUPERTONIC_VOICE="M1"
SUPERTONIC_LANGUAGE="ko"
SUPERTONIC_STEPS="2"
SUPERTONIC_SPEED="1.0"
SUPERTONIC_PROGRESS="0"
```

Si Supertonic est absent, échoue ou expire, VerbalCoding revient à Edge TTS.

## TTS SpeechSwift / CosyVoice facultatif

Sur Apple Silicon, `speech-swift` est un backend local de clonage vocal coréen avec CosyVoice/Qwen3-TTS natif MLX.

```bash
brew tap soniqo/speech https://github.com/soniqo/speech-swift
brew install speech
```

Env recommandé :

```bash
TTS_BACKEND="speechswift"
SPEECHSWIFT_MODE="server"
SPEECHSWIFT_ENGINE="cosyvoice"
SPEECHSWIFT_LANGUAGE="korean"
SPEECHSWIFT_REF_AUDIO="./voice-samples/user-reference.wav"
SPEECHSWIFT_SERVER_HOST="127.0.0.1"
SPEECHSWIFT_SERVER_PORT="18080"
SPEECHSWIFT_SERVER_URL="http://127.0.0.1:18080"
SPEECHSWIFT_PROGRESS="0"
```

Gardez Edge pour les prompts rapides de progression/backchannel.

## Notes d'exploitation

- Le bot a besoin de l'intent privilégié Discord Message Content activé pour les commandes texte.
- Le bot a besoin des permissions de connexion/parole dans le salon vocal.
- Pour Hermes Agent, configurez/authentifiez Hermes normalement (`hermes setup`, `hermes login`, etc.) sur votre profil par défaut.
- Pour Claude Code, Codex, Gemini, OpenCode, OpenClaw, installez et authentifiez ces CLI séparément.
- Si une CLI émet une sortie diff/code lors d'un timeout ou d'un échec de signal, la passerelle évite de la lire à voix haute et envoie plutôt le texte détaillé.
