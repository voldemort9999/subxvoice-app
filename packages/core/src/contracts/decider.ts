/**
 * A classifier that answers a multiple-choice question about some text and says how sure it is.
 *
 * Separate from `LlmProvider` because the thing behind it is not a chat model: Jev is a
 * "decisions model" and refuses the chat endpoint outright. It takes criteria rather than a
 * prompt, and answers with a choice plus a probability for every option — which is what makes a
 * confidence threshold meaningful instead of guessed from prose.
 */

export interface DecisionRequest {
  /** What the model is deciding about. Usually one entry: the transcript. */
  state: string[];
  /** Option name → what that option means. The model picks one of these keys. */
  criteria: Record<string, string>;
  /** The question itself, if the criteria do not say it on their own. */
  instructions?: string;
}

export interface Decision {
  /** One of the keys from `criteria`. */
  choice: string;
  /** 0–1 for the chosen option. */
  confidence: number;
  /** Every option's probability, when the provider reports them. */
  probabilities?: Record<string, number>;
}

export interface DeciderProvider {
  readonly id: string;
  decide(request: DecisionRequest): Promise<Decision>;
}
