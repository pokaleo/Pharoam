---
schema: pathway/1
slug: frontend-engineer
title: Frontend engineer
summary: Builds the parts of websites and web apps that people see and use, so they work well on every device and for everyone, including people who use assistive technology.
requirements:
  - skill: html
    level: 3
    importance: core
    sources:
      - &mdn-html
        title: "MDN Curriculum: Semantic HTML (core module)"
        url: https://developer.mozilla.org/en-US/curriculum/core/semantic-html/
        accessed: 2026-10-28
  - skill: css
    level: 3
    importance: core
    sources:
      - title: "MDN Curriculum: CSS fundamentals (core module)"
        url: https://developer.mozilla.org/en-US/curriculum/core/css-fundamentals/
        accessed: 2026-10-28
      - &mdn-layout
        title: "MDN Curriculum: CSS layout (core module)"
        url: https://developer.mozilla.org/en-US/curriculum/core/css-layout/
        accessed: 2026-10-28
  - skill: javascript
    level: 3
    importance: core
    sources:
      - title: "MDN Curriculum: JavaScript fundamentals (core module)"
        url: https://developer.mozilla.org/en-US/curriculum/core/javascript-fundamentals/
        accessed: 2026-10-28
      - &survey-languages
        title: "Stack Overflow Developer Survey 2025: languages used by professional developers (JavaScript 68.8%, TypeScript 48.8%)"
        url: https://survey.stackoverflow.co/2025/technology
        accessed: 2026-10-28
  - skill: typescript
    level: 2
    importance: core
    sources:
      - *survey-languages
  - skill: react
    level: 2
    importance: core
    sources:
      - &survey-frameworks
        title: "Stack Overflow Developer Survey 2025: web frameworks used by professional developers (React 46.9%, Next.js 21.5%)"
        url: https://survey.stackoverflow.co/2025/technology
        accessed: 2026-10-28
      - &mdn-frameworks
        title: "MDN Curriculum: JavaScript frameworks (extension module)"
        url: https://developer.mozilla.org/en-US/curriculum/extensions/a-practical-understanding-of-javascript-frameworks/
        accessed: 2026-10-28
  - skill: responsive-design
    level: 2
    importance: core
    sources:
      - *mdn-layout
  - skill: web-accessibility
    level: 2
    importance: core
    sources:
      - title: "MDN Curriculum: Accessibility (core module)"
        url: https://developer.mozilla.org/en-US/curriculum/core/accessibility/
        accessed: 2026-10-28
      - title: Web Content Accessibility Guidelines (WCAG) 2.2, W3C Recommendation
        url: https://www.w3.org/TR/WCAG22/
        accessed: 2026-10-28
  - skill: browser-apis
    level: 2
    importance: core
    sources:
      - title: "MDN Curriculum: Web APIs (extension module)"
        url: https://developer.mozilla.org/en-US/curriculum/extensions/web-apis/
        accessed: 2026-10-28
  - skill: http
    level: 2
    importance: core
    sources:
      - title: "MDN Curriculum: Web standards (core module)"
        url: https://developer.mozilla.org/en-US/curriculum/core/web-standards/
        accessed: 2026-10-28
  - skill: git
    level: 2
    importance: core
    sources:
      - title: "MDN Curriculum: Version control (core module)"
        url: https://developer.mozilla.org/en-US/curriculum/core/version-control/
        accessed: 2026-10-28
  - skill: unit-testing
    level: 2
    importance: core
    sources:
      - &mdn-testing
        title: "MDN Curriculum: Testing (extension module)"
        url: https://developer.mozilla.org/en-US/curriculum/extensions/testing/
        accessed: 2026-10-28
  - skill: ui-design
    level: 1
    importance: core
    sources:
      - title: "MDN Curriculum: Design for developers (core module)"
        url: https://developer.mozilla.org/en-US/curriculum/core/design-for-developers/
        accessed: 2026-10-28
  - skill: frontend-state-management
    level: 2
    importance: helpful
    sources:
      - *mdn-frameworks
  - skill: vite
    level: 1
    importance: helpful
    sources:
      - *mdn-frameworks
      - &mdn-tooling
        title: "MDN Curriculum: Other tooling types (extension module)"
        url: https://developer.mozilla.org/en-US/curriculum/extensions/other-tooling-types/
        accessed: 2026-10-28
  - skill: eslint
    level: 1
    importance: helpful
    sources:
      - *mdn-tooling
  - skill: frontend-performance
    level: 1
    importance: helpful
    sources:
      - title: "MDN Curriculum: Performance (extension module)"
        url: https://developer.mozilla.org/en-US/curriculum/extensions/performance/
        accessed: 2026-10-28
  - skill: web-application-security
    level: 1
    importance: helpful
    sources:
      - title: "MDN Curriculum: Security and privacy (extension module)"
        url: https://developer.mozilla.org/en-US/curriculum/extensions/security-and-privacy/
        accessed: 2026-10-28
  - skill: end-to-end-testing
    level: 1
    importance: helpful
    sources:
      - *mdn-testing
  - skill: nextjs
    level: 1
    importance: helpful
    sources:
      - *survey-frameworks
uncertainties:
  - The levels describe a typical first frontend role. Employers set the bar differently, and senior roles expect more.
  - React is the most used framework among professional developers, but many teams use Angular, Vue or Svelte; the skills transfer, the details don't.
  - The sources show which skills matter, not exactly which level a role needs. The levels are a judgement, reviewed before publication.
review:
  by: The Pharoam founder
  at: 2026-10-28
ai:
  task: draft-pathway@1
  model: anthropic/claude-opus-5-5
  at: 2026-10-28T21:17:07Z
---
# Frontend engineer

Builds the parts of websites and web apps that people see and use, so they work well on every device and for
everyone, including people who use assistive technology.

**Core:** HTML, CSS and JavaScript at a proficient level; TypeScript, React, responsive design, web accessibility,
browser APIs, HTTP, Git and unit testing at a working level; the basics of UI design.

**Helpful:** frontend state management, build tools such as Vite, linting, performance, web security, end-to-end
testing and Next.js.

Most requirements follow the MDN Curriculum, Mozilla's summary of the essential skills for new front-end
developers. Framework and language choices follow the Stack Overflow Developer Survey 2025.
