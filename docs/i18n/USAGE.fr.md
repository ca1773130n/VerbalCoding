# Guide d'utilisation de VerbalCoding


## Flux setup actuel

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

Ne modifiez pas `.env` à la main : utilisez `vc setup token` pour enregistrer `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID`, et `vc setup channels` pour `AUTO_JOIN_VOICE_CHANNELS`. Si Docker affiche `Cannot perform IP discovery - socket closed`, utilisez `network_mode: "host"` avec Compose sous Linux et supprimez `ports:`.

Cette page contient les détails opérationnels qui rendaient auparavant le README trop long.

## Commandes CLI

```bash
vc status                    # show STT language, progress language, and TTS voice
vc language en               # English STT + English progress/TTS voice
vc language ko               # Korean STT + Korean progress/TTS voice
vc language auto             # Whisper auto-detect STT + English progress/TTS voice
vc restart auto status       # show commit-time voice-bot auto-restart setting
vc restart auto on           # enable commit-time voice-bot auto-restart
vc restart auto off          # disable it; this is the default
vc bot invite CLIENT_ID      # print a Discord invite URL with required permissions
vc instance status           # list per-instance bridge configs and process status
vc instance setup NAME       # write instances/NAME.env and create ~/.hermes/profiles/NAME
vc instance start NAME       # start ./run.sh instances/NAME.env detached
vc instance stop NAME        # stop a detached instance and remove its pid file
vc doctor                    # run the redacted doctor check
npm run mcp                  # run the stdio MCP server
```

Les changements de langue mettent à jour `.env` ; redémarrez la passerelle avec `./run.sh` ou votre gestionnaire de processus pour qu'ils prennent effet.

## Modes d'exécution

Passerelle à instance unique :

```bash
./run.sh
```

Passerelle par instance avec un env de surcharge local :

```bash
./run.sh instances/my-project.env
# or
VERBALCODING_INSTANCE_ENV=instances/my-project.env ./run.sh
```

Le bot rejoint automatiquement le premier nom de salon configuré, par défaut `일반,General,general`.

## Commandes Discord

Avant de câbler les commandes, configurez l'application/le bot Discord avec les guides amont :

- Guide Discord de Hermes Agent : <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Documentation officielle des bots Discord : <https://docs.discord.com/developers/bots/overview>

Utilisez ensuite `vc bot invite CLIENT_ID` pour générer l'URL d'invitation propre à VerbalCoding avec permissions texte et voix.

| Commande | Objectif |
|---|---|
| `!ping` | Vérification de base du bot |
| `!join` / `!leave` | Rejoindre ou quitter la voix |
| `!say <text>` | Énoncer directement du texte via TTS |
| `!voice-test <text>` | Tester le backend/la voix TTS actif |
| `!voice-clone capture` | Enregistrer la prochaine énonciation valide comme échantillon de référence OpenVoice |
| `!voice-clone status` / `!voice-clone cancel` | Inspecter ou annuler la capture |
| `!ask <prompt>` | Envoyer du texte via le même adaptateur de harnais sélectionné que la voix |
| `!session status` | Afficher la session de projet/par défaut actuelle de l'adaptateur |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | Créer une session Hermes limitée à un projet |
| `!session attach-voice [sessionName] --voice <voice-channel>` | Lier un salon/fil texte à un salon vocal |
| `!session list` | Lister les sessions de projet configurées |
| `!session reset` / `!reset-session` | Effacer le fichier de session de projet/par défaut actuel de l'adaptateur |
| `!verbose on/off` | Activer/désactiver les mises à jour détaillées de progression |
| `!latency` / `!metrics` | Afficher un résumé récent de la latence |
| `!sensitivity normal/conservative` | Changer la sensibilité d'interruption |

Les équivalents vocaux comme “외부 모드”, “보수 모드”, “실내”, “기본 감도” et les phrases d'arrêt claires comme “잠깐”, “멈춰”, “그만” sont gérés par la passerelle. Vous pouvez aussi dire “상세 진행 켜” / “상세 진행 꺼” pour activer/désactiver la progression détaillée par la voix.

## Changer la voix

`vc language ko|en|auto` change ensemble la langue STT, la langue de progression et la voix TTS par défaut correspondante. Si vous voulez seulement changer le locuteur/la voix pendant que la passerelle tourne, dites-le dans le vocal Discord :

```text
남자 한국어 목소리로 바꿔
여자 한국어 목소리로 바꿔
change voice to Korean female
switch speaker to English
```

La passerelle en cours d'exécution reconnaît ces phrases comme des commandes vocales, met à jour `config/tts-voices.json`, met à jour l'env TTS effectif du processus actif et répond par une courte confirmation comme “목소리를 Korean male로 바꿨어.” Utilisez `!voice-test <text>` juste après le changement pour entendre le backend et la voix actuels.

Types de voix Edge intégrés :

| Type de voix | Voix Edge |
|---|---|
| `korean_male` | `ko-KR-InJoonNeural` |
| `korean_female` | `ko-KR-SunHiNeural` |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` |
| `english_male` | `en-US-GuyNeural` |
| `english_female` | `en-US-AriaNeural` |

Pour une configuration manuelle persistante, définissez `TTS_BACKEND=edge`, `TTS_VOICE_TYPE=<voice-type>` et éventuellement `TTS_VOICE=<edge-voice>` dans `.env`, ou modifiez `config/tts-voices.json` pour des catalogues de voix personnalisés.

Réglages vocaux propres au backend :

| Backend | Paramètre de voix | Choix courants |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | `korean_male`, `korean_female`, `korean_multilingual_male`, `english_male`, `english_female` ; toute voix Edge de `edge-tts --list-voices` |
| Supertonic | `SUPERTONIC_VOICE` | `M1`–`M5`, `F1`–`F5` ; définissez `SUPERTONIC_LANGUAGE=ko|en|es|pt|fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE` | un WAV de référence autorisé plus un style comme `default` |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER` | WAV de référence pour CosyVoice, ou valeurs locuteur/modèle prises en charge par le backend |

Pour Supertonic et les backends de clonage locaux, utilisez les variables d'env ci-dessus ainsi que `!voice-test <text>` pour écouter les changements. Le changement par commande vocale mappe actuellement les types de voix intégrés de style Edge ; des catalogues de backends plus riches peuvent être ajoutés dans `config/tts-voices.json`.

## Dictée longue et pauses

VerbalCoding attend une fenêtre d'inactivité avant d'envoyer la parole au STT. La valeur par défaut `UTTERANCE_IDLE_MS=4500` est volontairement un peu patiente afin qu'une pause naturelle dans une longue instruction ne coupe pas la phrase, ne démarre pas un tour d'agent trop tôt, puis ne traite pas la suite comme une interruption pendant le traitement.

Si vous préférez des commandes courtes plus rapides, diminuez-la dans `.env` ; si une longue dictée coréenne est encore coupée, augmentez-la :

```bash
UTTERANCE_IDLE_MS="6000"
```

## Mode progression détaillée

La progression détaillée est désactivée par défaut sauf si `AGENT_VERBOSE_PROGRESS=1` est défini. Activez-la avec `!verbose on` ou une commande vocale comme “상세 진행 켜”. Elle peut émettre de courtes lignes de progression comme :

```text
🤖 Hermes Agent 호출 시작
📖 파일 읽기 app-node/main.mjs
🔎 웹 검색 실행
⌨️ 터미널 명령 실행
🤖 Hermes Agent 응답 수신
```

Ce mode demande au harnais CLI sélectionné d'émettre des lignes `VERBALCODING_PROGRESS: ...` et résume les marqueurs d'outils courants depuis stdout/stderr en streaming quand ils sont disponibles. Les champs ressemblant à des secrets sont expurgés et les lignes de progression sont retirées de la réponse finale énoncée.

## Métriques de latence

VerbalCoding écrit des enregistrements de latence par tour en JSONL. Chemin par défaut :

```text
./.logs/latency.jsonl
```

Chaque enregistrement inclut le statut, le temps total, le temps de capture vocale, l'attente d'inactivité de l'énonciation, le temps STT, le temps agent, le temps de synthèse/lecture TTS, le nombre de morceaux, la longueur de transcription, la longueur de réponse et les niveaux audio quand disponibles.

Dans Discord :

```text
!latency
!metrics
```

Le résumé utilise les 200 derniers enregistrements : nombre, moyenne, p95, maximum et statuts non-OK.

## Tests

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
vc doctor
```

`vc doctor` expurge intentionnellement les secrets et indique seulement si les valeurs requises sont configurées. Il vérifie aussi `instances/*.env` pour détecter les empreintes de jetons dupliquées et les chemins d'exécution en collision.
