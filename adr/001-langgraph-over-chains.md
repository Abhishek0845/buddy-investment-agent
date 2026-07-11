# 1. LangGraph Over Simple Linear Chains

## Status
Accepted

## Context
Our investment research agent needs to perform complex, iterative reasoning. Standard linear chains (like sequential chains in LangChain or simple sequential API calls) are insufficient because:
- Research is naturally cyclic: finding new information might require revising the query or searching for different topics.
- We need human-in-the-loop capabilities, allowing execution to pause and resume based on user feedback.
- We need state management that can survive across multiple interactions.

## Decision
We will use **LangGraph** as our primary orchestration framework instead of simple linear LLM chains. LangGraph allows us to define the agent's behavior as a state graph, supporting loops, conditional routing, and state persistence.

## Consequences
### Positive
- **Flexibility**: We can model complex agent workflows with loops and conditional transitions.
- **State Management**: Built-in support for short-term and long-term memory, checkpointing, and time travel.
- **Human-in-the-loop**: Easy interruption points to request user input or approval.

### Negative
- **Complexity**: Graph definition and state schemas introduce more boilerplate and learning curve compared to simple chains.
- **Debugging**: Tracing state updates and transitions through graph nodes can be harder to debug.
