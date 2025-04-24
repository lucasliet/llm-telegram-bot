/**
 * Service for interacting with Cloudflare AI API
 */

export default {
	/**
	 * Transcribe audio to text
	 * @param audioFile - Promise resolving to audio file as Uint8Array
	 * @returns Transcribed text
	 */
	async transcribeAudio(audioFile: Promise<Uint8Array>): Promise<string> {
		const audioData = await audioFile;
		const formData = new FormData();

		const file = new Blob([audioData], { type: 'audio/mpeg' });
		formData.append('file', file, 'audio.mp3');
		formData.append('model_id', 'scribe_v1');
		formData.append('tag_audio_events', 'true');
		formData.append('diarize', 'true');

		const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text?allow_unauthenticated=1', {
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
			body: formData,
		});

		if (!response.ok) {
			throw new Error(`Failed to transcribe text: ${response.statusText}`);
		}

		const { text } = await response.json();

		return text;
	},

	/**
	 * Converte texto em áudio usando ElevenLabs API
	 * @param text - Texto para converter em áudio
	 * @param voiceId - ID da voz a ser usada (opcional, padrão: SAz9YHcvj6GT2YYXdXww)
	 * @param modelId - ID do modelo a ser usado (opcional, padrão: eleven_multilingual_v2)
	 * @returns Áudio como Uint8Array
	 */
	async textToSpeech(
		text: string,
		voiceId: string = 'SAz9YHcvj6GT2YYXdXww',
		modelId: string = 'eleven_multilingual_v2',
	): Promise<Uint8Array> {
		const MAX_TEXT_LENGTH = 500;
		let processedText = text;

		if (text.length > MAX_TEXT_LENGTH) {
			console.log(`Texto muito longo (${text.length} caracteres), limitando a ${MAX_TEXT_LENGTH} caracteres devido às restrições da API ElevenLabs.`);
			processedText = text.substring(0, MAX_TEXT_LENGTH);
		}

		const requestBody = JSON.stringify({
			text: processedText,
			model_id: modelId,
		});

		try {
			const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?allow_unauthenticated=1`, {
				method: 'POST',
				headers: {
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:136.0) Gecko/20100101 Firefox/136.0',
					'Accept': '*/*',
					'Accept-Language': 'pt-BR',
					'Accept-Encoding': 'gzip, deflate, br, zstd',
					'Referer': 'https://elevenlabs.io/',
					'Content-Type': 'application/json',
					'Origin': 'https://elevenlabs.io',
					'DNT': '1',
					'Connection': 'keep-alive',
					'Sec-Fetch-Dest': 'empty',
					'Sec-Fetch-Mode': 'cors',
					'Sec-Fetch-Site': 'same-site',
					'Sec-GPC': '1',
					'Priority': 'u=0',
					'TE': 'trailers',
				},
				body: requestBody,
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => 'Não foi possível ler a resposta');
				console.error(`Erro na API ElevenLabs: Status ${response.status}, Resposta: ${errorText}`);

				if (errorText.includes('max_character_limit_exceeded')) {
					throw new Error(`Limite de caracteres excedido na API ElevenLabs. A versão gratuita permite apenas 500 caracteres.`);
				}

				throw new Error(`Falha ao converter texto para áudio: ${response.statusText}`);
			}

			return new Uint8Array(await response.arrayBuffer());
		} catch (error) {
			console.error('Erro ao processar requisição para ElevenLabs:', error);
			throw error;
		}
	},
};
