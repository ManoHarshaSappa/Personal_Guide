const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5.1";

export interface JsonSchemaFormat {
  type: "json_schema";
  name: string;
  strict: true;
  schema: Record<string, unknown>;
}

interface CallLLMOptions {
  instructions?: string;
  model?: string;
  maxOutputTokens?: number;
  format?: JsonSchemaFormat;
}

interface OpenAIResponseContent {
  type: string;
  text?: string;
  refusal?: string;
}

interface OpenAIResponseOutputItem {
  type: string;
  content?: OpenAIResponseContent[];
}

interface OpenAIResponsePayload {
  error?: {
    message?: string;
  };
  output?: OpenAIResponseOutputItem[];
  output_text?: string;
}

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }

  return apiKey;
}

function extractOutputText(payload: OpenAIResponsePayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const refusal = payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === "refusal")
    ?.refusal;

  if (refusal) {
    throw new Error(`OpenAI refused the request: ${refusal}`);
  }

  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n");

  if (!text) {
    throw new Error("OpenAI returned no text output.");
  }

  return text;
}

export async function callLLM(
  prompt: string,
  options: CallLLMOptions = {},
): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_OPENAI_MODEL,
      reasoning: { effort: "low" },
      instructions: options.instructions,
      input: prompt,
      max_output_tokens: options.maxOutputTokens ?? 2400,
      ...(options.format
        ? {
            text: {
              format: options.format,
            },
          }
        : {}),
    }),
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "OpenAI request failed.");
  }

  return extractOutputText(payload);
}
