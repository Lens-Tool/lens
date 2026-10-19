# ADR 0002: privacy boundary

Status: proposed. The proposal requires that code, prompt text and file paths never leave the machine. Decision: the only cloud-bound type is `UsageEvent`; validation is an allow-list (`parseUsageEvent`) enforced by the sender and the API. Project and session IDs must be random, never derived from paths or names.
