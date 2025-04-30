/**
 * Extends the ReadableStreamDefaultReader interface to include a text() method
 * that reads the entire stream and returns its contents as a string.
 *
 * @returns A promise that resolves with the full text content of the stream.
 */
declare global {
  interface ReadableStreamDefaultReader {
    /**
     * Reads the entire stream and returns its contents as a string.
     *
     * @returns A promise that resolves with the full text content of the stream.
     */
    text(): Promise<string>;
  }
}

/**
 * Reads the entire stream and returns its contents as a string.
 *
 * @returns A promise that resolves with the full text content of the stream.
 */
ReadableStreamDefaultReader.prototype.text = async function (): Promise<string> {
  const decoder = new TextDecoder();
  let fullText = '';
  while (true) {
    const { value, done } = await this.read();
    if (done) break;
    fullText += decoder.decode(value);
  }
  return fullText;
};