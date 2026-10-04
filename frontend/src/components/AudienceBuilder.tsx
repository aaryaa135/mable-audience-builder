import { useState } from "react";
import { previewAudience, ApiRequestError } from "../api/audienceApi";
import type {
  AudienceCondition,
  AudiencePreviewResponse,
  AudienceRuleRequest,
} from "../types/audience";
import { ConditionRow } from "./ConditionRow";

const DEFAULT_AS_OF = "2026-09-29T00:00:00.000Z";

function createCondition(): AudienceCondition {
  return {
    id: crypto.randomUUID(),
    eventType: "product_view",
    operator: "at_least",
    count: "2",
    withinDays: "7",
  };
}

export function AudienceBuilder() {
  const [name, setName] = useState("Product Viewers - No Purchase");
  const [asOf, setAsOf] = useState(DEFAULT_AS_OF);

  const [conditions, setConditions] = useState<AudienceCondition[]>([
    createCondition(),
    {
      id: crypto.randomUUID(),
      eventType: "purchase",
      operator: "exactly",
      count: "0",
      withinDays: "7",
    },
  ]);

  const [result, setResult] =
    useState<AudiencePreviewResponse | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] =
    useState<AudienceRuleRequest | null>(null);

  function updateCondition(
    id: string,
    updates: Partial<AudienceCondition>,
  ) {
    setConditions((current) =>
      current.map((condition) =>
        condition.id === id
          ? { ...condition, ...updates }
          : condition,
      ),
    );
  }

  function removeCondition(id: string) {
    setConditions((current) =>
      current.filter((condition) => condition.id !== id),
    );
  }

  function addCondition() {
    if (conditions.length >= 10) return;
    setConditions((current) => [...current, createCondition()]);
  }

  function buildRequest(): AudienceRuleRequest {
    return {
      name: name.trim(),
      asOf,
      conditions: conditions.map((condition) => ({
        eventType: condition.eventType,
        operator: condition.operator,
        count: Number(condition.count),
        withinDays: Number(condition.withinDays),
      })),
    };
  }

  async function runPreview(request: AudienceRuleRequest) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await previewAudience(request);

      setResult(response);
      setLastRequest(request);
    } catch (requestError) {
      if (
        requestError instanceof DOMException &&
        requestError.name === "AbortError"
      ) {
        return;
      }

      if (requestError instanceof ApiRequestError) {
        setError(
          `${requestError.message}${
            requestError.requestId
              ? ` Request ID: ${requestError.requestId}`
              : ""
          }`,
        );
      } else {
        setError("Unable to reach the backend API.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const request = buildRequest();
    void runPreview(request);
  }

  function retry() {
    if (lastRequest) {
      void runPreview(lastRequest);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <p className="eyebrow">Mable Audience Builder</p>

        <h1>Build an audience</h1>

        <p>
          Define event rules and preview the matching anonymous users.
        </p>
      </header>

      <form className="builder-card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="audience-name">
            Audience name
          </label>

          <input
            id="audience-name"
            type="text"
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="as-of">
            Evaluate as of
          </label>

          <input
            id="as-of"
            type="datetime-local"
            value={asOf.slice(0, 16)}
            onChange={(event) =>
              setAsOf(`${event.target.value}:00.000Z`)
            }
            required
            aria-describedby="as-of-hint"
          />

          <small id="as-of-hint">UTC</small>
        </div>

        <section aria-labelledby="conditions-heading">
          <div className="section-heading">
            <div>
              <h2 id="conditions-heading">
                Conditions
              </h2>

              <p>All conditions must match.</p>
            </div>

            <button
              type="button"
              onClick={addCondition}
              disabled={conditions.length >= 10}
              aria-label="Add a new condition"
            >
              + Add condition
            </button>
          </div>

          <div className="conditions">
            {conditions.map((condition) => (
              <ConditionRow
                key={condition.id}
                condition={condition}
                onChange={updateCondition}
                onRemove={removeCondition}
                canRemove={conditions.length > 1}
              />
            ))}
          </div>
        </section>

        <button
          className="preview-button"
          type="submit"
          disabled={isLoading}
        >
          {isLoading
            ? "Previewing..."
            : "Preview audience"}
        </button>
      </form>

      {error && (
        <section className="message error" role="alert">
          <div>
            <strong>Preview failed</strong>
            <p>{error}</p>
          </div>

          <button type="button" onClick={retry}>
            Retry
          </button>
        </section>
      )}

      {!result && !error && !isLoading && (
        <section className="message empty" aria-live="polite">
          <strong>No preview yet</strong>

          <p>
            Configure the conditions and preview the audience.
          </p>
        </section>
      )}

      {result && (
        <section
          className="results"
          aria-labelledby="results-heading"
        >
          <div className="results-header">
            <div>
              <p className="eyebrow">Preview result</p>

              <h2 id="results-heading">
                {result.name}
              </h2>
            </div>

            <div className="audience-size">
              <strong>{result.total}</strong>
              <span>users</span>
            </div>
          </div>

          <p className="evaluated">
            Evaluated {result.evaluatedUsers} eligible
            anonymous users.
          </p>

          {result.members.length === 0 ? (
            <div className="message empty">
              <strong>No matching users</strong>

              <p>
                No users satisfy all of the configured
                conditions.
              </p>
            </div>
          ) : (
            <div className="members">
              {result.members.map((member) => (
                <article
                  className="member"
                  key={member.anonymousId}
                >
                  <h3>{member.anonymousId}</h3>

                  <div className="evidence-list">
                    {member.evidence.map((evidence) => (
                      <div
                        className="evidence"
                        key={evidence.conditionIndex}
                      >
                        <span>
                          {evidence.eventType.replaceAll(
                            "_",
                            " ",
                          )}
                        </span>

                        <strong>
                          {evidence.observedCount}
                        </strong>

                        <small>
                          {evidence.operator ===
                          "at_least"
                            ? `≥ ${evidence.required}`
                            : `= ${evidence.required}`}
                        </small>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}