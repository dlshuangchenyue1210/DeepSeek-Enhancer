# Log-Level and Field Guidance

## Select Levels

| Level | Use when | Do not use when |
| --- | --- | --- |
| `TRACE` | Step-by-step detail or data-structure content is needed during development or a short, targeted diagnosis. | Routine production diagnosis, long-term enablement, or large object dumps. |
| `DEBUG` | Diagnostic information is useful during a production issue but not during normal operation. | Volume replaces information density, or every code-path transition is logged. |
| `INFO` | State transitions, startup, configuration summaries, or handled outcomes remain useful in normal operation. | Details logged "just in case" or frequent successful operations with no action required. |
| `WARN` | A potential problem has a clear follow-up action, such as capacity nearing a threshold. | Ordinary, non-actionable state; use `INFO` instead. |
| `ERROR` | A failure needs attention. Include safe diagnostic context, exception or stack information, and the system response. | The condition is expected, fully recovered automatically, and needs no human action. |
| `FATAL` | The process cannot continue and is about to exit. Include the cause, state summary, and recovery or diagnostic clues. | A normal error from which the service can continue or recover. |

Select a level by impact and required action, not merely by whether an exception was caught. A failure that is automatically retried and needs no human action can merit a lower level. Follow project conventions when they differ.

## Produce a Useful Log Record

Prefer structured fields and preserve project field names. Select only the information the event needs:

- a stable event name or concise message;
- safe correlation IDs for requests, traces, jobs, or resources;
- operation, outcome, and next action: retry, reject, degrade, or exit;
- safe diagnostic context, such as component, version, dependency, retry count, or latency bucket;
- error type, exception, and stack information only when repository conventions allow it and it does not expose sensitive values.

Make every record independently readable. Log collectors can split, reorder, or lose messages, and clocks across hosts are not guaranteed to be comparable. Avoid embedded newlines; carry the same correlation ID if a record must be split.

## Respect Performance Boundaries

- Use parameterized or lazy interfaces so disabled levels do not pay for string concatenation, formatting, or serialization.
- Evaluate hot paths, batch loops, and large object output; understand the I/O, asynchronous-writing, and batching trade-offs of the log collector.
- Asynchronous or batched writes can reduce caller-thread blocking, but a crash can lose unflushed messages. Do not treat logs as the only durable audit record.
- More verbose logging changes timing and can hide races. Compare behavior before and after the change; do not treat a disappearing issue after enabling logs as proof of a fix.

## Protect Security and Privacy

Minimize data before calling the logging API instead of relying on downstream aggregation filters. Filtering and replacement rules are additional defenses, never the only defense. Review especially:

- passwords, API keys, access tokens, cookies, and session IDs;
- email addresses, phone numbers, addresses, payment data, and other personal data;
- entire HTTP requests or responses, query parameters, authentication headers, exception objects, and object stringification;
- debug dumps, SQL bind parameters, and third-party SDK response objects.

Replace raw values with internal resource IDs, permitted hashes or masks, lengths, counts, enum states, or error categories.
