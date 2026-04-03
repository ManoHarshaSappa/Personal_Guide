export function parseJsonResponse(raw: string): unknown {
  const direct = tryParse(raw);

  if (direct.ok) {
    return direct.value;
  }

  const cleaned = raw
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();

  const cleanedResult = tryParse(cleaned);

  if (cleanedResult.ok) {
    return cleanedResult.value;
  }

  const firstObject = cleaned.indexOf("{");
  const lastObject = cleaned.lastIndexOf("}");

  if (firstObject !== -1 && lastObject !== -1 && lastObject > firstObject) {
    const objectSlice = cleaned.slice(firstObject, lastObject + 1);
    const objectResult = tryParse(objectSlice);

    if (objectResult.ok) {
      return objectResult.value;
    }
  }

  const firstArray = cleaned.indexOf("[");
  const lastArray = cleaned.lastIndexOf("]");

  if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
    const arraySlice = cleaned.slice(firstArray, lastArray + 1);
    const arrayResult = tryParse(arraySlice);

    if (arrayResult.ok) {
      return arrayResult.value;
    }
  }

  throw new Error("OpenAI returned invalid JSON.");
}

function tryParse(raw: string):
  | { ok: true; value: unknown }
  | { ok: false } {
  try {
    return {
      ok: true,
      value: JSON.parse(raw),
    };
  } catch {
    return { ok: false };
  }
}
