---
name: agent-logging
description: Design, implement, review, and troubleshoot application and service logging. Use when adding or changing logs, selecting log levels, defining structured log fields, reviewing logging security or performance, configuring log levels, or diagnosing production issues from logs; remain language- and logging-library-agnostic.
---

# Application Logging

## Define the Task First

Before making changes, inspect the relevant call path, existing logs, logging configuration, tests, and deployment or aggregation conventions. Establish:

- the event to explain, its audience, and the action it should enable;
- the event boundary and outcome: success, failure, retry, degradation, or exit;
- available correlation identifiers, such as request, trace, job, tenant, or resource IDs;
- data classification and fields that must not be logged.

Ask the user if the event purpose, sensitive-data rules, or existing conventions cannot be established from code and configuration. Do not guess or introduce new global conventions.

## Implement or Change Logs

1. Use the existing logging framework and structured format. Do not substitute `print`, temporary code, or a new library.
2. Emit one self-contained, parseable record without embedded newlines for each diagnosable event. Include the necessary outcome, error summary, correlation ID, and next action. If atomic output is impossible, attach a unique correlation ID to the related records.
3. Use [log-level and field guidance](references/logging-principles.md) to select levels and fields and to address performance and sensitive data.
4. At the exception-handling boundary, log enough non-duplicative context to diagnose the failure. State whether the system will retry, degrade, reject the request, or exit.
5. Add or update existing tests for key fields, level, exception context, and redaction. Do not introduce an unrelated test framework for logging.

## Review Logging Changes

Check:

- whether levels match the event impact and required action, and records are independently understandable and queryable by correlation ID;
- whether sensitive data leaks or unnecessary work occurs in hot paths, loops, or disabled levels;
- whether fields and configuration follow project conventions and logs are not being used as metrics or tracing.

## Troubleshoot from Logs

1. Narrow the service and version, time window, environment, and affected operation. Start from a request, trace, job, or resource ID.
2. Read the self-contained event record to confirm the outcome and system action, then corroborate with related logs, metrics, and traces.
3. If more detail is needed, enable `DEBUG` or `TRACE` only for the target component and a short time window, with an explicit disable condition. Do not raise production verbosity globally and indefinitely.
4. Turn missing diagnostic evidence into the smallest logging change. Do not add permanent noise for one investigation.

## Configure Logging

Treat log levels and output settings as versioned, validated runtime configuration. Combine a global default level with component-level overrides, keeping normal production output useful but restrained. After changing configuration, verify its scope, sensitive-data handling, and performance impact.
