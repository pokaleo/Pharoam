---
schema: pathway/1
slug: applied-ai-engineer
title: Applied AI engineer
summary: Builds products and features on top of language models, such as assistants, retrieval and agents, and makes them reliable, measurable and safe to use.
requirements:
  - skill: python
    level: 3
    importance: core
    sources:
      - title: "Stack Overflow Developer Survey 2025: languages used by professional developers (Python 54.8%)"
        url: https://survey.stackoverflow.co/2025/technology
        accessed: 2026-10-28
  - skill: prompt-engineering
    level: 3
    importance: core
    sources:
      - &anthropic-prompting
        title: "Anthropic documentation: Prompt engineering overview (success criteria and empirical tests first)"
        url: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview
        accessed: 2026-10-28
  - skill: llm-evaluation
    level: 2
    importance: core
    sources:
      - title: "OpenAI API documentation: Working with evals"
        url: https://developers.openai.com/api/docs/guides/evals
        accessed: 2026-10-28
      - *anthropic-prompting
  - skill: retrieval-augmented-generation
    level: 2
    importance: core
    sources:
      - &rag-paper
        title: "Lewis et al., Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks (NeurIPS 2020)"
        url: https://arxiv.org/abs/2005.11401
        accessed: 2026-10-28
      - &anthropic-agents
        title: "Anthropic, Building effective agents (December 2024): the augmented LLM, with retrieval, tools and memory"
        url: https://www.anthropic.com/engineering/building-effective-agents
        accessed: 2026-10-28
  - skill: embeddings-and-vector-search
    level: 2
    importance: core
    sources:
      - *rag-paper
      - &owasp-llm
        title: "OWASP Top 10 for LLM Applications 2025 (prompt injection, improper output handling, vector and embedding weaknesses, misinformation, excessive agency)"
        url: https://genai.owasp.org/llm-top-10/
        accessed: 2026-10-28
  - skill: tool-use-and-function-calling
    level: 2
    importance: core
    sources:
      - *anthropic-agents
  - skill: openai-api
    level: 2
    importance: core
    sources:
      - &survey-llms
        title: "Stack Overflow Developer Survey 2025: language models professional developers used for development work (OpenAI GPT 81.9%, Claude Sonnet 44.9%)"
        url: https://survey.stackoverflow.co/2025/technology
        accessed: 2026-10-28
  - skill: hallucination-mitigation
    level: 2
    importance: core
    sources:
      - *owasp-llm
  - skill: web-application-security
    level: 2
    importance: core
    sources:
      - *owasp-llm
  - skill: git
    level: 2
    importance: core
    sources:
      - title: "O*NET OnLine: Software Developers (15-1252.00), technology skills marked in demand"
        url: https://www.onetonline.org/link/details/15-1252.00
        accessed: 2026-10-28
  - skill: claude-api
    level: 1
    importance: helpful
    sources:
      - *survey-llms
  - skill: ai-agents
    level: 1
    importance: helpful
    sources:
      - *anthropic-agents
  - skill: model-context-protocol
    level: 1
    importance: helpful
    sources:
      - title: "Model Context Protocol: an open-source standard for connecting AI applications to external systems"
        url: https://modelcontextprotocol.io/
        accessed: 2026-10-28
      - *anthropic-agents
  - skill: responsible-ai
    level: 1
    importance: helpful
    sources:
      - *owasp-llm
  - skill: transformers-architecture
    level: 1
    importance: helpful
    sources:
      - title: "Vaswani et al., Attention Is All You Need (2017)"
        url: https://arxiv.org/abs/1706.03762
        accessed: 2026-10-28
  - skill: ollama
    level: 1
    importance: helpful
    sources:
      - title: "Stack Overflow Developer Survey 2025: rising Stack Overflow tags professional developers used (Ollama 15%, RAG 11%)"
        url: https://survey.stackoverflow.co/2025/technology
        accessed: 2026-10-28
  - skill: docker
    level: 1
    importance: helpful
    sources:
      - &survey-tools
        title: "Stack Overflow Developer Survey 2025: tools and frameworks used by professional developers (Docker 73.8%, FastAPI 15.1%)"
        url: https://survey.stackoverflow.co/2025/technology
        accessed: 2026-10-28
  - skill: fastapi
    level: 1
    importance: helpful
    sources:
      - *survey-tools
uncertainties:
  - This is a young role and changes fast. Tools named here may be replaced within a year; the practices (evaluation, retrieval, tool use, security) last longer.
  - The model provider is listed by usage, not merit. The skills transfer between OpenAI, Anthropic, Google and open models.
  - The levels describe a typical first applied AI role and are a judgement, reviewed before publication.
review:
  by: The Pharoam founder
  at: 2026-10-28
ai:
  task: draft-pathway@1
  model: anthropic/claude-opus-5-5
  at: 2026-10-28T21:39:45Z
---
# Applied AI engineer

Builds products and features on top of language models, such as assistants, retrieval and agents, and makes them
reliable, measurable and safe to use.

**Core:** Python and prompt engineering at a proficient level; language model evaluation, retrieval-augmented
generation, embeddings and vector search, tool use, a model provider's API, hallucination mitigation, web application
security and Git at a working level.

**Helpful:** a second provider's API, AI agents, the Model Context Protocol, responsible AI, how transformers work,
running models locally with Ollama, Docker and FastAPI.

Requirements follow Anthropic's and OpenAI's documentation, Anthropic's guide to building effective agents, the
OWASP Top 10 for LLM Applications, the original retrieval-augmented generation paper and the Stack Overflow
Developer Survey 2025.
