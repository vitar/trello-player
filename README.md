# trello-player

Trello Player allows to play .m4a and .mp3 attachments as a playlisr.

Implementeds as:

* Standalone page
* Power-up addon

## Standalone page

Note: index.html is initially created with ChatGPT.

Static web page with Trello Player, which plays selected Trello board lists' .m4a attachments.

Hosted: https://vitar.github.io/trello-player/

### Require
* Browser logged into your Trello board.
* Trello API key: a7ff32d26319601d9547fedd9a49bd40
* Trello API token, get here: https://trello.com/1/authorize?expiration=never&scope=read,write,account&response_type=token&key=a7ff32d26319601d9547fedd9a49bd40
* Trello board key: get from your Trello board URL, https://trello.com/b/BOARD-KEY-IS-HERE

### Known issues
* Not implemented: when installed as PWA, files will not play without login to Trello first.

## Power-up addon

Power-up is working on Trello web, Trello mobile apps does not support custome Power-ups.
