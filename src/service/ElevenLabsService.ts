/**
 * Service for interacting with Cloudflare AI API
 */

export default {
	/**
	 * Transcribe audio to text
	 * @param audioFile - Promise resolving to audio file as Uint8Array
	 * @returns Transcribed text
   * 
	 */
	async transcribeAudio(audioFile: Promise<Uint8Array>): Promise<string> {
		const audioData = await audioFile;
		const formData = new FormData();
		
		// Criar um arquivo a partir dos dados binários
		const file = new Blob([audioData], { type: 'audio/mpeg' });
		formData.append('file', file, 'audio.mp3');
		
		// Adicionar parâmetros adicionais necessários
		formData.append('model_id', 'scribe_v1');
		formData.append('tag_audio_events', 'true');
		formData.append('diarize', 'true');
		
		const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text?allow_unauthenticated=1',
			{
				method: 'POST',
				headers: {
					'Host': 'api.elevenlabs.io',
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:136.0) Gecko/20100101 Firefox/136.0',
					'Accept': '*/*',
					'Accept-Language': 'pt-BR',
					'Accept-Encoding': 'gzip, deflate, br, zstd',
					'Referer': 'https://elevenlabs.io/',
					'Origin': 'https://elevenlabs.io',
					'DNT': '1',
					'Connection': 'keep-alive',
					'Sec-Fetch-Dest': 'empty',
					'Sec-Fetch-Mode': 'cors',
					'Sec-Fetch-Site': 'same-site',
					'Sec-GPC': '1',
					'Priority': 'u=4',
					'TE': 'trailers',
				},
				body: formData
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to transcribe text: ${response.statusText}`);
		}

		const { text } = await response.json();

		return text;
	},

	
};