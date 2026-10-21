# Secrets patterns and existing scanners (research for the redaction sprint)

Status: draft by Ahmed Mohamed Ahmed Yousry, task S1-07. No code. Patterns below were written from general knowledge: before using any of them, confirm each against the official documentation linked in the "Check" column.

## 1. What Lens must mask

The proposal says API keys and passwords are masked before code reaches the model. Secrets appear in source files, `.env` files, config files, logs and stack traces (tool output).

## 2. Common secret types and patterns

| Type                 | Typical shape                                                                                           | Check                |
| -------------------- | ------------------------------------------------------------------------------------------------------- | -------------------- |
| AWS access key ID    | `AKIA` or `ASIA` + 16 uppercase letters/digits                                                          | AWS docs             |
| AWS secret key       | 40 base64-like characters (only reliable with context)                                                  | AWS docs             |
| GitHub tokens        | prefixes `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`                                          | GitHub docs          |
| Slack tokens         | `xoxb-`, `xoxp-`, `xoxa-`, `xoxr-`, `xoxs-` + digits/letters                                            | Slack docs           |
| Stripe keys          | `sk_live_`, `rk_live_` + letters/digits                                                                 | Stripe docs          |
| Google API key       | `AIza` + 35 URL-safe characters                                                                         | Google Cloud docs    |
| LLM provider keys    | prefixes such as `sk-` and `sk-ant-`; lengths vary                                                      | each provider's docs |
| JWT                  | three base64url parts separated by dots, starting `eyJ`                                                 | RFC 7519             |
| Private keys         | a line `-----BEGIN ... PRIVATE KEY-----` up to `-----END`                                               | RFC 7468             |
| Connection strings   | `scheme://user:password@host` (postgres, mysql, redis, mongodb)                                         | -                    |
| Generic assignments  | names like `password`, `passwd`, `secret`, `api_key`, `token` followed by `=` or `:` and a quoted value | -                    |
| High-entropy strings | long random-looking strings found near secret-like names                                                | -                    |

## 3. Three existing scanners

| Scanner        | How it works (summary)                                                                     | Useful for Lens                                         |
| -------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Gitleaks       | Regex rules plus entropy checks, rules defined in a TOML file                              | Good rule list to study; rule format is simple          |
| TruffleHog     | Many provider-specific detectors; can verify a found secret by calling the provider        | Lens must NOT verify secrets over the network (privacy) |
| detect-secrets | Python tool with plugins, regex and entropy, and a baseline file for known false positives | Good example of managing false positives                |

To do before the redaction sprint: for each, read the licence (can we reuse their patterns?), the rule list, and how they handle false positives.

## 4. Findings for the Lens design (recommendations)

- Use provider-specific patterns first (few false positives), then generic assignment patterns, then entropy only as a weak signal.
- A false negative leaks a secret to the model; a false positive hides real code and can hurt answer quality. Report both in the evaluation.
- Replace the value, not the whole line, with a marker such as `[REDACTED:github-token]` so code structure stays readable.
- Redact before token counting and before caching, so secrets never sit in the cache or reach the statistics events.
- Treat `.env`, key files and certificates as high risk: raw-code fallback must not bypass redaction.
- Tests must use fake secrets built in code (for example split strings joined at runtime). Real-looking tokens in the repo can trigger GitHub push protection.
- Never log the matched value, only the type and count.

## 5. Open questions

- Which false-positive rate is acceptable?
- Should users add their own patterns (config file)?
- Is redaction applied to tool output and history summaries too? (Recommended: yes.)
