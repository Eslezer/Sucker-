export function buildChatCompletionResponse(cardId: string, cardName: string, baseUrl: string) {
  return {
    id: `chatcmpl-extracted-${cardId}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'card-extractor',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: `✅ Character card "${cardName}" extracted successfully!\n\nView & download: ${baseUrl}/cards/${cardId}`,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}

export function buildStreamResponse(cardId: string, cardName: string, baseUrl: string): string {
  const content = `✅ Character card "${cardName}" extracted successfully!\n\nView & download: ${baseUrl}/cards/${cardId}`;

  const chunk = {
    id: `chatcmpl-extracted-${cardId}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'card-extractor',
    choices: [
      {
        index: 0,
        delta: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
  };

  return `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`;
}
