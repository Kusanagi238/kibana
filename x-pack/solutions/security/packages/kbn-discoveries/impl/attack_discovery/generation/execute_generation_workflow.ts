/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

// Placeholder — real implementation added in PR 4

export type ManualOrchestrationOutcome =
  | {
      outcome: 'validation_failed';
    }
  | {
      alertRetrievalResult: {
        alertsContextCount: number;
        anonymizedAlerts: unknown[];
      };
      generationResult: {
        attackDiscoveries: unknown[];
        executionUuid: string;
      };
      outcome: 'validation_succeeded';
      validationResult: {
        generatedCount: number;
      };
    };

export async function executeGenerationWorkflow(
  _params: unknown
): Promise<ManualOrchestrationOutcome> {
  throw new Error('executeGenerationWorkflow: not implemented in this PR');
}
