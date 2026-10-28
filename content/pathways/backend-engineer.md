---
schema: pathway/1
slug: backend-engineer
title: Backend engineer
summary: Builds and runs the services behind apps, such as APIs, data storage and background work, so they are correct, secure and keep working under real use.
requirements:
  - skill: sql
    level: 3
    importance: core
    sources:
      - &survey-languages
        title: "Stack Overflow Developer Survey 2025: languages used by professional developers (SQL 61.3%, Python 54.8%, Bash/Shell 48.8%)"
        url: https://survey.stackoverflow.co/2025/technology
        accessed: 2026-10-28
  - skill: python
    level: 3
    importance: core
    sources:
      - *survey-languages
  - skill: http
    level: 3
    importance: core
    sources:
      - &mdn-server
        title: "MDN Learn: Server-side website programming (client-server overview, frameworks, security)"
        url: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side
        accessed: 2026-10-28
  - skill: rest-api-design
    level: 2
    importance: core
    sources:
      - title: "Microsoft Azure Architecture Center: Web API design best practices"
        url: https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design
        accessed: 2026-10-28
  - skill: postgresql
    level: 2
    importance: core
    sources:
      - &survey-databases
        title: "Stack Overflow Developer Survey 2025: databases used by professional developers (PostgreSQL 58.2%, Redis 30.7%)"
        url: https://survey.stackoverflow.co/2025/technology
        accessed: 2026-10-28
      - &onet
        title: "O*NET OnLine: Software Developers (15-1252.00), technology skills marked in demand"
        url: https://www.onetonline.org/link/details/15-1252.00
        accessed: 2026-10-28
  - skill: data-modelling
    level: 2
    importance: core
    sources:
      - *mdn-server
  - skill: authentication-and-authorisation
    level: 2
    importance: core
    sources:
      - *mdn-server
      - &owasp
        title: OWASP Top 10:2025
        url: https://top10.owasp.org/
        accessed: 2026-10-28
  - skill: secure-coding
    level: 2
    importance: core
    sources:
      - *owasp
  - skill: unit-testing
    level: 2
    importance: core
    sources:
      - *mdn-server
      - *onet
  - skill: git
    level: 2
    importance: core
    sources:
      - *onet
  - skill: docker
    level: 2
    importance: core
    sources:
      - &survey-cloud
        title: "Stack Overflow Developer Survey 2025: cloud development tools used by professional developers (Docker 73.8%, AWS 45.9%, Kubernetes 30.1%, Terraform 18.7%)"
        url: https://survey.stackoverflow.co/2025/technology
        accessed: 2026-10-28
  - skill: linux
    level: 2
    importance: core
    sources:
      - *survey-languages
      - *onet
  - skill: integration-testing
    level: 2
    importance: helpful
    sources:
      - *onet
  - skill: fastapi
    level: 2
    importance: helpful
    sources:
      - &survey-frameworks
        title: "Stack Overflow Developer Survey 2025: web frameworks used by professional developers (Node.js 49.1%, FastAPI 15.1%)"
        url: https://survey.stackoverflow.co/2025/technology
        accessed: 2026-10-28
  - skill: nodejs
    level: 2
    importance: helpful
    sources:
      - *survey-frameworks
  - skill: redis
    level: 1
    importance: helpful
    sources:
      - *survey-databases
      - *onet
  - skill: message-queues
    level: 1
    importance: helpful
    sources:
      - *onet
  - skill: aws
    level: 1
    importance: helpful
    sources:
      - *survey-cloud
  - skill: kubernetes
    level: 1
    importance: helpful
    sources:
      - *survey-cloud
  - skill: ci-cd
    level: 1
    importance: helpful
    sources:
      - *onet
      - &twelve-factor
        title: The Twelve-Factor App
        url: https://12factor.net/
        accessed: 2026-10-28
  - skill: observability
    level: 1
    importance: helpful
    sources:
      - *twelve-factor
  - skill: infrastructure-as-code
    level: 1
    importance: helpful
    sources:
      - *onet
      - *survey-cloud
uncertainties:
  - The levels describe a typical first backend role. Employers set the bar differently, and senior roles expect more, especially in system design.
  - Python is listed because it is the most used general-purpose backend language among professional developers, but Java, Go, C# and TypeScript are just as good a route; the skills transfer.
  - O*NET describes the US job market. The levels are a judgement, reviewed before publication.
review:
  by: The Pharoam founder
  at: 2026-10-28
ai:
  task: draft-pathway@1
  model: anthropic/claude-opus-5-5
  at: 2026-10-28T21:31:24Z
---
# Backend engineer

Builds and runs the services behind apps, such as APIs, data storage and background work, so they are correct,
secure and keep working under real use.

**Core:** SQL, Python and HTTP at a proficient level; REST API design, PostgreSQL, data modelling, authentication
and authorisation, secure coding, unit testing, Git, Docker and Linux at a working level.

**Helpful:** integration testing, a web framework such as FastAPI, Node.js, Redis, message queues, AWS, Kubernetes,
CI/CD, observability and infrastructure as code.

Requirements follow the Stack Overflow Developer Survey 2025, O*NET's technology skills for software developers,
MDN's server-side programming module, the OWASP Top 10 and the Twelve-Factor App.
