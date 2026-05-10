# Dépannage VerbalCoding

## `Cannot perform IP discovery - socket closed`

Cette erreur signifie que le bot s’est connecté à Discord et a trouvé le salon vocal, mais que la découverte UDP de Discord voice a échoué.

Sous Docker Compose Linux, utilisez :

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

Supprimez `ports:` du même service. Docker Desktop macOS/Windows gère le mode host différemment ; si cela échoue encore, lancez VerbalCoding sur l’hôte ou dans une VM Linux.

## Token and channel setup

Si le jeton manque, lancez `vc setup token` ; si le nom du salon ne correspond pas, lancez `vc setup channels "<vrai salon vocal>"`.

```bash
vc setup token
vc setup channels "General,Team Voice"
vc doctor
```
