# Audio Player Power-Up for Trello

Audio Player Power-Up is a custom Trello Power-Up that plays audio attachments on a board list.  Attachments ending in `.m4a` or `.mp3` are grouped into a playlist.  The Power-Up can also store a waveform for each attachment in Trello card storage so that the waveform can be displayed later.

The files in this repository are static and can be hosted on any static hosting provider.  GitHub Pages works well&mdash;fork this repository and enable Pages to serve the files.

## Enabling the Power-Up in Trello
1. Open the [Trello Power-Up admin page](https://trello.com/power-ups/admin) and choose **New**.
2. Fill in the form:
   - **New Power-Up or Integration**: `Audio Player`
   - **Workspace**: choose your workspace
   - **Iframe connector URL**: the URL of `trello-player-power-up.html`
   - **Email**, **Support contact** and **Author**: your details
3. After creation open the Power-Up settings and configure:
   - **Icon**: link to `trello-player-192.png`
   - **Categories**: *Files management* and *Board utilities*
   - Enable **List actions** in **Capabilities**
   - Under **Privacy and compliance** set **Privacy URL** to the hosted `privacy.html` and answer **No** to storing Trello user personal data
4. Add the Power-Up to a board via **Power-Ups → Custom → Audio Player**.
5. In a board list open the list menu (`...`) and select **Audio Player**.

## Usage
- The popup displays all `.m4a` and `.mp3` attachments from cards in the list.
- Use **Previous** and **Next** to navigate the playlist while the audio player plays each attachment.
- Click the wrench next to the waveform area to create the waveform:
  1. Download the file.
  2. Load the downloaded file into the modal.
  3. Save the waveform back to Trello storage.

The Power-Up has been briefly tested in desktop and mobile Chrome.
_Trello mobile apps do not support custom Power-Ups._

## Known issues
- This Power-Up does not conform to Trello requirements and is not publicly listed, but it can be self-hosted and enabled in your workspace.

## License
The project is released under the [Unlicense](LICENSE).  Security issues can be reported by opening an issue in this repository as described in [SECURITY.md](SECURITY.md).
