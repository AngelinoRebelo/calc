// Este código roda no servidor do Netlify, não no navegador do usuário.

exports.handler = async function(event) {
    // 1. Garante que a requisição seja do tipo POST para segurança.
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // 2. Pega a chave da API de forma segura das variáveis de ambiente do Netlify.
        // A chave NUNCA fica exposta no código do site.
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('A chave da API do Gemini não foi configurada no ambiente do servidor.');
        }

        // 3. Pega o texto do CNIS que foi enviado pelo site (frontend).
        const { cnisText } = JSON.parse(event.body);
        if (!cnisText) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'O texto do CNIS não foi fornecido.' }),
            };
        }
        
        const todayStr = new Date().toISOString().split('T')[0];
        const prompt = `Analise o extrato CNIS a seguir e extraia todos os períodos de contribuição em formato JSON. Para cada período, forneça 'dataInicio' e 'dataFim' no formato 'AAAA-MM-DD'. Se a data de fim estiver em aberto ou for inválida, use a data de hoje (${todayStr}). O texto é: """${cnisText}"""`;

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        vinculos: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    dataInicio: { type: "STRING" },
                                    dataFim: { type: "STRING" }
                                },
                                required: ["dataInicio", "dataFim"]
                            }
                        }
                    },
                    required: ["vinculos"]
                }
            }
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        // 4. Faz a chamada segura para a API do Google a partir do servidor.
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Erro da API Gemini:", errorBody);
            return { statusCode: response.status, body: JSON.stringify({ error: `Erro na API: ${response.statusText}` }) };
        }

        const result = await response.json();
        const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonText) {
            throw new Error("A resposta da IA estava vazia ou em formato incorreto.");
        }
        
        // 5. Retorna a resposta da API para o site (frontend).
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: jsonText,
        };

    } catch (error) {
        console.error("Erro na Netlify Function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
