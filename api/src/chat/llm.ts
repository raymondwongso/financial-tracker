import Anthropic from '@anthropic-ai/sdk';

export interface LlmRequest {
  system: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
}

/** The parts of a Claude response the chat loop needs; lets tests script responses. */
export type LlmResponse = Pick<Anthropic.Message, 'content' | 'stop_reason'>;

export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResponse>;
}

export class AnthropicLlm implements LlmClient {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey, timeout: 60_000 });
  }

  async complete({ system, messages, tools }: LlmRequest): Promise<LlmResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      // Chat replies are short and tool selection is simple; low effort keeps latency and cost down.
      output_config: { effort: 'low' },
      system,
      messages,
      tools,
    });
    return { content: response.content, stop_reason: response.stop_reason };
  }
}
