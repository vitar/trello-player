# Audio Player for Trello

Audio Player foir Trello allows to play audio attachments (tested with .m4a only) as a playlist.

Implemented as:

* Trello Power-Up addon
* Standalone page using Trello API

## Power-up addon

Power-up is working on Trello web, Trello mobile apps does not support custom Power-ups.

### Known issues

* This Power-Up does not conform Trello requirements and is not publically listed, but can be self-hosted and installed into Trello workspace.
* Add instructions on how to add Power-Up to Trello.

## Standalone page

Note: index.html is initially created with ChatGPT.

Static web page with Trello Player, which plays selected Trello board lists' .m4a attachments.

### Require
* To be hosted somewhere
* Browser logged into your Trello board.
* Trello API key, get here by registering Power-Up: https://trello.com/power-ups/admin
* Trello API token, get here: https://trello.com/1/authorize?expiration=never&scope=read,write,account&response_type=token&key=YOUR-TRELLO-API-KEY-IS-HERE
* Trello board key: get from your Trello board URL, https://trello.com/b/YOUR-BOARD-KEY-IS-HERE

### Known issues
* Not implemented: when installed as PWA, files will not play without login to Trello first.
