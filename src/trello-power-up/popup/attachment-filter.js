export const SUPPORTED_AUDIO_EXTENSIONS = ['.m4a', '.mp3'];

export function isSupportedAttachment(attachment) {
  return SUPPORTED_AUDIO_EXTENSIONS.some((ext) => attachment.url?.toLowerCase().endsWith(ext));
}
