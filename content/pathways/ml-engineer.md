---
schema: pathway/1
slug: ml-engineer
title: Machine-learning engineer
summary: Builds, ships and runs machine-learning systems in production, from preparing data and training models to serving them and watching how they behave.
requirements:
  - skill: python
    level: 3
    importance: core
    sources:
      - &survey-languages
        title: "Stack Overflow Developer Survey 2025: languages used by professional developers (SQL 61.3%, Python 54.8%)"
        url: https://survey.stackoverflow.co/2025/technology
        accessed: 2026-10-28
  - skill: machine-learning
    level: 3
    importance: core
    sources:
      - &mlcc
        title: "Google Machine Learning Crash Course (models, data, generalisation and overfitting, neural networks, production ML systems, fairness)"
        url: https://developers.google.com/machine-learning/crash-course
        accessed: 2026-10-28
      - &onet
        title: "O*NET OnLine: Data Scientists (15-2051.00), tasks, knowledge and technology skills"
        url: https://www.onetonline.org/link/details/15-2051.00
        accessed: 2026-10-28
  - skill: model-evaluation
    level: 3
    importance: core
    sources:
      - *onet
      - *mlcc
  - skill: statistics
    level: 2
    importance: core
    sources:
      - &mml
        title: "Mathematics for Machine Learning, Deisenroth, Faisal and Ong (Cambridge University Press, 2020), Part I"
        url: https://mml-book.github.io/
        accessed: 2026-10-28
      - *onet
  - skill: linear-algebra
    level: 2
    importance: core
    sources:
      - *mml
  - skill: calculus
    level: 2
    importance: core
    sources:
      - *mml
  - skill: feature-engineering
    level: 2
    importance: core
    sources:
      - *onet
      - *mlcc
  - skill: data-cleaning
    level: 2
    importance: core
    sources:
      - *onet
      - *mlcc
  - skill: deep-learning
    level: 2
    importance: core
    sources:
      - *mlcc
  - skill: pytorch
    level: 2
    importance: core
    sources:
      - *onet
  - skill: sql
    level: 2
    importance: core
    sources:
      - *survey-languages
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
      - *onet
  - skill: mlops
    level: 2
    importance: core
    sources:
      - &mlops
        title: "Google Cloud Architecture Center: MLOps, continuous delivery and automation pipelines in machine learning"
        url: https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning
        accessed: 2026-10-28
  - skill: model-serving
    level: 2
    importance: core
    sources:
      - *mlops
  - skill: linux
    level: 2
    importance: helpful
    sources:
      - *onet
  - skill: model-monitoring
    level: 1
    importance: helpful
    sources:
      - *mlops
  - skill: tensorflow
    level: 1
    importance: helpful
    sources:
      - *onet
  - skill: apache-spark
    level: 1
    importance: helpful
    sources:
      - *onet
  - skill: apache-airflow
    level: 1
    importance: helpful
    sources:
      - *onet
  - skill: kubernetes
    level: 1
    importance: helpful
    sources:
      - *onet
  - skill: aws
    level: 1
    importance: helpful
    sources:
      - *onet
  - skill: responsible-ai
    level: 1
    importance: helpful
    sources:
      - *mlcc
uncertainties:
  - The levels describe a typical first machine-learning engineering role. Some employers want research depth, others mostly engineering; the balance varies widely.
  - O*NET has no separate machine-learning engineer occupation, so its Data Scientists profile stands in for the modelling side, and it describes the US job market.
  - Libraries such as pandas, NumPy and scikit-learn are used widely but aren't listed, because no source read for this pathway names them. The levels are a judgement, reviewed before publication.
review:
  by: The Pharoam founder
  at: 2026-10-28
ai:
  task: draft-pathway@1
  model: anthropic/claude-opus-5-5
  at: 2026-11-03T12:37:42Z
---
# Machine-learning engineer

Builds, ships and runs machine-learning systems in production, from preparing data and training models to serving
them and watching how they behave.

In a working machine-learning system, the model is only a small part. Most of it is the code around the model that
gathers and checks data, trains and tests models, serves predictions and keeps watch once they are live
([Google: MLOps](https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning)).
A machine-learning engineer builds that whole path.

Much of the day is spent on data and evidence: cleaning raw data and shaping it into features, training models,
comparing them with sound measures, and testing that their predictions hold up
([O*NET: Data Scientists](https://www.onetonline.org/link/details/15-2051.00);
[Google Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course)). The crash course
also covers checking that a model treats different groups of people fairly. Statistics, linear algebra and calculus
explain why models behave as they do, and help when they don't
([Mathematics for Machine Learning](https://mml-book.github.io/)).

Unlike most software, a model can get worse without any change to its code, as the data it sees drifts away from the
data it learnt from. So live models are monitored and retrained, often automatically
([Google: MLOps](https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning)).
Keeping models running like this takes the role further into engineering than a data scientist's, which O*NET
describes as analysing data and reporting what it shows.
