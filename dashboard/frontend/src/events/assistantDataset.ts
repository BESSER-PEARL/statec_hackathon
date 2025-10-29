export const ASSISTANT_DATASET_EVENT = 'assistant:set-dataset';

export interface AssistantDatasetEventDetail {
  dataset: string;
  dimension?: string;
  raw?: unknown;
}

export type AssistantDatasetEvent = CustomEvent<AssistantDatasetEventDetail>;
