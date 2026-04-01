/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { AttachmentTypeDefinition } from '@kbn/agent-builder-server/attachments';

// Placeholder — real implementation added in PR 8
export const createDiagnosticReportAttachmentType = (): AttachmentTypeDefinition => ({
  format: async () => ({}),
  id: 'attack-discovery:diagnostic-report',
  validate: async () => ({ data: undefined, valid: true as const }),
});
