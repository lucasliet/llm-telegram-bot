interface StatusResponse {
    record_id: string;
    status: string;
    response?: { url: string }[];
    detail?: { msg: string }[];
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateToken(): Promise<string> {
    const url = "https://www.googleapis.com/identitytoolkit/v3/relyingparty/signupNewUser?key=AIzaSyB3-71wG0fIt0shj0ee4fvx1shcjJHGrrQ";
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Android-Cert": "ADC09FCA89A2CE4D0D139031A2A587FA87EE4155",
            "X-Firebase-Gmpid": "1:713239656559:android:f9e37753e9ee7324cb759a",
            "X-Firebase-Client": "H4sIAAAAAAAA_6tWykhNLCpJSk0sKVayio7VUSpLLSrOzM9TslIyUqoFAFyivEQfAAAA",
            "X-Client-Version": "Android/Fallback/X22003001/FirebaseCore-Android",
            "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 15;)",
            "X-Android-Package": "ai.generated.art.maker.image.picture.photo.generator.painting",
        },
        body: JSON.stringify({ clientType: "CLIENT_TYPE_ANDROID" }),
    });
    if (!res.ok) throw new Error(`Failed to generate token: ${res.statusText}`);
    const data = await res.json();
    return data.idToken as string;
}

async function requestGeneration(prompt: string, token: string): Promise<StatusResponse> {
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("negative_prompt", "");
    form.append("style", "SDXL 1.0");
    form.append("images_num", "1");
    form.append("cfg_scale", "7");
    form.append("steps", "40");
    form.append("aspect_ratio", "1:1");

    const res = await fetch("https://img-gen-prod.ai-arta.com/api/v1/text2image", {
        method: "POST",
        headers: {
            Authorization: token,
            "User-Agent": "AiArt/4.18.6 okHttp/4.12.0 Android R",
        },
        body: form,
    });
    const data = await res.json() as StatusResponse;
    if (!res.ok) {
        const msg = data.detail?.[0]?.msg ?? res.statusText;
        throw new Error(`Failed to start image generation: ${msg}`);
    }
    return data;
}

async function fetchStatus(recordId: string, token: string): Promise<StatusResponse> {
    const res = await fetch(`https://img-gen-prod.ai-arta.com/api/v1/text2image/${recordId}/status`, {
        headers: {
            Authorization: token,
            "User-Agent": "AiArt/3.23.12 okHttp/4.12.0 Android VANILLA_ICE_CREAM",
        },
    });
    if (!res.ok) throw new Error(`Failed to fetch image status: ${res.statusText}`);
    return await res.json() as StatusResponse;
}

export default {
    async generateImage(prompt: string): Promise<string> {
        const token = await generateToken();
        const initial = await requestGeneration(prompt, token);
        for (let i = 0; i < 10; i++) {
            await delay(5000);
            const status = await fetchStatus(initial.record_id, token);
            if (status.status === "DONE" && status.response?.length) {
                return status.response[0].url;
            }
        }
        throw new Error("Image generation timed out");
    },
};

