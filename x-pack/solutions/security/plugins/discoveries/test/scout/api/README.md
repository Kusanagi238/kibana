# Discoveries - Scout API Tests

Scout API integration tests for the `discoveries` plugin's internal routes.

## Prerequisites

Stop any locally running Elasticsearch and Kibana instances before starting the Scout server.

## Running

### Start the server (stateful)

```sh
node scripts/scout.js start-server --location local --arch stateful --domain classic
```

### Or serverless (security complete)

```sh
node scripts/scout.js start-server --location local --arch serverless --domain security_complete
```

### Run the tests

```sh
npx playwright test --config x-pack/solutions/security/plugins/discoveries/test/scout/api/playwright.config.ts --project=local
```

## Test Structure

```
test/scout/api/
├── playwright.config.ts        # Scout Playwright configuration
├── README.md                   # This file
├── fixtures/
│   ├── constants.ts            # Route paths, headers, tags
│   └── helpers.ts              # API wrappers, mock data, cleanup utilities
└── tests/
    ├── scaffold_verification.spec.ts  # Scaffold smoke test (skipped)
    ├── create.spec.ts                 # CRUD: create schedule
    ├── get.spec.ts                    # CRUD: get schedule by id
    ├── find.spec.ts                   # CRUD: find/list schedules
    ├── update.spec.ts                 # CRUD: update schedule
    ├── delete.spec.ts                 # CRUD: delete schedule
    ├── enable.spec.ts                 # Lifecycle: enable schedule
    ├── disable.spec.ts                # Lifecycle: disable schedule
    ├── rbac.spec.ts                   # RBAC: 403 for unauthorized users
    └── isolation.spec.ts              # Tag-based API isolation
```

## Test Utilities

| Utility | Purpose |
|---------|---------|
| `getSimpleWorkflowSchedule()` | Returns a minimal valid internal schedule body |
| `getSimplePublicSchedule()` | Returns a minimal valid public schedule body |
| `getWorkflowSchedulesApis()` | Wraps all 7 internal schedule routes with auth headers |
| `getPublicSchedulesApis()` | Wraps public schedule routes with auth and version headers |
| `enableWorkflowSchedulesFeature()` | Enables the feature flag via UI settings |
| `deleteAllWorkflowSchedules()` | Cleans up all internal schedules for test isolation |
| `deleteAllPublicSchedules()` | Cleans up all public schedules for test isolation |

## Test Categories

- **CRUD** (`create`, `get`, `find`, `update`, `delete`): Full lifecycle with happy paths, defaults, validation errors, pagination, and sorting
- **Lifecycle** (`enable`, `disable`): State transitions and 404 handling
- **RBAC** (`rbac`): Verifies 403 responses for unauthorized (viewer) users across all write operations
- **Isolation** (`isolation`): Tag-based isolation between internal and public schedule APIs
