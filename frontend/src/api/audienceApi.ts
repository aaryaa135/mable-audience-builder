import type { AudienceRuleRequest, AudiencePreviewResponse } from "../types/audience";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export class ApiRequestError extends Error {
  requestId?: string;

  constructor(message: string, requestId?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.requestId = requestId;
  }
}

export async function previewAudience(
  request: AudienceRuleRequest,
  signal?: AbortSignal,
): Promise<AudiencePreviewResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/audiences/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    let requestId: string | undefined;
    let message = "API request failed";

    try {
      const errorData = await response.json();
      message = errorData.error?.message ?? message;
      requestId = errorData.error?.requestId;
    } catch {
      // If parsing fails, use default message
    }

    throw new ApiRequestError(message, requestId);
  }

  return response.json();
}