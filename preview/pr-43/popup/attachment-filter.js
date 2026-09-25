export const SUPPORTED_AUDIO_EXTENSIONS = ['.m4a', '.mp3'];

// Only files uploaded to Trello are played. Link attachments can point at any
// host, and fetching them through the proxy would send the user's Trello
// credentials along with the request.
export function isSupportedAttachment(attachment) {
  if (attachment?.isUpload !== true) {
    return false;
  }
  return SUPPORTED_AUDIO_EXTENSIONS.some((ext) => attachment.url?.toLowerCase().endsWith(ext));
}
