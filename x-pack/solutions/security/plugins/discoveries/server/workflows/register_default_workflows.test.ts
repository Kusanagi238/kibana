/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { loggerMock } from '@kbn/logging-mocks';
import type { KibanaRequest } from '@kbn/core/server';
import type { WorkflowsServerPluginSetup } from '@kbn/workflows-management-plugin/server';

import { registerDefaultWorkflows } from './register_default_workflows';

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('mock yaml content'),
}));

const mockGetWorkflows = jest.fn();
const mockCreateWorkflow = jest.fn();
const mockGetWorkflow = jest.fn();
const mockUpdateWorkflow = jest.fn();

const mockWorkflowsManagementApi = {
  createWorkflow: mockCreateWorkflow,
  getWorkflow: mockGetWorkflow,
  getWorkflows: mockGetWorkflows,
  updateWorkflow: mockUpdateWorkflow,
} as unknown as WorkflowsServerPluginSetup['management'];

const mockLogger = loggerMock.create();
const mockRequest = {} as KibanaRequest;
const mockSpaceId = 'default';

const REQUIRED_WORKFLOW_KEYS = ['default_alert_retrieval', 'generation', 'validate'] as const;
const ALL_WORKFLOW_KEYS = [
  'custom_validation_example',
  'default_alert_retrieval',
  'esql_example_alert_retrieval',
  'generation',
  'run_example',
  'validate',
] as const;

/** Returns an empty workflow list (no existing workflows). */
const emptyWorkflowList = () => ({ results: [], total: 0 });

/** Returns a workflow list containing one workflow with the given id. */
const workflowListWith = (id: string) => ({ results: [{ id }], total: 1 });

/** Returns a workflow object with the given id and yaml. */
const workflowWith = (id: string, yaml = 'mock yaml content') => ({ id, yaml });

/** Sets up mockGetWorkflows and mockCreateWorkflow for the happy path (all new workflows). */
const setupNewWorkflowsHappyPath = () => {
  mockGetWorkflows.mockResolvedValue(emptyWorkflowList());
  ALL_WORKFLOW_KEYS.forEach((key, i) => {
    mockCreateWorkflow.mockResolvedValueOnce({ id: `created-id-${key}-${i}` });
  });
};

describe('registerDefaultWorkflows', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    const { readFileSync } = jest.requireMock('fs');
    readFileSync.mockReturnValue('mock yaml content');
  });

  describe('happy path — all workflows are new', () => {
    it('returns workflow IDs for all required keys', async () => {
      setupNewWorkflowsHappyPath();

      const result = await registerDefaultWorkflows(
        mockWorkflowsManagementApi,
        mockSpaceId,
        mockLogger,
        mockRequest
      );

      for (const key of REQUIRED_WORKFLOW_KEYS) {
        expect(result[key]).toBeDefined();
        expect(typeof result[key]).toBe('string');
      }
    });

    it('calls createWorkflow once per workflow definition', async () => {
      setupNewWorkflowsHappyPath();

      await registerDefaultWorkflows(
        mockWorkflowsManagementApi,
        mockSpaceId,
        mockLogger,
        mockRequest
      );

      expect(mockCreateWorkflow).toHaveBeenCalledTimes(ALL_WORKFLOW_KEYS.length);
    });

    it('calls createWorkflow with the YAML content read from disk', async () => {
      setupNewWorkflowsHappyPath();

      await registerDefaultWorkflows(
        mockWorkflowsManagementApi,
        mockSpaceId,
        mockLogger,
        mockRequest
      );

      expect(mockCreateWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ yaml: 'mock yaml content' }),
        mockSpaceId,
        mockRequest
      );
    });

    it('does not call getWorkflow or updateWorkflow when all workflows are new', async () => {
      setupNewWorkflowsHappyPath();

      await registerDefaultWorkflows(
        mockWorkflowsManagementApi,
        mockSpaceId,
        mockLogger,
        mockRequest
      );

      expect(mockGetWorkflow).not.toHaveBeenCalled();
      expect(mockUpdateWorkflow).not.toHaveBeenCalled();
    });

    it('logs info after registration is complete', async () => {
      setupNewWorkflowsHappyPath();

      await registerDefaultWorkflows(
        mockWorkflowsManagementApi,
        mockSpaceId,
        mockLogger,
        mockRequest
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Default workflow registration complete')
      );
    });
  });

  describe('happy path — workflows already exist with matching YAML', () => {
    it('returns the existing workflow IDs without calling createWorkflow', async () => {
      for (const key of ALL_WORKFLOW_KEYS) {
        mockGetWorkflows.mockResolvedValueOnce(workflowListWith(`existing-id-${key}`));
        mockGetWorkflow.mockResolvedValueOnce(
          workflowWith(`existing-id-${key}`, 'mock yaml content')
        );
      }

      const result = await registerDefaultWorkflows(
        mockWorkflowsManagementApi,
        mockSpaceId,
        mockLogger,
        mockRequest
      );

      expect(mockCreateWorkflow).not.toHaveBeenCalled();
      expect(result.default_alert_retrieval).toBe('existing-id-default_alert_retrieval');
      expect(result.generation).toBe('existing-id-generation');
      expect(result.validate).toBe('existing-id-validate');
    });

    it('does not call updateWorkflow when existing YAML matches bundled YAML', async () => {
      for (const key of ALL_WORKFLOW_KEYS) {
        mockGetWorkflows.mockResolvedValueOnce(workflowListWith(`existing-id-${key}`));
        mockGetWorkflow.mockResolvedValueOnce(
          workflowWith(`existing-id-${key}`, 'mock yaml content')
        );
      }

      await registerDefaultWorkflows(
        mockWorkflowsManagementApi,
        mockSpaceId,
        mockLogger,
        mockRequest
      );

      expect(mockUpdateWorkflow).not.toHaveBeenCalled();
    });
  });

  describe('update path — existing workflow YAML differs from bundled YAML', () => {
    it('calls updateWorkflow when existing YAML differs from bundled YAML', async () => {
      for (const key of ALL_WORKFLOW_KEYS) {
        mockGetWorkflows.mockResolvedValueOnce(workflowListWith(`existing-id-${key}`));
        mockGetWorkflow.mockResolvedValueOnce(
          workflowWith(`existing-id-${key}`, 'old yaml content')
        );
      }

      await registerDefaultWorkflows(
        mockWorkflowsManagementApi,
        mockSpaceId,
        mockLogger,
        mockRequest
      );

      expect(mockUpdateWorkflow).toHaveBeenCalledTimes(ALL_WORKFLOW_KEYS.length);
    });

    it('calls updateWorkflow with the new YAML content', async () => {
      mockGetWorkflows.mockResolvedValue(workflowListWith('existing-id'));
      mockGetWorkflow.mockResolvedValue(workflowWith('existing-id', 'old yaml content'));

      await registerDefaultWorkflows(
        mockWorkflowsManagementApi,
        mockSpaceId,
        mockLogger,
        mockRequest
      );

      expect(mockUpdateWorkflow).toHaveBeenCalledWith(
        'existing-id',
        expect.objectContaining({ yaml: 'mock yaml content' }),
        mockSpaceId,
        mockRequest
      );
    });

    it('logs a warning when updateWorkflow throws, but does not rethrow', async () => {
      mockGetWorkflows.mockResolvedValue(workflowListWith('existing-id'));
      mockGetWorkflow.mockResolvedValue(workflowWith('existing-id', 'old yaml content'));
      mockUpdateWorkflow.mockRejectedValue(new Error('update failed'));

      await expect(
        registerDefaultWorkflows(mockWorkflowsManagementApi, mockSpaceId, mockLogger, mockRequest)
      ).resolves.toBeDefined();

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('update failed'));
    });
  });

  describe('error path — getWorkflows throws', () => {
    it('rethrows when getWorkflows fails for a required workflow key', async () => {
      mockGetWorkflows.mockRejectedValue(new Error('ES unavailable'));

      await expect(
        registerDefaultWorkflows(mockWorkflowsManagementApi, mockSpaceId, mockLogger, mockRequest)
      ).rejects.toThrow('ES unavailable');
    });

    it('logs an error when getWorkflows fails for a required workflow key', async () => {
      mockGetWorkflows.mockRejectedValue(new Error('ES unavailable'));

      await expect(
        registerDefaultWorkflows(mockWorkflowsManagementApi, mockSpaceId, mockLogger, mockRequest)
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('ES unavailable'));
    });

    it('continues registration and returns required IDs when an optional workflow fails', async () => {
      // custom_validation_example (index 0 in DEFAULT_WORKFLOWS) is optional — throw for it
      // all other workflows succeed
      mockGetWorkflows
        .mockRejectedValueOnce(new Error('optional workflow failed')) // custom_validation_example
        .mockResolvedValue(emptyWorkflowList()); // default_alert_retrieval, esql_example, generation, run_example, validate

      let callCount = 0;
      mockCreateWorkflow.mockImplementation(() => {
        callCount += 1;
        return Promise.resolve({ id: `created-id-${callCount}` });
      });

      const result = await registerDefaultWorkflows(
        mockWorkflowsManagementApi,
        mockSpaceId,
        mockLogger,
        mockRequest
      );

      expect(result.default_alert_retrieval).toBeDefined();
      expect(result.generation).toBeDefined();
      expect(result.validate).toBeDefined();
    });

    it('logs error but does not rethrow when an optional workflow fails', async () => {
      mockGetWorkflows
        .mockRejectedValueOnce(new Error('optional workflow failed')) // custom_validation_example (optional)
        .mockResolvedValue(emptyWorkflowList());

      let callCount = 0;
      mockCreateWorkflow.mockImplementation(() => {
        callCount += 1;
        return Promise.resolve({ id: `created-id-${callCount}` });
      });

      await registerDefaultWorkflows(
        mockWorkflowsManagementApi,
        mockSpaceId,
        mockLogger,
        mockRequest
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('optional workflow failed')
      );
    });
  });

  describe('error path — createWorkflow throws', () => {
    it('rethrows when createWorkflow fails for a required workflow key', async () => {
      // All getWorkflows return empty (no existing), createWorkflow throws for the first required
      mockGetWorkflows.mockResolvedValue(emptyWorkflowList());
      mockCreateWorkflow.mockRejectedValue(new Error('create failed'));

      await expect(
        registerDefaultWorkflows(mockWorkflowsManagementApi, mockSpaceId, mockLogger, mockRequest)
      ).rejects.toThrow('create failed');
    });

    it('logs an error when createWorkflow fails', async () => {
      mockGetWorkflows.mockResolvedValue(emptyWorkflowList());
      mockCreateWorkflow.mockRejectedValue(new Error('create failed'));

      await expect(
        registerDefaultWorkflows(mockWorkflowsManagementApi, mockSpaceId, mockLogger, mockRequest)
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('create failed'));
    });
  });

  describe('error path — YAML file unreadable', () => {
    it('throws when bundled YAML is unreadable for a required workflow', async () => {
      const { readFileSync } = jest.requireMock('fs');
      readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: file not found');
      });

      mockGetWorkflows.mockResolvedValue(emptyWorkflowList());

      await expect(
        registerDefaultWorkflows(mockWorkflowsManagementApi, mockSpaceId, mockLogger, mockRequest)
      ).rejects.toThrow(/unavailable.*cannot create/i);
    });

    it('logs a warning when bundled YAML is unreadable', async () => {
      const { readFileSync } = jest.requireMock('fs');
      readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: file not found');
      });

      mockGetWorkflows.mockResolvedValue(emptyWorkflowList());

      await expect(
        registerDefaultWorkflows(mockWorkflowsManagementApi, mockSpaceId, mockLogger, mockRequest)
      ).rejects.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read bundled workflow YAML')
      );
    });
  });
});
