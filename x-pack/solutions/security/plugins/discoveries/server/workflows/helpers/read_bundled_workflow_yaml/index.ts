/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { readFileSync } from 'fs';

import type { Logger } from '@kbn/core/server';

/**
 * Reads a bundled workflow YAML file from the given absolute path.
 * Returns the trimmed YAML content, or null if the file cannot be read.
 */
export const readBundledWorkflowYaml = ({
  logger,
  yamlFileName,
  yamlPath,
}: {
  logger: Logger;
  yamlFileName: string;
  yamlPath: string;
}): string | null => {
  try {
    return readFileSync(yamlPath, 'utf-8').trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to read bundled workflow YAML '${yamlFileName}': ${message}`);
    return null;
  }
};
