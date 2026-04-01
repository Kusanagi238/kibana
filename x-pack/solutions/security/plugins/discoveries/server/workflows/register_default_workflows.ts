/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { join } from 'path';
import type { KibanaRequest, Logger } from '@kbn/core/server';
import type { WorkflowListDto } from '@kbn/workflows';
import type { WorkflowsServerPluginSetup } from '@kbn/workflows-management-plugin/server';
import { readBundledWorkflowYaml } from './helpers/read_bundled_workflow_yaml';

interface DefaultWorkflowDefinition {
  key:
    | 'custom_validation_example'
    | 'default_alert_retrieval'
    | 'esql_example_alert_retrieval'
    | 'generation'
    | 'run_example'
    | 'validate';
  searchTag: string;
  yamlPath: string;
}

/**
 * Default Attack Discovery workflows to register on plugin startup.
 * These workflows are available immediately when the feature flag is enabled.
 */
const DEFAULT_WORKFLOWS: DefaultWorkflowDefinition[] = [
  {
    key: 'custom_validation_example',
    searchTag: 'attackDiscovery:custom_validation_example',
    yamlPath: 'attack_discovery_custom_validation_example.workflow.yaml',
  },
  {
    key: 'default_alert_retrieval',
    searchTag: 'attackDiscovery:default_alert_retrieval',
    yamlPath: 'default_attack_discovery_alert_retrieval.workflow.yaml',
  },
  {
    key: 'esql_example_alert_retrieval',
    searchTag: 'attackDiscovery:esql_example_alert_retrieval',
    yamlPath: 'attack_discovery_esql_example.workflow.yaml',
  },
  {
    key: 'generation',
    searchTag: 'attackDiscovery:generation',
    yamlPath: 'attack_discovery_generation.workflow.yaml',
  },
  {
    key: 'run_example',
    searchTag: 'attackDiscovery:run_example',
    yamlPath: 'attack_discovery_run_example.workflow.yaml',
  },
  {
    key: 'validate',
    searchTag: 'attackDiscovery:validate',
    yamlPath: 'attack_discovery_validate.workflow.yaml',
  },
];

export type DefaultWorkflowKey = DefaultWorkflowDefinition['key'];

type RequiredDefaultWorkflowKey = 'default_alert_retrieval' | 'generation' | 'validate';
type OptionalDefaultWorkflowKey = Exclude<DefaultWorkflowKey, RequiredDefaultWorkflowKey>;

export type DefaultWorkflowIds = Record<RequiredDefaultWorkflowKey, string> &
  Partial<Record<OptionalDefaultWorkflowKey, string>>;

const REQUIRED_WORKFLOW_KEYS: ReadonlySet<RequiredDefaultWorkflowKey> = new Set([
  'default_alert_retrieval',
  'generation',
  'validate',
]);

const getFirstWorkflowIdForTag = ({ workflows }: { workflows: WorkflowListDto }): string | null =>
  workflows.results[0]?.id ?? null;

/**
 * Registers default Attack Discovery workflows on plugin startup.
 * Workflows are created if they don't exist, or skipped if already present.
 *
 * @param workflowsManagementApi - The workflows management API
 * @param spaceId - The space ID to register workflows in (defaults to 'default')
 * @param logger - Logger instance
 * @param request - The authenticated request used for workflow creation/update
 */
export const registerDefaultWorkflows = async (
  workflowsManagementApi: WorkflowsServerPluginSetup['management'],
  spaceId: string,
  logger: Logger,
  request: KibanaRequest
): Promise<DefaultWorkflowIds> => {
  logger.debug(() => 'Starting default workflow registration');

  const definitionsDir = join(__dirname, 'definitions');
  const resolvedWorkflowIds = {} as Partial<Record<DefaultWorkflowKey, string>>;

  for (const workflowDefinition of DEFAULT_WORKFLOWS) {
    try {
      const yamlPath = join(definitionsDir, workflowDefinition.yamlPath);
      const readDesiredYaml = (): string | null =>
        readBundledWorkflowYaml({
          logger,
          yamlFileName: workflowDefinition.yamlPath,
          yamlPath,
        });

      let workflows: WorkflowListDto;
      try {
        workflows = await workflowsManagementApi.getWorkflows(
          {
            _full: false,
            page: 1,
            size: 100,
            tags: [workflowDefinition.searchTag],
          },
          spaceId
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
          `🔴 discoveries: workflowsManagementApi.getWorkflows failed (key: '${workflowDefinition.key}', tag: '${workflowDefinition.searchTag}'): ${message}`
        );
        throw error;
      }

      const existingWorkflowId = getFirstWorkflowIdForTag({ workflows });

      if (!existingWorkflowId) {
        const desiredYaml = readDesiredYaml();
        if (!desiredYaml) {
          throw new Error(
            `Bundled YAML '${workflowDefinition.yamlPath}' is unavailable; cannot create missing workflow '${workflowDefinition.key}'`
          );
        }

        let createdWorkflow;
        try {
          createdWorkflow = await workflowsManagementApi.createWorkflow(
            {
              yaml: desiredYaml,
            },
            spaceId,
            request
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(
            `🔴 discoveries: workflowsManagementApi.createWorkflow failed (key: '${workflowDefinition.key}'): ${message}`
          );
          throw error;
        }

        resolvedWorkflowIds[workflowDefinition.key] = createdWorkflow.id;
        logger.info(
          `Successfully registered workflow '${workflowDefinition.key}' as '${createdWorkflow.id}'`
        );
        continue;
      }

      let existingWorkflow = null;
      try {
        existingWorkflow = await workflowsManagementApi.getWorkflow(existingWorkflowId, spaceId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
          `🔴 discoveries: workflowsManagementApi.getWorkflow failed (key: '${workflowDefinition.key}', id: '${existingWorkflowId}'): ${message}`
        );
        throw error;
      }

      if (!existingWorkflow) {
        throw new Error(
          `Found workflow id '${existingWorkflowId}' for tag '${workflowDefinition.searchTag}', but it no longer exists`
        );
      }

      const existingYaml = existingWorkflow.yaml?.trim();

      const desiredYaml = readDesiredYaml();
      if (desiredYaml && existingYaml !== desiredYaml) {
        logger.info(
          `Workflow '${existingWorkflowId}' (${workflowDefinition.key}) differs from bundled YAML; attempting update`
        );

        try {
          await workflowsManagementApi.updateWorkflow(
            existingWorkflowId,
            { yaml: desiredYaml },
            spaceId,
            request
          );
          logger.info(
            `Successfully updated workflow '${existingWorkflowId}' (${workflowDefinition.key})`
          );
        } catch (updateError) {
          const updateMessage =
            updateError instanceof Error ? updateError.message : String(updateError);
          logger.warn(
            `Failed to auto-update workflow '${existingWorkflowId}' (${workflowDefinition.key}): ${updateMessage}. The workflow will continue to use the previously stored YAML.`
          );
        }
      }

      resolvedWorkflowIds[workflowDefinition.key] = existingWorkflowId;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      logger.error(
        `🔴 discoveries: Failed to ensure workflow '${workflowDefinition.key}': ${stack ?? message}`
      );
      if (REQUIRED_WORKFLOW_KEYS.has(workflowDefinition.key as RequiredDefaultWorkflowKey)) {
        throw error;
      }
    }
  }

  const missingRequired = Array.from(REQUIRED_WORKFLOW_KEYS).filter(
    (key) => !resolvedWorkflowIds[key]
  );
  if (missingRequired.length > 0) {
    throw new Error(`Missing required default workflows: ${missingRequired.join(', ')}`);
  }

  logger.info('Default workflow registration complete');
  return resolvedWorkflowIds as DefaultWorkflowIds;
};
