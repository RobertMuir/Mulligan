# Design brief

**Decision.** {what needs designing}

**Callers.** Write the usage first: {who calls this and what they need to do}

**Must fit.** {existing types, modules, callers that cannot break, invariants}

**Constraints.** Cookbook architecture rules: {…} · Mulligan Memory: {…} · Non-functional: {performance, safety, data residency}

**Produce.** Usage example and call sites · core data types and how they are read and written · public interface · module map · sketch with `not implemented` bodies · rationale: trade-offs accepted, at least one alternative and why it lost, questions for the developer.

**Judge the design by.** What the interface hides compared with its size; whether each decision lives in one place; whether it can be verified.

**Do not implement** until the developer agrees the shape.
