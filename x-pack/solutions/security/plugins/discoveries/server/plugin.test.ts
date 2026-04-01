/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { coreMock } from '@kbn/core/server/mocks';
import type { AttackDiscoveryExecutorOptions } from '@kbn/attack-discovery-schedules-common';

import { DiscoveriesPlugin } from './plugin';
import type { DiscoveriesPluginSetupDeps } from './types';

jest.mock('@kbn/discoveries/impl/attack_discovery/alert_fields', () => ({
  ATTACK_DISCOVERY_ALERTS_CONTEXT: 'siem.security.attack.discovery',
  attackDiscoveryAlertFieldMap: {},
}));

jest.mock('./lib/schedules/workflow_executor', () => ({
  workflowExecutor: jest.fn().mockResolvedValue({ state: {} }),
}));

jest.mock('./routes', () => ({
  registerRoutes: jest.fn(),
}));

jest.mock('./lib/workflow_initialization', () => ({
  createWorkflowInitializationService: jest.fn().mockReturnValue({
    ensureWorkflowsForSpace: jest.fn(),
    verifyAndRepairWorkflows: jest.fn(),
  }),
}));

jest.mock('./skills/register_skills', () => ({
  registerSkills: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./workflows/register_workflow_steps', () => ({
  registerWorkflowSteps: jest.fn().mockReturnValue({ failedSteps: [] }),
}));

jest.mock('@kbn/alerting-plugin/common', () => ({
  mappingFromFieldMap: jest.fn().mockReturnValue({}),
}));

const { workflowExecutor } = jest.requireMock('./lib/schedules/workflow_executor');

const createMockRuleRegistry = () => ({
  ruleDataService: {
    initializeIndex: jest.fn().mockReturnValue({
      getReader: jest.fn(),
      getWriter: jest.fn(),
    }),
  },
});

const createMockEventLog = () => ({
  getIndexPattern: jest.fn().mockReturnValue('.kibana-event-log-*'),
  getLogger: jest.fn().mockReturnValue({ logEvent: jest.fn() }),
  registerProviderActions: jest.fn(),
  registerSavedObjectProvider: jest.fn(),
  isLoggingEntries: jest.fn().mockReturnValue(true),
  isIndexingEntries: jest.fn().mockReturnValue(true),
});

const createMockWorkflowsExtensions = () => ({
  registerStepType: jest.fn(),
});

const createMockElasticAssistant = () => ({
  actions: {} as never,
  registerAttackDiscoveryWorkflowExecutor: jest.fn(),
});

const createMockActions = () => ({
  registerType: jest.fn(),
});

const createMockAlerting = () => ({
  registerConnectorAdapter: jest.fn(),
});

const createPluginSetupDeps = (
  overrides: Partial<DiscoveriesPluginSetupDeps> = {}
): DiscoveriesPluginSetupDeps => ({
  actions: createMockActions() as unknown as DiscoveriesPluginSetupDeps['actions'],
  alerting: createMockAlerting() as unknown as DiscoveriesPluginSetupDeps['alerting'],
  eventLog: createMockEventLog() as unknown as DiscoveriesPluginSetupDeps['eventLog'],
  ruleRegistry: createMockRuleRegistry() as unknown as DiscoveriesPluginSetupDeps['ruleRegistry'],
  workflowsExtensions:
    createMockWorkflowsExtensions() as unknown as DiscoveriesPluginSetupDeps['workflowsExtensions'],
  ...overrides,
});

const createPluginInitializerContext = () =>
  coreMock.createPluginInitializerContext({
    enabled: true,
  });

describe('DiscoveriesPlugin', () => {
  describe('setup', () => {
    describe('workflow executor registration', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('registers the workflow executor when elasticAssistant is available', () => {
        const mockElasticAssistant = createMockElasticAssistant();
        const context = createPluginInitializerContext();
        const plugin = new DiscoveriesPlugin(context);

        const coreSetup = coreMock.createSetup();
        const deps = createPluginSetupDeps({
          elasticAssistant: mockElasticAssistant,
        });

        plugin.setup(coreSetup, deps);

        expect(mockElasticAssistant.registerAttackDiscoveryWorkflowExecutor).toHaveBeenCalledTimes(
          1
        );
        expect(mockElasticAssistant.registerAttackDiscoveryWorkflowExecutor).toHaveBeenCalledWith(
          expect.any(Function)
        );
      });

      it('does not throw when elasticAssistant is not available', () => {
        const context = createPluginInitializerContext();
        const plugin = new DiscoveriesPlugin(context);

        const coreSetup = coreMock.createSetup();
        const deps = createPluginSetupDeps();

        expect(() => plugin.setup(coreSetup, deps)).not.toThrow();
      });

      it('invokes workflowExecutor when the registered factory is called', async () => {
        const mockElasticAssistant = createMockElasticAssistant();
        const context = createPluginInitializerContext();
        const plugin = new DiscoveriesPlugin(context);

        const coreSetup = coreMock.createSetup();
        const deps = createPluginSetupDeps({
          elasticAssistant: mockElasticAssistant,
        });

        plugin.setup(coreSetup, deps);

        const factory =
          mockElasticAssistant.registerAttackDiscoveryWorkflowExecutor.mock.calls[0][0];

        const mockOptions = {
          params: { alertsIndexPattern: '.alerts-*', apiConfig: {} },
          rule: { id: 'rule-1' },
          services: { alertsClient: {} },
          spaceId: 'default',
        } as unknown as AttackDiscoveryExecutorOptions;

        const result = await factory(mockOptions);

        expect(workflowExecutor).toHaveBeenCalledTimes(1);
        expect(workflowExecutor).toHaveBeenCalledWith({
          deps: expect.objectContaining({
            getEventLogIndex: expect.any(Function),
            getEventLogger: expect.any(Function),
            getStartServices: expect.any(Function),
            logger: expect.anything(),
            request: expect.objectContaining({
              headers: expect.any(Object),
            }),
            workflowInitService: expect.objectContaining({
              ensureWorkflowsForSpace: expect.any(Function),
            }),
          }),
          options: mockOptions,
        });

        expect(result).toEqual({ state: {} });
      });

      it('creates a fake request with authorization extracted from the scoped cluster client transport', async () => {
        const mockElasticAssistant = createMockElasticAssistant();
        const context = createPluginInitializerContext();
        const plugin = new DiscoveriesPlugin(context);

        const coreSetup = coreMock.createSetup();
        const deps = createPluginSetupDeps({
          elasticAssistant: mockElasticAssistant,
        });

        plugin.setup(coreSetup, deps);

        const factory =
          mockElasticAssistant.registerAttackDiscoveryWorkflowExecutor.mock.calls[0][0];

        const mockOptions = {
          executionId: 'exec-1',
          params: { alertsIndexPattern: '.alerts-*', apiConfig: {} },
          rule: { id: 'rule-1' },
          services: {
            alertsClient: {},
            scopedClusterClient: {
              asCurrentUser: {
                transport: {
                  headers: { authorization: 'ApiKey dGVzdC1lbmNvZGVk' },
                },
              },
            },
          },
          spaceId: 'default',
        } as unknown as AttackDiscoveryExecutorOptions;

        await factory(mockOptions);

        const passedRequest = workflowExecutor.mock.calls[0][0].deps.request;
        expect(passedRequest.headers).toEqual(
          expect.objectContaining({
            authorization: 'ApiKey dGVzdC1lbmNvZGVk',
          })
        );
      });

      it('falls back to empty headers when transport has no authorization header', async () => {
        const mockElasticAssistant = createMockElasticAssistant();
        const context = createPluginInitializerContext();
        const plugin = new DiscoveriesPlugin(context);

        const coreSetup = coreMock.createSetup();
        const deps = createPluginSetupDeps({
          elasticAssistant: mockElasticAssistant,
        });

        plugin.setup(coreSetup, deps);

        const factory =
          mockElasticAssistant.registerAttackDiscoveryWorkflowExecutor.mock.calls[0][0];

        const mockOptions = {
          executionId: 'exec-1',
          params: { alertsIndexPattern: '.alerts-*', apiConfig: {} },
          rule: { id: 'rule-1' },
          services: {
            alertsClient: {},
            scopedClusterClient: {
              asCurrentUser: {
                transport: { headers: {} },
              },
            },
          },
          spaceId: 'default',
        } as unknown as AttackDiscoveryExecutorOptions;

        await factory(mockOptions);

        expect(workflowExecutor).toHaveBeenCalledTimes(1);
        const passedRequest = workflowExecutor.mock.calls[0][0].deps.request;
        expect(passedRequest.headers.authorization).toBeUndefined();
      });

      it('creates a new request for each factory invocation', async () => {
        const mockElasticAssistant = createMockElasticAssistant();
        const context = createPluginInitializerContext();
        const plugin = new DiscoveriesPlugin(context);

        const coreSetup = coreMock.createSetup();
        const deps = createPluginSetupDeps({
          elasticAssistant: mockElasticAssistant,
        });

        plugin.setup(coreSetup, deps);

        const factory =
          mockElasticAssistant.registerAttackDiscoveryWorkflowExecutor.mock.calls[0][0];

        const mockOptions = {
          params: {},
          rule: { id: 'rule-1' },
          services: {},
          spaceId: 'default',
        } as unknown as AttackDiscoveryExecutorOptions;

        await factory(mockOptions);
        await factory(mockOptions);

        const firstRequest = workflowExecutor.mock.calls[0][0].deps.request;
        const secondRequest = workflowExecutor.mock.calls[1][0].deps.request;

        expect(firstRequest).not.toBe(secondRequest);
      });
    });
  });
});
